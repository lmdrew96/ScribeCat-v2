import { SessionData, RecordingState } from '../shared/types';

class ScribeCatApp {
  private recordBtn!: HTMLButtonElement;
  private notesEditor!: HTMLElement;
  private recordingStatus!: HTMLElement;
  private vuMeter!: HTMLElement;
  private sessionList!: HTMLElement;
  private sessionInfo!: HTMLElement;
  private currentSession: SessionData | null = null;
  private isRecording: boolean = false;
  private recordingState: RecordingState = {
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0
  };
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private currentSessionId: string | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationId: number | null = null;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.loadSessions();
    this.startStatusUpdates();
  }

  private initializeElements(): void {
    this.recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
    this.notesEditor = document.getElementById('notes-editor') as HTMLElement;
    this.recordingStatus = document.getElementById('recording-status') as HTMLElement;
    this.vuMeter = document.getElementById('vu-meter') as HTMLElement;
    this.sessionList = document.getElementById('session-list') as HTMLElement;
    this.sessionInfo = document.getElementById('session-info') as HTMLElement;
  }

  private setupEventListeners(): void {
    this.recordBtn.addEventListener('click', () => this.toggleRecording());
    
    // Listen for menu actions
    window.electronAPI.on('menu:new-session', () => this.newSession());
    window.electronAPI.on('menu:save-session', () => this.saveCurrentSession());
    window.electronAPI.on('menu:start-recording', () => this.startRecording());
    window.electronAPI.on('menu:stop-recording', () => this.stopRecording());
    window.electronAPI.on('menu:export-txt', () => this.exportSession('txt'));
    window.electronAPI.on('menu:export-pdf', () => this.exportSession('pdf'));

    // Auto-save notes every 30 seconds
    setInterval(() => {
      if (this.currentSession) {
        this.saveCurrentSession();
      }
    }, 30000);
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
      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Notify main process
      const result = await window.electronAPI.recording.start();
      this.currentSessionId = result.sessionId;

      // Set up MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      // Set up audio analysis
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      this.startVUMeter();

      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        await this.saveRecordingData();
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start(1000);
      this.isRecording = true;
      this.updateRecordingUI();
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.showError('Failed to start recording. Please check your microphone permissions.');
    }
  }

  private async stopRecording(): Promise<void> {
    try {
      if (this.mediaRecorder && this.isRecording) {
        this.mediaRecorder.stop();
        await window.electronAPI.recording.stop();
        this.isRecording = false;
        this.stopVUMeter();
        this.updateRecordingUI();
        await this.loadSessions();
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.showError('Failed to stop recording.');
    }
  }

  private async saveRecordingData(): Promise<void> {
    if (this.audioChunks.length > 0 && this.currentSessionId) {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      try {
        await window.electronAPI.recording.saveAudio(arrayBuffer, this.currentSessionId);
        this.audioChunks = [];
        this.currentSessionId = null;
      } catch (error) {
        console.error('Failed to save recording:', error);
      }
    }
  }

  private startVUMeter(): void {
    const updateVU = () => {
      if (this.analyser) {
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        this.updateVUMeter(average);
      }
      this.animationId = requestAnimationFrame(updateVU);
    };
    updateVU();
  }

  private stopVUMeter(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.updateVUMeter(0);
  }

  private updateRecordingUI(): void {
    if (this.isRecording) {
      this.recordBtn.textContent = 'Stop Recording';
      this.recordBtn.classList.add('recording');
      this.recordingStatus.textContent = 'Recording...';
    } else {
      this.recordBtn.textContent = 'Start Recording';
      this.recordBtn.classList.remove('recording');
      this.recordingStatus.textContent = 'Ready to record';
    }
  }

  private updateVUMeter(level: number): void {
    const percentage = Math.min(100, (level / 255) * 100);
    this.vuMeter.style.width = `${percentage}%`;
  }

  private async loadSessions(): Promise<void> {
    try {
      const sessions = await window.electronAPI.files.list();
      this.renderSessionList(sessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }

  private renderSessionList(sessions: SessionData[]): void {
    if (!this.sessionList) return;
    
    this.sessionList.innerHTML = sessions.map(session => `
      <div class="session-item" data-session-id="${session.id}">
        <div class="session-item-content">
          <h3>${session.title}</h3>
          <p>${new Date(session.createdAt).toLocaleString()}</p>
          <p>Duration: ${Math.round((session.duration || 0) / 1000)}s</p>
        </div>
        <div class="session-item-actions">
          <button class="session-btn" onclick="window.app.loadSession('${session.id}')">Load</button>
          <button class="session-btn delete-btn" onclick="window.app.deleteSession('${session.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  async loadSession(sessionId: string): Promise<void> {
    try {
      const session = await window.electronAPI.files.load(sessionId);
      if (session) {
        this.currentSession = session;
        this.notesEditor.innerHTML = session.notes || '';
        this.updateSessionInfo(session);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  }

  private async saveCurrentSession(): Promise<void> {
    if (this.currentSession) {
      this.currentSession.notes = this.notesEditor.innerHTML;
      this.currentSession.updatedAt = new Date();
      try {
        await window.electronAPI.files.save(this.currentSession);
      } catch (error) {
        console.error('Failed to save session:', error);
      }
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (confirm('Are you sure you want to delete this session?')) {
      try {
        await window.electronAPI.files.delete(sessionId);
        if (this.currentSession?.id === sessionId) {
          this.currentSession = null;
          this.notesEditor.innerHTML = 'Start taking notes...';
          this.updateSessionInfo(null);
        }
        await this.loadSessions();
      } catch (error) {
        console.error('Failed to delete session:', error);
      }
    }
  }

  private newSession(): void {
    this.currentSession = {
      id: `session_${Date.now()}`,
      title: `New Session ${new Date().toLocaleString()}`,
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.notesEditor.innerHTML = '';
    this.updateSessionInfo(this.currentSession);
  }

  private updateSessionInfo(session: SessionData | null): void {
    if (!this.sessionInfo) return;
    
    if (session) {
      this.sessionInfo.innerHTML = `
        <h2>${session.title}</h2>
        <p>Created: ${new Date(session.createdAt).toLocaleString()}</p>
        ${session.duration ? `<p>Duration: ${Math.round(session.duration / 1000)}s</p>` : ''}
      `;
    } else {
      this.sessionInfo.innerHTML = '<h2>No session loaded</h2>';
    }
  }

  private async exportSession(format: string): Promise<void> {
    if (!this.currentSession) {
      this.showError('No session to export');
      return;
    }

    try {
      const filePath = await window.electronAPI.files.export(this.currentSession.id, format);
      this.showSuccess(`Session exported to ${filePath}`);
    } catch (error) {
      console.error('Failed to export session:', error);
      this.showError('Failed to export session');
    }
  }

  private startStatusUpdates(): void {
    setInterval(async () => {
      try {
        const status = await window.electronAPI.recording.getStatus();
        this.recordingState = status;
        this.updateRecordingStatus();
      } catch (error) {
        // Ignore errors for status updates
      }
    }, 1000);
  }

  private updateRecordingStatus(): void {
    if (this.recordingState.isRecording && this.recordingStatus) {
      const minutes = Math.floor(this.recordingState.duration / 60000);
      const seconds = Math.floor((this.recordingState.duration % 60000) / 1000);
      this.recordingStatus.textContent = `Recording... ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  private showError(message: string): void {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  private showSuccess(message: string): void {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.remove();
    }, 5000);
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  (window as any).app = new ScribeCatApp();
});
