/**
 * AudioManager
 * 
 * Manages audio recording and analysis in the renderer process.
 * Coordinates between AudioRecorderService and AudioAnalyzerService.
 * Communicates with main process via IPC for persistence.
 */

import { AudioRecorderService, AudioDevice, RecordingConfig, RecordingResult } from '../main/services/audio/AudioRecorderService.js';
import { AudioAnalyzerService, AudioLevelData, AnalyzerConfig } from '../main/services/audio/AudioAnalyzerService.js';

export class AudioManager {
  private recorder: AudioRecorderService;
  private analyzer: AudioAnalyzerService;
  private isInitialized: boolean = false;

  constructor() {
    this.recorder = new AudioRecorderService();
    this.analyzer = new AudioAnalyzerService();
  }

  /**
   * Get available audio input devices
   */
  async getDevices(): Promise<AudioDevice[]> {
    return await this.recorder.getAudioDevices();
  }

  /**
   * Start recording with optional configuration
   */
  async startRecording(config: RecordingConfig = {}): Promise<void> {
    await this.recorder.startRecording(config);
    
    // Initialize analyzer with the audio stream
    const stream = this.recorder.getAudioStream();
    if (stream) {
      await this.analyzer.initialize(stream);
      this.isInitialized = true;
    }
  }

  /**
   * Stop recording and return audio data
   */
  async stopRecording(): Promise<RecordingResult> {
    const result = await this.recorder.stopRecording();
    
    // Clean up analyzer
    this.analyzer.cleanup();
    this.isInitialized = false;
    
    return result;
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    this.recorder.pauseRecording();
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    this.recorder.resumeRecording();
  }

  /**
   * Get current recording state
   */
  getState(): string {
    return this.recorder.getState();
  }

  /**
   * Get current audio level (0-1 range)
   */
  getAudioLevel(): number {
    if (!this.isInitialized) {
      return 0;
    }
    return this.analyzer.getLevel();
  }

  /**
   * Get audio level data with timestamp
   */
  getAudioLevelData(): AudioLevelData {
    if (!this.isInitialized) {
      return { level: 0, timestamp: Date.now() };
    }
    return this.analyzer.getLevelData();
  }

  /**
   * Start continuous audio level monitoring
   */
  startLevelMonitoring(callback: (data: AudioLevelData) => void, interval: number = 100): void {
    if (!this.isInitialized) {
      throw new Error('Recording not started. Call startRecording() first.');
    }
    this.analyzer.startMonitoring(callback, interval);
  }

  /**
   * Stop audio level monitoring
   */
  stopLevelMonitoring(): void {
    this.analyzer.stopMonitoring();
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.recorder.isCurrentlyRecording();
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    if (this.recorder.isCurrentlyRecording()) {
      this.recorder.stopRecording().catch(err => {
        console.error('Error stopping recording during cleanup:', err);
      });
    }
    this.analyzer.cleanup();
    this.isInitialized = false;
  }
}
