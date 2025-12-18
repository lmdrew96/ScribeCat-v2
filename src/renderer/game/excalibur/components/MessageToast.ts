/**
 * MessageToast - HTML-based toast notification component
 *
 * Provides consistent styled toast messages matching the game UI aesthetic.
 * Use for temporary notifications, battle messages, status updates, etc.
 *
 * Features:
 * - Consistent styling with game theme
 * - Auto-dismiss with configurable duration
 * - Multiple toast types (default, success, error, info)
 * - Smooth animations
 */

import { injectOverlayStyles } from '../../css/index.js';

export type ToastType = 'default' | 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  position?: 'top' | 'center' | 'bottom';
  onDismiss?: () => void;
}

/**
 * MessageToast - Temporary notification display
 */
export class MessageToast {
  private container: HTMLDivElement;
  private parentElement: HTMLElement;
  private currentToast: HTMLDivElement | null = null;
  private dismissTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(parentElement: HTMLElement) {
    this.parentElement = parentElement;

    // Ensure overlay styles are injected
    injectOverlayStyles();

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'sq-toast-container';
    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 200;
      overflow: hidden;
    `;

    this.addStyles();
    parentElement.appendChild(this.container);
  }

  /**
   * Add component-specific styles
   */
  private addStyles(): void {
    if (document.getElementById('sq-message-toast-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'sq-message-toast-styles';
    styles.textContent = `
      .sq-toast-container {
        font-family: 'Segoe UI', system-ui, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        padding: 16px;
      }

      .sq-toast-container.position-center {
        justify-content: center;
      }

      .sq-toast-container.position-bottom {
        justify-content: flex-end;
      }

      .sq-message-toast {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        background: linear-gradient(180deg, #2a2a4e 0%, #1e1e32 100%);
        border: 2px solid #6496ff;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        color: #fff;
        font-size: 14px;
        font-weight: 500;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        animation: sq-toast-slide-in 0.25s ease-out;
        pointer-events: auto;
      }

      .sq-message-toast.success {
        border-color: #64ff64;
        background: linear-gradient(180deg, #2a4e2a 0%, #1e321e 100%);
      }

      .sq-message-toast.error {
        border-color: #ff6464;
        background: linear-gradient(180deg, #4e2a2a 0%, #321e1e 100%);
      }

      .sq-message-toast.info {
        border-color: #64b4ff;
        background: linear-gradient(180deg, #2a3a4e 0%, #1e2832 100%);
      }

      .sq-message-toast.warning {
        border-color: #fbbf24;
        background: linear-gradient(180deg, #4e4a2a 0%, #32301e 100%);
      }

      .sq-message-toast.fading {
        animation: sq-toast-slide-out 0.2s ease-in forwards;
      }

      @keyframes sq-toast-slide-in {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes sq-toast-slide-out {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(-10px);
        }
      }

      .sq-message-toast-icon {
        font-size: 16px;
        line-height: 1;
      }

      .sq-message-toast.success .sq-message-toast-icon::before { content: '✓'; color: #64ff64; }
      .sq-message-toast.error .sq-message-toast-icon::before { content: '✗'; color: #ff6464; }
      .sq-message-toast.info .sq-message-toast-icon::before { content: 'ℹ'; color: #64b4ff; }
      .sq-message-toast.warning .sq-message-toast-icon::before { content: '⚠'; color: #fbbf24; }
    `;
    document.head.appendChild(styles);
  }

  /**
   * Show a toast message
   */
  show(message: string, options: ToastOptions = {}): Promise<void> {
    return new Promise((resolve) => {
      const { type = 'default', duration = 2000, position = 'top', onDismiss } = options;

      // Clear any existing toast
      this.dismiss();

      // Update container position
      this.container.className = `sq-toast-container position-${position}`;

      // Create toast element
      const toast = document.createElement('div');
      toast.className = `sq-message-toast ${type}`;

      // Add icon for typed toasts
      if (type !== 'default') {
        const icon = document.createElement('span');
        icon.className = 'sq-message-toast-icon';
        toast.appendChild(icon);
      }

      // Add message text
      const text = document.createElement('span');
      text.textContent = message;
      toast.appendChild(text);

      this.container.appendChild(toast);
      this.currentToast = toast;

      // Auto-dismiss after duration
      this.dismissTimeout = setTimeout(() => {
        this.dismiss();
        onDismiss?.();
        resolve();
      }, duration);
    });
  }

  /**
   * Show a success toast
   */
  success(message: string, duration = 2000): Promise<void> {
    return this.show(message, { type: 'success', duration });
  }

  /**
   * Show an error toast
   */
  error(message: string, duration = 2000): Promise<void> {
    return this.show(message, { type: 'error', duration });
  }

  /**
   * Show an info toast
   */
  info(message: string, duration = 2000): Promise<void> {
    return this.show(message, { type: 'info', duration });
  }

  /**
   * Show a warning toast
   */
  warning(message: string, duration = 2000): Promise<void> {
    return this.show(message, { type: 'warning', duration });
  }

  /**
   * Dismiss the current toast
   */
  dismiss(): void {
    if (this.dismissTimeout) {
      clearTimeout(this.dismissTimeout);
      this.dismissTimeout = null;
    }

    if (this.currentToast) {
      this.currentToast.classList.add('fading');
      const toast = this.currentToast;
      setTimeout(() => {
        toast.remove();
      }, 200);
      this.currentToast = null;
    }
  }

  /**
   * Destroy the toast container
   */
  destroy(): void {
    this.dismiss();
    this.container.remove();
  }
}
