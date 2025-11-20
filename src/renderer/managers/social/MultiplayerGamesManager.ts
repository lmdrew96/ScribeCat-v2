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

export class MultiplayerGamesManager {
  private currentGame: MultiplayerGame | null = null;
  private currentGameSession: GameSession | null = null;
  private currentUserId: string | null = null;
  private unsubscribers: Array<() => void> = [];

  /**
   * Initialize manager with current user
   */
  public initialize(userId: string): void {
    this.currentUserId = userId;
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
   * Start a game
   */
  public async startGame(
    gameSessionId: string,
    container: HTMLElement,
    participants: GameParticipant[]
  ): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('Games manager not initialized');
    }

    // Update game status to in_progress
    const result = await window.scribeCat.games.startGame(gameSessionId);

    if (!result.success || !result.gameSession) {
      throw new Error(result.error || 'Failed to start game');
    }

    this.currentGameSession = GameSession.fromJSON(result.gameSession);
    console.log('Game session status:', this.currentGameSession.status);
    console.log('Current question index:', this.currentGameSession.currentQuestionIndex);

    // Load first question
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
    const gameState: GameState = {
      session: this.currentGameSession,
      currentQuestion,
      participants,
      scores: [],
      leaderboard,
      currentUserId: this.currentUserId,
      hasAnswered: false,
      gameStarted: true,
      gameEnded: false,
    };

    console.log('Initializing game with state:', {
      hasSession: !!gameState.session,
      hasQuestion: !!gameState.currentQuestion,
      participantCount: gameState.participants.length,
      gameType: this.currentGameSession.gameType
    });

    // Initialize game component based on type
    this.currentGame = this.createGameComponent(
      this.currentGameSession.gameType,
      container,
      gameState
    );

    await this.currentGame.initialize();

    // Subscribe to game updates
    this.subscribeToGameUpdates(gameSessionId);

    // Setup game event listeners
    this.setupGameEventListeners();
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
      (sessionData) => {
        const gameSession = GameSession.fromJSON(sessionData);
        this.currentGameSession = gameSession;

        if (this.currentGame) {
          this.currentGame.updateState({
            session: gameSession,
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
   */
  private setupGameEventListeners(): void {
    // Handle answer submissions
    window.addEventListener('game:answer', this.handleAnswerSubmit.bind(this));

    // Handle game start (from waiting screen)
    window.addEventListener('game:start', this.handleGameStart.bind(this));

    // Handle game close
    window.addEventListener('game:close', this.handleGameClose.bind(this));

    // Handle next question
    window.addEventListener('game:next-question', this.handleNextQuestion.bind(this));
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
   * Handle game start
   */
  private async handleGameStart(event: Event): Promise<void> {
    // This is called from the waiting screen
    // The host will start the game via the StudyRoomView
  }

  /**
   * Handle game close
   */
  private async handleGameClose(event: Event): Promise<void> {
    await this.cleanup();

    // Emit event to notify StudyRoomView
    const closeEvent = new CustomEvent('multiplayer-game:closed');
    window.dispatchEvent(closeEvent);
  }

  /**
   * Handle next question
   */
  private async handleNextQuestion(event: Event): Promise<void> {
    if (!this.currentGameSession) return;

    try {
      const result = await window.scribeCat.games.nextQuestion(this.currentGameSession.id);

      if (result.success) {
        // Game session will be updated via real-time subscription
        // Then fetch the new current question
        const questionResult = await window.scribeCat.games.getCurrentQuestion(
          this.currentGameSession.id
        );

        if (questionResult.success && questionResult.question && this.currentGame) {
          this.currentGame.updateState({
            currentQuestion: GameQuestion.fromJSON(questionResult.question),
            hasAnswered: false,
          });
        }
      }
    } catch (error) {
      console.error('Failed to advance to next question:', error);
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
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
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

    this.currentGameSession = null;

    // Remove event listeners
    window.removeEventListener('game:answer', this.handleAnswerSubmit.bind(this));
    window.removeEventListener('game:start', this.handleGameStart.bind(this));
    window.removeEventListener('game:close', this.handleGameClose.bind(this));
    window.removeEventListener('game:next-question', this.handleNextQuestion.bind(this));
  }
}
