/**
 * Whisper Transcription Service
 * 
 * Uses whisper.cpp to transcribe audio offline.
 * Processes audio in chunks and emits results via callback.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { TranscriptionResult, ITranscriptionService, TranscriptionConfig } from './ITranscriptionService.js';

/**
 * Whisper Transcription Service
 * 
 * Implements ITranscriptionService using whisper-node for offline transcription.
 * Unlike Vosk, Whisper processes larger audio chunks (5-10 seconds) for better accuracy.
 */
export class WhisperTranscriptionService implements ITranscriptionService {
  private modelPath: string = '';
  private sessionId: string | null = null;
  private isInitialized: boolean = false;
  private resultCallback: ((result: TranscriptionResult) => void) | null = null;
  private tempAudioPath: string | null = null;
  private audioChunks: Buffer[] = [];
  private whisperProcess: ChildProcess | null = null;
  private startTime: number = 0;

  /**
   * Initialize the Whisper service
   * @param config Configuration including model path
   */
  async initialize(config?: TranscriptionConfig): Promise<void> {
    if (this.isInitialized) {
      console.warn('WhisperTranscriptionService already initialized');
      return;
    }

    if (!config?.modelPath) {
      throw new Error('Model path is required for Whisper transcription');
    }

    this.modelPath = config.modelPath;

    // Verify model exists
    if (!fs.existsSync(this.modelPath)) {
      throw new Error(`Whisper model not found at: ${this.modelPath}`);
    }
    
    console.log('Whisper service initialized with model:', this.modelPath);
    this.isInitialized = true;
  }

  /**
   * Start a new transcription session
   * @returns Session ID
   */
  async start(): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    if (this.sessionId) {
      throw new Error('A transcription session is already active. Stop it before starting a new one.');
    }

    this.sessionId = `whisper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.audioChunks = [];
    this.startTime = Date.now();

    console.log('Whisper transcription session started:', this.sessionId);
    return this.sessionId;
  }

  /**
   * Stop an active transcription session
   * @param sessionId The session to stop
   */
  async stop(sessionId: string): Promise<void> {
    if (!this.sessionId) {
      console.warn('No active transcription session to stop');
      return;
    }

    if (this.sessionId !== sessionId) {
      throw new Error(`Session ID mismatch. Active: ${this.sessionId}, Requested: ${sessionId}`);
    }

    console.log(`Stopping Whisper transcription session: ${sessionId}`);

    // Process any remaining audio
    if (this.audioChunks.length > 0) {
      await this.processAudioChunks();
    }

    // Cleanup
    if (this.tempAudioPath && fs.existsSync(this.tempAudioPath)) {
      fs.unlinkSync(this.tempAudioPath);
      this.tempAudioPath = null;
    }

    this.audioChunks = [];
    this.sessionId = null;
  }

  /**
   * Register callback for transcription results
   * @param callback Function to call when results are available
   */
  onResult(callback: (result: TranscriptionResult) => void): void {
    this.resultCallback = callback;
  }

  /**
   * Check if service is currently active
   */
  isActive(): boolean {
    return this.sessionId !== null;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.sessionId) {
      this.stop(this.sessionId).catch(err => {
        console.error('Error stopping session during dispose:', err);
      });
    }

    if (this.tempAudioPath && fs.existsSync(this.tempAudioPath)) {
      fs.unlinkSync(this.tempAudioPath);
      this.tempAudioPath = null;
    }

    this.audioChunks = [];
    this.resultCallback = null;
    this.isInitialized = false;
    console.log('WhisperTranscriptionService disposed');
  }

  /**
   * Accept audio data chunk for transcription
   * Note: Whisper works better with larger chunks (5-10 seconds)
   * @param audioData PCM audio data buffer
   */
  async processAudioChunk(audioData: Buffer): Promise<void> {
    if (!this.isActive()) {
      return;
    }

    this.audioChunks.push(audioData);

    // Process every ~10 seconds of audio (adjust based on your needs)
    const totalSize = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const estimatedSeconds = totalSize / (16000 * 2); // 16kHz, 16-bit

    if (estimatedSeconds >= 10) {
      await this.processAudioChunks();
      this.audioChunks = []; // Clear processed chunks
    }
  }

  /**
   * Process accumulated audio chunks
   */
  private async processAudioChunks(): Promise<void> {
    if (this.audioChunks.length === 0) {
      return;
    }

    try {
      // Combine all chunks
      const combinedAudio = Buffer.concat(this.audioChunks);

      // Save to temp file (Whisper needs file input)
      this.tempAudioPath = path.join(os.tmpdir(), `whisper-${Date.now()}.wav`);
      
      // Write WAV file
      await this.writeWavFile(this.tempAudioPath, combinedAudio);

      // Transcribe using whisper-node
      const transcription = await this.transcribeFile(this.tempAudioPath);

      // Emit result
      if (transcription && this.resultCallback) {
        const elapsedSeconds = (Date.now() - this.startTime) / 1000;
        this.resultCallback({
          text: transcription,
          timestamp: elapsedSeconds,
          isFinal: true
        });
      }

      // Cleanup temp file
      if (fs.existsSync(this.tempAudioPath)) {
        fs.unlinkSync(this.tempAudioPath);
      }
    } catch (error) {
      console.error('Error processing audio chunks:', error);
    }
  }

  /**
   * Transcribe an audio file using whisper.cpp
   * @param audioPath Path to audio file
   * @returns Transcribed text
   */
  private async transcribeFile(audioPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // whisper-node uses whisper.cpp under the hood
      // We need to spawn the whisper executable directly
      
      // For now, use a simple Node.js approach with whisper-node package
      // This is a placeholder - we'll need to adapt based on whisper-node's actual API
      
      try {
        const { whisper } = require('whisper-node');
        
        whisper(audioPath, {
          modelPath: this.modelPath,
          language: 'en',
          outputFormat: 'txt'
        })
          .then((result: string) => {
            resolve(result.trim());
          })
          .catch((error: Error) => {
            reject(error);
          });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Write PCM audio data as WAV file
   * @param filePath Output file path
   * @param pcmData PCM audio data
   */
  private async writeWavFile(filePath: string, pcmData: Buffer): Promise<void> {
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;

    const dataSize = pcmData.length;
    const header = Buffer.alloc(44);

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);

    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Chunk size
    header.writeUInt16LE(1, 20); // Audio format (PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28); // Byte rate
    header.writeUInt16LE(numChannels * bitsPerSample / 8, 32); // Block align
    header.writeUInt16LE(bitsPerSample, 34);

    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    // Write file
    await fs.promises.writeFile(filePath, Buffer.concat([header, pcmData]));
  }
}
