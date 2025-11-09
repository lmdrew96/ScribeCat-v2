/**
 * StudyModeManager (Refactored)
 *
 * Coordinates the Study Mode view for reviewing past recording sessions.
 * Delegates functionality to specialized managers for better separation of concerns.
 */

import { Session } from '../../domain/entities/Session.js';
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
import { StudyModeEventCoordinator } from './study-mode/StudyModeEventCoordinator.js';
import { StudyModeDataTransformer } from './study-mode/StudyModeDataTransformer.js';
import { SessionReorderModal } from './study-mode/SessionReorderModal.js';
import { SessionEditingManager } from './study-mode/SessionEditingManager.js';
import { SessionDeletionManager } from './study-mode/SessionDeletionManager.js';
import { SessionNavigationManager } from './study-mode/SessionNavigationManager.js';
import { CloudSyncManager } from './study-mode/CloudSyncManager.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('StudyModeManager');

export class StudyModeManager {
  // Core managers
  private sessionListManager: StudyModeSessionListManager;
  private detailViewManager: StudyModeDetailViewManager;
  private notesEditorManager: StudyModeNotesEditorManager;
  private aiToolsManager: StudyModeAIToolsManager;
  private eventCoordinator: StudyModeEventCoordinator;
  private dataTransformer: StudyModeDataTransformer;
  private reorderModal: SessionReorderModal;
  private sessionEditingManager: SessionEditingManager;
  private sessionDeletionManager: SessionDeletionManager;
  private sessionNavigationManager: SessionNavigationManager;
  private cloudSyncManager: CloudSyncManager;

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
  private syncNowBtn: HTMLButtonElement;
  private sessionListContainer: HTMLElement;
  private sessionDetailContainer: HTMLElement;

