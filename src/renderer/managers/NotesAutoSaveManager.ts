/**
 * NotesAutoSaveManager
 * Manages automatic saving of notes with draft session support
 */

import { TiptapEditorManager } from './TiptapEditorManager.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('NotesAutoSaveManager');

export class NotesAutoSaveManager {
  private editorManager: TiptapEditorManager;
  private currentSessionId: string | null = null;
  private isDraftSession: boolean = false;
  private autoSaveTimer: number | null = null;
  private readonly DEBOUNCE_DELAY = 2000; // 2 seconds
  private isSaving: boolean = false;

  constructor(editorManager: TiptapEditorManager) {
    this.editorManager = editorManager;
  }

  /**
   * Initialize auto-save manager
   */
  initialize(): void {
    logger.info('NotesAutoSaveManager initialized');
  }

  /**
   * Called when editor content changes
   * Debounces the save operation
   */
  onEditorUpdate(): void {
    // Clear existing timer
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
    }

    // Set up debounced save
    this.autoSaveTimer = window.setTimeout(() => {
      this.saveNotes();
    }, this.DEBOUNCE_DELAY);
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

    try {
      this.isSaving = true;

      // Get notes content
      const notes = this.editorManager.getNotesHTML();
      const plainText = this.editorManager.getNotesText();

      // Don't save if notes are empty
      // Check plain text content to avoid saving empty HTML tags like <p></p>
      if (!notes || notes.trim().length === 0 || !plainText || plainText.trim().length === 0) {
        logger.debug('Notes are empty, skipping save');
        return;
      }

      // If no session exists, create a draft session
      if (!this.currentSessionId) {
        logger.info('No session exists, creating draft');
        const sessionId = await this.createDraftSession();
        if (!sessionId) {
          logger.error('Failed to create draft session');
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
      } else {
        logger.error('Failed to save notes', result.error);
      }
    } catch (error) {
      logger.error('Error saving notes', error);
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
   * Save notes immediately (bypasses debounce)
   * Used for critical saves like window close
   */
  async saveImmediately(): Promise<void> {
    // Clear debounce timer
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    // Save immediately
    await this.saveNotes();
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
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
  }
}
