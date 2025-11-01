/**
 * TranscriptionModeService
 *
 * Manages transcription mode switching between 'simulation' and 'assemblyai'.
 * Eliminates duplicate mode-switching logic from RecordingManager.
 */

import { AssemblyAITranscriptionService } from '../assemblyai-transcription-service.js';
import { AudioManager } from '../audio-manager.js';
import { TranscriptionManager } from '../managers/TranscriptionManager.js';

export type TranscriptionMode = 'simulation' | 'assemblyai';

export interface TranscriptionModeConfig {
  mode: TranscriptionMode;
  apiKey?: string; // Required for AssemblyAI mode
}

/**
 * Service for managing transcription mode operations
 */
export class TranscriptionModeService {
  private currentMode: TranscriptionMode = 'simulation';
  private sessionId: string | null = null;
  private assemblyAIService: AssemblyAITranscriptionService | null = null;
  private assemblyAIStreamingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private audioManager: AudioManager,
    private transcriptionManager: TranscriptionManager
  ) {}

  /**
   * Get the current transcription mode
   */
  getCurrentMode(): TranscriptionMode {
    return this.currentMode;
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Start transcription with the specified mode
   */
  async start(config: TranscriptionModeConfig): Promise<void> {
    this.currentMode = config.mode;

    if (this.currentMode === 'simulation') {
      await this.startSimulationMode();
    } else if (this.currentMode === 'assemblyai') {
      if (!config.apiKey) {
        throw new Error('AssemblyAI API key not configured. Please add it in Settings.');
      }
      await this.startAssemblyAIMode(config.apiKey);
    }
  }

  /**
   * Stop transcription
   */
  async stop(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    if (this.currentMode === 'simulation') {
      await window.scribeCat.transcription.simulation.stop(this.sessionId);
    } else if (this.currentMode === 'assemblyai') {
      this.stopAssemblyAIAudioStreaming();
    }

    this.sessionId = null;
  }

  /**
   * Pause transcription (mode-specific behavior)
   */
  pause(): void {
    if (this.currentMode === 'simulation') {
      // Pause the simulation service to stop emitting phrases
      window.scribeCat.transcription.simulation.pause();
    } else if (this.currentMode === 'assemblyai') {
      // For AssemblyAI, stop audio streaming but keep WebSocket open
      if (this.assemblyAIStreamingInterval !== null) {
        clearInterval(this.assemblyAIStreamingInterval);
        this.assemblyAIStreamingInterval = null;
      }
      this.audioManager.removeAudioDataCallback();
    }
  }

  /**
   * Resume transcription (mode-specific behavior)
   */
  resume(): void {
    if (this.currentMode === 'simulation') {
      // Resume the simulation service to continue emitting phrases
      window.scribeCat.transcription.simulation.resume();
    } else if (this.currentMode === 'assemblyai') {
      // For AssemblyAI, restart audio streaming
      this.startAssemblyAIAudioStreaming();
    }
  }

  /**
   * Clean up transcription resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.stop();
    } catch (error) {
      console.error('Error during transcription cleanup:', error);
    }
  }

  // ===== Private Methods =====

  /**
   * Start simulation transcription mode
   */
  private async startSimulationMode(): Promise<void> {
    const result = await window.scribeCat.transcription.simulation.start();

    if (!result.success) {
      throw new Error(result.error || 'Failed to start simulation transcription');
    }

    this.sessionId = result.sessionId!;
  }

  /**
   * Start AssemblyAI transcription mode
   */
  private async startAssemblyAIMode(apiKey: string): Promise<void> {
    console.log('Starting AssemblyAI transcription...');

    // Create and initialize service
    this.assemblyAIService = new AssemblyAITranscriptionService();
    await this.assemblyAIService.initialize(apiKey);

    // Set up result callback
    this.assemblyAIService.onResult((text: string, isFinal: boolean, timestamp?: number) => {
      console.log('🎤 AssemblyAI:', isFinal ? 'Final' : 'Partial', text, timestamp !== undefined ? `@ ${timestamp.toFixed(1)}s` : '');
      this.transcriptionManager.updateFlowing(text, isFinal, timestamp);
    });

    // Start session
    this.sessionId = await this.assemblyAIService.start();

    // Start audio streaming
    this.startAssemblyAIAudioStreaming();

    console.log('AssemblyAI transcription started');
  }

  /**
   * Start streaming audio to AssemblyAI
   */
  private startAssemblyAIAudioStreaming(): void {
    const CHUNK_INTERVAL = 100;
    let audioBuffer: Float32Array[] = [];

    this.audioManager.onAudioData((audioData: Float32Array) => {
      if (this.currentMode !== 'assemblyai') return;
      audioBuffer.push(new Float32Array(audioData));
    });

    const intervalId = setInterval(() => {
      if (audioBuffer.length === 0 || this.currentMode !== 'assemblyai') return;

      // Combine buffered audio
      const totalLength = audioBuffer.reduce((sum, arr) => sum + arr.length, 0);
      const combined = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of audioBuffer) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      audioBuffer = [];

      // Resample to 16kHz
      const sourceSampleRate = this.audioManager.getSampleRate();
      const resampled = this.resampleAudio(combined, sourceSampleRate, 16000);

      // Convert to Int16 PCM
      const int16Data = new Int16Array(resampled.length);
      for (let i = 0; i < resampled.length; i++) {
        const s = Math.max(-1, Math.min(1, resampled[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Send to service
      if (this.assemblyAIService) {
        this.assemblyAIService.sendAudio(int16Data.buffer);
      }
    }, CHUNK_INTERVAL);

    this.assemblyAIStreamingInterval = intervalId;
    console.log('AssemblyAI audio streaming enabled');
  }

  /**
   * Stop AssemblyAI audio streaming
   */
  private stopAssemblyAIAudioStreaming(): void {
    if (this.assemblyAIStreamingInterval !== null) {
      clearInterval(this.assemblyAIStreamingInterval);
      this.assemblyAIStreamingInterval = null;
    }

    if (this.assemblyAIService) {
      this.assemblyAIService.stop();
      this.assemblyAIService = null;
    }

    this.audioManager.removeAudioDataCallback();
    console.log('AssemblyAI audio streaming stopped');
  }

  /**
   * Resample audio to target sample rate
   */
  private resampleAudio(
    audioData: Float32Array,
    sourceSampleRate: number,
    targetSampleRate: number
  ): Float32Array {
    if (sourceSampleRate === targetSampleRate) {
      return audioData;
    }

    const sampleRateRatio = sourceSampleRate / targetSampleRate;
    const newLength = Math.round(audioData.length / sampleRateRatio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * sampleRateRatio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
      const t = srcIndex - srcIndexFloor;
      result[i] = audioData[srcIndexFloor] * (1 - t) + audioData[srcIndexCeil] * t;
    }

    return result;
  }
}
