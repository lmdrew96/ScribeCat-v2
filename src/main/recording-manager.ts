import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { SessionData } from '../shared/types';

export class RecordingManager {
  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private recordingStartTime: Date | null = null;
  private currentSessionId: string | null = null;
  private mainWindow: BrowserWindow | null;

  constructor(mainWindow: BrowserWindow | null) {
    this.mainWindow = mainWindow;
    this.setupIPC();
  }

  private setupIPC(): void {
    ipcMain.handle('recording:start', async () => {
      return this.startRecording();
    });

    ipcMain.handle('recording:stop', async () => {
      return this.stopRecording();
    });

    ipcMain.handle('recording:pause', async () => {
      return this.pauseRecording();
    });

    ipcMain.handle('recording:resume', async () => {
      return this.resumeRecording();
    });

    ipcMain.handle('recording:getStatus', async () => {
      return this.getRecordingStatus();
    });

    ipcMain.handle('recording:saveAudio', async (event, audioData: ArrayBuffer, sessionId: string) => {
      return this.saveRecording(audioData, sessionId);
    });
  }

  private async startRecording(): Promise<{ success: boolean; sessionId: string }> {
    try {
      this.isRecording = true;
      this.isPaused = false;
      this.recordingStartTime = new Date();
      this.currentSessionId = `session_${Date.now()}`;

      return { success: true, sessionId: this.currentSessionId };
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  private async stopRecording(): Promise<void> {
    if (this.isRecording) {
      this.isRecording = false;
      this.isPaused = false;
    }
  }

  private async pauseRecording(): Promise<void> {
    if (this.isRecording && !this.isPaused) {
      this.isPaused = true;
    }
  }

  private async resumeRecording(): Promise<void> {
    if (this.isRecording && this.isPaused) {
      this.isPaused = false;
    }
  }

  private getRecordingStatus(): any {
    return {
      isRecording: this.isRecording,
      isPaused: this.isPaused,
      duration: this.recordingStartTime ? Date.now() - this.recordingStartTime.getTime() : 0,
      sessionId: this.currentSessionId
    };
  }

  private async saveRecording(audioData: ArrayBuffer, sessionId: string): Promise<string> {
    try {
      const buffer = Buffer.from(audioData);
      const filename = `recording_${Date.now()}.webm`;
      const recordingsDir = path.join(process.cwd(), 'recordings');
      
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }

      const filePath = path.join(recordingsDir, filename);
      fs.writeFileSync(filePath, buffer);

      // Create session data
      const sessionData: SessionData = {
        id: sessionId,
        title: `Recording ${new Date().toLocaleString()}`,
        recordingPath: filePath,
        notes: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        duration: this.recordingStartTime ? Date.now() - this.recordingStartTime.getTime() : 0
      };

      // Save session metadata
      const sessionsDir = path.join(process.cwd(), 'sessions');
      if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
      }
      
      const sessionPath = path.join(sessionsDir, `${sessionData.id}.json`);
      fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));

      this.recordingStartTime = null;
      this.currentSessionId = null;

      return filePath;
    } catch (error) {
      console.error('Failed to save recording:', error);
      throw error;
    }
  }
}
