/**
 * BreakReminders - Phase 6.4 Personality & Delight
 *
 * Encourages healthy study habits by reminding users to take breaks during long sessions.
 * ADHD-friendly with gentle, cat-themed reminders.
 *
 * Features:
 * - Detects study sessions > configured duration (default 50min)
 * - Gentle, dismissible reminders
 * - Pomodoro timer option
 * - Streak tracking
 * - Encouraging messages
 * - Cat-themed personality
 *
 * @example
 * BreakReminders.start();
 * BreakReminders.setInterval(50); // 50 minutes
 * BreakReminders.showReminder();
 */

import { SoundManager } from '../audio/SoundManager.js';
import { FocusManager } from '../utils/FocusManager.js';

interface BreakReminderConfig {
  /** Minutes between break reminders (default: 50) */
  intervalMinutes: number;
  /** Whether reminders are enabled */
  enabled: boolean;
  /** Pomodoro mode (structured 25/5 work/break cycles) */
  pomodoroMode: boolean;
  /** Play sound with reminder */
  playSound: boolean;
}

interface StudySession {
  startTime: number;
  lastBreakTime: number;
  totalStudyTime: number;
  breaksaken: number;
}

export class BreakReminders {
  private static instance: BreakReminders | null = null;
  private static readonly STORAGE_KEY = 'scribecat_break_reminders';
  private static readonly SESSION_KEY = 'scribecat_current_session';

  private config: BreakReminderConfig = {
    intervalMinutes: 50,
    enabled: true,
    pomodoroMode: false,
    playSound: true
  };

  private currentSession: StudySession | null = null;
  private checkInterval: number | null = null;
  private reminderTimeout: number | null = null;

  /**
   * Cat-themed break messages
   */
  private static readonly BREAK_MESSAGES = [
    {
      title: 'Time for a stretch! 🐱',
      message: 'You\'ve been studying hard for {duration}. Your brain (and this cat) thinks you deserve a break!',
      suggestion: 'Take 5-10 minutes to stretch, hydrate, or pet a cat.'
    },
    {
      title: 'Purr-fect time for a break! 😸',
      message: 'Great focus for {duration}! Even cats need to stretch between naps.',
      suggestion: 'Walk around, grab a snack, or just close your eyes for a bit.'
    },
    {
      title: 'Break time, human! 🐈',
      message: 'You\'ve been at it for {duration}. Time to recharge those batteries!',
      suggestion: 'Stand up, look away from the screen, and maybe do some shoulder rolls.'
    },
    {
      title: 'Your brain needs a catnap! 😺',
      message: 'Impressive {duration} of focus! Your hippocampus will thank you for a quick break.',
      suggestion: 'Science says breaks improve memory retention. Go get some fresh air!'
    },
    {
      title: 'Meow-ment to pause! 🐱',
      message: 'After {duration} of hard work, it\'s time to rest those neurons.',
      suggestion: 'Try the 20-20-20 rule: look at something 20 feet away for 20 seconds.'
    }
  ];

  /**
   * Pomodoro break messages (shorter, more structured)
   */
  private static readonly POMODORO_MESSAGES = [
    {
      title: 'Pomodoro complete! 🍅',
      message: 'Great 25-minute focus session! Time for your 5-minute break.',
      suggestion: 'Quick stretch, water, then back to it!'
    },
    {
      title: 'Long break time! 🐱',
      message: 'You\'ve completed 4 pomodoros! Take a longer 15-30 minute break.',
      suggestion: 'You\'ve earned this. Go for a walk, have a snack, or take a real break.'
    }
  ];

  private constructor() {
    this.loadConfig();
    this.loadSession();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): BreakReminders {
    if (!this.instance) {
      this.instance = new BreakReminders();
    }
    return this.instance;
  }

