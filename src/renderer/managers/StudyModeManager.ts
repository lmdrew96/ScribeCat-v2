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
import { StudyModeRetranscriber } from './study-mode/StudyModeRetranscriber.js';
import { StudyModeAdvancedFeatures, type ViewComponents } from './study-mode/StudyModeAdvancedFeatures.js';
import { StudyModeViewRenderer } from './study-mode/StudyModeViewRenderer.js';
import { StudyModeAnalyticsModal } from './study-mode/StudyModeAnalyticsModal.js';
import { StudyModeKeyboardConfig } from './study-mode/StudyModeKeyboardConfig.js';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard.js';
import { SearchManager } from './SearchManager.js';
import { ViewModeManager, type ViewMode } from './ViewModeManager.js';
import { FilterSortManager } from './study-mode/FilterSortManager.js';
import { BulkSelectionManager } from './study-mode/BulkSelectionManager.js';
import { KeyboardShortcutHandler } from './KeyboardShortcutHandler.js';
import { KeyboardShortcutsOverlay } from '../components/KeyboardShortcutsOverlay.js';
import { QuickActionsMenu } from '../components/QuickActionsMenu.js';
import { StudySetTitleModal } from '../components/StudySetTitleModal.js';
import { createLogger } from '../../shared/logger.js';
import { getIconHTML } from '../utils/iconMap.js';

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

  // Advanced search and view managers
  private searchManager: SearchManager;
  private viewModeManager: ViewModeManager;
  private filterSortManager: FilterSortManager;
  private bulkSelectionManager: BulkSelectionManager;
  private keyboardShortcutHandler: KeyboardShortcutHandler;

  // Extracted modules
  private retranscriber: StudyModeRetranscriber;
  private advancedFeatures: StudyModeAdvancedFeatures;
  private viewRenderer: StudyModeViewRenderer;
  private analyticsModal: StudyModeAnalyticsModal;

  // UI components
  private keyboardShortcuts: KeyboardShortcutsOverlay;
  private quickActions: QuickActionsMenu;
  private studySetTitleModal: StudySetTitleModal;

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

    // Initialize advanced search and view managers
    this.searchManager = new SearchManager();
    this.viewModeManager = new ViewModeManager('session-list');
    this.filterSortManager = new FilterSortManager();
    this.bulkSelectionManager = new BulkSelectionManager();

    // Initialize UI components
    this.keyboardShortcuts = new KeyboardShortcutsOverlay();
    this.quickActions = new QuickActionsMenu();
    this.studySetTitleModal = new StudySetTitleModal();

    // Initialize extracted modules
    this.retranscriber = new StudyModeRetranscriber();
    this.viewRenderer = new StudyModeViewRenderer(
      this.viewModeManager,
      this.filterSortManager,
      this.bulkSelectionManager
    );
    this.analyticsModal = new StudyModeAnalyticsModal(
      this.analyticsDashboard,
      () => this.sessions
    );
    this.keyboardShortcutHandler = StudyModeKeyboardConfig.create(
      this.viewModeManager,
      this.bulkSelectionManager,
      { onBulkDelete: (ids) => this.handleBulkDelete(ids) }
    );
    this.advancedFeatures = new StudyModeAdvancedFeatures({
      searchManager: this.searchManager,
      viewModeManager: this.viewModeManager,
      filterSortManager: this.filterSortManager,
      bulkSelectionManager: this.bulkSelectionManager,
      keyboardShortcutHandler: this.keyboardShortcutHandler,
      keyboardShortcuts: this.keyboardShortcuts,
      quickActions: this.quickActions,
      onSessionSelect: (session) => this.handleSessionClick(session),
      onBulkExport: (sessionIds) => this.handleBulkExport(sessionIds),
      onBulkDelete: (sessionIds) => this.handleBulkDelete(sessionIds),
      onCreateStudySet: () => {
        const sessionIds = Array.from(this.bulkSelectionManager.getSelectedSessionIds());
        if (sessionIds.length >= 2) {
          this.studySetTitleModal.show(sessionIds, (title) => {
            this.createMultiSessionStudySet(sessionIds, title);
          });
        }
      },
      onShowSessionDetail: (sessionId) => this.showSessionDetail(sessionId),
      onShareSession: (sessionId) => this.shareSession(sessionId),
      onDeleteSession: (sessionId) => this.deleteSession(sessionId)
    });

    this.initializeEventListeners();
    this.analyticsModal.initialize();
    this.setupAuthListener();
  }

  /**
   * Initialize the study mode manager
   */
  async initialize(): Promise<void> {
    try {
      // Initialize ShareModal
      this.shareModal.initialize();

      // Initialize advanced search and view features
      await this.initializeAdvancedFeatures();

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
   * Initialize advanced search and view features
   */
  private async initializeAdvancedFeatures(): Promise<void> {
    const viewComponents = await this.advancedFeatures.initialize();
    this.viewRenderer.setViewComponents(viewComponents);
    this.advancedFeatures.setupBulkSelectionCallbacks();
    this.setupAdvancedFeatureListeners();
  }

  /**
   * Set up event listeners for advanced features
   */
  private setupAdvancedFeatureListeners(): void {
    // Search results change
    this.searchManager.onResults((results) => {
      logger.info(`Search returned ${results.length} results`);
      const sessions = this.searchManager.getResultSessions();
      this.renderCurrentView(sessions);
    });

    // View mode change
    this.viewModeManager.onChange((mode: ViewMode) => {
      logger.info(`View mode changed to: ${mode}`);
      const sessions = this.getCurrentSessions();
      this.renderCurrentView(sessions);
    });

    // Filter change
    this.filterSortManager.onFilter((filter) => {
      logger.info('Filter changed, applying to search');
      this.searchManager.setFilter(filter);

      const searchState = this.searchManager.getState();
      if (!searchState.query.trim()) {
        const sessions = this.getCurrentSessions();
        this.renderCurrentView(sessions);
      }
    });

    // Sort change
    this.filterSortManager.onSort((sort) => {
      logger.info(`Sort changed to: ${sort}`);
      const sessions = this.getCurrentSessions();
      this.renderCurrentView(sessions);
    });
  }

  /**
   * Update sessions (called when sessions are loaded/updated)
   */
  private updateSessions(sessions: Session[]): void {
    logger.info(`Updating with ${sessions.length} sessions`);

    // Store sessions internally (already done by loadSessions)
    this.sessions = sessions;

    // Update search manager
    this.searchManager.setSessions(sessions);

    // Always render when sessions are updated (search will be maintained if active)
    const searchState = this.searchManager.getState();
    const isSearching = this.searchManager.isSearching();
    logger.info(`Search state: isSearching=${isSearching}, query="${searchState.query}"`);

    if (isSearching || searchState.query.trim().length > 0) {
      // If search is active, render search results
      const searchResults = this.searchManager.getResultSessions();
      logger.info(`Rendering search results: ${searchResults.length} sessions`);
      this.renderCurrentView(searchResults);
    } else {
      // No search active, render all sessions
      this.renderCurrentView(sessions);
    }

    // Clean up orphaned selections (sessions that were selected but no longer exist)
    this.cleanupOrphanedSelections(sessions);
  }

  /**
   * Refresh current view with existing sessions
   */
  private refreshCurrentView(): void {
    const sessions = this.getCurrentSessions();
    this.renderCurrentView(sessions);
    logger.info('Refreshed current view');
  }

  /**
   * Clean up orphaned selections (selected sessions that no longer exist)
   */
  private cleanupOrphanedSelections(sessions: Session[]): void {
    const selectedIds = this.bulkSelectionManager.getSelectedSessionIds();
    const sessionIds = new Set(sessions.map(s => s.id));

    // Remove any selected IDs that don't exist in current sessions
    selectedIds.forEach(id => {
      if (!sessionIds.has(id)) {
        logger.info(`Removing orphaned selection: ${id}`);
        this.bulkSelectionManager.handleSessionSelection(id, false);
      }
    });
  }

  /**
   * Get current sessions (search results or all)
   */
  private getCurrentSessions(): Session[] {
    const searchState = this.searchManager.getState();

    if (searchState.query.trim().length > 0 || !searchState.filter.isEmpty()) {
      return this.searchManager.getResultSessions();
    }

    // Return all sessions when no search is active
    return this.sessions;
  }

  /**
   * Render current view mode
   */
  private renderCurrentView(sessions: Session[]): void {
    this.viewRenderer.render(sessions);
  }

  /**
   * Handle session click
   */
  private handleSessionClick(session: Session): void {
    logger.info(`Session clicked: ${session.id}`);

    // Trigger openSessionDetail event on session list container
    const sessionListContainer = document.getElementById('session-list');
    if (sessionListContainer) {
      const event = new CustomEvent('openSessionDetail', {
        detail: { sessionId: session.id }
      });
      sessionListContainer.dispatchEvent(event);
    }
  }

  /**
   * Get the bulk selection manager instance
   */
  getBulkSelectionManager(): BulkSelectionManager {
    return this.bulkSelectionManager;
  }

  /**
   * Get search manager (for external access)
   */
  getSearchManager(): SearchManager {
    return this.searchManager;
  }

  /**
   * Get view mode manager (for external access)
   */
  getViewModeManager(): ViewModeManager {
    return this.viewModeManager;
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
      // NOTE: Bulk action callbacks removed - now handled by BulkSelectionManager (lines 454-460)
      // This fixes the bug where select-all + deselect would delete all sessions
      callbacks: []
    });
  }

  /**
   * Load all sessions from storage
   */
  private async loadSessions(): Promise<void> {
    this.sessions = await this.sessionDataLoader.loadAllSessions();
    this.sessionListManager.setSessions(this.sessions);

    // Update advanced features with sessions
    this.updateSessions(this.sessions);
  }

  /**
   * Show study mode view
   */
  public async show(filterSharedOnly: boolean = false): Promise<void> {
    // Guard: Don't show study mode if user is currently in a study room
    const studyRoomView = document.getElementById('study-room-view');
    if (studyRoomView && !studyRoomView.classList.contains('hidden')) {
      logger.warn('Cannot show study mode while in a study room');
      return;
    }

    // Reload sessions to get latest data
    await this.loadSessions();

    // Filter if needed
    const sessionsToShow = filterSharedOnly
      ? this.dataTransformer.filterSharedOnly(this.sessions)
      : this.sessions;

    // Update advanced features with filtered sessions
    this.updateSessions(sessionsToShow);

    // Hide record mode, show study mode
    this.recordModeView.classList.add('hidden');
    this.studyModeView.classList.remove('hidden');
    this.studyModeBtn.classList.add('active');

    // Update title
    const titleElement = this.studyModeView.querySelector('.study-mode-header h2');
    if (titleElement) {
      titleElement.innerHTML = filterSharedOnly ? `${getIconHTML('users', { size: 20 })} Shared Sessions` : `${getIconHTML('library', { size: 20 })} Study Mode`;
    }

    // Populate course filter (still needed for legacy UI)
    this.sessionListManager.setSessions(sessionsToShow);
    this.sessionListManager.populateCourseFilter();

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

    // Refresh view to ensure it's not stale (user manually navigated back)
    this.refreshCurrentView();
  }

  /**
   * Start editing a session title (list view)
   */
  private startTitleEdit(sessionId: string): void {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    this.sessionEditingManager.startTitleEdit(session, 'list', () => {
      // Trigger re-render with updated sessions
      this.updateSessions(this.sessions);
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

      // Trigger re-render with updated sessions
      this.updateSessions(this.sessions);
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

      // Trigger re-render with updated sessions
      this.updateSessions(this.sessions);
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

      // Reload sessions (automatically renders with fresh data)
      await this.loadSessions();

      // Clear selections AFTER rendering to ensure proper cleanup
      this.bulkSelectionManager.clearSelection();
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

        // Reload sessions (automatically renders with fresh data)
        await this.loadSessions();

        // Clear selections AFTER rendering to ensure proper cleanup
        this.bulkSelectionManager.clearSelection();
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

    await this.retranscriber.retranscribe(
      session,
      async () => {
        await this.loadSessions();
      },
      async (sess) => {
        // Re-render detail view if visible
        const inDetailView = !this.sessionDetailContainer.classList.contains('hidden');
        if (inDetailView) {
          const updatedSession = this.sessions.find(s => s.id === sess.id);
          if (updatedSession) {
            await this.detailViewManager.render(updatedSession, true);
          }
        }
      }
    );
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
          this.bulkSelectionManager.clearSelection();
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
      this.bulkSelectionManager.clearSelection();
      await this.loadSessions(); // Automatically renders with fresh data
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
      this.bulkSelectionManager.clearSelection();

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
  }

  /**
   * Public method to show session detail (used by QuickActions and other components)
   */
  public async showSessionDetail(sessionId: string): Promise<void> {
    await this.openSessionDetail(sessionId);
  }

  /**
   * Public method to share a session (used by QuickActions and other components)
   */
  public shareSession(sessionId: string): void {
    this.openShareModal(sessionId);
  }

}
