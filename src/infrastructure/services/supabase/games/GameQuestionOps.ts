/**
 * GameQuestionOps
 *
 * Game question operations: create, get, reveal.
 */

import { SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';
import { GameQuestion } from '../../../../domain/entities/GameQuestion.js';
import { CreateGameQuestionParams } from '../../../../domain/repositories/IGameRepository.js';

export class GameQuestionOps {
  constructor(private getClient: () => SupabaseClientType) {}

  /**
   * Create a game question
   */
  async createGameQuestion(params: CreateGameQuestionParams): Promise<GameQuestion> {
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
  async createGameQuestions(questions: CreateGameQuestionParams[]): Promise<GameQuestion[]> {
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
  async getGameQuestion(questionId: string, _includeAnswer: boolean): Promise<GameQuestion | null> {
    const query = this.getClient().from('game_questions').select('*').eq('id', questionId);
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
  async getGameQuestions(gameSessionId: string, _includeAnswers: boolean): Promise<GameQuestion[]> {
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
  async getCurrentQuestion(gameSessionId: string): Promise<GameQuestion | null> {
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
  async revealQuestion(questionId: string): Promise<GameQuestion> {
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
}
