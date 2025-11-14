/**
 * SessionResetManager
 * Coordinates resetting session state across all managers for "New Session" functionality
 */

import { TiptapEditorManager } from './TiptapEditorManager.js';
import { TranscriptionManager } from './TranscriptionManager.js';
import { NotesAutoSaveManager } from './NotesAutoSaveManager.js';
import { ViewManager } from './ViewManager.js';
import { RecordingManager } from './RecordingManager.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('SessionResetManager');

export class SessionResetManager {
  private editorManager: TiptapEditorManager;
  private transcriptionManager: TranscriptionManager;
  private notesAutoSaveManager: NotesAutoSaveManager;
  private viewManager: ViewManager;
  private recordingManager: RecordingManager;

  constructor(
    editorManager: TiptapEditorManager,
    transcriptionManager: TranscriptionManager,
    notesAutoSaveManager: NotesAutoSaveManager,
    viewManager: ViewManager,
    recordingManager: RecordingManager
  ) {
    this.editorManager = editorManager;
    this.transcriptionManager = transcriptionManager;
    this.notesAutoSaveManager = notesAutoSaveManager;
    this.viewManager = viewManager;
    this.recordingManager = recordingManager;
  }

  /**
   * Check if we can reset the session
   * Cannot reset during active recording or when paused
   */
  canReset(): boolean {
    const isRecording = this.recordingManager.getIsRecording();
    const isPaused = this.recordingManager.getIsPaused();

    return !isRecording && !isPaused;
  }

  /**
   * Reset the session state
   * Saves current work, then clears all session-related UI and state
   */
  async resetSession(): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Starting session reset');

      // Check if we can reset
      if (!this.canReset()) {
        const error = 'Cannot reset during active recording. Please stop recording first.';
        logger.warn(error);
        return { success: false, error };
      }

      // Step 1: Save current work immediately (bypass debounce)
      logger.debug('Saving current work...');
      await this.notesAutoSaveManager.saveNow();

      // Step 2: Clear UI content
      logger.debug('Clearing UI content...');
      this.editorManager.clearNotes();
      this.transcriptionManager.clear();

      // Step 3: Reset session UI elements
      logger.debug('Resetting session UI...');
      this.viewManager.resetSessionUI();

      // Step 4: Reset auto-save manager state
      logger.debug('Resetting auto-save manager...');
      this.notesAutoSaveManager.reset();

      logger.info('Session reset complete');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error during session reset', error);
      return {
        success: false,
        error: `Failed to reset session: ${errorMessage}`
      };
    }
  }

  /**
   * Get a user-friendly message explaining why reset is disabled
   */
  getDisabledReason(): string | null {
    if (this.recordingManager.getIsRecording()) {
      return 'Recording in progress';
    }
    if (this.recordingManager.getIsPaused()) {
      return 'Recording paused';
    }
    return null;
  }
}
