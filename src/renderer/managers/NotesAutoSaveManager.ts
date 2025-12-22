/**
 * NotesAutoSaveManager
 * Manages automatic saving of notes with draft session support
 */

import { TiptapEditorManager } from './TiptapEditorManager.js';
import { AutoSaveIndicator } from '../components/AutoSaveIndicator.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('NotesAutoSaveManager');

export class NotesAutoSaveManager {
  private editorManager: TiptapEditorManager;
  private currentSessionId: string | null = null;
  private isDraftSession: boolean = false;
  private autoSaveTimer: number | null = null;
  private maxIntervalTimer: number | null = null;
  private readonly DEBOUNCE_DELAY = 2000; // 2 seconds after user stops typing
  private readonly MAX_INTERVAL = 10000; // 10 seconds max between saves (even while typing)
  private isSaving: boolean = false;
  private lastSaveTime: number = 0;
  private indicator: AutoSaveIndicator;

  constructor(editorManager: TiptapEditorManager) {
    this.editorManager = editorManager;
    this.indicator = new AutoSaveIndicator();
  }

  /**
   * Initialize auto-save manager
   */
  initialize(): void {
    // Auto-save manager ready
    logger.info('NotesAutoSaveManager initialized with AutoSaveIndicator');
  }

  /**
   * Called when editor content changes
   * Uses debounce timer + max interval to ensure periodic saves
   */
  onEditorUpdate(): void {
    const now = Date.now();

    // Initialize lastSaveTime on first update (start the throttle clock)
    if (this.lastSaveTime === 0) {
      this.lastSaveTime = now;
    }

    const timeSinceLastSave = now - this.lastSaveTime;

    // If it's been more than MAX_INTERVAL since last save, save immediately (throttle)
    if (timeSinceLastSave >= this.MAX_INTERVAL) {
      logger.debug(`Max interval reached (${timeSinceLastSave}ms), saving immediately`);
      this.saveNotes();
      return;
    }

    // Clear existing debounce timer
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
    }

    // Set up debounced save (triggers when user stops typing)
    this.autoSaveTimer = window.setTimeout(() => {
      this.saveNotes();
    }, this.DEBOUNCE_DELAY);

