/**
 * NotificationTicker - Footer-based notification system
 * Replaces floating toast notifications with an inline ticker in the status bar
 */

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationOptions {
  message: string;
  type: NotificationType;
  duration?: number; // milliseconds, 0 = persistent
  id?: string;
}

interface QueuedNotification extends NotificationOptions {
  id: string;
  timestamp: number;
}

export class NotificationTicker {
  private container: HTMLElement | null = null;
  private queueBadge: HTMLElement | null = null;
  private notificationQueue: QueuedNotification[] = [];
  private currentNotification: QueuedNotification | null = null;
  private autoAdvanceTimer: number | null = null;
  private isPaused: boolean = false;
  private notificationIdCounter: number = 0;

  /**
   * Initialize the notification ticker
   */
  public initialize(): void {
    this.container = document.getElementById('notification-ticker-content');
    this.queueBadge = document.getElementById('notification-queue-count');

    if (!this.container) {
      console.error('NotificationTicker: Container element not found');
      return;
    }

    // Add click handler to pause/resume auto-advance
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.ticker-dismiss')) {
        this.togglePause();
      }
    });

    console.log('NotificationTicker initialized');
  }

  /**
   * Show a notification with custom options
   */
  public show(options: NotificationOptions): string {
    const id = options.id || `notification-${++this.notificationIdCounter}`;
    const notification: QueuedNotification = {
      message: options.message,
      type: options.type,
      duration: options.duration ?? 5000, // Default 5 seconds
      id,
      timestamp: Date.now(),
    };

    this.notificationQueue.push(notification);
    this.updateQueueBadge();

    // If no current notification, show this one immediately
    if (!this.currentNotification) {
      this.showNext();
    }

    return id;
  }

  /**
   * Show a success notification
   */
  public success(message: string, duration?: number): string {
    return this.show({ message, type: 'success', duration });
  }

  /**
   * Show an error notification
   */
  public error(message: string, duration?: number): string {
    return this.show({ message, type: 'error', duration });
  }

  /**
   * Show a warning notification
   */
  public warning(message: string, duration?: number): string {
    return this.show({ message, type: 'warning', duration });
  }

  /**
   * Show an info notification
   */
  public info(message: string, duration?: number): string {
    return this.show({ message, type: 'info', duration });
  }

  /**
   * Dismiss a specific notification by ID
   */
  public dismiss(id: string): void {
    // Remove from queue
    this.notificationQueue = this.notificationQueue.filter(n => n.id !== id);
    this.updateQueueBadge();

    // If it's the current notification, show next
    if (this.currentNotification?.id === id) {
      this.clearAutoAdvanceTimer();
      this.hideCurrentNotification();
      this.showNext();
    }
  }

  /**
   * Clear all notifications
   */
  public clearAll(): void {
    this.notificationQueue = [];
    this.updateQueueBadge();
    this.clearAutoAdvanceTimer();
    this.hideCurrentNotification();
  }

  /**
   * Show the next notification in the queue
   */
  private showNext(): void {
    if (this.notificationQueue.length === 0) {
      this.currentNotification = null;
      return;
    }

    this.currentNotification = this.notificationQueue.shift()!;
    this.updateQueueBadge();
    this.renderNotification(this.currentNotification);

    // Set auto-advance timer if duration > 0
    if (this.currentNotification.duration > 0 && !this.isPaused) {
      this.clearAutoAdvanceTimer();
      this.autoAdvanceTimer = window.setTimeout(() => {
        this.hideCurrentNotification();
        this.showNext();
      }, this.currentNotification.duration);
    }
  }

  /**
   * Render the notification in the container
   */
  private renderNotification(notification: QueuedNotification): void {
    if (!this.container) return;

    const icon = this.getIconForType(notification.type);
    const typeClass = `ticker-${notification.type}`;

    this.container.innerHTML = `
      <div class="ticker-notification ${typeClass} ticker-slide-in">
        <span class="ticker-icon">${icon}</span>
        <span class="ticker-message">${this.escapeHtml(notification.message)}</span>
        <button class="ticker-dismiss" aria-label="Dismiss notification" data-id="${notification.id}">×</button>
      </div>
    `;

    // Add dismiss button handler
    const dismissBtn = this.container.querySelector('.ticker-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismiss(notification.id);
      });
    }
  }

  /**
   * Hide the current notification with animation
   */
  private hideCurrentNotification(): void {
    if (!this.container) return;

    const notificationEl = this.container.querySelector('.ticker-notification');
    if (notificationEl) {
      notificationEl.classList.remove('ticker-slide-in');
      notificationEl.classList.add('ticker-slide-out');

      setTimeout(() => {
        this.container!.innerHTML = '';
      }, 300); // Match animation duration
    }
  }

  /**
   * Update the queue count badge
   */
  private updateQueueBadge(): void {
    if (!this.queueBadge) return;

    if (this.notificationQueue.length > 0) {
      this.queueBadge.textContent = `${this.notificationQueue.length}`;
      this.queueBadge.style.display = 'flex';
    } else {
      this.queueBadge.style.display = 'none';
    }
  }

  /**
   * Toggle pause state
   */
  private togglePause(): void {
    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.clearAutoAdvanceTimer();
    } else if (this.currentNotification && this.currentNotification.duration > 0) {
      // Resume auto-advance
      this.clearAutoAdvanceTimer();
      this.autoAdvanceTimer = window.setTimeout(() => {
        this.hideCurrentNotification();
        this.showNext();
      }, this.currentNotification.duration);
    }
  }

  /**
   * Clear the auto-advance timer
   */
  private clearAutoAdvanceTimer(): void {
    if (this.autoAdvanceTimer !== null) {
      clearTimeout(this.autoAdvanceTimer);
      this.autoAdvanceTimer = null;
    }
  }

  /**
   * Get icon for notification type
   */
  private getIconForType(type: NotificationType): string {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return 'ℹ';
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export singleton instance
export const notificationTicker = new NotificationTicker();

// Make available globally for console debugging and legacy code
declare global {
  interface Window {
    notificationTicker: NotificationTicker;
  }
}

if (typeof window !== 'undefined') {
  window.notificationTicker = notificationTicker;
}
