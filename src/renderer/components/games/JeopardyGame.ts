/**
 * JeopardyGame Component
 *
 * Real Jeopardy game implementation with:
 * - Question selection board (categories × point values)
 * - Buzzer system (first to buzz gets to answer)
 * - Turn rotation (correct answerer picks next question)
 * - Daily Doubles with wager
 * - Final Jeopardy with wager
 * - Negative scoring for wrong answers
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { MultiplayerGame, GameState } from './MultiplayerGame.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';
import { RendererSupabaseClient } from '../../services/RendererSupabaseClient.js';

interface JeopardyGameState extends GameState {
  // Board state
  board: Array<{
    questionId: string;
    category: string;
    points: number;
    columnPosition: number;
    isSelected: boolean;
    isDailyDouble: boolean;
  }> | null;

  // Turn state
  currentPlayerId: string | null;
  selectedQuestionId: string | null;

  // Buzzer state
  buzzerEnabled: boolean;
  buzzers: Array<{ userId: string; buzzerRank: number; pressedAt: Date }>;
  firstBuzzerId: string | null;
  myBuzzerRank: number | null;

  // Answer feedback state
  showingAnswerFeedback: boolean;
  lastAnswerCorrect: boolean | null;
  lastAnswerUserId: string | null;
  feedbackQuestion: GameQuestion | null; // Store question for feedback display (survives currentQuestion becoming null)
  playersWhoAnsweredWrong: Set<string>;

  // Round state
  round: 'regular' | 'final_jeopardy';
  wagerAmount: number | null;
  showingDailyDoubleWager: boolean;
  showingFinalJeopardyWager: boolean;

  // Final Jeopardy state
  fjPhase: 'wager' | 'question' | 'results' | null;
  fjWagers: Map<string, number>; // userId -> wager amount
  fjMyWagerSubmitted: boolean;
  fjTimer: number | null; // seconds remaining
  fjAnswers: Map<string, { answer: string; isCorrect: boolean; pointsEarned: number }>; // userId -> answer data
  fjMyAnswerSubmitted: boolean;
}

export class JeopardyGame extends MultiplayerGame {
  protected state: JeopardyGameState;
  private buzzerChannel: RealtimeChannel | null = null;
  private fjWagerChannel: RealtimeChannel | null = null;
  private fjTimerInterval: ReturnType<typeof setInterval> | null = null;
  private boundHandleAnswerResult: ((event: Event) => void) | null = null;

  constructor(container: HTMLElement, initialState: GameState) {
    super(container, initialState);

    console.log('[JeopardyGame] Constructor called with initialState:', {
      hasCurrentQuestion: !!initialState.currentQuestion,
      currentQuestionId: initialState.currentQuestion?.id,
      currentPlayerId: initialState.session.currentPlayerId,
      selectedQuestionId: initialState.session.selectedQuestionId,
      gameStatus: initialState.session.status,
      round: initialState.session.round,
    });

    // Initialize Jeopardy-specific state from session
    this.state = {
      ...this.state,
      board: null,
      currentPlayerId: initialState.session.currentPlayerId || null,
      selectedQuestionId: initialState.session.selectedQuestionId || null,
      buzzerEnabled: false,
      buzzers: [],
      firstBuzzerId: null,
      myBuzzerRank: null,
      showingAnswerFeedback: false,
      lastAnswerCorrect: null,
      lastAnswerUserId: null,
      feedbackQuestion: null,
      playersWhoAnsweredWrong: new Set<string>(),
      round: initialState.session.round || 'regular',
      wagerAmount: null,
      showingDailyDoubleWager: false,
      showingFinalJeopardyWager: false,
      // Final Jeopardy state
      fjPhase: null,
      fjWagers: new Map<string, number>(),
      fjMyWagerSubmitted: false,
      fjTimer: null,
      fjAnswers: new Map<string, { answer: string; isCorrect: boolean; pointsEarned: number }>(),
      fjMyAnswerSubmitted: false,
    };
  }

  /**
   * Initialize Jeopardy game - load board and set first player
   */
  public async initialize(): Promise<void> {
    console.log('[JeopardyGame] initialize() called');
    await super.initialize();

    console.log('[JeopardyGame] Loading board...');
    // Load the Jeopardy board
    await this.loadBoard();
    console.log('[JeopardyGame] Board loaded:', this.state.board?.length, 'questions');

    // Subscribe to buzzer presses if we have a current question
    if (this.state.currentQuestion) {
      console.log('[JeopardyGame] Current question exists, subscribing to buzzers:', this.state.currentQuestion.id);
      this.subscribeToBuzzers(this.state.currentQuestion.id);
    } else {
      console.log('[JeopardyGame] No current question - board selection mode');
    }

    // Listen for answer results from other players (for rebuzz)
    this.boundHandleAnswerResult = this.handleAnswerResultEvent.bind(this);
    window.addEventListener('game:jeopardy:answer-result', this.boundHandleAnswerResult);
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    // Remove answer result listener
    if (this.boundHandleAnswerResult) {
      window.removeEventListener('game:jeopardy:answer-result', this.boundHandleAnswerResult);
      this.boundHandleAnswerResult = null;
    }
    // Unsubscribe from buzzer channel
    this.cleanupBuzzerChannel();
    // Unsubscribe from FJ wager channel
    this.cleanupFJWagerChannel();
    // Clear FJ timer
    if (this.fjTimerInterval) {
      clearInterval(this.fjTimerInterval);
      this.fjTimerInterval = null;
    }
    await super.cleanup();
  }

  /**
   * Handle answer result event from other players
   * This enables rebuzz when someone answers wrong
   */
  private handleAnswerResultEvent(event: Event): void {
    const customEvent = event as CustomEvent<{
      userId: string;
      questionId: string;
      isCorrect: boolean;
      pointsEarned: number;
    }>;
    const { userId, questionId, isCorrect, pointsEarned } = customEvent.detail;

    // Ignore if this is for a different question
    if (this.state.currentQuestion?.id !== questionId) {
      return;
    }

    // Ignore if this was our own answer (already handled locally)
    const currentUser = this.state.participants.find(p => p.isCurrentUser);
    if (userId === currentUser?.userId) {
      return;
    }

    console.log(`[JeopardyGame] Answer result event - user: ${userId}, correct: ${isCorrect}, points: ${pointsEarned}`);

    // Find who answered
    const answerer = this.state.participants.find(p => p.userId === userId);

    // Show answer feedback for all players - store current question for feedback display
    this.updateState({
      showingAnswerFeedback: true,
      lastAnswerCorrect: isCorrect,
      lastAnswerUserId: userId,
      feedbackQuestion: this.state.currentQuestion, // Store before it gets cleared
    });

    if (isCorrect) {
      // Correct answer: board will update via session subscription
      setTimeout(() => {
        this.updateState({ showingAnswerFeedback: false, feedbackQuestion: null });
      }, 2500);
    } else {
      // Wrong answer: track who got it wrong, re-enable buzzer for others
      const newWrongAnswers = new Set(this.state.playersWhoAnsweredWrong);
      newWrongAnswers.add(userId);

      this.updateState({
        playersWhoAnsweredWrong: newWrongAnswers,
      });

      // After showing feedback, re-enable buzzer for rebuzz
      // The answering player will clear the database, we just need to reset local state
      setTimeout(() => {
        this.updateState({
          showingAnswerFeedback: false,
          feedbackQuestion: null,
          buzzerEnabled: true,
          buzzers: [], // Clear local buzzer state for fresh rebuzz
          firstBuzzerId: null,
          myBuzzerRank: null,
          hasAnswered: false,
        });
      }, 2500);
    }
  }

  /**
   * Cleanup buzzer realtime channel
   */
  private cleanupBuzzerChannel(): void {
    if (this.buzzerChannel) {
      console.log('[JeopardyGame] Cleaning up buzzer channel');
      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();
      this.buzzerChannel.unsubscribe();
      if (client) client.removeChannel(this.buzzerChannel);
      this.buzzerChannel = null;
    }
  }

  /**
   * Cleanup Final Jeopardy wager realtime channel
   */
  private cleanupFJWagerChannel(): void {
    if (this.fjWagerChannel) {
      console.log('[JeopardyGame] Cleaning up FJ wager channel');
      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();
      this.fjWagerChannel.unsubscribe();
      if (client) client.removeChannel(this.fjWagerChannel);
      this.fjWagerChannel = null;
    }
  }

  /**
   * Subscribe to Final Jeopardy wager submissions
   */
  private subscribeToFJWagers(): void {
    this.cleanupFJWagerChannel();

    const rendererClient = RendererSupabaseClient.getInstance();
    const client = rendererClient.getClient();

    if (!client) {
      console.error('[JeopardyGame] No Supabase client available for FJ wager subscription');
      return;
    }

    console.log(`[JeopardyGame] Setting up FJ wager subscription for game: ${this.state.session.id}`);

    const channelName = `fj-wagers:${this.state.session.id}`;
    this.fjWagerChannel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'final_jeopardy_wagers',
          filter: `game_session_id=eq.${this.state.session.id}`,
        },
        async (payload) => {
          const data = payload.new as any;
          if (data) {
            console.log('[JeopardyGame] FJ wager received:', data.user_id, data.wager_amount);

            // Update wagers map
            const newWagers = new Map(this.state.fjWagers);
            newWagers.set(data.user_id, data.wager_amount);
            this.updateState({ fjWagers: newWagers });

            // Check if all wagers are in
            await this.checkAllFJWagersSubmitted();
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[JeopardyGame] FJ wager subscription status: ${status}`);
        if (err) {
          console.error('[JeopardyGame] FJ wager subscription error:', err);
        }
      });
  }

  /**
   * Check if all players have submitted FJ wagers
   */
  private async checkAllFJWagersSubmitted(): Promise<void> {
    const result = await (window as any).scribeCat.games.jeopardy.allFJWagersSubmitted(this.state.session.id);
    console.log('[JeopardyGame] All FJ wagers submitted check:', result);

    if (result.success && result.allSubmitted) {
      console.log('[JeopardyGame] All FJ wagers submitted! Starting question phase...');
      this.startFJQuestionPhase();
    }
  }

  /**
   * Start Final Jeopardy question phase with timer
   */
  private startFJQuestionPhase(): void {
    console.log('[JeopardyGame] Starting FJ question phase');
    this.updateState({
      fjPhase: 'question',
      fjTimer: 30, // 30 seconds to answer
      fjMyAnswerSubmitted: false,
    });

    // Start countdown timer
    this.fjTimerInterval = setInterval(() => {
      const currentTimer = this.state.fjTimer;
      if (currentTimer !== null && currentTimer > 0) {
        this.updateState({ fjTimer: currentTimer - 1 });
      } else {
        // Time's up!
        this.handleFJTimerExpired();
      }
    }, 1000);
  }

  /**
   * Handle FJ timer expiration
   */
  private async handleFJTimerExpired(): Promise<void> {
    if (this.fjTimerInterval) {
      clearInterval(this.fjTimerInterval);
      this.fjTimerInterval = null;
    }

    console.log('[JeopardyGame] FJ timer expired!');

    // If player hasn't answered, auto-submit empty answer
    if (!this.state.fjMyAnswerSubmitted) {
      console.log('[JeopardyGame] Player did not answer in time');
      await this.submitFJAnswer(''); // Empty answer = wrong
    }

    // Show results after a brief delay
    setTimeout(() => {
      this.showFJResults();
    }, 1000);
  }

  /**
   * Show Final Jeopardy results
   */
  private async showFJResults(): Promise<void> {
    console.log('[JeopardyGame] Showing FJ results');

    // Fetch all scores for this question to show answers
    const question = this.state.currentQuestion;
    if (!question) {
      console.error('[JeopardyGame] No current question for FJ results');
      this.updateState({ fjPhase: 'results' });
      return;
    }

    // Get leaderboard to show final scores
    const leaderboardResult = await (window as any).scribeCat.games.getGameLeaderboard(this.state.session.id);
    if (leaderboardResult.success) {
      this.updateState({ leaderboard: leaderboardResult.leaderboard || [] });
    }

    this.updateState({ fjPhase: 'results' });
  }

  /**
   * Load the Jeopardy board from the backend
   */
  private async loadBoard(): Promise<void> {
    console.log('[JeopardyGame] loadBoard() - Fetching board for game:', this.state.session.id);
    const result = await (window as any).scribeCat.games.jeopardy.getBoard(this.state.session.id);
    console.log('[JeopardyGame] loadBoard() - Result:', result);
    if (result.success && result.board) {
      console.log('[JeopardyGame] loadBoard() - Updating state with', result.board.length, 'questions');
      this.updateState({ board: result.board });
    } else {
      console.error('[JeopardyGame] loadBoard() - Failed to load board or board is empty');
    }
  }

  /**
   * Subscribe to buzzer presses for the current question
   * Uses direct Supabase Realtime in renderer (WebSockets don't work in main process)
   */
  private subscribeToBuzzers(questionId: string): void {
    // Cleanup any existing buzzer subscription first
    this.cleanupBuzzerChannel();

    const rendererClient = RendererSupabaseClient.getInstance();
    const client = rendererClient.getClient();

    if (!client) {
      console.error('[JeopardyGame] No Supabase client available for buzzer subscription');
      return;
    }

    console.log(`[JeopardyGame] Setting up direct buzzer subscription for question: ${questionId}`);

    const channelName = `buzzer-presses:${questionId}`;
    this.buzzerChannel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'buzzer_presses',
          filter: `question_id=eq.${questionId}`,
        },
        (payload) => {
          const newRecord = payload.new as any;
          const buzzer = {
            userId: newRecord.user_id,
            buzzerRank: newRecord.buzzer_rank,
            pressedAt: new Date(newRecord.pressed_at),
          };

          console.log('[JeopardyGame] Buzzer press received via Realtime:', buzzer);

          // Add to buzzers list
          const buzzers = [...this.state.buzzers, buzzer];

          // Update first buzzer if this is rank 1
          const firstBuzzerId = buzzer.buzzerRank === 1 ? buzzer.userId : this.state.firstBuzzerId;

          // Check if current user buzzed
          const currentUser = this.state.participants.find(p => p.isCurrentUser);
          const myBuzzerRank = buzzer.userId === currentUser?.userId ? buzzer.buzzerRank : this.state.myBuzzerRank;

          this.updateState({
            buzzers,
            firstBuzzerId,
            myBuzzerRank,
            buzzerEnabled: false, // Disable buzzer after first press
          });
        }
      )
      .subscribe((status, err) => {
        console.log(`[JeopardyGame] Buzzer subscription status: ${status}`);
        if (err) {
          console.error('[JeopardyGame] Buzzer subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log(`[JeopardyGame] Buzzer subscription active for question: ${questionId}`);
        }
      });
  }

  /**
   * Update game state - handle Jeopardy-specific transitions
   */
  public updateState(updates: Partial<JeopardyGameState>): void {
    const previousQuestionId = this.state.currentQuestion?.id;
    const questionChanged = updates.currentQuestion && updates.currentQuestion.id !== previousQuestionId;

    // If question changed, include reset state in updates BEFORE super.updateState
    // This ensures render() sees the correct buzzer state
    if (questionChanged) {
      const resetState: Partial<JeopardyGameState> = {
        buzzerEnabled: true,
        buzzers: [],
        firstBuzzerId: null,
        myBuzzerRank: null,
        hasAnswered: false,
        showingAnswerFeedback: false,
        lastAnswerCorrect: null,
        lastAnswerUserId: null,
        playersWhoAnsweredWrong: new Set<string>(),
      };

      // Check for Daily Double before render
      if (updates.currentQuestion!.isDailyDouble) {
        const currentUser = this.state.participants.find(p => p.isCurrentUser);
        // Use updates.currentPlayerId if available, otherwise fall back to existing state
        const currentPlayerId = updates.currentPlayerId ?? this.state.currentPlayerId;
        const isMyTurn = currentPlayerId === currentUser?.userId;

        if (isMyTurn) {
          resetState.showingDailyDoubleWager = true;
        }
      }

      // Merge reset state with updates
      updates = { ...resetState, ...updates };
    }

    super.updateState(updates as Partial<GameState>);

    // Subscribe to new question's buzzers after state update
    if (questionChanged) {
      this.subscribeToBuzzers(updates.currentQuestion!.id);
    }

    // If returning to board (question cleared), reload board to show updated question statuses
    if ('currentQuestion' in updates && updates.currentQuestion === null && previousQuestionId) {
      console.log('[JeopardyGame] Returning to board after question, reloading board to show answered questions');
      // Add small delay to allow database to update isSelected field
      setTimeout(() => {
        this.loadBoard();
      }, 500);
    }

    // If round changed to Final Jeopardy, start the FJ flow
    if (updates.round === 'final_jeopardy' && this.state.round !== 'final_jeopardy') {
      // Use setTimeout to ensure state update completes first
      setTimeout(() => {
        this.startFinalJeopardy();
      }, 100);
    }
  }

  /**
   * Main render function - routes to appropriate view
   */
  protected render(): void {
    const { gameStarted, gameEnded, showingDailyDoubleWager, showingFinalJeopardyWager, showingAnswerFeedback, currentQuestion } = this.state;

    console.log('[JeopardyGame] render() called with state:', {
      gameStarted,
      gameEnded,
      showingDailyDoubleWager,
      showingFinalJeopardyWager,
      showingAnswerFeedback,
      hasCurrentQuestion: !!currentQuestion,
      currentQuestionId: currentQuestion?.id,
      hasBoardData: !!this.state.board,
      boardLength: this.state.board?.length,
    });

    if (gameEnded) {
      console.log('[JeopardyGame] Rendering game complete screen');
      this.container.innerHTML = this.renderGameComplete();
      this.attachCompleteListeners();
      return;
    }

    if (!gameStarted) {
      console.log('[JeopardyGame] Rendering waiting screen');
      this.container.innerHTML = this.renderWaitingScreen();
      this.attachWaitingListeners();
      return;
    }

    // Answer feedback screen (shows correct/incorrect for a moment)
    // Use feedbackQuestion instead of currentQuestion since DB clears currentQuestion on correct answer
    if (showingAnswerFeedback && this.state.feedbackQuestion) {
      console.log('[JeopardyGame] Rendering answer feedback screen');
      this.container.innerHTML = this.renderAnswerFeedback();
      this.attachAnswerFeedbackListeners();
      return;
    }

    // Final Jeopardy phases
    if (this.state.round === 'final_jeopardy' && this.state.fjPhase) {
      if (this.state.fjPhase === 'wager') {
        console.log('[JeopardyGame] Rendering FJ wager screen');
        this.container.innerHTML = this.renderFJWagerScreen();
        this.attachFJWagerListeners();
        return;
      }
      if (this.state.fjPhase === 'question') {
        console.log('[JeopardyGame] Rendering FJ question screen');
        this.container.innerHTML = this.renderFJQuestionScreen();
        this.attachFJQuestionListeners();
        return;
      }
      if (this.state.fjPhase === 'results') {
        console.log('[JeopardyGame] Rendering FJ results screen');
        this.container.innerHTML = this.renderFJResultsScreen();
        this.attachFJResultsListeners();
        return;
      }
    }

    // Legacy Final Jeopardy wager screen (kept for backwards compatibility)
    if (showingFinalJeopardyWager) {
      console.log('[JeopardyGame] Rendering Final Jeopardy wager screen (legacy)');
      this.container.innerHTML = this.renderFinalJeopardyWager();
      this.attachFinalWagerListeners();
      return;
    }

    // Daily Double wager screen
    if (showingDailyDoubleWager) {
      console.log('[JeopardyGame] Rendering Daily Double wager screen');
      this.container.innerHTML = this.renderDailyDoubleWager();
      this.attachDailyDoubleWagerListeners();
      return;
    }

    // Question being displayed
    if (currentQuestion) {
      console.log('[JeopardyGame] Rendering question view for question:', currentQuestion.id);
      this.container.innerHTML = this.renderQuestionView();
      this.attachQuestionListeners();
      return;
    }

    // Default: Show Jeopardy board for question selection
    console.log('[JeopardyGame] Rendering board view (no current question)');
    this.container.innerHTML = this.renderBoardView();
    this.attachBoardListeners();
  }

  /**
   * Render Jeopardy board grid for question selection
   */
  private renderBoardView(): string {
    const { board, currentPlayerId, participants } = this.state;

    if (!board || board.length === 0) {
      return '<div class="game-loading">Loading Jeopardy board...</div>';
    }

    // Group questions by category
    const categories: Record<string, typeof board> = {};
    for (const question of board) {
      if (!categories[question.category]) {
        categories[question.category] = [];
      }
      categories[question.category].push(question);
    }

    // Sort questions within each category by points
    for (const category in categories) {
      categories[category].sort((a, b) => a.points - b.points);
    }

    // Ensure exactly 6 categories for standard Jeopardy board
    const REQUIRED_CATEGORIES = 6;
    let categoryNames = Object.keys(categories);

    // If fewer than 6 categories, pad with empty placeholders
    while (categoryNames.length < REQUIRED_CATEGORIES) {
      const emptyCategory = `Category ${categoryNames.length + 1}`;
      categories[emptyCategory] = [];
      categoryNames.push(emptyCategory);
    }

    // If more than 6, take only first 6
    categoryNames = categoryNames.slice(0, REQUIRED_CATEGORIES);
    const currentPlayer = participants.find(p => p.userId === currentPlayerId);
    const isMyTurn = currentPlayer?.isCurrentUser ?? false;

    return `
      <div class="jeopardy-game">
        ${this.renderHeader()}

        <div class="jeopardy-board-container">
          <div class="jeopardy-turn-indicator">
            ${isMyTurn
              ? '<span class="your-turn">Your turn! Select a question.</span>'
              : `<span class="waiting-turn">Waiting for ${this.escapeHtml(currentPlayer?.userFullName || currentPlayer?.userEmail || 'player')} to select...</span>`
            }
          </div>

          <div class="jeopardy-board">
            <!-- Category headers -->
            <div class="jeopardy-categories">
              ${categoryNames.map(cat => `
                <div class="jeopardy-category-header">
                  ${this.escapeHtml(cat)}
                </div>
              `).join('')}
            </div>

            <!-- Question grid -->
            <div class="jeopardy-grid">
              ${this.renderQuestionGrid(categories, categoryNames, isMyTurn)}
            </div>
          </div>
        </div>

        ${this.renderLeaderboard()}
      </div>
    `;
  }

  /**
   * Render question grid
   */
  private renderQuestionGrid(categories: Record<string, any[]>, categoryNames: string[], isMyTurn: boolean): string {
    const QUESTIONS_PER_CATEGORY = 5; // Standard Jeopardy has 5 rows

    let gridHtml = '';

    for (let row = 0; row < QUESTIONS_PER_CATEGORY; row++) {
      for (const category of categoryNames) {
        const question = categories[category][row];

        if (question) {
          const isAnswered = question.isSelected;
          const canSelect = isMyTurn && !isAnswered;

          gridHtml += `
            <button
              class="jeopardy-question-cell ${isAnswered ? 'answered' : ''} ${canSelect ? 'selectable' : ''}"
              data-question-id="${question.questionId}"
              ${canSelect ? '' : 'disabled'}
            >
              ${isAnswered ? '' : `$${question.points}`}
            </button>
          `;
        } else {
          gridHtml += '<div class="jeopardy-question-cell empty"></div>';
        }
      }
    }

    return gridHtml;
  }

  /**
   * Render Daily Double wager screen
   */
  private renderDailyDoubleWager(): string {
    const { currentQuestion, participants } = this.state;
    if (!currentQuestion) return '';

    const currentUser = participants.find(p => p.isCurrentUser);
    const myScore = this.getPlayerScore(currentUser?.userId || '');
    // In Jeopardy, max Daily Double wager is either your score OR the highest clue value (1000), whichever is greater
    // Minimum wager is $5
    const maxBoardValue = 1000;
    const maxWager = Math.max(myScore, maxBoardValue, 5);

    return `
      <div class="jeopardy-game">
        ${this.renderHeader()}

        <div class="daily-double-screen">
          <div class="daily-double-reveal">
            <h2 class="daily-double-title">DAILY DOUBLE!</h2>
            <p class="daily-double-category">Category: ${this.escapeHtml(currentQuestion.category || 'Unknown')}</p>

            <div class="daily-double-wager-form">
              <label for="wager-input">Enter your wager:</label>
              <p class="wager-rules">You can wager up to $${maxWager}</p>
              <input
                type="number"
                id="wager-input"
                min="5"
                max="${maxWager}"
                value="${currentQuestion.points}"
                step="100"
              />
              <button class="btn-primary" id="submit-wager-btn">Submit Wager</button>
            </div>
          </div>
        </div>

        ${this.renderLeaderboard()}
      </div>
    `;
  }

  /**
   * Render Final Jeopardy wager screen
   */
  private renderFinalJeopardyWager(): string {
    const { currentQuestion, participants } = this.state;
    if (!currentQuestion) {
      console.warn('[JeopardyGame] Final Jeopardy wager but no question - completing game');
      // No Final Jeopardy question exists, complete the game
      setTimeout(async () => {
        await (window as any).scribeCat.games.completeGame(this.state.session.id);
      }, 100);
      return `
        <div class="jeopardy-game">
          ${this.renderHeader()}
          <div class="game-loading">No Final Jeopardy question found. Completing game...</div>
        </div>
      `;
    }

    const currentUser = participants.find(p => p.isCurrentUser);
    const myScore = this.getPlayerScore(currentUser?.userId || '');
    const maxWager = Math.max(myScore, 0); // Can wager up to current score (even if negative)

    return `
      <div class="jeopardy-game">
        ${this.renderHeader()}

        <div class="final-jeopardy-screen">
          <div class="final-jeopardy-wager">
            <h2 class="final-jeopardy-title">FINAL JEOPARDY!</h2>
            <p class="final-jeopardy-category">Category: ${this.escapeHtml(currentQuestion.category || 'Unknown')}</p>

            <div class="final-jeopardy-wager-form">
              <label for="final-wager-input">Enter your wager:</label>
              <p class="wager-rules">Current score: $${myScore}<br/>You can wager up to $${maxWager}</p>
              <input
                type="number"
                id="final-wager-input"
                min="0"
                max="${maxWager}"
                value="0"
                step="100"
              />
              <button class="btn-primary" id="submit-final-wager-btn">Lock In Wager</button>
            </div>
          </div>
        </div>

        ${this.renderLeaderboard()}
      </div>
    `;
  }

  /**
   * Render question view with buzzer
   */
  private renderQuestionView(): string {
    const { currentQuestion, buzzerEnabled, myBuzzerRank, firstBuzzerId, participants, hasAnswered, currentPlayerId } = this.state;
    if (!currentQuestion) return '';

    const currentUser = participants.find(p => p.isCurrentUser);
    const isSelectingPlayer = currentPlayerId === currentUser?.userId;
    const isFirstBuzzer = firstBuzzerId === currentUser?.userId;
    const canAnswer = isFirstBuzzer && !hasAnswered;

    // For Daily Doubles: only the selecting player can answer
    const isDailyDouble = currentQuestion.isDailyDouble;
    const canAnswerDailyDouble = isDailyDouble && isSelectingPlayer && !hasAnswered;

    console.log('[JeopardyGame] renderQuestionView - buzzer state:', {
      myBuzzerRank,
      firstBuzzerId,
      currentUserId: currentUser?.userId,
      isFirstBuzzer,
      hasAnswered,
      canAnswer,
      buzzerEnabled,
      isDailyDouble,
      isSelectingPlayer,
      canAnswerDailyDouble,
    });

    return `
      <div class="jeopardy-game">
        ${this.renderHeader()}
        ${this.renderProgress()}

        <div class="jeopardy-question-view">
          ${currentQuestion.category ? `<div class="jeopardy-category">${this.escapeHtml(currentQuestion.category)}</div>` : ''}

          <div class="jeopardy-clue-display">
            <div class="jeopardy-value">$${currentQuestion.points}</div>
            <div class="jeopardy-clue">${this.escapeHtml(currentQuestion.getQuestionText())}</div>
          </div>

          ${this.renderBuzzerSection(buzzerEnabled, myBuzzerRank, isFirstBuzzer, canAnswer, currentQuestion, isDailyDouble, canAnswerDailyDouble, isSelectingPlayer)}
        </div>

        ${this.renderLeaderboard()}
      </div>
    `;
  }

  /**
   * Render answer feedback screen (correct/incorrect reveal)
   */
  private renderAnswerFeedback(): string {
    const { feedbackQuestion, lastAnswerCorrect, lastAnswerUserId, participants } = this.state;
    if (!feedbackQuestion) return '';

    const answerer = participants.find(p => p.userId === lastAnswerUserId);
    const answererName = answerer?.userFullName || answerer?.userEmail || 'Player';
    const correctAnswer = feedbackQuestion.correctAnswer;

    return `
      <div class="jeopardy-game">
        ${this.renderHeader()}

        <div class="jeopardy-feedback-screen">
          ${feedbackQuestion.category ? `<div class="jeopardy-category">${this.escapeHtml(feedbackQuestion.category)}</div>` : ''}

          <div class="jeopardy-clue-display">
            <div class="jeopardy-value">$${feedbackQuestion.points}</div>
            <div class="jeopardy-clue">${this.escapeHtml(feedbackQuestion.getQuestionText())}</div>
          </div>

          <div class="jeopardy-answer-feedback ${lastAnswerCorrect ? 'correct' : 'incorrect'}">
            <div class="feedback-icon">${lastAnswerCorrect ? '✓' : '✗'}</div>
            <div class="feedback-text">
              ${lastAnswerCorrect
                ? `<strong>${this.escapeHtml(answererName)}</strong> got it right!`
                : `<strong>${this.escapeHtml(answererName)}</strong> got it wrong.`
              }
            </div>
            ${lastAnswerCorrect ? `
              <div class="correct-answer">
                <p>The answer is: <strong>${this.escapeHtml(correctAnswer)}</strong></p>
              </div>
            ` : feedbackQuestion.isDailyDouble ? `
              <div class="correct-answer">
                <p>The answer was: <strong>${this.escapeHtml(correctAnswer)}</strong></p>
              </div>
            ` : `
              <div class="rebuzz-message">
                Other players can now buzz in to answer...
              </div>
            `}
          </div>
        </div>

        ${this.renderLeaderboard()}
      </div>
    `;
  }

  /**
   * Render buzzer section based on state
   */
  private renderBuzzerSection(
    buzzerEnabled: boolean,
    myBuzzerRank: number | null,
    isFirstBuzzer: boolean,
    canAnswer: boolean,
    question: GameQuestion,
    isDailyDouble: boolean,
    canAnswerDailyDouble: boolean,
    isSelectingPlayer: boolean
  ): string {
    const options = question.getOptions();

    // DAILY DOUBLE LOGIC
    if (isDailyDouble) {
      // Selecting player can answer
      if (canAnswerDailyDouble) {
        return `
          <div class="jeopardy-answer-section">
            <p class="buzzer-status your-turn-buzz">Daily Double! Select your answer:</p>
            <div class="jeopardy-options">
              ${options.map((option, index) => `
                <button class="jeopardy-option" data-index="${index}">
                  ${this.escapeHtml(option)}
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      // Selecting player has answered
      if (isSelectingPlayer && this.state.hasAnswered) {
        return `
          <div class="buzzer-status buzzer-locked">
            Answer submitted! Waiting for result...
          </div>
        `;
      }

      // Other players wait
      const selectingParticipant = this.state.participants.find(p => p.userId === this.state.currentPlayerId);
      const selectingPlayerName = selectingParticipant?.userFullName || selectingParticipant?.userEmail || 'the player';
      return `
        <div class="buzzer-status buzzer-locked">
          Daily Double! Waiting for ${this.escapeHtml(selectingPlayerName)} to answer...
        </div>
      `;
    }

    // REGULAR QUESTION LOGIC
    // Check if firstBuzzerId has already answered wrong (rebuzz scenario)
    const firstBuzzerAnsweredWrong = this.state.firstBuzzerId && this.state.playersWhoAnsweredWrong.has(this.state.firstBuzzerId);

    // If firstBuzzer already answered wrong, treat rank=1 as effective first buzzer
    const isEffectiveFirstBuzzer = isFirstBuzzer || (myBuzzerRank === 1 && firstBuzzerAnsweredWrong);
    const canAnswerRebuzz = isEffectiveFirstBuzzer && !this.state.hasAnswered;

    // If current user can answer (first buzzer or effective first buzzer after rebuzz)
    if (canAnswer || canAnswerRebuzz) {
      return `
        <div class="jeopardy-answer-section">
          <p class="buzzer-status your-turn-buzz">You buzzed in first! Select your answer:</p>
          <div class="jeopardy-options">
            ${options.map((option, index) => `
              <button class="jeopardy-option" data-index="${index}">
                ${this.escapeHtml(option)}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    // If current user has answered, show waiting message
    if (myBuzzerRank !== null && !canAnswer && !canAnswerRebuzz) {
      // If firstBuzzer already answered wrong, don't show "they're answering"
      if (firstBuzzerAnsweredWrong) {
        // In rebuzz, we're waiting for someone to buzz
        return `
          <div class="buzzer-status">
            You buzzed in ${this.ordinal(myBuzzerRank)}. Waiting for first buzzer to answer...
          </div>
        `;
      }

      return `
        <div class="buzzer-status buzzer-locked">
          ${isFirstBuzzer
            ? 'Answer submitted! Waiting for result...'
            : `You buzzed in ${this.ordinal(myBuzzerRank)}. ${(() => {
                const firstPlayer = this.state.participants.find(p => p.userId === this.state.firstBuzzerId);
                return firstPlayer?.userFullName || firstPlayer?.userEmail || 'Another player';
              })()} is answering...`
          }
        </div>
      `;
    }

    // Check if current user already answered wrong (can't buzz again)
    const currentUser = this.state.participants.find(p => p.isCurrentUser);
    const alreadyAnsweredWrong = currentUser && this.state.playersWhoAnsweredWrong.has(currentUser.userId);
    const hasWrongAnswers = this.state.playersWhoAnsweredWrong.size > 0;

    // If user already got it wrong, show skip button
    if (alreadyAnsweredWrong) {
      return `
        <div class="jeopardy-buzzer-section">
          <div class="buzzer-status buzzer-locked">
            You already answered this question.
          </div>
          <button class="jeopardy-skip-btn" id="skip-question-btn">
            Skip Question (No Points)
          </button>
        </div>
      `;
    }

    // Otherwise, show buzzer button with optional skip
    return `
      <div class="jeopardy-buzzer-section">
        <button
          class="jeopardy-buzzer-btn ${!buzzerEnabled ? 'disabled' : ''}"
          id="buzz-btn"
          ${!buzzerEnabled ? 'disabled' : ''}
        >
          <span class="buzzer-icon">🔔</span>
          <span class="buzzer-text">${buzzerEnabled ? 'BUZZ IN!' : 'Buzzer Locked'}</span>
        </button>
        ${myBuzzerRank ? `<p class="buzzer-rank">You buzzed in ${this.ordinal(myBuzzerRank)}</p>` : ''}
        ${hasWrongAnswers ? `
          <button class="jeopardy-skip-btn secondary" id="skip-question-btn">
            I Don't Know
          </button>
        ` : ''}
      </div>
    `;
  }

  /**
   * Get player's current score from leaderboard
   */
  private getPlayerScore(userId: string): number {
    const entry = this.state.leaderboard.find(e => e.userId === userId);
    return entry?.totalScore || 0;
  }

  /**
   * Convert number to ordinal (1st, 2nd, 3rd, etc.)
   */
  private ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /**
   * Handle question selection from board
   */
  private async handleQuestionSelect(questionId: string): Promise<void> {
    console.log('[JeopardyGame] handleQuestionSelect() called with questionId:', questionId);
    const currentUser = this.state.participants.find(p => p.isCurrentUser);
    if (!currentUser) {
      console.error('[JeopardyGame] Cannot select question - no current user found');
      return;
    }

    console.log('[JeopardyGame] Calling selectQuestion API...');
    const result = await (window as any).scribeCat.games.jeopardy.selectQuestion({
      gameSessionId: this.state.session.id,
      questionId,
      userId: currentUser.userId,
    });

    console.log('[JeopardyGame] selectQuestion API result:', result);
    if (result.success) {
      console.log('[JeopardyGame] Question selected successfully:', questionId);
      // State will be updated via real-time subscription
    } else {
      console.error('[JeopardyGame] Failed to select question:', result.error);
    }
  }

  /**
   * Handle buzzer press
   */
  private async handleBuzzerPress(): Promise<void> {
    console.log('[JeopardyGame] handleBuzzerPress() called - buzzerEnabled:', this.state.buzzerEnabled, 'hasQuestion:', !!this.state.currentQuestion);

    if (!this.state.buzzerEnabled || !this.state.currentQuestion) {
      console.log('[JeopardyGame] Buzzer press ignored - buzzer not enabled or no question');
      return;
    }

    const currentUser = this.state.participants.find(p => p.isCurrentUser);
    if (!currentUser) {
      console.error('[JeopardyGame] Cannot buzz - no current user found');
      return;
    }

    console.log('[JeopardyGame] Calling buzzIn API...');
    const result = await (window as any).scribeCat.games.jeopardy.buzzIn({
      gameSessionId: this.state.session.id,
      questionId: this.state.currentQuestion.id,
      userId: currentUser.userId,
    });

    console.log('[JeopardyGame] buzzIn API result:', result);
    if (result.success) {
      console.log('[JeopardyGame] Buzzed in successfully! Rank:', result.buzzerRank);

      // If this is the first buzzer, set firstBuzzerId immediately
      // (subscription will also set it, but we need it now for rendering answer options)
      const updates: any = {
        myBuzzerRank: result.buzzerRank,
        buzzerEnabled: false,
      };

      if (result.buzzerRank === 1) {
        console.log('[JeopardyGame] First buzzer! Setting firstBuzzerId to current user');
        updates.firstBuzzerId = currentUser.userId;
      }

      this.updateState(updates);
    } else {
      console.error('[JeopardyGame] Failed to buzz in:', result.error);
    }
  }

  /**
   * Handle answer submission
   */
  protected async handleAnswer(answer: string): Promise<void> {
    if (this.state.hasAnswered || !this.state.currentQuestion) return;

    const currentUser = this.state.participants.find(p => p.isCurrentUser);
    if (!currentUser || !this.state.myBuzzerRank) return;

    const question = this.state.currentQuestion;
    const isCorrect = question.isCorrectAnswer(answer);

    const result = await (window as any).scribeCat.games.jeopardy.submitAnswer({
      gameSessionId: this.state.session.id,
      questionId: question.id,
      userId: currentUser.userId,
      answer,
      isCorrect,
      buzzerRank: this.state.myBuzzerRank,
      wagerAmount: this.state.wagerAmount || undefined,
    });

    if (result.success) {
      console.log('[JeopardyGame] Answer submitted. Points:', result.pointsEarned, 'Correct:', isCorrect);
      this.updateState({ hasAnswered: true });

      // Refresh leaderboard to show updated scores
      const leaderboardResult = await (window as any).scribeCat.games.getGameLeaderboard(this.state.session.id);
      if (leaderboardResult.success) {
        console.log('[JeopardyGame] Leaderboard refreshed after answer:', leaderboardResult.leaderboard);
        this.updateState({
          leaderboard: leaderboardResult.leaderboard || [],
        });
      }

      // Show answer feedback - store question for display (survives currentQuestion becoming null)
      this.updateState({
        showingAnswerFeedback: true,
        lastAnswerCorrect: isCorrect,
        lastAnswerUserId: currentUser.userId,
        feedbackQuestion: question, // Store for feedback display
      });

      if (isCorrect) {
        // Correct answer: set as current player, then return to board after delay
        await this.setAsCurrentPlayer();

        // Wait for feedback display, then check for Final Jeopardy
        // (The database clears selected_question_id on correct answer)
        setTimeout(async () => {
          this.updateState({ showingAnswerFeedback: false, feedbackQuestion: null });
          // Check if board is complete and should advance to Final Jeopardy
          await this.checkForFinalJeopardy();
        }, 2500);
      } else {
        // Wrong answer handling
        const isDailyDouble = question.isDailyDouble;

        if (isDailyDouble) {
          // Daily Double wrong: no rebuzz allowed, skip question and return to board
          // The selecting player keeps control (they found the Daily Double)
          console.log('[JeopardyGame] Daily Double answered wrong - skipping question, returning to board');

          // After showing feedback, skip the question
          setTimeout(async () => {
            this.updateState({
              showingAnswerFeedback: false,
              feedbackQuestion: null,
              wagerAmount: null, // Clear the wager
            });
            // Skip the question to return to board
            await this.handleSkipQuestion();
          }, 2500);
        } else {
          // Regular question wrong: track who got it wrong, re-enable buzzer for others
          const newWrongAnswers = new Set(this.state.playersWhoAnsweredWrong);
          newWrongAnswers.add(currentUser.userId);

          this.updateState({
            playersWhoAnsweredWrong: newWrongAnswers,
          });

          // Clear buzzer presses in database so next buzzer gets rank=1
          try {
            await (window as any).scribeCat.games.jeopardy.clearBuzzers(question.id);
            console.log('[JeopardyGame] Buzzer presses cleared for rebuzz');
          } catch (error) {
            console.error('[JeopardyGame] Failed to clear buzzer presses:', error);
          }

          // After showing feedback, re-enable buzzer for others
          setTimeout(() => {
            this.updateState({
              showingAnswerFeedback: false,
              feedbackQuestion: null,
              buzzerEnabled: true,
              buzzers: [], // Clear local buzzer state too
              firstBuzzerId: null,
              myBuzzerRank: null,
              hasAnswered: false,
            });
          }, 2500);
        }
      }
    }
  }

  /**
   * Handle skip question (when no one else wants to answer)
   */
  private async handleSkipQuestion(): Promise<void> {
    if (!this.state.currentQuestion) return;

    console.log('[JeopardyGame] Skipping question - no more answers');

    const result = await (window as any).scribeCat.games.jeopardy.skipQuestion({
      gameSessionId: this.state.session.id,
      questionId: this.state.currentQuestion.id,
    });

    if (result.success) {
      console.log('[JeopardyGame] Question skipped, returning to board');
      // Check if board is complete and should advance to Final Jeopardy
      // Small delay to allow state to update
      setTimeout(async () => {
        await this.checkForFinalJeopardy();
      }, 500);
    } else {
      console.error('[JeopardyGame] Failed to skip question:', result.error);
    }
  }

  /**
   * Check if the board is complete and advance to Final Jeopardy if so
   */
  private async checkForFinalJeopardy(): Promise<void> {
    // Only check if we're not already in Final Jeopardy
    if (this.state.round === 'final_jeopardy') {
      console.log('[JeopardyGame] Already in Final Jeopardy, skipping check');
      return;
    }

    try {
      const result = await (window as any).scribeCat.games.jeopardy.isBoardComplete(this.state.session.id);
      console.log('[JeopardyGame] Board complete check:', result);

      if (result.success && result.isComplete) {
        console.log('[JeopardyGame] Board is complete! Advancing to Final Jeopardy...');
        const advanceResult = await (window as any).scribeCat.games.jeopardy.advanceToFinal(this.state.session.id);
        console.log('[JeopardyGame] Advance to Final result:', advanceResult);
        // State will be updated via realtime subscription
      } else {
        console.log('[JeopardyGame] Board not complete yet');
      }
    } catch (error) {
      console.error('[JeopardyGame] Error checking for Final Jeopardy:', error);
    }
  }

  /**
   * Set current user as the current player
   */
  private async setAsCurrentPlayer(): Promise<void> {
    const currentUser = this.state.participants.find(p => p.isCurrentUser);
    if (!currentUser) return;

    await (window as any).scribeCat.games.jeopardy.setCurrentPlayer({
      gameSessionId: this.state.session.id,
      userId: currentUser.userId,
    });
  }

  /**
   * Handle Daily Double wager submission
   */
  private async handleDailyDoubleWager(wager: number): Promise<void> {
    const currentUser = this.state.participants.find(p => p.isCurrentUser);
    this.updateState({
      wagerAmount: wager,
      showingDailyDoubleWager: false,
      buzzerEnabled: false, // No buzzer for Daily Double - only current player answers
      firstBuzzerId: currentUser?.userId || null, // Set current player as answerer
      myBuzzerRank: 1, // Set as rank 1 to allow answer submission
    });
    this.render();
  }

  /**
   * Handle Final Jeopardy wager submission
   */
  private async handleFinalJeopardyWager(wager: number): Promise<void> {
    const currentUser = this.state.participants.find(p => p.isCurrentUser);
    if (!currentUser) return;

    console.log(`[JeopardyGame] Submitting FJ wager: $${wager}`);

    // Submit wager to database
    const result = await (window as any).scribeCat.games.jeopardy.submitFJWager({
      gameSessionId: this.state.session.id,
      userId: currentUser.userId,
      wagerAmount: wager,
    });

    if (result.success) {
      // Update local state
      const newWagers = new Map(this.state.fjWagers);
      newWagers.set(currentUser.userId, wager);

      this.updateState({
        wagerAmount: wager,
        fjMyWagerSubmitted: true,
        fjWagers: newWagers,
      });

      // Check if all wagers are in (might transition to question phase)
      await this.checkAllFJWagersSubmitted();
    } else {
      console.error('[JeopardyGame] Failed to submit FJ wager:', result.error);
    }
  }

  /**
   * Submit Final Jeopardy answer
   */
  private async submitFJAnswer(answer: string): Promise<void> {
    const currentUser = this.state.participants.find(p => p.isCurrentUser);
    const question = this.state.currentQuestion;
    if (!currentUser || !question) return;

    if (this.state.fjMyAnswerSubmitted) {
      console.log('[JeopardyGame] FJ answer already submitted');
      return;
    }

    console.log(`[JeopardyGame] Submitting FJ answer: ${answer}`);

    const isCorrect = question.isCorrectAnswer(answer);
    const wagerAmount = this.state.wagerAmount || 0;

    // Submit answer using the regular Jeopardy answer submission
    const result = await (window as any).scribeCat.games.jeopardy.submitAnswer({
      gameSessionId: this.state.session.id,
      questionId: question.id,
      userId: currentUser.userId,
      answer,
      isCorrect,
      buzzerRank: 1, // Everyone gets rank 1 in FJ
      wagerAmount,
    });

    if (result.success) {
      console.log('[JeopardyGame] FJ answer submitted. Points:', result.pointsEarned);
      this.updateState({ fjMyAnswerSubmitted: true });

      // Check if all answers are in
      await this.checkAllFJAnswersSubmitted();
    } else {
      console.error('[JeopardyGame] Failed to submit FJ answer:', result.error);
    }
  }

  /**
   * Check if all players have submitted FJ answers
   */
  private async checkAllFJAnswersSubmitted(): Promise<void> {
    if (!this.state.currentQuestion) return;

    const result = await (window as any).scribeCat.games.jeopardy.allFJAnswersSubmitted({
      gameSessionId: this.state.session.id,
      questionId: this.state.currentQuestion.id,
    });

    console.log('[JeopardyGame] All FJ answers submitted check:', result);

    if (result.success && result.allSubmitted) {
      console.log('[JeopardyGame] All FJ answers submitted! Showing results...');
      // Stop timer if still running
      if (this.fjTimerInterval) {
        clearInterval(this.fjTimerInterval);
        this.fjTimerInterval = null;
      }
      await this.showFJResults();
    }
  }

  /**
   * Start the Final Jeopardy flow
   */
  private startFinalJeopardy(): void {
    console.log('[JeopardyGame] Starting Final Jeopardy flow');

    // Subscribe to FJ wager updates
    this.subscribeToFJWagers();

    // Set FJ phase to wager
    this.updateState({
      fjPhase: 'wager',
      fjWagers: new Map<string, number>(),
      fjMyWagerSubmitted: false,
      fjMyAnswerSubmitted: false,
      fjTimer: null,
      fjAnswers: new Map(),
    });
  }

  /**
   * Attach event listeners for waiting screen
   */
  private attachWaitingListeners(): void {
    const startBtn = this.container.querySelector('#start-game-btn');
    startBtn?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:start'));
    });

    this.attachExitListeners();
  }

  /**
   * Attach event listeners for game complete screen
   */
  private attachCompleteListeners(): void {
    const closeBtn = this.container.querySelector('#close-game-btn');
    closeBtn?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:close'));
    });
  }

  /**
   * Attach event listeners for exit button
   */
  private attachExitListeners(): void {
    const exitBtn = this.container.querySelector('#exit-game-btn');
    exitBtn?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:exit'));
    });
  }

  /**
   * Attach event listeners for board selection
   */
  private attachBoardListeners(): void {
    const questionCells = this.container.querySelectorAll('.jeopardy-question-cell.selectable');
    questionCells.forEach(cell => {
      cell.addEventListener('click', () => {
        const questionId = cell.getAttribute('data-question-id');
        if (questionId) {
          this.handleQuestionSelect(questionId);
        }
      });
    });

    this.attachExitListeners();
  }

  /**
   * Attach event listeners for question view
   */
  private attachQuestionListeners(): void {
    // Buzzer button
    const buzzerBtn = this.container.querySelector('#buzz-btn');
    if (buzzerBtn) {
      buzzerBtn.addEventListener('click', () => this.handleBuzzerPress());
    }

    // Answer options
    const options = this.container.querySelectorAll('.jeopardy-option');
    options.forEach(option => {
      option.addEventListener('click', () => {
        const index = parseInt(option.getAttribute('data-index') || '0');
        const question = this.state.currentQuestion;
        if (question) {
          const answer = question.getOptions()[index];
          this.handleAnswer(answer);
        }
      });
    });

    // Skip question button (for "I don't know" or when player already answered wrong)
    const skipBtn = this.container.querySelector('#skip-question-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => this.handleSkipQuestion());
    }

    this.attachExitListeners();
  }

  /**
   * Attach event listeners for answer feedback screen
   */
  private attachAnswerFeedbackListeners(): void {
    // No interactive elements on feedback screen - just showing results
    // Exit button still available
    this.attachExitListeners();
  }

  /**
   * Attach event listeners for Daily Double wager
   */
  private attachDailyDoubleWagerListeners(): void {
    const submitBtn = this.container.querySelector('#submit-wager-btn');
    const wagerInput = this.container.querySelector('#wager-input') as HTMLInputElement;

    if (submitBtn && wagerInput) {
      submitBtn.addEventListener('click', () => {
        const wager = parseInt(wagerInput.value);
        const currentUser = this.state.participants.find(p => p.isCurrentUser);
        const myScore = this.getPlayerScore(currentUser?.userId || '');
        // In Jeopardy, max Daily Double wager is either your score OR the highest clue value (1000), whichever is greater
        const maxBoardValue = 1000;
        const maxWager = Math.max(myScore, maxBoardValue, 5);

        if (!isNaN(wager) && wager >= 5 && wager <= maxWager) {
          this.handleDailyDoubleWager(wager);
        } else {
          // Show error - invalid wager amount
          const errorEl = this.container.querySelector('.wager-error');
          if (errorEl) {
            errorEl.textContent = `Please enter a wager between $5 and $${maxWager}`;
          } else {
            const form = this.container.querySelector('.daily-double-wager-form');
            if (form) {
              const error = document.createElement('p');
              error.className = 'wager-error';
              error.style.color = 'var(--danger-color, #e74c3c)';
              error.textContent = `Please enter a wager between $5 and $${maxWager}`;
              form.appendChild(error);
            }
          }
        }
      });
    }

    this.attachExitListeners();
  }

  /**
   * Attach event listeners for Final Jeopardy wager
   */
  private attachFinalWagerListeners(): void {
    const submitBtn = this.container.querySelector('#submit-final-wager-btn');
    const wagerInput = this.container.querySelector('#final-wager-input') as HTMLInputElement;

    if (submitBtn && wagerInput) {
      submitBtn.addEventListener('click', () => {
        const wager = parseInt(wagerInput.value);
        const currentUser = this.state.participants.find(p => p.isCurrentUser);
        const myScore = this.getPlayerScore(currentUser?.userId || '');
        const maxWager = Math.max(myScore, 0);

        if (!isNaN(wager) && wager >= 0 && wager <= maxWager) {
          this.handleFinalJeopardyWager(wager);
        } else {
          // Show error - invalid wager amount
          const errorEl = this.container.querySelector('.wager-error');
          if (errorEl) {
            errorEl.textContent = `Please enter a wager between $0 and $${maxWager}`;
          } else {
            const form = this.container.querySelector('.final-jeopardy-wager-form');
            if (form) {
              const error = document.createElement('p');
              error.className = 'wager-error';
              error.style.color = 'var(--danger-color, #e74c3c)';
              error.textContent = `Please enter a wager between $0 and $${maxWager}`;
              form.appendChild(error);
            }
          }
        }
      });
    }

    this.attachExitListeners();
  }

  /**
   * Render Final Jeopardy wager screen - shows category only, all players wager
   */
  private renderFJWagerScreen(): string {
    const { currentQuestion, participants, fjWagers, fjMyWagerSubmitted } = this.state;

    // Get current user
    const currentUser = participants.find(p => p.isCurrentUser);
    const myScore = this.getPlayerScore(currentUser?.userId || '');
    const maxWager = Math.max(myScore, 0);

    // Count how many players have wagered
    const totalPlayers = participants.length;
    const wageredCount = fjWagers.size;

    // Get category from current question (or use placeholder if loading)
    const category = currentQuestion?.category || 'Loading...';

    return `
      <div class="jeopardy-game">
        ${this.renderHeader()}

        <div class="final-jeopardy-screen fj-wager-phase">
          <div class="fj-category-reveal">
            <h2 class="final-jeopardy-title">FINAL JEOPARDY!</h2>
            <div class="fj-category-box">
              <p class="fj-category-label">Category:</p>
              <h3 class="fj-category-name">${this.escapeHtml(category)}</h3>
            </div>

            ${fjMyWagerSubmitted ? `
              <div class="fj-wager-submitted">
                <div class="fj-check-icon">✓</div>
                <p>Your wager of <strong>$${fjWagers.get(currentUser?.userId || '') || 0}</strong> is locked in!</p>
                <p class="fj-waiting-text">Waiting for other players...</p>
              </div>
            ` : `
              <div class="fj-wager-form">
                <p class="fj-wager-label">Enter your wager:</p>
                <p class="fj-score-info">Your current score: <strong>$${myScore}</strong></p>
                <p class="fj-wager-rules">You can wager between $0 and $${maxWager}</p>
                <input
                  type="number"
                  id="fj-wager-input"
                  class="fj-wager-input"
                  min="0"
                  max="${maxWager}"
                  value="0"
                  step="100"
                />
                <button class="btn-primary fj-wager-submit-btn" id="fj-submit-wager-btn">Lock In Wager</button>
              </div>
            `}

            <div class="fj-wager-status">
              <p class="fj-wager-count">${wageredCount} of ${totalPlayers} players have wagered</p>
              <div class="fj-player-status-list">
                ${participants.map(p => {
                  const hasWagered = fjWagers.has(p.userId);
                  const name = p.userFullName || p.userEmail || 'Player';
                  return `
                    <div class="fj-player-status ${hasWagered ? 'wagered' : 'waiting'}">
                      <span class="fj-status-icon">${hasWagered ? '✓' : '⏳'}</span>
                      <span class="fj-player-name">${this.escapeHtml(name)}${p.isCurrentUser ? ' (you)' : ''}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>

        ${this.renderLeaderboard()}
      </div>
    `;
  }

  /**
   * Render Final Jeopardy question screen - all players answer with timer
   */
  private renderFJQuestionScreen(): string {
    const { currentQuestion, fjTimer, fjMyAnswerSubmitted, participants } = this.state;

    if (!currentQuestion) {
      return `
        <div class="jeopardy-game">
          ${this.renderHeader()}
          <div class="game-loading">Loading Final Jeopardy question...</div>
        </div>
      `;
    }

    const options = currentQuestion.getOptions();
    const timerDisplay = fjTimer !== null ? fjTimer : '--';
    const timerClass = fjTimer !== null && fjTimer <= 10 ? 'timer-warning' : '';

    return `
      <div class="jeopardy-game">
        ${this.renderHeader()}

        <div class="final-jeopardy-screen fj-question-phase">
          <div class="fj-timer ${timerClass}">
            <span class="fj-timer-icon">⏱️</span>
            <span class="fj-timer-value">${timerDisplay}</span>
            <span class="fj-timer-label">seconds</span>
          </div>

          <div class="fj-question-display">
            <div class="fj-category-badge">${this.escapeHtml(currentQuestion.category || 'Final Jeopardy')}</div>
            <div class="fj-question-text">${this.escapeHtml(currentQuestion.getQuestionText())}</div>
          </div>

          ${fjMyAnswerSubmitted ? `
            <div class="fj-answer-submitted">
              <div class="fj-check-icon">✓</div>
              <p>Your answer is locked in!</p>
              <p class="fj-waiting-text">Waiting for other players or timer...</p>
            </div>
          ` : `
            <div class="fj-answer-options">
              <p class="fj-answer-label">Select your answer:</p>
              <div class="fj-options-grid">
                ${options.map((option, index) => `
                  <button class="fj-option" data-index="${index}">
                    ${this.escapeHtml(option)}
                  </button>
                `).join('')}
              </div>
            </div>
          `}

          <div class="fj-answer-status">
            ${participants.map(p => {
              // We can't see if others have answered until results, so just show names
              const name = p.userFullName || p.userEmail || 'Player';
              return `
                <span class="fj-participant-name">${this.escapeHtml(name)}${p.isCurrentUser ? ' (you)' : ''}</span>
              `;
            }).join(' • ')}
          </div>
        </div>

        ${this.renderLeaderboard()}
      </div>
    `;
  }

  /**
   * Render Final Jeopardy results screen - show all answers and final scores
   */
  private renderFJResultsScreen(): string {
    const { currentQuestion, participants, fjWagers, leaderboard } = this.state;

    // Get correct answer
    const correctAnswer = currentQuestion?.correctAnswer || 'Unknown';

    // Sort leaderboard by score descending
    const sortedLeaderboard = [...leaderboard].sort((a, b) => b.totalScore - a.totalScore);

    return `
      <div class="jeopardy-game">
        ${this.renderHeader()}

        <div class="final-jeopardy-screen fj-results-phase">
          <h2 class="fj-results-title">Final Jeopardy Results</h2>

          ${currentQuestion ? `
            <div class="fj-question-recap">
              <p class="fj-recap-category">${this.escapeHtml(currentQuestion.category || 'Final Jeopardy')}</p>
              <p class="fj-recap-question">${this.escapeHtml(currentQuestion.getQuestionText())}</p>
              <div class="fj-correct-answer">
                <span class="fj-correct-label">Correct Answer:</span>
                <span class="fj-correct-value">${this.escapeHtml(correctAnswer)}</span>
              </div>
            </div>
          ` : ''}

          <div class="fj-final-standings">
            <h3 class="fj-standings-title">Final Standings</h3>
            <div class="fj-standings-list">
              ${sortedLeaderboard.map((entry, index) => {
                const participant = participants.find(p => p.userId === entry.userId);
                const name = participant?.userFullName || participant?.userEmail || 'Player';
                const isCurrentUser = participant?.isCurrentUser || false;
                const wager = fjWagers.get(entry.userId) || 0;

                // Determine placement styling
                let placementClass = '';
                if (index === 0) placementClass = 'first-place';
                else if (index === 1) placementClass = 'second-place';
                else if (index === 2) placementClass = 'third-place';

                return `
                  <div class="fj-standing-entry ${placementClass} ${isCurrentUser ? 'current-user' : ''}">
                    <div class="fj-standing-rank">${index + 1}</div>
                    <div class="fj-standing-info">
                      <div class="fj-standing-name">${this.escapeHtml(name)}${isCurrentUser ? ' (you)' : ''}</div>
                      <div class="fj-standing-wager">Wagered: $${wager}</div>
                    </div>
                    <div class="fj-standing-score">$${entry.totalScore}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="fj-complete-actions">
            <button class="btn-primary" id="fj-complete-game-btn">Complete Game</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners for FJ wager screen
   */
  private attachFJWagerListeners(): void {
    const submitBtn = this.container.querySelector('#fj-submit-wager-btn');
    const wagerInput = this.container.querySelector('#fj-wager-input') as HTMLInputElement;

    if (submitBtn && wagerInput) {
      submitBtn.addEventListener('click', () => {
        const wager = parseInt(wagerInput.value);
        const currentUser = this.state.participants.find(p => p.isCurrentUser);
        const myScore = this.getPlayerScore(currentUser?.userId || '');
        const maxWager = Math.max(myScore, 0);

        if (!isNaN(wager) && wager >= 0 && wager <= maxWager) {
          this.handleFinalJeopardyWager(wager);
        } else {
          // Show error
          const existingError = this.container.querySelector('.fj-wager-error');
          if (existingError) {
            existingError.textContent = `Please enter a wager between $0 and $${maxWager}`;
          } else {
            const form = this.container.querySelector('.fj-wager-form');
            if (form) {
              const error = document.createElement('p');
              error.className = 'fj-wager-error';
              error.style.color = 'var(--danger-color, #e74c3c)';
              error.textContent = `Please enter a wager between $0 and $${maxWager}`;
              form.appendChild(error);
            }
          }
        }
      });
    }

    this.attachExitListeners();
  }

  /**
   * Attach event listeners for FJ question screen
   */
  private attachFJQuestionListeners(): void {
    // Answer options
    const options = this.container.querySelectorAll('.fj-option');
    options.forEach(option => {
      option.addEventListener('click', () => {
        if (this.state.fjMyAnswerSubmitted) return;

        const index = parseInt(option.getAttribute('data-index') || '0');
        const question = this.state.currentQuestion;
        if (question) {
          const answer = question.getOptions()[index];
          this.submitFJAnswer(answer);
        }
      });
    });

    this.attachExitListeners();
  }

  /**
   * Attach event listeners for FJ results screen
   */
  private attachFJResultsListeners(): void {
    const completeBtn = this.container.querySelector('#fj-complete-game-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', async () => {
        // Complete the game
        await (window as any).scribeCat.games.completeGame(this.state.session.id);
      });
    }
  }

  protected getInstructions(): string {
    return 'Select questions from the board! Buzz in to answer, but be careful - wrong answers lose points!';
  }
}
