/**
 * QuizBattleGame Component
 *
 * Competitive quiz game where players race to answer multiple-choice questions correctly.
 * Fastest correct answer gets the most points!
 */

import { MultiplayerGame, GameState } from './MultiplayerGame.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';

export class QuizBattleGame extends MultiplayerGame {
  private questionStartTime: number | null = null;
  private selectedAnswer: number | null = null;
  private answerSubmitted: boolean = false;
  private timerInterval: number | null = null;
  private timeRemaining: number = 0;

  /**
   * Initialize quiz battle game
   */
  public async initialize(): Promise<void> {
    await super.initialize();
    this.startQuestionTimer();
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    this.stopQuestionTimer();
    await super.cleanup();
  }

  /**
   * Update game state and handle question changes
   */
  public updateState(updates: Partial<GameState>): void {
    const previousQuestion = this.state.currentQuestion;
    super.updateState(updates);

    // Reset answer state when question changes
    if (
      updates.currentQuestion &&
      previousQuestion?.id !== updates.currentQuestion.id
    ) {
      this.resetAnswerState();
      this.startQuestionTimer();
    }

    // Stop timer if game ended
    if (updates.gameEnded) {
      this.stopQuestionTimer();
    }
  }

  // ============================================================================
  // Abstract method implementations
  // ============================================================================

  /**
   * Render the game UI
   */
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
      this.container.innerHTML = `
        <div class="game-loading">
          <div class="loading-spinner"></div>
          <p>Loading next question...</p>
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="quiz-battle-game">
        ${this.renderHeader()}
        ${this.renderProgress()}
        ${this.renderQuestion(currentQuestion)}
        ${this.renderLeaderboard()}
      </div>
    `;

    this.attachAnswerListeners();
  }

  /**
   * Handle player answer submission
   */
  protected async handleAnswer(answer: string): Promise<void> {
    if (this.answerSubmitted || !this.questionStartTime) {
      return;
    }

    const timeTaken = Date.now() - this.questionStartTime;
    this.answerSubmitted = true;

    // Emit answer event (will be handled by MultiplayerGamesManager)
    const event = new CustomEvent('game:answer', {
      detail: {
        answer,
        timeTaken,
      },
    });
    window.dispatchEvent(event);
  }

  /**
   * Get game-specific instructions
   */
  protected getInstructions(): string {
    return 'Answer questions as fast as you can! Speed and accuracy both count for points.';
  }

  // ============================================================================
  // Quiz Battle specific rendering
  // ============================================================================

  /**
   * Render the current question
   */
  private renderQuestion(question: GameQuestion): string {
    const options = question.getOptions();
    const { hasAnswered } = this.state;

    const optionsHtml = options
      .map((option, index) => {
        let className = 'quiz-option';

        if (this.selectedAnswer === index) {
          className += ' selected';
        }

        if (hasAnswered) {
          className += ' disabled';
        }

        return `
          <button class="${className}" data-index="${index}" ${hasAnswered ? 'disabled' : ''}>
            <span class="option-letter">${this.getOptionLetter(index)}</span>
            <span class="option-text">${this.escapeHtml(option)}</span>
          </button>
        `;
      })
      .join('');

    return `
      <div class="quiz-battle-question-container">
        <div class="question-timer">
          <div class="timer-circle">
            <svg viewBox="0 0 36 36" class="circular-chart">
              <path class="circle-bg"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path class="circle"
                stroke-dasharray="${this.getTimerDasharray()}"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div class="timer-text">${Math.ceil(this.timeRemaining)}</div>
          </div>
        </div>

        <div class="question-card">
          <h3 class="question-text">${this.escapeHtml(question.getQuestionText())}</h3>

          ${question.category ? `<div class="question-category">${this.escapeHtml(question.category)}</div>` : ''}

          <div class="question-difficulty">
            <span class="difficulty-badge difficulty-${question.difficulty || 'medium'}">
              ${question.getDifficultyText()}
            </span>
            <span class="question-points">${question.points} pts</span>
          </div>
        </div>

        <div class="quiz-options">
          ${optionsHtml}
        </div>

        ${hasAnswered ? this.renderAnswerFeedback() : ''}
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
          ✅ Answer submitted! Waiting for other players...
        </div>
        <div class="feedback-subtitle">
          Get ready for the next question
        </div>
      </div>
    `;
  }

  // ============================================================================
  // Timer logic
  // ============================================================================

  /**
   * Start question timer
   */
  private startQuestionTimer(): void {
    this.stopQuestionTimer();

    const { currentQuestion } = this.state;
    if (!currentQuestion) return;

    this.questionStartTime = Date.now();
    this.timeRemaining = currentQuestion.timeLimitSeconds;

    this.timerInterval = window.setInterval(() => {
      this.timeRemaining = Math.max(
        0,
        currentQuestion.timeLimitSeconds - (Date.now() - this.questionStartTime!) / 1000
      );

      // Update timer display
      const timerText = this.container.querySelector('.timer-text');
      if (timerText) {
        timerText.textContent = Math.ceil(this.timeRemaining).toString();
      }

      const timerCircle = this.container.querySelector('.circle');
      if (timerCircle) {
        (timerCircle as SVGPathElement).setAttribute('stroke-dasharray', this.getTimerDasharray());
      }

      // Time's up - auto-submit if not already answered
      if (this.timeRemaining === 0 && !this.answerSubmitted) {
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
    this.answerSubmitted = true;

    // Emit timeout event
    const event = new CustomEvent('game:timeout', {
      detail: {
        questionId: this.state.currentQuestion?.id,
      },
    });
    window.dispatchEvent(event);
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
  }

  // ============================================================================
  // Event listeners
  // ============================================================================

  /**
   * Attach answer listeners
   */
  private attachAnswerListeners(): void {
    const options = this.container.querySelectorAll('.quiz-option');
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

  /**
   * Attach waiting screen listeners
   */
  private attachWaitingListeners(): void {
    const startBtn = this.container.querySelector('#start-game-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const event = new CustomEvent('game:start');
        window.dispatchEvent(event);
      });
    }
  }

  /**
   * Attach game complete listeners
   */
  private attachCompleteListeners(): void {
    const closeBtn = this.container.querySelector('#close-game-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const event = new CustomEvent('game:close');
        window.dispatchEvent(event);
      });
    }
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  /**
   * Get option letter (A, B, C, D)
   */
  private getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index); // A, B, C, D...
  }
}
