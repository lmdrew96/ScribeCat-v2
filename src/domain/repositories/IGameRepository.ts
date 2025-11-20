/**
 * Game Repository Interface
 * Defines operations for managing multiplayer game sessions, questions, and scores
 */

import { GameSession, GameType, GameConfig, GameStatus } from '../entities/GameSession.js';
import { GameQuestion } from '../entities/GameQuestion.js';
import { PlayerScore, LeaderboardEntry } from '../entities/PlayerScore.js';

// ============================================================================
// Parameter Interfaces
// ============================================================================

export interface CreateGameSessionParams {
  roomId: string;
  gameType: GameType;
  config: GameConfig;
}

export interface UpdateGameSessionParams {
  gameSessionId: string;
  status?: GameStatus;
  currentQuestionIndex?: number;
}

export interface CreateGameQuestionParams {
  gameSessionId: string;
  questionIndex: number;
  questionData: {
    question: string;
    options?: string[];
    questionType?: string;
    explanation?: string;
    imageUrl?: string;
    metadata?: Record<string, unknown>;
  };
  correctAnswer: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  points: number;
  timeLimitSeconds: number;
}

export interface SubmitAnswerParams {
  gameSessionId: string;
  userId: string;
  questionId: string;
  answer: string;
  timeTakenMs: number;
}

// ============================================================================
// Repository Interface
// ============================================================================

export interface IGameRepository {
  // ============================================================================
  // Game Session Operations
  // ============================================================================

  /**
   * Create a new game session
   */
  createGameSession(params: CreateGameSessionParams): Promise<GameSession>;

  /**
   * Get a game session by ID
   */
  getGameSession(gameSessionId: string): Promise<GameSession | null>;

  /**
   * Get the active game for a room
   */
  getActiveGameForRoom(roomId: string): Promise<GameSession | null>;

  /**
   * Update a game session
   */
  updateGameSession(params: UpdateGameSessionParams): Promise<GameSession>;

  /**
   * Start a game (change status to in_progress)
   */
  startGame(gameSessionId: string): Promise<GameSession>;

  /**
   * Complete a game (change status to completed)
   */
  completeGame(gameSessionId: string): Promise<GameSession>;

  /**
   * Cancel a game (change status to cancelled)
   */
  cancelGame(gameSessionId: string): Promise<GameSession>;

  /**
   * Move to the next question
   */
  nextQuestion(gameSessionId: string): Promise<GameSession>;

  // ============================================================================
  // Game Question Operations
  // ============================================================================

  /**
   * Create a game question
   */
  createGameQuestion(params: CreateGameQuestionParams): Promise<GameQuestion>;

  /**
   * Create multiple game questions in bulk
   */
  createGameQuestions(questions: CreateGameQuestionParams[]): Promise<GameQuestion[]>;

  /**
   * Get a game question by ID
   */
  getGameQuestion(questionId: string, includeAnswer: boolean): Promise<GameQuestion | null>;

  /**
   * Get all questions for a game session
   */
  getGameQuestions(gameSessionId: string, includeAnswers: boolean): Promise<GameQuestion[]>;

  /**
   * Get the current question for a game
   */
  getCurrentQuestion(gameSessionId: string): Promise<GameQuestion | null>;

  /**
   * Reveal a question (set revealed_at timestamp)
   */
  revealQuestion(questionId: string): Promise<GameQuestion>;

  // ============================================================================
  // Player Score Operations
  // ============================================================================

  /**
   * Submit a player's answer
   */
  submitAnswer(params: SubmitAnswerParams): Promise<PlayerScore>;

  /**
   * Get a player's score for a specific question
   */
  getPlayerScore(gameSessionId: string, userId: string, questionId: string): Promise<PlayerScore | null>;

  /**
   * Get all scores for a player in a game
   */
  getPlayerScores(gameSessionId: string, userId: string): Promise<PlayerScore[]>;

  /**
   * Get all scores for a specific question
   */
  getQuestionScores(questionId: string): Promise<PlayerScore[]>;

  /**
   * Get player's total score for a game
   */
  getPlayerTotalScore(gameSessionId: string, userId: string): Promise<number>;

  /**
   * Get leaderboard for a game
   */
  getGameLeaderboard(gameSessionId: string): Promise<LeaderboardEntry[]>;

  // ============================================================================
  // Real-time Subscriptions
  // ============================================================================

  /**
   * Subscribe to game session updates
   */
  subscribeToGameSession(
    gameSessionId: string,
    onUpdate: (gameSession: GameSession) => void
  ): () => Promise<void>;

  /**
   * Subscribe to new questions in a game
   */
  subscribeToGameQuestions(
    gameSessionId: string,
    onQuestion: (question: GameQuestion) => void
  ): () => Promise<void>;

  /**
   * Subscribe to player scores in a game
   */
  subscribeToGameScores(
    gameSessionId: string,
    onScore: (score: PlayerScore) => void
  ): () => Promise<void>;

  /**
   * Unsubscribe from all game subscriptions
   */
  unsubscribeAll(): Promise<void>;
}
