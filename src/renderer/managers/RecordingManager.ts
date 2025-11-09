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
import { AISummaryManager } from '../services/AISummaryManager.js';
import { createLogger } from '../../shared/logger.js';
import { config } from '../../config.js';

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
  private suggestionCheckInterval: number | null = null;

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
    // No initialization needed - transcription handled by TranscriptionModeService
  }

  /**
   * Start recording and transcription
   */
  async start(deviceId: string): Promise<void> {
    if (!deviceId) {
      throw new Error('Please select a microphone device');
    }

    // Get transcription mode from settings (default to assemblyai)
    const mode = await window.scribeCat.store.get('transcription-mode') as string || 'assemblyai';
    const transcriptionMode = mode as 'assemblyai';

    logger.info(`Starting recording with ${transcriptionMode} mode`);

    // Start audio recording
    await this.audioManager.startRecording({
      deviceId: deviceId,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true  // Enable AGC for consistent volume levels
    });

    // Start transcription service
    const apiKey = transcriptionMode === 'assemblyai'
      ? config.assemblyai.apiKey
      : undefined;

    // Load transcription accuracy settings
    const transcriptionSettings = await window.scribeCat.store.get('transcription-accuracy-settings');

    await this.transcriptionService.start({
      mode: transcriptionMode,
      apiKey,
      transcriptionSettings: transcriptionSettings || undefined
    });

    // Update state
    this.isRecording = true;
    this.startTime = Date.now();

    // Prevent system sleep during recording
    try {
      await window.scribeCat.power.preventSleep();
      logger.info('Sleep prevention enabled');
    } catch (error) {
      logger.warn('Failed to prevent sleep (recording will continue)', error);
    }

    // Start AI content analysis
    this.aiManager.startContentAnalysis();
    this.startSuggestionChecks();

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

    // Get current user ID (if authenticated)
    const currentUser = window.authManager?.getCurrentUser();
    const userId = currentUser?.id || null;

    // Save the recording to disk
    const saveResult = await window.scribeCat.recording.stop(
      result.audioData.buffer as ArrayBuffer,
      durationSeconds,
      courseData,
      userId
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

          // Generate and save short summary for card display
          logger.info('Generating short summary for session');
          const summaryManager = new AISummaryManager();
          summaryManager.generateAndSaveShortSummary(saveResult.sessionId)
            .then(() => {
              logger.info('Short summary generated and saved');
            })
            .catch(error => {
              logger.warn('Failed to generate short summary (non-critical):', error);
            });
        } else {
          logger.error('Failed to save transcription', transcriptionResult.error);
        }
      }

      // Transition NotesAutoSaveManager to use the recording session
      // This will copy notes from draft (if any) and continue auto-saving to the recording session
      await this.notesAutoSaveManager.transitionToRecordingSession(saveResult.sessionId);

      // Save notes immediately to ensure they're captured
      await this.notesAutoSaveManager.saveImmediately();

      // Trigger cloud sync NOW - after transcription and notes are saved
      // This ensures we upload the complete session with all data
      logger.info('Triggering cloud sync for session');
      window.scribeCat.sync.uploadSession(saveResult.sessionId)
        .then(result => {
          if (result.success) {
            logger.info('Session uploaded to cloud successfully');
          } else {
            logger.warn('Cloud sync failed (will retry later):', result.error);
          }
        })
        .catch(error => {
          logger.error('Error triggering cloud sync:', error);
        });
    }

    // Update state
    this.isRecording = false;

    // Allow system sleep now that recording is complete
    try {
      await window.scribeCat.power.allowSleep();
      logger.info('Sleep prevention disabled');
    } catch (error) {
      logger.warn('Failed to allow sleep', error);
    }

    // Stop suggestion checks and reset AI analysis
    this.stopSuggestionChecks();
    this.aiManager.resetContentAnalysis();

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
    this.stopSuggestionChecks();

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
    this.startSuggestionChecks();

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

      // Stop all timers and intervals
      this.stopElapsedTimer();
      this.stopVUMeterUpdates();
      this.stopSuggestionChecks();

      // Reset AI analysis
      this.aiManager.resetContentAnalysis();

      // Ensure sleep prevention is disabled during cleanup
      try {
        await window.scribeCat.power.allowSleep();
        logger.info('Sleep prevention disabled during cleanup');
      } catch (error) {
        logger.warn('Failed to allow sleep during cleanup', error);
      }
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

  /**
   * Start periodic suggestion checks
   */
  private startSuggestionChecks(): void {
    // Check for suggestions every 30 seconds
    this.suggestionCheckInterval = window.setInterval(() => {
      this.checkAndShowSuggestions();
    }, 30000); // 30 seconds

    // Do an initial check after 1 minute
    setTimeout(() => {
      this.checkAndShowSuggestions();
    }, 60000);
  }

  /**
   * Stop suggestion checks
   */
  private stopSuggestionChecks(): void {
    if (this.suggestionCheckInterval !== null) {
      clearInterval(this.suggestionCheckInterval);
      this.suggestionCheckInterval = null;
    }
  }

  /**
   * Check for suggestions and show if available
   */
  private checkAndShowSuggestions(): void {
    // Update content analysis
    this.aiManager.updateContentAnalysis();

    // Get top suggestion for RECORDING mode (passive suggestions only)
    const suggestion = this.aiManager.getSmartSuggestion('recording');

    if (suggestion) {
      logger.info(`💡 Showing recording suggestion: ${suggestion.title} (confidence: ${suggestion.confidence})`);

      // Show suggestion chip
      const suggestionChip = (window as any).aiSuggestionChip;
      if (suggestionChip && !suggestionChip.getIsVisible()) {
        suggestionChip.show(suggestion);
        this.aiManager.markSuggestionShown(suggestion.id);
      }
    }
  }
}
