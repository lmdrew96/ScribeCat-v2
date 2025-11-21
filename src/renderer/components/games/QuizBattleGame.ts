/**
 * QuizBattleGame Component
 *
 * Competitive quiz game where players race to answer multiple-choice questions correctly.
 * Fastest correct answer gets the most points!
 */

import { MultiplayerGame, GameState } from './MultiplayerGame.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';
import { TimeSync } from '../../services/TimeSync.js';

export class QuizBattleGame extends MultiplayerGame {
  private questionStartTime: number | null = null;
  private selectedAnswer: number | null = null;
  private answerSubmitted: boolean = false;
  private timerInterval: number | null = null;
  private timeRemaining: number = 0;
  private timeSync: TimeSync = TimeSync.getInstance();
  private isRevealingAnswer: boolean = false;
  private revealTimeout: number | null = null;
  private static readonly REVEAL_DURATION_MS = 3000; // Show answer for 3 seconds

  /**
   * Initialize quiz battle game with time synchronization
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
    if (
      updates.currentQuestion &&
      previousQuestion?.id !== updates.currentQuestion.id
    ) {
      this.resetAnswerState();
    }

    // Now call parent updateState() - render will use clean state
    super.updateState(updates);

    // Start timer AFTER state is fully updated
    if (
      updates.currentQuestion &&
      previousQuestion?.id !== updates.currentQuestion.id
    ) {
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
    this.attachExitListeners();
  }

  /**
   * Handle player answer submission with synchronized timing
   */
  protected async handleAnswer(answer: string): Promise<void> {
    if (this.answerSubmitted || !this.questionStartTime) {
      return;
    }

    // Use synchronized time for fair timing across all players
    const timeTaken = this.timeSync.now() - this.questionStartTime;
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
    const isDisabled = hasAnswered || this.isRevealingAnswer;

    const optionsHtml = options
      .map((option, index) => {
        let className = 'quiz-option';

        if (this.selectedAnswer === index) {
          className += ' selected';
        }

        if (isDisabled) {
          className += ' disabled';
        }

        return `
          <button class="${className}" data-index="${index}" ${isDisabled ? 'disabled' : ''}>
            <span class="option-letter">${this.getOptionLetter(index)}</span>
            <span class="option-text">${this.escapeHtml(option)}</span>
          </button>
        `;
      })
      .join('');

    // Show "Time's Up!" in timer during reveal phase
    const timerContent = this.isRevealingAnswer
      ? `<div class="timer-text times-up">0</div>`
      : `<div class="timer-text">${Math.ceil(this.timeRemaining)}</div>`;

    return `
      <div class="quiz-battle-question-container ${this.isRevealingAnswer ? 'revealing' : ''}">
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

  // ============================================================================
  // Timer logic
  // ============================================================================

  /**
   * Start question timer using synchronized time
   * Uses TimeSync service to ensure all players see the same countdown
   * For late joiners, uses the shared questionStartedAt to sync with other players
   */
  private startQuestionTimer(): void {
    this.stopQuestionTimer();

    const { currentQuestion, questionStartedAt } = this.state;
    if (!currentQuestion) return;

    // Use shared questionStartedAt if available (for late joiner sync or mid-game question changes)
    // Otherwise use current synchronized time (host starting first question fresh)
    if (questionStartedAt !== undefined) {
      this.questionStartTime = questionStartedAt;
      // Calculate how much time has already elapsed for late joiners
      const elapsed = (this.timeSync.now() - questionStartedAt) / 1000;
      this.timeRemaining = Math.max(0, currentQuestion.timeLimitSeconds - elapsed);
      console.log(`[QuizBattleGame] Synced timer: ${elapsed.toFixed(1)}s elapsed, ${this.timeRemaining.toFixed(1)}s remaining`);
    } else {
      // No shared timestamp - set it ourselves (host starting first question fresh)
      this.questionStartTime = this.timeSync.now();
      this.timeRemaining = currentQuestion.timeLimitSeconds;
      console.log(`[QuizBattleGame] Fresh timer started: ${this.timeRemaining}s remaining`);
    }

    this.timerInterval = window.setInterval(() => {
      // Calculate elapsed time using synchronized clock
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
      // Use <= 0 instead of === 0 because timeRemaining is a float and may never exactly equal 0
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
   * Called when timer reaches 0, regardless of whether player answered
   * Shows "Time's Up!" message for a few seconds before advancing
   */
  private handleTimeUp(): void {
    // If player hasn't answered yet, mark as submitted (no answer)
    if (!this.answerSubmitted) {
      this.answerSubmitted = true;
    }

    // Enter reveal phase - show feedback before advancing
    this.isRevealingAnswer = true;
    this.render(); // Re-render to show reveal state

    // Check if this user is the host - only host should trigger question advancement
    const isHost = this.state.participants.find(p => p.isCurrentUser)?.isHost ?? false;

    // Wait for reveal duration, then advance to next question
    this.revealTimeout = window.setTimeout(() => {
      // Only the host should trigger the timeout event to advance to next question
      // This prevents multiple clients from trying to advance simultaneously
      if (isHost) {
        const event = new CustomEvent('game:timeout', {
          detail: {
            questionId: this.state.currentQuestion?.id,
          },
        });
        window.dispatchEvent(event);
      }
    }, QuizBattleGame.REVEAL_DURATION_MS);
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

    // Also attach exit listener for waiting screen
    this.attachExitListeners();
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

  /**
   * Attach exit button listeners
   */
  private attachExitListeners(): void {
    const exitBtn = this.container.querySelector('#exit-game-btn');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        const event = new CustomEvent('game:exit');
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
