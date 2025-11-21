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
  private readonly freeSpaceIndex: number = 12; // Center cell (index 12 in 5x5 grid)
  private gridConcepts: string[] = [];
  private allQuestions: GameQuestion[] = [];

  // All 12 winning combinations for a 5x5 bingo grid
  private readonly winningCombinations: number[][] = [
    // Rows
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24],
    // Columns
    [0, 5, 10, 15, 20],
    [1, 6, 11, 16, 21],
    [2, 7, 12, 17, 22],
    [3, 8, 13, 18, 23],
    [4, 9, 14, 19, 24],
    // Diagonals
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20],
  ];

  /**
   * Initialize bingo game and load all questions
   */
  public async initialize(): Promise<void> {
    await super.initialize();
    await this.loadQuestionsAndGenerateGrid();
  }

  /**
   * Load all game questions and generate bingo grid
   */
  private async loadQuestionsAndGenerateGrid(): Promise<void> {
    const { session } = this.state;
    if (!session) return;

    try {
      const result = await window.scribeCat.games.getGameQuestions(session.id, false);
      if (result.success && result.questions) {
        this.allQuestions = result.questions.map((q: any) => GameQuestion.fromJSON(q));
        this.generateGridFromQuestions();
      }
    } catch (error) {
      console.error('Failed to load bingo questions:', error);
      // Fallback to placeholder if loading fails
      this.generateFallbackGrid();
    }
  }

  /**
   * Generate grid concepts from questions
   */
  private generateGridFromQuestions(): void {
    const concepts: string[] = [];

    // Extract concepts from each question
    for (const question of this.allQuestions) {
      // Use category as concept if available
      if (question.category) {
        concepts.push(question.category);
      }

      // Extract key terms from question text (first 3-4 words as concept)
      const questionText = question.getQuestionText();
      const shortConcept = this.extractShortConcept(questionText);
      if (shortConcept) {
        concepts.push(shortConcept);
      }

      // Add answer options as concepts
      const options = question.getOptions();
      concepts.push(...options);
    }

    // Shuffle and select 24 unique concepts (5x5 - 1 free space)
    const shuffled = this.shuffleArray([...new Set(concepts)]); // Remove duplicates
    this.gridConcepts = shuffled.slice(0, 24);

    // Pad with generic concepts if we don't have enough
    while (this.gridConcepts.length < 24) {
      this.gridConcepts.push(`Study Topic ${this.gridConcepts.length + 1}`);
    }
  }

  /**
   * Extract a short concept from question text (max 4 words)
   */
  private extractShortConcept(text: string): string {
    const words = text.split(/\s+/).filter(w => w.length > 3);
    return words.slice(0, 4).join(' ').substring(0, 30);
  }

  /**
   * Generate fallback grid if questions fail to load
   */
  private generateFallbackGrid(): void {
    this.gridConcepts = Array.from({ length: 24 }, (_, i) => `Concept ${i + 1}`);
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

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
    this.attachExitListeners();
  }

  private renderBingoGrid(): string {
    const gridItems = Array.from({ length: this.gridSize * this.gridSize }, (_, i) => {
      const isMarked = this.markedCells.has(i);
      const isFreeSpace = i === this.freeSpaceIndex;

      let concept: string;
      if (isFreeSpace) {
        concept = 'FREE';
      } else {
        // Adjust index for free space (cells after free space use next concept)
        const conceptIndex = i < this.freeSpaceIndex ? i : i - 1;
        concept = this.gridConcepts[conceptIndex] || `Topic ${i + 1}`;
      }

      return `
        <div class="bingo-cell ${isMarked ? 'marked' : ''} ${isFreeSpace ? 'free-space' : ''}"
             data-index="${i}">
          <span class="cell-content">${this.escapeHtml(concept)}</span>
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
      detail: { answer, timeTakenMs: 0 },
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

  /**
   * Check if any winning combination is complete.
   * A winning combination requires all 5 cells in a row, column, or diagonal to be marked.
   * The free space (center cell) is automatically considered marked.
   */
  private checkBingo(): boolean {
    return this.winningCombinations.some((combination) =>
      combination.every((index) => {
        // Free space is automatically marked
        if (index === this.freeSpaceIndex) {
          return true;
        }
        return this.markedCells.has(index);
      })
    );
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
