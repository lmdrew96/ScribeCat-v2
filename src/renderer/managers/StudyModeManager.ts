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
import { SessionDataLoader } from './study-mode/SessionDataLoader.js';
import { MultiSessionCoordinator } from './study-mode/MultiSessionCoordinator.js';
import { NotesEditCoordinator } from './study-mode/NotesEditCoordinator.js';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard.js';
import { createLogger } from '../../shared/logger.js';
import { config } from '../../config.js';

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
  private sessionDataLoader: SessionDataLoader;
  private multiSessionCoordinator: MultiSessionCoordinator;
  private notesEditCoordinator: NotesEditCoordinator;
  private analyticsDashboard: AnalyticsDashboard;

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
      this.sessionDetailContainer,
      this.sessionSharingManager,
      this.notesEditorManager
    );
    this.cloudSyncManager = new CloudSyncManager(this.authManager, this.syncNowBtn);
    this.sessionDataLoader = new SessionDataLoader(this.sessionSharingManager, this.dataTransformer);
    this.multiSessionCoordinator = new MultiSessionCoordinator(this.reorderModal);
    this.notesEditCoordinator = new NotesEditCoordinator(this.notesEditorManager);
    this.analyticsDashboard = new AnalyticsDashboard();

    this.initializeEventListeners();
    this.initializeAnalyticsModal();
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
    } catch (error) {
      logger.error('Failed to initialize StudyModeManager', error);
    }
  }

  /**
   * Set up auth state change listener to reload sessions when user logs in/out
   */
  private setupAuthListener(): void {
    this.authManager.onAuthStateChange((user) => {
      // Clear current sessions
      this.sessions = [];

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
        this.loadSessions(); // Phase3Integration will handle rendering
      }
    });
  }

  /**
   * Initialize analytics modal event listeners
   */
  private initializeAnalyticsModal(): void {
    const analyticsBtn = document.getElementById('analytics-btn') as HTMLButtonElement;
    const analyticsModal = document.getElementById('analytics-modal') as HTMLElement;
    const closeAnalyticsBtn = document.getElementById('close-analytics-btn') as HTMLButtonElement;
    const analyticsOverlay = analyticsModal?.querySelector('.analytics-modal-overlay') as HTMLElement;
    const dashboardContainer = document.getElementById('analytics-dashboard-container') as HTMLElement;

    if (!analyticsBtn || !analyticsModal || !closeAnalyticsBtn || !dashboardContainer) {
      logger.error('Analytics modal elements not found');
      return;
    }

    // Open analytics modal
    analyticsBtn.addEventListener('click', () => {
      // Update dashboard with current sessions
      this.analyticsDashboard.updateSessions(this.sessions);

      // Render dashboard
      dashboardContainer.innerHTML = this.analyticsDashboard.render();

      // Expose dashboard globally for CSV export
      (window as any).analyticsDashboard = this.analyticsDashboard;

      // Show modal
      analyticsModal.classList.remove('hidden');

      logger.info('Analytics modal opened');
    });

    // Close analytics modal
    const closeModal = () => {
      analyticsModal.classList.add('hidden');
      logger.info('Analytics modal closed');
    };

    closeAnalyticsBtn.addEventListener('click', closeModal);
    analyticsOverlay.addEventListener('click', closeModal);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !analyticsModal.classList.contains('hidden')) {
        closeModal();
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
        { element: this.syncNowBtn, handler: () => this.cloudSyncManager.handleSyncNow(async () => await this.refresh()) }
      ],

      // Document-level custom events
      documentEvents: [
        { eventName: 'openSharedSessions', handler: () => this.show(true) }
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
        { element: this.sessionDetailContainer, eventName: 'retranscribeSession', handler: (detail) => this.retranscribeSession(detail.sessionId) },
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
    this.sessions = await this.sessionDataLoader.loadAllSessions();
    this.sessionListManager.setSessions(this.sessions);

    // Notify Phase 3 integration about updated sessions
    if (window.phase3Integration) {
      window.phase3Integration.updateSessions(this.sessions);
    }
  }

  /**
   * Show study mode view
   */
  public async show(filterSharedOnly: boolean = false): Promise<void> {
    // Reload sessions to get latest data
    await this.loadSessions();

    // Filter if needed
    const sessionsToShow = filterSharedOnly
      ? this.dataTransformer.filterSharedOnly(this.sessions)
      : this.sessions;

    // Update Phase3Integration with filtered sessions
    if (window.phase3Integration) {
      window.phase3Integration.updateSessions(sessionsToShow);
    }

    // Hide record mode, show study mode
    this.recordModeView.classList.add('hidden');
    this.studyModeView.classList.remove('hidden');
    this.studyModeBtn.classList.add('active');

    // Update title
    const titleElement = this.studyModeView.querySelector('.study-mode-header h2');
    if (titleElement) {
      titleElement.textContent = filterSharedOnly ? '👥 Shared Sessions' : '📚 Study Mode';
    }

    // Populate course filter (still needed for legacy UI)
    this.sessionListManager.setSessions(sessionsToShow);
    this.sessionListManager.populateCourseFilter();
    // Note: Rendering is now handled by Phase3Integration, not the old session list manager

    this.isActive = true;
    logger.info(filterSharedOnly ? 'Study mode activated with shared sessions filter' : 'Study mode activated');
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
      // Trigger Phase3 re-render with updated sessions
      if (window.phase3Integration) {
        window.phase3Integration.updateSessions(this.sessions);
      }
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
      const isEditable = this.sessionNavigationManager.isSessionEditable(session);
      this.detailViewManager.render(session, isEditable);

      // Trigger Phase3 re-render with updated sessions
      if (window.phase3Integration) {
        window.phase3Integration.updateSessions(this.sessions);
      }
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
      const isEditable = this.sessionNavigationManager.isSessionEditable(session);
      this.detailViewManager.render(session, isEditable);

      // Trigger Phase3 re-render with updated sessions
      if (window.phase3Integration) {
        window.phase3Integration.updateSessions(this.sessions);
      }
    });
  }

  /**
   * Start editing notes
   */
  private startNotesEdit(sessionId: string): void {
    this.notesEditCoordinator.startNotesEdit(this.sessions.find(s => s.id === sessionId));
  }

  /**
   * Save edited notes
   */
  private async saveNotesEdit(sessionId: string): Promise<void> {
    await this.notesEditCoordinator.saveNotesEdit(this.sessions.find(s => s.id === sessionId));
  }

  /**
   * Cancel notes editing
   */
  private cancelNotesEdit(): void {
    const sessionId = this.notesEditorManager.getCurrentEditingSessionId();
    this.notesEditCoordinator.cancelNotesEdit(sessionId ? this.sessions.find(s => s.id === sessionId) : undefined);
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
      // If in detail view, navigate back to list first
      const inDetailView = !this.sessionDetailContainer.classList.contains('hidden');
      if (inDetailView) {
        this.sessionNavigationManager.backToSessionList();
      }

      // Reload sessions first (this triggers rendering)
      await this.loadSessions(); // Phase3Integration will handle rendering

      // Clear selections AFTER rendering to ensure proper cleanup
      this.sessionListManager.clearSelection();
      if (window.phase3Integration) {
        window.phase3Integration.getBulkSelectionManager()?.clearSelection();
      }
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

    await this.sessionDeletionManager.leaveSession(
      session,
      this.sessionDataLoader.getSharedWithMeSessions(),
      async () => {
        // If in detail view, navigate back to list first
        const inDetailView = !this.sessionDetailContainer.classList.contains('hidden');
        if (inDetailView) {
          this.sessionNavigationManager.backToSessionList();
        }

        // Reload sessions first (this triggers rendering)
        await this.loadSessions(); // Phase3Integration will handle rendering

        // Clear selections AFTER rendering to ensure proper cleanup
        this.sessionListManager.clearSelection();
        if (window.phase3Integration) {
          window.phase3Integration.getBulkSelectionManager()?.clearSelection();
        }
      }
    );
  }

  /**
   * Re-transcribe a session with AssemblyAI
   */
  private async retranscribeSession(sessionId: string): Promise<void> {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) {
      logger.error('Session not found', sessionId);
      return;
    }

    if (!session.recordingPath) {
      alert('No recording file found for this session. Cannot re-transcribe.');
      return;
    }

    // Confirm with user
    const confirmed = confirm(
      'Re-transcribe this session?\n\n' +
      'This will send the audio file to AssemblyAI for transcription and replace the existing transcription. ' +
      'This may take a few minutes depending on the length of the recording.'
    );

    if (!confirmed) return;

    // Get AssemblyAI API key from config (.env file)
    const assemblyaiKey = config.assemblyai.apiKey;
    if (!assemblyaiKey) {
      alert('AssemblyAI API key not configured. Please add ASSEMBLYAI_API_KEY to your .env file.');
      return;
    }

    try {
      // Show loading indicator
      const retranscribeBtn = document.querySelector('.retranscribe-session-btn') as HTMLButtonElement;
      if (retranscribeBtn) {
        retranscribeBtn.disabled = true;
        retranscribeBtn.innerHTML = '<span class="action-icon">⏳</span><span class="action-label">Transcribing...</span>';
      }

      logger.info(`Starting re-transcription for session: ${sessionId}`);

      // Get the recording file path (handle both local and cloud paths)
      let audioFilePath = session.recordingPath;

      // If it's a cloud path, we need to download it first
      if (audioFilePath.startsWith('cloud://')) {
        alert('Cloud recordings are not yet supported for re-transcription. Please use a local recording.');
        throw new Error('Cloud recordings not supported');
      }

      // Remove file:// prefix if present
      if (audioFilePath.startsWith('file://')) {
        audioFilePath = audioFilePath.substring(7);
      }

      // Call the batch transcription API
      const result = await (window as any).scribeCat.transcription.assemblyai.batchTranscribe(
        assemblyaiKey,
        audioFilePath
      );

      if (!result.success) {
        throw new Error(result.error || 'Transcription failed');
      }

      logger.info('Transcription completed successfully');

      // Update the session with new transcription
      const transcriptionData = result.transcription;

      // Format timestamped entries from AssemblyAI words
      const timestampedEntries = transcriptionData.words?.map((word: any) => ({
        startTime: word.start / 1000, // Convert ms to seconds
        endTime: word.end / 1000,
        text: word.text
      })) || [];

      // Update session transcription
      await (window as any).scribeCat.session.updateTranscription(
        sessionId,
        transcriptionData.text,
        'assemblyai',
        timestampedEntries
      );

      // Reload sessions to get updated data
      await this.loadSessions();

      // Refresh the detail view if we're still on this session
      const inDetailView = !this.sessionDetailContainer.classList.contains('hidden');
      if (inDetailView) {
        const updatedSession = this.sessions.find(s => s.id === sessionId);
        if (updatedSession) {
          await this.detailViewManager.render(updatedSession, true);
        }
      }

      // Restore button
      if (retranscribeBtn) {
        retranscribeBtn.disabled = false;
        retranscribeBtn.innerHTML = '<span class="action-icon">🔄</span><span class="action-label">Re-transcribe</span>';
      }

      alert('Transcription completed successfully!');

    } catch (error) {
      logger.error('Failed to re-transcribe session', error);
      alert(`Failed to re-transcribe session: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Restore button
      const retranscribeBtn = document.querySelector('.retranscribe-session-btn') as HTMLButtonElement;
      if (retranscribeBtn) {
        retranscribeBtn.disabled = false;
        retranscribeBtn.innerHTML = '<span class="action-icon">🔄</span><span class="action-label">Re-transcribe</span>';
      }
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
    await this.sessionDeletionManager.handleBulkDelete(sessionIds, async () => {
      // Clear selection and refresh after bulk deletion
      this.sessionListManager.clearSelection();
      await this.loadSessions(); // Phase3Integration will handle rendering
    });
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
    this.multiSessionCoordinator.handleOpenReorderModal(sessions, (sessionIds, title) => {
      this.createMultiSessionStudySet(sessionIds, title);
    });
  }

  /**
   * Create a multi-session study set
   */
  private async createMultiSessionStudySet(sessionIds: string[], title: string): Promise<void> {
    await this.multiSessionCoordinator.createMultiSessionStudySet(sessionIds, title, async (newSessionId) => {
      // Refresh the session list to show the new study set
      await this.loadSessions(); // Phase3Integration will handle rendering

      // Clear selection after creating study set
      this.sessionListManager.clearSelection();

      // Optionally, open the newly created study set
      await this.openSessionDetail(newSessionId);
    });
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
    // Note: Phase3Integration handles rendering via updateSessions() call in loadSessions()
  }

}
