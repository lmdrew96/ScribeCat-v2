/**
 * JeopardyQuestion
 *
 * Handles question display, answer submission, and feedback rendering.
 */

import type { JeopardyGameState } from './JeopardyTypes.js';
import { JeopardyBuzzer } from './JeopardyBuzzer.js';
import { getIconHTML } from '../../../utils/iconMap.js';

export class JeopardyQuestion {
  /**
   * Handle answer submission
   */
  static async submitAnswer(
    state: JeopardyGameState,
    answer: string
  ): Promise<{ success: boolean; isCorrect: boolean; pointsEarned: number; error?: string }> {
    if (state.hasAnswered || !state.currentQuestion) {
      return { success: false, isCorrect: false, pointsEarned: 0, error: 'Already answered or no question' };
    }

    const currentUser = state.participants.find(p => p.isCurrentUser);
    if (!currentUser || !state.myBuzzerRank) {
      return { success: false, isCorrect: false, pointsEarned: 0, error: 'No user or buzzer rank' };
    }

    const question = state.currentQuestion;
    const isCorrect = question.isCorrectAnswer(answer);

    const result = await window.scribeCat.games.jeopardy.submitAnswer({
      gameSessionId: state.session.id,
      questionId: question.id,
      userId: currentUser.userId,
      answer,
      isCorrect,
      buzzerRank: state.myBuzzerRank,
      wagerAmount: state.wagerAmount || undefined,
    });

    if (result.success) {
      console.log('[JeopardyQuestion] Answer submitted. Points:', result.pointsEarned, 'Correct:', isCorrect);
    }

    return { ...result, isCorrect };
  }

  /**
   * Handle skip question (when no one else wants to answer)
   */
  static async skipQuestion(
    gameSessionId: string,
    questionId: string
  ): Promise<{ success: boolean; error?: string }> {
    console.log('[JeopardyQuestion] Skipping question - no more answers');

    const result = await window.scribeCat.games.jeopardy.skipQuestion({
      gameSessionId,
      questionId,
    });

    if (result.success) {
      console.log('[JeopardyQuestion] Question skipped, returning to board');
    } else {
      console.error('[JeopardyQuestion] Failed to skip question:', result.error);
    }

    return result;
  }

  /**
   * Set current user as the current player (after correct answer)
   */
  static async setAsCurrentPlayer(gameSessionId: string, userId: string): Promise<void> {
    await window.scribeCat.games.jeopardy.setCurrentPlayer({
      gameSessionId,
      userId,
    });
  }

  /**
   * Render question view with buzzer
   */
  static renderQuestionView(
    state: JeopardyGameState,
    renderHeader: () => string,
    renderProgress: () => string,
    renderLeaderboard: () => string,
    escapeHtml: (text: string) => string,
    ordinal: (n: number) => string
  ): string {
    const { currentQuestion } = state;
    if (!currentQuestion) return '';

    return `
      <div class="jeopardy-game">
        ${renderHeader()}
        ${renderProgress()}

        <div class="jeopardy-question-view">
          ${currentQuestion.category ? `<div class="jeopardy-category">${escapeHtml(currentQuestion.category)}</div>` : ''}

          <div class="jeopardy-clue-display">
            <div class="jeopardy-value">$${currentQuestion.points}</div>
            <div class="jeopardy-clue">${escapeHtml(currentQuestion.getQuestionText())}</div>
          </div>

          ${JeopardyBuzzer.renderBuzzerSection(state, currentQuestion, escapeHtml, ordinal)}
        </div>

        ${renderLeaderboard()}
      </div>
    `;
  }

  /**
   * Render answer feedback screen (correct/incorrect reveal)
   */
  static renderAnswerFeedback(
    state: JeopardyGameState,
    renderHeader: () => string,
    renderLeaderboard: () => string,
    escapeHtml: (text: string) => string
  ): string {
    const { feedbackQuestion, lastAnswerCorrect, lastAnswerUserId, participants } = state;
    if (!feedbackQuestion) return '';

    const answerer = participants.find(p => p.userId === lastAnswerUserId);
    const answererName = answerer?.userFullName || answerer?.userEmail || 'Player';
    const correctAnswer = feedbackQuestion.correctAnswer;

    return `
      <div class="jeopardy-game">
        ${renderHeader()}

        <div class="jeopardy-feedback-screen">
          ${feedbackQuestion.category ? `<div class="jeopardy-category">${escapeHtml(feedbackQuestion.category)}</div>` : ''}

          <div class="jeopardy-clue-display">
            <div class="jeopardy-value">$${feedbackQuestion.points}</div>
            <div class="jeopardy-clue">${escapeHtml(feedbackQuestion.getQuestionText())}</div>
          </div>

          <div class="jeopardy-answer-feedback ${lastAnswerCorrect ? 'correct' : 'incorrect'}">
            <div class="feedback-icon">${lastAnswerCorrect ? getIconHTML('check', { size: 32 }) : getIconHTML('close', { size: 32 })}</div>
            <div class="feedback-text">
              ${lastAnswerCorrect
                ? `<strong>${escapeHtml(answererName)}</strong> got it right!`
                : `<strong>${escapeHtml(answererName)}</strong> got it wrong.`
              }
            </div>
            ${lastAnswerCorrect ? `
              <div class="correct-answer">
                <p>The answer is: <strong>${escapeHtml(correctAnswer)}</strong></p>
              </div>
            ` : feedbackQuestion.isDailyDouble ? `
              <div class="correct-answer">
                <p>The answer was: <strong>${escapeHtml(correctAnswer)}</strong></p>
              </div>
            ` : `
              <div class="rebuzz-message">
                Other players can now buzz in to answer...
              </div>
            `}
          </div>
        </div>

        ${renderLeaderboard()}
      </div>
    `;
  }

  /**
   * Attach event listeners for question view
   */
  static attachQuestionListeners(
    container: HTMLElement,
    state: JeopardyGameState,
    onBuzzerPress: () => void,
    onAnswer: (answer: string) => void,
    onSkip: () => void,
    attachExitListeners: () => void
  ): void {
    // Buzzer button
    const buzzerBtn = container.querySelector('#buzz-btn');
    if (buzzerBtn) {
      buzzerBtn.addEventListener('click', onBuzzerPress);
    }

    // Answer options
    const options = container.querySelectorAll('.jeopardy-option');
    options.forEach(option => {
      option.addEventListener('click', () => {
        const index = parseInt(option.getAttribute('data-index') || '0');
        const question = state.currentQuestion;
        if (question) {
          const answer = question.getOptions()[index];
          onAnswer(answer);
        }
      });
    });

    // Skip question button
    const skipBtn = container.querySelector('#skip-question-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', onSkip);
    }

    attachExitListeners();
  }
}
