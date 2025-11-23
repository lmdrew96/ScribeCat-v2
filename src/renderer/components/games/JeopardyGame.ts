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

import { MultiplayerGame, GameState } from './MultiplayerGame.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';

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

  // Round state
  round: 'regular' | 'final_jeopardy';
  wagerAmount: number | null;
  showingDailyDoubleWager: boolean;
  showingFinalJeopardyWager: boolean;
}

export class JeopardyGame extends MultiplayerGame {
  protected state: JeopardyGameState;

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
      round: initialState.session.round || 'regular',
      wagerAmount: null,
      showingDailyDoubleWager: false,
      showingFinalJeopardyWager: false,
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
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    // Unsubscribe from buzzer updates
    await super.cleanup();
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
   */
  private subscribeToBuzzers(questionId: string): void {
    (window as any).scribeCat.games.jeopardy.subscribeToBuzzers(
      questionId,
      (buzzer: { userId: string; buzzerRank: number; pressedAt: Date }) => {
        console.log('[JeopardyGame] Buzzer press:', buzzer);

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
    );
  }

  /**
   * Update game state - handle Jeopardy-specific transitions
   */
  public updateState(updates: Partial<JeopardyGameState>): void {
    const previousQuestionId = this.state.currentQuestion?.id;

    super.updateState(updates as Partial<GameState>);

    // If question changed, subscribe to new question's buzzers
    if (updates.currentQuestion && updates.currentQuestion.id !== previousQuestionId) {
      this.resetQuestionState();
      this.subscribeToBuzzers(updates.currentQuestion.id);

      // Check if this is a Daily Double
      if (updates.currentQuestion.isDailyDouble) {
        const currentUser = this.state.participants.find(p => p.isCurrentUser);
        const isMyTurn = this.state.currentPlayerId === currentUser?.userId;

        if (isMyTurn) {
          // Show Daily Double wager screen
          super.updateState({ showingDailyDoubleWager: true } as Partial<GameState>);
        }
      }
    }

    // If returning to board (question cleared), reload board to show updated question statuses
    if ('currentQuestion' in updates && updates.currentQuestion === null && previousQuestionId) {
      console.log('[JeopardyGame] Returning to board after question, reloading board to show answered questions');
      // Just finished a question, reload board to show it as answered
      this.loadBoard();
    }

    // If round changed to Final Jeopardy, show wager screen
    if (updates.round === 'final_jeopardy' && this.state.round !== 'final_jeopardy') {
      super.updateState({ showingFinalJeopardyWager: true } as Partial<GameState>);
    }
  }

  /**
   * Reset question-specific state
   */
  private resetQuestionState(): void {
    this.state.buzzerEnabled = true;
    this.state.buzzers = [];
    this.state.firstBuzzerId = null;
    this.state.myBuzzerRank = null;
    this.state.hasAnswered = false;
  }

  /**
   * Main render function - routes to appropriate view
   */
  protected render(): void {
    const { gameStarted, gameEnded, showingDailyDoubleWager, showingFinalJeopardyWager, currentQuestion } = this.state;

    console.log('[JeopardyGame] render() called with state:', {
      gameStarted,
      gameEnded,
      showingDailyDoubleWager,
      showingFinalJeopardyWager,
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

    // Final Jeopardy wager screen
    if (showingFinalJeopardyWager) {
      console.log('[JeopardyGame] Rendering Final Jeopardy wager screen');
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

    const categoryNames = Object.keys(categories);
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
              ${this.renderQuestionGrid(categories, isMyTurn)}
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
  private renderQuestionGrid(categories: Record<string, any[]>, isMyTurn: boolean): string {
    const categoryNames = Object.keys(categories);
    const maxRows = 5; // Standard Jeopardy has 5 rows

    let gridHtml = '';

    for (let row = 0; row < maxRows; row++) {
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
    const maxWager = Math.max(myScore, currentQuestion.points);

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
    if (!currentQuestion) return '';

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
    const { currentQuestion, buzzerEnabled, myBuzzerRank, firstBuzzerId, participants, hasAnswered } = this.state;
    if (!currentQuestion) return '';

    const currentUser = participants.find(p => p.isCurrentUser);
    const isFirstBuzzer = firstBuzzerId === currentUser?.userId;
    const canAnswer = isFirstBuzzer && !hasAnswered;

    console.log('[JeopardyGame] renderQuestionView - buzzer state:', {
      myBuzzerRank,
      firstBuzzerId,
      currentUserId: currentUser?.userId,
      isFirstBuzzer,
      hasAnswered,
      canAnswer,
      buzzerEnabled,
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

          ${this.renderBuzzerSection(buzzerEnabled, myBuzzerRank, isFirstBuzzer, canAnswer, currentQuestion)}
        </div>

        ${this.renderLeaderboard()}
      </div>
    `;
  }

  /**
   * Render buzzer section based on state
   */
  private renderBuzzerSection(buzzerEnabled: boolean, myBuzzerRank: number | null, isFirstBuzzer: boolean, canAnswer: boolean, question: GameQuestion): string {
    // If current user can answer, show options
    if (canAnswer) {
      const options = question.getOptions();
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
    if (myBuzzerRank !== null && !canAnswer) {
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

    // Otherwise, show buzzer button
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
      </div>
    `;
  }

  /**
   * Get player's current score from leaderboard
   */
  private getPlayerScore(_userId: string): number {
    // This would need to fetch from the leaderboard
    // For now, return 0 as placeholder
    // TODO: Implement proper score tracking
    return 0;
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
      console.log('[JeopardyGame] Answer submitted. Points:', result.pointsEarned);
      this.updateState({ hasAnswered: true });

      // Refresh leaderboard to show updated scores
      const leaderboardResult = await (window as any).scribeCat.games.getGameLeaderboard(this.state.session.id);
      if (leaderboardResult.success) {
        console.log('[JeopardyGame] Leaderboard refreshed after answer:', leaderboardResult.leaderboard);
        this.updateState({
          leaderboard: leaderboardResult.leaderboard || [],
        });
      }

      // If correct and first buzzer, you select next question
      if (isCorrect && this.state.myBuzzerRank === 1) {
        await this.setAsCurrentPlayer();
      }
      // If wrong and there are more buzzers, let them try
      // Otherwise, lowest scoring player selects next
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
    this.updateState({
      wagerAmount: wager,
      showingDailyDoubleWager: false,
      buzzerEnabled: false, // No buzzer for Daily Double - only current player answers
    });
    this.render();
  }

  /**
   * Handle Final Jeopardy wager submission
   */
  private async handleFinalJeopardyWager(wager: number): Promise<void> {
    this.updateState({
      wagerAmount: wager,
      showingFinalJeopardyWager: false,
    });
    this.render();
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
        if (!isNaN(wager) && wager > 0) {
          this.handleDailyDoubleWager(wager);
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
        if (!isNaN(wager) && wager >= 0) {
          this.handleFinalJeopardyWager(wager);
        }
      });
    }

    this.attachExitListeners();
  }

  protected getInstructions(): string {
    return 'Select questions from the board! Buzz in to answer, but be careful - wrong answers lose points!';
  }
}
