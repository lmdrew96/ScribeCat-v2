/**
 * RecordingManager
 * Coordinates recording, transcription, and audio streaming
 */

import { AudioManager } from '../audio-manager.js';
import { TranscriptionManager } from './TranscriptionManager.js';
import { ViewManager } from './ViewManager.js';
import { TiptapEditorManager } from './TiptapEditorManager.js';
import { AIManager } from '../ai/AIManager.js';
import { CourseManager } from './CourseManager.js';
import { TranscriptionModeService } from '../services/TranscriptionModeService.js';
import { NotesAutoSaveManager } from './NotesAutoSaveManager.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('RecordingManager');

export class RecordingManager {
  private audioManager: AudioManager;
  private transcriptionManager: TranscriptionManager;
  private viewManager: ViewManager;
  private editorManager: TiptapEditorManager;
  private aiManager: AIManager;
  private courseManager: CourseManager;
  private transcriptionService: TranscriptionModeService;
  private notesAutoSaveManager: NotesAutoSaveManager;

  private isRecording: boolean = false;
  private isPaused: boolean = false;
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
    aiManager: AIManager,
    courseManager: CourseManager,
    notesAutoSaveManager: NotesAutoSaveManager
  ) {
    this.audioManager = audioManager;
    this.transcriptionManager = transcriptionManager;
    this.viewManager = viewManager;
    this.editorManager = editorManager;
    this.aiManager = aiManager;
    this.courseManager = courseManager;
    this.notesAutoSaveManager = notesAutoSaveManager;
    this.transcriptionService = new TranscriptionModeService(audioManager, transcriptionManager);
  }

  /**
   * Initialize recording manager
   */
  initialize(): void {
    // Set up transcription listeners
    window.scribeCat.transcription.simulation.onResult((result) => {
      if (this.transcriptionService.getCurrentMode() === 'simulation') {
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
    const transcriptionMode = mode as 'simulation' | 'assemblyai';

    logger.info(`Starting recording with ${transcriptionMode} mode`);

    // Start audio recording
    await this.audioManager.startRecording({
      deviceId: deviceId,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false
    });

    // Start transcription service
    const apiKey = transcriptionMode === 'assemblyai'
      ? await window.scribeCat.store.get('assemblyai-api-key') as string
      : undefined;

    await this.transcriptionService.start({
      mode: transcriptionMode,
      apiKey
    });

    // Update state
    this.isRecording = true;
    this.startTime = Date.now();

    // Update UI
    this.viewManager.updateRecordingState(true, transcriptionMode);
    this.transcriptionManager.clear();
    this.transcriptionManager.startRecording(); // Initialize timestamp tracking
    this.startElapsedTimer();
    this.startVUMeterUpdates();

    logger.info('Recording started successfully');
  }

  /**
   * Stop recording and save
   */
  async stop(): Promise<void> {
    logger.info('Stopping recording');

    // Stop transcription
    await this.transcriptionService.stop();

    // Stop audio recording
    const result = await this.audioManager.stopRecording();
    const durationSeconds = result.duration / 1000;
    logger.info(`Recording stopped. Duration: ${durationSeconds} seconds`);

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

    logger.info(`Recording saved to: ${saveResult.filePath}`);

    // Save transcription to session
    if (saveResult.sessionId) {
      const transcriptionText = this.transcriptionManager.getText();
      if (transcriptionText && transcriptionText.trim().length > 0) {
        logger.info('Saving transcription to session');

        // Get timestamped entries for accurate synchronization
        const timestampedEntries = this.transcriptionManager.getTimestampedEntries();

        logger.debug('Saving transcription with metadata', {
          sessionDuration: durationSeconds,
          entryCount: timestampedEntries.length,
          firstTimestamp: timestampedEntries[0]?.timestamp,
          lastTimestamp: timestampedEntries[timestampedEntries.length - 1]?.timestamp
        });

        const transcriptionResult = await window.scribeCat.session.updateTranscription(
          saveResult.sessionId,
          transcriptionText,
          this.transcriptionService.getCurrentMode(),
          timestampedEntries.length > 0 ? timestampedEntries : undefined
        );

        if (transcriptionResult.success) {
          logger.info('Transcription saved to session');
        } else {
          logger.error('Failed to save transcription', transcriptionResult.error);
        }
      }

      // Transition NotesAutoSaveManager to use the recording session
      // This will copy notes from draft (if any) and continue auto-saving to the recording session
      await this.notesAutoSaveManager.transitionToRecordingSession(saveResult.sessionId);

      // Save notes immediately to ensure they're captured
      await this.notesAutoSaveManager.saveImmediately();
    }

    // Update state
    this.isRecording = false;

    // Update UI
    this.viewManager.updateRecordingState(false);
    this.stopElapsedTimer();
    this.stopVUMeterUpdates();

    // Show completion message
    this.viewManager.showSessionInfo(`Recording saved: ${saveResult.sessionId}`);

    logger.info('Recording stopped successfully');
  }

  /**
   * Pause recording
   */
  async pause(): Promise<void> {
    if (!this.isRecording || this.isPaused) {
      return;
    }

    logger.info('Pausing recording');

    // Pause audio recording
    this.audioManager.pauseRecording();

    // Pause transcription
    this.transcriptionService.pause();

    // Pause transcription manager timestamp tracking
    this.transcriptionManager.pauseRecording();

    // Pause timers
    this.stopElapsedTimer();
    this.stopVUMeterUpdates();

    // Track pause time
    this.pauseStartTime = Date.now();
    this.isPaused = true;

    // Update UI
    this.viewManager.updatePausedState(true);

    logger.info('Recording paused');
  }

  /**
   * Resume recording
   */
  async resume(): Promise<void> {
    if (!this.isRecording || !this.isPaused) {
      return;
    }

    logger.info('Resuming recording');

    // Calculate total paused time
    this.totalPausedTime += Date.now() - this.pauseStartTime;

    // Resume audio recording
    this.audioManager.resumeRecording();

    // Resume transcription
    this.transcriptionService.resume();

    // Resume transcription manager timestamp tracking
    this.transcriptionManager.resumeRecording();

    // Resume timers
    this.startElapsedTimer();
    this.startVUMeterUpdates();

    // Update state
    this.isPaused = false;

    // Update UI
    this.viewManager.updatePausedState(false);

    logger.info('Recording resumed');
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
      await this.transcriptionService.cleanup();
      await this.audioManager.stopRecording();
    } catch (error) {
      logger.error('Error during cleanup', error);
    }
  }

  // ===== Private Methods =====

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
