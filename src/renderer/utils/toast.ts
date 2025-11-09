/**
 * Toast Notification Utility
 *
 * Simple, user-friendly toast notifications for Phase 5 features
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

class ToastManager {
  private container: HTMLElement | null = null;

  constructor() {
    this.initializeContainer();
  }

  private initializeContainer(): void {
    // Create toast container if it doesn't exist
    if (!document.getElementById('toast-container')) {
      const container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
      this.container = container;
    } else {
      this.container = document.getElementById('toast-container');
    }
  }

  /**
   * Show a toast notification
   */
  show(options: ToastOptions): void {
    if (!this.container) {
      this.initializeContainer();
    }

    const {
      message,
      type = 'info',
      duration = 4000,
      action
    } = options;

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} toast-entering`;

    // Add icon based on type
    const icon = this.getIcon(type);

    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${this.escapeHtml(message)}</span>
      </div>
      ${action ? `
        <button class="toast-action" data-action="true">
          ${this.escapeHtml(action.label)}
        </button>
      ` : ''}
      <button class="toast-close" data-close="true" aria-label="Close">×</button>
    `;

    // Add event listeners
    const closeBtn = toast.querySelector('[data-close]');
    closeBtn?.addEventListener('click', () => this.hideToast(toast));

    if (action) {
      const actionBtn = toast.querySelector('[data-action]');
      actionBtn?.addEventListener('click', () => {
        action.onClick();
        this.hideToast(toast);
      });
    }

    // Add to container
    this.container?.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => {
      toast.classList.remove('toast-entering');
      toast.classList.add('toast-visible');
    });

    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => this.hideToast(toast), duration);
    }
  }

  /**
   * Hide a toast with animation
   */
  private hideToast(toast: HTMLElement): void {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-exiting');

    setTimeout(() => {
      toast.remove();
    }, 300);
  }

  /**
   * Get icon for toast type
   */
  private getIcon(type: ToastType): string {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
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

  /**
   * Convenience methods
   */
  success(message: string, action?: ToastOptions['action']): void {
    this.show({ message, type: 'success', action });
  }

  error(message: string, action?: ToastOptions['action']): void {
    this.show({ message, type: 'error', duration: 6000, action });
  }

  warning(message: string, action?: ToastOptions['action']): void {
    this.show({ message, type: 'warning', duration: 5000, action });
  }

  info(message: string, action?: ToastOptions['action']): void {
    this.show({ message, type: 'info', action });
  }
}

// Export singleton instance
export const toast = new ToastManager();
