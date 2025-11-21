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
import { ChatUI } from '../ai/ChatUI.js';
import { createLogger } from '../../shared/logger.js';
import { config } from '../../config.js';
import { Transcription, TranscriptionSegment } from '../../domain/entities/Transcription.js';

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
  private chatUI: ChatUI;

  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private startTime: number = 0;
  private pauseStartTime: number = 0;
  private totalPausedTime: number = 0;
  private elapsedTimer: number | null = null;
  private vuMeterInterval: number | null = null;
  private suggestionCheckInterval: number | null = null;
  private sessionTitleInput: HTMLInputElement | null = null;

  constructor(
    audioManager: AudioManager,
    transcriptionManager: TranscriptionManager,
    viewManager: ViewManager,
    editorManager: TiptapEditorManager,
    aiManager: AIManager,
    courseManager: CourseManager,
    notesAutoSaveManager: NotesAutoSaveManager,
    chatUI: ChatUI
  ) {
    this.audioManager = audioManager;
    this.transcriptionManager = transcriptionManager;
    this.viewManager = viewManager;
    this.editorManager = editorManager;
    this.aiManager = aiManager;
    this.courseManager = courseManager;
    this.notesAutoSaveManager = notesAutoSaveManager;
    this.chatUI = chatUI;
    this.transcriptionService = new TranscriptionModeService(audioManager, transcriptionManager);
  }

  /**
   * Initialize recording manager
   */
  initialize(): void {
    // Get reference to session title input
    this.sessionTitleInput = document.getElementById('session-title-input') as HTMLInputElement;
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

    // Start live AI suggestions
    this.chatUI.startRecording();

    // Update UI
    this.viewManager.updateRecordingState(true, transcriptionMode);
    this.transcriptionManager.clear();
    this.transcriptionManager.startRecording(); // Initialize timestamp tracking
    this.startElapsedTimer();
    this.startVUMeterUpdates();

    // Clear session title input for new recording
    if (this.sessionTitleInput) {
      this.sessionTitleInput.value = '';
    }

    logger.info('Recording started successfully');
  }

  /**
   * Stop recording and save
   */
  async stop(): Promise<void> {
    logger.info('Stopping recording');

    let sessionId: string | undefined;
    let saveError: Error | undefined;

    try {
      // Stop transcription (with timeout protection)
      const transcriptionStopPromise = this.transcriptionService.stop();
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          logger.warn('Transcription stop timed out after 6 seconds, continuing with save');
          resolve();
        }, 6000);
      });
      await Promise.race([transcriptionStopPromise, timeoutPromise]);

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

      // Get session title (if provided)
      const sessionTitle = this.sessionTitleInput?.value.trim() || undefined;

      logger.info('Session title from input:',
        `Raw="${this.sessionTitleInput?.value}" ` +
        `Trimmed="${sessionTitle}" ` +
        `WillUseCustom=${!!sessionTitle}`
      );

      // Get transcription data before saving (to include in initial save)
      const transcriptionText = this.transcriptionManager.getText();
      const timestampedEntries = this.transcriptionManager.getTimestampedEntries();
      logger.info(`Transcription captured: ${transcriptionText?.length || 0} characters, ${timestampedEntries.length} segments`);

      // Create Transcription object from timestamped entries if available
      let transcription: Transcription | undefined;
      if (timestampedEntries.length > 0 && transcriptionText) {
        try {
          const segments: TranscriptionSegment[] = timestampedEntries.map(entry => ({
            text: entry.text,
            startTime: entry.startTime,
            endTime: entry.endTime
          }));

          transcription = new Transcription(
            transcriptionText,
            segments,
            'en', // Default language (AssemblyAI auto-detects)
            'assemblyai',
            new Date()
          );
          logger.info(`✅ Created Transcription object with ${segments.length} segments`);
        } catch (error) {
          logger.warn('Failed to create Transcription object:', error);
          // Will fall back to string transcription
        }
      }

      // Save the recording to disk with transcription included
      try {
        // Serialize Transcription object for IPC transfer (Electron serializes to JSON)
        const transcriptionData = transcription?.toJSON();

        const saveResult = await window.scribeCat.recording.stop(
          result.audioData.buffer as ArrayBuffer,
          durationSeconds,
          courseData,
          userId,
          transcriptionData,
          sessionTitle
        );

        if (!saveResult.success) {
          saveError = new Error(saveResult.error || 'IPC save returned failure');
          logger.error('❌ Recording save failed:', saveError.message);
        } else {
          sessionId = saveResult.sessionId;
          logger.info(`✅ Recording saved to: ${saveResult.filePath}`);
        }
      } catch (error) {
        saveError = error instanceof Error ? error : new Error('Unknown save error');
        logger.error('❌ Exception during recording save:', saveError);
      }

      // Transition NotesAutoSaveManager and save notes
      // CRITICAL: Do this even if initial save failed, using a fallback session ID
      if (!sessionId) {
        // Generate fallback session ID to preserve notes and transcription
        sessionId = crypto.randomUUID();
        logger.warn(`⚠️ Using fallback session ID: ${sessionId}`);
      }

      // Transition NotesAutoSaveManager to use the recording session
      // This will copy notes from draft (if any) and continue auto-saving to the recording session
      try {
        await this.notesAutoSaveManager.transitionToRecordingSession(sessionId);
        logger.info('✅ Notes transitioned to recording session');
      } catch (error) {
        logger.error('❌ Failed to transition notes:', error);
        if (!saveError) {
          saveError = error instanceof Error ? error : new Error('Notes transition failed');
        }
      }

      // Save notes immediately to ensure they're captured
      try {
        await this.notesAutoSaveManager.saveImmediately();
        logger.info('✅ Notes saved immediately');
      } catch (error) {
        logger.error('❌ Failed to save notes immediately:', error);
        if (!saveError) {
          saveError = error instanceof Error ? error : new Error('Notes save failed');
        }
      }

      // Generate short summary for session card display
      if (sessionId && transcriptionText && transcriptionText.trim().length > 0) {
        logger.info('Generating short summary for session');
        const summaryManager = new AISummaryManager();
        summaryManager.generateAndSaveShortSummary(sessionId)
          .then(() => {
            logger.info('Short summary generated and saved');
          })
          .catch(error => {
            logger.warn('Failed to generate short summary (non-critical):', error);
          });
      }

      // Trigger cloud sync NOW - after transcription and notes are saved
      // This ensures we upload the complete session with all data
      if (sessionId) {
        logger.info('Triggering cloud sync for session');
        window.scribeCat.sync.uploadSession(sessionId)
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

      // If there was a save error, throw it now (after attempting recovery)
      if (saveError) {
        throw saveError;
      }
    } catch (error) {
      logger.error('❌ Critical error in stop():', error);
      throw error;
    } finally {
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

      // Stop live AI suggestions
      this.chatUI.stopRecording();

      // Update UI
      this.viewManager.updateRecordingState(false);
      this.stopElapsedTimer();
      this.stopVUMeterUpdates();

      // Show completion message
      if (sessionId) {
        this.viewManager.showSessionInfo(`Recording saved: ${sessionId}`);
      } else {
        this.viewManager.showSessionInfo('Recording stopped (save may have failed)');
      }

      logger.info('Recording stopped successfully');
    }
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
   * Get current recording timestamp for bookmarks
   * Returns the active recording time in seconds (excluding paused time)
   */
  getCurrentRecordingTimestamp(): number {
    return this.transcriptionManager.getCurrentTimestamp();
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
    // Clear any existing interval first to prevent duplicates
    this.stopElapsedTimer();

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
    // Clear any existing interval first to prevent duplicates
    this.stopVUMeterUpdates();

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
    // Clear any existing interval first to prevent duplicates
    this.stopSuggestionChecks();

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
    // Calculate elapsed time in minutes
    const elapsed = Date.now() - this.startTime;
    const durationMinutes = elapsed / (1000 * 60);

    // Get transcription and notes
    const transcription = this.transcriptionManager.getText();
    const notes = this.editorManager.getNotesText();

    // Count words for logging
    const transcriptionWords = transcription.trim().split(/\s+/).filter(w => w.length > 0).length;
    const notesWords = notes.trim().split(/\s+/).filter(w => w.length > 0).length;

    logger.debug('Checking for live AI suggestions:', {
      durationMinutes: Math.round(durationMinutes * 10) / 10, // Round to 1 decimal
      transcriptionWords,
      notesWords,
      noteRatio: transcriptionWords > 0 ? Math.round((notesWords / transcriptionWords) * 100) + '%' : '0%'
    });

    // Update live suggestions with latest content and duration
    this.chatUI.updateLiveSuggestions(transcription, notes, durationMinutes);

    logger.debug('Live suggestions updated with latest content');
  }

  /**
   * Handle suggestion actions from ChatUI (legacy - now handled by ChatUI)
   */
  private handleChipSuggestion(suggestion: any): void {
    logger.info('Handling suggestion:', suggestion);

    // Handle different suggestion actions
    switch (suggestion.suggestedAction) {
      case 'bookmark':
        logger.info('User wants to bookmark this moment');
        // TODO: Implement bookmark functionality
        break;

      case 'note_prompt':
        logger.info('Prompting user to add notes');
        // Focus the notes editor
        this.editorManager.focus();
        break;

      case 'highlight':
        logger.info('User wants to highlight important moment');
        // TODO: Implement highlight functionality
        break;

      case 'break':
        logger.info('Suggesting break to user');
        // Pause recording
        this.pause();
        break;

      default:
        logger.warn('Unknown suggestion action:', suggestion.suggestedAction);
    }
  }

}
