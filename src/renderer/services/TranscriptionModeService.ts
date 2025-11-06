/**
 * TranscriptionModeService
 *
 * Manages transcription mode switching between 'simulation' and 'assemblyai'.
 * Eliminates duplicate mode-switching logic from RecordingManager.
 */

import { AssemblyAITranscriptionService, TranscriptionSettings } from '../assemblyai-transcription-service.js';
import { AudioManager } from '../audio-manager.js';
import { TranscriptionManager } from '../managers/TranscriptionManager.js';

export type TranscriptionMode = 'simulation' | 'assemblyai';

export interface TranscriptionModeConfig {
  mode: TranscriptionMode;
  apiKey?: string; // Required for AssemblyAI mode
  transcriptionSettings?: TranscriptionSettings; // Optional settings for AssemblyAI
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
      await this.startAssemblyAIMode(config.apiKey, config.transcriptionSettings);
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
      await this.stopAssemblyAIAudioStreaming();
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
  private async startAssemblyAIMode(apiKey: string, settings?: TranscriptionSettings): Promise<void> {
    console.log('Starting AssemblyAI transcription with settings:', settings);

    // Create and initialize service
    this.assemblyAIService = new AssemblyAITranscriptionService();
    await this.assemblyAIService.initialize(apiKey, settings);

    // Set up result callback
    this.assemblyAIService.onResult((text: string, isFinal: boolean, startTime?: number, endTime?: number) => {
      const timeInfo = startTime !== undefined
        ? `@ ${startTime.toFixed(1)}s${endTime !== undefined ? `-${endTime.toFixed(1)}s` : ''}`
        : '';
      console.log('🎤 AssemblyAI:', isFinal ? 'Final' : 'Partial', text, timeInfo);
      this.transcriptionManager.updateFlowing(text, isFinal, startTime, endTime);
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
  private async stopAssemblyAIAudioStreaming(): Promise<void> {
    if (this.assemblyAIStreamingInterval !== null) {
      clearInterval(this.assemblyAIStreamingInterval);
      this.assemblyAIStreamingInterval = null;
    }

    if (this.assemblyAIService) {
      await this.assemblyAIService.stop();
      this.assemblyAIService = null;
    }

    this.audioManager.removeAudioDataCallback();
    console.log('AssemblyAI audio streaming stopped');
  }

  /**
   * Resample audio to target sample rate using cubic interpolation
   * Provides better quality than linear interpolation while remaining efficient
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

    // Use cubic interpolation for better quality
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * sampleRateRatio;
      const srcIndexFloor = Math.floor(srcIndex);
      const t = srcIndex - srcIndexFloor;

      // Get 4 surrounding samples for cubic interpolation
      const y0 = audioData[Math.max(0, srcIndexFloor - 1)];
      const y1 = audioData[Math.min(srcIndexFloor, audioData.length - 1)];
      const y2 = audioData[Math.min(srcIndexFloor + 1, audioData.length - 1)];
      const y3 = audioData[Math.min(srcIndexFloor + 2, audioData.length - 1)];

      // Catmull-Rom cubic interpolation
      const t2 = t * t;
      const t3 = t2 * t;

      result[i] = 0.5 * (
        (2 * y1) +
        (-y0 + y2) * t +
        (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 +
        (-y0 + 3 * y1 - 3 * y2 + y3) * t3
      );
    }

    return result;
  }
}
