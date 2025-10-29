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
  
  // Auto-polish state
  private autoPolishTimer: number | null = null;
  private isAutoPolishActive: boolean = false;
  private lastPolishPosition: number = 0;
  private polishCycleCount: number = 0;
  private baseInterval: number = 30000; // 30 seconds
  private jitterRange: number = 5000; // ±5 seconds
  private minWords: number = 50;
  private fullPolishInterval: number = 5; // Every 5 cycles
  private polishIndicator: HTMLElement | null = null;

  constructor(aiClient: AIClient, getTranscriptionText: () => string) {
    this.aiClient = aiClient;
    this.getTranscriptionText = getTranscriptionText;
    this.polishBtn = document.getElementById('polish-btn') as HTMLButtonElement;
    this.createPolishIndicator();
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
  
  // ===== Auto-Polish Methods =====
  
  /**
   * Start auto-polish with jittered intervals
   */
  async startAutoPolish(settings: {
    interval: number;
    jitter: number;
    minWords: number;
    fullInterval: number;
  }): Promise<void> {
    if (this.isAutoPolishActive) {
      console.log('Auto-polish already active');
      return;
    }
    
    // Update settings
    this.baseInterval = settings.interval * 1000; // Convert to ms
    this.jitterRange = settings.jitter * 1000; // Convert to ms
    this.minWords = settings.minWords;
    this.fullPolishInterval = settings.fullInterval;
    
    // Reset state
    this.lastPolishPosition = 0;
    this.polishCycleCount = 0;
    this.isAutoPolishActive = true;
    
    console.log('🤖 Auto-polish started:', {
      baseInterval: this.baseInterval,
      jitterRange: this.jitterRange,
      minWords: this.minWords,
      fullPolishInterval: this.fullPolishInterval
    });
    
    // Schedule first polish
    this.scheduleNextPolish();
  }
  
  /**
   * Stop auto-polish
   */
  stopAutoPolish(): void {
    if (!this.isAutoPolishActive) {
      return;
    }
    
    if (this.autoPolishTimer !== null) {
      clearTimeout(this.autoPolishTimer);
      this.autoPolishTimer = null;
    }
    
    this.isAutoPolishActive = false;
    this.lastPolishPosition = 0;
    this.polishCycleCount = 0;
    
    console.log('🛑 Auto-polish stopped');
  }
  
  /**
   * Schedule next polish with jittered interval
   */
  private scheduleNextPolish(): void {
    if (!this.isAutoPolishActive) {
      return;
    }
    
    const interval = this.calculateNextInterval();
    console.log(`⏰ Next auto-polish in ${(interval / 1000).toFixed(1)}s`);
    
    this.autoPolishTimer = window.setTimeout(() => {
      this.performAutoPolish();
    }, interval);
  }
  
  /**
   * Calculate next interval with jitter
   */
  private calculateNextInterval(): number {
    // Random offset between -jitterRange and +jitterRange
    const randomOffset = (Math.random() * 2 - 1) * this.jitterRange;
    return this.baseInterval + randomOffset;
  }
  
  /**
   * Perform auto-polish (incremental or full)
   */
  private async performAutoPolish(): Promise<void> {
    if (!this.isAutoPolishActive) {
      return;
    }
    
    try {
      const currentText = this.getTranscriptionText();
      
      // Check if there's enough new content
      const newText = currentText.slice(this.lastPolishPosition);
      const wordCount = this.countWords(newText);
      
      if (wordCount < this.minWords) {
        console.log(`⏭️ Skipping auto-polish: only ${wordCount} new words (min: ${this.minWords})`);
        this.scheduleNextPolish();
        return;
      }
      
      // Increment cycle count
      this.polishCycleCount++;
      
      // Decide: incremental or full polish
      const shouldDoFullPolish = this.polishCycleCount >= this.fullPolishInterval;
      
      if (shouldDoFullPolish) {
        console.log(`🔄 Performing full polish (cycle ${this.polishCycleCount})`);
        await this.polishFull(currentText);
        this.polishCycleCount = 0; // Reset cycle count
        this.lastPolishPosition = currentText.length;
      } else {
        console.log(`✨ Performing incremental polish (cycle ${this.polishCycleCount}, ${wordCount} new words)`);
        await this.polishIncremental(newText, currentText);
      }
      
      // Schedule next polish
      this.scheduleNextPolish();
      
    } catch (error) {
      console.error('❌ Auto-polish failed:', error);
      // Continue scheduling despite error
      this.scheduleNextPolish();
    }
  }
  
  /**
   * Polish only new text (incremental)
   */
  private async polishIncremental(newText: string, fullText: string): Promise<void> {
    this.showPolishIndicator('Polishing...');
    
    try {
      const result = await this.aiClient.polishTranscription(newText, {
        grammar: true,
        punctuation: true,
        clarity: true,
        preserveMeaning: true
      });
      
      if (result.success && result.data) {
        // Replace the new portion with polished text
        const polishedText = result.data.polishedText;
        const updatedFullText = fullText.slice(0, this.lastPolishPosition) + polishedText;
        
        // Update transcription silently
        this.updateTranscriptionSilently(updatedFullText);
        
        // Update position
        this.lastPolishPosition = updatedFullText.length;
        
        console.log(`✅ Incremental polish complete (${result.data.tokensUsed} tokens)`);
        this.showPolishIndicator('Polished ✓', 2000);
      } else {
        console.error('Incremental polish failed:', result.error);
        this.showPolishIndicator('Polish failed', 2000);
      }
    } catch (error) {
      console.error('Incremental polish error:', error);
      this.showPolishIndicator('Polish failed', 2000);
    }
  }
  
  /**
   * Re-polish entire transcription (full)
   */
  private async polishFull(text: string): Promise<void> {
    this.showPolishIndicator('Full polish...');
    
    try {
      const result = await this.aiClient.polishTranscription(text, {
        grammar: true,
        punctuation: true,
        clarity: true,
        preserveMeaning: true
      });
      
      if (result.success && result.data) {
        const polishedText = result.data.polishedText;
        
        // Update transcription silently
        this.updateTranscriptionSilently(polishedText);
        
        // Update position to end
        this.lastPolishPosition = polishedText.length;
        
        console.log(`✅ Full polish complete (${result.data.tokensUsed} tokens)`);
        this.showPolishIndicator('Polished ✓', 2000);
      } else {
        console.error('Full polish failed:', result.error);
        this.showPolishIndicator('Polish failed', 2000);
      }
    } catch (error) {
      console.error('Full polish error:', error);
      this.showPolishIndicator('Polish failed', 2000);
    }
  }
  
  /**
   * Update transcription silently (without modal)
   */
  private updateTranscriptionSilently(text: string): void {
    const transcriptionContainer = document.getElementById('transcription-container');
    if (!transcriptionContainer) return;
    
    // Save scroll position
    const scrollTop = transcriptionContainer.scrollTop;
    const scrollHeight = transcriptionContainer.scrollHeight;
    const clientHeight = transcriptionContainer.clientHeight;
    const wasAtBottom = scrollTop + clientHeight >= scrollHeight - 50;
    
    // Update content
    transcriptionContainer.innerHTML = `<div class="flowing-transcription">${this.escapeHtml(text)}</div>`;
    
    // Restore scroll position (or keep at bottom if user was there)
    if (wasAtBottom) {
      transcriptionContainer.scrollTop = transcriptionContainer.scrollHeight;
    } else {
      transcriptionContainer.scrollTop = scrollTop;
    }
  }
  
  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
  
  /**
   * Create polish indicator element
   */
  private createPolishIndicator(): void {
    this.polishIndicator = document.createElement('div');
    this.polishIndicator.id = 'polish-indicator';
    this.polishIndicator.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      background: rgba(52, 152, 219, 0.95);
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      display: none;
      animation: slideInRight 0.3s ease;
    `;
    document.body.appendChild(this.polishIndicator);
  }
  
  /**
   * Show polish indicator
   */
  private showPolishIndicator(message: string, duration?: number): void {
    if (!this.polishIndicator) return;
    
    this.polishIndicator.textContent = `✨ ${message}`;
    this.polishIndicator.style.display = 'block';
    
    if (duration) {
      setTimeout(() => {
        this.hidePolishIndicator();
      }, duration);
    }
  }
  
  /**
   * Hide polish indicator
   */
  private hidePolishIndicator(): void {
    if (!this.polishIndicator) return;
    
    this.polishIndicator.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => {
      if (this.polishIndicator) {
        this.polishIndicator.style.display = 'none';
        this.polishIndicator.style.animation = 'slideInRight 0.3s ease';
      }
    }, 300);
  }
  
  /**
   * Check if auto-polish is active
   */
  isAutoPolishRunning(): boolean {
    return this.isAutoPolishActive;
  }
}
