/**
 * ViewContextService
 *
 * Provides a single source of truth for the current view context in the app.
 * Used by features that need to behave differently based on which view is active.
 *
 * View hierarchy:
 * - 'recording' - Main recording view (default)
 * - 'study-mode' - Study mode grid/list/timeline/board views
 * - 'detail-view' - Session detail view within study mode
 * - 'study-room' - Collaborative study room
 */

import { createLogger } from '../../shared/logger.js';

const logger = createLogger('ViewContextService');

export type AppView = 'recording' | 'study-mode' | 'study-room' | 'detail-view';

export class ViewContextService {
  private static instance: ViewContextService | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ViewContextService {
    if (!this.instance) {
      this.instance = new ViewContextService();
    }
    return this.instance;
  }

  /**
   * Get the current active view
   */
  public getCurrentView(): AppView {
    // Check study room first (highest priority, fully covers screen)
    const studyRoomView = document.getElementById('study-room-view');
    if (studyRoomView && !studyRoomView.classList.contains('hidden')) {
      return 'study-room';
    }

    // Check study mode
    const studyModeView = document.getElementById('study-mode-view');
    if (studyModeView && !studyModeView.classList.contains('hidden')) {
      // Check if in detail view within study mode
      const sessionDetail = document.getElementById('session-detail');
      if (sessionDetail && !sessionDetail.classList.contains('hidden')) {
        return 'detail-view';
      }
      return 'study-mode';
    }

    // Default to recording view
    return 'recording';
  }

  /**
   * Check if user is in a study room (collaborative)
   */
  public isInStudyRoom(): boolean {
    return this.getCurrentView() === 'study-room';
  }

  /**
   * Check if user is in study mode (any study mode view)
   */
  public isInStudyMode(): boolean {
    const view = this.getCurrentView();
    return view === 'study-mode' || view === 'detail-view';
  }

  /**
   * Check if user is in the main recording view
   */
  public isInRecordingView(): boolean {
    return this.getCurrentView() === 'recording';
  }
}