    // Set up max interval timer if not already running
    // This ensures we save every MAX_INTERVAL even if user types continuously
    if (this.maxIntervalTimer === null) {
      const timeUntilMaxInterval = this.MAX_INTERVAL - timeSinceLastSave;
      if (timeUntilMaxInterval > 0) {
        this.maxIntervalTimer = window.setTimeout(() => {
          logger.debug('Max interval timer fired, forcing save');
          this.maxIntervalTimer = null;
          this.saveNotes();
        }, timeUntilMaxInterval);
      }
    }
  }

  /**
   * Save notes to the current session (or create draft if none exists)
   */
  private async saveNotes(): Promise<void> {
    // Prevent concurrent saves
    if (this.isSaving) {
      logger.debug('Save already in progress, skipping');
      return;
    }

    // Clear timers
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    if (this.maxIntervalTimer !== null) {
      clearTimeout(this.maxIntervalTimer);
      this.maxIntervalTimer = null;
    }

    try {
      this.isSaving = true;

      // Show saving indicator
      this.indicator.showSaving();

      // Get notes content
      const notes = this.editorManager.getNotesHTML();
      const plainText = this.editorManager.getNotesText();

      // Don't save if notes are empty
      // Check plain text content to avoid saving empty HTML tags like <p></p>
      if (!notes || notes.trim().length === 0 || !plainText || plainText.trim().length === 0) {
        logger.debug('Notes are empty, skipping save');
        this.indicator.hide();
        return;
      }

      // If no session exists, create a draft session
      if (!this.currentSessionId) {
        logger.info('No session exists, creating draft');
        const sessionId = await this.createDraftSession();
        if (!sessionId) {
          logger.error('Failed to create draft session');
          this.indicator.showError('Failed to create draft');
          return;
        }
        this.currentSessionId = sessionId;
        this.isDraftSession = true;
        logger.info(`Created draft session: ${sessionId}`);
      }

      // Save notes to session
      logger.debug(`Saving notes to session: ${this.currentSessionId}`);
      const result = await window.scribeCat.session.updateNotes(
        this.currentSessionId,
        notes
      );

      if (result.success) {
        logger.info('Notes saved successfully');

        // Update last save time
        this.lastSaveTime = Date.now();

        // Show saved indicator (fades out automatically)
        this.indicator.showSaved();
      } else {
        logger.error('Failed to save notes', result.error);

        // Show error indicator
        this.indicator.showError('Save failed');

        // Also show error notification for critical failures
        const notificationTicker = window.notificationTicker;
        if (notificationTicker) {
          notificationTicker.error('Failed to save notes', 3000);
        }
      }
    } catch (error) {
      logger.error('Error saving notes', error);
      this.indicator.showError('Save error');

      // Show error notification for exceptions
      const notificationTicker = window.notificationTicker;
      if (notificationTicker) {
        notificationTicker.error('Failed to save notes', 3000);
      }
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Create a draft session for note-taking without recording
   */
  private async createDraftSession(): Promise<string | null> {
    try {
      const result = await window.scribeCat.session.createDraft();
      if (result.success && result.sessionId) {
        return result.sessionId;
      }
      return null;
    } catch (error) {
      logger.error('Error creating draft session', error);
      return null;
    }
  }

  /**
   * Transition from draft session to recording session
   * Copies notes from draft to the new recording session
   */
  async transitionToRecordingSession(recordingSessionId: string): Promise<void> {
    logger.info('Transitioning from draft to recording session');

    // If we had a draft, copy notes to the new recording session
    if (this.isDraftSession && this.currentSessionId) {
      const notes = this.editorManager.getNotesHTML();
      if (notes && notes.trim().length > 0) {
        logger.info('Copying notes from draft to recording session');
        await window.scribeCat.session.updateNotes(recordingSessionId, notes);
      }
      // Note: We keep the draft session for now (it can be cleaned up later)
    }

    // Update to new session
    this.currentSessionId = recordingSessionId;
    this.isDraftSession = false;
    logger.info(`Now tracking recording session: ${recordingSessionId}`);
  }

  /**
   * Set the current session ID (e.g., when recording stops but we want to keep saving)
   */
  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
    this.isDraftSession = false;
    logger.info(`Session ID set to: ${sessionId}`);
  }

  /**
   * Get the current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Save notes immediately (bypasses debounce)
   * Used for critical saves like window close
   */
  async saveImmediately(): Promise<void> {
    // Clear timers
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    if (this.maxIntervalTimer !== null) {
      clearTimeout(this.maxIntervalTimer);
      this.maxIntervalTimer = null;
    }

    // Save immediately
    await this.saveNotes();
  }

  /**
   * Save notes now (public alias for saveImmediately)
   * Used by SessionResetManager for "New Session" functionality
   */
  async saveNow(): Promise<void> {
    await this.saveImmediately();
  }

  /**
   * Reset auto-save manager state for new session
   * Clears session tracking but preserves timers
   */
  reset(): void {
    logger.info('Resetting auto-save manager state');

    // Clear session tracking
    this.currentSessionId = null;
    this.isDraftSession = false;

    // Reset last save time
    this.lastSaveTime = 0;

    // Clear any pending timers
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    if (this.maxIntervalTimer !== null) {
      clearTimeout(this.maxIntervalTimer);
      this.maxIntervalTimer = null;
    }

    logger.debug('Auto-save manager state reset complete');
  }

  /**
   * Check if current session is a draft
   */
  getIsDraftSession(): boolean {
    return this.isDraftSession;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    if (this.maxIntervalTimer !== null) {
      clearTimeout(this.maxIntervalTimer);
      this.maxIntervalTimer = null;
    }

    // Cleanup indicator
    this.indicator.destroy();
  }
}
