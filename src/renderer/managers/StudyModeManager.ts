/**
 * StudyModeManager (Refactored)
 *
 * Coordinates the Study Mode view for reviewing past recording sessions.
 * Delegates functionality to specialized managers for better separation of concerns.
 */

import type { Session } from '../../domain/entities/Session.js';
import { SyncStatus } from '../../domain/entities/Session.js';
import { Transcription } from '../../domain/entities/Transcription.js';
import { AIClient } from '../ai/AIClient.js';
import { SessionPlaybackManager } from '../services/SessionPlaybackManager.js';
import { AISummaryManager } from '../services/AISummaryManager.js';
import { ExportCoordinator } from '../services/ExportCoordinator.js';
import { ShareModal } from '../components/ShareModal.js';
import { SessionSharingManager } from './SessionSharingManager.js';
import { CollaborationManager } from './collaboration/CollaborationManager.js';
import { AuthManager } from './AuthManager.js';
import { StudyModeSessionListManager } from './study-mode/StudyModeSessionListManager.js';
import { StudyModeDetailViewManager } from './study-mode/StudyModeDetailViewManager.js';
import { StudyModeNotesEditorManager } from './study-mode/StudyModeNotesEditorManager.js';
import { StudyModeAIToolsManager } from './study-mode/StudyModeAIToolsManager.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('StudyModeManager');

export class StudyModeManager {
  // Core managers
  private sessionListManager: StudyModeSessionListManager;
  private detailViewManager: StudyModeDetailViewManager;
  private notesEditorManager: StudyModeNotesEditorManager;
  private aiToolsManager: StudyModeAIToolsManager;

  // Services
  private authManager: AuthManager;
  private aiClient: AIClient;
  private sessionPlaybackManager: SessionPlaybackManager;
  private aiSummaryManager: AISummaryManager;
  private exportCoordinator: ExportCoordinator;
  private shareModal: ShareModal;
  private sessionSharingManager: SessionSharingManager;
  private collaborationManager: CollaborationManager | null = null;

  // State
  private isActive: boolean = false;
  private sessions: Session[] = [];
  private sharedWithMeSessions: any[] = [];

  // UI Elements
  private studyModeView: HTMLElement;
  private recordModeView: HTMLElement;
  private studyModeBtn: HTMLButtonElement;
  private backToRecordBtn: HTMLButtonElement;
  private sessionListContainer: HTMLElement;
  private sessionDetailContainer: HTMLElement;

  constructor(authManager: AuthManager) {
    // Get UI elements
    this.studyModeView = document.getElementById('study-mode-view') as HTMLElement;
    this.recordModeView = document.querySelector('.main-content') as HTMLElement;
    this.studyModeBtn = document.getElementById('study-mode-btn') as HTMLButtonElement;
    this.backToRecordBtn = document.getElementById('back-to-record-btn') as HTMLButtonElement;
    this.sessionListContainer = document.getElementById('session-list') as HTMLElement;
    this.sessionDetailContainer = document.getElementById('session-detail') as HTMLElement;

    // Initialize services
    this.authManager = authManager;
    this.aiClient = new AIClient();
    this.sessionPlaybackManager = new SessionPlaybackManager();
    this.aiSummaryManager = new AISummaryManager();
    this.exportCoordinator = new ExportCoordinator();
    this.shareModal = new ShareModal();
    this.sessionSharingManager = new SessionSharingManager();

    // Initialize specialized managers
    this.sessionListManager = new StudyModeSessionListManager(this.sessionListContainer);
    this.detailViewManager = new StudyModeDetailViewManager(
      this.sessionDetailContainer,
      this.sessionPlaybackManager
    );
    this.notesEditorManager = new StudyModeNotesEditorManager();
    this.aiToolsManager = new StudyModeAIToolsManager(this.aiSummaryManager);

    this.initializeEventListeners();
    this.setupAuthListener();
  }

  /**
   * Initialize the study mode manager
   */
  async initialize(): Promise<void> {
    try {
      // Initialize ShareModal
      this.shareModal.initialize();

      await this.loadSessions();
      logger.info('StudyModeManager initialized');
    } catch (error) {
      logger.error('Failed to initialize StudyModeManager', error);
    }
  }

