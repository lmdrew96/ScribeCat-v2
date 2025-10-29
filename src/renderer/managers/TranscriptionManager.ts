/**
 * TranscriptionManager
 * Handles transcription display and updates
 */

export class TranscriptionManager {
  private transcriptionContainer: HTMLElement;
  private lastPartialText: string = '';

  constructor() {
    this.transcriptionContainer = document.getElementById('transcription-container') as HTMLElement;
  }

  /**
   * Clear transcription panel
   */
  clear(): void {
    this.transcriptionContainer.innerHTML = '';
    this.lastPartialText = '';
  }

  /**
   * Add transcription entry (for simulation mode)
   */
  addEntry(timestamp: number, text: string): void {
    let flowingText = this.transcriptionContainer.querySelector('.flowing-transcription') as HTMLElement;
    
    if (!flowingText) {
      // Remove placeholder if it exists
      const placeholder = this.transcriptionContainer.querySelector('.transcription-placeholder');
      if (placeholder) {
        placeholder.remove();
      }
      
      // Create flowing text container
      flowingText = document.createElement('div');
      flowingText.className = 'flowing-transcription';
      this.transcriptionContainer.appendChild(flowingText);
    }
    
    // Append text with a space
    const textNode = document.createTextNode(' ' + text);
    flowingText.appendChild(textNode);
    
    // Auto-scroll to bottom
    this.transcriptionContainer.scrollTop = this.transcriptionContainer.scrollHeight;
  }

  /**
   * Update flowing transcription with partial/final results (for AssemblyAI)
   */
  updateFlowing(text: string, isFinal: boolean): void {
    let flowingText = this.transcriptionContainer.querySelector('.flowing-transcription') as HTMLElement;
    
    if (!flowingText) {
      const placeholder = this.transcriptionContainer.querySelector('.transcription-placeholder');
      if (placeholder) placeholder.remove();
      
      flowingText = document.createElement('div');
      flowingText.className = 'flowing-transcription';
      this.transcriptionContainer.appendChild(flowingText);
    }

    if (isFinal) {
      // Final text - append permanently and clear partial
      if (this.lastPartialText) {
        // Remove the partial span
        const partialSpan = flowingText.querySelector('.partial-text');
        if (partialSpan) partialSpan.remove();
        this.lastPartialText = '';
      }
      
      // Add final text
      const textNode = document.createTextNode(' ' + text);
      flowingText.appendChild(textNode);
    } else {
      // Partial text - update the temporary span
      let partialSpan = flowingText.querySelector('.partial-text') as HTMLElement;
      
      if (!partialSpan) {
        partialSpan = document.createElement('span');
        partialSpan.className = 'partial-text';
        flowingText.appendChild(partialSpan);
      }
      
      partialSpan.textContent = ' ' + text;
      this.lastPartialText = text;
    }

    this.transcriptionContainer.scrollTop = this.transcriptionContainer.scrollHeight;
  }

  /**
   * Get current transcription text
   */
  getText(): string {
    const flowingText = this.transcriptionContainer.querySelector('.flowing-transcription');
    if (flowingText) {
      return flowingText.textContent || '';
    }
    return '';
  }

  /**
   * Set transcription text (for loading sessions)
   */
  setText(text: string): void {
    this.clear();
    
    const flowingText = document.createElement('div');
    flowingText.className = 'flowing-transcription';
    flowingText.textContent = text;
    this.transcriptionContainer.appendChild(flowingText);
  }

  /**
   * Replace transcription text (for polish feature)
   */
  replaceText(text: string): void {
    this.transcriptionContainer.innerHTML = `<div class="flowing-transcription">${this.escapeHtml(text)}</div>`;
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
