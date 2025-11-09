/**
 * Phase3Integration
 *
 * Integrates Phase 3 search and view features with existing Study Mode.
 * This manager coordinates SearchManager, ViewModeManager, and the existing StudyModeSessionListManager.
 */

import type { StudyModeManager } from './StudyModeManager.js';
import { SearchManager } from './SearchManager.js';
import { ViewModeManager, type ViewMode } from './ViewModeManager.js';
import { BulkSelectionManager } from './study-mode/BulkSelectionManager.js';
import { KeyboardShortcutHandler } from './KeyboardShortcutHandler.js';
import { SearchBar } from '../components/SearchBar.js';
import { TimelineView } from '../components/views/TimelineView.js';
import { GridView } from '../components/views/GridView.js';
import { ListView } from '../components/views/ListView.js';
import { BoardView } from '../components/views/BoardView.js';
import { KeyboardShortcutsOverlay } from '../components/KeyboardShortcutsOverlay.js';
import { QuickActionsMenu, type QuickAction } from '../components/QuickActionsMenu.js';
import type { Session } from '../../domain/entities/Session.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('Phase3Integration');

export class Phase3Integration {
  private studyModeManager: StudyModeManager;
  private searchManager: SearchManager;
  private viewModeManager: ViewModeManager;
  private bulkSelectionManager: BulkSelectionManager;
  private keyboardShortcutHandler: KeyboardShortcutHandler;
  private searchBar: SearchBar | null = null;
  private checkboxListenerAdded: boolean = false;

  // Session storage
  private sessions: Session[] = [];

  // View components
  private timelineView: TimelineView | null = null;
  private gridView: GridView | null = null;
  private listView: ListView | null = null;
  private boardView: BoardView | null = null;

  // UI components
  private keyboardShortcuts: KeyboardShortcutsOverlay;
  private quickActions: QuickActionsMenu;

  constructor(studyModeManager: StudyModeManager) {
    this.studyModeManager = studyModeManager;

    // Initialize managers
    this.searchManager = new SearchManager();
    this.viewModeManager = new ViewModeManager('session-list');
    this.bulkSelectionManager = new BulkSelectionManager();
    this.keyboardShortcutHandler = this.createKeyboardShortcutHandler();

    // Initialize UI components
    this.keyboardShortcuts = new KeyboardShortcutsOverlay();
    this.quickActions = new QuickActionsMenu();
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
      onExportSession: () => {
        // Export selected sessions if any, otherwise do nothing
        const selectedIds = this.bulkSelectionManager.getSelectedSessionIds();
        if (selectedIds.size > 0) {
          (window as any).studyModeManager?.handleBulkExport(selectedIds);
        }
      },
      onDeleteSelected: () => {
        // Delete selected sessions if any
        const selectedIds = this.bulkSelectionManager.getSelectedSessionIds();
        if (selectedIds.size > 0) {
          (window as any).studyModeManager?.handleBulkDelete(selectedIds);
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
   * Initialize Phase 3 features
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Phase 3 features...');

    try {
      // 1. Initialize SearchBar
      this.initializeSearchBar();

      // 2. Initialize ViewModeManager UI
      this.initializeViewModeSwitcher();

      // 3. Initialize view components
      this.initializeViews();

      // 4. Initialize keyboard shortcuts
      this.initializeKeyboardShortcuts();

      // 5. Initialize quick actions menu
      this.initializeQuickActions();

      // 6. Set up event listeners
      this.setupEventListeners();

      logger.info('Phase 3 features initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Phase 3 features', error);
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
            // Delegate to study mode manager
            (window as any).studyModeManager?.showSessionDetail(session.id);
          }
        },
        {
          id: 'share',
          label: 'Share Session',
          icon: '🔗',
          shortcut: 'Cmd+Shift+S',
          action: (session: Session) => {
            (window as any).studyModeManager?.shareSession(session.id);
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
            (window as any).studyModeManager?.deleteSession(session.id);
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
   * Set up event listeners
   */
  private setupEventListeners(): void {
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

    // Session click handlers for all views
    this.timelineView?.onSessionSelect((session) => this.handleSessionClick(session));
    this.gridView?.onSessionSelect((session) => this.handleSessionClick(session));
    this.listView?.onSessionSelect((session) => this.handleSessionClick(session));
    this.boardView?.onSessionSelect((session) => this.handleSessionClick(session));

    // Bulk selection callbacks
    this.bulkSelectionManager.onBulkExport((sessionIds) => {
      (window as any).studyModeManager?.handleBulkExport(sessionIds);
    });

    this.bulkSelectionManager.onBulkDelete((sessionIds) => {
      (window as any).studyModeManager?.handleBulkDelete(sessionIds);
    });

    this.bulkSelectionManager.onCreateStudySet(() => {
      const sessionIds = Array.from(this.bulkSelectionManager.getSelectedSessionIds());
      if (sessionIds.length >= 2) {
        // Prompt for study set title
        const title = prompt('Enter a title for this study set:');
        if (title) {
          (window as any).studyModeManager?.createMultiSessionStudySet(sessionIds, title);
        }
      }
    });
  }

  /**
   * Update sessions (called when study mode loads new sessions)
   */
  updateSessions(sessions: Session[]): void {
    logger.info(`Updating Phase 3 with ${sessions.length} sessions`);

    // Store sessions internally
    this.sessions = sessions;

    // Update search manager
    this.searchManager.setSessions(sessions);

    // If no search is active, render all sessions in current view
    if (!this.searchManager.isSearching() && this.searchManager.getState().query === '') {
      this.renderCurrentView(sessions);
    }
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
    const currentMode = this.viewModeManager.getCurrentMode();

    logger.info(`Rendering ${currentMode} view with ${sessions.length} sessions`);

    switch (currentMode) {
      case 'timeline':
        this.timelineView?.render(sessions);
        break;
      case 'grid':
        this.gridView?.render(sessions);
        break;
      case 'list':
        this.listView?.render(sessions);
        break;
      case 'board':
        this.boardView?.render(sessions);
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
}