  /**
   * Start tracking study time
   */
  public static start(): void {
    const instance = this.getInstance();

    if (!instance.config.enabled) {
      return;
    }

    // Create new session if none exists
    if (!instance.currentSession) {
      instance.currentSession = {
        startTime: Date.now(),
        lastBreakTime: Date.now(),
        totalStudyTime: 0,
        breaksaken: 0
      };
      instance.saveSession();
    }

    // Start checking periodically (every minute)
    if (!instance.checkInterval) {
      instance.checkInterval = window.setInterval(() => {
        instance.checkBreakTime();
      }, 60000); // Check every minute
    }

    console.log('Break reminders started');
  }

  /**
   * Stop tracking (e.g., when app is closed or user stops studying)
   */
  public static stop(): void {
    const instance = this.getInstance();

    if (instance.checkInterval) {
      clearInterval(instance.checkInterval);
      instance.checkInterval = null;
    }

    if (instance.reminderTimeout) {
      clearTimeout(instance.reminderTimeout);
      instance.reminderTimeout = null;
    }

    // Save final session data
    if (instance.currentSession) {
      instance.currentSession.totalStudyTime += Date.now() - instance.currentSession.startTime;
      instance.saveSession();
    }

    console.log('Break reminders stopped');
  }

  /**
   * Set break interval in minutes
   */
  public static setInterval(minutes: number): void {
    const instance = this.getInstance();
    instance.config.intervalMinutes = Math.max(5, Math.min(120, minutes)); // 5-120 min range
    instance.saveConfig();
  }

