/**
 * StudyModeAdvancedFeatures
 *
 * Handles initialization of advanced search, filter, view mode, and keyboard shortcuts.
 * Extracted from StudyModeManager for better separation of concerns.
 */

import { Session } from '../../../domain/entities/Session.js';
import { SearchManager } from '../SearchManager.js';
import { ViewModeManager, type ViewMode } from '../ViewModeManager.js';
import { FilterSortManager } from './FilterSortManager.js';
import { BulkSelectionManager } from './BulkSelectionManager.js';
import { KeyboardShortcutHandler } from '../KeyboardShortcutHandler.js';
import { SearchBar } from '../../components/SearchBar.js';
import { TimelineView } from '../../components/views/TimelineView.js';
import { GridView } from '../../components/views/GridView.js';
import { ListView } from '../../components/views/ListView.js';
import { BoardView } from '../../components/views/BoardView.js';
import { KeyboardShortcutsOverlay } from '../../components/KeyboardShortcutsOverlay.js';
import { QuickActionsMenu, type QuickAction } from '../../components/QuickActionsMenu.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('StudyModeAdvancedFeatures');

export interface AdvancedFeaturesConfig {
  searchManager: SearchManager;
  viewModeManager: ViewModeManager;
  filterSortManager: FilterSortManager;
  bulkSelectionManager: BulkSelectionManager;
  keyboardShortcutHandler: KeyboardShortcutHandler;
  keyboardShortcuts: KeyboardShortcutsOverlay;
  quickActions: QuickActionsMenu;
  onSessionSelect: (session: Session) => void;
  onBulkExport: (sessionIds: Set<string>) => void;
  onBulkDelete: (sessionIds: Set<string>) => void;
  onCreateStudySet: () => void;
  onShowSessionDetail: (sessionId: string) => void;
  onShareSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  getSessionById?: (sessionId: string) => Session | undefined;
}

export interface ViewComponents {
  searchBar: SearchBar | null;
  timelineView: TimelineView | null;
  gridView: GridView | null;
  listView: ListView | null;
  boardView: BoardView | null;
}

export class StudyModeAdvancedFeatures {
  private config: AdvancedFeaturesConfig;
  private views: ViewComponents = {
    searchBar: null,
    timelineView: null,
    gridView: null,
    listView: null,
    boardView: null
  };

  constructor(config: AdvancedFeaturesConfig) {
    this.config = config;
  }

  /**
   * Initialize all advanced features
   */
  async initialize(): Promise<ViewComponents> {
    logger.info('Initializing advanced search and view features...');

    try {
      this.initializeSearchBar();
      this.initializeFilterSortControls();
      this.initializeViewModeSwitcher();
      this.initializeViews();
      this.initializeKeyboardShortcuts();
      this.initializeQuickActions();

      logger.info('Advanced search and view features initialized successfully');
      return this.views;
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

    container.innerHTML = `<div id="search-bar-wrapper"></div>`;

    try {
      this.views.searchBar = new SearchBar(this.config.searchManager, 'search-bar-wrapper');
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
      this.config.filterSortManager.createControls('filter-sort-container');
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
      this.config.viewModeManager.createViewModeSwitcher('view-mode-switcher-container');
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
      this.views.timelineView = new TimelineView(sessionListContainer);
      this.views.gridView = new GridView(sessionListContainer);
      this.views.listView = new ListView(sessionListContainer);
      this.views.boardView = new BoardView(sessionListContainer);

      // Wire up session select handlers
      this.views.timelineView?.onSessionSelect(this.config.onSessionSelect);
      this.views.gridView?.onSessionSelect(this.config.onSessionSelect);
      this.views.listView?.onSessionSelect(this.config.onSessionSelect);
      this.views.boardView?.onSessionSelect(this.config.onSessionSelect);

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
      this.config.keyboardShortcuts.initialize(shortcuts);
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
            this.config.onShowSessionDetail(session.id);
          }
        },
        {
          id: 'share',
          label: 'Share Session',
          icon: '🔗',
          shortcut: 'Cmd+Shift+S',
          action: (session: Session) => {
            this.config.onShareSession(session.id);
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
            this.config.onDeleteSession(session.id);
          }
        }
      ];

      this.config.quickActions.initialize({
        actions,
        getSessionById: this.config.getSessionById
      });
      logger.info('Quick actions menu initialized');
    } catch (error) {
      logger.error('Failed to initialize quick actions', error);
    }
  }

  /**
   * Setup event listeners for bulk selection callbacks
   */
  setupBulkSelectionCallbacks(): void {
    this.config.bulkSelectionManager.onBulkExport(this.config.onBulkExport);
    this.config.bulkSelectionManager.onBulkDelete(this.config.onBulkDelete);
    this.config.bulkSelectionManager.onCreateStudySet(this.config.onCreateStudySet);
  }

  /**
   * Get the view components
   */
  getViews(): ViewComponents {
    return this.views;
  }
}
