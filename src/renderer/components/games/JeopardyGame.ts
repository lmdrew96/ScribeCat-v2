/**
 * JeopardyGame Component
 *
 * Jeopardy-style game with categories and point values.
 * Similar to Quiz Battle but with category-based organization.
 */

import { MultiplayerGame, GameState } from './MultiplayerGame.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';
import { TimeSync } from '../../services/TimeSync.js';

export class JeopardyGame extends MultiplayerGame {
  private selectedAnswer: number | null = null;
  private questionStartTime: number | null = null;
  private answerSubmitted: boolean = false;
  private timerInterval: number | null = null;
  private timeRemaining: number = 0;
  private isRevealingAnswer: boolean = false;
  private revealTimeout: number | null = null;
  private timeSync: TimeSync = TimeSync.getInstance();
  private static readonly REVEAL_DURATION_MS = 3000; // Show answer for 3 seconds

  /**
   * Initialize Jeopardy game with time synchronization
   */
  public async initialize(): Promise<void> {
    await super.initialize();

    // Initialize time sync for fair timing across all players
    if (!this.timeSync.isSynced()) {
      await this.timeSync.initialize();
    }

    this.startQuestionTimer();
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    this.stopQuestionTimer();
    if (this.revealTimeout !== null) {
      clearTimeout(this.revealTimeout);
      this.revealTimeout = null;
    }
    await super.cleanup();
  }

  /**
   * Update game state and handle question changes
   */
  public updateState(updates: Partial<GameState>): void {
    const previousQuestion = this.state.currentQuestion;

    // Reset answer state BEFORE calling super.updateState() (which calls render())
    // This ensures the render uses clean state, not stale selectedAnswer value
    if (updates.currentQuestion && previousQuestion?.id !== updates.currentQuestion.id) {
      this.resetAnswerState();
    }

    // Now call parent updateState() - render will use clean state
    super.updateState(updates);

    // Start timer AFTER state is fully updated
    if (updates.currentQuestion && previousQuestion?.id !== updates.currentQuestion.id) {
      this.startQuestionTimer();
    }

    // Stop timer if game ended
    if (updates.gameEnded) {
      this.stopQuestionTimer();
    }
  }

  /**
   * Start question timer using synchronized time
   */
  private startQuestionTimer(): void {
    this.stopQuestionTimer();

    const { currentQuestion, questionStartedAt } = this.state;
    if (!currentQuestion) return;

    // Use shared questionStartedAt if available (for late joiner sync)
    if (questionStartedAt !== undefined) {
      this.questionStartTime = questionStartedAt;
      const elapsed = (this.timeSync.now() - questionStartedAt) / 1000;
      this.timeRemaining = Math.max(0, currentQuestion.timeLimitSeconds - elapsed);
    } else {
      this.questionStartTime = this.timeSync.now();
      this.timeRemaining = currentQuestion.timeLimitSeconds;
    }

    this.timerInterval = window.setInterval(() => {
      const elapsed = (this.timeSync.now() - this.questionStartTime!) / 1000;
      this.timeRemaining = Math.max(0, currentQuestion.timeLimitSeconds - elapsed);

      // Update timer display
      const timerText = this.container.querySelector('.timer-text');
      if (timerText) {
        timerText.textContent = Math.ceil(this.timeRemaining).toString();
      }

      const timerCircle = this.container.querySelector('.circle');
      if (timerCircle) {
        (timerCircle as SVGPathElement).setAttribute('stroke-dasharray', this.getTimerDasharray());
      }

      // Time's up - handle timeout
      if (this.timeRemaining <= 0) {
        this.stopQuestionTimer();
        this.handleTimeUp();
      }
    }, 100);
  }

  /**
   * Stop question timer
   */
  private stopQuestionTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Handle time running out
   */
  private handleTimeUp(): void {
    if (!this.answerSubmitted) {
      this.answerSubmitted = true;
    }

    this.isRevealingAnswer = true;
    this.render();

    // Only host triggers advancement
    const isHost = this.state.participants.find(p => p.isCurrentUser)?.isHost ?? false;

    this.revealTimeout = window.setTimeout(() => {
      if (isHost) {
        const event = new CustomEvent('game:timeout', {
          detail: { questionId: this.state.currentQuestion?.id },
        });
        window.dispatchEvent(event);
      }
    }, JeopardyGame.REVEAL_DURATION_MS);
  }

  /**
   * Get timer circle dash array for progress
   */
  private getTimerDasharray(): string {
    const { currentQuestion } = this.state;
    if (!currentQuestion) return '0, 100';

    const percentage = (this.timeRemaining / currentQuestion.timeLimitSeconds) * 100;
    return `${percentage}, 100`;
  }

  /**
   * Reset answer state for new question
   */
  private resetAnswerState(): void {
    this.selectedAnswer = null;
    this.answerSubmitted = false;
    this.questionStartTime = null;
    this.isRevealingAnswer = false;
    if (this.revealTimeout !== null) {
      clearTimeout(this.revealTimeout);
      this.revealTimeout = null;
    }
  }