  /**
   * Enable/disable break reminders
   */
  public static setEnabled(enabled: boolean): void {
    const instance = this.getInstance();
    instance.config.enabled = enabled;
    instance.saveConfig();

    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  /**
   * Enable/disable Pomodoro mode
   */
  public static setPomodoroMode(enabled: boolean): void {
    const instance = this.getInstance();
    instance.config.pomodoroMode = enabled;
    instance.saveConfig();

    if (enabled) {
      instance.config.intervalMinutes = 25; // Pomodoro standard
      instance.saveConfig();
    }
  }

  /**
   * Enable/disable sound notifications
   */
  public static setPlaySound(play: boolean): void {
    const instance = this.getInstance();
    instance.config.playSound = play;
    instance.saveConfig();
  }

  /**
   * Get current configuration
   */
  public static getConfig(): BreakReminderConfig {
    return { ...this.getInstance().config };
  }

  /**
   * Get current session stats
   */
  public static getSessionStats(): StudySession | null {
    const instance = this.getInstance();
    if (!instance.currentSession) return null;

    return {
      ...instance.currentSession,
      totalStudyTime: instance.currentSession.totalStudyTime + (Date.now() - instance.currentSession.startTime)
    };
  }

  /**
   * Manually show a break reminder
   */
  public static showReminder(): void {
    this.getInstance().displayBreakReminder();
  }

  /**
   * Record that user took a break
   */
  public static recordBreak(): void {
    const instance = this.getInstance();

    if (instance.currentSession) {
      instance.currentSession.lastBreakTime = Date.now();
      instance.currentSession.breaksaken++;
      instance.saveSession();

      // Celebrate break!
      if (instance.config.playSound) {
        SoundManager.play('purr');
      }

      FocusManager.announce('Break recorded. Great job taking care of yourself!', 'polite');
    }
  }

  /**
   * End current session and show summary
   */
  public static endSession(): void {
    const instance = this.getInstance();

    if (instance.currentSession) {
      const totalTime = Date.now() - instance.currentSession.startTime;
      const hours = Math.floor(totalTime / 3600000);
      const minutes = Math.floor((totalTime % 3600000) / 60000);

      // Show session summary
      instance.showSessionSummary(hours, minutes, instance.currentSession.breaksTaken);

      // Clear session
      instance.currentSession = null;
      localStorage.removeItem(BreakReminders.SESSION_KEY);
    }

    this.stop();
  }

  /**
   * Check if it's time for a break
   */
  private checkBreakTime(): void {
    if (!this.currentSession || !this.config.enabled) return;

    const timeSinceLastBreak = Date.now() - this.currentSession.lastBreakTime;
    const breakIntervalMs = this.config.intervalMinutes * 60000;

    if (timeSinceLastBreak >= breakIntervalMs) {
      this.displayBreakReminder();
    }
  }

  /**
   * Display break reminder modal
   */
  private displayBreakReminder(): void {
    const timeSinceLastBreak = this.currentSession
      ? Date.now() - this.currentSession.lastBreakTime
      : 0;

    const duration = this.formatDuration(timeSinceLastBreak);

    // Choose message
    const messages = this.config.pomodoroMode
      ? BreakReminders.POMODORO_MESSAGES
      : BreakReminders.BREAK_MESSAGES;

    const messageIndex = this.config.pomodoroMode && this.currentSession?.breaksTaken % 4 === 0
      ? 1 // Long break after 4 pomodoros
      : Math.floor(Math.random() * messages.length);

    const message = messages[messageIndex];

    // Play sound
    if (this.config.playSound) {
      SoundManager.play('meow');
    }

    // Create reminder modal
    this.createReminderModal(message, duration);

    // Announce to screen readers
    FocusManager.announce(`Break reminder: ${message.title}`, 'assertive');
  }

  /**
   * Create reminder modal UI
   */
  private createReminderModal(message: { title: string; message: string; suggestion: string }, duration: string): void {
    // Check if modal already exists
    if (document.querySelector('.break-reminder-modal')) {
      return; // Don't show duplicate
    }

    const overlay = document.createElement('div');
    overlay.className = 'break-reminder-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: fade-in 0.3s ease-out;
    `;

    const modal = document.createElement('div');
    modal.className = 'break-reminder-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'break-reminder-title');
    modal.style.cssText = `
      background: var(--bg-secondary);
      border-radius: var(--radius-xl);
      padding: 32px;
      max-width: 450px;
      width: 90%;
      box-shadow: var(--shadow-xl);
      border: 2px solid var(--accent);
      animation: slide-bounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;

    modal.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 56px; margin-bottom: 16px; animation: bounce 1s ease-in-out infinite;">
          🐱
        </div>
        <h2 id="break-reminder-title" style="margin: 0 0 12px 0; font-size: 24px; color: var(--text-primary);">
          ${message.title}
        </h2>
        <p style="color: var(--text-secondary); font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
          ${message.message.replace('{duration}', duration)}
        </p>
        <div style="background: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-md); margin: 0 0 24px 0;">
          <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
            💡 <strong>Suggestion:</strong> ${message.suggestion}
          </p>
        </div>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button class="secondary-btn" id="break-snooze" style="flex: 1;">
            Snooze (10min)
          </button>
          <button class="primary-btn" id="break-take" style="flex: 1;">
            Take a Break ✨
          </button>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    FocusManager.lockScroll();

    // Button handlers
    const snoozeBtn = modal.querySelector('#break-snooze') as HTMLButtonElement;
    const takeBreakBtn = modal.querySelector('#break-take') as HTMLButtonElement;

    snoozeBtn.addEventListener('click', () => {
      this.snoozeReminder(10);
      this.closeModal(overlay);
    });

    takeBreakBtn.addEventListener('click', () => {
      BreakReminders.recordBreak();
      this.closeModal(overlay);
      this.startBreakTimer();
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.snoozeReminder(10);
        this.closeModal(overlay);
      }
    });

    // Close on Escape
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.snoozeReminder(10);
        this.closeModal(overlay);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  /**
   * Snooze reminder for specified minutes
   */
  private snoozeReminder(minutes: number): void {
    if (this.currentSession) {
      this.currentSession.lastBreakTime = Date.now() - ((this.config.intervalMinutes - minutes) * 60000);
      this.saveSession();
    }
  }

  /**
   * Start break timer (optional countdown)
   */
  private startBreakTimer(): void {
    const breakDuration = this.config.pomodoroMode ? 5 : 10; // 5 or 10 minutes

    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--success);
      color: white;
      padding: 16px 24px;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      z-index: 10001;
      animation: slide-in-right 0.3s ease-out;
    `;
    toast.innerHTML = `
      <strong>🌟 Break started!</strong>
      <p style="margin: 4px 0 0 0; font-size: 13px;">Relax for ${breakDuration} minutes. You've earned it!</p>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fade-out 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 5000);

    // Optional: Set timer for end of break
    setTimeout(() => {
      if (this.config.playSound) {
        SoundManager.play('bell');
      }
      FocusManager.announce('Break time is over. Ready to continue?', 'polite');
    }, breakDuration * 60000);
  }

