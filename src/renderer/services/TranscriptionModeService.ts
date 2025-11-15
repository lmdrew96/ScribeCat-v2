/**
 * TranscriptionModeService
 *
 * Manages AssemblyAI transcription for recording sessions.
 */

import { AssemblyAITranscriptionService, TranscriptionSettings, TranscriptionError } from '../assemblyai-transcription-service.js';
import { AudioManager } from '../audio-manager.js';
import { TranscriptionManager } from '../managers/TranscriptionManager.js';

export type TranscriptionMode = 'assemblyai';

export interface TranscriptionModeConfig {
  mode: TranscriptionMode;
  apiKey?: string; // Required for AssemblyAI mode
  transcriptionSettings?: TranscriptionSettings; // Optional settings for AssemblyAI
}

/**
 * Service for managing transcription operations
 */
export class TranscriptionModeService {
  private currentMode: TranscriptionMode = 'assemblyai';
  private sessionId: string | null = null;
  private assemblyAIService: AssemblyAITranscriptionService | null = null;
  private assemblyAIStreamingInterval: ReturnType<typeof setInterval> | null = null;
  private audioLevelMonitorInterval: ReturnType<typeof setInterval> | null = null;

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

    if (!config.apiKey) {
      throw new Error('AssemblyAI API key not configured. Please add it in Settings.');
    }
    await this.startAssemblyAIMode(config.apiKey, config.transcriptionSettings);
  }

  /**
   * Stop transcription
   */
  async stop(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    await this.stopAssemblyAIAudioStreaming();
    this.sessionId = null;
  }

  /**
   * Pause transcription
   */
  pause(): void {
    // Stop audio streaming but keep WebSocket open
    if (this.assemblyAIStreamingInterval !== null) {
      clearInterval(this.assemblyAIStreamingInterval);
      this.assemblyAIStreamingInterval = null;
    }
    // ROOT CAUSE FIX: Stop audio level monitoring when paused
    this.stopAudioLevelMonitoring();
    this.audioManager.removeAudioDataCallback();
  }

  /**
   * Resume transcription
   */
  resume(): void {
    // Restart audio streaming
    this.startAssemblyAIAudioStreaming();
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

    // Set up error callback to display user-friendly messages
    this.assemblyAIService.onError((error: TranscriptionError) => {
      this.handleTranscriptionError(error);
    });

    // Start session
    this.sessionId = await this.assemblyAIService.start();

    // Start audio streaming
    this.startAssemblyAIAudioStreaming();

    console.log('AssemblyAI transcription started');
  }

  /**
   * Start streaming audio to AssemblyAI
   *
   * ROOT CAUSE FIX: Now also monitors audio levels and passes them to the transcription service
   * for intelligent stalled detection (silence vs actual stall).
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

    // ROOT CAUSE FIX: Start monitoring audio levels for intelligent stalled detection
    this.startAudioLevelMonitoring();

    console.log('AssemblyAI audio streaming enabled with level monitoring');
  }

  /**
   * Start monitoring audio levels and pass them to transcription service
   *
   * ROOT CAUSE FIX: This enables the transcription service to distinguish
   * between silence (normal, no transcription expected) and actual stalled transcription.
   */
  private startAudioLevelMonitoring(): void {
    // Update audio level every 500ms
    this.audioLevelMonitorInterval = setInterval(() => {
      if (this.assemblyAIService) {
        const level = this.audioManager.getAudioLevel();
        this.assemblyAIService.setAudioLevel(level);
      }
    }, 500);
  }

  /**
   * Stop audio level monitoring
   */
  private stopAudioLevelMonitoring(): void {
    if (this.audioLevelMonitorInterval !== null) {
      clearInterval(this.audioLevelMonitorInterval);
      this.audioLevelMonitorInterval = null;
    }
  }

  /**
   * Stop AssemblyAI audio streaming
   */
  private async stopAssemblyAIAudioStreaming(): Promise<void> {
    if (this.assemblyAIStreamingInterval !== null) {
      clearInterval(this.assemblyAIStreamingInterval);
      this.assemblyAIStreamingInterval = null;
    }

    // ROOT CAUSE FIX: Stop audio level monitoring
    this.stopAudioLevelMonitoring();

    if (this.assemblyAIService) {
      await this.assemblyAIService.stop();
      this.assemblyAIService = null;
    }

    this.audioManager.removeAudioDataCallback();
    console.log('AssemblyAI audio streaming stopped');
  }

  /**
   * Handle transcription errors and display user-friendly messages
   */
  private handleTranscriptionError(error: TranscriptionError): void {
    console.error('Transcription error:', error);

    // Display user-friendly error message based on error type
    let userMessage = '';
    let notificationType: 'error' | 'warning' = 'error';

    switch (error.type) {
      case 'AUTH_ERROR':
        userMessage = 'Authentication Error: ' + error.message;
        break;
      case 'MAX_CONCURRENT_SESSIONS':
        userMessage = error.message;
        notificationType = 'warning';
        break;
      case 'SESSION_EXPIRED':
        userMessage = error.message;
        notificationType = 'warning';
        break;
      case 'TRANSMISSION_RATE':
        userMessage = 'Audio Transmission Error: ' + error.message;
        break;
      case 'UNKNOWN_ERROR':
      default:
        userMessage = error.message;
        notificationType = 'warning';
        break;
    }

    // Display notification to user
    const notificationTicker = (window as any).notificationTicker;
    if (notificationTicker) {
      if (notificationType === 'error') {
        notificationTicker.error(userMessage, 10000); // 10 second duration for errors
      } else {
        notificationTicker.warning(userMessage, 8000); // 8 second duration for warnings
      }
    }
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
