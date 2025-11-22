/**
 * Supabase Games Repository
 * Handles multiplayer game operations with Supabase
 */

import { SupabaseClient as SupabaseClientType, RealtimeChannel } from '@supabase/supabase-js';
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

export class SupabaseGamesRepository implements IGameRepository {
  private channels: Map<string, RealtimeChannel> = new Map();

  /**
   * Get a fresh Supabase client with the current session for REST calls
   */
  private getClient(): SupabaseClientType {
    return SupabaseClient.getInstance().getClient();
  }

  /**
   * Get the base Supabase client for Realtime subscriptions
   */
  private getRealtimeClient(): SupabaseClientType {
    return SupabaseClient.getInstance().getRealtimeClient();
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
   */
  public async startGame(gameSessionId: string): Promise<GameSession> {
    return this.updateGameSession({
      gameSessionId,
      status: 'in_progress',
    });
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
  // Real-time Subscriptions
  // ============================================================================

  /**
   * Subscribe to game session updates
   */
  public subscribeToGameSession(
    gameSessionId: string,
    onUpdate: (gameSession: GameSession) => void
  ): () => Promise<void> {
    const channelName = `game-session:${gameSessionId}`;
    const client = this.getRealtimeClient();

    console.log('📡 Creating Realtime game session subscription:', gameSessionId);

    // Remove existing subscription if any
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
      console.log(`Removing existing game session subscription ${gameSessionId}`);
      existingChannel.unsubscribe().catch((err) => console.error('Error unsubscribing:', err));
      client.removeChannel(existingChannel);
      this.channels.delete(channelName);
    }

    // Set auth token for RLS
    const accessToken = SupabaseClient.getInstance().getAccessToken();
    if (accessToken) {
      client.realtime.setAuth(accessToken);
    }

    const channel = client.channel(channelName).on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `id=eq.${gameSessionId}`,
      },
      (payload) => {
        console.log('Game session updated:', payload);
        const gameSession = GameSession.fromDatabase(payload.new as any);
        onUpdate(gameSession);
      }
    );

    channel.subscribe((status) => {
      console.log(`Game session subscription status for ${gameSessionId}:`, status);
    });

    this.channels.set(channelName, channel);

    return async () => {
      await channel.unsubscribe();
      client.removeChannel(channel);
      this.channels.delete(channelName);
      console.log(`Unsubscribed from game session ${gameSessionId}`);
    };
  }

  /**
   * Subscribe to new questions in a game
   */
  public subscribeToGameQuestions(
    gameSessionId: string,
    onQuestion: (question: GameQuestion) => void
  ): () => Promise<void> {
    const channelName = `game-questions:${gameSessionId}`;
    const client = this.getRealtimeClient();

    console.log('📡 Creating Realtime game questions subscription:', gameSessionId);

    // Remove existing subscription if any
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
      existingChannel.unsubscribe().catch((err) => console.error('Error unsubscribing:', err));
      client.removeChannel(existingChannel);
      this.channels.delete(channelName);
    }

    // Set auth token for RLS
    const accessToken = SupabaseClient.getInstance().getAccessToken();
    if (accessToken) {
      client.realtime.setAuth(accessToken);
    }

    const channel = client.channel(channelName).on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'game_questions',
        filter: `game_session_id=eq.${gameSessionId}`,
      },
      (payload) => {
        console.log('New game question:', payload);
        const question = GameQuestion.fromDatabase(payload.new as any);
        onQuestion(question);
      }
    );

    channel.subscribe((status) => {
      console.log(`Game questions subscription status for ${gameSessionId}:`, status);
    });

    this.channels.set(channelName, channel);

    return async () => {
      await channel.unsubscribe();
      client.removeChannel(channel);
      this.channels.delete(channelName);
      console.log(`Unsubscribed from game questions ${gameSessionId}`);
    };
  }

  /**
   * Subscribe to player scores in a game
   */
  public subscribeToGameScores(
    gameSessionId: string,
    onScore: (score: PlayerScore) => void
  ): () => Promise<void> {
    const channelName = `game-scores:${gameSessionId}`;
    const client = this.getRealtimeClient();

    console.log('📡 Creating Realtime game scores subscription:', gameSessionId);

    // Remove existing subscription if any
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
      existingChannel.unsubscribe().catch((err) => console.error('Error unsubscribing:', err));
      client.removeChannel(existingChannel);
      this.channels.delete(channelName);
    }

    // Set auth token for RLS
    const accessToken = SupabaseClient.getInstance().getAccessToken();
    if (accessToken) {
      client.realtime.setAuth(accessToken);
    }

    const channel = client.channel(channelName).on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'player_scores',
        filter: `game_session_id=eq.${gameSessionId}`,
      },
      (payload) => {
        console.log('New player score:', payload);
        const score = PlayerScore.fromDatabase(payload.new as any);
        onScore(score);
      }
    );

    channel.subscribe((status) => {
      console.log(`Game scores subscription status for ${gameSessionId}:`, status);
    });

    this.channels.set(channelName, channel);

    return async () => {
      await channel.unsubscribe();
      client.removeChannel(channel);
      this.channels.delete(channelName);
      console.log(`Unsubscribed from game scores ${gameSessionId}`);
    };
  }

  /**
   * Subscribe to game sessions for a specific room
   * Used to detect when a host starts a new game
   */
  public subscribeToRoomGames(
    roomId: string,
    onGameSession: (gameSession: GameSession | null) => void
  ): () => Promise<void> {
    const channelName = `room-games:${roomId}`;
    const client = this.getRealtimeClient();

    console.log('📡 Creating Realtime room games subscription:', roomId);

    // Remove existing subscription if any
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
      existingChannel.unsubscribe().catch((err) => console.error('Error unsubscribing:', err));
      client.removeChannel(existingChannel);
      this.channels.delete(channelName);
    }

    // Set auth token for RLS
    const accessToken = SupabaseClient.getInstance().getAccessToken();
    if (accessToken) {
      client.realtime.setAuth(accessToken);
    }

    const channel = client.channel(channelName).on(
      'postgres_changes',
      {
        event: '*', // Listen for INSERT and UPDATE
        schema: 'public',
        table: 'game_sessions',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        console.log('Room game update:', payload.eventType, payload);
        if (payload.new) {
          const gameSession = GameSession.fromDatabase(payload.new as any);
          onGameSession(gameSession);
        } else {
          onGameSession(null);
        }
      }
    );

    channel.subscribe((status) => {
      console.log(`Room games subscription status for ${roomId}:`, status);
    });

    this.channels.set(channelName, channel);

    return async () => {
      await channel.unsubscribe();
      client.removeChannel(channel);
      this.channels.delete(channelName);
      console.log(`Unsubscribed from room games ${roomId}`);
    };
  }

  /**
   * Unsubscribe from all game subscriptions
   */
  public async unsubscribeAll(): Promise<void> {
    const client = this.getRealtimeClient();

    for (const [channelName, channel] of this.channels.entries()) {
      await channel.unsubscribe();
      client.removeChannel(channel);
      console.log(`Unsubscribed from ${channelName}`);
    }

    this.channels.clear();
  }
}