  constructor(authManager: AuthManager) {
    // Get UI elements
    this.studyModeView = document.getElementById('study-mode-view') as HTMLElement;
    this.recordModeView = document.querySelector('.main-content') as HTMLElement;
    this.studyModeBtn = document.getElementById('study-mode-btn') as HTMLButtonElement;
    this.backToRecordBtn = document.getElementById('back-to-record-btn') as HTMLButtonElement;
    this.syncNowBtn = document.getElementById('sync-now-btn') as HTMLButtonElement;
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
    this.eventCoordinator = new StudyModeEventCoordinator();
    this.dataTransformer = new StudyModeDataTransformer();
    this.reorderModal = new SessionReorderModal();
    this.sessionEditingManager = new SessionEditingManager();
    this.sessionDeletionManager = new SessionDeletionManager(this.sessionSharingManager);
    this.sessionNavigationManager = new SessionNavigationManager(
      this.authManager,
      this.detailViewManager,
      this.aiToolsManager,
      this.sessionListContainer,
      this.sessionDetailContainer
    );
    this.cloudSyncManager = new CloudSyncManager(this.authManager, this.syncNowBtn);

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
   * Initialize event listeners using EventCoordinator
   */
  private initializeEventListeners(): void {
    this.eventCoordinator.setup({
      // Button click events
      buttons: [
        { element: this.studyModeBtn, handler: () => this.show() },
        { element: this.backToRecordBtn, handler: () => this.hide() },
        { element: this.syncNowBtn, handler: () => this.handleSyncNow() }
      ],

      // Document-level custom events
      documentEvents: [
        { eventName: 'openSharedSessions', handler: () => this.showSharedSessionsOnly() }
      ],

      // Session list custom events
      customEvents: [
        { element: this.sessionListContainer, eventName: 'hideStudyMode', handler: () => this.hide() },
        { element: this.sessionListContainer, eventName: 'openSessionDetail', handler: (detail) => this.openSessionDetail(detail.sessionId) },
        { element: this.sessionListContainer, eventName: 'exportSession', handler: (detail) => this.exportSession(detail.sessionId) },
        { element: this.sessionListContainer, eventName: 'deleteSession', handler: (detail) => this.deleteSession(detail.sessionId) },
        { element: this.sessionListContainer, eventName: 'leaveSession', handler: (detail) => this.leaveSession(detail.sessionId) },
        { element: this.sessionListContainer, eventName: 'startTitleEdit', handler: (detail) => this.startTitleEdit(detail.sessionId) },
        { element: this.sessionListContainer, eventName: 'shareSession', handler: (detail) => this.openShareModal(detail.sessionId) },
        { element: this.sessionListContainer, eventName: 'openReorderModal', handler: (detail) => this.handleOpenReorderModal(detail.sessions) },
        // Detail view custom events
        { element: this.sessionDetailContainer, eventName: 'backToList', handler: () => this.backToSessionList() },
        { element: this.sessionDetailContainer, eventName: 'exportSession', handler: (detail) => this.exportSession(detail.sessionId) },
        { element: this.sessionDetailContainer, eventName: 'deleteSession', handler: (detail) => this.deleteSession(detail.sessionId) },
        { element: this.sessionDetailContainer, eventName: 'startTitleEdit', handler: (detail) => this.startDetailTitleEdit(detail.sessionId) },
        { element: this.sessionDetailContainer, eventName: 'startCourseEdit', handler: (detail) => this.startCourseEdit(detail.sessionId) },
        { element: this.sessionDetailContainer, eventName: 'shareSession', handler: (detail) => this.openShareModal(detail.sessionId) },
        // Notes editing custom events
        { element: this.sessionDetailContainer, eventName: 'startNotesEdit', handler: (detail) => this.startNotesEdit(detail.sessionId) },
        { element: this.sessionDetailContainer, eventName: 'saveNotesEdit', handler: (detail) => this.saveNotesEdit(detail.sessionId) },
        { element: this.sessionDetailContainer, eventName: 'cancelNotesEdit', handler: () => this.cancelNotesEdit() }
      ],

      // Callback-based events
      callbacks: [
        { register: (handler) => this.sessionListManager.onBulkExport(handler), handler: (sessionIds) => this.handleBulkExport(sessionIds) },
        { register: (handler) => this.sessionListManager.onBulkDelete(handler), handler: (sessionIds) => this.handleBulkDelete(sessionIds) }
      ]
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

        // Convert JSON data to Session instances with methods
        this.sessions = sessionsData.map((data: any) => Session.fromJSON(data));

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
    await this.sessionNavigationManager.openSessionDetail(session, this.sessions, async () => {
      // Reload sessions to remove stale entries
      await this.loadSessions();
    });
  }

  /**
   * Check if a session is editable by the current user
   */
  private isSessionEditable(session: Session): boolean {
    return this.sessionNavigationManager.isSessionEditable(session);
  }

  /**
   * Back to session list
   */
  private backToSessionList(): void {
    this.sessionNavigationManager.backToSessionList();
  }

  /**
   * Start editing a session title (list view)
   */
  private startTitleEdit(sessionId: string): void {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    this.sessionEditingManager.startTitleEdit(session, 'list', () => {
      this.sessionListManager.render();
    });
  }

  /**
   * Start editing title in detail view
   */
  private startDetailTitleEdit(sessionId: string): void {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    this.sessionEditingManager.startTitleEdit(session, 'detail', () => {
      // Re-render both detail view and session list
      const isEditable = this.isSessionEditable(session);
      this.detailViewManager.render(session, isEditable);
      this.sessionListManager.render();
    });
  }

  /**
   * Start course editing for detail view
   */
  private async startCourseEdit(sessionId: string): Promise<void> {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    await this.sessionEditingManager.startCourseEdit(session, () => {
      // Re-render both detail view and session list
      const isEditable = this.isSessionEditable(session);
      this.detailViewManager.render(session, isEditable);
      this.sessionListManager.render();
    });
  }

  /**
   * Start editing notes
   */
  private startNotesEdit(sessionId: string): void {
    const session = this.sessions.find(s => s.id === sessionId);
    if (session) {
      this.notesEditorManager.startNotesEdit(sessionId, session.notes || '');
    }
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

    await this.sessionDeletionManager.deleteSession(session, async () => {
      // Refresh the session list after deletion
      await this.loadSessions();
      this.sessionListManager.render();
    });
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

    await this.sessionDeletionManager.leaveSession(session, this.sharedWithMeSessions, async () => {
      // Refresh the session list after leaving
      await this.loadSessions();
      this.sessionListManager.render();
    });
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
    await this.sessionDeletionManager.handleBulkDelete(sessionIds, async () => {
      // Clear selection and refresh after bulk deletion
      this.sessionListManager.clearSelection();
      await this.loadSessions();
      this.sessionListManager.render();
    });
  }

  /**
   * Load sessions shared with the current user
   */
  private async loadSharedWithMeSessions(): Promise<void> {
    try {
      const result = await this.sessionSharingManager.getSharedWithMe();
      logger.info('getSharedWithMe result:', {
        success: result.success,
        hasData: !!result.sessions,
        sessionCount: result.sessions?.length || 0,
        firstShare: result.sessions?.[0]
      });

      if (result.success && result.sessions) {
        this.sharedWithMeSessions = result.sessions;
        logger.info(`Loaded ${this.sharedWithMeSessions.length} shared sessions`);

        // Transform shared session data using DataTransformer
        const sharedSessionsData = this.dataTransformer.transformSharedSessions(this.sharedWithMeSessions);

        // Merge with owned sessions
        const allSessions = this.dataTransformer.mergeSessions(this.sessions, sharedSessionsData);
        this.sessions = allSessions;
        this.sessionListManager.setSessions(allSessions);
      } else {
        logger.warn('No shared sessions data or unsuccessful result:', {
          success: result.success,
          error: result.error,
          sessionsLength: result.sessions?.length
        });
        this.sharedWithMeSessions = [];
      }
    } catch (error) {
      logger.error('Error loading shared sessions:', error);
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
   * Handle opening the reorder modal for creating a multi-session study set
   */
  private handleOpenReorderModal(sessions: Session[]): void {
    this.reorderModal.show(sessions, (orderedSessionIds, title) => {
      this.createMultiSessionStudySet(orderedSessionIds, title);
    });
  }

  /**
   * Create a multi-session study set
   */
  private async createMultiSessionStudySet(sessionIds: string[], title: string): Promise<void> {
    try {
      logger.info('Creating multi-session study set', { sessionIds, title });

      // Call IPC to create the study set
      const result = await (window as any).scribeCat.session.createMultiSessionStudySet(sessionIds, title);

      if (result.success) {
        logger.info('Multi-session study set created successfully', result.session);

        // Refresh the session list to show the new study set
        await this.loadSessions();
        this.sessionListManager.render();

        // Show success notification
        alert(`Study set "${title}" created successfully! 📚`);

        // Optionally, open the newly created study set
        if (result.session?.id) {
          await this.openSessionDetail(result.session.id);
        }
      } else {
        const errorMsg = (result as any).error || 'Unknown error';
        logger.error('Failed to create multi-session study set:', errorMsg);
        alert(`Failed to create study set: ${errorMsg}`);
      }
    } catch (error) {
      logger.error('Error creating multi-session study set', error);
      alert('An error occurred while creating the study set.');
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
   * Handle sync now button click
   */
  private async handleSyncNow(): Promise<void> {
    await this.cloudSyncManager.handleSyncNow(async () => {
      await this.refresh();
    });
  }

  /**
   * Show only shared sessions
   */
  private async showSharedSessionsOnly(): Promise<void> {
    // Load sessions first
    await this.loadSessions();

    // Filter to show only shared sessions using DataTransformer
    const sharedOnly = this.dataTransformer.filterSharedOnly(this.sessions);

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
