/**
 * GameQuestion Entity
 *
 * Represents a single question in a multiplayer game session.
 * Contains question text, options, correct answer, and metadata.
 */

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestionData {
  question: string;
  options?: string[]; // For multiple choice (quiz, jeopardy)
  questionType?: 'multiple_choice' | 'true_false' | 'short_answer' | 'flashcard' | 'bingo_item';
  explanation?: string; // Shown after answering
  imageUrl?: string; // Optional image for visual questions
  metadata?: Record<string, unknown>; // Game-specific data
}

export interface GameQuestionData {
  readonly id: string;
  readonly gameSessionId: string;
  readonly questionIndex: number;
  readonly questionData: QuestionData;
  readonly correctAnswer: string;
  readonly category?: string;
  readonly difficulty?: QuestionDifficulty;
  readonly points: number;
  readonly timeLimitSeconds: number;
  readonly revealedAt?: Date;
  readonly createdAt: Date;
}

/**
 * GameQuestion domain entity
 */
export class GameQuestion {
  constructor(private readonly data: GameQuestionData) {}

  /**
   * Create GameQuestion from database row
   */
  static fromDatabase(row: {
    id: string;
    game_session_id: string;
    question_index: number;
    question_data: unknown;
    correct_answer: string;
    category?: string | null;
    difficulty?: string | null;
    points: number;
    time_limit_seconds: number;
    revealed_at?: string | Date | null;
    created_at: string | Date;
  }): GameQuestion {
    return new GameQuestion({
      id: row.id,
      gameSessionId: row.game_session_id,
      questionIndex: row.question_index,
      questionData: (row.question_data as QuestionData) || { question: '' },
      correctAnswer: row.correct_answer,
      category: row.category || undefined,
      difficulty: (row.difficulty as QuestionDifficulty) || undefined,
      points: row.points,
      timeLimitSeconds: row.time_limit_seconds,
      revealedAt: row.revealed_at
        ? typeof row.revealed_at === 'string'
          ? new Date(row.revealed_at)
          : row.revealed_at
        : undefined,
      createdAt: typeof row.created_at === 'string' ? new Date(row.created_at) : row.created_at,
    });
  }

  /**
   * Create GameQuestion from JSON (camelCase format from toJSON/IPC)
   */
  static fromJSON(data: GameQuestionData | (Omit<GameQuestionData, 'correctAnswer'> & { correctAnswer?: string })): GameQuestion {
    return new GameQuestion({
      ...data,
      correctAnswer: data.correctAnswer || '',
      revealedAt: data.revealedAt ? new Date(data.revealedAt) : undefined,
      createdAt: new Date(data.createdAt),
    } as GameQuestionData);
  }

  /**
   * Get question data as JSON
   */
  toJSON(): GameQuestionData {
    return { ...this.data };
  }

