/**
 * LightningChainGame Component
 *
 * Cooperative quiz game where the team works together against the clock.
 * Any player can buzz in to answer. Correct answers add time, wrong answers subtract time.
 *
 * Rules:
 * - Team timer starts at 3 minutes (180 seconds)
 * - Correct answer: +15 seconds
 * - Wrong answer: -10 seconds
 * - Goal: Answer all questions before time runs out
 * - Team wins or loses together
 */

import { MultiplayerGame, GameState } from './MultiplayerGame.js';
import { getIconHTML } from '../../utils/iconMap.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';
import { TimeSync } from '../../services/TimeSync.js';

interface LightningChainGameState extends GameState {
  teamTimer?: number; // Remaining time in seconds
  buzzedPlayer?: string; // Player ID who buzzed in
}

export class LightningChainGame extends MultiplayerGame {
  private buzzedIn: boolean = false;
  private answerSubmitted: boolean = false;
  private selectedAnswer: number | null = null;
  private timeSync: TimeSync = TimeSync.getInstance();

  // Answer reveal state
  private correctAnswerIndex: number | null = null;
  private wasCorrect: boolean = false;
  private explanation: string | undefined = undefined;
  private boundHandleAnswerReveal: ((event: Event) => void) | null = null;

  // Timer management
  private teamTimerInterval: NodeJS.Timeout | null = null;
  private lastTimerUpdate: number = 0;

  /**
   * Initialize lightning chain game
   */
  public async initialize(): Promise<void> {
    await super.initialize();

    // Initialize time sync
    if (!this.timeSync.isSynced()) {
      await this.timeSync.initialize();
    }

    // Listen for answer reveal events
    this.boundHandleAnswerReveal = this.handleAnswerReveal.bind(this);
    window.addEventListener('game:answer-reveal', this.boundHandleAnswerReveal);

    // Start team timer when game begins
    if (this.state.gameStarted && !this.state.gameEnded) {
      this.startTeamTimer();
    }
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    this.stopTeamTimer();
    if (this.boundHandleAnswerReveal) {
      window.removeEventListener('game:answer-reveal', this.boundHandleAnswerReveal);
    }
    await super.cleanup();
  }

  /**
   * Update game state
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

    // Start timer when game starts
    if (!wasGameStarted && this.state.gameStarted) {
      this.startTeamTimer();
    }

    // Stop timer if game ended
    if (updates.gameEnded) {
      this.stopTeamTimer();
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
      <div class="lightning-chain-game">
        ${this.renderHeader()}
        ${this.renderTeamTimer()}
        ${this.renderProgress()}
        ${this.renderQuestion(currentQuestion)}
        ${this.renderTeamStats()}
      </div>
    `;

    this.attachBuzzListeners();
    this.attachAnswerListeners();
    this.attachExitListeners();
  }

  /**
   * Handle player answer submission
   */
  protected async handleAnswer(answer: string): Promise<void> {
    if (this.answerSubmitted || !this.buzzedIn) {
      return;
    }

    // Only buzzed player can answer
    const lightningState = this.state as LightningChainGameState;
    if (lightningState.buzzedPlayer !== this.state.currentUserId) {
      return;
    }

    this.answerSubmitted = true;

    // Emit answer event
    const event = new CustomEvent('game:answer', {
      detail: {
        answer,
        timeTakenMs: 0, // Time doesn't matter for cooperative mode
      },
    });
    window.dispatchEvent(event);
  }

  /**
   * Handle buzz-in
   */
  private handleBuzz(): void {
    if (this.buzzedIn || this.answerSubmitted) {
      return;
    }

    this.buzzedIn = true;

    // Emit buzz event
    const event = new CustomEvent('game:buzz', {
      detail: {
        playerId: this.state.currentUserId,
        timestamp: this.timeSync.now(),
      },
    });
    window.dispatchEvent(event);

    // Re-render to show buzzed state
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
      timeAdjustment?: number; // +15 or -10
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
    return 'Work together as a team! Buzz in to answer. Correct answers add 15 seconds, wrong answers subtract 10 seconds. Beat the clock!';
  }

  /**
   * Get game icon
   */
  protected getGameIcon(): string {
    return getIconHTML('zap', { size: 24 }) + getIconHTML('link', { size: 20 });
  }

