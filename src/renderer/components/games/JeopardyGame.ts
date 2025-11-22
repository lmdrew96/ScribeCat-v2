/**
 * JeopardyGame Component
 *
 * Jeopardy-style game with categories and point values.
 * Similar to Quiz Battle but with category-based organization.
 */

import { MultiplayerGame, GameState } from './MultiplayerGame.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';
import { TimeSync } from '../../services/TimeSync.js';
import { GameTimer } from '../../services/GameTimer.js';

export class JeopardyGame extends MultiplayerGame {
  private selectedAnswer: number | null = null;
  private answerSubmitted: boolean = false;
  private timeSync: TimeSync = TimeSync.getInstance();
  private gameTimer: GameTimer = new GameTimer();

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
    this.gameTimer.cleanup();
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
    if (updates.currentQuestion && previousQuestion?.id !== updates.currentQuestion.id) {
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
    this.gameTimer.reset();
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
    const timerState = this.gameTimer.getState();
    const isDisabled = hasAnswered || timerState.isRevealingAnswer;

    const optionsHtml = options
      .map((option, index) => {
        let className = 'jeopardy-option';

        if (this.selectedAnswer === index) {
          className += ' selected';
        }

        // During reveal phase, highlight correct/wrong answers
        if (timerState.isRevealingAnswer) {
          const isCorrect = question.isCorrectAnswer(option);
          if (isCorrect) {
            className += ' option-correct';
          } else if (this.selectedAnswer === index) {
            className += ' option-wrong';
          }
        }

        return `
          <button class="${className}" data-index="${index}" ${isDisabled ? 'disabled' : ''}>
            ${this.escapeHtml(option)}
          </button>
        `;
      })
      .join('');

    // Show "Time's Up!" in timer during reveal phase
    const timerContent = timerState.isRevealingAnswer
      ? `<div class="timer-text times-up">0</div>`
      : `<div class="timer-text">${Math.ceil(timerState.timeRemaining)}</div>`;

    return `
      <div class="jeopardy-question-container ${timerState.isRevealingAnswer ? 'revealing' : ''}">
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

        ${question.category ? `<div class="jeopardy-category">${this.escapeHtml(question.category)}</div>` : ''}
        <div class="jeopardy-board">
          <div class="jeopardy-clue">${this.escapeHtml(question.getQuestionText())}</div>
          <div class="jeopardy-value">${question.points} Points</div>
        </div>
        <div class="jeopardy-responses">
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
    if (this.answerSubmitted) return;

    const startTime = this.gameTimer.getStartTime();
    if (!startTime) return;

    // Use synchronized time for fair timing across all players
    const timeTaken = Math.round(this.timeSync.now() - startTime);
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
