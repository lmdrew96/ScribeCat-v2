/**
 * AssemblyAI Real-Time Transcription Service
 * 
 * Provides word-by-word streaming transcription using AssemblyAI's WebSocket API
 */

import { TranscriptionResult, ITranscriptionService, TranscriptionConfig } from './ITranscriptionService.js';
import WebSocket from 'ws';

interface AssemblyAIConfig extends TranscriptionConfig {
  apiKey: string;
  sampleRate?: number;
}

export class AssemblyAITranscriptionService implements ITranscriptionService {
  private apiKey: string = '';
  private sessionId: string | null = null;
  private ws: WebSocket | null = null;
  private resultCallback: ((result: TranscriptionResult) => void) | null = null;
  private startTime: number = 0;
  private isConnected: boolean = false;

  async initialize(config?: AssemblyAIConfig): Promise<void> {
    if (!config?.apiKey) {
      throw new Error('AssemblyAI API key is required');
    }
    
    this.apiKey = config.apiKey;
    console.log('AssemblyAI service initialized');
  }

  async start(): Promise<string> {
    if (this.sessionId) {
      throw new Error('A transcription session is already active');
    }

    this.sessionId = `assemblyai-${Date.now()}`;
    this.startTime = Date.now();

    // Connect to AssemblyAI real-time API
    await this.connectWebSocket();

    console.log('AssemblyAI transcription session started:', this.sessionId);
    return this.sessionId;
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000`;
      
      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': this.apiKey
        }
      });

      this.ws.on('open', () => {
        console.log('AssemblyAI WebSocket connected');
        this.isConnected = true;
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (error: Error) => {
        console.error('AssemblyAI WebSocket error:', error);
        this.isConnected = false;
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('AssemblyAI WebSocket closed');
        this.isConnected = false;
      });
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      if (message.message_type === 'SessionBegins') {
        console.log('AssemblyAI session began');
        return;
      }

      if (message.message_type === 'PartialTranscript' || message.message_type === 'FinalTranscript') {
        const text = message.text;
        const isFinal = message.message_type === 'FinalTranscript';
        
        if (text && text.trim().length > 0 && this.resultCallback) {
          const elapsedSeconds = (Date.now() - this.startTime) / 1000;
          
          this.resultCallback({
            text: text,
            timestamp: elapsedSeconds,
            isFinal: isFinal
          });
        }
      }
    } catch (error) {
      console.error('Error parsing AssemblyAI message:', error);
    }
  }

  async processAudioChunk(audioData: Buffer): Promise<void> {
    if (!this.isConnected || !this.ws) {
      console.warn('WebSocket not connected, skipping audio chunk');
      return;
    }

    try {
      // AssemblyAI expects base64-encoded audio
      const base64Audio = audioData.toString('base64');
      
      this.ws.send(JSON.stringify({
        audio_data: base64Audio
      }));
    } catch (error) {
      console.error('Error sending audio to AssemblyAI:', error);
    }
  }

  async stop(sessionId: string): Promise<void> {
    if (this.sessionId !== sessionId) {
      throw new Error(`Session ID mismatch. Active: ${this.sessionId}, Requested: ${sessionId}`);
    }

    if (this.ws) {
      this.ws.send(JSON.stringify({ terminate_session: true }));
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.sessionId = null;
    console.log('AssemblyAI transcription session stopped');
  }

  onResult(callback: (result: TranscriptionResult) => void): void {
    this.resultCallback = callback;
  }

  isActive(): boolean {
    return this.sessionId !== null;
  }

  dispose(): void {
    if (this.sessionId) {
      this.stop(this.sessionId).catch(err => {
        console.error('Error stopping session during dispose:', err);
      });
    }
    this.resultCallback = null;
    console.log('AssemblyAI service disposed');
  }
}
