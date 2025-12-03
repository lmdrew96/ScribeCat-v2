/**
 * TutorialStepRenderer
 *
 * Handles rendering of tutorial UI: overlay, highlights, tooltips.
 */

import { FocusManager } from '../FocusManager.js';
import type { TutorialStep } from './types.js';

export interface StepRendererCallbacks {
  getCurrentStep: () => number;
  getTotalSteps: () => number;
  nextStep: () => Promise<void>;
  skipTutorial: () => void;
}

export class TutorialStepRenderer {
  private overlay: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;
  private focusTrap: ReturnType<typeof FocusManager.trapFocus> | null = null;
  private callbacks: StepRendererCallbacks;

  constructor(callbacks: StepRendererCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Create the spotlight overlay (NO scrim - completely invisible)
   */
  createOverlay(): void {
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

  hasOverlay(): boolean {
    return this.overlay !== null;
  }

  /**
   * Highlight a target element with spotlight effect
   */
  highlightElement(selector: string): boolean {
    const element = document.querySelector(selector) as HTMLElement;

    if (!element) {
      console.warn(`Tutorial target "${selector}" not found - skipping step`);
      return false;
    }

    // Remove previous highlights
    this.removeHighlights();

    // Add highlight class (all styling handled via CSS to avoid layout shifts)
    element.classList.add('tutorial-highlight');

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
  showTooltip(step: TutorialStep): void {
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
    progress.textContent = `${this.callbacks.getCurrentStep() + 1} of ${this.callbacks.getTotalSteps()}`;
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
    skipBtn.addEventListener('click', () => this.callbacks.skipTutorial());
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
    const isLastStep = this.callbacks.getCurrentStep() === this.callbacks.getTotalSteps() - 1;
    nextBtn.textContent = isLastStep ? 'Finish' : 'Next →';
    nextBtn.className = 'primary-btn';
    nextBtn.style.fontSize = '13px';
    nextBtn.style.padding = '8px 12px';
    nextBtn.addEventListener('click', () => this.callbacks.nextStep());
    buttons.appendChild(nextBtn);

    this.tooltip.appendChild(buttons);

    document.body.appendChild(this.tooltip);

    // Position tooltip
    this.positionTooltip(step.position || 'bottom', target);

    // Setup focus trap
    this.focusTrap = FocusManager.trapFocus(this.tooltip, {
      onEscape: () => this.callbacks.skipTutorial()
    });
  }

  /**
   * Show error tooltip when tutorial step fails
   */
  showErrorTooltip(errorMessage: string): void {
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
      this.callbacks.skipTutorial();
    });

    // Setup focus trap
    this.focusTrap = FocusManager.trapFocus(this.tooltip, {
      onEscape: () => this.callbacks.skipTutorial()
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
   * Remove all highlight classes
   */
  removeHighlights(): void {
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
      el.classList.remove('tutorial-highlight');
    });
  }

  /**
   * Cleanup all tutorial UI
   */
  cleanup(): void {
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

    // Remove highlights
    this.removeHighlights();
  }
}

/**
 * Get context-aware error message for missing tutorial elements
 */
export function getContextualErrorMessage(step: TutorialStep, _tutorialId: string): string {
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
