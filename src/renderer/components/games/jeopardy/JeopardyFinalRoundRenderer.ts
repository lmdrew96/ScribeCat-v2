/**
 * JeopardyFinalRoundRenderer
 *
 * Rendering functions for Final Jeopardy screens (wager, question, results).
 */

import type { JeopardyGameState } from './JeopardyTypes.js';
import { getIconHTML } from '../../../utils/iconMap.js';
import { JeopardyWager } from './JeopardyWager.js';

export class JeopardyFinalRoundRenderer {
  /**
   * Render FJ wager screen
   */
  static renderFJWagerScreen(
    state: JeopardyGameState,
    renderHeader: () => string,
    renderLeaderboard: () => string,
    escapeHtml: (text: string) => string
  ): string {
    const { currentQuestion, participants, fjWagers, fjMyWagerSubmitted } = state;

    const currentUser = participants.find(p => p.isCurrentUser);
    const myScore = JeopardyWager.getPlayerScore(state, currentUser?.userId || '');
    const maxWager = Math.max(myScore, 0);

    const totalPlayers = participants.length;
    const wageredCount = fjWagers.size;

    const category = currentQuestion?.category || 'Loading...';

    return `
      <div class="jeopardy-game">
        ${renderHeader()}

        <div class="final-jeopardy-screen fj-wager-phase">
          <div class="fj-category-reveal">
            <h2 class="final-jeopardy-title">FINAL JEOPARDY!</h2>
            <div class="fj-category-box">
              <p class="fj-category-label">Category:</p>
              <h3 class="fj-category-name">${escapeHtml(category)}</h3>
            </div>

            ${fjMyWagerSubmitted ? `
              <div class="fj-wager-submitted">
                <div class="fj-check-icon">${getIconHTML('check', { size: 24 })}</div>
                <p>Your wager of <strong>$${fjWagers.get(currentUser?.userId || '') || 0}</strong> is locked in!</p>
                <p class="fj-waiting-text">Waiting for other players...</p>
              </div>
            ` : `
              <div class="fj-wager-form">
                <p class="fj-wager-label">Enter your wager:</p>
                <p class="fj-score-info">Your current score: <strong>$${myScore}</strong></p>
                <p class="fj-wager-rules">You can wager between $0 and $${maxWager}</p>
                <input
                  type="number"
                  id="fj-wager-input"
                  class="fj-wager-input"
                  min="0"
                  max="${maxWager}"
                  value="0"
                  step="100"
                />
                <button class="btn-primary fj-wager-submit-btn" id="fj-submit-wager-btn">Lock In Wager</button>
              </div>
            `}

            <div class="fj-wager-status">
              <p class="fj-wager-count">${wageredCount} of ${totalPlayers} players have wagered</p>
              <div class="fj-player-status-list">
                ${participants.map(p => {
                  const hasWagered = fjWagers.has(p.userId);
                  const name = p.userFullName || p.userEmail || 'Player';
                  return `
                    <div class="fj-player-status ${hasWagered ? 'wagered' : 'waiting'}">
                      <span class="fj-status-icon">${hasWagered ? getIconHTML('check', { size: 16 }) : getIconHTML('loader', { size: 16 })}</span>
                      <span class="fj-player-name">${escapeHtml(name)}${p.isCurrentUser ? ' (you)' : ''}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>

        ${renderLeaderboard()}
      </div>
    `;
  }

  /**
   * Render FJ question screen
   */
  static renderFJQuestionScreen(
    state: JeopardyGameState,
    renderHeader: () => string,
    renderLeaderboard: () => string,
    escapeHtml: (text: string) => string
  ): string {
    const { currentQuestion, fjTimer, fjMyAnswerSubmitted, participants } = state;

    if (!currentQuestion) {
      return `
        <div class="jeopardy-game">
          ${renderHeader()}
          <div class="game-loading">Loading Final Jeopardy question...</div>
        </div>
      `;
    }

    const options = currentQuestion.getOptions();
    const timerDisplay = fjTimer !== null ? fjTimer : '--';
    const timerClass = fjTimer !== null && fjTimer <= 10 ? 'timer-warning' : '';

    return `
      <div class="jeopardy-game">
        ${renderHeader()}

        <div class="final-jeopardy-screen fj-question-phase">
          <div class="fj-timer ${timerClass}">
            <span class="fj-timer-icon">${getIconHTML('timer', { size: 24 })}</span>
            <span class="fj-timer-value">${timerDisplay}</span>
            <span class="fj-timer-label">seconds</span>
          </div>

          <div class="fj-question-display">
            <div class="fj-category-badge">${escapeHtml(currentQuestion.category || 'Final Jeopardy')}</div>
            <div class="fj-question-text">${escapeHtml(currentQuestion.getQuestionText())}</div>
          </div>

          ${fjMyAnswerSubmitted ? `
            <div class="fj-answer-submitted">
              <div class="fj-check-icon">${getIconHTML('check', { size: 32 })}</div>
              <p>Your answer is locked in!</p>
              <p class="fj-waiting-text">Waiting for other players or timer...</p>
            </div>
          ` : `
            <div class="fj-answer-options">
              <p class="fj-answer-label">Select your answer:</p>
              <div class="fj-options-grid">
                ${options.map((option, index) => `
                  <button class="fj-option" data-index="${index}">
                    ${escapeHtml(option)}
                  </button>
                `).join('')}
              </div>
            </div>
          `}

          <div class="fj-answer-status">
            ${participants.map(p => {
              const name = p.userFullName || p.userEmail || 'Player';
              return `
                <span class="fj-participant-name">${escapeHtml(name)}${p.isCurrentUser ? ' (you)' : ''}</span>
              `;
            }).join(' • ')}
          </div>
        </div>

        ${renderLeaderboard()}
      </div>
    `;
  }

  /**
   * Render FJ results screen
   */
  static renderFJResultsScreen(
    state: JeopardyGameState,
    renderHeader: () => string,
    escapeHtml: (text: string) => string
  ): string {
    const { currentQuestion, participants, fjWagers, leaderboard } = state;

    const correctAnswer = currentQuestion?.correctAnswer || 'Unknown';
    const sortedLeaderboard = [...leaderboard].sort((a, b) => b.totalScore - a.totalScore);

    return `
      <div class="jeopardy-game">
        ${renderHeader()}

        <div class="final-jeopardy-screen fj-results-phase">
          <h2 class="fj-results-title">Final Jeopardy Results</h2>

          ${currentQuestion ? `
            <div class="fj-question-recap">
              <p class="fj-recap-category">${escapeHtml(currentQuestion.category || 'Final Jeopardy')}</p>
              <p class="fj-recap-question">${escapeHtml(currentQuestion.getQuestionText())}</p>
              <div class="fj-correct-answer">
                <span class="fj-correct-label">Correct Answer:</span>
                <span class="fj-correct-value">${escapeHtml(correctAnswer)}</span>
              </div>
            </div>
          ` : ''}

          <div class="fj-final-standings">
            <h3 class="fj-standings-title">Final Standings</h3>
            <div class="fj-standings-list">
              ${sortedLeaderboard.map((entry, index) => {
                const participant = participants.find(p => p.userId === entry.userId);
                const name = participant?.userFullName || participant?.userEmail || 'Player';
                const isCurrentUser = participant?.isCurrentUser || false;
                const wager = fjWagers.get(entry.userId) || 0;

                let placementClass = '';
                if (index === 0) placementClass = 'first-place';
                else if (index === 1) placementClass = 'second-place';
                else if (index === 2) placementClass = 'third-place';

                return `
                  <div class="fj-standing-entry ${placementClass} ${isCurrentUser ? 'current-user' : ''}">
                    <div class="fj-standing-rank">${index + 1}</div>
                    <div class="fj-standing-info">
                      <div class="fj-standing-name">${escapeHtml(name)}${isCurrentUser ? ' (you)' : ''}</div>
                      <div class="fj-standing-wager">Wagered: $${wager}</div>
                    </div>
                    <div class="fj-standing-score">$${entry.totalScore}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="fj-complete-actions">
            <button class="btn-primary" id="fj-complete-game-btn">Complete Game</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners for FJ wager screen
   */
  static attachFJWagerListeners(
    container: HTMLElement,
    state: JeopardyGameState,
    onWagerSubmit: (wager: number) => void,
    attachExitListeners: () => void
  ): void {
    const submitBtn = container.querySelector('#fj-submit-wager-btn');
    const wagerInput = container.querySelector('#fj-wager-input') as HTMLInputElement;

    if (submitBtn && wagerInput) {
      submitBtn.addEventListener('click', () => {
        const wager = parseInt(wagerInput.value);
        const currentUser = state.participants.find(p => p.isCurrentUser);
        const myScore = JeopardyWager.getPlayerScore(state, currentUser?.userId || '');
        const maxWager = Math.max(myScore, 0);

        if (!isNaN(wager) && wager >= 0 && wager <= maxWager) {
          onWagerSubmit(wager);
        } else {
          JeopardyFinalRoundRenderer.showWagerError(container, maxWager);
        }
      });
    }

    attachExitListeners();
  }

  /**
   * Attach event listeners for FJ question screen
   */
  static attachFJQuestionListeners(
    container: HTMLElement,
    state: JeopardyGameState,
    onAnswerSelect: (answer: string) => void,
    attachExitListeners: () => void
  ): void {
    const options = container.querySelectorAll('.fj-option');
    options.forEach(option => {
      option.addEventListener('click', () => {
        if (state.fjMyAnswerSubmitted) return;

        const index = parseInt(option.getAttribute('data-index') || '0');
        const question = state.currentQuestion;
        if (question) {
          const answer = question.getOptions()[index];
          onAnswerSelect(answer);
        }
      });
    });

    attachExitListeners();
  }

  /**
   * Attach event listeners for FJ results screen
   */
  static attachFJResultsListeners(
    container: HTMLElement,
    onCompleteGame: () => void
  ): void {
    const completeBtn = container.querySelector('#fj-complete-game-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', onCompleteGame);
    }
  }

  /**
   * Show wager error message
   */
  private static showWagerError(container: HTMLElement, maxWager: number): void {
    const existingError = container.querySelector('.fj-wager-error');
    if (existingError) {
      existingError.textContent = `Please enter a wager between $0 and $${maxWager}`;
    } else {
      const form = container.querySelector('.fj-wager-form');
      if (form) {
        const error = document.createElement('p');
        error.className = 'fj-wager-error';
        error.style.color = 'var(--danger-color, #e74c3c)';
        error.textContent = `Please enter a wager between $0 and $${maxWager}`;
        form.appendChild(error);
      }
    }
  }
}