  /**
   * Set up auth state change listener to reload sessions when user logs in/out
   */
  private setupAuthListener(): void {
    this.authManager.onAuthStateChange((user) => {
      logger.info('Auth state changed in StudyModeManager', user ? `User ${user.id}` : 'No user');

      // Clear current sessions
      this.sessions = [];
      this.sharedWithMeSessions = [];

      // Clear detail view
      if (this.sessionDetailContainer) {
        this.sessionDetailContainer.innerHTML = '';
      }

      // Stop any active collaboration
      if (this.collaborationManager) {
        this.collaborationManager.disconnect();
        this.collaborationManager = null;
      }

      // Reload sessions if study mode is active
      if (this.isActive) {
        this.loadSessions().then(() => {
          this.sessionListManager.render();
        });
      }
    });
  }

  /**
   * Initialize event listeners
   */
  private initializeEventListeners(): void {
    // Toggle to study mode
    this.studyModeBtn.addEventListener('click', () => this.show());

    // Back to record mode
    this.backToRecordBtn.addEventListener('click', () => this.hide());

    // Open shared sessions from menu
    document.addEventListener('openSharedSessions', () => {
      this.showSharedSessionsOnly();
    });

    // Session list events
    this.sessionListContainer.addEventListener('hideStudyMode', () => this.hide());
    this.sessionListContainer.addEventListener('openSessionDetail', ((e: CustomEvent) => {
      this.openSessionDetail(e.detail.sessionId);
    }) as EventListener);
    this.sessionListContainer.addEventListener('exportSession', ((e: CustomEvent) => {
      this.exportSession(e.detail.sessionId);
    }) as EventListener);
    this.sessionListContainer.addEventListener('deleteSession', ((e: CustomEvent) => {
      this.deleteSession(e.detail.sessionId);
    }) as EventListener);
    this.sessionListContainer.addEventListener('leaveSession', ((e: CustomEvent) => {
      this.leaveSession(e.detail.sessionId);
    }) as EventListener);
    this.sessionListContainer.addEventListener('startTitleEdit', ((e: CustomEvent) => {
      this.startTitleEdit(e.detail.sessionId);
    }) as EventListener);
    this.sessionListContainer.addEventListener('shareSession', ((e: CustomEvent) => {
      this.openShareModal(e.detail.sessionId);
    }) as EventListener);

    // Bulk actions
    this.sessionListManager.onBulkExport((sessionIds) => {
      this.handleBulkExport(sessionIds);
    });
    this.sessionListManager.onBulkDelete((sessionIds) => {
      this.handleBulkDelete(sessionIds);
    });

    // Detail view events
    this.sessionDetailContainer.addEventListener('backToList', () => {
      this.backToSessionList();
    });
    this.sessionDetailContainer.addEventListener('exportSession', ((e: CustomEvent) => {
      this.exportSession(e.detail.sessionId);
    }) as EventListener);
    this.sessionDetailContainer.addEventListener('deleteSession', ((e: CustomEvent) => {
      this.deleteSession(e.detail.sessionId);
    }) as EventListener);
    this.sessionDetailContainer.addEventListener('startTitleEdit', ((e: CustomEvent) => {
      this.startDetailTitleEdit(e.detail.sessionId);
    }) as EventListener);
    this.sessionDetailContainer.addEventListener('shareSession', ((e: CustomEvent) => {
      this.openShareModal(e.detail.sessionId);
    }) as EventListener);

    // Notes editing events
    const editNotesBtn = document.querySelector('.edit-notes-btn');
    editNotesBtn?.addEventListener('click', (e) => {
      const sessionId = (e.target as HTMLElement).dataset.sessionId;
      if (sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (session) {
          this.notesEditorManager.startNotesEdit(sessionId, session.notes || '');
        }
      }
    });

    const saveNotesBtn = document.querySelector('.save-notes-btn');
    saveNotesBtn?.addEventListener('click', (e) => {
      const sessionId = (e.target as HTMLElement).dataset.sessionId;
      if (sessionId) {
        this.saveNotesEdit(sessionId);
      }
    });

    const cancelEditNotesBtn = document.querySelector('.cancel-edit-notes-btn');
    cancelEditNotesBtn?.addEventListener('click', () => {
      this.cancelNotesEdit();
    });
  }

