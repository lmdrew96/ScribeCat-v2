/**
 * JeopardyBuzzer
 *
 * Handles buzzer subscriptions, presses, and buzzer UI rendering.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import type { JeopardyGameState, BuzzerPress } from './JeopardyTypes.js';
import { GameQuestion } from '../../../../domain/entities/GameQuestion.js';
import { RendererSupabaseClient } from '../../../services/RendererSupabaseClient.js';
import { getIconHTML } from '../../../utils/iconMap.js';

export class JeopardyBuzzer {
  private buzzerChannel: RealtimeChannel | null = null;

  /**
   * Subscribe to buzzer presses for the current question
   * Uses direct Supabase Realtime in renderer (WebSockets don't work in main process)
   */
  subscribeToBuzzers(
    questionId: string,
    participants: JeopardyGameState['participants'],
    onBuzzerPress: (updates: Partial<JeopardyGameState>) => void
  ): void {
    // Cleanup any existing buzzer subscription first
    this.cleanup();

    const rendererClient = RendererSupabaseClient.getInstance();
    const client = rendererClient.getClient();

    if (!client) {
      console.error('[JeopardyBuzzer] No Supabase client available for buzzer subscription');
      return;
    }

    console.log(`[JeopardyBuzzer] Setting up direct buzzer subscription for question: ${questionId}`);

    const channelName = `buzzer-presses:${questionId}`;
    this.buzzerChannel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'buzzer_presses',
          filter: `question_id=eq.${questionId}`,
        },
        (payload) => {
          const newRecord = payload.new as any;
          const buzzer: BuzzerPress = {
            userId: newRecord.user_id,
            buzzerRank: newRecord.buzzer_rank,
            pressedAt: new Date(newRecord.pressed_at),
          };

          console.log('[JeopardyBuzzer] Buzzer press received via Realtime:', buzzer);

          // Find current user
          const currentUser = participants.find(p => p.isCurrentUser);

          // Build updates
          const updates: Partial<JeopardyGameState> = {
            buzzerEnabled: false, // Disable buzzer after first press
          };

          // Update first buzzer if this is rank 1
          if (buzzer.buzzerRank === 1) {
            updates.firstBuzzerId = buzzer.userId;
          }

          // Check if current user buzzed
          if (buzzer.userId === currentUser?.userId) {
            updates.myBuzzerRank = buzzer.buzzerRank;
          }

          onBuzzerPress(updates);
        }
      )
      .subscribe((status, err) => {
        console.log(`[JeopardyBuzzer] Buzzer subscription status: ${status}`);
        if (err) {
          console.error('[JeopardyBuzzer] Buzzer subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log(`[JeopardyBuzzer] Buzzer subscription active for question: ${questionId}`);
        }
      });
  }

  /**
   * Handle buzzer press
   */
  async handleBuzzerPress(
    state: JeopardyGameState
  ): Promise<{ success: boolean; buzzerRank?: number; error?: string }> {
    console.log('[JeopardyBuzzer] handleBuzzerPress() called - buzzerEnabled:', state.buzzerEnabled, 'hasQuestion:', !!state.currentQuestion);

    if (!state.buzzerEnabled || !state.currentQuestion) {
      console.log('[JeopardyBuzzer] Buzzer press ignored - buzzer not enabled or no question');
      return { success: false, error: 'Buzzer not enabled' };
    }

    const currentUser = state.participants.find(p => p.isCurrentUser);
    if (!currentUser) {
      console.error('[JeopardyBuzzer] Cannot buzz - no current user found');
      return { success: false, error: 'No current user' };
    }

    console.log('[JeopardyBuzzer] Calling buzzIn API...');
    const result = await window.scribeCat.games.jeopardy.buzzIn({
      gameSessionId: state.session.id,
      questionId: state.currentQuestion.id,
      userId: currentUser.userId,
    });

    console.log('[JeopardyBuzzer] buzzIn API result:', result);

    if (result.success) {
      console.log('[JeopardyBuzzer] Buzzed in successfully! Rank:', result.buzzerRank);
    } else {
      console.error('[JeopardyBuzzer] Failed to buzz in:', result.error);
    }

    return result;
  }

  /**
   * Clear buzzer presses in database for rebuzz
   */
  async clearBuzzers(questionId: string): Promise<void> {
    try {
      await window.scribeCat.games.jeopardy.clearBuzzers(questionId);
      console.log('[JeopardyBuzzer] Buzzer presses cleared for rebuzz');
    } catch (error) {
      console.error('[JeopardyBuzzer] Failed to clear buzzer presses:', error);
    }
  }

  /**
   * Cleanup buzzer realtime channel
   */
  cleanup(): void {
    if (this.buzzerChannel) {
      console.log('[JeopardyBuzzer] Cleaning up buzzer channel');
      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();
      this.buzzerChannel.unsubscribe();
      if (client) client.removeChannel(this.buzzerChannel);
      this.buzzerChannel = null;
    }
  }

  /**
   * Render buzzer section based on state
   */
  static renderBuzzerSection(
    state: JeopardyGameState,
    question: GameQuestion,
    escapeHtml: (text: string) => string,
    ordinal: (n: number) => string
  ): string {
    const {
      buzzerEnabled,
      myBuzzerRank,
      firstBuzzerId,
      participants,
      hasAnswered,
      currentPlayerId,
      playersWhoAnsweredWrong,
    } = state;

    const currentUser = participants.find(p => p.isCurrentUser);
    const isSelectingPlayer = currentPlayerId === currentUser?.userId;
    const isFirstBuzzer = firstBuzzerId === currentUser?.userId;
    const canAnswer = isFirstBuzzer && !hasAnswered;

    // For Daily Doubles: only the selecting player can answer
    const isDailyDouble = question.isDailyDouble;
    const canAnswerDailyDouble = isDailyDouble && isSelectingPlayer && !hasAnswered;

    const options = question.getOptions();

    // DAILY DOUBLE LOGIC
    if (isDailyDouble) {
      // Selecting player can answer
      if (canAnswerDailyDouble) {
        return `
          <div class="jeopardy-answer-section">
            <p class="buzzer-status your-turn-buzz">Daily Double! Select your answer:</p>
            <div class="jeopardy-options">
              ${options.map((option, index) => `
                <button class="jeopardy-option" data-index="${index}">
                  ${escapeHtml(option)}
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      // Selecting player has answered
      if (isSelectingPlayer && hasAnswered) {
        return `
          <div class="buzzer-status buzzer-locked">
            Answer submitted! Waiting for result...
          </div>
        `;
      }

      // Other players wait
      const selectingParticipant = participants.find(p => p.userId === currentPlayerId);
      const selectingPlayerName = selectingParticipant?.userFullName || selectingParticipant?.userEmail || 'the player';
      return `
        <div class="buzzer-status buzzer-locked">
          Daily Double! Waiting for ${escapeHtml(selectingPlayerName)} to answer...
        </div>
      `;
    }

    // REGULAR QUESTION LOGIC
    // Check if firstBuzzerId has already answered wrong (rebuzz scenario)
    const firstBuzzerAnsweredWrong = firstBuzzerId && playersWhoAnsweredWrong.has(firstBuzzerId);

    // If firstBuzzer already answered wrong, treat rank=1 as effective first buzzer
    const isEffectiveFirstBuzzer = isFirstBuzzer || (myBuzzerRank === 1 && firstBuzzerAnsweredWrong);
    const canAnswerRebuzz = isEffectiveFirstBuzzer && !hasAnswered;

    // If current user can answer (first buzzer or effective first buzzer after rebuzz)
    if (canAnswer || canAnswerRebuzz) {
      return `
        <div class="jeopardy-answer-section">
          <p class="buzzer-status your-turn-buzz">You buzzed in first! Select your answer:</p>
          <div class="jeopardy-options">
            ${options.map((option, index) => `
              <button class="jeopardy-option" data-index="${index}">
                ${escapeHtml(option)}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    // If current user has answered, show waiting message
    if (myBuzzerRank !== null && !canAnswer && !canAnswerRebuzz) {
      // If firstBuzzer already answered wrong, don't show "they're answering"
      if (firstBuzzerAnsweredWrong) {
        // In rebuzz, we're waiting for someone to buzz
        return `
          <div class="buzzer-status">
            You buzzed in ${ordinal(myBuzzerRank)}. Waiting for first buzzer to answer...
          </div>
        `;
      }

      return `
        <div class="buzzer-status buzzer-locked">
          ${isFirstBuzzer
            ? 'Answer submitted! Waiting for result...'
            : `You buzzed in ${ordinal(myBuzzerRank)}. ${(() => {
                const firstPlayer = participants.find(p => p.userId === firstBuzzerId);
                return firstPlayer?.userFullName || firstPlayer?.userEmail || 'Another player';
              })()} is answering...`
          }
        </div>
      `;
    }

    // Check if current user already answered wrong (can't buzz again)
    const alreadyAnsweredWrong = currentUser && playersWhoAnsweredWrong.has(currentUser.userId);
    const hasWrongAnswers = playersWhoAnsweredWrong.size > 0;

    // If user already got it wrong, show skip button
    if (alreadyAnsweredWrong) {
      return `
        <div class="jeopardy-buzzer-section">
          <div class="buzzer-status buzzer-locked">
            You already answered this question.
          </div>
          <button class="jeopardy-skip-btn" id="skip-question-btn">
            Skip Question (No Points)
          </button>
        </div>
      `;
    }

    // Otherwise, show buzzer button with optional skip
    return `
      <div class="jeopardy-buzzer-section">
        <button
          class="jeopardy-buzzer-btn ${!buzzerEnabled ? 'disabled' : ''}"
          id="buzz-btn"
          ${!buzzerEnabled ? 'disabled' : ''}
        >
          <span class="buzzer-icon">${getIconHTML('bell', { size: 24 })}</span>
          <span class="buzzer-text">${buzzerEnabled ? 'BUZZ IN!' : 'Buzzer Locked'}</span>
        </button>
        ${myBuzzerRank ? `<p class="buzzer-rank">You buzzed in ${ordinal(myBuzzerRank)}</p>` : ''}
        ${hasWrongAnswers ? `
          <button class="jeopardy-skip-btn secondary" id="skip-question-btn">
            I Don't Know
          </button>
        ` : ''}
      </div>
    `;
  }
}
