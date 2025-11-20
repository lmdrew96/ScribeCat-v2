/**
 * Game Selection Modal
 * Allows the host to choose which multiplayer game to start
 */

import { GameType } from '../../domain/entities/GameSession.js';

export interface GameSelectionResult {
  gameType: GameType;
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
}

export class GameSelectionModal {
  private modal: HTMLElement | null = null;
  private selectedGameType: GameType = 'quiz_battle';
  private selectedQuestionCount: number = 10;
  private selectedDifficulty: 'easy' | 'medium' | 'hard' | 'mixed' = 'mixed';
  private resolvePromise: ((result: GameSelectionResult | null) => void) | null = null;

  /**
   * Show the game selection modal and wait for user input
   */
  public static show(): Promise<GameSelectionResult | null> {
    const modal = new GameSelectionModal();
    modal.createModal();
    modal.showModal();
    return modal.waitForResult();
  }

  /**
   * Create the modal structure
   */
  private createModal(): void {
    const modalHTML = `
      <div id="game-selection-modal" class="modal" style="z-index: 10300;">
        <div class="modal-overlay" data-close-modal></div>
        <div class="modal-content game-selection-modal-content">
          <div class="modal-header">
            <h2>Choose a Game</h2>
            <button class="modal-close" data-close-modal aria-label="Close">×</button>
          </div>

          <div class="modal-body">
            <p class="modal-subtitle">Select a multiplayer game to play with your study group</p>

            <div class="game-types-grid">
              ${this.renderGameTypeCard('quiz_battle', '⚡', 'Quiz Battle', 'Race to answer questions correctly. Speed and accuracy earn points!')}
              ${this.renderGameTypeCard('jeopardy', '🎯', 'Jeopardy', 'Answer questions by category. Strategic and fun!')}
              ${this.renderGameTypeCard('bingo', '🎲', 'Study Bingo', 'Mark concepts as they\'re discussed. Collaborative learning!')}
              ${this.renderGameTypeCard('flashcards', '🃏', 'Flashcards', 'Review cards together. Great for group study!')}
            </div>

            <div class="game-settings">
              <div class="setting-group">
                <label>Number of Questions</label>
                <div class="question-count-buttons">
                  <button class="count-btn ${this.selectedQuestionCount === 5 ? 'selected' : ''}" data-count="5">5</button>
                  <button class="count-btn ${this.selectedQuestionCount === 10 ? 'selected' : ''}" data-count="10">10</button>
                  <button class="count-btn ${this.selectedQuestionCount === 15 ? 'selected' : ''}" data-count="15">15</button>
                  <button class="count-btn ${this.selectedQuestionCount === 20 ? 'selected' : ''}" data-count="20">20</button>
                </div>
              </div>

              <div class="setting-group">
                <label>Difficulty</label>
                <div class="difficulty-buttons">
                  <button class="difficulty-btn ${this.selectedDifficulty === 'easy' ? 'selected' : ''}" data-difficulty="easy">Easy</button>
                  <button class="difficulty-btn ${this.selectedDifficulty === 'medium' ? 'selected' : ''}" data-difficulty="medium">Medium</button>
                  <button class="difficulty-btn ${this.selectedDifficulty === 'hard' ? 'selected' : ''}" data-difficulty="hard">Hard</button>
                  <button class="difficulty-btn ${this.selectedDifficulty === 'mixed' ? 'selected' : ''}" data-difficulty="mixed">Mixed</button>
                </div>
              </div>
            </div>

            <div id="game-selection-message" class="message" style="display: none;"></div>
          </div>

          <div class="modal-actions">
            <button class="btn-secondary" id="cancel-game-btn">Cancel</button>
            <button class="btn-primary" id="game-selection-start-btn">Start Game</button>
          </div>
        </div>
      </div>
    `;

    // Create temporary container and insert HTML
    const temp = document.createElement('div');
    temp.innerHTML = modalHTML.trim();
    this.modal = temp.firstElementChild as HTMLElement;

    // Append to body
    document.body.appendChild(this.modal);

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Render a game type card
   */
  private renderGameTypeCard(
    gameType: GameType,
    icon: string,
    title: string,
    description: string
  ): string {
    const isSelected = this.selectedGameType === gameType;

    return `
      <div class="game-type-card ${isSelected ? 'selected' : ''}" data-game-type="${gameType}">
        <div class="game-icon">${icon}</div>
        <div class="game-title">${title}</div>
        <div class="game-description">${description}</div>
        ${isSelected ? '<div class="game-selected-badge">✓</div>' : ''}
      </div>
    `;
  }

  /**
   * Show the modal
   */
  private showModal(): void {
    if (this.modal) {
      this.modal.style.display = 'flex';
    }
  }

  /**
   * Close and remove the modal
   */
  private closeModal(): void {
    if (this.modal && this.modal.parentNode) {
      this.modal.style.display = 'none';
      document.body.removeChild(this.modal);
      this.modal = null;
    }
  }

  /**
   * Update the modal content with current selections
   */
  private updateModal(): void {
    if (!this.modal) return;

    const modalBody = this.modal.querySelector('.modal-body');
    if (!modalBody) return;

    // Re-render the content
    modalBody.innerHTML = `
      <p class="modal-subtitle">Select a multiplayer game to play with your study group</p>

      <div class="game-types-grid">
        ${this.renderGameTypeCard('quiz_battle', '⚡', 'Quiz Battle', 'Race to answer questions correctly. Speed and accuracy earn points!')}
        ${this.renderGameTypeCard('jeopardy', '🎯', 'Jeopardy', 'Answer questions by category. Strategic and fun!')}
        ${this.renderGameTypeCard('bingo', '🎲', 'Study Bingo', 'Mark concepts as they\'re discussed. Collaborative learning!')}
        ${this.renderGameTypeCard('flashcards', '🃏', 'Flashcards', 'Review cards together. Great for group study!')}
      </div>

      <div class="game-settings">
        <div class="setting-group">
          <label>Number of Questions</label>
          <div class="question-count-buttons">
            <button class="count-btn ${this.selectedQuestionCount === 5 ? 'selected' : ''}" data-count="5">5</button>
            <button class="count-btn ${this.selectedQuestionCount === 10 ? 'selected' : ''}" data-count="10">10</button>
            <button class="count-btn ${this.selectedQuestionCount === 15 ? 'selected' : ''}" data-count="15">15</button>
            <button class="count-btn ${this.selectedQuestionCount === 20 ? 'selected' : ''}" data-count="20">20</button>
          </div>
        </div>

        <div class="setting-group">
          <label>Difficulty</label>
          <div class="difficulty-buttons">
            <button class="difficulty-btn ${this.selectedDifficulty === 'easy' ? 'selected' : ''}" data-difficulty="easy">Easy</button>
            <button class="difficulty-btn ${this.selectedDifficulty === 'medium' ? 'selected' : ''}" data-difficulty="medium">Medium</button>
            <button class="difficulty-btn ${this.selectedDifficulty === 'hard' ? 'selected' : ''}" data-difficulty="hard">Hard</button>
            <button class="difficulty-btn ${this.selectedDifficulty === 'mixed' ? 'selected' : ''}" data-difficulty="mixed">Mixed</button>
          </div>
        </div>
      </div>

      <div id="game-selection-message" class="message" style="display: none;"></div>
    `;

    // Re-attach event listeners for the updated content
    this.attachGameEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.modal) return;

    // Close modal handlers
    const closeButtons = this.modal.querySelectorAll('[data-close-modal]');
    closeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.resolvePromise?.(null);
        this.closeModal();
      });
    });

    // Cancel button
    const cancelBtn = this.modal.querySelector('#cancel-game-btn');
    cancelBtn?.addEventListener('click', () => {
      this.resolvePromise?.(null);
      this.closeModal();
    });

    // Start button
    const startBtn = this.modal.querySelector('#game-selection-start-btn');
    startBtn?.addEventListener('click', () => {
      this.resolvePromise?.({
        gameType: this.selectedGameType,
        questionCount: this.selectedQuestionCount,
        difficulty: this.selectedDifficulty,
      });
      this.closeModal();
    });

    // Game selection event listeners
    this.attachGameEventListeners();
  }

  /**
   * Attach game selection event listeners
   */
  private attachGameEventListeners(): void {
    if (!this.modal) return;

    // Game type selection
    const gameCards = this.modal.querySelectorAll('.game-type-card');
    gameCards.forEach((card) => {
      card.addEventListener('click', () => {
        this.selectedGameType = (card as HTMLElement).dataset.gameType as GameType;
        this.updateModal();
      });
    });

    // Question count selection
    const countButtons = this.modal.querySelectorAll('.count-btn');
    countButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedQuestionCount = parseInt((btn as HTMLElement).dataset.count || '10');
        this.updateModal();
      });
    });

    // Difficulty selection
    const difficultyButtons = this.modal.querySelectorAll('.difficulty-btn');
    difficultyButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedDifficulty = (btn as HTMLElement).dataset.difficulty as any;
        this.updateModal();
      });
    });
  }

  /**
   * Wait for the user to make a selection
   */
  private waitForResult(): Promise<GameSelectionResult | null> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }
}
