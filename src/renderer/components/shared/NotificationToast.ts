/**
 * NotificationToast - Shared notification component
 *
 * Displays temporary toast notifications with different types/colors.
 * Automatically dismisses after a configurable duration.
 */

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationOptions {
  message: string;
  type?: NotificationType;
  duration?: number; // milliseconds
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export class NotificationToast {
  private static readonly DEFAULT_DURATION = 5000;
  private static readonly ANIMATION_DURATION = 300;

  private static readonly COLORS: Record<NotificationType, string> = {
    info: '#3498db',
    success: '#27ae60',
    warning: '#f39c12',
    error: '#e74c3c'
  };

  private static readonly POSITIONS: Record<string, string> = {
    'top-right': 'top: 80px; right: 20px;',
    'top-left': 'top: 80px; left: 20px;',
    'bottom-right': 'bottom: 20px; right: 20px;',
    'bottom-left': 'bottom: 20px; left: 20px;'
  };

  /**
   * Show a notification toast
   */
  public static show(options: string | NotificationOptions): void {
    // Allow simple string message or full options object
    const config: NotificationOptions = typeof options === 'string'
      ? { message: options }
      : options;

    const {
      message,
      type = 'info',
      duration = this.DEFAULT_DURATION,
      position = 'top-right'
    } = config;

    const notification = this.createNotificationElement(message, type, position);
    document.body.appendChild(notification);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    });

    // Auto-dismiss after duration
    setTimeout(() => {
      this.dismiss(notification);
    }, duration);
  }

  /**
   * Create the notification DOM element
   */
  private static createNotificationElement(
    message: string,
    type: NotificationType,
    position: string
  ): HTMLElement {
    const notification = document.createElement('div');
    notification.className = 'notification-toast';
    notification.style.cssText = `
      position: fixed;
      ${this.POSITIONS[position]}
      background-color: ${this.COLORS[type]};
      color: white;
      padding: 15px 20px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 2000;
      font-size: 14px;
      max-width: 350px;
      word-wrap: break-word;
      opacity: 0;
      transform: translateX(${position.includes('right') ? '100%' : '-100%'});
      transition: opacity ${this.ANIMATION_DURATION}ms ease,
                  transform ${this.ANIMATION_DURATION}ms ease;
    `;
    notification.textContent = message;

    return notification;
  }

  /**
   * Dismiss a notification with animation
   */
  private static dismiss(notification: HTMLElement): void {
    notification.style.opacity = '0';
    const isRight = notification.style.right !== '';
    notification.style.transform = `translateX(${isRight ? '100%' : '-100%'})`;

    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, this.ANIMATION_DURATION);
  }

  /**
   * Convenience methods for specific types
   */
  public static info(message: string, duration?: number): void {
    this.show({ message, type: 'info', duration });
  }

  public static success(message: string, duration?: number): void {
    this.show({ message, type: 'success', duration });
  }

  public static warning(message: string, duration?: number): void {
    this.show({ message, type: 'warning', duration });
  }

  public static error(message: string, duration?: number): void {
    this.show({ message, type: 'error', duration });
  }
}
