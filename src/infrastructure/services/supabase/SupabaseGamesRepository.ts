/**
 * Supabase Games Repository
 * Handles multiplayer game operations with Supabase
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

/**
 * NOTE: Realtime subscriptions for games are handled directly in the renderer process
 * via RendererSupabaseClient (WebSockets don't work in Electron's main process).
 * See MultiplayerGamesManager.subscribeToGameUpdates(), JeopardyGame.subscribeToBuzzers(),
 * and StudyRoomView.subscribeToRoomGames()
 */
export class SupabaseGamesRepository implements IGameRepository {
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
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('Failed to get game session:', error);
      throw new Error(`Failed to get game session: ${error.message}`);
    }

    return GameSession.fromDatabase(data);
  }

  /**
   * Get the active game for a room
   */
  public async getActiveGameForRoom(roomId: string): Promise<GameSession | null> {
    // Calculate timestamp for 24 hours ago (defense against stale games)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data, error } = await this.getClient()
      .from('game_sessions')
      .select('*')
      .eq('room_id', roomId)
      .in('status', ['waiting', 'in_progress'])
      .gte('created_at', twentyFourHoursAgo.toISOString()) // Only games from last 24 hours
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

    if (params.status !== undefined) {
      updates.status = params.status;
    }

    if (params.currentQuestionIndex !== undefined) {
      updates.current_question_index = params.currentQuestionIndex;
    }

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
   * For Jeopardy: Also sets initial current_player_id
   */
  public async startGame(gameSessionId: string): Promise<GameSession> {
    console.log('[SupabaseGamesRepository] startGame() called for:', gameSessionId);

    // Get the game session to check if it's Jeopardy
    const { data: sessionData, error: sessionError } = await this.getClient()
      .from('game_sessions')
      .select('game_type, room_id')
      .eq('id', gameSessionId)
      .single();

    console.log('[SupabaseGamesRepository] Session data:', sessionData);

    if (sessionError || !sessionData) {
      throw new Error(`Failed to get game session: ${sessionError?.message}`);
    }

    // If Jeopardy, select a random starting player
    let currentPlayerId: string | undefined = undefined;
    if (sessionData.game_type === 'jeopardy') {
      console.log('[SupabaseGamesRepository] This is a Jeopardy game, selecting starting player...');
      const { data: participants, error: participantsError } = await this.getClient()
        .from('room_participants')
        .select('user_id')
        .eq('room_id', sessionData.room_id)
        .eq('is_active', true);

      console.log('[SupabaseGamesRepository] Participants query result:', { participants, error: participantsError });

      if (!participantsError && participants && participants.length > 0) {
        // Select random participant as starting player
        const randomIndex = Math.floor(Math.random() * participants.length);
        currentPlayerId = participants[randomIndex].user_id;
        console.log(`[SupabaseGamesRepository] Selected player ${currentPlayerId} as first selector (index ${randomIndex} of ${participants.length})`);
      } else {
        console.error('[SupabaseGamesRepository] Failed to get participants or no participants found');
      }
    }

    // Update game status (and current_player_id for Jeopardy)
    const updates: any = { status: 'in_progress' };
    if (currentPlayerId) {
      updates.current_player_id = currentPlayerId;
      console.log('[SupabaseGamesRepository] Setting current_player_id to:', currentPlayerId);
    } else {
      console.log('[SupabaseGamesRepository] No currentPlayerId to set');
    }

    console.log('[SupabaseGamesRepository] Updating game session with:', updates);

    const { data, error } = await this.getClient()
      .from('game_sessions')
      .update(updates)
      .eq('id', gameSessionId)
      .select()
      .single();

    console.log('[SupabaseGamesRepository] Update result:', { data, error });

    if (error) {
      throw new Error(`Failed to start game: ${error.message}`);
    }

    return GameSession.fromDatabase(data);
  }

  /**
   * Complete a game (change status to completed)
   */
  public async completeGame(gameSessionId: string): Promise<GameSession> {
    return this.updateGameSession({
      gameSessionId,
      status: 'completed',
    });
  }

  /**
   * Cancel a game (change status to cancelled)
   */
  public async cancelGame(gameSessionId: string): Promise<GameSession> {
    return this.updateGameSession({
      gameSessionId,
      status: 'cancelled',
    });
  }

  /**
   * Move to the next question
   */
  public async nextQuestion(gameSessionId: string): Promise<GameSession> {
    const session = await this.getGameSession(gameSessionId);
    if (!session) {
      throw new Error('Game session not found');
    }

    return this.updateGameSession({
      gameSessionId,
      currentQuestionIndex: session.currentQuestionIndex + 1,
    });
  }

  // ============================================================================
  // Game Question Operations
  // ============================================================================

  /**
   * Create a game question
   */
  public async createGameQuestion(params: CreateGameQuestionParams): Promise<GameQuestion> {
    const { data, error } = await this.getClient()
      .from('game_questions')
      .insert({
        game_session_id: params.gameSessionId,
        question_index: params.questionIndex,
        question_data: params.questionData,
        correct_answer: params.correctAnswer,
        category: params.category,
        difficulty: params.difficulty,
        points: params.points,
        time_limit_seconds: params.timeLimitSeconds,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create game question:', error);
      throw new Error(`Failed to create game question: ${error.message}`);
    }

    return GameQuestion.fromDatabase(data);
  }

  /**
   * Create multiple game questions in bulk
   */
  public async createGameQuestions(questions: CreateGameQuestionParams[]): Promise<GameQuestion[]> {
    const rows = questions.map((q) => ({
      game_session_id: q.gameSessionId,
      question_index: q.questionIndex,
      question_data: q.questionData,
      correct_answer: q.correctAnswer,
      category: q.category,
      difficulty: q.difficulty,
      points: q.points,
      time_limit_seconds: q.timeLimitSeconds,
      // Jeopardy-specific fields (undefined values are filtered by Supabase)
      column_position: q.columnPosition,
      is_daily_double: q.isDailyDouble,
      is_final_jeopardy: q.isFinalJeopardy,
    }));

    const { data, error } = await this.getClient().from('game_questions').insert(rows).select();

    if (error) {
      console.error('Failed to create game questions:', error);
      throw new Error(`Failed to create game questions: ${error.message}`);
    }

    return (data || []).map((row) => GameQuestion.fromDatabase(row));
  }

  /**
   * Get a game question by ID
   */
  public async getGameQuestion(questionId: string, includeAnswer: boolean): Promise<GameQuestion | null> {
    let query = this.getClient().from('game_questions').select('*').eq('id', questionId);

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Failed to get game question:', error);
      throw new Error(`Failed to get game question: ${error.message}`);
    }

    return GameQuestion.fromDatabase(data);
  }

  /**
   * Get all questions for a game session
   */
  public async getGameQuestions(gameSessionId: string, includeAnswers: boolean): Promise<GameQuestion[]> {
    const { data, error } = await this.getClient()
      .from('game_questions')
      .select('*')
      .eq('game_session_id', gameSessionId)
      .order('question_index', { ascending: true });

    if (error) {
      console.error('Failed to get game questions:', error);
      throw new Error(`Failed to get game questions: ${error.message}`);
    }

    return (data || []).map((row) => GameQuestion.fromDatabase(row));
  }

  /**
   * Get the current question for a game
   */
  public async getCurrentQuestion(gameSessionId: string): Promise<GameQuestion | null> {
    // Use the database function for this
    const { data, error } = await this.getClient().rpc('get_current_game_question', {
      p_game_session_id: gameSessionId,
    });

    if (error) {
      console.error('Failed to get current question:', error);
      throw new Error(`Failed to get current question: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    // The RPC returns an array, get the first result
    const questionData = Array.isArray(data) ? data[0] : data;

    // Map the result to match GameQuestion.fromDatabase expected format
    return GameQuestion.fromDatabase({
      id: questionData.id,
      game_session_id: gameSessionId,
      question_index: questionData.question_index,
      question_data: questionData.question_data,
      correct_answer: '', // Not included in RPC response for security
      category: questionData.category,
      difficulty: questionData.difficulty,
      points: questionData.points,
      time_limit_seconds: questionData.time_limit_seconds,
      created_at: new Date(),
    });
  }

  /**
   * Reveal a question (set revealed_at timestamp)
   */
  public async revealQuestion(questionId: string): Promise<GameQuestion> {
    const { data, error } = await this.getClient()
      .from('game_questions')
      .update({ revealed_at: new Date().toISOString() })
      .eq('id', questionId)
      .select()
      .single();

    if (error) {
      console.error('Failed to reveal question:', error);
      throw new Error(`Failed to reveal question: ${error.message}`);
    }

    return GameQuestion.fromDatabase(data);
  }

  /**
   * Get correct answer details for a question after player has submitted
   * Security: Only returns answer if player has already submitted
   */
  public async getCorrectAnswer(
    gameSessionId: string,
    questionId: string,
    userId: string
  ): Promise<{ correctAnswerIndex: number; explanation?: string } | null> {
    // Security check: Verify player has submitted an answer
    const playerScore = await this.getPlayerScore(gameSessionId, userId, questionId);
    if (!playerScore) {
      console.warn('[SupabaseGamesRepository] Player has not submitted answer yet');
      return null;
    }

    // Get the question with correct answer
    const question = await this.getGameQuestion(questionId, true);
    if (!question) {
      throw new Error('Question not found');
    }

    // Find the index of the correct answer in options
    const options = question.getOptions();
    if (!options || options.length === 0) {
      throw new Error('Question has no options');
    }

    const correctAnswerIndex = options.findIndex(
      (option) => option.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()
    );

    if (correctAnswerIndex === -1) {
      console.error('[SupabaseGamesRepository] Correct answer not found in options', {
        correctAnswer: question.correctAnswer,
        options,
      });
      throw new Error('Correct answer not found in options');
    }

    return {
      correctAnswerIndex,
      explanation: question.questionData.explanation,
    };
  }

  // ============================================================================
  // Player Score Operations
  // ============================================================================

  /**
   * Submit a player's answer
   */
  public async submitAnswer(params: SubmitAnswerParams): Promise<PlayerScore> {
    console.log(`[SupabaseGamesRepository] submitAnswer called:`, {
      gameSessionId: params.gameSessionId,
      userId: params.userId,
      questionId: params.questionId,
      answer: params.answer,
      timeTakenMs: params.timeTakenMs,
    });

    // Get the question to check the correct answer
    const question = await this.getGameQuestion(params.questionId, true);
    if (!question) {
      throw new Error('Question not found');
    }

    // Check if answer is correct
    const isCorrect = question.isCorrectAnswer(params.answer);

    // Calculate points
    const pointsEarned = isCorrect ? question.calculatePoints(params.timeTakenMs) : 0;

    console.log(`[SupabaseGamesRepository] Score calculation:`, {
      questionId: params.questionId,
      userId: params.userId,
      isCorrect,
      pointsEarned,
      timeTakenMs: params.timeTakenMs,
    });

    // Insert the score
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

    if (error) {
      console.error('[SupabaseGamesRepository] Failed to insert player_scores:', error);
      throw new Error(`Failed to submit answer: ${error.message}`);
    }

    console.log(`[SupabaseGamesRepository] Answer submitted successfully:`, {
      scoreId: data.id,
      pointsEarned,
    });

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
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Failed to get player score:', error);
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

    if (error) {
      console.error('Failed to get player scores:', error);
      throw new Error(`Failed to get player scores: ${error.message}`);
    }

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

    if (error) {
      console.error('Failed to get question scores:', error);
      throw new Error(`Failed to get question scores: ${error.message}`);
    }

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

    if (error) {
      console.error('Failed to get player total score:', error);
      throw new Error(`Failed to get player total score: ${error.message}`);
    }

    return data || 0;
  }

  /**
   * Get leaderboard for a game
   */
  public async getGameLeaderboard(gameSessionId: string): Promise<LeaderboardEntry[]> {
    const { data, error } = await this.getClient().rpc('get_game_leaderboard', {
      p_game_session_id: gameSessionId,
    });

    if (error) {
      console.error('Failed to get game leaderboard:', error);
      throw new Error(`Failed to get game leaderboard: ${error.message}`);
    }

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
  // Jeopardy-Specific Operations
  // ============================================================================

  /**
   * Select a Jeopardy question from the board
   */
  public async selectJeopardyQuestion(
    gameSessionId: string,
    questionId: string,
    selectedByUserId: string
  ): Promise<boolean> {
    const { data, error } = await this.getClient().rpc('select_jeopardy_question', {
      p_game_session_id: gameSessionId,
      p_question_id: questionId,
      p_selected_by_user_id: selectedByUserId,
    });

    if (error) {
      console.error('Failed to select Jeopardy question:', error);
      throw new Error(`Failed to select Jeopardy question: ${error.message}`);
    }

    return data === true;
  }

  /**
   * Record a buzzer press for a question
   * Returns the buzzer rank (1st, 2nd, 3rd, etc.)
   */
  public async recordBuzzerPress(
    gameSessionId: string,
    questionId: string,
    userId: string
  ): Promise<number> {
    const { data, error } = await this.getClient().rpc('record_buzzer_press', {
      p_game_session_id: gameSessionId,
      p_question_id: questionId,
      p_user_id: userId,
    });

    if (error) {
      console.error('Failed to record buzzer press:', error);
      throw new Error(`Failed to record buzzer press: ${error.message}`);
    }

    return data as number;
  }

  /**
   * Get ordered list of buzzers for a question
   */
  public async getQuestionBuzzers(
    questionId: string
  ): Promise<Array<{ userId: string; buzzerRank: number; pressedAt: Date }>> {
    const { data, error } = await this.getClient().rpc('get_question_buzzers', {
      p_question_id: questionId,
    });

    if (error) {
      console.error('Failed to get question buzzers:', error);
      throw new Error(`Failed to get question buzzers: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      userId: row.user_id,
      buzzerRank: row.buzzer_rank,
      pressedAt: new Date(row.pressed_at),
    }));
  }

  /**
   * Get the first player to buzz in for a question
   */
  public async getFirstBuzzer(questionId: string): Promise<string | null> {
    const { data, error } = await this.getClient().rpc('get_first_buzzer', {
      p_question_id: questionId,
    });

    if (error) {
      console.error('Failed to get first buzzer:', error);
      throw new Error(`Failed to get first buzzer: ${error.message}`);
    }

    return data;
  }

  /**
   * Get Jeopardy board state (categories × point values)
   */
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
    const { data, error } = await this.getClient().rpc('get_jeopardy_board', {
      p_game_session_id: gameSessionId,
    });

    if (error) {
      console.error('Failed to get Jeopardy board:', error);
      throw new Error(`Failed to get Jeopardy board: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      questionId: row.question_id,
      category: row.category,
      points: row.points,
      columnPosition: row.column_position,
      isSelected: row.is_selected,
      isDailyDouble: row.is_daily_double,
    }));
  }

  /**
   * Set the current player (whose turn to select a question)
   */
  public async setCurrentJeopardyPlayer(gameSessionId: string, userId: string): Promise<void> {
    const { error } = await this.getClient().rpc('set_current_jeopardy_player', {
      p_game_session_id: gameSessionId,
      p_user_id: userId,
    });

    if (error) {
      console.error('Failed to set current Jeopardy player:', error);
      throw new Error(`Failed to set current Jeopardy player: ${error.message}`);
    }
  }

  /**
   * Get player with lowest score (for turn rotation)
   */
  public async getLowestScoringPlayer(gameSessionId: string): Promise<string | null> {
    const { data, error } = await this.getClient().rpc('get_lowest_scoring_player', {
      p_game_session_id: gameSessionId,
    });

    if (error) {
      console.error('Failed to get lowest scoring player:', error);
      throw new Error(`Failed to get lowest scoring player: ${error.message}`);
    }

    return data;
  }

  /**
   * Advance to Final Jeopardy round
   */
  public async advanceToFinalJeopardy(gameSessionId: string): Promise<void> {
    const { error } = await this.getClient().rpc('advance_to_final_jeopardy', {
      p_game_session_id: gameSessionId,
    });

    if (error) {
      console.error('Failed to advance to Final Jeopardy:', error);
      throw new Error(`Failed to advance to Final Jeopardy: ${error.message}`);
    }
  }

  /**
   * Check if the Jeopardy board is complete (all questions answered)
   */
  public async isJeopardyBoardComplete(gameSessionId: string): Promise<boolean> {
    const { data, error } = await this.getClient().rpc('is_jeopardy_board_complete', {
      p_game_session_id: gameSessionId,
    });

    if (error) {
      console.error('Failed to check if board is complete:', error);
      throw new Error(`Failed to check if board is complete: ${error.message}`);
    }

    return data === true;
  }

  /**
   * Submit a Jeopardy answer with wager support
   */
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
    const { data, error } = await this.getClient().rpc('submit_jeopardy_answer', {
      p_game_session_id: params.gameSessionId,
      p_question_id: params.questionId,
      p_user_id: params.userId,
      p_answer: params.answer,
      p_is_correct: params.isCorrect,
      p_buzzer_rank: params.buzzerRank,
      p_wager_amount: params.wagerAmount || null,
      p_time_taken_ms: params.timeTakenMs || null,
    });

    if (error) {
      console.error('Failed to submit Jeopardy answer:', error);
      throw new Error(`Failed to submit Jeopardy answer: ${error.message}`);
    }

    return data as number; // Returns points earned
  }

  /**
   * Skip/clear current Jeopardy question (when no one else wants to answer)
   * This marks the question as answered and returns to the board
   */
  public async skipJeopardyQuestion(params: {
    gameSessionId: string;
    questionId: string;
  }): Promise<void> {
    const { error } = await this.getClient().rpc('skip_jeopardy_question', {
      p_game_session_id: params.gameSessionId,
      p_question_id: params.questionId,
    });

    if (error) {
      console.error('Failed to skip Jeopardy question:', error);
      throw new Error(`Failed to skip Jeopardy question: ${error.message}`);
    }
  }

  /**
   * Clear all buzzer presses for a question (used for rebuzz)
   * This is called when a player answers incorrectly and others can buzz in again
   */
  public async clearBuzzerPresses(questionId: string): Promise<void> {
    const { error } = await this.getClient().rpc('clear_buzzer_presses', {
      p_question_id: questionId,
    });

    if (error) {
      console.error('Failed to clear buzzer presses:', error);
      throw new Error(`Failed to clear buzzer presses: ${error.message}`);
    }
  }

  // ============================================================================
  // Final Jeopardy Operations
  // ============================================================================

  /**
   * Submit a Final Jeopardy wager
   */
  public async submitFinalJeopardyWager(
    gameSessionId: string,
    userId: string,
    wagerAmount: number
  ): Promise<boolean> {
    const { data, error } = await this.getClient().rpc('submit_final_jeopardy_wager', {
      p_game_session_id: gameSessionId,
      p_user_id: userId,
      p_wager_amount: wagerAmount,
    });

    if (error) {
      console.error('Failed to submit Final Jeopardy wager:', error);
      throw new Error(`Failed to submit Final Jeopardy wager: ${error.message}`);
    }

    return data === true;
  }

  /**
   * Check if all players have submitted Final Jeopardy wagers
   */
  public async allFinalJeopardyWagersSubmitted(gameSessionId: string): Promise<boolean> {
    const { data, error } = await this.getClient().rpc('all_final_jeopardy_wagers_submitted', {
      p_game_session_id: gameSessionId,
    });

    if (error) {
      console.error('Failed to check FJ wagers:', error);
      throw new Error(`Failed to check FJ wagers: ${error.message}`);
    }

    return data === true;
  }

  /**
   * Get all Final Jeopardy wagers for a game
   */
  public async getFinalJeopardyWagers(
    gameSessionId: string
  ): Promise<Array<{ userId: string; wagerAmount: number; submittedAt: Date }>> {
    const { data, error } = await this.getClient().rpc('get_final_jeopardy_wagers', {
      p_game_session_id: gameSessionId,
    });

    if (error) {
      console.error('Failed to get FJ wagers:', error);
      throw new Error(`Failed to get FJ wagers: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      userId: row.user_id,
      wagerAmount: row.wager_amount,
      submittedAt: new Date(row.submitted_at),
    }));
  }

  /**
   * Get a specific player's Final Jeopardy wager
   */
  public async getPlayerFinalJeopardyWager(
    gameSessionId: string,
    userId: string
  ): Promise<number | null> {
    const { data, error } = await this.getClient().rpc('get_player_final_jeopardy_wager', {
      p_game_session_id: gameSessionId,
      p_user_id: userId,
    });

    if (error) {
      console.error('Failed to get player FJ wager:', error);
      throw new Error(`Failed to get player FJ wager: ${error.message}`);
    }

    return data;
  }

  /**
   * Check if all players have answered Final Jeopardy
   */
  public async allFinalJeopardyAnswersSubmitted(
    gameSessionId: string,
    questionId: string
  ): Promise<boolean> {
    const { data, error } = await this.getClient().rpc('all_final_jeopardy_answers_submitted', {
      p_game_session_id: gameSessionId,
      p_question_id: questionId,
    });

    if (error) {
      console.error('Failed to check FJ answers:', error);
      throw new Error(`Failed to check FJ answers: ${error.message}`);
    }

    return data === true;
  }
}
