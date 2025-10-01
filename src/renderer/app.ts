class ScribeCatApp {
  private recordBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private resumeBtn!: HTMLButtonElement;
  private notesEditor!: HTMLElement;
  private recordingStatus!: HTMLElement;
  private vuMeter!: HTMLElement;
  private durationDisplay!: HTMLElement;
  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private statusUpdateInterval: number | null = null;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.setupAudioLevelListener();
  }

  private initializeElements(): void {
    this.recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
    this.pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
    this.resumeBtn = document.getElementById('resume-btn') as HTMLButtonElement;
    this.notesEditor = document.getElementById('notes-editor') as HTMLElement;
    this.recordingStatus = document.getElementById('recording-status') as HTMLElement;
    this.vuMeter = document.getElementById('vu-meter') as HTMLElement;
    this.durationDisplay = document.getElementById('duration-display') as HTMLElement;
  }

  private setupEventListeners(): void {
    this.recordBtn.addEventListener('click', () => this.toggleRecording());
    this.pauseBtn.addEventListener('click', () => this.pauseRecording());
    this.resumeBtn.addEventListener('click', () => this.resumeRecording());
  }

  private setupAudioLevelListener(): void {
    window.electronAPI.recording.onAudioLevel((level: number) => {
      this.updateVUMeter(level);
    });
  }

  private async toggleRecording(): Promise<void> {
    if (this.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    try {
      const result = await window.electronAPI.recording.start();
      if (result.success) {
        this.isRecording = true;
        this.isPaused = false;
        this.updateUI();
        this.startStatusUpdates();
        this.recordingStatus.textContent = 'Recording...';
      } else {
        throw new Error(result.error || 'Failed to start recording');
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.recordingStatus.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async stopRecording(): Promise<void> {
    try {
      const result = await window.electronAPI.recording.stop();
      if (result.success) {
        this.isRecording = false;
        this.isPaused = false;
        this.updateUI();
        this.stopStatusUpdates();
        this.recordingStatus.textContent = `Recording saved: ${result.filePath}`;
        this.durationDisplay.textContent = '00:00';
        this.updateVUMeter(0);
      } else {
        throw new Error(result.error || 'Failed to stop recording');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.recordingStatus.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async pauseRecording(): Promise<void> {
    try {
      const result = await window.electronAPI.recording.pause();
      if (result.success) {
        this.isPaused = true;
        this.updateUI();
        this.recordingStatus.textContent = 'Recording paused...';
      } else {
        throw new Error(result.error || 'Failed to pause recording');
      }
    } catch (error) {
      console.error('Failed to pause recording:', error);
      this.recordingStatus.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async resumeRecording(): Promise<void> {
    try {
      const result = await window.electronAPI.recording.resume();
      if (result.success) {
        this.isPaused = false;
        this.updateUI();
        this.recordingStatus.textContent = 'Recording...';
      } else {
        throw new Error(result.error || 'Failed to resume recording');
      }
    } catch (error) {
      console.error('Failed to resume recording:', error);
      this.recordingStatus.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private updateUI(): void {
    this.recordBtn.textContent = this.isRecording ? 'Stop Recording' : 'Start Recording';
    this.recordBtn.classList.toggle('recording', this.isRecording);
    this.pauseBtn.disabled = !this.isRecording || this.isPaused;
    this.resumeBtn.disabled = !this.isRecording || !this.isPaused;
  }

  private startStatusUpdates(): void {
    this.statusUpdateInterval = window.setInterval(async () => {
      try {
        const status = await window.electronAPI.recording.getStatus();
        this.durationDisplay.textContent = this.formatDuration(status.duration);
      } catch (error) {
        console.error('Failed to get recording status:', error);
      }
    }, 1000);
  }

  private stopStatusUpdates(): void {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
  }

  private updateVUMeter(level: number): void {
    if (this.vuMeter) {
      this.vuMeter.style.width = `${level}%`;
      this.vuMeter.style.backgroundColor = level > 80 ? '#ff4444' : level > 50 ? '#ffaa00' : '#44ff44';
    }
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ScribeCatApp();
});