  /**
   * Load all sessions from storage
   */
  private async loadSessions(): Promise<void> {
    try {
      const result = await window.scribeCat.session.list();

      if (result.success) {
        // Handle both 'data' and 'sessions' response formats
        const sessionsData = result.data || result.sessions || [];
        this.sessions = sessionsData;
        this.sessionListManager.setSessions(this.sessions);
        logger.info(`Loaded ${this.sessions.length} sessions`);
      } else {
        logger.error('Failed to load sessions', result.error);
        this.sessions = [];
        this.sessionListManager.setSessions([]);
      }

      // Load shared sessions
      await this.loadSharedWithMeSessions();
    } catch (error) {
      logger.error('Error loading sessions', error);
      this.sessions = [];
      this.sessionListManager.setSessions([]);
    }
  }

  /**
   * Show study mode view
   */
  public async show(): Promise<void> {
    // Reload sessions to get latest data
    await this.loadSessions();

    // Hide record mode, show study mode
    this.recordModeView.classList.add('hidden');
    this.studyModeView.classList.remove('hidden');

    // Update button state
    this.studyModeBtn.classList.add('active');

    // Reset title to "Study Mode"
    const titleElement = this.studyModeView.querySelector('.study-mode-header h2');
    if (titleElement) {
      titleElement.textContent = '📚 Study Mode';
    }

    // Populate course filter
    this.sessionListManager.populateCourseFilter();

    // Render session list
    this.sessionListManager.render();

    this.isActive = true;
    logger.info('Study mode activated');
  }

  /**
   * Hide study mode view
   */
  public hide(): void {
    // Clear AI Chat study mode context
    const aiManager = window.aiManager;
    if (aiManager) {
      aiManager.clearStudyModeContext();
    }

    // Show record mode, hide study mode
    this.studyModeView.classList.add('hidden');
    this.recordModeView.classList.remove('hidden');

    // Update button state
    this.studyModeBtn.classList.remove('active');

    this.isActive = false;
    logger.info('Study mode deactivated');
  }

  /**
   * Open session detail view
   */
  private async openSessionDetail(sessionId: string): Promise<void> {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) {
      logger.error('Session not found', sessionId);
      // Show user-friendly message
      alert('This session is no longer available. It may have been deleted by its owner.');
      // Reload sessions to remove stale entries
      await this.loadSessions();
      return;
    }

    // Set AI Chat context to this session's data
    const aiManager = window.aiManager;
    if (aiManager) {
      const transcriptionText = session.transcription?.fullText || '';
      const notesText = session.notes || '';
      aiManager.setStudyModeContext(transcriptionText, notesText);
    }

    // Hide session list, show detail view
    this.sessionListContainer.classList.add('hidden');
    this.sessionDetailContainer.classList.remove('hidden');
    this.detailViewManager.render(session);

    // Initialize AI tools
    this.aiToolsManager.initialize(session);

