/**
 * Button Controller
 *
 * Global button enhancement system that adds GSAP-powered animations:
 * - Ripple effects on click
 * - Loading state with spinner
 * - Success state with animated checkmark
 * - Error state with shake animation
 */

import gsap from 'gsap';
import { AnimationService, Durations, Easings } from '../effects/AnimationService.js';

export class ButtonController {
  private animationService: AnimationService;
  private activeRipples: Map<HTMLElement, HTMLElement[]> = new Map();

  constructor() {
    this.animationService = AnimationService.getInstance();
    this.initializeGlobalListeners();
  }

  /**
   * Initialize global event listeners for automatic button enhancement
   */
  private initializeGlobalListeners(): void {
    // Ripple effect on click
    document.addEventListener('click', this.handleClick.bind(this), true);

    // Press feedback on mousedown
    document.addEventListener('mousedown', this.handleMouseDown.bind(this), true);

    // Release feedback on mouseup
    document.addEventListener('mouseup', this.handleMouseUp.bind(this), true);
  }

  /**
   * Handle click for ripple effect
   */
  private handleClick(e: MouseEvent): void {
    const button = this.getButtonElement(e.target as HTMLElement);
    if (!button || button.classList.contains('no-ripple') || button.disabled) return;

    this.createRipple(button, e.clientX, e.clientY);
  }

  /**
   * Handle mousedown for press effect
   */
  private handleMouseDown(e: MouseEvent): void {
    const button = this.getButtonElement(e.target as HTMLElement);
    if (!button || button.disabled) return;

    // Add pressing class for CSS-based shadow reduction
    button.classList.add('pressing');
  }

  /**
   * Handle mouseup for release effect
   */
  private handleMouseUp(e: MouseEvent): void {
    const button = this.getButtonElement(e.target as HTMLElement);
    if (!button) return;

    // Remove pressing class
    button.classList.remove('pressing');
  }

  /**
   * Get button element from event target (handles clicks on child elements)
   */
  private getButtonElement(target: HTMLElement): HTMLButtonElement | null {
    const button = target.closest('button, .primary-btn, .secondary-btn, .danger-btn, .icon-btn');
    return button as HTMLButtonElement | null;
  }

  /**
   * Create ripple effect at click position
   */
  public createRipple(button: HTMLElement, clientX: number, clientY: number): void {
    if (this.animationService.isReducedMotion()) return;

    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';

    // Calculate ripple size (should cover the entire button)
    const size = Math.max(rect.width, rect.height) * 2.5;

    // Position ripple at click point
    const x = clientX - rect.left - size / 2;
    const y = clientY - rect.top - size / 2;

    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    button.appendChild(ripple);

    // Track active ripples
    if (!this.activeRipples.has(button)) {
      this.activeRipples.set(button, []);
    }
    this.activeRipples.get(button)!.push(ripple);

    // Animate ripple expansion and fade
    gsap.fromTo(ripple,
      { scale: 0, opacity: 0.5 },
      {
        scale: 1,
        opacity: 0,
        duration: Durations.ripple,
        ease: Easings.neo,
        onComplete: () => {
          ripple.remove();
          const ripples = this.activeRipples.get(button);
          if (ripples) {
            const index = ripples.indexOf(ripple);
            if (index > -1) ripples.splice(index, 1);
          }
        }
      }
    );
  }

  /**
   * Set button to loading state
   */
  public setLoading(button: HTMLElement, loading: boolean): void {
    if (loading) {
      button.classList.add('loading');
      button.setAttribute('disabled', 'true');

      // Create spinner if not exists
      if (!button.querySelector('.btn-spinner')) {
        const spinner = this.createSpinner();
        button.appendChild(spinner);

        // Animate spinner rotation
        gsap.to(spinner.querySelector('.btn-spinner-circle'), {
          rotation: 360,
          duration: 0.8,
          ease: 'none',
          repeat: -1,
          transformOrigin: 'center center'
        });
      }
    } else {
      button.classList.remove('loading');
      button.removeAttribute('disabled');

      // Remove spinner
      const spinner = button.querySelector('.btn-spinner');
      if (spinner) {
        gsap.killTweensOf(spinner.querySelector('.btn-spinner-circle'));
        spinner.remove();
      }
    }
  }

  /**
   * Create loading spinner SVG
   */
  private createSpinner(): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('btn-spinner');
    svg.setAttribute('viewBox', '0 0 24 24');

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.classList.add('btn-spinner-circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');

    svg.appendChild(circle);
    return svg;
  }

  /**
   * Set button to success state with animated checkmark
   * @returns Promise that resolves when animation completes
   */
  public async setSuccess(button: HTMLElement, duration: number = 1500): Promise<void> {
    // Remove loading state if present
    this.setLoading(button, false);

    button.classList.add('success');

    // Create checkmark if not exists
    if (!button.querySelector('.btn-checkmark')) {
      const checkmark = this.createCheckmark();
      button.appendChild(checkmark);

      // Animate checkmark draw
      const path = checkmark.querySelector('.btn-checkmark-path');
      if (path) {
        gsap.to(path, {
          strokeDashoffset: 0,
          duration: 0.3,
          ease: Easings.neo,
          delay: 0.1
        });
      }
    }

    // Pulse animation
    this.animationService.buttonSuccess(button);

    // Wait and reset
    return new Promise(resolve => {
      setTimeout(() => {
        button.classList.remove('success');
        const checkmark = button.querySelector('.btn-checkmark');
        if (checkmark) checkmark.remove();
        resolve();
      }, duration);
    });
  }

  /**
   * Create success checkmark SVG
   */
  private createCheckmark(): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('btn-checkmark');
    svg.setAttribute('viewBox', '0 0 24 24');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('btn-checkmark-path');
    path.setAttribute('d', 'M4 12l6 6L20 6');

    svg.appendChild(path);
    return svg;
  }

  /**
   * Set button to error state with shake animation
   * @returns Promise that resolves when animation completes
   */
  public async setError(button: HTMLElement, duration: number = 1000): Promise<void> {
    // Remove loading state if present
    this.setLoading(button, false);

    button.classList.add('error');

    // Shake animation
    this.animationService.buttonError(button);

    // Wait and reset
    return new Promise(resolve => {
      setTimeout(() => {
        button.classList.remove('error');
        resolve();
      }, duration);
    });
  }

  /**
   * Trigger a manual ripple at center of button
   * (useful for keyboard activation)
   */
  public triggerRipple(button: HTMLElement): void {
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    this.createRipple(button, centerX, centerY);
  }

  /**
   * Clean up all active ripples on a button
   */
  public clearRipples(button: HTMLElement): void {
    const ripples = this.activeRipples.get(button);
    if (ripples) {
      ripples.forEach(ripple => {
        gsap.killTweensOf(ripple);
        ripple.remove();
      });
      this.activeRipples.delete(button);
    }
  }

  /**
   * Destroy controller and remove all listeners
   */
  public destroy(): void {
    document.removeEventListener('click', this.handleClick.bind(this), true);
    document.removeEventListener('mousedown', this.handleMouseDown.bind(this), true);
    document.removeEventListener('mouseup', this.handleMouseUp.bind(this), true);

    // Clean up all ripples
    this.activeRipples.forEach((ripples, button) => {
      this.clearRipples(button);
    });
  }
}

// Singleton instance
let buttonControllerInstance: ButtonController | null = null;

/**
 * Get or create the ButtonController instance
 */
export function getButtonController(): ButtonController {
  if (!buttonControllerInstance) {
    buttonControllerInstance = new ButtonController();
  }
  return buttonControllerInstance;
}
