/**
 * CloudSyncManager
 *
 * Handles cloud synchronization operations for Study Mode:
 * - Manual sync trigger
 * - Sync feedback notifications
 * - Sync button state management
 *
 * Extracted from StudyModeManager for better separation of concerns.
 */

import { AuthManager } from '../AuthManager.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('CloudSyncManager');

export class CloudSyncManager {
  constructor(
    private authManager: AuthManager,
    private syncNowBtn: HTMLButtonElement
  ) {}

  /**
   * Handle manual cloud sync
   *
   * @param onSyncComplete - Callback to refresh data after successful sync
   */
  public async handleSyncNow(onSyncComplete: () => Promise<void>): Promise<void> {
    // Check if user is authenticated
    const currentUser = this.authManager.getCurrentUser();
    if (!currentUser) {
      alert('Please sign in to sync your sessions');
      return;
    }

    // Disable button and show syncing state
    this.syncNowBtn.disabled = true;
    this.syncNowBtn.classList.add('syncing');

    try {
      logger.info('Starting manual cloud sync...');

      // Call sync API
      const result = await window.scribeCat.sync.syncAllFromCloud();

      if (result.success) {
        logger.info(`Sync completed: ${result.count} sessions downloaded`);

        // Show success feedback
        if (result.count > 0) {
          this.showSyncFeedback(`Synced ${result.count} session${result.count === 1 ? '' : 's'} from cloud`, 'success');
        } else {
          this.showSyncFeedback('Already up to date', 'success');
        }

        // Refresh the session list
        await onSyncComplete();
      } else {
        logger.error('Sync failed:', result.error);
        this.showSyncFeedback(`Sync failed: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      logger.error('Error during sync:', error);
      this.showSyncFeedback(`Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      // Re-enable button and remove syncing state
      this.syncNowBtn.disabled = false;
      this.syncNowBtn.classList.remove('syncing');
    }
  }

  /**
   * Show sync feedback notification
   */
  private showSyncFeedback(message: string, type: 'success' | 'error'): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      max-width: 400px;
      font-size: 14px;
      animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }
}
