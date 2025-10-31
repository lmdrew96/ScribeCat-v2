/**
 * RecordingManager
 * Coordinates recording, transcription, and audio streaming
 */

import { AudioManager } from '../audio-manager.js';
import { AssemblyAITranscriptionService } from '../assemblyai-transcription-service.js';
import { TranscriptionManager } from './TranscriptionManager.js';
import { ViewManager } from './ViewManager.js';
import { TiptapEditorManager } from './TiptapEditorManager.js';

export class RecordingManager {
  private audioManager: AudioManager;
  private transcriptionManager: TranscriptionManager;
  private viewManager: ViewManager;
  private editorManager: TiptapEditorManager;
  private aiManager: any; // AIManager type
  private courseManager: any; // CourseManager type
  
  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private transcriptionSessionId: string | null = null;
  private currentTranscriptionMode: 'simulation' | 'assemblyai' = 'simulation';
  private assemblyAIService: AssemblyAITranscriptionService | null = null;
  private startTime: number = 0;
  private pauseStartTime: number = 0;
  private totalPausedTime: number = 0;
  private elapsedTimer: number | null = null;
  private vuMeterInterval: number | null = null;

  constructor(
    audioManager: AudioManager,
    transcriptionManager: TranscriptionManager,
    viewManager: ViewManager,
    editorManager: TiptapEditorManager,
    aiManager: any,
    courseManager: any
  ) {
    this.audioManager = audioManager;
    this.transcriptionManager = transcriptionManager;
    this.viewManager = viewManager;
    this.editorManager = editorManager;
    this.aiManager = aiManager;
    this.courseManager = courseManager;
  }

  /**
   * Initialize recording manager
   */
  initialize(): void {
    // Set up transcription listeners
    window.scribeCat.transcription.simulation.onResult((result) => {
      if (this.currentTranscriptionMode === 'simulation') {
        this.transcriptionManager.addEntry(result.timestamp, result.text);
      }
    });
  }

  /**
   * Start recording and transcription
   */
  async start(deviceId: string): Promise<void> {
    if (!deviceId) {
      throw new Error('Please select a microphone device');
    }

    // Get transcription mode from settings
    const mode = await window.scribeCat.store.get('transcription-mode') as string || 'simulation';
    this.currentTranscriptionMode = mode as 'simulation' | 'assemblyai';

    console.log(`Starting recording with ${this.currentTranscriptionMode} mode...`);

    // Start audio recording
    await this.audioManager.startRecording({
      deviceId: deviceId,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false
    });

    // Start transcription service
    if (this.currentTranscriptionMode === 'simulation') {
      await this.startSimulationTranscription();
    } else if (this.currentTranscriptionMode === 'assemblyai') {
      await this.startAssemblyAITranscription();
    }

    // Update state
    this.isRecording = true;
    this.startTime = Date.now();

    // Update UI
    this.viewManager.updateRecordingState(true, this.currentTranscriptionMode);
    this.transcriptionManager.clear();
    this.startElapsedTimer();
    this.startVUMeterUpdates();

    console.log('Recording started successfully');
  }

