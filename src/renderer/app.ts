// src/renderer/app.ts

import { RecordingService } from './recording-service';

class ScribeCatApp {
  private recordBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private resumeBtn!: HTMLButtonElement;
  private notesEditor!: HTMLElement;
  private recordingStatus!: HTMLElement;
  private vuMeter!: HTMLElement;
  private durationDisplay!: HTMLElement;
  private recordingService: RecordingService;
  private statusUpdateInterval: number | null = null;

  constructor() {
    this.recordingService = new RecordingService();
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
    this.recordingService.onAudioLevel((level: number) => {
      this.updateVUMeter(level);
    });
  }

  private async toggleRecording(): Promise<void> {
    const status = this.recordingService.getStatus();
    
    if (status.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    try {
      // Start recording in renderer process
      await this.recordingService.start();
      
      // Notify main process (for any setup needed)
      await window.electronAPI.recording.start();
      
      // Update UI
      this.updateUI();
      this.startStatusUpdates();
      this.recordingStatus.textContent = 'Recording...';
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.recordingStatus.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async stopRecording(): Promise<void> {
    try {
      // Stop recording and get audio blob
      const audioBlob = await this.recordingService.stop();
      
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Get final status
      const status = this.recordingService.getStatus();
      
      // Send to main process to save
      const result = await window.electronAPI.recording.stop(arrayBuffer, status.duration);
      
      if (result.success) {
        this.stopStatusUpdates();
        this.recordingStatus.textContent = `Recording saved: ${result.filePath}`;
        this.durationDisplay.textContent = '00:00';
        this.updateVUMeter(0);
      } else {
        throw new Error(result.error || 'Failed to save recording');
      }
      
      // Update UI
      this.updateUI();
      
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.recordingStatus.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private pauseRecording(): void {
    try {
      this.recordingService.pause();
      this.updateUI();
      this.recordingStatus.textContent = 'Recording paused...';
    } catch (error) {
      console.error('Failed to pause recording:', error);
      this.recordingStatus.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private resumeRecording(): void {
    try {
      this.recordingService.resume();
      this.updateUI();
      this.recordingStatus.textContent = 'Recording...';
    } catch (error) {
      console.error('Failed to resume recording:', error);
      this.recordingStatus.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private updateUI(): void {
    const status = this.recordingService.getStatus();
    
    this.recordBtn.textContent = status.isRecording ? 'Stop Recording' : 'Start Recording';
    this.recordBtn.classList.toggle('recording', status.isRecording);
    this.pauseBtn.disabled = !status.isRecording || status.isPaused;
    this.resumeBtn.disabled = !status.isRecording || !status.isPaused;
  }

  private startStatusUpdates(): void {
    this.statusUpdateInterval = window.setInterval(() => {
      const status = this.recordingService.getStatus();
      this.durationDisplay.textContent = this.formatDuration(status.duration);
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
