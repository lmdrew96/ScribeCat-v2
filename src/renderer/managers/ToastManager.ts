/**
 * ToastManager
 *
 * Displays non-intrusive toast notifications for user feedback.
 * Used for save confirmations, sync status, errors, and success messages.
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';
export type ToastPosition = 'top-right' | 'bottom-right' | 'top-center' | 'bottom-center';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number; // milliseconds, 0 = persistent
  position?: ToastPosition;
  icon?: string;
  action?: {
    label: string;
    callback: () => void;
  };
}

export class ToastManager {
  private toasts: Map<string, HTMLElement> = new Map();
  private toastCounter: number = 0;

  constructor() {
    this.injectStyles();
  }

  /**
   * Inject toast styles into the document
   */
  private injectStyles(): void {
    if (document.getElementById('toast-manager-styles')) return;

    const style = document.createElement('style');
    style.id = 'toast-manager-styles';
    style.textContent = `
      .toast-container {
        position: fixed;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
      }

      .toast-container.top-right {
        top: 20px;
        right: 20px;
      }

      .toast-container.bottom-right {
        bottom: 20px;
        right: 20px;
      }

      .toast-container.top-center {
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
      }

      .toast-container.bottom-center {
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
      }

      .toast {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 18px;
        background: var(--bg-secondary, #2d2d2d);
        border: 1px solid var(--border, #404040);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        color: var(--text-primary, #ffffff);
        font-size: 14px;
        min-width: 280px;
        max-width: 400px;
        opacity: 0;
        transform: translateY(10px);
        animation: toastSlideIn 0.3s ease forwards;
        pointer-events: all;
      }

      .toast.removing {
        animation: toastSlideOut 0.3s ease forwards;
      }

      @keyframes toastSlideIn {
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes toastSlideOut {
        to {
          opacity: 0;
          transform: translateY(-10px);
        }
      }

      .toast-icon {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }

      .toast-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .toast-message {
        line-height: 1.4;
      }

      .toast-action {
        margin-top: 4px;
      }

      .toast-action-btn {
        background: none;
        border: none;
        color: var(--accent, #007acc);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
        text-decoration: underline;
      }

      .toast-action-btn:hover {
        color: #4db8ff;
      }

      .toast-close {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        color: var(--text-secondary, #aaaaaa);
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .toast-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text-primary, #ffffff);
      }

      /* Type-specific styling */
      .toast.success {
        border-left: 4px solid #27ae60;
      }

      .toast.error {
        border-left: 4px solid #e74c3c;
      }

      .toast.warning {
        border-left: 4px solid #f39c12;
      }

      .toast.info {
        border-left: 4px solid var(--accent, #007acc);
      }

      /* Light theme */
      [data-theme*="light"] .toast {
        background: #ffffff;
        color: #1e1e1e;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      [data-theme*="light"] .toast-close {
        color: #666666;
      }

      [data-theme*="light"] .toast-close:hover {
        background: rgba(0, 0, 0, 0.05);
        color: #1e1e1e;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .toast-container {
          left: 16px !important;
          right: 16px !important;
          transform: none !important;
        }

        .toast {
          min-width: auto;
          max-width: 100%;
        }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .toast {
          animation: none !important;
          opacity: 1 !important;
          transform: none !important;
        }
      }

      /* Print */
      @media print {
        .toast-container {
          display: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Get or create toast container for a position
   */
  private getContainer(position: ToastPosition): HTMLElement {
    const existingContainer = document.querySelector(`.toast-container.${position}`);
    if (existingContainer) return existingContainer as HTMLElement;

    const container = document.createElement('div');
    container.className = `toast-container ${position}`;
    document.body.appendChild(container);
    return container;
  }

  /**
   * Show a toast notification
   */
  public show(options: ToastOptions): string {
    const {
      message,
      type = 'info',
      duration = 3000,
      position = 'bottom-right',
      icon,
      action
    } = options;

    const toastId = `toast-${++this.toastCounter}`;
    const container = this.getContainer(position);

    // Determine icon
    const iconEmoji = icon || this.getDefaultIcon(type);

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = toastId;
    toast.innerHTML = `
      <div class="toast-icon">${iconEmoji}</div>
      <div class="toast-content">
        <div class="toast-message">${message}</div>
        ${action ? `
          <div class="toast-action">
            <button class="toast-action-btn">${action.label}</button>
          </div>
        ` : ''}
      </div>
      <button class="toast-close" aria-label="Close">×</button>
    `;

    // Add to container
    container.appendChild(toast);
    this.toasts.set(toastId, toast);

    // Set up action button
    if (action) {
      const actionBtn = toast.querySelector('.toast-action-btn');
      actionBtn?.addEventListener('click', () => {
        action.callback();
        this.hide(toastId);
      });
    }

    // Set up close button
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn?.addEventListener('click', () => {
      this.hide(toastId);
    });

    // Auto-dismiss after duration (if not persistent)
    if (duration > 0) {
      setTimeout(() => {
        this.hide(toastId);
      }, duration);
    }

    return toastId;
  }

  /**
   * Hide a toast notification
   */
  public hide(toastId: string): void {
    const toast = this.toasts.get(toastId);
    if (!toast) return;

    toast.classList.add('removing');

    setTimeout(() => {
      toast.remove();
      this.toasts.delete(toastId);

      // Clean up empty containers
      const container = toast.parentElement;
      if (container && container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }

  /**
   * Show success toast
   */
  public success(message: string, options?: Partial<ToastOptions>): string {
    return this.show({ ...options, message, type: 'success' });
  }

  /**
   * Show error toast
   */
  public error(message: string, options?: Partial<ToastOptions>): string {
    return this.show({ ...options, message, type: 'error' });
  }

  /**
   * Show info toast
   */
  public info(message: string, options?: Partial<ToastOptions>): string {
    return this.show({ ...options, message, type: 'info' });
  }

  /**
   * Show warning toast
   */
  public warning(message: string, options?: Partial<ToastOptions>): string {
    return this.show({ ...options, message, type: 'warning' });
  }

  /**
   * Get default icon for toast type
   */
  private getDefaultIcon(type: ToastType): string {
    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠'
    };
    return icons[type];
  }

  /**
   * Clear all toasts
   */
  public clearAll(): void {
    for (const toastId of this.toasts.keys()) {
      this.hide(toastId);
    }
  }
}