  /**
   * Stop recording and save
   */
  async stop(): Promise<void> {
    console.log('Stopping recording...');

    // Stop transcription first
    if (this.transcriptionSessionId) {
      if (this.currentTranscriptionMode === 'simulation') {
        await window.scribeCat.transcription.simulation.stop(this.transcriptionSessionId);
      } else if (this.currentTranscriptionMode === 'assemblyai') {
        this.stopAssemblyAIAudioStreaming();
      }
      this.transcriptionSessionId = null;
    }

    // Stop audio recording
    const result = await this.audioManager.stopRecording();
    const durationSeconds = result.duration / 1000;
    console.log('Recording stopped. Duration:', durationSeconds, 'seconds');

    // Get selected course data
    const selectedCourse = this.courseManager?.getSelectedCourse();
    const courseData = selectedCourse ? {
      courseId: selectedCourse.id,
      courseTitle: selectedCourse.title || selectedCourse.courseTitle,
      courseNumber: selectedCourse.code || selectedCourse.courseNumber
    } : undefined;

    // Save the recording to disk
    const saveResult = await window.scribeCat.recording.stop(
      result.audioData.buffer as ArrayBuffer,
      durationSeconds,
      courseData
    );

    if (!saveResult.success) {
      throw new Error(saveResult.error || 'Failed to save recording');
    }

    console.log('✅ Recording saved to:', saveResult.filePath);

    // Save transcription to session
    if (saveResult.sessionId) {
      const transcriptionText = this.transcriptionManager.getText();
      if (transcriptionText && transcriptionText.trim().length > 0) {
        console.log('Saving transcription to session...');
        const transcriptionResult = await window.scribeCat.session.updateTranscription(
          saveResult.sessionId,
          transcriptionText,
          this.currentTranscriptionMode
        );

        if (transcriptionResult.success) {
          console.log('✅ Transcription saved to session');
        } else {
          console.error('❌ Failed to save transcription:', transcriptionResult.error);
        }
      }

      // Save notes to session if any
      const notes = this.editorManager.getNotesHTML();
      if (notes && notes.trim().length > 0) {
        console.log('Saving notes to session...');
        const notesResult = await window.scribeCat.session.updateNotes(
          saveResult.sessionId,
          notes
        );

        if (notesResult.success) {
          console.log('✅ Notes saved to session');
        } else {
          console.error('❌ Failed to save notes:', notesResult.error);
        }
      }
    }

    // Update state
    this.isRecording = false;

    // Update UI
    this.viewManager.updateRecordingState(false);
    this.stopElapsedTimer();
    this.stopVUMeterUpdates();

    // Show completion message
    this.viewManager.showSessionInfo(`Recording saved: ${saveResult.sessionId}`);

    console.log('Recording stopped successfully');
  }

  /**
   * Pause recording
   */
  async pause(): Promise<void> {
    if (!this.isRecording || this.isPaused) {
      return;
    }

    console.log('Pausing recording...');

    // Pause audio recording
    this.audioManager.pauseRecording();

    // Pause transcription
    if (this.currentTranscriptionMode === 'simulation' && this.transcriptionSessionId) {
      // For simulation, we can just stop sending data (it's already paused with audio)
    } else if (this.currentTranscriptionMode === 'assemblyai') {
      // For AssemblyAI, stop audio streaming but keep WebSocket open
      const intervalId = (window as any).assemblyAIStreamingInterval;
      if (intervalId) {
        clearInterval(intervalId);
        delete (window as any).assemblyAIStreamingInterval;
      }
      this.audioManager.removeAudioDataCallback();
    }

    // Pause timers
    this.stopElapsedTimer();
    this.stopVUMeterUpdates();

    // Track pause time
    this.pauseStartTime = Date.now();
    this.isPaused = true;

    // Update UI
    this.viewManager.updatePausedState(true);

    console.log('Recording paused');
  }

  /**
   * Resume recording
   */
  async resume(): Promise<void> {
    if (!this.isRecording || !this.isPaused) {
      return;
    }

    console.log('Resuming recording...');

    // Calculate total paused time
    this.totalPausedTime += Date.now() - this.pauseStartTime;

    // Resume audio recording
    this.audioManager.resumeRecording();

    // Resume transcription
    if (this.currentTranscriptionMode === 'assemblyai') {
      // Restart audio streaming for AssemblyAI
      this.startAssemblyAIAudioStreaming();
    }

    // Resume timers
    this.startElapsedTimer();
    this.startVUMeterUpdates();

    // Update state
    this.isPaused = false;

    // Update UI
    this.viewManager.updatePausedState(false);

    console.log('Recording resumed');
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Check if currently paused
   */
  getIsPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Clean up recording resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.transcriptionSessionId) {
        if (this.currentTranscriptionMode === 'simulation') {
          await window.scribeCat.transcription.simulation.stop(this.transcriptionSessionId);
        } else if (this.currentTranscriptionMode === 'assemblyai') {
          this.stopAssemblyAIAudioStreaming();
        }
        this.transcriptionSessionId = null;
      }

