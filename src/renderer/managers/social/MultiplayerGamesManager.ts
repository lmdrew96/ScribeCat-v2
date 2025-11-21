/**
 * Multiplayer Games Manager
 * Manages multiplayer game sessions, questions, and scoring
 */

import { GameSession, GameType } from '../../../domain/entities/GameSession.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';
import { PlayerScore, LeaderboardEntry } from '../../../domain/entities/PlayerScore.js';
import { Session } from '../../../domain/entities/Session.js';
import { QuizGenerator } from '../../services/ai-study-tools/generators/QuizGenerator.js';
import { MultiplayerGame, GameState, GameParticipant } from '../../components/games/MultiplayerGame.js';
import { QuizBattleGame } from '../../components/games/QuizBattleGame.js';
import { JeopardyGame } from '../../components/games/JeopardyGame.js';
import { BingoGame } from '../../components/games/BingoGame.js';
import { CollaborativeFlashcardsGame } from '../../components/games/CollaborativeFlashcardsGame.js';
import { TimeSync } from '../../services/TimeSync.js';

export class MultiplayerGamesManager {
  private currentGame: MultiplayerGame | null = null;
  private currentGameSession: GameSession | null = null;
  private currentUserId: string | null = null;
  private unsubscribers: Array<() => void> = [];
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private reconnectTimeout: number | null = null;
  private isReconnecting: boolean = false;
  private currentContainer: HTMLElement | null = null;
  private currentParticipants: GameParticipant[] = [];
  private waitingPollInterval: number | null = null;
  private questionPollInterval: number | null = null;
  private static readonly WAITING_POLL_INTERVAL_MS = 2000; // Poll every 2 seconds while waiting
  private static readonly QUESTION_POLL_INTERVAL_MS = 1000; // Poll every 1 second during gameplay

  // Bound event handlers - stored as properties so we can properly remove them
  private boundHandleAnswerSubmit = this.handleAnswerSubmit.bind(this);
  private boundHandleGameStart = this.handleGameStart.bind(this);
  private boundHandleGameClose = this.handleGameClose.bind(this);
  private boundHandleGameExit = this.handleGameExit.bind(this);
  private boundHandleNextQuestion = this.handleNextQuestion.bind(this);
  private boundHandleTimeout = this.handleTimeout.bind(this);

  /**
   * Initialize manager with current user
   */
  public initialize(userId: string): void {
    this.currentUserId = userId;

    // Check for active games on initialization (reconnection scenario)
    this.checkAndReconnectActiveGame().catch(err => {
      console.error('Failed to reconnect to active game:', err);
    });
  }

  /**
   * Create a new game session
   */
  public async createGame(
    roomId: string,
    gameType: GameType,
    session: Session,
    config?: {
      questionCount?: number;
      difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
      categories?: string[];
    }
  ): Promise<GameSession> {
    if (!this.currentUserId) {
      throw new Error('Games manager not initialized');
    }

    // Create game session in database
    const result = await window.scribeCat.games.createGameSession({
      roomId,
      gameType,
      config: {
        questionCount: config?.questionCount || 10,
        difficulty: config?.difficulty || 'mixed',
        categories: config?.categories,
      },
    });

    if (!result.success || !result.gameSession) {
      throw new Error(result.error || 'Failed to create game session');
    }

    const gameSession = GameSession.fromJSON(result.gameSession);

    // Generate questions using AI
    await this.generateQuestions(gameSession, session);

    return gameSession;
  }

  /**
   * Generate questions for a game using AI
   */
  private async generateQuestions(gameSession: GameSession, session: Session): Promise<void> {
    const questionCount = gameSession.getTotalQuestions();

    // Generate questions using QuizGenerator
    const generatedQuestions = await QuizGenerator.generateForMultiplayer(
      session,
      questionCount,
      gameSession.gameType,
      {
        difficulty: gameSession.config.difficulty,
        categories: gameSession.config.categories,
      }
    );

    // Create questions in database
    const questionParams = generatedQuestions.map((q, index) => ({
      gameSessionId: gameSession.id,
      questionIndex: index,
      questionData: {
        question: q.question,
        options: q.options,
        questionType: 'multiple_choice',
        explanation: q.explanation,
      },
      correctAnswer: q.correctAnswer,
      category: q.category,
      difficulty: q.difficulty || 'medium',
      points: gameSession.config.pointsPerQuestion || 100,
      timeLimitSeconds: gameSession.config.timePerQuestion || 30,
    }));

    const result = await window.scribeCat.games.createGameQuestions(questionParams);

    if (!result.success) {
      throw new Error(result.error || 'Failed to create game questions');
    }
  }

