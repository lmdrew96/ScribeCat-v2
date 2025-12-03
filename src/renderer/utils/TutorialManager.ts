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
 * Delegates to:
 * - TutorialFlowDefinitions: Default tutorial step definitions
 * - TutorialStepRenderer: Overlay, highlight, tooltip rendering
 *
 * @example
 * TutorialManager.start('recording-basics');
 * TutorialManager.skip();
 * TutorialManager.reset('recording-basics');
 */

import { FocusManager } from './FocusManager.js';
import {
  type Tutorial,
  type TutorialStep,
  DEFAULT_TUTORIALS,
  TutorialStepRenderer,
  getContextualErrorMessage,
} from './tutorial/index.js';

// Re-export types for external use
export type { Tutorial, TutorialStep };

export class TutorialManager {
  private static instance: TutorialManager | null = null;
  private static readonly STORAGE_PREFIX = 'scribecat_tutorial_';

  private tutorials: Map<string, Tutorial> = new Map();
  private currentTutorial: Tutorial | null = null;
  private currentStep: number = 0;
  private renderer: TutorialStepRenderer;

  private constructor() {
    // Initialize with default tutorials
    DEFAULT_TUTORIALS.forEach(tutorial => {
      this.tutorials.set(tutorial.id, tutorial);
    });

    // Initialize renderer with callbacks
    this.renderer = new TutorialStepRenderer({
      getCurrentStep: () => this.currentStep,
      getTotalSteps: () => this.currentTutorial?.steps.length || 0,
      nextStep: () => this.nextStep(),
      skipTutorial: () => this.skipTutorial(),
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
    DEFAULT_TUTORIALS.forEach(tutorial => {
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
    if (!this.renderer.hasOverlay()) {
      this.renderer.createOverlay();
    }

    // Disable LayoutManager's resize listener to prevent layout shifts during tutorial
    const layoutManager = (window as any).layoutManager;
    if (layoutManager && index === 0) {
      layoutManager.disableResizeListener();
    }

    // Highlight target element
    const elementFound = this.renderer.highlightElement(step.target);

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
      const errorMsg = getContextualErrorMessage(step, this.currentTutorial!.id);

      // Create error tooltip
      this.renderer.showErrorTooltip(errorMsg);

      // Announce error
      FocusManager.announce('Tutorial step failed - required element not found', 'assertive');
      return;
    }

    // Show tooltip
    this.renderer.showTooltip(step);

    // Announce step to screen readers
    FocusManager.announce(
      `Step ${index + 1} of ${this.currentTutorial.steps.length}: ${step.title}`,
      'polite'
    );
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

    // Remove highlight
    this.renderer.removeHighlights();

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

    // Cleanup renderer
    this.renderer.cleanup();

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
