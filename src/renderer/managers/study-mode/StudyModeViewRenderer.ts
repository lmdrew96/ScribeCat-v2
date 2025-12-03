/**
 * StudyModeViewRenderer
 *
 * Handles rendering of different view modes and checkbox event handlers.
 */

import { Session } from '../../../domain/entities/Session.js';
import { ViewModeManager } from '../ViewModeManager.js';
import { FilterSortManager } from './FilterSortManager.js';
import { BulkSelectionManager } from './BulkSelectionManager.js';
import type { ViewComponents } from './StudyModeAdvancedFeatures.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('StudyModeViewRenderer');

export class StudyModeViewRenderer {
  private viewModeManager: ViewModeManager;
  private filterSortManager: FilterSortManager;
  private bulkSelectionManager: BulkSelectionManager;
  private viewComponents: ViewComponents | null = null;
  private checkboxListenerAdded: boolean = false;

  constructor(
    viewModeManager: ViewModeManager,
    filterSortManager: FilterSortManager,
    bulkSelectionManager: BulkSelectionManager
  ) {
    this.viewModeManager = viewModeManager;
    this.filterSortManager = filterSortManager;
    this.bulkSelectionManager = bulkSelectionManager;
  }

  /**
   * Set view components after initialization
   */
  setViewComponents(components: ViewComponents): void {
    this.viewComponents = components;
  }

  /**
   * Render current view mode
   */
  render(sessions: Session[]): void {
    const currentMode = this.viewModeManager.getCurrentMode();
    const sortedSessions = this.filterSortManager.sortSessions(sessions);

    logger.info(`Rendering ${currentMode} view with ${sortedSessions.length} sessions`);

    if (!this.viewComponents) return;

    switch (currentMode) {
      case 'timeline':
        this.viewComponents.timelineView?.render(sortedSessions);
        break;
      case 'grid':
        this.viewComponents.gridView?.render(sortedSessions);
        break;
      case 'list':
        this.viewComponents.listView?.render(sortedSessions);
        break;
      case 'board':
        this.viewComponents.boardView?.render(sortedSessions);
        break;
    }

    this.wireUpCheckboxHandlers();
  }

  /**
   * Wire up checkbox event handlers (called once during initialization)
   */
  private wireUpCheckboxHandlers(): void {
    if (this.checkboxListenerAdded) return;

    const sessionListContainer = document.getElementById('session-list');
    if (!sessionListContainer) {
      logger.warn('Session list container not found for checkbox handlers');
      return;
    }

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
}