  protected render(): void {
    const { gameStarted, gameEnded, currentQuestion } = this.state;

    if (gameEnded) {
      this.container.innerHTML = this.renderGameComplete();
      this.attachCompleteListeners();
      return;
    }

    if (!gameStarted) {
      this.container.innerHTML = this.renderWaitingScreen();
      this.attachWaitingListeners();
      return;
    }

    if (!currentQuestion) {
      this.container.innerHTML = '<div class="game-loading">Loading question...</div>';
      return;
    }

    this.container.innerHTML = `
      <div class="jeopardy-game">
        ${this.renderHeader()}
        ${this.renderProgress()}
        ${this.renderJeopardyQuestion(currentQuestion)}
        ${this.renderLeaderboard()}
      </div>
    `;

    this.attachAnswerListeners();
    this.attachExitListeners();
  }

  private renderJeopardyQuestion(question: GameQuestion): string {
    const options = question.getOptions();
    const { hasAnswered } = this.state;
    const isDisabled = hasAnswered || this.isRevealingAnswer;

    const optionsHtml = options
      .map(
        (option, index) => `
        <button class="jeopardy-option ${this.selectedAnswer === index ? 'selected' : ''}"
                data-index="${index}" ${isDisabled ? 'disabled' : ''}>
          ${this.escapeHtml(option)}
        </button>
      `
      )
      .join('');

    // Show "Time's Up!" in timer during reveal phase
    const timerContent = this.isRevealingAnswer
      ? `<div class="timer-text times-up">0</div>`
      : `<div class="timer-text">${Math.ceil(this.timeRemaining)}</div>`;

    return `
      <div class="jeopardy-question-container ${this.isRevealingAnswer ? 'revealing' : ''}">
        <div class="question-timer ${this.isRevealingAnswer ? 'times-up' : ''}">
          <div class="timer-circle">
            <svg viewBox="0 0 36 36" class="circular-chart">
              <path class="circle-bg"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path class="circle"
                stroke-dasharray="${this.isRevealingAnswer ? '0, 100' : this.getTimerDasharray()}"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            ${timerContent}
          </div>
        </div>

        ${question.category ? `<div class="jeopardy-category">${this.escapeHtml(question.category)}</div>` : ''}
        <div class="jeopardy-board">
          <div class="jeopardy-clue">${this.escapeHtml(question.getQuestionText())}</div>
          <div class="jeopardy-value">${question.points} Points</div>
        </div>
        <div class="jeopardy-responses">
          ${optionsHtml}
        </div>
        ${this.isRevealingAnswer ? this.renderTimeUpFeedback() : (hasAnswered ? this.renderAnswerFeedback() : '')}
      </div>
    `;
  }

  /**
   * Render answer feedback after submission
   */
  private renderAnswerFeedback(): string {
    return `
      <div class="answer-feedback">
        <div class="feedback-message">
          Answer submitted! Waiting for other players...
        </div>
        <div class="feedback-subtitle">
          Get ready for the next question
        </div>
      </div>
    `;
  }

  /**
   * Render time's up feedback during reveal phase
   */
  private renderTimeUpFeedback(): string {
    const hasAnswer = this.selectedAnswer !== null;
    return `
      <div class="answer-feedback times-up-feedback">
        <div class="feedback-message times-up-message">
          Time's Up!
        </div>
        <div class="feedback-subtitle">
          ${hasAnswer ? 'Your answer has been recorded.' : 'No answer submitted.'}
          Next question coming up...
        </div>
      </div>
    `;
  }

  /**
   * Handle player answer submission with synchronized timing
   */
  protected async handleAnswer(answer: string): Promise<void> {
    if (this.answerSubmitted || !this.questionStartTime) return;

    // Use synchronized time for fair timing across all players
    const timeTaken = this.timeSync.now() - this.questionStartTime;
    this.answerSubmitted = true;

    const event = new CustomEvent('game:answer', {
      detail: { answer, timeTakenMs: timeTaken },
    });
    window.dispatchEvent(event);
    this.updateState({ hasAnswered: true });
  }

  protected getInstructions(): string {
    return 'Answer Jeopardy-style questions by category! Remember to phrase your answer as a question.';
  }

  private attachAnswerListeners(): void {
    const options = this.container.querySelectorAll('.jeopardy-option');
    options.forEach((option) => {
      option.addEventListener('click', () => {
        if (this.answerSubmitted) return;

        const index = parseInt((option as HTMLElement).dataset.index || '0');
        this.selectedAnswer = index;

        const { currentQuestion } = this.state;
        if (!currentQuestion) return;

        const answer = currentQuestion.getOptions()[index];
        this.handleAnswer(answer);

        // Update UI immediately
        this.updateState({ hasAnswered: true });
      });
    });
  }

  private attachWaitingListeners(): void {
    const startBtn = this.container.querySelector('#start-game-btn');
    startBtn?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:start'));
    });

    // Also attach exit listener for waiting screen
    this.attachExitListeners();
  }

  private attachCompleteListeners(): void {
    const closeBtn = this.container.querySelector('#close-game-btn');
    closeBtn?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:close'));
    });
  }

  private attachExitListeners(): void {
    const exitBtn = this.container.querySelector('#exit-game-btn');
    exitBtn?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:exit'));
    });
  }
}
