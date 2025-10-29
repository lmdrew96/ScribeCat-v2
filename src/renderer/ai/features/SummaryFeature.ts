/**
 * SummaryFeature
 * Handles summary generation functionality
 */

import type { SummaryResult } from '../../../shared/types.js';
import { AIClient } from '../AIClient.js';

export class SummaryFeature {
  private summarizeBtn: HTMLButtonElement | null = null;
  private aiClient: AIClient;
  private getTranscriptionText: () => string;
  private getNotesText: () => string;

  constructor(
    aiClient: AIClient,
    getTranscriptionText: () => string,
    getNotesText: () => string
  ) {
    this.aiClient = aiClient;
    this.getTranscriptionText = getTranscriptionText;
    this.getNotesText = getNotesText;
    this.summarizeBtn = document.getElementById('summarize-btn') as HTMLButtonElement;
  }

  /**
   * Set up event listeners
   */
  setupEventListeners(onSummarize: () => Promise<void>): void {
    this.summarizeBtn?.addEventListener('click', onSummarize);
  }

  /**
   * Update button state
   */
  updateButtonState(isAvailable: boolean): void {
    if (this.summarizeBtn) {
      this.summarizeBtn.disabled = !isAvailable;
      this.summarizeBtn.title = isAvailable ? 'Generate AI summary' : 'Configure AI in settings';
    }
  }

  /**
   * Generate summary
   */
  async generateSummary(): Promise<void> {
    const transcriptionText = this.getTranscriptionText();
    const notesText = this.getNotesText();

    if (!transcriptionText || transcriptionText.trim().length === 0) {
      alert('No transcription text to summarize');
      return;
    }

    if (!this.summarizeBtn) return;

    const originalText = this.summarizeBtn.textContent;
    this.summarizeBtn.disabled = true;
    this.summarizeBtn.textContent = '📝 Summarizing...';

    try {
      const result = await this.aiClient.generateSummary(
        transcriptionText,
        notesText,
        { style: 'bullet-points', maxLength: 300 }
      );

      if (result.success) {
        this.showSummaryResult(result.data);
      } else {
        alert(`Failed to generate summary: ${result.error}`);
      }
    } catch (error) {
      console.error('Summary generation failed:', error);
      alert('Failed to generate summary. Please try again.');
    } finally {
      this.summarizeBtn.disabled = false;
      this.summarizeBtn.textContent = originalText;
    }
  }

  /**
   * Show summary result in a modal
   */
  private showSummaryResult(result: SummaryResult): void {
    const modal = document.createElement('div');
    modal.className = 'modal result-modal';

    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Session Summary</h2>
          <button class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="result-section">
            <h4>Summary</h4>
            <div class="result-text">${this.escapeHtml(result.summary)}</div>
          </div>
          
          <div class="result-section" style="margin-top: 20px;">
            <h4>Key Points</h4>
            <ul style="list-style: disc; padding-left: 20px; color: var(--text-primary);">
              ${result.keyPoints.map(point => `<li style="margin-bottom: 8px;">${this.escapeHtml(point)}</li>`).join('')}
            </ul>
          </div>
          
          ${result.actionItems && result.actionItems.length > 0 ? `
            <div class="result-section" style="margin-top: 20px;">
              <h4>Action Items</h4>
              <ul style="list-style: disc; padding-left: 20px; color: var(--text-primary);">
                ${result.actionItems.map(item => `<li style="margin-bottom: 8px;">${this.escapeHtml(item)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          <div class="token-usage">Tokens used: ${result.tokensUsed}</div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn close-modal-btn">Close</button>
          <button class="primary-btn copy-btn">Copy to Notes</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const closeModalBtn = modal.querySelector('.close-modal-btn');
    const copyBtn = modal.querySelector('.copy-btn');
    const overlay = modal.querySelector('.modal-overlay');

    const closeModal = () => modal.remove();

    closeBtn?.addEventListener('click', closeModal);
    closeModalBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', closeModal);

    copyBtn?.addEventListener('click', () => {
      // Copy summary to notes
      const notesEditor = document.getElementById('notes-editor');
      if (notesEditor) {
        let summaryText = `\n\n--- AI Summary ---\n\n${result.summary}\n\n`;
        summaryText += `Key Points:\n${result.keyPoints.map(p => `• ${p}`).join('\n')}`;

        if (result.actionItems && result.actionItems.length > 0) {
          summaryText += `\n\nAction Items:\n${result.actionItems.map(i => `• ${i}`).join('\n')}`;
        }

        notesEditor.innerHTML += summaryText.replace(/\n/g, '<br>');
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
