/**
 * WelcomeModal - Phase 6.3 Onboarding
 *
 * First-launch welcome flow to introduce users to ScribeCat's key features.
 * Multi-step interactive tutorial with skip option.
 *
 * Features:
 * - 3-slide introduction with visual examples
 * - Progress indicator
 * - Skip option for returning users
 * - "Don't show again" checkbox
 * - Smooth transitions between slides
 * - ARIA-compliant for accessibility
 *
 * @example
 * import { WelcomeModal } from './components/WelcomeModal';
 * WelcomeModal.show();
 */

import { FocusManager } from '../utils/FocusManager.js';
import { getIconHTML } from '../utils/iconMap.js';

interface WelcomeSlide {
  title: string;
  content: string;
  icon: string; // Emoji or SVG
  image?: string; // Optional illustration
  action?: {
    text: string;
    onClick: () => void;
  };
}

// Helper to generate icon HTML for welcome modal content
const welcomeIcon = (name: string, size = 18): string => getIconHTML(name as any, { size });

export class WelcomeModal {
  private static readonly STORAGE_KEY = 'scribecat_welcome_completed';
  private static slides: WelcomeSlide[] = [];

  private static initSlides(): void {
    if (this.slides.length > 0) return;

    this.slides = [
      {
        title: 'Welcome to ScribeCat! 🐱',
        content: `
          <p>Your intelligent study companion for transcription and note-taking.</p>
          <p>ScribeCat helps you capture lectures, meetings, and study sessions with powerful AI-powered tools to help you learn better.</p>
          <ul style="text-align: left; margin: 16px 0; line-height: 1.8;">
            <li>${welcomeIcon('mic')} <strong>Record & Transcribe</strong> - Real-time transcription</li>
            <li>${welcomeIcon('pencil')} <strong>Smart Notes</strong> - AI-enhanced note-taking</li>
            <li>${welcomeIcon('brain')} <strong>AI Study Tools</strong> - Flashcards, quizzes, summaries</li>
            <li>${welcomeIcon('chart')} <strong>Analytics</strong> - Track your progress</li>
          </ul>
        `,
        icon: '🐱'
      },
      {
        title: 'Record Your First Session',
        content: `
          <p>Getting started is easy!</p>
          <div style="text-align: left; margin: 16px 0; line-height: 1.8;">
            <p><strong>1. Click the red record button</strong> or press <kbd style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px;">Shift+Space</kbd></p>
            <p><strong>2. Your audio is transcribed in real-time</strong> - watch the words appear!</p>
            <p><strong>3. Take notes</strong> in the editor while recording</p>
            <p><strong>4. Click stop</strong> when you're done - your session is auto-saved</p>
          </div>
          <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-top: 16px;">
            <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">
              ${welcomeIcon('lightbulb')} <strong>Pro tip:</strong> Use the Command Palette (<kbd style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px;">Cmd+K</kbd>) to quickly access any feature!
            </p>
          </div>
        `,
        icon: 'mic'
      },
      {
        title: 'Supercharge Your Learning with Nugget',
        content: `
          <p>Nugget, your AI study companion, helps you study smarter, not harder!</p>
          <div style="text-align: left; margin: 16px 0; line-height: 1.8;">
            <p><strong>${welcomeIcon('bot')} Ask Questions</strong> - Chat with Nugget about your content</p>
            <p><strong>${welcomeIcon('layers')} Generate Flashcards</strong> - Automatic spaced repetition cards</p>
            <p><strong>${welcomeIcon('clipboard')} Create Quizzes</strong> - Test your understanding</p>
            <p><strong>${welcomeIcon('library')} Get Summaries</strong> - Quick overviews of long sessions</p>
            <p><strong>${welcomeIcon('calendar')} Make Study Plans</strong> - Personalized schedules</p>
          </div>
          <div style="background: var(--accent); color: white; padding: 12px; border-radius: 8px; margin-top: 16px;">
            <p style="margin: 0; font-size: 13px;">
              ✨ Nugget's suggestions appear automatically as you work - no need to ask!
            </p>
          </div>
        `,
        icon: 'bot'
      }
    ];
  }

  private overlay: HTMLElement | null = null;
  private currentSlide: number = 0;
  private focusTrap: ReturnType<typeof FocusManager.trapFocus> | null = null;

