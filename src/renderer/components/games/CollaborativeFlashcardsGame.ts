/**
 * CollaborativeFlashcardsGame Component
 *
 * Players take turns revealing and discussing flashcards.
 * Focus on group learning rather than competition.
 */

import { MultiplayerGame, GameState } from './MultiplayerGame.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';

export class CollaborativeFlashcardsGame extends MultiplayerGame {
  private isFlipped: boolean = false;

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
      this.container.innerHTML = '<div class="game-loading">Loading flashcard...</div>';
      return;
    }

    this.container.innerHTML = `
      <div class="flashcards-game">
        ${this.renderHeader()}
        ${this.renderProgress()}
        ${this.renderFlashcard(currentQuestion)}
        ${this.renderFlashcardControls()}
      </div>
    `;

    this.attachFlashcardListeners();
    this.attachExitListeners();
  }

  private renderFlashcard(question: GameQuestion): string {
    return `
      <div class="flashcard-container">
        <div class="flashcard ${this.isFlipped ? 'flipped' : ''}" id="flashcard">
          <div class="flashcard-front">
            <div class="flashcard-label">Question</div>
            <div class="flashcard-content">
              ${this.escapeHtml(question.getQuestionText())}
            </div>
            ${question.category ? `<div class="flashcard-category">${this.escapeHtml(question.category)}</div>` : ''}
          </div>
          <div class="flashcard-back">
            <div class="flashcard-label">Answer</div>
            <div class="flashcard-content">
              ${this.escapeHtml(question.correctAnswer)}
            </div>
            ${question.hasExplanation() ? `
              <div class="flashcard-explanation">
                <strong>Explanation:</strong>
                ${this.escapeHtml(question.getExplanation() || '')}
              </div>
            ` : ''}
          </div>
        </div>
        <button class="btn-flip" id="flip-btn">
          ${this.isFlipped ? 'Show Question' : 'Show Answer'}
        </button>
      </div>
    `;
  }

  private renderFlashcardControls(): string {
    const { hasAnswered, session } = this.state;
    const isLastCard = session.isLastQuestion();

    return `
      <div class="flashcard-controls">
        ${
          !hasAnswered
            ? `
          <div class="understanding-check">
            <p>Did you understand this concept?</p>
            <div class="understanding-buttons">
              <button class="btn-understanding needs-review" data-understanding="false">
                😕 Needs Review
              </button>
              <button class="btn-understanding understood" data-understanding="true">
                ✅ Got It!
              </button>
            </div>
          </div>
        `
            : `
          <div class="flashcard-next">
            <p>Waiting for next card...</p>
            ${
              this.isCurrentUserHost()
                ? `
              <button class="btn-primary" id="next-card-btn">
                ${isLastCard ? 'Finish' : 'Next Card'}
              </button>
            `
                : ''
            }
          </div>
        `
        }
      </div>
    `;
  }

  protected async handleAnswer(answer: string): Promise<void> {
    const event = new CustomEvent('game:answer', {
      detail: { answer, timeTaken: 0 },
    });
    window.dispatchEvent(event);
    this.updateState({ hasAnswered: true });
  }

  protected getInstructions(): string {
    return 'Take turns reviewing flashcards together. Discuss each concept before moving to the next!';
  }

  public updateState(updates: Partial<GameState>): void {
    const previousQuestion = this.state.currentQuestion;
    super.updateState(updates);

    // Reset flip state when question changes
    if (updates.currentQuestion && previousQuestion?.id !== updates.currentQuestion.id) {
      this.isFlipped = false;
    }
  }

  private attachFlashcardListeners(): void {
    // Flip button
    const flipBtn = this.container.querySelector('#flip-btn');
    flipBtn?.addEventListener('click', () => {
      this.isFlipped = !this.isFlipped;
      this.render();
    });

    // Understanding buttons
    const understandingBtns = this.container.querySelectorAll('.btn-understanding');
    understandingBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const understood = (btn as HTMLElement).dataset.understanding === 'true';
        this.handleAnswer(understood ? 'understood' : 'needs-review');
      });
    });

    // Next card button (host only)
    const nextBtn = this.container.querySelector('#next-card-btn');
    nextBtn?.addEventListener('click', () => {
      const event = new CustomEvent('game:next-question');
      window.dispatchEvent(event);
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
