/**
 * ViewManager
 * Handles view switching and UI state management
 */

export class ViewManager {
  private recordBtn: HTMLButtonElement;
  private pauseBtn: HTMLButtonElement;
  private microphoneSelect: HTMLSelectElement;
  private vuMeter: HTMLElement;
  private recordingStatus: HTMLElement;
  private transcriptionMode: HTMLElement;
  private elapsedTime: HTMLElement;
  private sessionInfo: HTMLElement;

  constructor() {
    this.recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
    this.pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
    this.microphoneSelect = document.getElementById('microphone-select') as HTMLSelectElement;
    this.vuMeter = document.getElementById('vu-meter') as HTMLElement;
    this.recordingStatus = document.getElementById('recording-status') as HTMLElement;
    this.transcriptionMode = document.getElementById('transcription-mode') as HTMLElement;
    this.elapsedTime = document.getElementById('elapsed-time') as HTMLElement;
    this.sessionInfo = document.getElementById('session-info') as HTMLElement;
  }

  /**
   * Update UI state based on recording status
   */
  updateRecordingState(isRecording: boolean, mode?: 'simulation' | 'assemblyai'): void {
    if (isRecording) {
      // Update record button
      this.recordBtn.classList.add('recording');
      this.recordBtn.title = 'Stop Recording';
      
      // Enable pause button
      this.pauseBtn.disabled = false;
      
      // Update status
      this.recordingStatus.textContent = 'Recording';
      this.recordingStatus.classList.remove('idle');
      this.recordingStatus.classList.add('recording');
      
      // Update transcription mode display
      if (mode) {
        const modeText = mode === 'assemblyai' ? 'AssemblyAI' : 'Simulation';
        this.transcriptionMode.textContent = `Mode: ${modeText}`;
        this.transcriptionMode.className = `mode-indicator ${mode}`;
      }
      
      // Disable device selection while recording
      this.microphoneSelect.disabled = true;
    } else {
      // Update record button
      this.recordBtn.classList.remove('recording');
      this.recordBtn.title = 'Start Recording';
      
      // Disable pause button
      this.pauseBtn.disabled = true;
      this.pauseBtn.classList.remove('paused');
      
      // Update status
      this.recordingStatus.textContent = 'Idle';
      this.recordingStatus.classList.remove('recording');
      this.recordingStatus.classList.add('idle');
      
      // Clear mode display
      this.transcriptionMode.textContent = '';
      this.transcriptionMode.className = 'mode-indicator';
      
      // Re-enable device selection
      this.microphoneSelect.disabled = false;
      
      // Reset VU meter
      this.vuMeter.style.width = '0%';
    }
  }

  /**
   * Update UI state based on paused status
   */
  updatePausedState(isPaused: boolean): void {
    if (isPaused) {
      // Update pause button
      this.pauseBtn.classList.add('paused');
      this.pauseBtn.title = 'Resume Recording';
      const pauseIcon = this.pauseBtn.querySelector('.pause-icon');
      if (pauseIcon) {
        pauseIcon.textContent = '▶';
      }
      
      // Update status
      this.recordingStatus.textContent = 'Paused';
      
      // Dim VU meter
      this.vuMeter.style.opacity = '0.3';
    } else {
      // Update pause button
      this.pauseBtn.classList.remove('paused');
      this.pauseBtn.title = 'Pause Recording';
      const pauseIcon = this.pauseBtn.querySelector('.pause-icon');
      if (pauseIcon) {
        pauseIcon.textContent = '⏸';
      }
      
      // Update status
      this.recordingStatus.textContent = 'Recording';
      
      // Restore VU meter
      this.vuMeter.style.opacity = '1';
    }
  }

  /**
   * Update VU meter display
   */
  updateVUMeter(level: number): void {
    const percentage = Math.min(100, level * 100);
    this.vuMeter.style.width = `${percentage}%`;
  }

  /**
   * Update elapsed time display
   */
  updateElapsedTime(seconds: number): void {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    this.elapsedTime.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Show session info message
   */
  showSessionInfo(message: string, duration: number = 5000): void {
    this.sessionInfo.textContent = message;
    if (duration > 0) {
      setTimeout(() => {
        this.sessionInfo.textContent = '';
      }, duration);
    }
  }

  /**
   * Clear session info
   */
  clearSessionInfo(): void {
    this.sessionInfo.textContent = '';
  }
}
