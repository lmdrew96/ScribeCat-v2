/**
 * BingoGame Component
 *
 * Collaborative study bingo where players mark off concepts as they're discussed.
 * Less competitive, more about group learning.
 */

import { MultiplayerGame, GameState } from './MultiplayerGame.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';

export class BingoGame extends MultiplayerGame {
  private markedCells: Set<number> = new Set();
  private gridSize: number = 5; // 5x5 grid

  protected render(): void {
    const { gameStarted, gameEnded } = this.state;

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

    this.container.innerHTML = `
      <div class="bingo-game">
        ${this.renderHeader()}
        ${this.renderBingoGrid()}
        ${this.renderBingoInfo()}
      </div>
    `;

    this.attachBingoListeners();
  }

  private renderBingoGrid(): string {
    const questions = this.state.scores.map((s) => s.questionId); // Questions as concepts
    const gridItems = Array.from({ length: this.gridSize * this.gridSize }, (_, i) => {
      const isMarked = this.markedCells.has(i);
      const isFreeSpace = i === Math.floor((this.gridSize * this.gridSize) / 2);

      const concept = isFreeSpace ? 'FREE' : `Concept ${i + 1}`;

      return `
        <div class="bingo-cell ${isMarked ? 'marked' : ''} ${isFreeSpace ? 'free-space' : ''}"
             data-index="${i}">
          <span class="cell-content">${concept}</span>
          ${isMarked ? '<span class="cell-marker">✓</span>' : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="bingo-grid" style="grid-template-columns: repeat(${this.gridSize}, 1fr);">
        ${gridItems}
      </div>
    `;
  }

  private renderBingoInfo(): string {
    const markedCount = this.markedCells.size;
    const totalCells = this.gridSize * this.gridSize - 1; // Minus free space

    return `
      <div class="bingo-info">
        <div class="bingo-stats">
          <span class="stat-label">Marked:</span>
          <span class="stat-value">${markedCount} / ${totalCells}</span>
        </div>
        <p class="bingo-instructions">
          Mark off concepts as your group discusses them. First to complete a row, column, or diagonal wins!
        </p>
      </div>
    `;
  }

  protected async handleAnswer(answer: string): Promise<void> {
    // For bingo, "answering" means marking a cell
    const event = new CustomEvent('game:answer', {
      detail: { answer, timeTaken: 0 },
    });
    window.dispatchEvent(event);
  }

  protected getInstructions(): string {
    return 'Collaborative Bingo! Mark concepts as your group discusses them. Get BINGO to win!';
  }

  private attachBingoListeners(): void {
    const cells = this.container.querySelectorAll('.bingo-cell:not(.free-space)');
    cells.forEach((cell) => {
      cell.addEventListener('click', () => {
        const index = parseInt((cell as HTMLElement).dataset.index || '0');

        if (this.markedCells.has(index)) {
          this.markedCells.delete(index);
        } else {
          this.markedCells.add(index);
        }

        // Check for bingo
        if (this.checkBingo()) {
          this.handleBingo();
        }

        this.render();
      });
    });
  }

  private checkBingo(): boolean {
    // Simple check - would need full row/column/diagonal logic
    return this.markedCells.size >= 5;
  }

  private handleBingo(): void {
    const event = new CustomEvent('game:bingo', {
      detail: { userId: this.state.currentUserId },
    });
    window.dispatchEvent(event);
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
