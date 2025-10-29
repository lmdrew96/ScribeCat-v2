/**
 * PolishFeature
 * Handles transcription polishing functionality
 */

import type { PolishResult } from '../../../shared/types.js';
import { AIClient } from '../AIClient.js';

export class PolishFeature {
  private polishBtn: HTMLButtonElement | null = null;
  private aiClient: AIClient;
  private getTranscriptionText: () => string;

  constructor(aiClient: AIClient, getTranscriptionText: () => string) {
    this.aiClient = aiClient;
    this.getTranscriptionText = getTranscriptionText;
    this.polishBtn = document.getElementById('polish-btn') as HTMLButtonElement;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners(onPolish: () => Promise<void>): void {
    this.polishBtn?.addEventListener('click', onPolish);
  }

  /**
   * Update button state
   */
  updateButtonState(isAvailable: boolean): void {
    if (this.polishBtn) {
      this.polishBtn.disabled = !isAvailable;
      this.polishBtn.title = isAvailable ? 'Polish transcription with AI' : 'Configure AI in settings';
    }
  }

  /**
   * Polish transcription
   */
  async polish(): Promise<void> {
    const transcriptionText = this.getTranscriptionText();

    if (!transcriptionText || transcriptionText.trim().length === 0) {
      alert('No transcription text to polish');
      return;
    }

    if (!this.polishBtn) return;

    const originalText = this.polishBtn.textContent;
    this.polishBtn.disabled = true;
    this.polishBtn.textContent = '✨ Polishing...';

    try {
      const result = await this.aiClient.polishTranscription(transcriptionText, {
        grammar: true,
        punctuation: true,
        clarity: true,
        preserveMeaning: true
      });

      if (result.success) {
        this.showPolishResult(result.data);
      } else {
        alert(`Failed to polish transcription: ${result.error}`);
      }
    } catch (error) {
      console.error('Polish failed:', error);
      alert('Failed to polish transcription. Please try again.');
    } finally {
      this.polishBtn.disabled = false;
      this.polishBtn.textContent = originalText;
    }
  }

  /**
   * Show polish result in a modal
   */
  private showPolishResult(result: PolishResult): void {
    const modal = document.createElement('div');
    modal.className = 'modal result-modal';

    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Polished Transcription</h2>
          <button class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="result-comparison">
            <div class="result-section">
              <h4>Original</h4>
              <div class="result-text">${this.escapeHtml(result.originalText)}</div>
            </div>
            <div class="result-section">
              <h4>Polished</h4>
              <div class="result-text">${this.escapeHtml(result.polishedText)}</div>
            </div>
          </div>
          ${result.changes.length > 0 ? `
            <div class="result-changes">
              <h4>Changes Made:</h4>
              <ul>
                ${result.changes.map(change => `<li>${this.escapeHtml(change)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          <div class="token-usage">Tokens used: ${result.tokensUsed}</div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn cancel-btn">Cancel</button>
          <button class="primary-btn accept-btn">Accept & Replace</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const acceptBtn = modal.querySelector('.accept-btn');
    const overlay = modal.querySelector('.modal-overlay');

    const closeModal = () => modal.remove();

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    acceptBtn?.addEventListener('click', () => {
      // Replace transcription text
      const transcriptionContainer = document.getElementById('transcription-container');
      if (transcriptionContainer) {
        transcriptionContainer.innerHTML = `<div class="flowing-transcription">${this.escapeHtml(result.polishedText)}</div>`;
      }
      closeModal();
    });
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
