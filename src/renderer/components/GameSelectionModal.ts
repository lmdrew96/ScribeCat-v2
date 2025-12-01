/**
 * Game Selection Modal
 * Allows the host to choose which multiplayer game to start
 */

import { GameType, GameLength } from '../../domain/entities/GameSession.js';
import { getIconHTML } from '../utils/iconMap.js';

// Game icon helper
const gameIcon = (name: string, size = 32): string => getIconHTML(name as any, { size });

export interface GameSelectionResult {
  gameType: GameType;
  questionCount: number;
  gameLength: GameLength;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  progressiveDifficulty: boolean;
  powerUpsEnabled: boolean;
}

export class GameSelectionModal {
  private modal: HTMLElement | null = null;
  private selectedGameType: GameType = 'quiz_battle';
  private selectedQuestionCount: number = 10;
  private selectedGameLength: GameLength = 'medium';
  private selectedDifficulty: 'easy' | 'medium' | 'hard' | 'mixed' = 'mixed';
  private progressiveDifficulty: boolean = true;
  private powerUpsEnabled: boolean = true;
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
              ${this.renderGameTypeCard('quiz_battle', gameIcon('zap'), 'Quiz Battle', 'Race to answer questions correctly. Speed and accuracy earn points!')}
              ${this.renderGameTypeCard('jeopardy', gameIcon('target'), 'Jeopardy', 'Answer questions by category with buzzer mechanic. Strategic and competitive!')}
              ${this.renderGameTypeCard('hot_seat_challenge', gameIcon('flame'), 'Hot Seat Challenge', 'Take turns in the hot seat. Other players can challenge your answers!')}
              ${this.renderGameTypeCard('lightning_chain', gameIcon('zap') + gameIcon('link', 24), 'Lightning Chain', 'Team up against the clock. Cooperative time challenge!')}
            </div>

            <div class="game-settings">
              <div class="setting-group">
                <label>Game Length</label>
                <div class="game-length-buttons">
                  <button class="length-btn ${this.selectedGameLength === 'short' ? 'selected' : ''}" data-length="short">Short (10 questions)</button>
                  <button class="length-btn ${this.selectedGameLength === 'medium' ? 'selected' : ''}" data-length="medium">Medium (15 questions)</button>
                  <button class="length-btn ${this.selectedGameLength === 'long' ? 'selected' : ''}" data-length="long">Long (20 questions)</button>
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

              <div class="setting-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="progressive-difficulty-toggle" ${this.progressiveDifficulty ? 'checked' : ''}>
                  Progressive Difficulty (Easy → Medium → Hard)
                </label>
              </div>

              <div class="setting-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="power-ups-toggle" ${this.powerUpsEnabled ? 'checked' : ''}>
                  Enable Power-ups
                </label>
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
        ${isSelected ? `<div class="game-selected-badge">${getIconHTML('check', { size: 16 })}</div>` : ''}
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
        ${this.renderGameTypeCard('quiz_battle', gameIcon('zap'), 'Quiz Battle', 'Race to answer questions correctly. Speed and accuracy earn points!')}
        ${this.renderGameTypeCard('jeopardy', gameIcon('target'), 'Jeopardy', 'Answer questions by category with buzzer mechanic. Strategic and competitive!')}
        ${this.renderGameTypeCard('hot_seat_challenge', gameIcon('flame'), 'Hot Seat Challenge', 'Take turns in the hot seat. Other players can challenge your answers!')}
        ${this.renderGameTypeCard('lightning_chain', gameIcon('zap') + gameIcon('link', 24), 'Lightning Chain', 'Team up against the clock. Cooperative time challenge!')}
      </div>

      <div class="game-settings">
        <div class="setting-group">
          <label>Game Length</label>
          <div class="game-length-buttons">
            <button class="length-btn ${this.selectedGameLength === 'short' ? 'selected' : ''}" data-length="short">Short (10 questions)</button>
            <button class="length-btn ${this.selectedGameLength === 'medium' ? 'selected' : ''}" data-length="medium">Medium (15 questions)</button>
            <button class="length-btn ${this.selectedGameLength === 'long' ? 'selected' : ''}" data-length="long">Long (20 questions)</button>
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

        <div class="setting-group">
          <label class="checkbox-label">
            <input type="checkbox" id="progressive-difficulty-toggle" ${this.progressiveDifficulty ? 'checked' : ''}>
            Progressive Difficulty (Easy → Medium → Hard)
          </label>
        </div>

        <div class="setting-group">
          <label class="checkbox-label">
            <input type="checkbox" id="power-ups-toggle" ${this.powerUpsEnabled ? 'checked' : ''}>
            Enable Power-ups
          </label>
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
      // Calculate question count from game length
      const lengthQuestions: Record<GameLength, number> = {
        short: 10,
        medium: 15,
        long: 20,
      };

      this.resolvePromise?.({
        gameType: this.selectedGameType,
        questionCount: lengthQuestions[this.selectedGameLength],
        gameLength: this.selectedGameLength,
        difficulty: this.selectedDifficulty,
        progressiveDifficulty: this.progressiveDifficulty,
        powerUpsEnabled: this.powerUpsEnabled,
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

    // Game length selection
    const lengthButtons = this.modal.querySelectorAll('.length-btn');
    lengthButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedGameLength = (btn as HTMLElement).dataset.length as GameLength;
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

    // Progressive difficulty toggle
    const progressiveToggle = this.modal.querySelector('#progressive-difficulty-toggle') as HTMLInputElement;
    progressiveToggle?.addEventListener('change', () => {
      this.progressiveDifficulty = progressiveToggle.checked;
    });

    // Power-ups toggle
    const powerUpsToggle = this.modal.querySelector('#power-ups-toggle') as HTMLInputElement;
    powerUpsToggle?.addEventListener('change', () => {
      this.powerUpsEnabled = powerUpsToggle.checked;
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
