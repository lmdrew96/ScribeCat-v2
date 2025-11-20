/**
 * PlayerScore Entity
 *
 * Represents a player's answer and score for a specific question in a game.
 * Tracks answer correctness, points earned, and time taken.
 */

export interface PlayerScoreData {
  readonly id: string;
  readonly gameSessionId: string;
  readonly userId: string;
  readonly questionId: string;
  readonly answer?: string;
  readonly isCorrect?: boolean;
  readonly pointsEarned: number;
  readonly timeTakenMs?: number;
  readonly answeredAt: Date;
  readonly createdAt: Date;
}

/**
 * PlayerScore domain entity
 */
export class PlayerScore {
  constructor(private readonly data: PlayerScoreData) {}

  /**
   * Create PlayerScore from database row
   */
  static fromDatabase(row: {
    id: string;
    game_session_id: string;
    user_id: string;
    question_id: string;
    answer?: string | null;
    is_correct?: boolean | null;
    points_earned: number;
    time_taken_ms?: number | null;
    answered_at: string | Date;
    created_at: string | Date;
  }): PlayerScore {
    return new PlayerScore({
      id: row.id,
      gameSessionId: row.game_session_id,
      userId: row.user_id,
      questionId: row.question_id,
      answer: row.answer || undefined,
      isCorrect: row.is_correct ?? undefined,
      pointsEarned: row.points_earned,
      timeTakenMs: row.time_taken_ms ?? undefined,
      answeredAt: typeof row.answered_at === 'string' ? new Date(row.answered_at) : row.answered_at,
      createdAt: typeof row.created_at === 'string' ? new Date(row.created_at) : row.created_at,
    });
  }