  /**
   * Render game complete screen (cooperative version)
   */
  protected renderGameComplete(): string {
    const lightningState = this.state as LightningChainGameState;
    const teamTimer = lightningState.teamTimer || 0;
    const totalQuestions = this.state.session.getTotalQuestions();
    const questionsCompleted = this.state.session.currentQuestionIndex;
    const teamWon = questionsCompleted >= totalQuestions && teamTimer > 0;

    const icon = teamWon ? getIconHTML('trophy', { size: 48, color: 'gold' }) : getIconHTML('clock', { size: 48 });
    const message = teamWon
      ? `Team Victory! You completed all ${totalQuestions} questions with ${teamTimer} seconds remaining!`
      : 'Time\'s Up! The team ran out of time. Better luck next time!';

    return `
      <div class="game-complete-screen cooperative">
        <div class="complete-icon">${icon}</div>
        <h2>${teamWon ? 'Team Victory!' : 'Time\'s Up!'}</h2>
        <p class="complete-message">${message}</p>
        <div class="complete-stats">
          <div class="stat-item">
            <span class="stat-label">Questions Completed</span>
            <span class="stat-value">${questionsCompleted}/${totalQuestions}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Time Remaining</span>
            <span class="stat-value">${this.formatTime(teamTimer)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Team Performance</span>
            <span class="stat-value">${teamWon ? 'Victory!' : 'Defeat'}</span>
          </div>
        </div>

        <button class="btn-secondary close-game-btn" id="close-game-btn">
          Close Game
        </button>
      </div>
    `;
  }

  // ============================================================================
  // Lightning Chain specific rendering
  // ============================================================================

  /**
   * Render team timer (large countdown)
   */
  private renderTeamTimer(): string {
    const lightningState = this.state as LightningChainGameState;
    const teamTimer = lightningState.teamTimer || 180; // Default 3 minutes
    const percentage = (teamTimer / 180) * 100;
    const isUrgent = teamTimer <= 30;
    const isCritical = teamTimer <= 10;

    return `
      <div class="team-timer-container ${isUrgent ? 'urgent' : ''} ${isCritical ? 'critical' : ''}">
        <div class="team-timer-label">Team Time Remaining</div>
        <div class="team-timer-display">
          <div class="timer-value">${this.formatTime(teamTimer)}</div>
          <div class="timer-bar">
            <div class="timer-bar-fill" style="width: ${percentage}%"></div>
          </div>
        </div>
        ${isUrgent ? `<div class="timer-warning">${getIconHTML('warning', { size: 16 })} Time running out!</div>` : ''}
      </div>
    `;
  }

