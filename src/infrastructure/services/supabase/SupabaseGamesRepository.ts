/**
 * Supabase Games Repository
 * Handles multiplayer game operations with Supabase
 *
 * Delegates to:
 * - JeopardyGameOps: Jeopardy-specific operations
 * - GameQuestionOps: Question CRUD operations
 */

import { SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';
import { SupabaseClient } from './SupabaseClient.js';
import {
  IGameRepository,
  CreateGameSessionParams,
  UpdateGameSessionParams,
  CreateGameQuestionParams,
  SubmitAnswerParams,
} from '../../../domain/repositories/IGameRepository.js';
import { GameSession } from '../../../domain/entities/GameSession.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';
import { PlayerScore, LeaderboardEntry } from '../../../domain/entities/PlayerScore.js';
import { JeopardyGameOps } from './games/JeopardyGameOps.js';
import { GameQuestionOps } from './games/GameQuestionOps.js';

/**
 * NOTE: Realtime subscriptions for games are handled directly in the renderer process
 * via RendererSupabaseClient (WebSockets don't work in Electron's main process).
 * See MultiplayerGamesManager.subscribeToGameUpdates(), JeopardyGame.subscribeToBuzzers(),
 * and StudyRoomView.subscribeToRoomGames()
 */
export class SupabaseGamesRepository implements IGameRepository {
  private jeopardyOps: JeopardyGameOps;
  private questionOps: GameQuestionOps;

  constructor() {
    this.jeopardyOps = new JeopardyGameOps(() => this.getClient());
    this.questionOps = new GameQuestionOps(() => this.getClient());
  }

  /**
   * Get a fresh Supabase client with the current session for REST calls
   */
  private getClient(): SupabaseClientType {
    return SupabaseClient.getInstance().getClient();
  }

  // ============================================================================
  // Game Session Operations
  // ============================================================================

  /**
   * Create a new game session
   */
  public async createGameSession(params: CreateGameSessionParams): Promise<GameSession> {
    const { data, error } = await this.getClient()
      .from('game_sessions')
      .insert({
        room_id: params.roomId,
        game_type: params.gameType,
        config: params.config,
        status: 'waiting',
        current_question_index: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create game session:', error);
      throw new Error(`Failed to create game session: ${error.message}`);
    }

    return GameSession.fromDatabase(data);
  }

  /**
   * Get a game session by ID
   */
  public async getGameSession(gameSessionId: string): Promise<GameSession | null> {
    const { data, error } = await this.getClient()
      .from('game_sessions')
      .select('*')
      .eq('id', gameSessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Failed to get game session:', error);
      throw new Error(`Failed to get game session: ${error.message}`);
    }

    return GameSession.fromDatabase(data);
  }

  /**
   * Get the active game for a room
   */
  public async getActiveGameForRoom(roomId: string): Promise<GameSession | null> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data, error } = await this.getClient()
      .from('game_sessions')
      .select('*')
      .eq('room_id', roomId)
      .in('status', ['waiting', 'in_progress'])
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Failed to get active game:', error);
      throw new Error(`Failed to get active game: ${error.message}`);
    }

    return data ? GameSession.fromDatabase(data) : null;
  }

  /**
   * Update a game session
   */
  public async updateGameSession(params: UpdateGameSessionParams): Promise<GameSession> {
    const updates: Record<string, unknown> = {};
    if (params.status !== undefined) updates.status = params.status;
    if (params.currentQuestionIndex !== undefined) updates.current_question_index = params.currentQuestionIndex;

    const { data, error } = await this.getClient()
      .from('game_sessions')
      .update(updates)
      .eq('id', params.gameSessionId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update game session:', error);
      throw new Error(`Failed to update game session: ${error.message}`);
    }

    return GameSession.fromDatabase(data);
  }

  /**
   * Start a game (change status to in_progress)
   */
  public async startGame(gameSessionId: string): Promise<GameSession> {
    console.log('[SupabaseGamesRepository] startGame() called for:', gameSessionId);

    const { data: sessionData, error: sessionError } = await this.getClient()
      .from('game_sessions')
      .select('game_type, room_id')
      .eq('id', gameSessionId)
      .single();

    if (sessionError || !sessionData) {
      throw new Error(`Failed to get game session: ${sessionError?.message}`);
    }

    // If Jeopardy, select a random starting player
    let currentPlayerId: string | undefined = undefined;
    if (sessionData.game_type === 'jeopardy') {
      const { data: participants } = await this.getClient()
        .from('room_participants')
        .select('user_id')
        .eq('room_id', sessionData.room_id)
        .eq('is_active', true);

      if (participants && participants.length > 0) {
        const randomIndex = Math.floor(Math.random() * participants.length);
        currentPlayerId = participants[randomIndex].user_id;
        console.log(`[SupabaseGamesRepository] Selected player ${currentPlayerId} as first selector`);
      }
    }

    const updates: any = { status: 'in_progress' };
    if (currentPlayerId) updates.current_player_id = currentPlayerId;

    const { data, error } = await this.getClient()
      .from('game_sessions')
      .update(updates)
      .eq('id', gameSessionId)
      .select()
      .single();

    if (error) throw new Error(`Failed to start game: ${error.message}`);
    return GameSession.fromDatabase(data);
  }

  /**
   * Complete a game (change status to completed)
   */
  public async completeGame(gameSessionId: string): Promise<GameSession> {
    return this.updateGameSession({ gameSessionId, status: 'completed' });
  }

  /**
   * Cancel a game (change status to cancelled)
   */
  public async cancelGame(gameSessionId: string): Promise<GameSession> {
    return this.updateGameSession({ gameSessionId, status: 'cancelled' });
  }

  /**
   * Move to the next question
   */
  public async nextQuestion(gameSessionId: string): Promise<GameSession> {
    const session = await this.getGameSession(gameSessionId);
    if (!session) throw new Error('Game session not found');
    return this.updateGameSession({
      gameSessionId,
      currentQuestionIndex: session.currentQuestionIndex + 1,
    });
  }

  // ============================================================================
  // Game Question Operations (Delegated)
  // ============================================================================

  public async createGameQuestion(params: CreateGameQuestionParams): Promise<GameQuestion> {
    return this.questionOps.createGameQuestion(params);
  }

  public async createGameQuestions(questions: CreateGameQuestionParams[]): Promise<GameQuestion[]> {
    return this.questionOps.createGameQuestions(questions);
  }

  public async getGameQuestion(questionId: string, includeAnswer: boolean): Promise<GameQuestion | null> {
    return this.questionOps.getGameQuestion(questionId, includeAnswer);
  }

  public async getGameQuestions(gameSessionId: string, includeAnswers: boolean): Promise<GameQuestion[]> {
    return this.questionOps.getGameQuestions(gameSessionId, includeAnswers);
  }

  public async getCurrentQuestion(gameSessionId: string): Promise<GameQuestion | null> {
    return this.questionOps.getCurrentQuestion(gameSessionId);
  }

  public async revealQuestion(questionId: string): Promise<GameQuestion> {
    return this.questionOps.revealQuestion(questionId);
  }

  /**
   * Get correct answer details for a question after player has submitted
   */
  public async getCorrectAnswer(
    gameSessionId: string,
    questionId: string,
    userId: string
  ): Promise<{ correctAnswerIndex: number; explanation?: string } | null> {
    const playerScore = await this.getPlayerScore(gameSessionId, userId, questionId);
    if (!playerScore) return null;

    const question = await this.getGameQuestion(questionId, true);
    if (!question) throw new Error('Question not found');

    const options = question.getOptions();
    if (!options || options.length === 0) throw new Error('Question has no options');

    const correctAnswerIndex = options.findIndex(
      (option) => option.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()
    );

    if (correctAnswerIndex === -1) throw new Error('Correct answer not found in options');

    return { correctAnswerIndex, explanation: question.questionData.explanation };
  }

  // ============================================================================
  // Player Score Operations
  // ============================================================================

  /**
   * Submit a player's answer
   */
  public async submitAnswer(params: SubmitAnswerParams): Promise<PlayerScore> {
    const question = await this.getGameQuestion(params.questionId, true);
    if (!question) throw new Error('Question not found');

    const isCorrect = question.isCorrectAnswer(params.answer);
    const pointsEarned = isCorrect ? question.calculatePoints(params.timeTakenMs) : 0;

    const { data, error } = await this.getClient()
      .from('player_scores')
      .insert({
        game_session_id: params.gameSessionId,
        user_id: params.userId,
        question_id: params.questionId,
        answer: params.answer,
        is_correct: isCorrect,
        points_earned: pointsEarned,
        time_taken_ms: params.timeTakenMs,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to submit answer: ${error.message}`);
    return PlayerScore.fromDatabase(data);
  }

  /**
   * Get a player's score for a specific question
   */
  public async getPlayerScore(
    gameSessionId: string,
    userId: string,
    questionId: string
  ): Promise<PlayerScore | null> {
    const { data, error } = await this.getClient()
      .from('player_scores')
      .select('*')
      .eq('game_session_id', gameSessionId)
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get player score: ${error.message}`);
    }

    return PlayerScore.fromDatabase(data);
  }

  /**
   * Get all scores for a player in a game
   */
  public async getPlayerScores(gameSessionId: string, userId: string): Promise<PlayerScore[]> {
    const { data, error } = await this.getClient()
      .from('player_scores')
      .select('*')
      .eq('game_session_id', gameSessionId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to get player scores: ${error.message}`);
    return (data || []).map((row) => PlayerScore.fromDatabase(row));
  }

  /**
   * Get all scores for a specific question
   */
  public async getQuestionScores(questionId: string): Promise<PlayerScore[]> {
    const { data, error } = await this.getClient()
      .from('player_scores')
      .select('*')
      .eq('question_id', questionId)
      .order('points_earned', { ascending: false })
      .order('time_taken_ms', { ascending: true });

    if (error) throw new Error(`Failed to get question scores: ${error.message}`);
    return (data || []).map((row) => PlayerScore.fromDatabase(row));
  }

  /**
   * Get player's total score for a game
   */
  public async getPlayerTotalScore(gameSessionId: string, userId: string): Promise<number> {
    const { data, error } = await this.getClient().rpc('get_player_total_score', {
      p_game_session_id: gameSessionId,
      p_user_id: userId,
    });

    if (error) throw new Error(`Failed to get player total score: ${error.message}`);
    return data || 0;
  }

  /**
   * Get leaderboard for a game
   */
  public async getGameLeaderboard(gameSessionId: string): Promise<LeaderboardEntry[]> {
    const { data, error } = await this.getClient().rpc('get_game_leaderboard', {
      p_game_session_id: gameSessionId,
    });

    if (error) throw new Error(`Failed to get game leaderboard: ${error.message}`);

    return (data || []).map((row: any, index: number) => ({
      userId: row.user_id,
      userEmail: row.user_email,
      userFullName: row.user_full_name,
      userAvatarUrl: row.user_avatar_url,
      totalScore: row.total_score,
      correctAnswers: row.correct_answers,
      totalAnswers: row.total_answers,
      averageTimeMs: parseFloat(row.avg_time_ms) || 0,
      rank: index + 1,
    }));
  }

  // ============================================================================
  // Jeopardy-Specific Operations (Delegated)
  // ============================================================================

  public async selectJeopardyQuestion(
    gameSessionId: string,
    questionId: string,
    selectedByUserId: string
  ): Promise<boolean> {
    return this.jeopardyOps.selectJeopardyQuestion(gameSessionId, questionId, selectedByUserId);
  }

  public async recordBuzzerPress(
    gameSessionId: string,
    questionId: string,
    userId: string
  ): Promise<number> {
    return this.jeopardyOps.recordBuzzerPress(gameSessionId, questionId, userId);
  }

  public async getQuestionBuzzers(
    questionId: string
  ): Promise<Array<{ userId: string; buzzerRank: number; pressedAt: Date }>> {
    return this.jeopardyOps.getQuestionBuzzers(questionId);
  }

  public async getFirstBuzzer(questionId: string): Promise<string | null> {
    return this.jeopardyOps.getFirstBuzzer(questionId);
  }

  public async getJeopardyBoard(gameSessionId: string): Promise<
    Array<{
      questionId: string;
      category: string;
      points: number;
      columnPosition: number;
      isSelected: boolean;
      isDailyDouble: boolean;
    }>
  > {
    return this.jeopardyOps.getJeopardyBoard(gameSessionId);
  }

  public async setCurrentJeopardyPlayer(gameSessionId: string, userId: string): Promise<void> {
    return this.jeopardyOps.setCurrentJeopardyPlayer(gameSessionId, userId);
  }

  public async getLowestScoringPlayer(gameSessionId: string): Promise<string | null> {
    return this.jeopardyOps.getLowestScoringPlayer(gameSessionId);
  }

  public async advanceToFinalJeopardy(gameSessionId: string): Promise<void> {
    return this.jeopardyOps.advanceToFinalJeopardy(gameSessionId);
  }

  public async isJeopardyBoardComplete(gameSessionId: string): Promise<boolean> {
    return this.jeopardyOps.isJeopardyBoardComplete(gameSessionId);
  }

  public async submitJeopardyAnswer(params: {
    gameSessionId: string;
    questionId: string;
    userId: string;
    answer: string;
    isCorrect: boolean;
    buzzerRank: number;
    wagerAmount?: number;
    timeTakenMs?: number;
  }): Promise<number> {
    return this.jeopardyOps.submitJeopardyAnswer(params);
  }

  public async skipJeopardyQuestion(params: {
    gameSessionId: string;
    questionId: string;
  }): Promise<void> {
    return this.jeopardyOps.skipJeopardyQuestion(params);
  }

  public async clearBuzzerPresses(questionId: string): Promise<void> {
    return this.jeopardyOps.clearBuzzerPresses(questionId);
  }

  // ============================================================================
  // Final Jeopardy Operations (Delegated)
  // ============================================================================

  public async submitFinalJeopardyWager(
    gameSessionId: string,
    userId: string,
    wagerAmount: number
  ): Promise<boolean> {
    return this.jeopardyOps.submitFinalJeopardyWager(gameSessionId, userId, wagerAmount);
  }

  public async allFinalJeopardyWagersSubmitted(gameSessionId: string): Promise<boolean> {
    return this.jeopardyOps.allFinalJeopardyWagersSubmitted(gameSessionId);
  }

  public async getFinalJeopardyWagers(
    gameSessionId: string
  ): Promise<Array<{ userId: string; wagerAmount: number; submittedAt: Date }>> {
    return this.jeopardyOps.getFinalJeopardyWagers(gameSessionId);
  }

  public async getPlayerFinalJeopardyWager(
    gameSessionId: string,
    userId: string
  ): Promise<number | null> {
    return this.jeopardyOps.getPlayerFinalJeopardyWager(gameSessionId, userId);
  }

  public async allFinalJeopardyAnswersSubmitted(
    gameSessionId: string,
    questionId: string
  ): Promise<boolean> {
    return this.jeopardyOps.allFinalJeopardyAnswersSubmitted(gameSessionId, questionId);
  }
}
