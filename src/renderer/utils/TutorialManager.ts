/**
 * TutorialManager - Phase 6.3 Onboarding
 *
 * Interactive tutorial system with spotlight effects to guide users through features.
 * Highlights specific UI elements and provides step-by-step guidance.
 *
 * Features:
 * - Spotlight effect (dim background, highlight target)
 * - Contextual tooltips with arrows
 * - Step tracking and progress
 * - Multiple tutorial flows
 * - Persistent state (remembers completed tutorials)
 * - Skip/pause functionality
 * - ARIA-compliant
 *
 * @example
 * TutorialManager.start('recording-basics');
 * TutorialManager.skip();
 * TutorialManager.reset('recording-basics');
 */

import { FocusManager } from './FocusManager.js';

export interface TutorialStep {
  /** Selector for element to highlight */
  target: string;
  /** Title of the step */
  title: string;
  /** Description/instruction text */
  content: string;
  /** Position of tooltip relative to target */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Action to perform before showing step (e.g., open a panel) */
  beforeShow?: () => void | Promise<void>;
  /** Action to perform after step is completed */
  afterComplete?: () => void;
  /** Custom action button */
  action?: {
    text: string;
    onClick: () => void | Promise<void>;
  };
  /** If true, automatically skip this step if the target element is not found */
  optional?: boolean;
}

export interface Tutorial {
  id: string;
  name: string;
  description: string;
  steps: TutorialStep[];
  /** Whether this tutorial can be auto-started */
  autoStart?: boolean;
  /** Minimum wait time before auto-start (ms) */
  autoStartDelay?: number;
}

export class TutorialManager {
  private static instance: TutorialManager | null = null;
  private static readonly STORAGE_PREFIX = 'scribecat_tutorial_';

  private tutorials: Map<string, Tutorial> = new Map();
  private currentTutorial: Tutorial | null = null;
  private currentStep: number = 0;
  private overlay: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;
  private focusTrap: ReturnType<typeof FocusManager.trapFocus> | null = null;

