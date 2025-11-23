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
import { HotSeatChallengeGame } from '../../components/games/HotSeatChallengeGame.js';
import { LightningChainGame } from '../../components/games/LightningChainGame.js';
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
  private boundHandleBingo = this.handleBingo.bind(this);
  private boundHandleQuestionsReady = this.handleQuestionsReady.bind(this);

  // Jeopardy-specific bound handlers
  private boundHandleJeopardyQuestionAnswered = this.handleJeopardyQuestionAnswered.bind(this);
  private boundHandleJeopardyBoardComplete = this.handleJeopardyBoardComplete.bind(this);

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

    // Generate questions using AI in background (non-blocking)
    this.generateQuestionsAsync(gameSession, session);

    return gameSession;
  }

  /**
   * Generate questions for a game using AI (runs in background)
   */
  private async generateQuestionsAsync(gameSession: GameSession, session: Session): Promise<void> {
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

    // Post-process Jeopardy questions
    let processedQuestions = generatedQuestions;
    if (gameSession.gameType === 'jeopardy') {
      processedQuestions = this.processJeopardyQuestions(generatedQuestions);
    }

    // Create questions in database
    const questionParams = processedQuestions.map((q: any, index) => {
      // Map difficulty to allowed values (easy, medium, hard)
      let difficulty = q.difficulty || 'medium';
      if (difficulty === 'easy-medium') difficulty = 'easy';
      if (difficulty === 'medium-hard') difficulty = 'hard';

      return {
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
        difficulty,
        points: q.points || gameSession.config.pointsPerQuestion || 100,
        timeLimitSeconds: gameSession.config.timePerQuestion || 30,
        // Jeopardy-specific fields
        columnPosition: q.columnPosition,
        isDailyDouble: q.isDailyDouble || false,
        isFinalJeopardy: q.isFinalJeopardy || false,
      };
    });

    const result = await window.scribeCat.games.createGameQuestions(questionParams);

    if (!result.success) {
      throw new Error(result.error || 'Failed to create game questions');
    }

    // Emit event when questions are ready
    window.dispatchEvent(
      new CustomEvent('game:questions-ready', {
        detail: { gameSessionId: gameSession.id },
      })
    );
  }

  /**
   * Process Jeopardy questions to add point values, Daily Doubles, etc.
   */
  private processJeopardyQuestions(questions: any[]): any[] {
    // Map difficulty to point values
    const difficultyToPoints: Record<string, number> = {
      'easy': 100,
      'easy-medium': 200,
      'medium': 300,
      'medium-hard': 400,
      'hard': 500,
    };

    // Assign points based on difficulty and columnPosition
    const processed = questions.map((q) => {
      // If AI provided columnPosition, use that to determine points
      let points = 100;
      if (q.columnPosition) {
        points = q.columnPosition * 100; // 1=100, 2=200, 3=300, 4=400, 5=500
      } else if (q.difficulty && difficultyToPoints[q.difficulty]) {
        points = difficultyToPoints[q.difficulty];
      }

      return {
        ...q,
        points,
        columnPosition: q.columnPosition || Math.ceil(points / 100),
        isFinalJeopardy: q.isFinalJeopardy || false,
        isDailyDouble: false, // Will be set below
      };
    });

    // Separate Final Jeopardy from regular questions
    const regularQuestions = processed.filter((q) => !q.isFinalJeopardy);
    const finalJeopardy = processed.filter((q) => q.isFinalJeopardy);

    // Select 1-2 Daily Doubles from non-first-row questions
    const eligibleForDD = regularQuestions.filter((q) => q.columnPosition > 1); // Not 100-point questions
    if (eligibleForDD.length > 0) {
      // Randomly select 1-2 Daily Doubles
      const numDailyDoubles = Math.min(2, eligibleForDD.length);
      const shuffled = [...eligibleForDD].sort(() => Math.random() - 0.5);

      for (let i = 0; i < numDailyDoubles; i++) {
        const ddQuestion = shuffled[i];
        const index = regularQuestions.indexOf(ddQuestion);
        if (index !== -1) {
          regularQuestions[index].isDailyDouble = true;
        }
      }
    }

    // Return regular questions + Final Jeopardy at the end
    return [...regularQuestions, ...finalJeopardy];
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

    let currentQuestion: GameQuestion | null = null;

    // For Jeopardy: Only load question if one has been selected (selectedQuestionId is set)
    // For other games: Load question based on current_question_index
    let jeopardyBoard: any[] | null = null;
    let jeopardyQuestionsReady = false;

    if (this.currentGameSession!.gameType === 'jeopardy') {
      const selectedQuestionId = this.currentGameSession!.selectedQuestionId;

      if (selectedQuestionId) {
        console.log('Jeopardy: Loading selected question:', selectedQuestionId);
        const questionResult = await window.scribeCat.games.getGameQuestion(gameSessionId, selectedQuestionId);
        currentQuestion = questionResult.success && questionResult.question
          ? GameQuestion.fromJSON(questionResult.question)
          : null;
        jeopardyQuestionsReady = true;
      } else {
        console.log('Jeopardy: No question selected yet, checking for existing board...');
        // Check if questions already exist (for participants joining after questions created)
        const boardResult = await window.scribeCat.games.jeopardy.getBoard(gameSessionId);
        if (boardResult.success && boardResult.board && boardResult.board.length > 0) {
          console.log('[MultiplayerGamesManager] Questions already exist, loading board for participant (', boardResult.board.length, 'questions)');
          jeopardyBoard = boardResult.board;
          jeopardyQuestionsReady = true;
        } else {
          console.log('[MultiplayerGamesManager] No questions exist yet, waiting for host to generate them');
        }
      }
    } else {
      // Other games use sequential question index
      const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);
      console.log('getCurrentQuestion result:', questionResult);
      currentQuestion = questionResult.success && questionResult.question
        ? GameQuestion.fromJSON(questionResult.question)
        : null;
    }

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
      questionsReady: this.currentGameSession!.gameType === 'jeopardy'
        ? jeopardyQuestionsReady
        : currentQuestion !== null, // For Jeopardy, check if board exists; for others, check if question exists
      // Don't set questionStartedAt here - let timer start fresh
    };

    // Add Jeopardy-specific state if applicable
    if (this.currentGameSession!.gameType === 'jeopardy' && jeopardyBoard) {
      (gameState as any).board = jeopardyBoard;
    }

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
      case 'hot_seat_challenge':
        return new HotSeatChallengeGame(container, state);
      case 'lightning_chain':
        return new LightningChainGame(container, state);
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
        // For Jeopardy: check selectedQuestionId
        // For other games: check question index
        const isJeopardy = gameSession.gameType === 'jeopardy';
        const selectedQuestionId = gameSession.selectedQuestionId;
        const previousSelectedId = (this.currentGame as any)?.state?.selectedQuestionId;

        const questionIndexChanged = previousIndex !== undefined && previousIndex !== gameSession.currentQuestionIndex;
        const selectedQuestionChanged = isJeopardy && selectedQuestionId && selectedQuestionId !== previousSelectedId;
        const gameJustStarted = previousStatus === 'waiting' && gameSession.status === 'in_progress';
        const missingQuestion = gameSession.status === 'in_progress' && !currentQuestion;
        const needsQuestionFetch = questionIndexChanged || selectedQuestionChanged || gameJustStarted || missingQuestion;

        if (needsQuestionFetch) {
          console.log(`[MultiplayerGamesManager] Fetching question - indexChanged: ${questionIndexChanged}, selectedChanged: ${selectedQuestionChanged}, gameJustStarted: ${gameJustStarted}, missingQuestion: ${missingQuestion}`);

          // Small delay to ensure the database write has fully propagated
          await new Promise(resolve => setTimeout(resolve, 150));

          let fetchedQuestion: GameQuestion | null = null;

          if (isJeopardy && selectedQuestionId) {
            // Jeopardy: Fetch selected question by ID
            const questionResult = await window.scribeCat.games.getGameQuestion(gameSessionId, selectedQuestionId);
            if (questionResult.success && questionResult.question) {
              fetchedQuestion = GameQuestion.fromJSON(questionResult.question);
              console.log(`[MultiplayerGamesManager] Fetched Jeopardy question ${selectedQuestionId}:`, fetchedQuestion.id);
            }
          } else {
            // Sequential games: Fetch current question by index
            const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);
            fetchedQuestion = questionResult.success && questionResult.question
              ? GameQuestion.fromJSON(questionResult.question)
              : null;
            console.log(`[MultiplayerGamesManager] Fetched question for index ${gameSession.currentQuestionIndex}:`, fetchedQuestion?.id);
          }

          if (this.currentGame) {
            const questionStartedAt = gameSession.questionStartedAt?.getTime();

            this.currentGame.updateState({
              session: gameSession,
              currentQuestion: fetchedQuestion,
              hasAnswered: false,
              gameStarted: gameSession.status === 'in_progress',
              gameEnded: gameSession.hasEnded(),
              questionStartedAt,
            });

            // Update Jeopardy-specific state
            if (isJeopardy) {
              (this.currentGame as any).updateState({
                selectedQuestionId: gameSession.selectedQuestionId || null,
                currentPlayerId: gameSession.currentPlayerId || null,
                round: gameSession.round || 'regular',
              });
            }
          }
        } else if (this.currentGame) {
          // Just update session state without changing question
          this.currentGame.updateState({
            session: gameSession,
            gameStarted: gameSession.status === 'in_progress',
            gameEnded: gameSession.hasEnded(),
          });

          // Update Jeopardy state even without question change
          if (isJeopardy) {
            (this.currentGame as any).updateState({
              currentPlayerId: (sessionData as any).current_player_id || null,
              round: (sessionData as any).round || 'regular',
            });
          }
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
        console.log('[MultiplayerGamesManager] New score received, refreshing leaderboard:', scoreData);
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

    // Handle bingo (when player gets bingo)
    window.addEventListener('game:bingo', this.boundHandleBingo);

    // Handle questions ready (when async question generation completes)
    window.addEventListener('game:questions-ready', this.boundHandleQuestionsReady);

    // Jeopardy-specific events
    window.addEventListener('game:jeopardy:question-answered', this.boundHandleJeopardyQuestionAnswered);
    window.addEventListener('game:jeopardy:board-complete', this.boundHandleJeopardyBoardComplete);
  }

  /**
   * Handle answer submission
   */
  private async handleAnswerSubmit(event: Event): Promise<void> {
    const customEvent = event as CustomEvent<{ answer: string; timeTakenMs: number }>;
    const { answer, timeTakenMs } = customEvent.detail;

    // Validation with detailed logging
    if (!this.currentGameSession) {
      console.error('[MultiplayerGamesManager] Cannot submit answer: No active game session');
      return;
    }

    if (!this.currentGame) {
      console.error('[MultiplayerGamesManager] Cannot submit answer: No current game instance');
      return;
    }

    if (!this.currentUserId) {
      console.error('[MultiplayerGamesManager] CRITICAL: Cannot submit answer - currentUserId is null!');
      console.error('[MultiplayerGamesManager] This means initialize() was not called or user is not authenticated');
      console.error('[MultiplayerGamesManager] Game session:', this.currentGameSession.id);
      return;
    }

    const currentQuestion = this.currentGame['state'].currentQuestion;
    if (!currentQuestion) {
      console.warn('[MultiplayerGamesManager] Cannot submit answer: No current question');
      return;
    }

    console.log(`[MultiplayerGamesManager] Submitting answer for user ${this.currentUserId}:`, {
      gameSessionId: this.currentGameSession.id,
      questionId: currentQuestion.id,
      answer,
      timeTakenMs,
    });

    try {
      const result = await window.scribeCat.games.submitAnswer({
        gameSessionId: this.currentGameSession.id,
        userId: this.currentUserId,
        questionId: currentQuestion.id,
        answer,
        timeTakenMs,
      });

      if (result.success) {
        console.log(`[MultiplayerGamesManager] Answer submitted successfully for user ${this.currentUserId}`);
        console.log('[DEBUG MultiplayerGamesManager] Submit result:', result);
        console.log('[DEBUG MultiplayerGamesManager] Score data:', result.score);
        console.log('[DEBUG MultiplayerGamesManager] isCorrect:', result.score?.isCorrect);

        this.currentGame.updateState({ hasAnswered: true });

        // Fetch correct answer details to show individual reveal
        const correctAnswerResult = await window.scribeCat.games.getCorrectAnswer({
          gameSessionId: this.currentGameSession.id,
          questionId: currentQuestion.id,
          userId: this.currentUserId,
        });

        console.log('[DEBUG MultiplayerGamesManager] getCorrectAnswer result:', correctAnswerResult);

        if (correctAnswerResult.success && correctAnswerResult.result) {
          // Emit event with correct answer data and player's result
          window.dispatchEvent(
            new CustomEvent('game:answer-reveal', {
              detail: {
                correctAnswerIndex: correctAnswerResult.result.correctAnswerIndex,
                explanation: correctAnswerResult.result.explanation,
                wasCorrect: result.score?.isCorrect || false,
              },
            })
          );
          console.log('[MultiplayerGamesManager] Answer reveal data emitted:', {
            correctAnswerIndex: correctAnswerResult.result.correctAnswerIndex,
            wasCorrect: result.score?.isCorrect,
          });
        } else {
          console.log('[DEBUG MultiplayerGamesManager] getCorrectAnswer failed or returned null:', correctAnswerResult);
        }
      } else {
        console.error('[MultiplayerGamesManager] Answer submission failed:', result.error);
      }
    } catch (error) {
      console.error('[MultiplayerGamesManager] Exception while submitting answer:', error);
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

      // For Jeopardy, set the initial current player (first participant)
      if (this.currentGameSession.gameType === 'jeopardy' && this.currentParticipants.length > 0) {
        const firstPlayer = this.currentParticipants[0];
        console.log('[MultiplayerGamesManager] Setting initial Jeopardy player:', firstPlayer.userName);

        await window.scribeCat.games.jeopardy.setCurrentPlayer({
          gameSessionId: this.currentGameSession.id,
          userId: firstPlayer.userId,
        });
      }

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
   * Handle bingo - when a player achieves bingo
   * Completes the game and shows winner
   */
  private async handleBingo(event: Event): Promise<void> {
    if (!this.currentGameSession || !this.currentUserId) return;

    const customEvent = event as CustomEvent<{ userId: string }>;
    const { userId } = customEvent.detail;

    console.log('[MultiplayerGamesManager] BINGO achieved by user:', userId);

    try {
      // Complete the game
      const result = await window.scribeCat.games.completeGame(this.currentGameSession.id);

      if (!result.success) {
        console.error('[MultiplayerGamesManager] Failed to complete game:', result.error);
        return;
      }

      console.log('[MultiplayerGamesManager] Game completed due to BINGO');
      // State update will happen via real-time subscription
    } catch (error) {
      console.error('[MultiplayerGamesManager] Exception in handleBingo:', error);
    }
  }

  /**
   * Handle questions ready (async question generation completed)
   */
  private async handleQuestionsReady(event: Event): Promise<void> {
    if (!this.currentGameSession || !this.currentGame) return;

    const customEvent = event as CustomEvent<{ gameSessionId: string }>;
    const { gameSessionId } = customEvent.detail;

    // Only process if this is for the current game
    if (gameSessionId !== this.currentGameSession.id) return;

    console.log('[MultiplayerGamesManager] Questions ready for game:', gameSessionId);

    try {
      if (this.currentGameSession.gameType === 'jeopardy') {
        // For Jeopardy: Reload the board (don't load a question)
        console.log('[MultiplayerGamesManager] Jeopardy questions ready - reloading board...');
        const boardResult = await window.scribeCat.games.jeopardy.getBoard(gameSessionId);

        if (boardResult.success && boardResult.board) {
          console.log('[MultiplayerGamesManager] Board reloaded with', boardResult.board.length, 'questions');
          // Update Jeopardy game with the board
          (this.currentGame as any).updateState({
            board: boardResult.board,
            questionsReady: true,
          });
        }
      } else {
        // For other games: Fetch the first question
        const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);

        if (questionResult.success && questionResult.question) {
          const currentQuestion = GameQuestion.fromJSON(questionResult.question);

          // Update game state to show questions are ready
          this.currentGame.updateState({
            currentQuestion,
            questionsReady: true,
          });

          console.log('[MultiplayerGamesManager] Questions loaded - Start button now enabled');
        }
      }
    } catch (error) {
      console.error('[MultiplayerGamesManager] Exception in handleQuestionsReady:', error);
    }
  }

  /**
   * Handle Jeopardy question answered - manages turn rotation
   */
  private async handleJeopardyQuestionAnswered(event: Event): Promise<void> {
    if (!this.currentGameSession || !this.currentUserId) return;

    const customEvent = event as CustomEvent<{
      userId: string;
      isCorrect: boolean;
      wasFirstBuzzer: boolean;
    }>;
    const { userId, isCorrect, wasFirstBuzzer } = customEvent.detail;

    console.log('[MultiplayerGamesManager] Jeopardy question answered:', { userId, isCorrect, wasFirstBuzzer });

    try {
      // If the first buzzer answered correctly, they select the next question
      if (wasFirstBuzzer && isCorrect) {
        console.log('[MultiplayerGamesManager] Correct answer - player selects next');
        // Player already set as current in JeopardyGame component
        return;
      }

      // If wrong answer or no correct answer, set lowest scoring player as current
      if (!isCorrect) {
        console.log('[MultiplayerGamesManager] Wrong answer - finding lowest scoring player');

        const lowestResult = await window.scribeCat.games.jeopardy.getLowestScoringPlayer(
          this.currentGameSession.id
        );

        if (lowestResult.success && lowestResult.userId) {
          await window.scribeCat.games.jeopardy.setCurrentPlayer({
            gameSessionId: this.currentGameSession.id,
            userId: lowestResult.userId,
          });

          console.log('[MultiplayerGamesManager] Lowest scoring player set as current');
        }
      }
    } catch (error) {
      console.error('[MultiplayerGamesManager] Exception in handleJeopardyQuestionAnswered:', error);
    }
  }

  /**
   * Handle Jeopardy board complete - advance to Final Jeopardy
   */
  private async handleJeopardyBoardComplete(event: Event): Promise<void> {
    if (!this.currentGameSession) return;

    console.log('[MultiplayerGamesManager] Jeopardy board complete - checking for Final Jeopardy');

    try {
      // Check if board is really complete
      const completeResult = await window.scribeCat.games.jeopardy.isBoardComplete(
        this.currentGameSession.id
      );

      if (completeResult.success && completeResult.isComplete) {
        console.log('[MultiplayerGamesManager] Advancing to Final Jeopardy');

        // Advance to Final Jeopardy
        await window.scribeCat.games.jeopardy.advanceToFinal(this.currentGameSession.id);

        // State update will happen via real-time subscription
        console.log('[MultiplayerGamesManager] Final Jeopardy initiated');
      }
    } catch (error) {
      console.error('[MultiplayerGamesManager] Exception in handleJeopardyBoardComplete:', error);
    }
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

          // Fetch the current question (Jeopardy-aware logic)
          let currentQuestion: GameQuestion | null = null;
          let jeopardyBoardUpdate: any = null;

          if (gameSession.gameType === 'jeopardy') {
            const selectedQuestionId = gameSession.selectedQuestionId;
            if (selectedQuestionId) {
              console.log('[MultiplayerGamesManager] Waiting poll: Jeopardy game with selected question:', selectedQuestionId);
              const questionResult = await window.scribeCat.games.getGameQuestion(gameSessionId, selectedQuestionId);
              currentQuestion = questionResult.success && questionResult.question
                ? GameQuestion.fromJSON(questionResult.question)
                : null;
            } else {
              console.log('[MultiplayerGamesManager] Waiting poll: Jeopardy game, no question selected yet - reloading board');
              // Reload board when game starts (for participants who joined before questions were created)
              const boardResult = await window.scribeCat.games.jeopardy.getBoard(gameSessionId);
              if (boardResult.success && boardResult.board && boardResult.board.length > 0) {
                console.log('[MultiplayerGamesManager] Waiting poll: Board reloaded with', boardResult.board.length, 'questions');
                jeopardyBoardUpdate = boardResult.board;
              }
            }
          } else {
            // Other games use sequential question index
            const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);
            currentQuestion = questionResult.success && questionResult.question
              ? GameQuestion.fromJSON(questionResult.question)
              : null;
          }

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

            // Update Jeopardy-specific state
            if (gameSession.gameType === 'jeopardy') {
              const jeopardyUpdates: any = {
                selectedQuestionId: gameSession.selectedQuestionId || null,
                currentPlayerId: gameSession.currentPlayerId || null,
                round: gameSession.round || 'regular',
              };

              // Add board if we loaded it
              if (jeopardyBoardUpdate) {
                jeopardyUpdates.board = jeopardyBoardUpdate;
                jeopardyUpdates.questionsReady = true;
              }

              (this.currentGame as any).updateState(jeopardyUpdates);
            }

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

        // Determine what changed based on game type
        const isJeopardy = gameSession.gameType === 'jeopardy';
        let questionChanged = false;

        if (isJeopardy) {
          // For Jeopardy: Check if selectedQuestionId changed
          const previousSelectedId = this.currentGameSession.selectedQuestionId;
          const newSelectedId = gameSession.selectedQuestionId;
          questionChanged = newSelectedId !== previousSelectedId;
          if (questionChanged) {
            console.log(`[MultiplayerGamesManager] Question poll detected Jeopardy question change: ${previousSelectedId} -> ${newSelectedId}`);
          }
        } else {
          // For other games: Check if question index changed
          const previousIndex = this.currentGameSession.currentQuestionIndex;
          const newIndex = gameSession.currentQuestionIndex;
          questionChanged = newIndex !== previousIndex;
          if (questionChanged) {
            console.log(`[MultiplayerGamesManager] Question poll detected index change: ${previousIndex} -> ${newIndex}`);
          }
        }

        // If question changed, fetch the new question
        if (questionChanged) {
          this.currentGameSession = gameSession;

          let currentQuestion: GameQuestion | null = null;
          if (isJeopardy) {
            const selectedQuestionId = gameSession.selectedQuestionId;
            if (selectedQuestionId) {
              const questionResult = await window.scribeCat.games.getGameQuestion(gameSessionId, selectedQuestionId);
              currentQuestion = questionResult.success && questionResult.question
                ? GameQuestion.fromJSON(questionResult.question)
                : null;
            }
          } else {
            const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);
            currentQuestion = questionResult.success && questionResult.question
              ? GameQuestion.fromJSON(questionResult.question)
              : null;
          }

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

            // Update Jeopardy-specific state
            if (isJeopardy) {
              (this.currentGame as any).updateState({
                selectedQuestionId: gameSession.selectedQuestionId || null,
                currentPlayerId: gameSession.currentPlayerId || null,
                round: gameSession.round || 'regular',
              });
            }
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
    window.removeEventListener('game:bingo', this.boundHandleBingo);
    window.removeEventListener('game:questions-ready', this.boundHandleQuestionsReady);

    // Remove Jeopardy-specific event listeners
    window.removeEventListener('game:jeopardy:question-answered', this.boundHandleJeopardyQuestionAnswered);
    window.removeEventListener('game:jeopardy:board-complete', this.boundHandleJeopardyBoardComplete);
  }
}
