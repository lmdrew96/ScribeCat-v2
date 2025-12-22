/**
 * JeopardyFinalRound
 *
 * Handles Final Jeopardy flow: wagers, question phase with timer, and results.
 * Rendering is delegated to JeopardyFinalRoundRenderer.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import type { JeopardyGameState } from './JeopardyTypes.js';
import { RendererSupabaseClient } from '../../../services/RendererSupabaseClient.js';

export class JeopardyFinalRound {
  private fjWagerChannel: RealtimeChannel | null = null;
  private fjTimerInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the Final Jeopardy flow
   */
  start(onStateUpdate: (updates: Partial<JeopardyGameState>) => void): void {
    console.log('[JeopardyFinalRound] Starting Final Jeopardy flow');

    // Set FJ phase to wager
    onStateUpdate({
      fjPhase: 'wager',
      fjWagers: new Map<string, number>(),
      fjMyWagerSubmitted: false,
      fjMyAnswerSubmitted: false,
      fjTimer: null,
      fjAnswers: new Map(),
    });
  }

  /**
   * Subscribe to Final Jeopardy wager submissions
   */
  subscribeToFJWagers(
    gameSessionId: string,
    onWagerReceived: (userId: string, wagerAmount: number) => void,
    onAllWagersSubmitted: () => void
  ): void {
    this.cleanupFJWagerChannel();

    const rendererClient = RendererSupabaseClient.getInstance();
    const client = rendererClient.getClient();

    if (!client) {
      console.error('[JeopardyFinalRound] No Supabase client available for FJ wager subscription');
      return;
    }

    console.log(`[JeopardyFinalRound] Setting up FJ wager subscription for game: ${gameSessionId}`);

    const channelName = `fj-wagers:${gameSessionId}`;
    this.fjWagerChannel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'final_jeopardy_wagers',
          filter: `game_session_id=eq.${gameSessionId}`,
        },
        async (payload) => {
          const data = payload.new as any;
          if (data) {
            console.log('[JeopardyFinalRound] FJ wager received:', data.user_id, data.wager_amount);
            onWagerReceived(data.user_id, data.wager_amount);

            // Check if all wagers are in
            const result = await window.scribeCat.games.jeopardy.allFJWagersSubmitted(gameSessionId);
            console.log('[JeopardyFinalRound] All FJ wagers submitted check:', result);

            if (result.success && result.allSubmitted) {
              console.log('[JeopardyFinalRound] All FJ wagers submitted!');
              onAllWagersSubmitted();
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[JeopardyFinalRound] FJ wager subscription status: ${status}`);
        if (err) {
          console.error('[JeopardyFinalRound] FJ wager subscription error:', err);
        }
      });
  }

  /**
   * Submit Final Jeopardy wager
   */
  async submitFJWager(
    gameSessionId: string,
    userId: string,
    wagerAmount: number
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`[JeopardyFinalRound] Submitting FJ wager: $${wagerAmount}`);

    const result = await window.scribeCat.games.jeopardy.submitFJWager({
      gameSessionId,
      userId,
      wagerAmount,
    });

    if (!result.success) {
      console.error('[JeopardyFinalRound] Failed to submit FJ wager:', result.error);
    }

    return result;
  }

  /**
   * Start Final Jeopardy question phase with timer
   */
  startQuestionPhase(onTimerTick: (timeRemaining: number) => void, onTimerExpired: () => void): void {
    console.log('[JeopardyFinalRound] Starting FJ question phase');

    // Start countdown timer
    let timeRemaining = 30;
    onTimerTick(timeRemaining);

    this.fjTimerInterval = setInterval(() => {
      timeRemaining -= 1;
      if (timeRemaining > 0) {
        onTimerTick(timeRemaining);
      } else {
        // Time's up!
        this.stopTimer();
        onTimerExpired();
      }
    }, 1000);
  }

  /**
   * Stop the FJ timer
   */
  stopTimer(): void {
    if (this.fjTimerInterval) {
      clearInterval(this.fjTimerInterval);
      this.fjTimerInterval = null;
    }
  }

  /**
   * Submit Final Jeopardy answer
   */
  async submitFJAnswer(
    state: JeopardyGameState,
    answer: string
  ): Promise<{ success: boolean; pointsEarned?: number; error?: string }> {
    const currentUser = state.participants.find(p => p.isCurrentUser);
    const question = state.currentQuestion;
    if (!currentUser || !question) {
      return { success: false, error: 'No user or question' };
    }

    if (state.fjMyAnswerSubmitted) {
      console.log('[JeopardyFinalRound] FJ answer already submitted');
      return { success: false, error: 'Already submitted' };
    }

    console.log(`[JeopardyFinalRound] Submitting FJ answer: ${answer}`);

    const isCorrect = question.isCorrectAnswer(answer);
    const wagerAmount = state.wagerAmount || 0;

    const result = await window.scribeCat.games.jeopardy.submitAnswer({
      gameSessionId: state.session.id,
      questionId: question.id,
      userId: currentUser.userId,
      answer,
      isCorrect,
      buzzerRank: 1, // Everyone gets rank 1 in FJ
      wagerAmount,
    });

    if (result.success) {
      console.log('[JeopardyFinalRound] FJ answer submitted. Points:', result.pointsEarned);
    } else {
      console.error('[JeopardyFinalRound] Failed to submit FJ answer:', result.error);
    }

    return result;
  }

  /**
   * Check if all players have submitted FJ answers
   */
  async checkAllFJAnswersSubmitted(
    gameSessionId: string,
    questionId: string
  ): Promise<boolean> {
    const result = await window.scribeCat.games.jeopardy.allFJAnswersSubmitted({
      gameSessionId,
      questionId,
    });

    console.log('[JeopardyFinalRound] All FJ answers submitted check:', result);
    return result.success && result.allSubmitted;
  }

  /**
   * Check if the board is complete and should advance to Final Jeopardy
   */
  async checkForFinalJeopardy(gameSessionId: string): Promise<boolean> {
    try {
      const result = await window.scribeCat.games.jeopardy.isBoardComplete(gameSessionId);
      console.log('[JeopardyFinalRound] Board complete check:', result);

      if (result.success && result.isComplete) {
        console.log('[JeopardyFinalRound] Board is complete! Advancing to Final Jeopardy...');
        const advanceResult = await window.scribeCat.games.jeopardy.advanceToFinal(gameSessionId);
        console.log('[JeopardyFinalRound] Advance to Final result:', advanceResult);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[JeopardyFinalRound] Error checking for Final Jeopardy:', error);
      return false;
    }
  }

  /**
   * Cleanup Final Jeopardy wager realtime channel
   */
  cleanupFJWagerChannel(): void {
    if (this.fjWagerChannel) {
      console.log('[JeopardyFinalRound] Cleaning up FJ wager channel');
      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();
      this.fjWagerChannel.unsubscribe();
      if (client) client.removeChannel(this.fjWagerChannel);
      this.fjWagerChannel = null;
    }
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.cleanupFJWagerChannel();
    this.stopTimer();
  }
}