  /**
   * Default tutorials built into ScribeCat
   */
  private static readonly DEFAULT_TUTORIALS: Tutorial[] = [
    {
      id: 'recording-basics',
      name: 'Recording Basics',
      description: 'Learn how to record and transcribe your first session',
      steps: [
        {
          target: '#record-btn',
          title: 'Start Recording',
          content: 'Click this button or press <kbd>Shift+Space</kbd> to start recording. Your audio will be transcribed in real-time!',
          position: 'bottom',
          beforeShow: async () => {
            // Ensure we're in recording view, not study mode
            const studyModeBtn = document.getElementById('study-mode-btn');
            const studyModeActive = document.querySelector('.view-container.active');

            // If in study mode, exit it first
            if (studyModeActive && studyModeBtn) {
              console.log('Exiting study mode to show recording tutorial');
              studyModeBtn.click();
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
        },
        {
          target: '#microphone-select',
          title: 'Choose Your Microphone',
          content: 'Select your preferred microphone from the dropdown. The system microphone is selected by default.',
          position: 'bottom'
        },
        {
          target: '#transcription-container',
          title: 'Real-Time Transcription',
          content: 'Watch your words appear here as you speak! Powered by AssemblyAI, the transcription streams in real-time with high accuracy.',
          position: 'right'
        },
        {
          target: '#tiptap-editor',
          title: 'Take Notes',
          content: 'While recording, you can take additional notes here. Format text, add images, create lists - it\'s all saved automatically.',
          position: 'left'
        },
        {
          target: '#record-btn',
          title: 'Stop Recording',
          content: 'Click the button again or press <kbd>Shift+Space</kbd> to stop. Your session is automatically saved - no manual save needed!',
          position: 'bottom'
        }
      ]
    },
    {
      id: 'ai-tools-intro',
      name: 'AI Tools Introduction',
      description: 'Discover how AI can supercharge your studying',
      steps: [
        {
          target: '#floating-chat-btn',
          title: 'AI Assistant',
          content: 'Click here to open the AI chat. Ask questions about your content, get explanations, or request summaries.',
          position: 'left',
          beforeShow: async () => {
            // Ensure we have a session selected
            const chatBtn = document.querySelector('#floating-chat-btn');
            if (chatBtn) {
              (chatBtn as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
        },
        {
          target: '#ai-chat-drawer',
          title: 'Chat with Your Content',
          content: 'The AI can access your session content (you can choose what to include). Try asking "What are the main topics?" or "Explain this concept".',
          position: 'left',
          beforeShow: async () => {
            // Open AI chat drawer
            const chatBtn = document.querySelector('#floating-chat-btn') as HTMLElement;
            if (chatBtn) chatBtn.click();
            await new Promise(resolve => setTimeout(resolve, 300)); // Wait for drawer to open
          }
        },
        {
          target: '.session-detail-right .ai-study-tools',
          title: 'AI Tool Library',
          content: 'Here are all the AI study tools! Generate flashcards, create quizzes, get summaries, and more. All tools are context-aware and work with your session content.',
          position: 'left',
          beforeShow: async () => {
            // Close AI chat drawer if it's open
            const chatDrawer = document.getElementById('ai-chat-drawer');
            if (chatDrawer && !chatDrawer.classList.contains('hidden')) {
              const chatBtn = document.querySelector('#floating-chat-btn') as HTMLElement;
              if (chatBtn) chatBtn.click();
              await new Promise(resolve => setTimeout(resolve, 300));
            }

            // Navigate to Study Mode if not already there
            const studyModeBtn = document.getElementById('study-mode-btn');
            const studyModeActive = studyModeBtn?.classList.contains('active');

            if (studyModeBtn && !studyModeActive) {
              console.log('Opening Study Mode for AI tools tutorial');
              studyModeBtn.click();
              await new Promise(resolve => setTimeout(resolve, 800)); // Initial wait for Study Mode to start loading
            }

            // Poll for sessions to appear (sessions load asynchronously)
            const waitForSessions = async (maxAttempts = 10): Promise<NodeListOf<Element> | null> => {
              for (let i = 0; i < maxAttempts; i++) {
                // Check for sessions in all view modes: grid (.session-card), list (.list-row), timeline, board
                const sessionCards = document.querySelectorAll('.session-card, .list-row, .session-list-item');
                if (sessionCards.length > 0) {
                  console.log(`Found ${sessionCards.length} sessions after ${i + 1} attempts`);
                  return sessionCards;
                }
                console.log(`Waiting for sessions to load... attempt ${i + 1}/${maxAttempts}`);
                await new Promise(resolve => setTimeout(resolve, 300));
              }
              return null;
            };

            // Open first session if not already viewing one
            const sessionDetailView = document.querySelector('.session-detail-view');
            if (!sessionDetailView) {
              const sessionCards = await waitForSessions();
              if (sessionCards && sessionCards.length > 0) {
                console.log('Opening first session for AI tools tutorial');
                (sessionCards[0] as HTMLElement).click();
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for session detail to render
              } else {
                console.warn('No sessions available for AI tools tutorial - user needs to create a session first');
              }
            } else {
              console.log('Session detail already open');
              // Session detail already open, wait for AI tools to render
              await new Promise(resolve => setTimeout(resolve, 400));
            }
          }
        }
      ]
    },
    {
      id: 'study-mode',
      name: 'Study Mode Tour',
      description: 'Learn how to use Study Mode for review and practice',
      steps: [
        {
          target: '#study-mode-btn',
          title: 'Enter Study Mode',
          content: 'Study Mode shows all your sessions with AI-generated study materials. Click here to enter.',
          position: 'bottom',
          action: {
            text: 'Open Study Mode',
            onClick: async () => {
              const btn = document.querySelector('#study-mode-btn') as HTMLElement;
              if (btn) btn.click();
            }
          }
        },
        {
          target: '#session-list',
          title: 'Your Sessions',
          content: 'All your recorded sessions appear here. Click any session to review transcription, notes, and AI tools.',
          position: 'right'
        },
        {
          target: '.search-bar-container',
          title: 'Smart Search',
          content: 'Search across all sessions, transcriptions, notes, and AI-generated content. Try "photosynthesis" or "exam prep".',
          position: 'bottom'
        }
      ]
    },
    {
      id: 'keyboard-shortcuts',
      name: 'Keyboard Shortcuts',
      description: 'Master keyboard shortcuts for faster workflow',
      steps: [
        {
          target: 'body',
          title: 'Command Palette',
          content: 'Press <kbd>Cmd+K</kbd> anywhere to open the command palette. Search for any action - no need to remember where buttons are!',
          position: 'center',
          action: {
            text: 'Try It (Cmd+K)',
            onClick: async () => {
              // Trigger command palette
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
            }
          }
        },
        {
          target: 'body',
          title: 'Shortcuts Overlay',
          content: 'Press <kbd>?</kbd> to see all keyboard shortcuts. This overlay shows context-specific shortcuts based on where you are in the app.',
          position: 'center',
          action: {
            text: 'Show Shortcuts (?)',
            onClick: async () => {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
            }
          }
        },
        {
          target: '#tiptap-editor',
          title: 'Text Formatting',
          content: 'Use standard shortcuts: <kbd>Cmd+B</kbd> for bold, <kbd>Cmd+I</kbd> for italic, <kbd>Cmd+U</kbd> for underline. More shortcuts available in the ? overlay!',
          position: 'top'
        }
      ]
    }
  ];

  private constructor() {
    // Initialize with default tutorials
    TutorialManager.DEFAULT_TUTORIALS.forEach(tutorial => {
      this.tutorials.set(tutorial.id, tutorial);
    });
  }

  /**
   * Get or create singleton instance
   */
  public static getInstance(): TutorialManager {
    if (!this.instance) {
      this.instance = new TutorialManager();
    }
    return this.instance;
  }

  /**
   * Start a tutorial by ID
   */
  public static start(tutorialId: string): boolean {
    const instance = this.getInstance();
    const tutorial = instance.tutorials.get(tutorialId);

    if (!tutorial) {
      console.warn(`Tutorial "${tutorialId}" not found`);
      return false;
    }

    instance.startTutorial(tutorial);
    return true;
  }

  /**
   * Skip the current tutorial
   */
  public static skip(): void {
    const instance = this.getInstance();
    instance.skipTutorial();
  }

  /**
   * Pause the current tutorial
   */
  public static pause(): void {
    const instance = this.getInstance();
    instance.pauseTutorial();
  }

  /**
   * Resume a paused tutorial
   */
  public static resume(tutorialId: string): void {
    const instance = this.getInstance();
    this.start(tutorialId);
  }

  /**
   * Check if tutorial has been completed
   */
  public static isCompleted(tutorialId: string): boolean {
    return localStorage.getItem(`${this.STORAGE_PREFIX}${tutorialId}`) === 'completed';
  }

  /**
   * Mark tutorial as completed
   */
  public static markCompleted(tutorialId: string): void {
    localStorage.setItem(`${this.STORAGE_PREFIX}${tutorialId}`, 'completed');
  }

  /**
   * Reset a tutorial (mark as not completed)
   */
  public static reset(tutorialId: string): void {
    localStorage.removeItem(`${this.STORAGE_PREFIX}${tutorialId}`);
  }

  /**
   * Reset all tutorials
   */
  public static resetAll(): void {
    TutorialManager.DEFAULT_TUTORIALS.forEach(tutorial => {
      this.reset(tutorial.id);
    });
  }

  /**
   * Get all available tutorials
   */
  public static getAllTutorials(): Tutorial[] {
    return this.getInstance().tutorials.values().toArray();
  }

  /**
   * Register a custom tutorial
   */
  public static register(tutorial: Tutorial): void {
    this.getInstance().tutorials.set(tutorial.id, tutorial);
  }

  /**
   * Start a tutorial
   */
  private startTutorial(tutorial: Tutorial): void {
    this.currentTutorial = tutorial;
    this.currentStep = 0;
    this.showStep(0);
    FocusManager.announce(`Starting tutorial: ${tutorial.name}`, 'polite');
  }

  /**
   * Show a specific step
   */
  private async showStep(index: number): Promise<void> {
    if (!this.currentTutorial || index >= this.currentTutorial.steps.length) {
      this.completeTutorial();
      return;
    }

    const step = this.currentTutorial.steps[index];
    this.currentStep = index;

    // Execute beforeShow hook
    if (step.beforeShow) {
      await step.beforeShow();
      await new Promise(resolve => setTimeout(resolve, 100)); // Allow UI to update
    }

    // Create overlay if doesn't exist
    if (!this.overlay) {
      this.createOverlay();
    }

    // Disable LayoutManager's resize listener to prevent layout shifts during tutorial
    const layoutManager = (window as any).layoutManager;
    if (layoutManager && index === 0) {
      // Only disable on first step
      layoutManager.disableResizeListener();
    }

    // Highlight target element
    const elementFound = this.highlightElement(step.target);

    // If element not found after beforeShow hook
    if (!elementFound) {
      // If this step is marked as optional, skip it automatically
      if (step.optional) {
        console.log(`Tutorial step ${index + 1} skipped - optional element "${step.target}" not found`);
        FocusManager.announce(`Skipping optional step: ${step.title}`, 'polite');

        // Automatically move to next step
        await this.showStep(index + 1);
        return;
      }

      // For required steps, show error
      console.error(`Tutorial step ${index + 1} failed: Element "${step.target}" not found`);

      // Generate helpful, context-aware error message
      const errorMsg = this.getContextualErrorMessage(step, this.currentTutorial!.id);

      // Create error tooltip
      this.showErrorTooltip(errorMsg);

      // Announce error
      FocusManager.announce('Tutorial step failed - required element not found', 'assertive');
      return;
    }

    // Show tooltip
    this.showTooltip(step);

    // Announce step to screen readers
    FocusManager.announce(
      `Step ${index + 1} of ${this.currentTutorial.steps.length}: ${step.title}`,
      'polite'
    );
  }

  /**
   * Create the spotlight overlay (NO scrim - completely invisible)
   */
  private createOverlay(): void {
    // Create overlay but make it completely invisible - no background whatsoever
    this.overlay = document.createElement('div');
    this.overlay.className = 'tutorial-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: none !important;
      backdrop-filter: none !important;
      z-index: 9998;
      pointer-events: none;
      opacity: 0;
    `;
    document.body.appendChild(this.overlay);
  }

  /**
   * Get context-aware error message for missing tutorial elements
   */
  private getContextualErrorMessage(step: TutorialStep, tutorialId: string): string {
    // Provide helpful, specific guidance based on the missing element
    const errorMessages: Record<string, string> = {
      '.session-detail-right .ai-study-tools': `
        <p><strong>No Session Open</strong></p>
        <p>To see AI study tools, you need to have a recorded session first.</p>
        <p><strong>What to do:</strong></p>
        <ul style="text-align: left; margin: 12px 0; padding-left: 20px;">
          <li>Record your first session using the Record button</li>
          <li>Then open Study Mode and select the session</li>
          <li>Restart this tutorial to see AI tools in action!</li>
        </ul>
      `,
      '#ai-suggestion-chip': `
        <p><strong>AI Suggestions Not Available</strong></p>
        <p>The AI suggestion chip appears when ScribeCat has smart recommendations for you.</p>
        <p><strong>What to do:</strong></p>
        <ul style="text-align: left; margin: 12px 0; padding-left: 20px;">
          <li>Record a session with some content</li>
          <li>The AI will automatically suggest helpful actions</li>
          <li>For now, you can skip to the next step</li>
        </ul>
      `,
      '#session-list': `
        <p><strong>No Sessions Yet</strong></p>
        <p>Study Mode shows all your recorded sessions, but you haven't created any yet!</p>
        <p><strong>What to do:</strong></p>
        <ul style="text-align: left; margin: 12px 0; padding-left: 20px;">
          <li>Exit this tutorial and record your first session</li>
          <li>Then come back to explore Study Mode features</li>
        </ul>
      `
    };

    // Return specific message if available, otherwise generic
    return errorMessages[step.target] || `
      <p><strong>Tutorial Step Unavailable</strong></p>
      <p>This tutorial step requires "${step.title}" to be visible, but it's not available right now.</p>
      <p><strong>What to do:</strong></p>
      <p style="text-align: left; margin: 12px 0;">Try skipping this step or restarting the tutorial after you've used the app a bit more.</p>
    `;
  }

  /**
   * Highlight a target element with spotlight effect
   */
  private highlightElement(selector: string): boolean {
    const element = document.querySelector(selector) as HTMLElement;

    if (!element) {
      console.warn(`Tutorial target "${selector}" not found - skipping step`);
      return false;
    }

    // Remove previous highlights
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
      el.classList.remove('tutorial-highlight');
    });

    // Add highlight class (all styling handled via CSS to avoid layout shifts)
    element.classList.add('tutorial-highlight');

    // DON'T scroll - prevents all viewport shifts and layout changes
    // Users can manually scroll if element is not visible

    // Add pulsing glow effect
    if (!document.querySelector('#tutorial-highlight-style')) {
      const style = document.createElement('style');
      style.id = 'tutorial-highlight-style';
      style.textContent = `
        .tutorial-highlight {
          /* Only use visual effects that DON'T affect layout */
          outline: 4px solid var(--accent) !important;
          outline-offset: 4px !important;
          box-shadow: 0 0 40px rgba(0, 122, 204, 0.9),
                      0 0 70px rgba(0, 122, 204, 0.5),
                      inset 0 0 0 2000px rgba(0, 122, 204, 0.08) !important;
          border-radius: var(--radius-md) !important;
          animation: tutorial-pulse 2s ease-in-out infinite !important;
          /* NO position, z-index, or pointer-events changes - these cause layout shifts */
        }

        /* Light theme variant - stronger shadow for visibility on light backgrounds */
        [data-theme*="light"] .tutorial-highlight {
          outline: 4px solid #005a9e !important;
          box-shadow: 0 0 40px rgba(0, 90, 158, 0.7),
                      0 0 70px rgba(0, 90, 158, 0.4),
                      inset 0 0 0 2000px rgba(0, 122, 204, 0.15) !important;
        }

        @keyframes tutorial-pulse {
          0%, 100% {
            outline-offset: 4px;
            box-shadow: 0 0 40px rgba(0, 122, 204, 0.9),
                        0 0 70px rgba(0, 122, 204, 0.5),
                        inset 0 0 0 2000px rgba(0, 122, 204, 0.08);
          }
          50% {
            outline-offset: 6px;
            box-shadow: 0 0 50px rgba(0, 122, 204, 1),
                        0 0 80px rgba(0, 122, 204, 0.7),
                        inset 0 0 0 2000px rgba(0, 122, 204, 0.12);
          }
        }

        /* Light theme pulse animation */
        [data-theme*="light"] .tutorial-highlight {
          animation: tutorial-pulse-light 2s ease-in-out infinite !important;
        }

        @keyframes tutorial-pulse-light {
          0%, 100% {
            outline-offset: 4px;
            box-shadow: 0 0 40px rgba(0, 90, 158, 0.7),
                        0 0 70px rgba(0, 90, 158, 0.4),
                        inset 0 0 0 2000px rgba(0, 122, 204, 0.15);
          }
          50% {
            outline-offset: 6px;
            box-shadow: 0 0 50px rgba(0, 90, 158, 0.9),
                        0 0 80px rgba(0, 90, 158, 0.6),
                        inset 0 0 0 2000px rgba(0, 122, 204, 0.2);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .tutorial-highlight {
            animation: none !important;
          }
        }

        /* kbd element styling for tutorial tooltips */
        .tutorial-tooltip kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          height: 28px;
          padding: 0 8px;
          background: var(--bg-tertiary, #3d3d3d);
          border: 1px solid var(--border, #404040);
          border-radius: 6px;
          font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary, #ffffff);
          box-shadow: 0 2px 0 var(--border, #404040);
        }

        /* Light theme kbd - HIGH CONTRAST for readability */
        [data-theme*="light"] .tutorial-tooltip kbd {
          background: #e8e8e8 !important;
          border-color: #c0c0c0 !important;
          color: #1a1a1a !important;
          box-shadow: 0 2px 0 #c0c0c0 !important;
        }
      `;
      document.head.appendChild(style);
    }

    return true;
  }

  /**
   * Show tooltip for current step
   */
  private showTooltip(step: TutorialStep): void {
    // Remove existing tooltip
    if (this.tooltip) {
      this.tooltip.remove();
    }

    const target = document.querySelector(step.target) as HTMLElement;
    if (!target) return;

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tutorial-tooltip';
    this.tooltip.setAttribute('role', 'dialog');
    this.tooltip.setAttribute('aria-labelledby', 'tutorial-tooltip-title');
    this.tooltip.style.cssText = `
      position: fixed;
      background: var(--bg-primary);
      border: 3px solid var(--accent);
      border-radius: var(--radius-lg);
      padding: 20px;
      max-width: 350px;
      z-index: 10000;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
      animation: tooltip-pop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      pointer-events: auto;
    `;

    // Progress indicator
    const progress = document.createElement('div');
    progress.style.cssText = `
      font-size: 12px;
      color: var(--text-tertiary);
      margin-bottom: 8px;
      font-weight: 600;
    `;
    progress.textContent = `${this.currentStep + 1} of ${this.currentTutorial!.steps.length}`;
    this.tooltip.appendChild(progress);

    // Title
    const title = document.createElement('h3');
    title.id = 'tutorial-tooltip-title';
    title.style.cssText = 'margin: 0 0 12px 0; font-size: 18px; color: var(--text-primary);';
    title.textContent = step.title;
    this.tooltip.appendChild(title);

    // Content
    const content = document.createElement('div');
    content.style.cssText = 'color: var(--text-secondary); font-size: 14px; line-height: 1.6; margin-bottom: 16px;';
    content.innerHTML = step.content;
    this.tooltip.appendChild(content);

    // Buttons
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display: flex; gap: 8px; justify-content: space-between;';

    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'Skip';
    skipBtn.className = 'secondary-btn';
    skipBtn.style.fontSize = '13px';
    skipBtn.style.padding = '8px 12px';
    skipBtn.addEventListener('click', () => this.skipTutorial());
    buttons.appendChild(skipBtn);

    if (step.action) {
      const actionBtn = document.createElement('button');
      actionBtn.textContent = step.action.text;
      actionBtn.className = 'secondary-btn';
      actionBtn.style.fontSize = '13px';
      actionBtn.style.padding = '8px 12px';
      actionBtn.addEventListener('click', async () => {
        if (step.action) await step.action.onClick();
      });
      buttons.appendChild(actionBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.textContent = this.currentStep === this.currentTutorial!.steps.length - 1 ? 'Finish' : 'Next →';
    nextBtn.className = 'primary-btn';
    nextBtn.style.fontSize = '13px';
    nextBtn.style.padding = '8px 12px';
    nextBtn.addEventListener('click', () => this.nextStep());
    buttons.appendChild(nextBtn);

    this.tooltip.appendChild(buttons);

    document.body.appendChild(this.tooltip);

    // Position tooltip
    this.positionTooltip(step.position || 'bottom', target);

    // Setup focus trap
    this.focusTrap = FocusManager.trapFocus(this.tooltip, {
      onEscape: () => this.skipTutorial()
    });
  }

  /**
   * Show error tooltip when tutorial step fails
   */
  private showErrorTooltip(errorMessage: string): void {
    // Remove existing tooltip
    if (this.tooltip) {
      this.tooltip.remove();
    }

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tutorial-tooltip tutorial-error';
    this.tooltip.setAttribute('role', 'alertdialog');
    this.tooltip.setAttribute('aria-labelledby', 'tutorial-error-title');
    this.tooltip.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--bg-primary);
      border: 3px solid #e74c3c;
      border-radius: var(--radius-lg);
      padding: 24px;
      max-width: 400px;
      z-index: 10000;
      box-shadow: 0 12px 48px rgba(231, 76, 60, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
      animation: tooltip-pop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;

    // Error icon and content
    this.tooltip.innerHTML = `
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
        <div id="tutorial-error-title" style="color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
          ${errorMessage}
        </div>
      </div>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button class="secondary-btn" id="tutorial-error-close" style="flex: 1;">
          Close Tutorial
        </button>
      </div>
    `;

    document.body.appendChild(this.tooltip);

    // Close button handler
    this.tooltip.querySelector('#tutorial-error-close')?.addEventListener('click', () => {
      this.skipTutorial();
    });

    // Setup focus trap
    this.focusTrap = FocusManager.trapFocus(this.tooltip, {
      onEscape: () => this.skipTutorial()
    });
  }

  /**
   * Position tooltip relative to target
   */
  private positionTooltip(position: string, target: HTMLElement): void {
    if (!this.tooltip) return;

    const rect = target.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const padding = 20;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = rect.top - tooltipRect.height - padding;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = rect.bottom + padding;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.left - tooltipRect.width - padding;
        break;
      case 'right':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.right + padding;
        break;
      case 'center':
        top = window.innerHeight / 2 - tooltipRect.height / 2;
        left = window.innerWidth / 2 - tooltipRect.width / 2;
        break;
    }

    // Keep tooltip in viewport
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));

    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
  }

  /**
   * Go to next step
   */
  private async nextStep(): Promise<void> {
    if (!this.currentTutorial) return;

    const step = this.currentTutorial.steps[this.currentStep];

    // Execute afterComplete hook
    if (step.afterComplete) {
      step.afterComplete();
    }

    // Remove highlight (all styles are in CSS class, so just remove the class)
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
      el.classList.remove('tutorial-highlight');
    });

    await this.showStep(this.currentStep + 1);
  }

  /**
   * Skip tutorial
   */
  private skipTutorial(): void {
    if (this.currentTutorial) {
      FocusManager.announce('Tutorial skipped', 'polite');
    }
    this.cleanup();
  }

  /**
   * Pause tutorial
   */
  private pauseTutorial(): void {
    this.cleanup();
  }

  /**
   * Complete tutorial
   */
  private completeTutorial(): void {
    if (this.currentTutorial) {
      TutorialManager.markCompleted(this.currentTutorial.id);
      FocusManager.announce(`Tutorial "${this.currentTutorial.name}" completed`, 'polite');

      // Show completion notification
      const notificationTicker = (window as any).notificationTicker;
      if (notificationTicker) {
        notificationTicker.success(`✅ Tutorial Complete! ${this.currentTutorial.name}`, 3000);
      }
    }

    this.cleanup();
  }

  /**
   * Cleanup tutorial UI
   */
  private cleanup(): void {
    // Re-enable LayoutManager's resize listener
    const layoutManager = (window as any).layoutManager;
    if (layoutManager) {
      layoutManager.enableResizeListener();
    }

    // Release focus trap
    if (this.focusTrap) {
      this.focusTrap.release();
      this.focusTrap = null;
    }

    // Remove tooltip
    if (this.tooltip) {
      this.tooltip.style.animation = 'fade-out 0.2s ease-out';
      setTimeout(() => {
        if (this.tooltip) {
          this.tooltip.remove();
          this.tooltip = null;
        }
      }, 200);
    }

    // Remove overlay
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    // Remove highlights (all styles are in CSS class, so just remove the class)
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
      el.classList.remove('tutorial-highlight');
    });

    this.currentTutorial = null;
    this.currentStep = 0;
  }
}

// Add CSS animations
const tutorialStyles = document.createElement('style');
tutorialStyles.textContent = `
  @keyframes tooltip-pop {
    0% {
      transform: scale(0.8);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
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

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;
document.head.appendChild(tutorialStyles);
