/**
 * HotSeatChallengeGame Component
 *
 * Turn-based quiz game where players take turns in the "hot seat" answering questions.
 * Other players can challenge if they think the hot seat player chose wrong.
 *
 * Scoring:
 * - Hot seat player: +100 for correct, -50 for wrong
 * - Challengers: +150 for successful challenge, -75 for failed challenge
 */

import { MultiplayerGame, GameState, GameParticipant } from './MultiplayerGame.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';
import { TimeSync } from '../../services/TimeSync.js';
import { GameTimer } from '../../services/GameTimer.js';
import { getIconHTML } from '../../utils/iconMap.js';

interface HotSeatGameState extends GameState {
  currentTurnPlayer?: string; // Player ID of current hot seat player
  turnQuestionCount?: number; // Questions answered in current turn (0-5)
  challenges?: Map<string, boolean>; // Player ID -> challenged or not
  challengeRevealed?: boolean; // Whether challenge results have been revealed
}

export class HotSeatChallengeGame extends MultiplayerGame {
  private selectedAnswer: number | null = null;
  private answerSubmitted: boolean = false;
  private challenged: boolean = false;
  private timeSync: TimeSync = TimeSync.getInstance();
  private gameTimer: GameTimer = new GameTimer();

  // Answer reveal state
  private correctAnswerIndex: number | null = null;
  private wasCorrect: boolean = false;
  private explanation: string | undefined = undefined;
  private boundHandleAnswerReveal: ((event: Event) => void) | null = null;

  // Turn management
  private turnOrder: string[] = [];
  private currentTurnIndex: number = 0;

