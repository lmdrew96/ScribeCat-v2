/**
 * GameSession Entity
 *
 * Represents a multiplayer game session within a study room.
 * Supports Quiz Battle, Jeopardy, Bingo, and Collaborative Flashcards.
 */

export type GameType = 'quiz_battle' | 'jeopardy' | 'bingo' | 'flashcards';
export type GameStatus = 'waiting' | 'in_progress' | 'completed' | 'cancelled';

export interface GameConfig {
  questionCount?: number;
  categories?: string[];
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  timePerQuestion?: number; // seconds
  pointsPerQuestion?: number;
  teamMode?: boolean; // for Jeopardy
  bingoGridSize?: number; // for Bingo (e.g., 5 for 5x5)
}

export interface GameSessionData {
  readonly id: string;
  readonly roomId: string;
  readonly gameType: GameType;
  readonly status: GameStatus;
  readonly config: GameConfig;
  readonly currentQuestionIndex: number;
  readonly startedAt?: Date;
  readonly endedAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * GameSession domain entity
 */
export class GameSession {
  constructor(private readonly data: GameSessionData) {}

  /**
   * Create GameSession from database row
   */
  static fromDatabase(row: {
    id: string;
    room_id: string;
    game_type: string;
    status: string;
    config: unknown;
    current_question_index: number;
    started_at?: string | Date | null;
    ended_at?: string | Date | null;
    created_at: string | Date;
    updated_at: string | Date;
  }): GameSession {
    return new GameSession({
      id: row.id,
      roomId: row.room_id,
      gameType: row.game_type as GameType,
      status: row.status as GameStatus,
      config: (row.config as GameConfig) || {},
      currentQuestionIndex: row.current_question_index,
      startedAt: row.started_at
        ? typeof row.started_at === 'string'
          ? new Date(row.started_at)
          : row.started_at
        : undefined,
      endedAt: row.ended_at
        ? typeof row.ended_at === 'string'
          ? new Date(row.ended_at)
          : row.ended_at
        : undefined,
      createdAt: typeof row.created_at === 'string' ? new Date(row.created_at) : row.created_at,
      updatedAt: typeof row.updated_at === 'string' ? new Date(row.updated_at) : row.updated_at,
    });
  }

  /**
   * Create GameSession from JSON (camelCase format from toJSON/IPC)
   */
  static fromJSON(data: GameSessionData): GameSession {
    return new GameSession({
      ...data,
      startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
      endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    });
  }

  /**
   * Get game session data as JSON
   */
  toJSON(): GameSessionData {
    return { ...this.data };
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get id(): string {
    return this.data.id;
  }

  get roomId(): string {
    return this.data.roomId;
  }

  get gameType(): GameType {
    return this.data.gameType;
  }

  get status(): GameStatus {
    return this.data.status;
  }

  get config(): GameConfig {
    return this.data.config;
  }

  get currentQuestionIndex(): number {
    return this.data.currentQuestionIndex;
  }

  get startedAt(): Date | undefined {
    return this.data.startedAt;
  }

  get endedAt(): Date | undefined {
    return this.data.endedAt;
  }

  get createdAt(): Date {
    return this.data.createdAt;
  }

  get updatedAt(): Date {
    return this.data.updatedAt;
  }

  // ============================================================================
  // Business Logic
  // ============================================================================

  /**
   * Check if game is waiting for players
   */
  isWaiting(): boolean {
    return this.data.status === 'waiting';
  }

  /**
   * Check if game is currently in progress
   */
  isInProgress(): boolean {
    return this.data.status === 'in_progress';
  }

  /**
   * Check if game is completed
   */
  isCompleted(): boolean {
    return this.data.status === 'completed';
  }

  /**
   * Check if game is cancelled
   */
  isCancelled(): boolean {
    return this.data.status === 'cancelled';
  }

  /**
   * Check if game is active (waiting or in progress)
   */
  isActive(): boolean {
    return this.isWaiting() || this.isInProgress();
  }

  /**
   * Check if game has ended (completed or cancelled)
   */
  hasEnded(): boolean {
    return this.isCompleted() || this.isCancelled();
  }

  /**
   * Get game type display name
   */
  getGameTypeName(): string {
    const names: Record<GameType, string> = {
      quiz_battle: 'Quiz Battle',
      jeopardy: 'Jeopardy',
      bingo: 'Study Bingo',
      flashcards: 'Collaborative Flashcards',
    };
    return names[this.data.gameType] || 'Unknown Game';
  }

  /**
   * Get game status display text
   */
  getStatusText(): string {
    const texts: Record<GameStatus, string> = {
      waiting: 'Waiting for players...',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return texts[this.data.status] || 'Unknown';
  }

  /**
   * Get game duration in milliseconds
   */
  getDuration(): number | null {
    if (!this.data.startedAt) return null;
    const endTime = this.data.endedAt || new Date();
    return endTime.getTime() - this.data.startedAt.getTime();
  }

  /**
   * Get formatted game duration
   */
  getFormattedDuration(): string {
    const duration = this.getDuration();
    if (duration === null) return 'Not started';

    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Get total question count from config
   */
  getTotalQuestions(): number {
    return this.data.config.questionCount || 10;
  }

  /**
   * Get progress percentage (0-100)
   */
  getProgressPercentage(): number {
    const total = this.getTotalQuestions();
    if (total === 0) return 0;
    return Math.floor((this.data.currentQuestionIndex / total) * 100);
  }

  /**
   * Check if this is the last question
   */
  isLastQuestion(): boolean {
    return this.data.currentQuestionIndex >= this.getTotalQuestions() - 1;
  }

  /**
   * Check if game has more questions
   */
  hasMoreQuestions(): boolean {
    return this.data.currentQuestionIndex < this.getTotalQuestions() - 1;
  }

  /**
   * Validate game config
   */
  static validateConfig(gameType: GameType, config: GameConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Common validations
    if (config.questionCount !== undefined) {
      if (config.questionCount < 1) {
        errors.push('Question count must be at least 1');
      }
      if (config.questionCount > 50) {
        errors.push('Question count cannot exceed 50');
      }
    }

    if (config.timePerQuestion !== undefined) {
      if (config.timePerQuestion < 5) {
        errors.push('Time per question must be at least 5 seconds');
      }
      if (config.timePerQuestion > 300) {
        errors.push('Time per question cannot exceed 5 minutes');
      }
    }

    if (config.pointsPerQuestion !== undefined) {
      if (config.pointsPerQuestion < 10) {
        errors.push('Points per question must be at least 10');
      }
      if (config.pointsPerQuestion > 1000) {
        errors.push('Points per question cannot exceed 1000');
      }
    }

    // Game-specific validations
    if (gameType === 'bingo') {
      if (config.bingoGridSize !== undefined) {
        if (config.bingoGridSize < 3 || config.bingoGridSize > 7) {
          errors.push('Bingo grid size must be between 3 and 7');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate game session data
   */
  static validate(data: Partial<GameSessionData>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.roomId) {
      errors.push('Room ID is required');
    }

    if (!data.gameType) {
      errors.push('Game type is required');
    } else if (!['quiz_battle', 'jeopardy', 'bingo', 'flashcards'].includes(data.gameType)) {
      errors.push('Invalid game type');
    }

    if (data.gameType && data.config) {
      const configValidation = GameSession.validateConfig(data.gameType as GameType, data.config);
      errors.push(...configValidation.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