  /**
   * Get player score data as JSON
   */
  toJSON(): PlayerScoreData {
    return { ...this.data };
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

  get userId(): string {
    return this.data.userId;
  }

  get questionId(): string {
    return this.data.questionId;
  }

  get answer(): string | undefined {
    return this.data.answer;
  }

  get isCorrect(): boolean | undefined {
    return this.data.isCorrect;
  }

  get pointsEarned(): number {
    return this.data.pointsEarned;
  }

  get timeTakenMs(): number | undefined {
    return this.data.timeTakenMs;
  }

  get answeredAt(): Date {
    return this.data.answeredAt;
  }

  get createdAt(): Date {
    return this.data.createdAt;
  }

  // ============================================================================
  // Business Logic
  // ============================================================================

  /**
   * Check if answer was correct
   */
  wasCorrect(): boolean {
    return this.data.isCorrect === true;
  }

  /**
   * Check if answer was wrong
   */
  wasWrong(): boolean {
    return this.data.isCorrect === false;
  }

  /**
   * Check if answer has been graded
   */
  isGraded(): boolean {
    return this.data.isCorrect !== undefined;
  }

  /**
   * Get formatted time taken
   */
  getFormattedTimeTaken(): string {
    if (this.data.timeTakenMs === undefined) return 'N/A';

    const seconds = Math.floor(this.data.timeTakenMs / 1000);
    const ms = this.data.timeTakenMs % 1000;

    if (seconds > 0) {
      return `${seconds}.${Math.floor(ms / 100)}s`;
    }
    return `${ms}ms`;
  }

  /**
   * Get time taken in seconds
   */
  getTimeTakenSeconds(): number | null {
    if (this.data.timeTakenMs === undefined) return null;
    return this.data.timeTakenMs / 1000;
  }

  /**
   * Check if this was a fast answer (< 5 seconds)
   */
  isFastAnswer(): boolean {
    if (this.data.timeTakenMs === undefined) return false;
    return this.data.timeTakenMs < 5000;
  }

  /**
   * Check if this was a slow answer (> 20 seconds)
   */
  isSlowAnswer(): boolean {
    if (this.data.timeTakenMs === undefined) return false;
    return this.data.timeTakenMs > 20000;
  }

  /**
   * Get performance category (fast, normal, slow)
   */
  getPerformanceCategory(): 'fast' | 'normal' | 'slow' {
    if (this.isFastAnswer()) return 'fast';
    if (this.isSlowAnswer()) return 'slow';
    return 'normal';
  }

  /**
   * Get result text (Correct, Wrong, Not Graded)
   */
  getResultText(): string {
    if (!this.isGraded()) return 'Not Graded';
    return this.wasCorrect() ? 'Correct' : 'Wrong';
  }

  /**
   * Get result color class
   */
  getResultColor(): string {
    if (!this.isGraded()) return 'gray';
    return this.wasCorrect() ? 'green' : 'red';
  }

  /**
   * Calculate rank among other scores (1 = best)
   * @param allScores All scores for the same question
   */
  getRank(allScores: PlayerScore[]): number {
    // Sort by correct first, then by time taken (faster is better)
    const sortedScores = [...allScores].sort((a, b) => {
      // Correct answers come first
      if (a.wasCorrect() && !b.wasCorrect()) return -1;
      if (!a.wasCorrect() && b.wasCorrect()) return 1;

      // Among correct answers (or wrong answers), faster time wins
      const aTime = a.timeTakenMs ?? Infinity;
      const bTime = b.timeTakenMs ?? Infinity;
      return aTime - bTime;
    });

    return sortedScores.findIndex((s) => s.id === this.id) + 1;
  }

  /**
   * Validate player score data
   */
  static validate(data: Partial<PlayerScoreData>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.gameSessionId) {
      errors.push('Game session ID is required');
    }

    if (!data.userId) {
      errors.push('User ID is required');
    }

    if (!data.questionId) {
      errors.push('Question ID is required');
    }

    if (data.pointsEarned === undefined) {
      errors.push('Points earned is required');
    } else if (data.pointsEarned < 0) {
      errors.push('Points earned cannot be negative');
    }

    if (data.timeTakenMs !== undefined && data.timeTakenMs < 0) {
      errors.push('Time taken cannot be negative');
    }

    if (data.answer && data.answer.length > 1000) {
      errors.push('Answer must be 1000 characters or less');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Leaderboard entry (aggregated player scores for a game)
 */
export interface LeaderboardEntry {
  userId: string;
  userEmail?: string;
  userFullName?: string;
  userAvatarUrl?: string;
  totalScore: number;
  correctAnswers: number;
  totalAnswers: number;
  averageTimeMs: number;
  rank: number;
}

/**
 * Helper class for leaderboard operations
 */
export class Leaderboard {
  /**
   * Create leaderboard from player scores
   */
  static fromScores(scores: PlayerScore[]): LeaderboardEntry[] {
    // Group scores by user
    const userScores = new Map<string, PlayerScore[]>();

    for (const score of scores) {
      const existing = userScores.get(score.userId) || [];
      existing.push(score);
      userScores.set(score.userId, existing);
    }

    // Calculate totals for each user
    const entries: LeaderboardEntry[] = [];

    for (const [userId, userScoreList] of userScores.entries()) {
      const totalScore = userScoreList.reduce((sum, s) => sum + s.pointsEarned, 0);
      const correctAnswers = userScoreList.filter((s) => s.wasCorrect()).length;
      const totalAnswers = userScoreList.filter((s) => s.isGraded()).length;

      const times = userScoreList
        .map((s) => s.timeTakenMs)
        .filter((t): t is number => t !== undefined);
      const averageTimeMs = times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0;

      entries.push({
        userId,
        totalScore,
        correctAnswers,
        totalAnswers,
        averageTimeMs,
        rank: 0, // Will be set after sorting
      });
    }

    // Sort by total score (desc), then by average time (asc)
    entries.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return a.averageTimeMs - b.averageTimeMs;
    });

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries;
  }

  /**
   * Get top N entries
   */
  static getTopN(entries: LeaderboardEntry[], n: number): LeaderboardEntry[] {
    return entries.slice(0, n);
  }

  /**
   * Find entry for a specific user
   */
  static findUser(entries: LeaderboardEntry[], userId: string): LeaderboardEntry | undefined {
    return entries.find((e) => e.userId === userId);
  }

  /**
   * Get accuracy percentage for an entry
   */
  static getAccuracy(entry: LeaderboardEntry): number {
    if (entry.totalAnswers === 0) return 0;
    return Math.round((entry.correctAnswers / entry.totalAnswers) * 100);
  }
}