  /**
   * Initialize hot seat challenge game
   */
  public async initialize(): Promise<void> {
    await super.initialize();

    // Initialize time sync
    if (!this.timeSync.isSynced()) {
      await this.timeSync.initialize();
    }

    // Initialize turn order (all participants)
    this.turnOrder = this.state.participants.map((p) => p.userId);
    this.currentTurnIndex = 0;

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
    const wasGameStarted = this.state.gameStarted;

    // Reset answer state when question changes
    if (
      updates.currentQuestion &&
      previousQuestion?.id !== updates.currentQuestion.id
    ) {
      this.resetAnswerState();
    }

    super.updateState(updates);

    // Update turn management from server state
    const hotSeatState = this.state as HotSeatGameState;
    if (hotSeatState.currentTurnPlayer) {
      this.currentTurnIndex = this.turnOrder.indexOf(hotSeatState.currentTurnPlayer);
    }

    // Start timer when question changes or game starts
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
      <div class="hot-seat-challenge-game">
        ${this.renderHeader()}
        ${this.renderProgress()}
        ${this.renderHotSeatIndicator()}
        ${this.renderQuestion(currentQuestion)}
        ${this.renderLeaderboard()}
      </div>
    `;

    this.attachAnswerListeners();
    this.attachChallengeListeners();
    this.attachExitListeners();
  }

  /**
   * Handle player answer submission
   */
  protected async handleAnswer(answer: string): Promise<void> {
    if (this.answerSubmitted) {
      return;
    }

    // Only hot seat player can answer
    const hotSeatState = this.state as HotSeatGameState;
    if (hotSeatState.currentTurnPlayer !== this.state.currentUserId) {
      return;
    }

    const startTime = this.gameTimer.getStartTime();
    if (!startTime) return;

    const timeTaken = Math.round(this.timeSync.now() - startTime);
    this.answerSubmitted = true;

    // Emit answer event
    const event = new CustomEvent('game:answer', {
      detail: {
        answer,
        timeTakenMs: timeTaken,
      },
    });
    window.dispatchEvent(event);
  }

  /**
   * Handle challenge submission
   */
  private handleChallenge(): void {
    if (this.challenged || this.answerSubmitted) {
      return;
    }

    // Only non-hot-seat players can challenge
    const hotSeatState = this.state as HotSeatGameState;
    if (hotSeatState.currentTurnPlayer === this.state.currentUserId) {
      return;
    }

    this.challenged = true;

    // Emit challenge event
    const event = new CustomEvent('game:challenge', {
      detail: {
        playerId: this.state.currentUserId,
      },
    });
    window.dispatchEvent(event);

    // Re-render to show challenged state
    this.render();
  }

  /**
   * Handle answer reveal event
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

    // Re-render to show feedback
    this.render();
  }

  /**
   * Get game-specific instructions
   */
  protected getInstructions(): string {
    return 'Take turns in the hot seat answering 5 rapid-fire questions. Other players can challenge if they think you chose wrong!';
  }

  /**
   * Get game icon
   */
  protected getGameIcon(): string {
    return getIconHTML('flame', { size: 24 });
  }

  // ============================================================================
  // Hot Seat specific rendering
  // ============================================================================

  /**
   * Render hot seat indicator showing who's currently in the hot seat
   */
  private renderHotSeatIndicator(): string {
    const hotSeatState = this.state as HotSeatGameState;
    const currentTurnPlayer = this.state.participants.find(
      (p) => p.userId === hotSeatState.currentTurnPlayer
    );

    if (!currentTurnPlayer) {
      return '';
    }

    const isCurrentUserInHotSeat = currentTurnPlayer.isCurrentUser;
    const turnQuestionCount = hotSeatState.turnQuestionCount || 0;

    return `
      <div class="hot-seat-indicator ${isCurrentUserInHotSeat ? 'current-user-turn' : ''}">
        <div class="hot-seat-icon">${getIconHTML('flame', { size: 32 })}</div>
        <div class="hot-seat-info">
          <div class="hot-seat-player">
            ${isCurrentUserInHotSeat ? 'You are' : `${currentTurnPlayer.userFullName || currentTurnPlayer.userEmail.split('@')[0]} is`} in the Hot Seat
          </div>
          <div class="hot-seat-progress">Question ${turnQuestionCount + 1} of 5</div>
        </div>
      </div>
    `;
  }

  /**
   * Render the current question
   */
  private renderQuestion(question: GameQuestion): string {
    const options = question.getOptions();
    const { hasAnswered } = this.state;
    const hotSeatState = this.state as HotSeatGameState;
    const isCurrentUserInHotSeat = hotSeatState.currentTurnPlayer === this.state.currentUserId;
    const timerState = this.gameTimer.getState();

    // Show answer reveal state
    if (this.correctAnswerIndex !== null) {
      return this.renderAnswerReveal(question, options);
    }

    // Render timer
    const timerHTML = timerState.isActive
      ? `
        <div class="question-timer">
          <svg class="timer-circle" viewBox="0 0 100 100">
            <circle class="timer-circle-bg" cx="50" cy="50" r="45"></circle>
            <circle
              class="timer-circle-progress ${timerState.remainingSeconds <= 3 ? 'urgent' : ''}"
              cx="50"
              cy="50"
              r="45"
              style="stroke-dashoffset: ${(1 - timerState.remainingSeconds / timerState.totalSeconds) * 283}"
            ></circle>
          </svg>
          <div class="timer-text">${timerState.remainingSeconds}s</div>
        </div>
      `
      : '';

    // Render options
    const optionsHTML = options
      .map((option, index) => {
        const isSelected = this.selectedAnswer === index;
        const isDisabled = hasAnswered || this.answerSubmitted || !isCurrentUserInHotSeat;

        return `
          <button
            class="quiz-option ${isSelected ? 'selected' : ''}"
            data-option-index="${index}"
            ${isDisabled ? 'disabled' : ''}
          >
            <span class="option-letter">${String.fromCharCode(65 + index)}</span>
            <span class="option-text">${this.escapeHtml(option)}</span>
          </button>
        `;
      })
      .join('');

    // Render challenge button for non-hot-seat players
    const challengeButtonHTML = !isCurrentUserInHotSeat
      ? `
        <div class="challenge-section">
          <button
            class="btn-challenge"
            id="challenge-btn"
            ${this.challenged || !this.answerSubmitted ? 'disabled' : ''}
          >
            ${this.challenged ? 'Challenge Submitted!' : `${getIconHTML('warning', { size: 16 })} Challenge`}
          </button>
          <p class="challenge-hint">Challenge if you think they chose wrong!</p>
        </div>
      `
      : '';

    return `
      <div class="question-container">
        <div class="question-header">
          ${timerHTML}
          <div class="question-meta">
            ${question.category ? `<span class="question-category">${this.escapeHtml(question.category)}</span>` : ''}
            ${question.difficulty ? `<span class="question-difficulty ${question.difficulty}">${question.difficulty}</span>` : ''}
          </div>
        </div>

        <div class="question-card">
          <h3 class="question-text">${this.escapeHtml(question.questionText)}</h3>
          <div class="question-options">
            ${optionsHTML}
          </div>
          ${challengeButtonHTML}
        </div>
      </div>
    `;
  }

  /**
   * Render answer reveal with feedback
   */
  private renderAnswerReveal(question: GameQuestion, options: string[]): string {
    const hotSeatState = this.state as HotSeatGameState;
    const isCurrentUserInHotSeat = hotSeatState.currentTurnPlayer === this.state.currentUserId;

    const resultIcon = this.wasCorrect ? getIconHTML('check', { size: 20 }) : getIconHTML('close', { size: 20 });
    const resultClass = this.wasCorrect ? 'correct' : 'incorrect';
    const resultMessage = isCurrentUserInHotSeat
      ? this.wasCorrect
        ? 'Correct! +100 points'
        : 'Incorrect. -50 points'
      : this.challenged
      ? this.wasCorrect
        ? 'Challenge failed! -75 points'
        : 'Challenge successful! +150 points'
      : this.wasCorrect
      ? 'Hot seat player was correct!'
      : 'Hot seat player was incorrect!';

    const optionsHTML = options
      .map((option, index) => {
        const isCorrect = index === this.correctAnswerIndex;
        const wasSelected = this.selectedAnswer === index;

        return `
          <div class="quiz-option ${isCorrect ? 'correct-answer' : ''} ${wasSelected && !isCorrect ? 'wrong-answer' : ''} disabled">
            <span class="option-letter">${String.fromCharCode(65 + index)}</span>
            <span class="option-text">${this.escapeHtml(option)}</span>
            ${isCorrect ? `<span class="option-indicator">${getIconHTML('check', { size: 16 })}</span>` : ''}
            ${wasSelected && !isCorrect ? `<span class="option-indicator">${getIconHTML('close', { size: 16 })}</span>` : ''}
          </div>
        `;
      })
      .join('');

    return `
      <div class="question-container answer-revealed">
        <div class="question-card">
          <div class="answer-result ${resultClass}">
            <span class="result-icon">${resultIcon}</span>
            <span class="result-message">${resultMessage}</span>
          </div>

          <h3 class="question-text">${this.escapeHtml(question.questionText)}</h3>
          <div class="question-options">
            ${optionsHTML}
          </div>

          ${
            this.explanation
              ? `
            <div class="question-explanation">
              <strong>Explanation:</strong> ${this.escapeHtml(this.explanation)}
            </div>
          `
              : ''
          }

          <div class="next-question-message">
            Next question loading...
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // Event listeners
  // ============================================================================

  /**
   * Attach answer button listeners
   */
  private attachAnswerListeners(): void {
    const hotSeatState = this.state as HotSeatGameState;
    const isCurrentUserInHotSeat = hotSeatState.currentTurnPlayer === this.state.currentUserId;

    if (!isCurrentUserInHotSeat) {
      return;
    }

    const optionButtons = this.container.querySelectorAll('.quiz-option');
    optionButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        if (this.answerSubmitted || this.state.hasAnswered) {
          return;
        }

        this.selectedAnswer = index;
        this.handleAnswer(index.toString());
      });
    });
  }

  /**
   * Attach challenge button listener
   */
  private attachChallengeListeners(): void {
    const challengeBtn = this.container.querySelector('#challenge-btn');
    challengeBtn?.addEventListener('click', () => {
      this.handleChallenge();
    });
  }

  /**
   * Attach waiting screen listeners
   */
  private attachWaitingListeners(): void {
    const startBtn = this.container.querySelector('#start-game-btn');
    const exitBtn = this.container.querySelector('#exit-game-btn');

    startBtn?.addEventListener('click', () => {
      const event = new CustomEvent('game:start');
      window.dispatchEvent(event);
    });

    exitBtn?.addEventListener('click', () => {
      const event = new CustomEvent('game:exit');
      window.dispatchEvent(event);
    });
  }

  /**
   * Attach complete screen listeners
   */
  private attachCompleteListeners(): void {
    const closeBtn = this.container.querySelector('#close-game-btn');
    closeBtn?.addEventListener('click', () => {
      const event = new CustomEvent('game:exit');
      window.dispatchEvent(event);
    });
  }

  /**
   * Attach exit button listener
   */
  private attachExitListeners(): void {
    const exitBtn = this.container.querySelector('#exit-game-btn');
    exitBtn?.addEventListener('click', () => {
      const event = new CustomEvent('game:exit');
      window.dispatchEvent(event);
    });
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  /**
   * Reset answer state for new question
   */
  private resetAnswerState(): void {
    this.selectedAnswer = null;
    this.answerSubmitted = false;
    this.challenged = false;
    this.correctAnswerIndex = null;
    this.wasCorrect = false;
    this.explanation = undefined;
  }

  /**
   * Start question timer (10 seconds per question)
   */
  private startQuestionTimer(): void {
    if (!this.state.currentQuestion || !this.state.gameStarted) {
      return;
    }

    // Stop existing timer
    this.gameTimer.stop();

    // Calculate when question started (for late joiners)
    const questionStartTime = this.state.questionStartedAt || this.timeSync.now();

    // Start 10-second countdown
    this.gameTimer.start({
      durationSeconds: 10,
      startTime: questionStartTime,
      onTick: () => {
        this.updateTimer();
      },
      onComplete: () => {
        console.log('[HotSeatChallengeGame] Timer expired');
      },
    });
  }

  /**
   * Update timer display
   */
  private updateTimer(): void {
    const timerState = this.gameTimer.getState();
    const timerText = this.container.querySelector('.timer-text');
    const timerProgress = this.container.querySelector('.timer-circle-progress');

    if (timerText) {
      timerText.textContent = `${timerState.remainingSeconds}s`;
    }

    if (timerProgress) {
      const dashOffset = (1 - timerState.remainingSeconds / timerState.totalSeconds) * 283;
      (timerProgress as HTMLElement).style.strokeDashoffset = dashOffset.toString();

      // Add urgent class when time is running out
      if (timerState.remainingSeconds <= 3) {
        timerProgress.classList.add('urgent');
      }
    }
  }
}
