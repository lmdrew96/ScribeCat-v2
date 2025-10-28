/**
 * SimpleAudioManager
 * 
 * Simplified audio manager using the new SimpleAudioRecorder.
 * Much simpler than the previous version since SimpleAudioRecorder
 * handles both recording and analysis in one place.
 */

import { SimpleAudioRecorder, AudioDevice, RecordingConfig, RecordingResult } from '../main/services/audio/SimpleAudioRecorder.js';

export class SimpleAudioManager {
  private recorder: SimpleAudioRecorder;

  constructor() {
    this.recorder = new SimpleAudioRecorder();
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
    console.log('✅ SimpleAudioManager: Recording started');
  }

  /**
   * Stop recording and return audio data
   */
  async stopRecording(): Promise<RecordingResult> {
    const result = await this.recorder.stopRecording();
    console.log('✅ SimpleAudioManager: Recording stopped');
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
  getState(): 'inactive' | 'recording' | 'paused' {
    return this.recorder.getState();
  }

  /**
   * Get current audio level (0-1 range) for VU meter
   */
  getAudioLevel(): number {
    return this.recorder.getAudioLevel();
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.recorder.isCurrentlyRecording();
  }

  /**
   * Get audio stream for external use (e.g., Vosk transcription)
   */
  getAudioStream(): MediaStream | null {
    return this.recorder.getAudioStream();
  }

  /**
   * Set callback for raw audio data streaming (e.g., Whisper transcription)
   */
  onAudioData(callback: (data: Float32Array) => void): void {
    this.recorder.onAudioData(callback);
  }

  /**
   * Get the sample rate of the current recording
   */
  getSampleRate(): number {
    // SimpleAudioRecorder uses 48000 Hz by default
    return 48000;
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
  }
}
