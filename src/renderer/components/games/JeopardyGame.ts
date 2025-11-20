/**
 * JeopardyGame Component
 *
 * Jeopardy-style game with categories and point values.
 * Similar to Quiz Battle but with category-based organization.
 */

import { MultiplayerGame, GameState } from './MultiplayerGame.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';

export class JeopardyGame extends MultiplayerGame {
  private selectedAnswer: number | null = null;

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
  }

  private renderJeopardyQuestion(question: GameQuestion): string {
    const options = question.getOptions();
    const { hasAnswered } = this.state;

    const optionsHtml = options
      .map(
        (option, index) => `
        <button class="jeopardy-option ${this.selectedAnswer === index ? 'selected' : ''}"
                data-index="${index}" ${hasAnswered ? 'disabled' : ''}>
          ${this.escapeHtml(option)}
        </button>
      `
      )
      .join('');

    return `
      <div class="jeopardy-question-container">
        ${question.category ? `<div class="jeopardy-category">${this.escapeHtml(question.category)}</div>` : ''}
        <div class="jeopardy-board">
          <div class="jeopardy-clue">${this.escapeHtml(question.getQuestionText())}</div>
          <div class="jeopardy-value">${question.points} Points</div>
        </div>
        <div class="jeopardy-responses">
          ${optionsHtml}
        </div>
        ${hasAnswered ? '<div class="answer-submitted">✅ Answer submitted!</div>' : ''}
      </div>
    `;
  }

  protected async handleAnswer(answer: string): Promise<void> {
    if (this.state.hasAnswered) return;

    const event = new CustomEvent('game:answer', {
      detail: { answer, timeTaken: 0 },
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
        const index = parseInt((option as HTMLElement).dataset.index || '0');
        this.selectedAnswer = index;
        const answer = this.state.currentQuestion?.getOptions()[index] || '';
        this.handleAnswer(answer);
      });
    });
  }

  private attachWaitingListeners(): void {
    const startBtn = this.container.querySelector('#start-game-btn');
    startBtn?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:start'));
    });
  }

  private attachCompleteListeners(): void {
    const closeBtn = this.container.querySelector('#close-game-btn');
    closeBtn?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:close'));
    });
  }
}
