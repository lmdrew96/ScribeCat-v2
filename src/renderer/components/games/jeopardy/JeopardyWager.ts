/**
 * JeopardyWager
 *
 * Handles Daily Double and legacy Final Jeopardy wager screens.
 */

import type { JeopardyGameState } from './JeopardyTypes.js';

export class JeopardyWager {
  /**
   * Get player's current score from leaderboard
   */
  static getPlayerScore(state: JeopardyGameState, userId: string): number {
    const entry = state.leaderboard.find(e => e.userId === userId);
    return entry?.totalScore || 0;
  }

  /**
   * Render Daily Double wager screen
   */
  static renderDailyDoubleWager(
    state: JeopardyGameState,
    renderHeader: () => string,
    renderLeaderboard: () => string,
    escapeHtml: (text: string) => string
  ): string {
    const { currentQuestion, participants } = state;
    if (!currentQuestion) return '';

    const currentUser = participants.find(p => p.isCurrentUser);
    const myScore = JeopardyWager.getPlayerScore(state, currentUser?.userId || '');
    // In Jeopardy, max Daily Double wager is either your score OR the highest clue value (1000), whichever is greater
    // Minimum wager is $5
    const maxBoardValue = 1000;
    const maxWager = Math.max(myScore, maxBoardValue, 5);

    return `
      <div class="jeopardy-game">
        ${renderHeader()}

        <div class="daily-double-screen">
          <div class="daily-double-reveal">
            <h2 class="daily-double-title">DAILY DOUBLE!</h2>
            <p class="daily-double-category">Category: ${escapeHtml(currentQuestion.category || 'Unknown')}</p>

            <div class="daily-double-wager-form">
              <label for="wager-input">Enter your wager:</label>
              <p class="wager-rules">You can wager up to $${maxWager}</p>
              <input
                type="number"
                id="wager-input"
                min="5"
                max="${maxWager}"
                value="${currentQuestion.points}"
                step="100"
              />
              <button class="btn-primary" id="submit-wager-btn">Submit Wager</button>
            </div>
          </div>
        </div>

        ${renderLeaderboard()}
      </div>
    `;
  }

  /**
   * Render Final Jeopardy wager screen (legacy version)
   */
  static renderFinalJeopardyWager(
    state: JeopardyGameState,
    renderHeader: () => string,
    renderLeaderboard: () => string,
    escapeHtml: (text: string) => string,
    completeGame: () => Promise<void>
  ): string {
    const { currentQuestion, participants } = state;
    if (!currentQuestion) {
      console.warn('[JeopardyWager] Final Jeopardy wager but no question - completing game');
      // No Final Jeopardy question exists, complete the game
      setTimeout(() => completeGame(), 100);
      return `
        <div class="jeopardy-game">
          ${renderHeader()}
          <div class="game-loading">No Final Jeopardy question found. Completing game...</div>
        </div>
      `;
    }

    const currentUser = participants.find(p => p.isCurrentUser);
    const myScore = JeopardyWager.getPlayerScore(state, currentUser?.userId || '');
    const maxWager = Math.max(myScore, 0);

    return `
      <div class="jeopardy-game">
        ${renderHeader()}

        <div class="final-jeopardy-screen">
          <div class="final-jeopardy-wager">
            <h2 class="final-jeopardy-title">FINAL JEOPARDY!</h2>
            <p class="final-jeopardy-category">Category: ${escapeHtml(currentQuestion.category || 'Unknown')}</p>

            <div class="final-jeopardy-wager-form">
              <label for="final-wager-input">Enter your wager:</label>
              <p class="wager-rules">Current score: $${myScore}<br/>You can wager up to $${maxWager}</p>
              <input
                type="number"
                id="final-wager-input"
                min="0"
                max="${maxWager}"
                value="0"
                step="100"
              />
              <button class="btn-primary" id="submit-final-wager-btn">Lock In Wager</button>
            </div>
          </div>
        </div>

        ${renderLeaderboard()}
      </div>
    `;
  }

  /**
   * Attach event listeners for Daily Double wager
   */
  static attachDailyDoubleWagerListeners(
    container: HTMLElement,
    state: JeopardyGameState,
    onWagerSubmit: (wager: number) => void,
    attachExitListeners: () => void
  ): void {
    const submitBtn = container.querySelector('#submit-wager-btn');
    const wagerInput = container.querySelector('#wager-input') as HTMLInputElement;

    if (submitBtn && wagerInput) {
      submitBtn.addEventListener('click', () => {
        const wager = parseInt(wagerInput.value);
        const currentUser = state.participants.find(p => p.isCurrentUser);
        const myScore = JeopardyWager.getPlayerScore(state, currentUser?.userId || '');
        const maxBoardValue = 1000;
        const maxWager = Math.max(myScore, maxBoardValue, 5);

        if (!isNaN(wager) && wager >= 5 && wager <= maxWager) {
          onWagerSubmit(wager);
        } else {
          // Show error - invalid wager amount
          JeopardyWager.showWagerError(container, '.daily-double-wager-form', maxWager, 5);
        }
      });
    }

    attachExitListeners();
  }

  /**
   * Attach event listeners for Final Jeopardy wager (legacy)
   */
  static attachFinalWagerListeners(
    container: HTMLElement,
    state: JeopardyGameState,
    onWagerSubmit: (wager: number) => void,
    attachExitListeners: () => void
  ): void {
    const submitBtn = container.querySelector('#submit-final-wager-btn');
    const wagerInput = container.querySelector('#final-wager-input') as HTMLInputElement;

    if (submitBtn && wagerInput) {
      submitBtn.addEventListener('click', () => {
        const wager = parseInt(wagerInput.value);
        const currentUser = state.participants.find(p => p.isCurrentUser);
        const myScore = JeopardyWager.getPlayerScore(state, currentUser?.userId || '');
        const maxWager = Math.max(myScore, 0);

        if (!isNaN(wager) && wager >= 0 && wager <= maxWager) {
          onWagerSubmit(wager);
        } else {
          // Show error - invalid wager amount
          JeopardyWager.showWagerError(container, '.final-jeopardy-wager-form', maxWager, 0);
        }
      });
    }

    attachExitListeners();
  }

  /**
   * Show wager error message
   */
  private static showWagerError(
    container: HTMLElement,
    formSelector: string,
    maxWager: number,
    minWager: number
  ): void {
    const errorEl = container.querySelector('.wager-error');
    const errorMessage = `Please enter a wager between $${minWager} and $${maxWager}`;

    if (errorEl) {
      errorEl.textContent = errorMessage;
    } else {
      const form = container.querySelector(formSelector);
      if (form) {
        const error = document.createElement('p');
        error.className = 'wager-error';
        error.style.color = 'var(--danger-color, #e74c3c)';
        error.textContent = errorMessage;
        form.appendChild(error);
      }
    }
  }
}
