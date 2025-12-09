/**
 * StudyQuestModal
 *
 * A modal overlay that displays the StudyQuest game canvas.
 * This is the main entry point for playing StudyQuest.
 */

import { StudyQuestGame } from '../game/StudyQuestGame.js';

export class StudyQuestModal {
  private modal: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private game: StudyQuestGame | null = null;
  private isOpen = false;

  constructor() {
    this.createModal();
    this.setupKeyboardClose();
  }

  /**
   * Create the modal DOM structure
   */
  private createModal(): void {
    // Create modal container
    this.modal = document.createElement('div');
    this.modal.id = 'studyquest-modal';
    this.modal.className = 'studyquest-modal';
    this.modal.innerHTML = `
      <div class="studyquest-modal-backdrop"></div>
      <div class="studyquest-modal-content">
        <div class="studyquest-modal-header">
          <h2>StudyQuest</h2>
          <button class="studyquest-modal-close" title="Close (Esc)">&times;</button>
        </div>
        <div class="studyquest-modal-body">
          <canvas id="studyquest-canvas" width="640" height="400"></canvas>
        </div>
        <div class="studyquest-modal-footer">
          <span class="studyquest-controls-hint">
            Arrow/WASD: Move | ENTER: Select/Interact | Click X or outside to close
          </span>
        </div>
      </div>
    `;

    // Add styles
    this.addStyles();

    // Add to document
    document.body.appendChild(this.modal);

    // Get canvas reference
    this.canvas = this.modal.querySelector('#studyquest-canvas');

    // Setup close handlers
    const backdrop = this.modal.querySelector('.studyquest-modal-backdrop');
    const closeBtn = this.modal.querySelector('.studyquest-modal-close');

    backdrop?.addEventListener('click', () => this.close());
    closeBtn?.addEventListener('click', () => this.close());
  }

  /**
   * Add modal styles
   */
  private addStyles(): void {
    if (document.getElementById('studyquest-modal-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'studyquest-modal-styles';
    styles.textContent = `
      .studyquest-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        align-items: center;
        justify-content: center;
      }

      .studyquest-modal.open {
        display: flex;
      }

      .studyquest-modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
      }

      .studyquest-modal-content {
        position: relative;
        background: var(--surface-color, #2a2a3e);
        border: 3px solid var(--border-color, #000);
        border-radius: 12px;
        box-shadow: 6px 6px 0 var(--shadow-color, #000);
        overflow: hidden;
        max-width: 95vw;
        max-height: 95vh;
      }

      .studyquest-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: var(--header-bg, #1a1a2e);
        border-bottom: 2px solid var(--border-color, #000);
      }

      .studyquest-modal-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: bold;
        color: var(--text-color, #fff);
      }

      .studyquest-modal-close {
        background: none;
        border: none;
        font-size: 24px;
        color: var(--text-color, #fff);
        cursor: pointer;
        padding: 0 8px;
        line-height: 1;
        opacity: 0.7;
        transition: opacity 0.2s;
      }

      .studyquest-modal-close:hover {
        opacity: 1;
      }

      .studyquest-modal-body {
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #28283c;
      }

      #studyquest-canvas {
        display: block;
        image-rendering: pixelated;
        image-rendering: crisp-edges;
      }

      .studyquest-modal-footer {
        padding: 8px 16px;
        background: var(--header-bg, #1a1a2e);
        border-top: 2px solid var(--border-color, #000);
        text-align: center;
      }

      .studyquest-controls-hint {
        font-size: 11px;
        color: var(--text-muted, #888);
      }
    `;
    document.head.appendChild(styles);
  }

  /**
   * Setup keyboard shortcut to close modal
   * Note: ESC is used in-game for menu, so we don't use it to close the modal
   */
  private setupKeyboardClose(): void {
    // ESC is handled by the game itself (returns to title screen)
    // Modal is closed via X button or clicking backdrop
  }

  /**
   * Open the modal and start the game
   */
  open(): void {
    if (this.isOpen) return;

    this.isOpen = true;
    this.modal?.classList.add('open');

    // Start the game if not already running
    if (this.canvas && !this.game) {
      this.game = new StudyQuestGame(this.canvas);
      this.game.start();
    }
  }

  /**
   * Close the modal and destroy the game
   */
  close(): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.modal?.classList.remove('open');

    // Destroy the game to free resources
    if (this.game) {
      this.game.destroy();
      this.game = null;
    }
  }

  /**
   * Toggle the modal open/closed
   */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Check if modal is currently open
   */
  getIsOpen(): boolean {
    return this.isOpen;
  }
}
