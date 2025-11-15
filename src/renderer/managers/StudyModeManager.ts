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
import { SearchManager } from './SearchManager.js';
import { ViewModeManager, type ViewMode } from './ViewModeManager.js';
import { FilterSortManager } from './study-mode/FilterSortManager.js';
import { BulkSelectionManager } from './study-mode/BulkSelectionManager.js';
import { KeyboardShortcutHandler } from './KeyboardShortcutHandler.js';
import { SearchBar } from '../components/SearchBar.js';
import { TimelineView } from '../components/views/TimelineView.js';
import { GridView } from '../components/views/GridView.js';
import { ListView } from '../components/views/ListView.js';
import { BoardView } from '../components/views/BoardView.js';
import { KeyboardShortcutsOverlay } from '../components/KeyboardShortcutsOverlay.js';
import { QuickActionsMenu, type QuickAction } from '../components/QuickActionsMenu.js';
import { StudySetTitleModal } from '../components/StudySetTitleModal.js';
import { createLogger } from '../../shared/logger.js';
import { config } from '../../config.js';
import { SupabaseStorageService } from '../../infrastructure/services/supabase/SupabaseStorageService.js';

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
  private searchBar: SearchBar | null = null;
  private checkboxListenerAdded: boolean = false;

  // View components
  private timelineView: TimelineView | null = null;
  private gridView: GridView | null = null;
  private listView: ListView | null = null;
  private boardView: BoardView | null = null;

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
    this.keyboardShortcutHandler = this.createKeyboardShortcutHandler();

    // Initialize UI components
    this.keyboardShortcuts = new KeyboardShortcutsOverlay();
    this.quickActions = new QuickActionsMenu();
    this.studySetTitleModal = new StudySetTitleModal();

    this.initializeEventListeners();
    this.initializeAnalyticsModal();
    this.setupAuthListener();
  }

  /**
   * Create keyboard shortcut handler with callbacks
   */
  private createKeyboardShortcutHandler(): KeyboardShortcutHandler {
    return new KeyboardShortcutHandler({
      onViewModeChange: (mode) => {
        this.viewModeManager.setMode(mode);
      },
      onFocusSearch: () => {
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        searchInput?.focus();
      },
      onNewRecording: () => {
        // Return to recording view
        (window as any).viewManager?.show('recording');
      },
      onSaveNotes: async () => {
        // Save notes in current editor immediately
        const notesAutoSaveManager = (window as any).notesAutoSaveManager;

        if (notesAutoSaveManager) {
          await notesAutoSaveManager.saveImmediately();
          // Note: saveImmediately() shows its own indicator, no toast needed
        }
      },
      onDeleteSelected: () => {
        // Delete selected sessions if any
        const selectedIds = this.bulkSelectionManager.getSelectedSessionIds();
        if (selectedIds.size > 0) {
          this.handleBulkDelete(selectedIds);
        }
      },
      onToggleRecording: () => {
        // Toggle recording
        const recordingManager = (window as any).recordingManager;
        if (recordingManager) {
          if (recordingManager.isRecording) {
            recordingManager.stopRecording();
          } else {
            recordingManager.startRecording();
          }
        }
      },
      onTogglePause: () => {
        // Toggle pause
        const recordingManager = (window as any).recordingManager;
        if (recordingManager && recordingManager.isRecording) {
          if (recordingManager.isPaused) {
            recordingManager.resumeRecording();
          } else {
            recordingManager.pauseRecording();
          }
        }
      }
    });
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
    logger.info('Initializing advanced search and view features...');

    try {
      // 1. Initialize SearchBar
      this.initializeSearchBar();

      // 2. Initialize FilterSortManager UI
      this.initializeFilterSortControls();

      // 3. Initialize ViewModeManager UI
      this.initializeViewModeSwitcher();

      // 4. Initialize view components
      this.initializeViews();

      // 4. Initialize keyboard shortcuts
      this.initializeKeyboardShortcuts();

      // 5. Initialize quick actions menu
      this.initializeQuickActions();

      // 6. Set up event listeners
      this.setupAdvancedFeatureListeners();

      logger.info('Advanced search and view features initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize advanced features', error);
      throw error;
    }
  }

  /**
   * Initialize search bar
   */
  private initializeSearchBar(): void {
    const container = document.getElementById('advanced-search-container');
    if (!container) {
      logger.warn('Search container not found, skipping search bar');
      return;
    }

    // Create search bar HTML
    container.innerHTML = `
      <div id="search-bar-wrapper"></div>
    `;

    try {
      this.searchBar = new SearchBar(this.searchManager, 'search-bar-wrapper');
      logger.info('SearchBar initialized');
    } catch (error) {
      logger.error('Failed to initialize SearchBar', error);
    }
  }

  /**
   * Initialize filter/sort controls
   */
  private initializeFilterSortControls(): void {
    try {
      this.filterSortManager.createControls('filter-sort-container');
      logger.info('FilterSortControls initialized');
    } catch (error) {
      logger.error('Failed to initialize FilterSortControls', error);
    }
  }

  /**
   * Initialize view mode switcher
   */
  private initializeViewModeSwitcher(): void {
    try {
      this.viewModeManager.createViewModeSwitcher('view-mode-switcher-container');
      logger.info('ViewModeSwitcher initialized');
    } catch (error) {
      logger.error('Failed to initialize ViewModeSwitcher', error);
    }
  }

  /**
   * Initialize view components
   */
  private initializeViews(): void {
    const sessionListContainer = document.getElementById('session-list');
    if (!sessionListContainer) {
      logger.error('Session list container not found');
      return;
    }

    try {
      this.timelineView = new TimelineView(sessionListContainer);
      this.gridView = new GridView(sessionListContainer);
      this.listView = new ListView(sessionListContainer);
      this.boardView = new BoardView(sessionListContainer);

      logger.info('View components initialized');
    } catch (error) {
      logger.error('Failed to initialize view components', error);
    }
  }

  /**
   * Initialize keyboard shortcuts overlay
   */
  private initializeKeyboardShortcuts(): void {
    try {
      const shortcuts = KeyboardShortcutsOverlay.getDefaultShortcuts();
      this.keyboardShortcuts.initialize(shortcuts);
      logger.info('Keyboard shortcuts overlay initialized');
    } catch (error) {
      logger.error('Failed to initialize keyboard shortcuts', error);
    }
  }

  /**
   * Initialize quick actions menu
   */
  private initializeQuickActions(): void {
    try {
      const actions: QuickAction[] = [
        {
          id: 'open',
          label: 'Open Session',
          icon: '📖',
          shortcut: 'Enter',
          action: (session: Session) => {
            this.showSessionDetail(session.id);
          }
        },
        {
          id: 'share',
          label: 'Share Session',
          icon: '🔗',
          shortcut: 'Cmd+Shift+S',
          action: (session: Session) => {
            this.shareSession(session.id);
          }
        },
        {
          id: 'export',
          label: 'Export Session',
          icon: '📤',
          shortcut: 'Cmd+E',
          action: (session: Session) => {
            console.log('Export session:', session.id);
          },
          divider: true
        },
        {
          id: 'delete',
          label: 'Delete Session',
          icon: '🗑️',
          shortcut: 'Del',
          action: (session: Session) => {
            this.deleteSession(session.id);
          }
        }
      ];

      this.quickActions.initialize(actions);
      logger.info('Quick actions menu initialized');
    } catch (error) {
      logger.error('Failed to initialize quick actions', error);
    }
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

      // Get current sessions (either search results or all sessions)
      const sessions = this.getCurrentSessions();
      this.renderCurrentView(sessions);
    });

    // Filter change
    this.filterSortManager.onFilter((filter) => {
      logger.info('Filter changed, applying to search');
      this.searchManager.setFilter(filter);

      // If no active search, re-render with current sessions
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

    // Session click handlers for all views
    this.timelineView?.onSessionSelect((session) => this.handleSessionClick(session));
    this.gridView?.onSessionSelect((session) => this.handleSessionClick(session));
    this.listView?.onSessionSelect((session) => this.handleSessionClick(session));
    this.boardView?.onSessionSelect((session) => this.handleSessionClick(session));

    // Bulk selection callbacks
    this.bulkSelectionManager.onBulkExport((sessionIds) => {
      this.handleBulkExport(sessionIds);
    });

    this.bulkSelectionManager.onBulkDelete((sessionIds) => {
      this.handleBulkDelete(sessionIds);
    });

    this.bulkSelectionManager.onCreateStudySet(() => {
      const sessionIds = Array.from(this.bulkSelectionManager.getSelectedSessionIds());
      if (sessionIds.length >= 2) {
        // Show input modal for study set title
        this.studySetTitleModal.show(sessionIds, (title) => {
          this.createMultiSessionStudySet(sessionIds, title);
        });
      }
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
   * Filter out child sessions that belong to study sets
   * DISABLED: Child sessions now appear alongside their parent study sets in the main list
   *
   * This method is kept for reference but no longer used.
   * To re-enable filtering, call this method in updateSessions() before setting this.sessions
   */
  // private filterOutChildSessions(sessions: Session[]): Session[] {
  //   // Build a Set of all child session IDs across all study sets
  //   const childSessionIds = new Set<string>();

  //   sessions.forEach(session => {
  //     if (session.isMultiSessionStudySet() && session.childSessionIds) {
  //       session.childSessionIds.forEach(id => childSessionIds.add(id));
  //     }
  //   });

  //   // Return only sessions that are NOT children of any study set
  //   return sessions.filter(session => !childSessionIds.has(session.id));
  // }

  /**
   * Render current view mode
   */
  private renderCurrentView(sessions: Session[]): void {
    const currentMode = this.viewModeManager.getCurrentMode();

    // Apply sorting
    const sortedSessions = this.filterSortManager.sortSessions(sessions);

    logger.info(`Rendering ${currentMode} view with ${sortedSessions.length} sessions`);

    switch (currentMode) {
      case 'timeline':
        this.timelineView?.render(sortedSessions);
        break;
      case 'grid':
        this.gridView?.render(sortedSessions);
        break;
      case 'list':
        this.listView?.render(sortedSessions);
        break;
      case 'board':
        this.boardView?.render(sortedSessions);
        break;
    }

    // Wire up checkbox handlers after rendering
    this.wireUpCheckboxHandlers();
  }

  /**
   * Wire up checkbox event handlers (called once during initialization)
   */
  private wireUpCheckboxHandlers(): void {
    // Only add the listener once
    if (this.checkboxListenerAdded) {
      return;
    }

    // Use event delegation on the session-list container
    const sessionListContainer = document.getElementById('session-list');
    if (!sessionListContainer) {
      logger.warn('Session list container not found for checkbox handlers');
      return;
    }

    // Add event listener for all checkboxes using event delegation
    sessionListContainer.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.classList.contains('session-checkbox')) {
        const sessionId = target.dataset.sessionId;
        if (sessionId) {
          this.bulkSelectionManager.handleSessionSelection(sessionId, target.checked);
        }
      }
    });

    this.checkboxListenerAdded = true;
    logger.info('Checkbox event handlers wired up');
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
      titleElement.textContent = filterSharedOnly ? '👥 Shared Sessions' : '📚 Study Mode';
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

      // If it's a cloud path, try to get a signed URL from Supabase
      if (audioFilePath.startsWith('cloud://')) {
        const storagePath = audioFilePath.replace('cloud://', '');
        logger.info(`Getting signed URL for cloud recording: ${storagePath}`);

        const storageService = new SupabaseStorageService();
        const result = await storageService.getSignedUrl(storagePath, 7200); // 2 hours

        if (result.success && result.url) {
          // Cloud file exists, use the signed URL
          audioFilePath = result.url;
          logger.info(`Successfully obtained signed URL`);
        } else {
          // Cloud file not found, try local fallback paths
          logger.warn(`Cloud file not found: ${result.error || 'Unknown error'}. Trying local fallbacks...`);

          // Construct local fallback paths (same logic as audio player)
          const constructLocalPath = (date: Date): string => {
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            const hours = String(date.getUTCHours()).padStart(2, '0');
            const minutes = String(date.getUTCMinutes()).padStart(2, '0');
            const seconds = String(date.getUTCSeconds()).padStart(2, '0');
            const timestampStr = `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
            return `/Users/nae/Library/Application Support/scribecat-v2/recordings/recording-${timestampStr}.webm`;
          };

          const fallbackPaths: string[] = [];

          // Try paths based on session creation time FIRST (most reliable - actual recording time)
          const sessionTime = new Date(session.createdAt);
          sessionTime.setUTCSeconds(0, 0);
          fallbackPaths.push(constructLocalPath(sessionTime));
          fallbackPaths.push(constructLocalPath(session.createdAt));

          // Try +/- 5 seconds from session creation time (recording can start before session is created)
          for (let offset = -5; offset <= 5; offset++) {
            if (offset === 0) continue; // Already checked exact time above
            const offsetTime = new Date(session.createdAt);
            offsetTime.setUTCSeconds(offsetTime.getUTCSeconds() + offset);
            fallbackPaths.push(constructLocalPath(offsetTime));
          }

          // Try paths based on transcription creation time (less reliable - may be from re-transcription)
          if (session.transcription?.createdAt) {
            const transcriptionTime = new Date(session.transcription.createdAt);
            fallbackPaths.push(constructLocalPath(transcriptionTime));

            const transcriptionMinus1 = new Date(transcriptionTime);
            transcriptionMinus1.setUTCSeconds(transcriptionMinus1.getUTCSeconds() - 1);
            fallbackPaths.push(constructLocalPath(transcriptionMinus1));

            const transcriptionPlus1 = new Date(transcriptionTime);
            transcriptionPlus1.setUTCSeconds(transcriptionPlus1.getUTCSeconds() + 1);
            fallbackPaths.push(constructLocalPath(transcriptionPlus1));
          }

          // Check each fallback path
          let foundLocalFile = false;
          for (const localPath of fallbackPaths) {
            const fileCheck = await (window as any).scribeCat.dialog.fileExists(localPath);
            if (fileCheck.success && fileCheck.exists) {
              audioFilePath = localPath;
              logger.info(`Found local recording at: ${localPath}`);
              foundLocalFile = true;
              break;
            }
          }

          if (!foundLocalFile) {
            throw new Error('Recording file not found in cloud or local storage. Cannot re-transcribe.');
          }
        }
      }
      // Remove file:// prefix if present (for local files)
      else if (audioFilePath.startsWith('file://')) {
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

      // Diagnostic logging to verify sentence-level timestamps
      console.log('📊 Re-transcription data received:', {
        hasSentences: !!transcriptionData.sentences,
        sentenceCount: transcriptionData.sentences?.length || 0,
        hasWords: !!transcriptionData.words,
        wordCount: transcriptionData.words?.length || 0
      });

      // Format timestamped entries from AssemblyAI sentences
      let timestampedEntries = transcriptionData.sentences?.map((sentence: any) => ({
        startTime: sentence.start / 1000, // Convert ms to seconds
        endTime: sentence.end / 1000,
        text: sentence.text
      })) || [];

      // Fallback: If sentences are not available, use words to create sentence-like segments
      if (timestampedEntries.length === 0 && transcriptionData.words?.length > 0) {
        console.warn('⚠️ Sentences not available, falling back to word-level timestamps');

        // Group words into ~10-word segments for reasonable timestamp granularity
        const words = transcriptionData.words;
        const wordsPerSegment = 10;

        for (let i = 0; i < words.length; i += wordsPerSegment) {
          const segmentWords = words.slice(i, i + wordsPerSegment);
          const startTime = segmentWords[0].start / 1000;
          const endTime = segmentWords[segmentWords.length - 1].end / 1000;
          const text = segmentWords.map((w: any) => w.text).join(' ');

          timestampedEntries.push({ startTime, endTime, text });
        }

        console.log(`✅ Created ${timestampedEntries.length} segments from word-level data`);
      }

      // Update session transcription
      await (window as any).scribeCat.session.updateTranscription(
        sessionId,
        transcriptionData.text,
        'assemblyai',
        timestampedEntries
      );

      console.log('✅ Re-transcription update complete, waiting for file system...');

      // Add small delay to ensure file system writes complete before reloading
      // This prevents race condition where we reload stale data before save finishes
      await new Promise(resolve => setTimeout(resolve, 150));

      console.log('📥 Reloading sessions to get updated transcription data...');
      // Reload sessions to get updated data
      await this.loadSessions();

      // Refresh the detail view if we're still on this session
      const inDetailView = !this.sessionDetailContainer.classList.contains('hidden');
      console.log(`🔍 Detail view status: ${inDetailView ? 'visible' : 'hidden'}`);

      if (inDetailView) {
        const updatedSession = this.sessions.find(s => s.id === sessionId);
        if (updatedSession) {
          console.log(`✅ Found updated session, re-rendering detail view`);
          console.log(`   Transcription segments: ${updatedSession.transcription?.segments.length || 0}`);
          console.log(`   Transcription text length: ${updatedSession.transcription?.fullText.length || 0}`);
          await this.detailViewManager.render(updatedSession, true);
          console.log('✅ Detail view re-rendered successfully');
        } else {
          console.error(`❌ Updated session ${sessionId} not found in reloaded sessions`);
          console.error(`   Total sessions loaded: ${this.sessions.length}`);
          console.error(`   Session IDs: ${this.sessions.map(s => s.id).join(', ')}`);
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