    logger.info(`Opened session detail: ${sessionId}`);
  }

  /**
   * Back to session list
   */
  private backToSessionList(): void {
    // Clear AI Chat context when going back to list
    const aiManager = window.aiManager;
    if (aiManager) {
      aiManager.clearStudyModeContext();
    }

    // Hide detail view, show list view
    this.sessionDetailContainer.classList.add('hidden');
    this.sessionListContainer.classList.remove('hidden');
  }

  /**
   * Start editing a session title
   */
  private startTitleEdit(sessionId: string): void {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const titleElement = document.querySelector(`.session-title[data-session-id="${sessionId}"]`) as HTMLElement;
    if (!titleElement) return;

    const currentTitle = session.title;

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'title-edit-input';
    input.style.cssText = `
      width: 100%;
      padding: 4px 8px;
      font-size: 18px;
      font-weight: 600;
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      border: 2px solid var(--accent);
      border-radius: 4px;
      outline: none;
    `;

    // Replace title with input
    titleElement.replaceWith(input);
    input.focus();
    input.select();

    // Save on blur or Enter
    const saveTitle = async () => {
      const newTitle = input.value.trim();

      if (newTitle && newTitle !== currentTitle) {
        try {
          // Update session title via IPC
          const result = await window.scribeCat.session.update(sessionId, { title: newTitle });

          if (result.success) {
            // Update local session
            session.title = newTitle;
            logger.info('Title updated successfully');
          } else {
            logger.error('Failed to update title', result.error);
            alert(`Failed to update title: ${result.error}`);
          }
        } catch (error) {
          logger.error('Error updating title', error);
          alert('An error occurred while updating the title.');
        }
      }

      // Re-render the session list
      this.sessionListManager.render();
    };

    input.addEventListener('blur', saveTitle);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.sessionListManager.render();
      }
    });
  }

  /**
   * Start editing title in detail view
   */
  private startDetailTitleEdit(sessionId: string): void {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const titleElement = document.querySelector('.session-detail-title') as HTMLElement;
    if (!titleElement) return;

    const currentTitle = session.title;

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'title-edit-input-detail';
    input.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      font-size: 28px;
      font-weight: 600;
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      border: 2px solid var(--accent);
      border-radius: 4px;
      outline: none;
    `;

    // Replace title with input
    titleElement.replaceWith(input);
    input.focus();
    input.select();

    // Save on blur or Enter
    const saveTitle = async () => {
      const newTitle = input.value.trim();

      if (newTitle && newTitle !== currentTitle) {
        try {
          // Update session title via IPC
          const result = await window.scribeCat.session.update(sessionId, { title: newTitle });

          if (result.success) {
            // Update local session
            session.title = newTitle;
            logger.info('Title updated successfully');
          } else {
            logger.error('Failed to update title', result.error);
            alert(`Failed to update title: ${result.error}`);
          }
        } catch (error) {
          logger.error('Error updating title', error);
          alert('An error occurred while updating the title.');
        }
      }

      // Re-render the detail view
      this.detailViewManager.render(session);
    };

    input.addEventListener('blur', saveTitle);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.detailViewManager.render(session);
      }
    });
  }

  /**
   * Save edited notes
   */
  private async saveNotesEdit(sessionId: string): Promise<void> {
    if (!this.notesEditorManager.isEditing()) {
      return;
    }

    const updatedNotes = this.notesEditorManager.getNotesHTML();

    try {
      // Update session notes via IPC
      const result = await window.scribeCat.session.update(sessionId, { notes: updatedNotes });

      if (result.success) {
        // Update local session
        const session = this.sessions.find(s => s.id === sessionId);
        if (session) {
          session.notes = updatedNotes;
        }

        logger.info('Notes updated successfully');

        // Exit edit mode and update view
        this.notesEditorManager.updateNotesView(updatedNotes);
      } else {
        logger.error('Failed to update notes', result.error);
        alert(`Failed to save notes: ${result.error}`);
      }
    } catch (error) {
      logger.error('Error updating notes', error);
      alert('An error occurred while saving notes.');
    }
  }

  /**
   * Cancel notes editing
   */
  private cancelNotesEdit(): void {
    if (confirm('Discard your changes?')) {
      const session = this.sessions.find(s => s.id === this.notesEditorManager.getCurrentEditingSessionId()!);
      if (session) {
        this.notesEditorManager.updateNotesView(session.notes || '');
      }
    }
  }

  /**
   * Export a session
   */
  private exportSession(sessionId: string): void {
    this.exportCoordinator.exportSession(sessionId, this.sessions);
  }

  /**
   * Delete a session with confirmation
   */
  private async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) {
      logger.error('Session not found', sessionId);
      return;
    }

    // Show confirmation dialog
    const confirmed = confirm(
      `Delete "${session.title}"?\n\n` +
      `This will permanently delete the recording, transcription, and notes.\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      // Delete via IPC
      const result = await window.scribeCat.session.delete(sessionId);

      if (result.success) {
        logger.info('Session deleted successfully');
        // Refresh the session list
        await this.loadSessions();
        this.sessionListManager.render();
      } else {
        logger.error('Failed to delete session', result.error);
        alert(`Failed to delete session: ${result.error}`);
      }
    } catch (error) {
      logger.error('Error deleting session', error);
      alert('An error occurred while deleting the session.');
    }
  }

  /**
   * Leave a shared session (remove yourself as recipient)
   */
  private async leaveSession(sessionId: string): Promise<void> {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) {
      logger.error('Session not found', sessionId);
      return;
    }

    // Find the share ID for this session
    const share = this.sharedWithMeSessions.find((s: any) => s.sessions?.id === sessionId);
    if (!share) {
      logger.error('Share not found for session', sessionId);
      alert('Could not find share information for this session.');
      return;
    }

    // Show confirmation dialog
    const confirmed = confirm(
      `Leave "${session.title}"?\n\n` +
      `This session will be removed from your list. The owner can share it with you again later.`
    );

    if (!confirmed) {
      return;
    }

    try {
      // Revoke access via IPC
      const result = await this.sessionSharingManager.revokeAccess(share.id);

      if (result.success) {
        logger.info('Left shared session successfully');
        // Refresh the session list
        await this.loadSessions();
        this.sessionListManager.render();
      } else {
        logger.error('Failed to leave session', result.error);
        alert(`Failed to leave session: ${result.error}`);
      }
    } catch (error) {
      logger.error('Error leaving session', error);
      alert('An error occurred while leaving the session.');
    }
  }

  /**
   * Handle bulk export
   */
  private handleBulkExport(sessionIds: Set<string>): void {
    const bulkExportBtn = document.getElementById('bulk-export-btn') as HTMLButtonElement;
    this.exportCoordinator.handleBulkExport(
      sessionIds,
      this.sessions,
      bulkExportBtn,
      {
        onBulkExportComplete: () => {
          this.sessionListManager.clearSelection();
        }
      }
    );
  }

  /**
   * Handle bulk delete
   */
  private async handleBulkDelete(sessionIds: Set<string>): Promise<void> {
    const sessionIdsArray = Array.from(sessionIds);

    if (sessionIdsArray.length === 0) {
      return;
    }

    const confirmed = confirm(
      `Delete ${sessionIdsArray.length} session${sessionIdsArray.length > 1 ? 's' : ''}?\n\n` +
      `This will permanently delete the recordings, transcriptions, and notes.\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      // Delete each session
      for (const sessionId of sessionIdsArray) {
        try {
          const result = await window.scribeCat.session.delete(sessionId);
          if (result.success) {
            successCount++;
          } else {
            failCount++;
            logger.error(`Failed to delete session ${sessionId}`, result.error);
          }
        } catch (error) {
          failCount++;
          logger.error(`Error deleting session ${sessionId}`, error);
        }
      }

      // Show result
      if (failCount === 0) {
        logger.info(`Successfully deleted ${successCount} session(s)`);
      } else {
        alert(`Deleted ${successCount} session(s).\nFailed to delete ${failCount} session(s).`);
      }

      // Clear selection and refresh
      this.sessionListManager.clearSelection();
      await this.loadSessions();
      this.sessionListManager.render();

    } catch (error) {
      logger.error('Error during bulk delete', error);
      alert('An error occurred during bulk delete.');
    }
  }

  /**
   * Load sessions shared with the current user
   */
  private async loadSharedWithMeSessions(): Promise<void> {
    try {
      const result = await this.sessionSharingManager.getSharedWithMe();
      logger.info('🔍 getSharedWithMe result:', {
        success: result.success,
        hasData: !!result.sessions,
        sessionCount: result.sessions?.length || 0,
        firstShare: result.sessions?.[0]
      });

      if (result.success && result.sessions) {
        this.sharedWithMeSessions = result.sessions;
        logger.info(`Loaded ${this.sharedWithMeSessions.length} shared sessions`);

        // Extract session data from shares and merge with owned sessions
        // Transform database rows to Session entities (similar to SupabaseSessionRepository.rowToSession)
        const sharedSessionsData = this.sharedWithMeSessions
          .map((share: any) => {
            logger.info('🔍 Processing share:', {
              shareId: share.id,
              hasSessionsProperty: 'sessions' in share,
              sessionData: share.sessions
            });
            return share.sessions;
          })
          .filter((sessionData: any) => {
            const isValid = sessionData != null;
            if (!isValid) {
              logger.warn('⚠️ Filtered out null/undefined session data');
            }
            return isValid;
          })
          .map((row: any) => {
            // Create transcription if data exists (matching SupabaseSessionRepository logic)
            let transcription: Transcription | undefined;
            if (row.transcription_text) {
              // Create a single segment from the full text
              const segments = [{
                text: row.transcription_text,
                startTime: 0,
                endTime: row.duration / 1000, // Convert to seconds
                confidence: row.transcription_confidence
              }];

              transcription = new Transcription(
                row.transcription_text,
                segments,
                row.transcription_language || 'en',
                (row.transcription_provider as 'assemblyai' | 'simulation') || 'simulation',
                row.transcription_timestamp ? new Date(row.transcription_timestamp) : new Date(),
                row.transcription_confidence
              );
            }

            // Use cloud:// path for shared audio files
            const recordingPath = `cloud://${row.user_id}/${row.id}/audio.webm`;

            // Create Session entity matching the structure from SupabaseSessionRepository
            const session: any = {
              id: row.id,
              title: row.title || 'Untitled Session',
              recordingPath: recordingPath,
              notes: row.notes || '',
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at),
              duration: row.duration / 1000, // Convert milliseconds to seconds
              transcription: transcription,
              tags: row.tags || [],
              exportHistory: [], // Export history not stored in cloud
              courseId: row.course_id,
              courseTitle: row.course_title,
              courseNumber: row.course_number,
              // Cloud sync fields
              userId: row.user_id,
              cloudId: row.id,
              syncStatus: SyncStatus.SYNCED,
              lastSyncedAt: new Date(row.updated_at),
              // Mark as shared so we can show a badge
              isShared: true
            };

            return session;
          });

        // Merge with owned sessions and update both the main array and list manager
        const allSessions = [...this.sessions, ...sharedSessionsData];
        this.sessions = allSessions;
        this.sessionListManager.setSessions(allSessions);
        logger.info(`Total sessions (owned + shared): ${allSessions.length}`);
      } else {
        logger.warn('⚠️ No shared sessions data or unsuccessful result:', {
          success: result.success,
          error: result.error,
          sessionsLength: result.sessions?.length
        });
        this.sharedWithMeSessions = [];
      }
    } catch (error) {
      logger.error('❌ Error loading shared sessions:', error);
      this.sharedWithMeSessions = [];
    }
  }

  /**
   * Open share modal for a session
   */
  private openShareModal(sessionId: string): void {
    if (this.shareModal) {
      this.shareModal.open(sessionId);
    } else {
      logger.error('ShareModal not available');
      alert('Share feature is not available');
    }
  }

  /**
   * Check if study mode is active
   */
  public isStudyModeActive(): boolean {
    return this.isActive;
  }

  /**
   * Refresh session list
   */
  public async refresh(): Promise<void> {
    await this.loadSessions();
    if (this.isActive) {
      this.sessionListManager.render();
    }
  }

  /**
   * Show only shared sessions
   */
  private async showSharedSessionsOnly(): Promise<void> {
    // Load sessions first
    await this.loadSessions();

    // Filter to show only shared sessions
    const sharedOnly = this.sessions.filter((s: any) => s.isShared === true);

    logger.info(`Showing ${sharedOnly.length} shared sessions out of ${this.sessions.length} total`);

    // Show study mode
    this.recordModeView.classList.add('hidden');
    this.studyModeView.classList.remove('hidden');
    this.studyModeBtn.classList.add('active');

    // Update title to "Shared Sessions"
    const titleElement = this.studyModeView.querySelector('.study-mode-header h2');
    if (titleElement) {
      titleElement.textContent = '👥 Shared Sessions';
    }

    // Set filtered sessions
    this.sessionListManager.setSessions(sharedOnly);
    this.sessionListManager.populateCourseFilter();
    this.sessionListManager.render();

    this.isActive = true;
    logger.info('Study mode activated with shared sessions filter');
  }
}
