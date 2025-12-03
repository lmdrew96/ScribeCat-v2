/**
 * JeopardyGameOps
 *
 * Jeopardy-specific game operations including Final Jeopardy.
 */

import { SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';

export class JeopardyGameOps {
  constructor(private getClient: () => SupabaseClientType) {}

  // ============================================================================
  // Jeopardy Board Operations
  // ============================================================================

  /**
   * Select a Jeopardy question from the board
   */
  async selectJeopardyQuestion(
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
  async recordBuzzerPress(
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
  async getQuestionBuzzers(
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
  async getFirstBuzzer(questionId: string): Promise<string | null> {
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
  async getJeopardyBoard(gameSessionId: string): Promise<
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
  async setCurrentJeopardyPlayer(gameSessionId: string, userId: string): Promise<void> {
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
  async getLowestScoringPlayer(gameSessionId: string): Promise<string | null> {
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
  async advanceToFinalJeopardy(gameSessionId: string): Promise<void> {
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
  async isJeopardyBoardComplete(gameSessionId: string): Promise<boolean> {
    const { data, error } = await this.getClient().rpc('is_jeopardy_board_complete', {
      p_game_session_id: gameSessionId,
    });

    if (error) {
      console.error('Failed to check if board is complete:', error);
      throw new Error(`Failed to check if board is complete: ${error.message}`);
    }

    return data === true;
  }

  // ============================================================================
  // Answer Submission
  // ============================================================================

  /**
   * Submit a Jeopardy answer with wager support
   */
  async submitJeopardyAnswer(params: {
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
   */
  async skipJeopardyQuestion(params: {
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
   */
  async clearBuzzerPresses(questionId: string): Promise<void> {
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
  async submitFinalJeopardyWager(
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
  async allFinalJeopardyWagersSubmitted(gameSessionId: string): Promise<boolean> {
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
  async getFinalJeopardyWagers(
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
  async getPlayerFinalJeopardyWager(
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
  async allFinalJeopardyAnswersSubmitted(
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