  /**
   * Render the current question
   */
  private renderQuestion(question: GameQuestion): string {
    const options = question.getOptions();
    const lightningState = this.state as LightningChainGameState;
    const buzzedPlayer = this.state.participants.find(
      (p) => p.userId === lightningState.buzzedPlayer
    );
    const currentUserBuzzed = this.buzzedIn && buzzedPlayer?.isCurrentUser;
    const someoneBuzzed = !!buzzedPlayer;

    // Show answer reveal state
    if (this.correctAnswerIndex !== null) {
      return this.renderAnswerReveal(question, options);
    }

    // Render buzz button or buzzed state
    const buzzSectionHTML = someoneBuzzed
      ? `
        <div class="buzz-status">
          ${
            currentUserBuzzed
              ? '<p class="buzz-message you-buzzed">You buzzed in! Select your answer:</p>'
              : `<p class="buzz-message">${buzzedPlayer?.userFullName || buzzedPlayer?.userEmail.split('@')[0] || 'Someone'} buzzed in first</p>`
          }
        </div>
      `
      : `
        <div class="buzz-section">
          <button class="btn-buzz" id="buzz-btn">
            ${getIconHTML('zap', { size: 18 })} Buzz In
          </button>
          <p class="buzz-hint">Be the first to buzz and answer!</p>
        </div>
      `;

    // Render options (only enabled for buzzed player)
    const optionsHTML = options
      .map((option, index) => {
        const isSelected = this.selectedAnswer === index;
        const isDisabled = !currentUserBuzzed || this.answerSubmitted;

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

    return `
      <div class="question-container">
        <div class="question-header">
          <div class="question-meta">
            ${question.category ? `<span class="question-category">${this.escapeHtml(question.category)}</span>` : ''}
            ${question.difficulty ? `<span class="question-difficulty ${question.difficulty}">${question.difficulty}</span>` : ''}
          </div>
        </div>

        <div class="question-card">
          <h3 class="question-text">${this.escapeHtml(question.questionText)}</h3>

          ${!someoneBuzzed ? buzzSectionHTML : ''}

          <div class="question-options ${!someoneBuzzed ? 'disabled' : ''}">
            ${optionsHTML}
          </div>

          ${someoneBuzzed ? buzzSectionHTML : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render answer reveal with time adjustment feedback
   */
  private renderAnswerReveal(question: GameQuestion, options: string[]): string {
    const timeAdjustment = this.wasCorrect ? 15 : -10;
    const resultIcon = this.wasCorrect ? getIconHTML('check', { size: 24 }) : getIconHTML('close', { size: 24 });
    const resultClass = this.wasCorrect ? 'correct' : 'incorrect';
    const resultMessage = this.wasCorrect
      ? `Correct! +${timeAdjustment} seconds added to team timer`
      : `Incorrect. ${Math.abs(timeAdjustment)} seconds subtracted from team timer`;

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
            <div class="result-details">
              <span class="result-message">${resultMessage}</span>
              <span class="time-adjustment ${this.wasCorrect ? 'positive' : 'negative'}">
                ${this.wasCorrect ? '+' : ''}${timeAdjustment}s
              </span>
            </div>
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

  /**
   * Render team stats (instead of individual leaderboard)
   */
  private renderTeamStats(): string {
    const { leaderboard } = this.state;
    const totalCorrect = leaderboard.reduce((sum, entry) => sum + entry.correctAnswers, 0);
    const totalAnswers = leaderboard.reduce((sum, entry) => sum + entry.totalAnswers, 0);
    const accuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

    return `
      <div class="team-stats">
        <h4>Team Performance</h4>
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">${totalCorrect}/${totalAnswers}</div>
            <div class="stat-label">Correct Answers</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${accuracy}%</div>
            <div class="stat-label">Team Accuracy</div>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // Event listeners
  // ============================================================================

  /**
   * Attach buzz button listener
   */
  private attachBuzzListeners(): void {
    const buzzBtn = this.container.querySelector('#buzz-btn');
    buzzBtn?.addEventListener('click', () => {
      this.handleBuzz();
    });
  }

  /**
   * Attach answer button listeners
   */
  private attachAnswerListeners(): void {
    const lightningState = this.state as LightningChainGameState;
    const currentUserBuzzed = lightningState.buzzedPlayer === this.state.currentUserId;

    if (!currentUserBuzzed) {
      return;
    }

    const optionButtons = this.container.querySelectorAll('.quiz-option');
    optionButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        if (this.answerSubmitted) {
          return;
        }

        this.selectedAnswer = index;
        this.handleAnswer(index.toString());
      });
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
    this.buzzedIn = false;
    this.correctAnswerIndex = null;
    this.wasCorrect = false;
    this.explanation = undefined;
  }

  /**
   * Start team timer countdown
   */
  private startTeamTimer(): void {
    this.stopTeamTimer();

    this.lastTimerUpdate = this.timeSync.now();

    // Update every second
    this.teamTimerInterval = setInterval(() => {
      const now = this.timeSync.now();
      const elapsed = Math.floor((now - this.lastTimerUpdate) / 1000);

      if (elapsed >= 1) {
        this.lastTimerUpdate = now;

        const lightningState = this.state as LightningChainGameState;
        const currentTime = lightningState.teamTimer || 180;
        const newTime = Math.max(0, currentTime - elapsed);

        // Update state locally
        this.updateState({
          ...this.state,
          teamTimer: newTime,
        } as any);

        // Emit timer update event for sync
        const event = new CustomEvent('game:timer-update', {
          detail: {
            teamTimer: newTime,
          },
        });
        window.dispatchEvent(event);

        // End game if time runs out
        if (newTime <= 0) {
          this.stopTeamTimer();
          const endEvent = new CustomEvent('game:time-up');
          window.dispatchEvent(endEvent);
        }
      }
    }, 100); // Check every 100ms for smooth countdown
  }

  /**
   * Stop team timer
   */
  private stopTeamTimer(): void {
    if (this.teamTimerInterval) {
      clearInterval(this.teamTimerInterval);
      this.teamTimerInterval = null;
    }
  }
}