      await this.audioManager.stopRecording();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  // ===== Private Methods =====

  /**
   * Start simulation transcription
   */
  private async startSimulationTranscription(): Promise<void> {
    const result = await window.scribeCat.transcription.simulation.start();

    if (!result.success) {
      throw new Error(result.error || 'Failed to start simulation transcription');
    }

    this.transcriptionSessionId = result.sessionId!;
  }

  /**
   * Start AssemblyAI transcription
   */
  private async startAssemblyAITranscription(): Promise<void> {
    const apiKey = await window.scribeCat.store.get('assemblyai-api-key') as string;

    if (!apiKey) {
      throw new Error('AssemblyAI API key not configured. Please add it in Settings.');
    }

    console.log('Starting AssemblyAI transcription...');

    // Create and initialize service
    this.assemblyAIService = new AssemblyAITranscriptionService();
    await this.assemblyAIService.initialize(apiKey);

    // Set up result callback
    this.assemblyAIService.onResult((text: string, isFinal: boolean) => {
      console.log('🎤 AssemblyAI:', isFinal ? 'Final' : 'Partial', text);
      this.transcriptionManager.updateFlowing(text, isFinal);
    });

    // Start session
    this.transcriptionSessionId = await this.assemblyAIService.start();

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
      if (this.currentTranscriptionMode !== 'assemblyai') return;
      audioBuffer.push(new Float32Array(audioData));
    });

    const intervalId = setInterval(() => {
      if (audioBuffer.length === 0 || this.currentTranscriptionMode !== 'assemblyai') return;

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
      const sourceSampleRate = (this.audioManager as any)['analyzer']['audioContext']?.sampleRate || 48000;
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

    (window as any).assemblyAIStreamingInterval = intervalId;
    console.log('AssemblyAI audio streaming enabled');
  }

  /**
   * Stop AssemblyAI audio streaming
   */
  private stopAssemblyAIAudioStreaming(): void {
    const intervalId = (window as any).assemblyAIStreamingInterval;
    if (intervalId) {
      clearInterval(intervalId);
      delete (window as any).assemblyAIStreamingInterval;
    }

    if (this.assemblyAIService) {
      this.assemblyAIService.stop();
      this.assemblyAIService = null;
    }

    this.audioManager.removeAudioDataCallback();
    console.log('AssemblyAI audio streaming stopped');
  }

  /**
   * Resample audio
   */
  private resampleAudio(audioData: Float32Array, sourceSampleRate: number, targetSampleRate: number): Float32Array {
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

  /**
   * Start elapsed time timer
   */
  private startElapsedTimer(): void {
    this.updateElapsedTime();
    this.elapsedTimer = window.setInterval(() => this.updateElapsedTime(), 1000);
  }

  /**
   * Stop elapsed time timer
   */
  private stopElapsedTimer(): void {
    if (this.elapsedTimer !== null) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  }

  /**
   * Update elapsed time display
   */
  private updateElapsedTime(): void {
    // Calculate elapsed time excluding paused time
    const currentPausedTime = this.isPaused ? (Date.now() - this.pauseStartTime) : 0;
    const totalElapsed = Date.now() - this.startTime - this.totalPausedTime - currentPausedTime;
    const elapsed = Math.floor(totalElapsed / 1000);
    this.viewManager.updateElapsedTime(elapsed);
  }

  /**
   * Start VU meter updates
   */
  private startVUMeterUpdates(): void {
    this.vuMeterInterval = window.setInterval(() => {
      const level = this.audioManager.getAudioLevel();
      this.viewManager.updateVUMeter(level);
    }, 100);
  }

  /**
   * Stop VU meter updates
   */
  private stopVUMeterUpdates(): void {
    if (this.vuMeterInterval !== null) {
      clearInterval(this.vuMeterInterval);
      this.vuMeterInterval = null;
    }
  }
}
