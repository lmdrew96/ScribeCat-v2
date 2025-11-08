/**
 * TranscriptionManager
 * Handles transcription display and updates
 */

export class TranscriptionManager {
  private transcriptionContainer: HTMLElement;
  private lastPartialText: string = '';
  private timestampedEntries: Array<{ startTime: number; endTime: number; text: string }> = [];
  private recordingStartTime: number = 0;
  private totalPausedTime: number = 0;
  private pauseStartTime: number = 0;
  private isPaused: boolean = false;

  constructor() {
    this.transcriptionContainer = document.getElementById('transcription-container') as HTMLElement;
  }

  /**
   * Clear transcription panel
   */
  clear(): void {
    this.transcriptionContainer.innerHTML = '';
    this.lastPartialText = '';
    this.timestampedEntries = [];
    this.recordingStartTime = 0;
    this.totalPausedTime = 0;
    this.pauseStartTime = 0;
    this.isPaused = false;
  }

  /**
   * Start recording - initialize timestamp tracking
   */
  startRecording(): void {
    this.recordingStartTime = Date.now();
    this.timestampedEntries = [];
    this.totalPausedTime = 0;
    this.pauseStartTime = 0;
    this.isPaused = false;
  }

  /**
   * Pause recording - track paused time
   */
  pauseRecording(): void {
    if (!this.isPaused) {
      this.pauseStartTime = Date.now();
      this.isPaused = true;
    }
  }

  /**
   * Resume recording - accumulate paused time
   */
  resumeRecording(): void {
    if (this.isPaused) {
      this.totalPausedTime += Date.now() - this.pauseStartTime;
      this.isPaused = false;
    }
  }

  /**
   * Get the current active recording time (excluding paused time)
   */
  private getActiveRecordingTime(): number {
    const currentPausedTime = this.isPaused ? (Date.now() - this.pauseStartTime) : 0;
    const totalElapsed = Date.now() - this.recordingStartTime - this.totalPausedTime - currentPausedTime;
    return totalElapsed / 1000; // Convert to seconds
  }

  /**
   * Update flowing transcription with partial/final results
   */
  updateFlowing(text: string, isFinal: boolean, providedStartTime?: number, providedEndTime?: number): void {
    let flowingText = this.transcriptionContainer.querySelector('.flowing-transcription') as HTMLElement;

    if (!flowingText) {
      const placeholder = this.transcriptionContainer.querySelector('.transcription-placeholder');
      if (placeholder) placeholder.remove();

      flowingText = document.createElement('div');
      flowingText.className = 'flowing-transcription';
      this.transcriptionContainer.appendChild(flowingText);
    }

    if (isFinal) {
      // Use timestamps provided by AssemblyAI if available, otherwise calculate them
      const startTime = providedStartTime !== undefined
        ? providedStartTime
        : (this.recordingStartTime > 0 ? this.getActiveRecordingTime() : 0);

      // For end time, use provided value or estimate based on text length
      const endTime = providedEndTime !== undefined
        ? providedEndTime
        : startTime + Math.max(1.0, text.length * 0.05); // Rough estimate: 50ms per character

      console.log('💾 Storing timestamped entry:', {
        startTime,
        endTime,
        providedStartTime,
        providedEndTime,
        calculatedTime: this.getActiveRecordingTime(),
        duration: endTime - startTime,
        text: text.substring(0, 50) + '...'
      });

      // Store timestamped entry
      this.timestampedEntries.push({ startTime, endTime, text });

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
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get timestamped entries collected during recording
   */
  getTimestampedEntries(): Array<{ startTime: number; endTime: number; text: string }> {
    return this.timestampedEntries;
  }
}
