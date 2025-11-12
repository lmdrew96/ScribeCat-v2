/**
 * AutoSaveIndicator
 *
 * Displays subtle, non-intrusive auto-save status in the notes panel header.
 * Shows "Saving..." when saving and "Saved" when complete, then fades out.
 */

import { createLogger } from '../../shared/logger.js';

const logger = createLogger('AutoSaveIndicator');

export enum SaveState {
  IDLE = 'idle',
  SAVING = 'saving',
  SAVED = 'saved',
  ERROR = 'error'
}

export class AutoSaveIndicator {
  private container: HTMLElement | null;
  private iconElement: HTMLElement | null;
  private textElement: HTMLElement | null;
  private currentState: SaveState = SaveState.IDLE;
  private fadeOutTimer: number | null = null;

  constructor(containerId: string = 'auto-save-indicator') {
    this.container = document.getElementById(containerId);

    if (!this.container) {
      logger.warn(`Auto-save indicator container not found: ${containerId}`);
      this.iconElement = null;
      this.textElement = null;
      return;
    }

    this.iconElement = this.container.querySelector('.auto-save-icon');
    this.textElement = this.container.querySelector('.auto-save-text');

    logger.info('AutoSaveIndicator initialized');
  }

  /**
   * Show "Saving..." indicator
   */
  showSaving(): void {
    if (!this.container || !this.iconElement || !this.textElement) return;

    // Clear any pending fade-out
    if (this.fadeOutTimer) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }

    this.currentState = SaveState.SAVING;

    // Update icon (spinner)
    this.iconElement.textContent = '↻';
    this.iconElement.className = 'auto-save-icon saving';

    // Update text
    this.textElement.textContent = 'Saving...';

    // Show container
    this.container.style.display = 'flex';
    this.container.className = 'auto-save-indicator saving';

    logger.debug('Showing saving indicator');
  }

  /**
   * Show "Saved" indicator briefly, then fade out
   */
  showSaved(): void {
    if (!this.container || !this.iconElement || !this.textElement) return;

    // Clear any pending fade-out
    if (this.fadeOutTimer) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }

    this.currentState = SaveState.SAVED;

    // Update icon (checkmark)
    this.iconElement.textContent = '✓';
    this.iconElement.className = 'auto-save-icon saved';

    // Update text
    this.textElement.textContent = 'Saved';

    // Show container
    this.container.style.display = 'flex';
    this.container.className = 'auto-save-indicator saved';

    logger.debug('Showing saved indicator');

    // Fade out after 2 seconds
    this.fadeOutTimer = window.setTimeout(() => {
      this.hide();
    }, 2000);
  }

  /**
   * Show error indicator
   */
  showError(message: string = 'Save failed'): void {
    if (!this.container || !this.iconElement || !this.textElement) return;

    // Clear any pending fade-out
    if (this.fadeOutTimer) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }

    this.currentState = SaveState.ERROR;

    // Update icon (error symbol)
    this.iconElement.textContent = '✕';
    this.iconElement.className = 'auto-save-icon error';

    // Update text
    this.textElement.textContent = message;

    // Show container
    this.container.style.display = 'flex';
    this.container.className = 'auto-save-indicator error';

    logger.warn('Showing error indicator');

    // Fade out after 5 seconds
    this.fadeOutTimer = window.setTimeout(() => {
      this.hide();
    }, 5000);
  }

  /**
   * Hide the indicator
   */
  hide(): void {
    if (!this.container) return;

    this.container.style.display = 'none';
    this.currentState = SaveState.IDLE;

    if (this.fadeOutTimer) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }

    logger.debug('Hiding indicator');
  }

  /**
   * Get current state
   */
  getState(): SaveState {
    return this.currentState;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.fadeOutTimer) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }

    this.container = null;
    this.iconElement = null;
    this.textElement = null;

    logger.info('AutoSaveIndicator destroyed');
  }
}
