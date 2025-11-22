/**
 * QuizBattleGame Component
 *
 * Competitive quiz game where players race to answer multiple-choice questions correctly.
 * Fastest correct answer gets the most points!
 */

import { MultiplayerGame, GameState } from './MultiplayerGame.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';
import { TimeSync } from '../../services/TimeSync.js';
import { GameTimer } from '../../services/GameTimer.js';

export class QuizBattleGame extends MultiplayerGame {
  private selectedAnswer: number | null = null;
  private answerSubmitted: boolean = false;
  private timeSync: TimeSync = TimeSync.getInstance();
  private gameTimer: GameTimer = new GameTimer();

  // Answer reveal state (set after player submits)
  private correctAnswerIndex: number | null = null;
  private wasCorrect: boolean = false;
  private explanation: string | undefined = undefined;
  private boundHandleAnswerReveal: ((event: Event) => void) | null = null;

  /**
   * Initialize quiz battle game with time synchronization
   */
  public async initialize(): Promise<void> {
    await super.initialize();

    // Initialize time sync for fair timing across all players
    if (!this.timeSync.isSynced()) {
      await this.timeSync.initialize();
    }

    // Listen for answer reveal events
    this.boundHandleAnswerReveal = this.handleAnswerReveal.bind(this);
    window.addEventListener('game:answer-reveal', this.boundHandleAnswerReveal);

    this.startQuestionTimer();
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    this.gameTimer.cleanup();
    if (this.boundHandleAnswerReveal) {
      window.removeEventListener('game:answer-reveal', this.boundHandleAnswerReveal);
    }
    await super.cleanup();
  }