  /**
   * Check for and reconnect to active games
   */
  private async checkAndReconnectActiveGame(): Promise<void> {
    if (!this.currentUserId || this.currentGame) {
      return; // Already have a game or not initialized
    }

    // Query for active game sessions where user is a participant
    // This would require a new IPC method - for now, skip
    console.log('[MultiplayerGamesManager] Checking for active games...');
  }

  /**
   * Attempt to reconnect to game after disconnection
   */
  private async attemptReconnect(gameSessionId: string): Promise<void> {
    if (this.isReconnecting || this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('[MultiplayerGamesManager] Max reconnection attempts reached');
      this.showConnectionError();
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);

    console.log(`[MultiplayerGamesManager] Reconnecting in ${backoffMs}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);

    this.showReconnectingUI();

    this.reconnectTimeout = window.setTimeout(async () => {
      try {
        // Resubscribe to game updates
        this.subscribeToGameUpdates(gameSessionId);

        // Refresh game state
        await this.refreshGameState(gameSessionId);

        // Success!
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.hideReconnectingUI();
        console.log('[MultiplayerGamesManager] Reconnected successfully');
      } catch (error) {
        console.error('[MultiplayerGamesManager] Reconnection failed:', error);
        this.isReconnecting = false;
        // Try again
        await this.attemptReconnect(gameSessionId);
      }
    }, backoffMs);
  }

  /**
   * Refresh game state from server
   */
  private async refreshGameState(gameSessionId: string): Promise<void> {
    if (!this.currentGame) return;

    // Reload game session
    const sessionResult = await window.scribeCat.games.getGameSession(gameSessionId);
    if (sessionResult.success && sessionResult.gameSession) {
      this.currentGameSession = GameSession.fromJSON(sessionResult.gameSession);
    }

    // Reload current question
    const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);
    const currentQuestion = questionResult.success && questionResult.question
      ? GameQuestion.fromJSON(questionResult.question)
      : null;

    // Reload leaderboard
    const leaderboardResult = await window.scribeCat.games.getGameLeaderboard(gameSessionId);
    const leaderboard = leaderboardResult.success ? leaderboardResult.leaderboard || [] : [];

    // Update game state
    this.currentGame.updateState({
      session: this.currentGameSession,
      currentQuestion,
      leaderboard,
      gameEnded: this.currentGameSession?.hasEnded() || false,
    });
  }

  /**
   * Show reconnecting UI overlay
   */
  private showReconnectingUI(): void {
    if (!this.currentContainer) return;

    const existing = this.currentContainer.querySelector('.reconnecting-overlay');
    if (existing) return; // Already showing

    const overlay = document.createElement('div');
    overlay.className = 'reconnecting-overlay';
    overlay.innerHTML = `
      <div class="reconnecting-content">
        <div class="loading-spinner"></div>
        <h3>Reconnecting to game...</h3>
        <p>Attempt ${this.reconnectAttempts} of ${this.MAX_RECONNECT_ATTEMPTS}</p>
      </div>
    `;
    this.currentContainer.appendChild(overlay);
  }

  /**
   * Hide reconnecting UI overlay
   */
  private hideReconnectingUI(): void {
    if (!this.currentContainer) return;

    const overlay = this.currentContainer.querySelector('.reconnecting-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * Show connection error UI
   */
  private showConnectionError(): void {
    if (!this.currentContainer) return;

    const overlay = document.createElement('div');
    overlay.className = 'connection-error-overlay';
    overlay.innerHTML = `
      <div class="error-content">
        <h3>Connection Lost</h3>
        <p>Unable to reconnect to the game. Please check your internet connection and refresh the page.</p>
        <button class="close-game-btn">Close Game</button>
      </div>
    `;

    const closeBtn = overlay.querySelector('.close-game-btn');
    closeBtn?.addEventListener('click', () => {
      this.cleanup();
    });

    this.currentContainer.appendChild(overlay);
  }

  /**
   * Start a game (for host - updates game status to in_progress)
   */
  public async startGame(
    gameSessionId: string,
    container: HTMLElement,
    participants: GameParticipant[]
  ): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('Games manager not initialized');
    }

    // Store for reconnection
    this.currentContainer = container;
    this.currentParticipants = participants;

    // Update game status to in_progress
    const result = await window.scribeCat.games.startGame(gameSessionId);

    if (!result.success || !result.gameSession) {
      throw new Error(result.error || 'Failed to start game');
    }

    this.currentGameSession = GameSession.fromJSON(result.gameSession);

    // Initialize the game UI
    await this.initializeGameUI(gameSessionId, container, participants);
  }

  /**
   * Join an existing game (for non-host participants - doesn't change status)
   */
  public async joinGame(
    gameSessionId: string,
    container: HTMLElement,
    participants: GameParticipant[]
  ): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('Games manager not initialized');
    }

    // Store for reconnection
    this.currentContainer = container;
    this.currentParticipants = participants;

    // Get the current game session without updating status
    const result = await window.scribeCat.games.getGameSession(gameSessionId);

    if (!result.success || !result.gameSession) {
      throw new Error(result.error || 'Failed to get game session');
    }

    this.currentGameSession = GameSession.fromJSON(result.gameSession);

    // Initialize the game UI
    await this.initializeGameUI(gameSessionId, container, participants);
  }

  /**
   * Initialize game UI (shared between startGame and joinGame)
   */
  private async initializeGameUI(
    gameSessionId: string,
    container: HTMLElement,
    participants: GameParticipant[]
  ): Promise<void> {
    console.log('Game session status:', this.currentGameSession!.status);
    console.log('Current question index:', this.currentGameSession!.currentQuestionIndex);

    // Load current question
    const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);
    console.log('getCurrentQuestion result:', questionResult);

    const currentQuestion = questionResult.success && questionResult.question
      ? GameQuestion.fromJSON(questionResult.question)
      : null;

    console.log('Current question:', currentQuestion ? `Question ${currentQuestion.questionIndex}: ${currentQuestion.questionData.question}` : 'No question loaded');

    // Load initial leaderboard
    const leaderboardResult = await window.scribeCat.games.getGameLeaderboard(gameSessionId);
    const leaderboard = leaderboardResult.success ? leaderboardResult.leaderboard || [] : [];

    // Create initial game state
    // DON'T set questionStartedAt for initial state - let the host start fresh
    // It will be set by subscription updates for mid-game question changes
    const gameState: GameState = {
      session: this.currentGameSession!,
      currentQuestion,
      participants,
      scores: [],
      leaderboard,
      currentUserId: this.currentUserId!,
      hasAnswered: false,
      gameStarted: this.currentGameSession!.status === 'in_progress',
      gameEnded: this.currentGameSession!.status === 'completed',
      // Don't set questionStartedAt here - let timer start fresh
    };

    console.log('Initializing game with state:', {
      hasSession: !!gameState.session,
      hasQuestion: !!gameState.currentQuestion,
      participantCount: gameState.participants.length,
      gameType: this.currentGameSession!.gameType
    });

    // Initialize game component based on type
    this.currentGame = this.createGameComponent(
      this.currentGameSession!.gameType,
      container,
      gameState
    );

    // IMPORTANT: Setup event listeners BEFORE subscribing to updates
    // This prevents race conditions where subscription callbacks fire
    // before the game:timeout listener is registered
    this.setupGameEventListeners();

    // Subscribe to game updates (may fire callbacks immediately)
    this.subscribeToGameUpdates(gameSessionId);

    // Initialize the game UI last
    await this.currentGame.initialize();

    // If game is in "waiting" status, start polling as fallback for unreliable realtime
    // This ensures participants see the game start even if subscription misses the update
    if (this.currentGameSession!.status === 'waiting') {
      this.startWaitingPoll(gameSessionId);
    }

    // If game is already "in_progress", start question polling
    // This ensures late joiners or mid-game reconnects can detect question changes
    if (this.currentGameSession!.status === 'in_progress') {
      this.startQuestionPoll(gameSessionId);
    }
  }

  /**
   * Create game component based on type
   */
  private createGameComponent(
    gameType: GameType,
    container: HTMLElement,
    state: GameState
  ): MultiplayerGame {
    switch (gameType) {
      case 'quiz_battle':
        return new QuizBattleGame(container, state);
      case 'jeopardy':
        return new JeopardyGame(container, state);
      case 'bingo':
        return new BingoGame(container, state);
      case 'flashcards':
        return new CollaborativeFlashcardsGame(container, state);
      default:
        throw new Error(`Unknown game type: ${gameType}`);
    }
  }

  /**
   * Subscribe to real-time game updates
   */
  private subscribeToGameUpdates(gameSessionId: string): void {
    // Subscribe to game session updates
    const sessionUnsubscribe = window.scribeCat.games.subscribeToGameSession(
      gameSessionId,
      async (sessionData) => {
        const gameSession = GameSession.fromJSON(sessionData);
        const previousIndex = this.currentGameSession?.currentQuestionIndex;
        const previousStatus = this.currentGameSession?.status;
        const currentQuestion = this.currentGame ? (this.currentGame as any).state?.currentQuestion : null;

        console.log(`[MultiplayerGamesManager] Session update: ${previousStatus} -> ${gameSession.status}, index: ${previousIndex} -> ${gameSession.currentQuestionIndex}, hasQuestion: ${!!currentQuestion}`);

        this.currentGameSession = gameSession;

        // Check if we need to fetch a question:
        // 1. Question index changed
        // 2. Game just started (waiting -> in_progress)
        // 3. Game is in_progress but we have no current question (late joiner or missed update)
        const questionIndexChanged = previousIndex !== undefined && previousIndex !== gameSession.currentQuestionIndex;
        const gameJustStarted = previousStatus === 'waiting' && gameSession.status === 'in_progress';
        const missingQuestion = gameSession.status === 'in_progress' && !currentQuestion;
        const needsQuestionFetch = questionIndexChanged || gameJustStarted || missingQuestion;

        if (needsQuestionFetch) {
          console.log(`[MultiplayerGamesManager] Fetching question - indexChanged: ${questionIndexChanged}, gameJustStarted: ${gameJustStarted}, missingQuestion: ${missingQuestion}`);

          // Small delay to ensure the database write has fully propagated
          // This prevents race conditions where getCurrentQuestion returns stale data
          await new Promise(resolve => setTimeout(resolve, 150));

          // Fetch the new current question
          const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);
          const currentQuestion = questionResult.success && questionResult.question
            ? GameQuestion.fromJSON(questionResult.question)
            : null;

          console.log(`[MultiplayerGamesManager] Fetched question for index ${gameSession.currentQuestionIndex}:`, currentQuestion?.id);

          if (this.currentGame) {
            // For question changes mid-game, use session.updatedAt for timer sync
            // This timestamp represents when the question index was incremented
            const questionStartedAt = questionIndexChanged ? gameSession.updatedAt.getTime() : undefined;

            this.currentGame.updateState({
              session: gameSession,
              currentQuestion,
              hasAnswered: false, // Reset for new question
              gameStarted: gameSession.status === 'in_progress',
              gameEnded: gameSession.hasEnded(),
              questionStartedAt, // Set for question changes, undefined for game start
            });
          }
        } else if (this.currentGame) {
          // Just update session state without changing question
          this.currentGame.updateState({
            session: gameSession,
            gameStarted: gameSession.status === 'in_progress',
            gameEnded: gameSession.hasEnded(),
          });
        }
      }
    );

    // Subscribe to new questions
    const questionsUnsubscribe = window.scribeCat.games.subscribeToGameQuestions(
      gameSessionId,
      async (questionData) => {
        const question = GameQuestion.fromJSON(questionData);

        if (this.currentGame && this.currentGameSession) {
          // Check if this is the current question
          if (question.questionIndex === this.currentGameSession.currentQuestionIndex) {
            this.currentGame.updateState({
              currentQuestion: question,
              hasAnswered: false,
            });
          }
        }
      }
    );

    // Subscribe to new scores
    const scoresUnsubscribe = window.scribeCat.games.subscribeToGameScores(
      gameSessionId,
      async (scoreData) => {
        // Reload leaderboard when new scores come in
        await this.refreshLeaderboard(gameSessionId);
      }
    );

    this.unsubscribers.push(sessionUnsubscribe, questionsUnsubscribe, scoresUnsubscribe);
  }

  /**
   * Refresh leaderboard
   */
  private async refreshLeaderboard(gameSessionId: string): Promise<void> {
    const result = await window.scribeCat.games.getGameLeaderboard(gameSessionId);

    if (result.success && this.currentGame) {
      this.currentGame.updateState({
        leaderboard: result.leaderboard || [],
      });
    }
  }

  /**
   * Setup game event listeners
   * Uses bound handler references stored as class properties for proper cleanup
   */
  private setupGameEventListeners(): void {
    // Handle answer submissions
    window.addEventListener('game:answer', this.boundHandleAnswerSubmit);

    // Handle game start (from waiting screen)
    window.addEventListener('game:start', this.boundHandleGameStart);

    // Handle game close (from completion screen)
    window.addEventListener('game:close', this.boundHandleGameClose);

    // Handle game exit (mid-game exit)
    window.addEventListener('game:exit', this.boundHandleGameExit);

    // Handle next question
    window.addEventListener('game:next-question', this.boundHandleNextQuestion);

    // Handle timeout (when timer expires)
    window.addEventListener('game:timeout', this.boundHandleTimeout);
  }

  /**
   * Handle answer submission
   */
  private async handleAnswerSubmit(event: Event): Promise<void> {
    const customEvent = event as CustomEvent<{ answer: string; timeTaken: number }>;
    const { answer, timeTaken } = customEvent.detail;

    if (!this.currentGameSession || !this.currentGame || !this.currentUserId) {
      return;
    }

    const currentQuestion = this.currentGame['state'].currentQuestion;
    if (!currentQuestion) return;

    try {
      const result = await window.scribeCat.games.submitAnswer({
        gameSessionId: this.currentGameSession.id,
        userId: this.currentUserId,
        questionId: currentQuestion.id,
        answer,
        timeTaken,
      });

      if (result.success) {
        this.currentGame.updateState({ hasAnswered: true });
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
  }

  /**
   * Handle game start (when host clicks "Start Game" button)
   */
  private async handleGameStart(event: Event): Promise<void> {
    if (!this.currentGameSession) {
      console.warn('[MultiplayerGamesManager] handleGameStart: No current game session');
      return;
    }

    console.log('[MultiplayerGamesManager] Host starting game from waiting screen');

    try {
      // Update game status to in_progress
      const result = await window.scribeCat.games.startGame(this.currentGameSession.id);

      if (!result.success) {
        console.error('[MultiplayerGamesManager] Failed to start game:', result.error);
        return;
      }

      console.log('[MultiplayerGamesManager] Game started successfully');
      // State update will happen via real-time subscription
    } catch (error) {
      console.error('[MultiplayerGamesManager] Exception in handleGameStart:', error);
    }
  }

  /**
   * Handle game close (from completion screen)
   */
  private async handleGameClose(event: Event): Promise<void> {
    // Defensive: ensure game is marked as completed if it somehow isn't
    if (this.currentGameSession && !this.currentGameSession.hasEnded()) {
      console.log('[MultiplayerGamesManager] Completing game before close');
      try {
        await window.scribeCat.games.completeGame(this.currentGameSession.id);
      } catch (error) {
        console.error('Failed to complete game:', error);
      }
    }

    await this.cleanup();

    // Emit event to notify StudyRoomView
    const closeEvent = new CustomEvent('multiplayer-game:closed');
    window.dispatchEvent(closeEvent);
  }

  /**
   * Handle game exit (mid-game exit)
   */
  private async handleGameExit(event: Event): Promise<void> {
    // Cancel the game (it wasn't completed naturally)
    if (this.currentGameSession && !this.currentGameSession.hasEnded()) {
      console.log('[MultiplayerGamesManager] Cancelling game due to exit');
      try {
        await window.scribeCat.games.cancelGame(this.currentGameSession.id);
      } catch (error) {
        console.error('Failed to cancel game:', error);
      }
    }

    await this.cleanup();

    // Emit event to notify StudyRoomView
    const closeEvent = new CustomEvent('multiplayer-game:closed');
    window.dispatchEvent(closeEvent);
  }

  /**
   * Handle next question
   *
   * Note: We only call nextQuestion() here and let the real-time subscription
   * handle the state update. This avoids a race condition where both the
   * subscription and manual fetch could update the state with the same question.
   */
  private async handleNextQuestion(event: Event): Promise<void> {
    console.log('[MultiplayerGamesManager] handleNextQuestion called');
    console.log('[MultiplayerGamesManager] currentGameSession exists:', !!this.currentGameSession);

    if (!this.currentGameSession) {
      console.warn('[MultiplayerGamesManager] handleNextQuestion: No current game session');
      return;
    }

    const currentIndex = this.currentGameSession.currentQuestionIndex;
    const totalQuestions = this.currentGameSession.getTotalQuestions();
    const isLast = this.currentGameSession.isLastQuestion();

    console.log(`[MultiplayerGamesManager] Question ${currentIndex + 1}/${totalQuestions}, isLastQuestion: ${isLast}`);

    try {
      // Check if we're at the last question
      if (isLast) {
        // This is the last question - complete the game instead of advancing
        console.log('[MultiplayerGamesManager] Last question reached - completing game');
        const result = await window.scribeCat.games.completeGame(this.currentGameSession.id);

        if (!result.success) {
          console.error('[MultiplayerGamesManager] Failed to complete game:', result.error);
        } else {
          console.log('[MultiplayerGamesManager] Game completed successfully');
        }
        // State update will happen via real-time subscription
      } else {
        // More questions remain - advance to next
        console.log('[MultiplayerGamesManager] Advancing to next question');
        const result = await window.scribeCat.games.nextQuestion(this.currentGameSession.id);

        if (!result.success) {
          console.error('[MultiplayerGamesManager] Failed to advance to next question:', result.error);
        } else {
          console.log('[MultiplayerGamesManager] Successfully called nextQuestion');
        }
        // State update will happen via real-time subscription (subscribeToGameSession)
      }
    } catch (error) {
      console.error('[MultiplayerGamesManager] Exception in handleNextQuestion:', error);
    }
  }

  /**
   * Handle timeout - when the timer expires without an answer
   * Automatically advances to the next question
   */
  private async handleTimeout(event: Event): Promise<void> {
    if (!this.currentGameSession || !this.currentUserId) return;

    console.log('[MultiplayerGamesManager] Timeout - advancing to next question');

    // Mark player as having answered (with no answer) by advancing
    // The real-time subscription will handle loading the new question
    await this.handleNextQuestion(event);
  }

  /**
   * Get active game for a room
   */
  public async getActiveGame(roomId: string): Promise<GameSession | null> {
    const result = await window.scribeCat.games.getActiveGameForRoom(roomId);

    if (result.success && result.gameSession) {
      return GameSession.fromJSON(result.gameSession);
    }

    return null;
  }

  /**
   * Cancel a game
   */
  public async cancelGame(gameSessionId: string): Promise<void> {
    const result = await window.scribeCat.games.cancelGame(gameSessionId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to cancel game');
    }

    await this.cleanup();
  }

  /**
   * Start polling for game status changes while in "waiting" state
   * This is a fallback for unreliable Supabase Realtime subscriptions
   */
  private startWaitingPoll(gameSessionId: string): void {
    if (this.waitingPollInterval !== null) return;

    console.log('[MultiplayerGamesManager] Starting waiting poll fallback');
    this.waitingPollInterval = window.setInterval(async () => {
      try {
        const result = await window.scribeCat.games.getGameSession(gameSessionId);
        if (!result.success || !result.gameSession) return;

        const gameSession = GameSession.fromJSON(result.gameSession);
        console.log(`[MultiplayerGamesManager] Waiting poll: status=${gameSession.status}`);

        // If game started, fetch question and update state
        if (gameSession.status === 'in_progress') {
          this.stopWaitingPoll();
          this.currentGameSession = gameSession;

          // Fetch the current question
          const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);
          const currentQuestion = questionResult.success && questionResult.question
            ? GameQuestion.fromJSON(questionResult.question)
            : null;

          console.log('[MultiplayerGamesManager] Waiting poll detected game start, fetched question:', currentQuestion?.id);

          if (this.currentGame) {
            // For late joiners who join mid-game via waiting poll,
            // use the game's startedAt timestamp for first question sync
            const questionStartedAt = gameSession.startedAt?.getTime();

            this.currentGame.updateState({
              session: gameSession,
              currentQuestion,
              hasAnswered: false,
              gameStarted: true,
              gameEnded: false,
              questionStartedAt, // Use game startedAt for first question
            });

            // Start question poll now that game is in progress
            this.startQuestionPoll(gameSessionId);
          }
        }
      } catch (error) {
        console.error('[MultiplayerGamesManager] Waiting poll error:', error);
      }
    }, MultiplayerGamesManager.WAITING_POLL_INTERVAL_MS);
  }

  /**
   * Stop the waiting poll
   */
  private stopWaitingPoll(): void {
    if (this.waitingPollInterval !== null) {
      clearInterval(this.waitingPollInterval);
      this.waitingPollInterval = null;
      console.log('[MultiplayerGamesManager] Stopped waiting poll');
    }
  }

  /**
   * Start polling for question index changes during active gameplay
   * This is a fallback for unreliable Supabase Realtime subscriptions
   */
  private startQuestionPoll(gameSessionId: string): void {
    if (this.questionPollInterval !== null) return;

    console.log('[MultiplayerGamesManager] Starting question poll fallback');
    this.questionPollInterval = window.setInterval(async () => {
      try {
        if (!this.currentGameSession || !this.currentGame) {
          this.stopQuestionPoll();
          return;
        }

        const result = await window.scribeCat.games.getGameSession(gameSessionId);
        if (!result.success || !result.gameSession) return;

        const gameSession = GameSession.fromJSON(result.gameSession);
        const previousIndex = this.currentGameSession.currentQuestionIndex;
        const newIndex = gameSession.currentQuestionIndex;

        // Check if question index changed or game ended
        if (newIndex !== previousIndex) {
          console.log(`[MultiplayerGamesManager] Question poll detected change: ${previousIndex} -> ${newIndex}`);
          this.currentGameSession = gameSession;

          // Fetch the new question
          const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);
          const currentQuestion = questionResult.success && questionResult.question
            ? GameQuestion.fromJSON(questionResult.question)
            : null;

          console.log(`[MultiplayerGamesManager] Question poll fetched question:`, currentQuestion?.id);

          if (this.currentGame) {
            this.currentGame.updateState({
              session: gameSession,
              currentQuestion,
              hasAnswered: false,
              gameStarted: gameSession.status === 'in_progress',
              gameEnded: gameSession.hasEnded(),
              questionStartedAt: gameSession.updatedAt.getTime(), // Use updated_at for question sync
            });
          }
        } else if (gameSession.hasEnded() && !this.currentGameSession.hasEnded()) {
          // Game ended
          console.log('[MultiplayerGamesManager] Question poll detected game end');
          this.currentGameSession = gameSession;
          this.stopQuestionPoll();

          if (this.currentGame) {
            this.currentGame.updateState({
              session: gameSession,
              gameEnded: true,
            });
          }
        }
      } catch (error) {
        console.error('[MultiplayerGamesManager] Question poll error:', error);
      }
    }, MultiplayerGamesManager.QUESTION_POLL_INTERVAL_MS);
  }

  /**
   * Stop the question poll
   */
  private stopQuestionPoll(): void {
    if (this.questionPollInterval !== null) {
      clearInterval(this.questionPollInterval);
      this.questionPollInterval = null;
      console.log('[MultiplayerGamesManager] Stopped question poll');
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    // Stop waiting poll
    this.stopWaitingPoll();

    // Stop question poll
    this.stopQuestionPoll();

    // Clear reconnection timeout
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Reset reconnection state
    this.reconnectAttempts = 0;
    this.isReconnecting = false;

    // Unsubscribe from all subscriptions
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];

    // Cleanup current game
    if (this.currentGame) {
      await this.currentGame.cleanup();
      this.currentGame = null;
    }

    // Cleanup TimeSync to stop periodic server requests
    TimeSync.getInstance().cleanup();

    this.currentGameSession = null;
    this.currentContainer = null;
    this.currentParticipants = [];

    // Remove event listeners using the same bound references
    window.removeEventListener('game:answer', this.boundHandleAnswerSubmit);
    window.removeEventListener('game:start', this.boundHandleGameStart);
    window.removeEventListener('game:close', this.boundHandleGameClose);
    window.removeEventListener('game:exit', this.boundHandleGameExit);
    window.removeEventListener('game:next-question', this.boundHandleNextQuestion);
    window.removeEventListener('game:timeout', this.boundHandleTimeout);
  }
}