  /**
   * Close reminder modal
   */
  private closeModal(overlay: HTMLElement): void {
    overlay.style.animation = 'fade-out 0.2s ease-out';
    setTimeout(() => {
      overlay.remove();
      FocusManager.unlockScroll();
    }, 200);
  }

  /**
   * Show session summary
   */
  private showSessionSummary(hours: number, minutes: number, breaksTaken: number): void {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--bg-secondary);
      border-radius: var(--radius-xl);
      padding: 32px;
      max-width: 400px;
      z-index: 10000;
      box-shadow: var(--shadow-xl);
      text-align: center;
      animation: slide-bounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;

    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    modal.innerHTML = `
      <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
      <h2 style="margin: 0 0 16px 0; color: var(--text-primary);">Study Session Complete!</h2>
      <div style="background: var(--bg-tertiary); padding: 20px; border-radius: var(--radius-md); margin-bottom: 20px;">
        <p style="margin: 0 0 12px 0; font-size: 32px; font-weight: bold; color: var(--accent);">${timeStr}</p>
        <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">Total study time</p>
        <p style="margin: 12px 0 0 0; color: var(--text-secondary); font-size: 14px;">
          ${breaksTaken} break${breaksTaken !== 1 ? 's' : ''} taken
        </p>
      </div>
      <p style="color: var(--text-secondary); margin-bottom: 20px;">Great work! You're building strong study habits. 🌟</p>
      <button class="primary-btn" id="close-summary" style="width: 100%;">Awesome!</button>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#close-summary')?.addEventListener('click', () => {
      modal.remove();
    });

    // Play celebration sound
    if (this.config.playSound) {
      SoundManager.play('success');
    }
  }

  /**
   * Format duration in milliseconds to readable string
   */
  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);

    if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Load config from localStorage
   */
  private loadConfig(): void {
    const saved = localStorage.getItem(BreakReminders.STORAGE_KEY);
    if (saved) {
      try {
        this.config = { ...this.config, ...JSON.parse(saved) };
      } catch (error) {
        console.warn('Failed to load break reminder config:', error);
      }
    }
  }

  /**
   * Save config to localStorage
   */
  private saveConfig(): void {
    localStorage.setItem(BreakReminders.STORAGE_KEY, JSON.stringify(this.config));
  }

  /**
   * Load session from localStorage
   */
  private loadSession(): void {
    const saved = localStorage.getItem(BreakReminders.SESSION_KEY);
    if (saved) {
      try {
        this.currentSession = JSON.parse(saved);
      } catch (error) {
        console.warn('Failed to load session:', error);
      }
    }
  }

  /**
   * Save session to localStorage
   */
  private saveSession(): void {
    if (this.currentSession) {
      localStorage.setItem(BreakReminders.SESSION_KEY, JSON.stringify(this.currentSession));
    }
  }
}

// Add CSS animations
const breakReminderStyles = document.createElement('style');
breakReminderStyles.textContent = `
  @keyframes slide-bounce {
    0% {
      transform: translate(-50%, -50%) scale(0.8);
      opacity: 0;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.05);
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  @keyframes slide-in-right {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(breakReminderStyles);

/**
 * Initialize break reminders
 * Call this during app initialization
 */
export function initializeBreakReminders(): void {
  // Auto-start if enabled
  const config = BreakReminders.getConfig();
  if (config.enabled) {
    BreakReminders.start();
  }
}
