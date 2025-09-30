class ScribeCatApp {
  private recordBtn!: HTMLButtonElement;
  private notesEditor!: HTMLElement;
  private recordingStatus!: HTMLElement;
  private isRecording: boolean = false;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
  }

  private initializeElements(): void {
    this.recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
    this.notesEditor = document.getElementById('notes-editor') as HTMLElement;
    this.recordingStatus = document.getElementById('recording-status') as HTMLElement;
  }

  private setupEventListeners(): void {
    this.recordBtn.addEventListener('click', () => this.toggleRecording());
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
      await window.electronAPI.recording.start();
      this.isRecording = true;
      this.recordBtn.textContent = 'Stop Recording';
      this.recordBtn.classList.add('recording');
      this.recordingStatus.textContent = 'Recording...';
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }

  private async stopRecording(): Promise<void> {
    try {
      await window.electronAPI.recording.stop();
      this.isRecording = false;
      this.recordBtn.textContent = 'Start Recording';
      this.recordBtn.classList.remove('recording');
      this.recordingStatus.textContent = 'Recording stopped';
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ScribeCatApp();
});