  /**
   * Update game state and handle question changes
   */
  public updateState(updates: Partial<GameState>): void {
    const previousQuestion = this.state.currentQuestion;
    const wasGameStarted = this.state.gameStarted; // Track if game was started before update

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

    // Start timer when:
    // 1. Question changes, OR
    // 2. Game just started (transitioned from waiting to started)
    if (
      (updates.currentQuestion && previousQuestion?.id !== updates.currentQuestion.id) ||
      (!wasGameStarted && this.state.gameStarted && this.state.currentQuestion)
    ) {
      this.startQuestionTimer();
    }

    // Stop timer if game ended
    if (updates.gameEnded) {
      this.gameTimer.stop();
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
    if (this.answerSubmitted) {
      return;
    }

    const startTime = this.gameTimer.getStartTime();
    if (!startTime) return;

    // Use synchronized time for fair timing across all players
    const timeTaken = Math.round(this.timeSync.now() - startTime);
    this.answerSubmitted = true;

    // Emit answer event (will be handled by MultiplayerGamesManager)
    const event = new CustomEvent('game:answer', {
      detail: {
        answer,
        timeTakenMs: timeTaken,
      },
    });
    window.dispatchEvent(event);
  }

  /**
   * Handle answer reveal event from MultiplayerGamesManager
   */
  private handleAnswerReveal(event: Event): void {
    const customEvent = event as CustomEvent<{
      correctAnswerIndex: number;
      explanation?: string;
      wasCorrect: boolean;
    }>;

    this.correctAnswerIndex = customEvent.detail.correctAnswerIndex;
    this.wasCorrect = customEvent.detail.wasCorrect;
    this.explanation = customEvent.detail.explanation;

    console.log('[QuizBattleGame] Answer reveal received:', {
      correctAnswerIndex: this.correctAnswerIndex,
      wasCorrect: this.wasCorrect,
      explanation: this.explanation,
    });

    // Re-render to show the answer feedback
    this.render();
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
    const timerState = this.gameTimer.getState();
    const isDisabled = hasAnswered || timerState.isRevealingAnswer;

    const optionsHtml = options
      .map((option, index) => {
        let className = 'quiz-option';

        if (this.selectedAnswer === index) {
          className += ' selected';
        }

        if (isDisabled) {
          className += ' disabled';
        }

        // Individual reveal: Show correct/wrong when player has submitted and received reveal data
        if (this.correctAnswerIndex !== null && hasAnswered) {
          if (index === this.correctAnswerIndex) {
            className += ' option-correct';
          } else if (this.selectedAnswer === index) {
            className += ' option-wrong';
          }
        }
        // Timer reveal phase: Also highlight for players who didn't answer
        else if (timerState.isRevealingAnswer && this.correctAnswerIndex !== null) {
          if (index === this.correctAnswerIndex) {
            className += ' option-correct';
          }
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
    const timerContent = timerState.isRevealingAnswer
      ? `<div class="timer-text times-up">0</div>`
      : `<div class="timer-text">${Math.ceil(timerState.timeRemaining)}</div>`;

    return `
      <div class="quiz-battle-question-container ${timerState.isRevealingAnswer ? 'revealing' : ''}">
        <div class="question-timer ${timerState.isRevealingAnswer ? 'times-up' : ''}">
          <div class="timer-circle">
            <svg viewBox="0 0 36 36" class="circular-chart">
              <path class="circle-bg"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path class="circle"
                stroke-dasharray="${timerState.isRevealingAnswer ? '0, 100' : this.gameTimer.getDasharray()}"
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

        ${timerState.isRevealingAnswer ? this.renderTimeUpFeedback() : (hasAnswered ? this.renderAnswerFeedback() : '')}
      </div>
    `;
  }

  /**
   * Render answer feedback after submission
   */
  private renderAnswerFeedback(): string {
    // If we have reveal data, show individual result
    if (this.correctAnswerIndex !== null) {
      const correctOption = this.state.currentQuestion?.getOptions()[this.correctAnswerIndex];
      const correctOptionLetter = this.getOptionLetter(this.correctAnswerIndex);

      return `
        <div class="answer-feedback answer-reveal ${this.wasCorrect ? 'correct' : 'incorrect'}">
          <div class="feedback-icon">
            ${this.wasCorrect ? '✓' : '✗'}
          </div>
          <div class="feedback-content">
            <div class="feedback-message ${this.wasCorrect ? 'correct-message' : 'incorrect-message'}">
              ${this.wasCorrect ? 'Correct!' : 'Incorrect'}
            </div>
            ${!this.wasCorrect && correctOption ? `
              <div class="correct-answer-info">
                The correct answer was <strong>${correctOptionLetter}. ${this.escapeHtml(correctOption)}</strong>
              </div>
            ` : ''}
            ${this.explanation ? `
              <div class="answer-explanation">
                <strong>Explanation:</strong> ${this.escapeHtml(this.explanation)}
              </div>
            ` : ''}
            <div class="feedback-subtitle">
              Waiting for other players...
            </div>
          </div>
        </div>
      `;
    }

    // No reveal data yet, show waiting message
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
   * Start question timer using GameTimer utility
   */
  private startQuestionTimer(): void {
    const { currentQuestion, questionStartedAt, gameStarted } = this.state;
    if (!currentQuestion || !gameStarted) return;

    this.gameTimer.start({
      timeLimitSeconds: currentQuestion.timeLimitSeconds,
      questionStartedAt,
      onTick: (timeRemaining) => this.updateTimerDisplay(timeRemaining),
      onTimeout: () => this.handleTimeUp(),
    });
  }

  /**
   * Update timer display in UI
   */
  private updateTimerDisplay(timeRemaining: number): void {
    const timerText = this.container.querySelector('.timer-text');
    if (timerText) {
      timerText.textContent = Math.ceil(timeRemaining).toString();
    }

    const timerCircle = this.container.querySelector('.circle');
    if (timerCircle) {
      (timerCircle as SVGPathElement).setAttribute('stroke-dasharray', this.gameTimer.getDasharray());
    }
  }

  /**
   * Handle time running out
   */
  private handleTimeUp(): void {
    if (!this.answerSubmitted) {
      this.answerSubmitted = true;
    }

    this.render(); // Re-render to show reveal state

    // Only host triggers advancement
    const isHost = this.state.participants.find(p => p.isCurrentUser)?.isHost ?? false;
    if (isHost) {
      const event = new CustomEvent('game:timeout', {
        detail: { questionId: this.state.currentQuestion?.id },
      });
      window.dispatchEvent(event);
    }
  }

  /**
   * Reset answer state for new question
   */
  private resetAnswerState(): void {
    this.selectedAnswer = null;
    this.answerSubmitted = false;
    this.correctAnswerIndex = null;
    this.wasCorrect = false;
    this.explanation = undefined;
    this.gameTimer.reset();
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