  /**
   * Check if welcome flow has been completed
   */
  public static hasCompletedWelcome(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) === 'true';
  }

  /**
   * Mark welcome flow as completed
   */
  public static markCompleted(): void {
    localStorage.setItem(this.STORAGE_KEY, 'true');
  }

  /**
   * Reset welcome flow (for testing or user request)
   */
  public static reset(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Show the welcome modal (if not already completed)
   */
  public static show(): WelcomeModal | null {
    if (this.hasCompletedWelcome()) {
      return null;
    }

    this.initSlides();
    const modal = new WelcomeModal();
    modal.render();
    return modal;
  }

  /**
   * Force show the welcome modal (even if completed)
   */
  public static forceShow(): WelcomeModal {
    this.initSlides();
    const modal = new WelcomeModal();
    modal.render();
    return modal;
  }

  /**
   * Render the welcome modal
   */
  private render(): void {
    this.createOverlay();
    this.renderSlide(this.currentSlide);
    this.setupFocusTrap();

    // Announce to screen readers
    FocusManager.announce('Welcome to ScribeCat tutorial started', 'polite');
  }

  /**
   * Create the modal overlay
   */
  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'welcome-modal-overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-labelledby', 'welcome-modal-title');
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fade-in 0.3s ease-out;
    `;

    document.body.appendChild(this.overlay);
    FocusManager.lockScroll();
  }

  /**
   * Render a specific slide
   */
  private renderSlide(index: number): void {
    if (!this.overlay) return;

    const slide = WelcomeModal.slides[index];
    const isFirstSlide = index === 0;
    const isLastSlide = index === WelcomeModal.slides.length - 1;

    const dialog = document.createElement('div');
    dialog.className = 'welcome-modal-dialog';
    dialog.style.cssText = `
      background: var(--bg-secondary);
      border-radius: var(--radius-xl);
      padding: 40px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: var(--shadow-xl);
      animation: slide-in 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;

    // Header with icon and title
    // Check if icon is an emoji (contains unicode emoji) or an icon key
    const isEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(slide.icon);
    const iconContent = isEmoji
      ? slide.icon
      : getIconHTML(slide.icon as any, { size: 64, strokeWidth: 1.5 });

    const header = document.createElement('div');
    header.style.cssText = 'text-align: center; margin-bottom: 24px;';
    header.innerHTML = `
      <div style="font-size: 64px; margin-bottom: 16px; animation: bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55); display: flex; justify-content: center; align-items: center;">
        ${iconContent}
      </div>
      <h2 id="welcome-modal-title" style="margin: 0; font-size: 28px; color: var(--text-primary);">
        ${slide.title}
      </h2>
    `;
    dialog.appendChild(header);

    // Content
    const content = document.createElement('div');
    content.style.cssText = 'color: var(--text-secondary); font-size: 15px; line-height: 1.6; text-align: center;';
    content.innerHTML = slide.content;
    dialog.appendChild(content);

    // Progress indicator
    const progress = this.createProgressIndicator(index);
    dialog.appendChild(progress);

    // Navigation buttons
    const nav = document.createElement('div');
    nav.style.cssText = 'display: flex; gap: 12px; justify-content: space-between; margin-top: 32px; align-items: center;';

    // Skip button (only on first slide)
    if (isFirstSlide) {
      const skipBtn = document.createElement('button');
      skipBtn.textContent = 'Skip Tutorial';
      skipBtn.className = 'secondary-btn';
      skipBtn.style.cssText = 'flex: 0;';
      skipBtn.addEventListener('click', () => this.skip());
      nav.appendChild(skipBtn);
    } else {
      const backBtn = document.createElement('button');
      backBtn.innerHTML = `${getIconHTML('arrowLeft', { size: 14 })} Back`;
      backBtn.className = 'secondary-btn';
      backBtn.addEventListener('click', () => this.previousSlide());
      nav.appendChild(backBtn);
    }

    // Spacer
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    nav.appendChild(spacer);

    // Next/Finish button
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = isLastSlide ? 'Get Started! 🚀' : `Next ${getIconHTML('arrowRight', { size: 14 })}`;
    nextBtn.className = 'primary-btn';
    nextBtn.addEventListener('click', () => {
      if (isLastSlide) {
        this.complete();
      } else {
        this.nextSlide();
      }
    });
    nav.appendChild(nextBtn);

    dialog.appendChild(nav);

    // Add to overlay (remove previous slide if exists)
    this.overlay.innerHTML = '';
    this.overlay.appendChild(dialog);

    // Update focus trap
    this.updateFocusTrap();
  }

  /**
   * Create progress indicator dots
   */
  private createProgressIndicator(currentIndex: number): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: center;
      margin-top: 24px;
    `;
    container.setAttribute('role', 'progressbar');
    container.setAttribute('aria-valuenow', String(currentIndex + 1));
    container.setAttribute('aria-valuemin', '1');
    container.setAttribute('aria-valuemax', String(WelcomeModal.slides.length));
    container.setAttribute('aria-label', `Step ${currentIndex + 1} of ${WelcomeModal.slides.length}`);

    WelcomeModal.slides.forEach((_, index) => {
      const dot = document.createElement('div');
      dot.style.cssText = `
        width: ${index === currentIndex ? '24px' : '8px'};
        height: 8px;
        border-radius: 4px;
        background: ${index === currentIndex ? 'var(--accent)' : 'var(--bg-tertiary)'};
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      `;
      container.appendChild(dot);
    });

    return container;
  }

  /**
   * Go to next slide
   */
  private nextSlide(): void {
    if (this.currentSlide < WelcomeModal.slides.length - 1) {
      this.currentSlide++;
      this.renderSlide(this.currentSlide);
      FocusManager.announce(`Step ${this.currentSlide + 1} of ${WelcomeModal.slides.length}`, 'polite');
    }
  }

  /**
   * Go to previous slide
   */
  private previousSlide(): void {
    if (this.currentSlide > 0) {
      this.currentSlide--;
      this.renderSlide(this.currentSlide);
      FocusManager.announce(`Step ${this.currentSlide + 1} of ${WelcomeModal.slides.length}`, 'polite');
    }
  }

  /**
   * Skip the tutorial
   */
  private skip(): void {
    WelcomeModal.markCompleted();
    this.close();
    FocusManager.announce('Welcome tutorial skipped', 'polite');
  }

  /**
   * Complete the tutorial
   */
  private complete(): void {
    WelcomeModal.markCompleted();
    this.close();
    FocusManager.announce('Welcome tutorial completed. Welcome to ScribeCat!', 'polite');

    // Show celebration
    this.showCompletionCelebration();
  }

  /**
   * Show completion celebration
   */
  private showCompletionCelebration(): void {
    // Create confetti effect (assuming confetti.ts exists from exploration)
    if (typeof (window as any).confetti !== 'undefined') {
      (window as any).confetti.achievement();
    }

    // Show notification
    const notificationTicker = (window as any).notificationTicker;
    if (notificationTicker) {
      notificationTicker.success("You're all set! Ready to start recording and taking notes.", 4000);
    }
  }

  /**
   * Close the modal
   */
  public close(): void {
    if (this.focusTrap) {
      this.focusTrap.release();
      this.focusTrap = null;
    }

    if (this.overlay) {
      this.overlay.style.animation = 'fade-out 0.2s ease-out';
      setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
          document.body.removeChild(this.overlay);
          this.overlay = null;
        }
        FocusManager.unlockScroll();
      }, 200);
    }
  }

  /**
   * Setup focus trap for modal
   */
  private setupFocusTrap(): void {
    if (this.overlay) {
      this.focusTrap = FocusManager.trapFocus(this.overlay, {
        onEscape: () => this.skip(),
        autoFocus: true
      });
    }
  }

  /**
   * Update focus trap when slide changes
   */
  private updateFocusTrap(): void {
    if (this.focusTrap) {
      this.focusTrap.update();
    }
  }
}

// Add animations to document
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  @keyframes slide-in {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
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

  @keyframes bounce-in {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    50% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .welcome-modal-overlay,
    .welcome-modal-dialog,
    .welcome-modal-overlay *,
    .welcome-modal-dialog * {
      animation-duration: 0.01ms !important;
    }
  }

  /* Welcome modal scrollbar styling */
  .welcome-modal-dialog::-webkit-scrollbar {
    width: 8px;
  }

  .welcome-modal-dialog::-webkit-scrollbar-track {
    background: var(--bg-primary);
    border-radius: 4px;
  }

  .welcome-modal-dialog::-webkit-scrollbar-thumb {
    background: var(--bg-tertiary);
    border-radius: 4px;
  }

  .welcome-modal-dialog::-webkit-scrollbar-thumb:hover {
    background: var(--accent);
  }
`;
document.head.appendChild(styleSheet);

/**
 * Auto-show welcome modal on first launch
 * Call this in your app initialization
 */
export function initializeWelcomeFlow(): void {
  // Wait for DOM to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => WelcomeModal.show(), 500);
    });
  } else {
    setTimeout(() => WelcomeModal.show(), 500);
  }
}
