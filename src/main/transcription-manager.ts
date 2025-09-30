import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export class TranscriptionManager {
  private voskModelPath: string | null = null;
  private isVoskAvailable: boolean = false;

  constructor() {
    this.initializeVosk();
    this.setupIPC();
  }

  private async initializeVosk(): Promise<void> {
    try {
      // Check if Vosk model is available
      const modelPath = path.join(process.cwd(), 'models', 'vosk-model-en-us-0.22');
      if (fs.existsSync(modelPath)) {
        this.voskModelPath = modelPath;
        this.isVoskAvailable = true;
      }
    } catch (error) {
      console.error('Failed to initialize Vosk:', error);
    }
  }

  private setupIPC(): void {
    ipcMain.handle('transcription:transcribe', async (event, audioPath: string) => {
      return this.transcribeAudio(audioPath);
    });

    ipcMain.handle('transcription:enhance', async (event, text: string) => {
      return this.enhanceTranscription(text);
    });

    ipcMain.handle('transcription:getStatus', async () => {
      return {
        isVoskAvailable: this.isVoskAvailable,
        modelPath: this.voskModelPath
      };
    });
  }

  private async transcribeAudio(audioPath: string): Promise<string> {
    try {
      if (this.isVoskAvailable && this.voskModelPath) {
        return await this.transcribeWithVosk(audioPath);
      } else {
        // Fallback to Whisper API or other service
        return await this.transcribeWithWhisper(audioPath);
      }
    } catch (error) {
      console.error('Transcription failed:', error);
      throw error;
    }
  }

  private async transcribeWithVosk(audioPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const voskPath = path.join(process.cwd(), 'node_modules', 'vosk', 'bin', 'vosk-transcriber');
      const args = [audioPath, this.voskModelPath!];
      
      const childProcess = spawn(voskPath, args);
      let output = '';
      let error = '';

      childProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      childProcess.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Vosk transcription failed: ${error}`));
        }
      });
    });
  }

  private async transcribeWithWhisper(audioPath: string): Promise<string> {
    // This would integrate with Whisper API
    // For now, return a placeholder
    return "Transcription not available - Whisper integration pending";
  }

  private async enhanceTranscription(text: string): Promise<string> {
    // Basic text enhancement
    let enhanced = text
      .replace(/\s+/g, ' ') // Remove extra whitespace
      .replace(/([.!?])\s*([a-z])/g, '$1 $2') // Fix spacing after punctuation
      .replace(/\b(i|i'm|i'll|i've|i'd)\b/g, (match) => match.toUpperCase()) // Capitalize I
      .replace(/(^|\. )([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase()); // Capitalize sentences

    return enhanced;
  }
}