  /**
   * Get question data for client (without correct answer during active game)
   */
  toClientJSON(includeAnswer: boolean = false): Omit<GameQuestionData, 'correctAnswer'> & { correctAnswer?: string } {
    const json = this.toJSON();
    if (!includeAnswer) {
      const { correctAnswer, ...rest } = json;
      return rest;
    }
    return json;
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get id(): string {
    return this.data.id;
  }

  get gameSessionId(): string {
    return this.data.gameSessionId;
  }

  get questionIndex(): number {
    return this.data.questionIndex;
  }

  get questionData(): QuestionData {
    return this.data.questionData;
  }

  get correctAnswer(): string {
    return this.data.correctAnswer;
  }

  get category(): string | undefined {
    return this.data.category;
  }

  get difficulty(): QuestionDifficulty | undefined {
    return this.data.difficulty;
  }

  get points(): number {
    return this.data.points;
  }

  get timeLimitSeconds(): number {
    return this.data.timeLimitSeconds;
  }

  get revealedAt(): Date | undefined {
    return this.data.revealedAt;
  }

  get createdAt(): Date {
    return this.data.createdAt;
  }

  // ============================================================================
  // Business Logic
  // ============================================================================

  /**
   * Get question text
   */
  getQuestionText(): string {
    return this.data.questionData.question;
  }

  /**
   * Get question options (for multiple choice)
   */
  getOptions(): string[] {
    return this.data.questionData.options || [];
  }

  /**
   * Check if question has options
   */
  hasOptions(): boolean {
    return !!this.data.questionData.options && this.data.questionData.options.length > 0;
  }

  /**
   * Get question type
   */
  getQuestionType(): string {
    return this.data.questionData.questionType || 'multiple_choice';
  }

  /**
   * Check if answer is correct
   */
  isCorrectAnswer(answer: string): boolean {
    // Normalize both strings for comparison (trim, lowercase)
    const normalizedAnswer = answer.trim().toLowerCase();
    const normalizedCorrect = this.data.correctAnswer.trim().toLowerCase();

    // For multiple choice, do exact match
    if (this.hasOptions()) {
      return normalizedAnswer === normalizedCorrect;
    }

    // For short answer, check if it contains the correct answer
    return normalizedAnswer === normalizedCorrect || normalizedAnswer.includes(normalizedCorrect);
  }

  /**
   * Check if question has been revealed
   */
  isRevealed(): boolean {
    return !!this.data.revealedAt;
  }

  /**
   * Get time remaining since reveal (in milliseconds)
   */
  getTimeRemaining(): number | null {
    if (!this.data.revealedAt) return null;

    const elapsed = Date.now() - this.data.revealedAt.getTime();
    const timeLimit = this.data.timeLimitSeconds * 1000;
    const remaining = timeLimit - elapsed;

    return Math.max(0, remaining);
  }

  /**
   * Check if time has expired
   */
  hasTimeExpired(): boolean {
    const remaining = this.getTimeRemaining();
    return remaining !== null && remaining === 0;
  }

  /**
   * Get difficulty display text
   */
  getDifficultyText(): string {
    if (!this.data.difficulty) return 'Unknown';

    const texts: Record<QuestionDifficulty, string> = {
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
    };

    return texts[this.data.difficulty] || 'Unknown';
  }

  /**
   * Get difficulty color class
   */
  getDifficultyColor(): string {
    if (!this.data.difficulty) return 'gray';

    const colors: Record<QuestionDifficulty, string> = {
      easy: 'green',
      medium: 'yellow',
      hard: 'red',
    };

    return colors[this.data.difficulty] || 'gray';
  }

  /**
   * Calculate points based on time taken and difficulty
   */
  calculatePoints(timeTakenMs: number): number {
    const basePoints = this.data.points;

    // Bonus for speed (up to 50% bonus for answering in first 25% of time)
    const timeLimit = this.data.timeLimitSeconds * 1000;
    const speedRatio = timeTakenMs / timeLimit;

    let speedBonus = 0;
    if (speedRatio < 0.25) {
      speedBonus = basePoints * 0.5; // 50% bonus
    } else if (speedRatio < 0.5) {
      speedBonus = basePoints * 0.25; // 25% bonus
    } else if (speedRatio < 0.75) {
      speedBonus = basePoints * 0.1; // 10% bonus
    }

    return Math.round(basePoints + speedBonus);
  }

  /**
   * Get explanation text (shown after answering)
   */
  getExplanation(): string | undefined {
    return this.data.questionData.explanation;
  }

  /**
   * Check if question has an explanation
   */
  hasExplanation(): boolean {
    return !!this.data.questionData.explanation;
  }

  /**
   * Validate question data
   */
  static validate(data: Partial<GameQuestionData>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.gameSessionId) {
      errors.push('Game session ID is required');
    }

    if (data.questionIndex === undefined || data.questionIndex < 0) {
      errors.push('Question index must be a non-negative number');
    }

    if (!data.questionData) {
      errors.push('Question data is required');
    } else {
      if (!data.questionData.question || data.questionData.question.trim().length === 0) {
        errors.push('Question text is required');
      }

      if (data.questionData.question && data.questionData.question.length > 1000) {
        errors.push('Question text must be 1000 characters or less');
      }

      if (data.questionData.options) {
        if (data.questionData.options.length < 2) {
          errors.push('Multiple choice questions must have at least 2 options');
        }
        if (data.questionData.options.length > 6) {
          errors.push('Multiple choice questions cannot have more than 6 options');
        }
      }
    }

    if (!data.correctAnswer || data.correctAnswer.trim().length === 0) {
      errors.push('Correct answer is required');
    }

    if (data.points !== undefined) {
      if (data.points < 0) {
        errors.push('Points must be non-negative');
      }
      if (data.points > 10000) {
        errors.push('Points cannot exceed 10000');
      }
    }

    if (data.timeLimitSeconds !== undefined) {
      if (data.timeLimitSeconds < 5) {
        errors.push('Time limit must be at least 5 seconds');
      }
      if (data.timeLimitSeconds > 300) {
        errors.push('Time limit cannot exceed 5 minutes');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
