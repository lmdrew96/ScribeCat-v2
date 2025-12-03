/**
 * StudyModeAnalyticsModal
 *
 * Handles the analytics modal initialization and event handlers.
 */

import { Session } from '../../../domain/entities/Session.js';
import { AnalyticsDashboard } from '../../components/AnalyticsDashboard.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('StudyModeAnalyticsModal');

export class StudyModeAnalyticsModal {
  private analyticsDashboard: AnalyticsDashboard;
  private getSessions: () => Session[];

  constructor(analyticsDashboard: AnalyticsDashboard, getSessions: () => Session[]) {
    this.analyticsDashboard = analyticsDashboard;
    this.getSessions = getSessions;
  }

  /**
   * Initialize analytics modal event listeners
   */
  initialize(): void {
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
      this.analyticsDashboard.updateSessions(this.getSessions());
      dashboardContainer.innerHTML = this.analyticsDashboard.render();
      (window as any).analyticsDashboard = this.analyticsDashboard;
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
}
