/**
 * Animation Service
 *
 * Core singleton wrapping GSAP for consistent animations throughout ScribeCat.
 * Provides standardized durations, easings, and factory methods for common animations.
 */

import gsap from 'gsap';

/**
 * Standard animation durations (in seconds)
 */
export const Durations = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
  modal: 0.35,
  ripple: 0.6
} as const;

/**
 * Neobrutalism-optimized easings
 * Snappy with personality - matches the bold design language
 */
export const Easings = {
  // Standard - snappy out
  neo: 'power2.out',
  neoIn: 'power2.in',
  neoInOut: 'power2.inOut',

  // Bounce - slight overshoot for playful feedback
  bounce: 'back.out(1.4)',
  bounceIn: 'back.in(1.4)',

  // Elastic - for special effects
  elastic: 'elastic.out(1, 0.5)',

  // Spring - smooth deceleration
  spring: 'power4.out',

  // Linear - for continuous animations
  linear: 'none'
} as const;

export interface AnimationOptions {
  duration?: number;
  ease?: string;
  delay?: number;
  onComplete?: () => void;
}

export class AnimationService {
  private static instance: AnimationService;
  private reducedMotion = false;

  private constructor() {
    // Check for reduced motion preference
    this.checkReducedMotion();

    // Listen for changes to reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addEventListener('change', () => this.checkReducedMotion());
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AnimationService {
    if (!AnimationService.instance) {
      AnimationService.instance = new AnimationService();
    }
    return AnimationService.instance;
  }

  /**
   * Check and apply reduced motion preference
   */
  private checkReducedMotion(): void {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (this.reducedMotion) {
      // Speed up all animations to be nearly instant
      gsap.globalTimeline.timeScale(20);
    } else {
      gsap.globalTimeline.timeScale(1);
    }
  }

  /**
   * Check if reduced motion is enabled
   */
  public isReducedMotion(): boolean {
    return this.reducedMotion;
  }

  /**
   * Set reduced motion programmatically
   */
  public setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    gsap.globalTimeline.timeScale(enabled ? 20 : 1);
  }

  // ========== Button Animations ==========

  /**
   * Button click feedback - scale down and back
   */
  public buttonClick(element: HTMLElement, options?: AnimationOptions): gsap.core.Tween {
    if (this.reducedMotion) {
      return gsap.set(element, {});
    }

    return gsap.to(element, {
      scale: 0.95,
      duration: options?.duration ?? Durations.fast,
      ease: Easings.neoIn,
      yoyo: true,
      repeat: 1,
      onComplete: options?.onComplete
    });
  }

  /**
   * Button press (hold) animation
   */
  public buttonPress(element: HTMLElement): gsap.core.Tween {
    if (this.reducedMotion) {
      return gsap.set(element, { scale: 0.95 });
    }

    return gsap.to(element, {
      scale: 0.95,
      duration: Durations.fast,
      ease: Easings.neoIn
    });
  }

  /**
   * Button release animation
   */
  public buttonRelease(element: HTMLElement): gsap.core.Tween {
    return gsap.to(element, {
      scale: 1,
      duration: Durations.fast,
      ease: Easings.bounce
    });
  }

  /**
   * Success state animation - pulse green
   */
  public buttonSuccess(element: HTMLElement): gsap.core.Timeline {
    const tl = gsap.timeline();

    if (this.reducedMotion) {
      tl.set(element, { backgroundColor: 'var(--success)' });
      return tl;
    }

    tl.to(element, {
      scale: 1.05,
      duration: Durations.fast,
      ease: Easings.bounce
    })
    .to(element, {
      scale: 1,
      duration: Durations.base,
      ease: Easings.neo
    });

    return tl;
  }

  /**
   * Error state animation - shake
   */
  public buttonError(element: HTMLElement): gsap.core.Tween {
    if (this.reducedMotion) {
      return gsap.set(element, {});
    }

    return gsap.to(element, {
      x: [-4, 4, -4, 4, 0],
      duration: Durations.base,
      ease: Easings.neo
    });
  }

  // ========== Modal Animations ==========

  /**
   * Modal open animation timeline
   */
  public modalOpen(
    overlay: HTMLElement,
    content: HTMLElement,
    header?: HTMLElement | null,
    bodyItems?: NodeListOf<Element> | HTMLElement[] | null,
    footer?: HTMLElement | null
  ): gsap.core.Timeline {
    const tl = gsap.timeline();

    if (this.reducedMotion) {
      tl.set([overlay, content, header, footer].filter(Boolean), { opacity: 1 });
      if (bodyItems) tl.set(bodyItems, { opacity: 1 });
      return tl;
    }

    // Set initial states
    gsap.set(overlay, { opacity: 0 });
    gsap.set(content, { y: 30, opacity: 0, scale: 0.95 });
    if (header) gsap.set(header, { x: -10, opacity: 0 });
    if (bodyItems && bodyItems.length > 0) gsap.set(bodyItems, { y: 15, opacity: 0 });
    if (footer) gsap.set(footer, { y: 10, opacity: 0 });

    // Animate overlay
    tl.to(overlay, {
      opacity: 1,
      duration: 0.2,
      ease: Easings.neo
    });

    // Animate content with spring
    tl.to(content, {
      y: 0,
      opacity: 1,
      scale: 1,
      duration: Durations.modal,
      ease: Easings.bounce
    }, '-=0.1');

    // Animate header
    if (header) {
      tl.to(header, {
        x: 0,
        opacity: 1,
        duration: 0.2,
        ease: Easings.neo
      }, '-=0.2');
    }

    // Stagger body items
    if (bodyItems && bodyItems.length > 0) {
      tl.to(bodyItems, {
        y: 0,
        opacity: 1,
        duration: 0.3,
        stagger: 0.05,
        ease: Easings.neo
      }, '-=0.15');
    }

    // Animate footer
    if (footer) {
      tl.to(footer, {
        y: 0,
        opacity: 1,
        duration: 0.2,
        ease: Easings.neo
      }, '-=0.2');
    }

    return tl;
  }

  /**
   * Modal close animation timeline
   */
  public modalClose(overlay: HTMLElement, content: HTMLElement): gsap.core.Timeline {
    const tl = gsap.timeline();

    if (this.reducedMotion) {
      tl.set([overlay, content], { opacity: 0 });
      return tl;
    }

    tl.to(content, {
      y: 20,
      opacity: 0,
      scale: 0.95,
      duration: 0.2,
      ease: Easings.neoIn
    });

    tl.to(overlay, {
      opacity: 0,
      duration: 0.15
    }, '-=0.1');

    return tl;
  }

  // ========== General Animations ==========

  /**
   * Fade in element
   */
  public fadeIn(element: HTMLElement, options?: AnimationOptions): gsap.core.Tween {
    if (this.reducedMotion) {
      return gsap.set(element, { opacity: 1 });
    }

    gsap.set(element, { opacity: 0 });
    return gsap.to(element, {
      opacity: 1,
      duration: options?.duration ?? Durations.base,
      ease: options?.ease ?? Easings.neo,
      delay: options?.delay ?? 0,
      onComplete: options?.onComplete
    });
  }

  /**
   * Fade out element
   */
  public fadeOut(element: HTMLElement, options?: AnimationOptions): gsap.core.Tween {
    if (this.reducedMotion) {
      return gsap.set(element, { opacity: 0 });
    }

    return gsap.to(element, {
      opacity: 0,
      duration: options?.duration ?? Durations.base,
      ease: options?.ease ?? Easings.neo,
      delay: options?.delay ?? 0,
      onComplete: options?.onComplete
    });
  }

  /**
   * Slide in from direction
   */
  public slideIn(
    element: HTMLElement,
    direction: 'up' | 'down' | 'left' | 'right' = 'up',
    options?: AnimationOptions
  ): gsap.core.Tween {
    const distance = 20;
    const from: gsap.TweenVars = { opacity: 0 };

    switch (direction) {
      case 'up': from.y = distance; break;
      case 'down': from.y = -distance; break;
      case 'left': from.x = distance; break;
      case 'right': from.x = -distance; break;
    }

    if (this.reducedMotion) {
      return gsap.set(element, { opacity: 1, x: 0, y: 0 });
    }

    gsap.set(element, from);
    return gsap.to(element, {
      x: 0,
      y: 0,
      opacity: 1,
      duration: options?.duration ?? Durations.base,
      ease: options?.ease ?? Easings.neo,
      delay: options?.delay ?? 0,
      onComplete: options?.onComplete
    });
  }

  /**
   * Stagger animation for multiple elements
   */
  public staggerIn(
    elements: HTMLElement[] | NodeListOf<Element>,
    options?: AnimationOptions & { stagger?: number }
  ): gsap.core.Tween {
    if (this.reducedMotion) {
      return gsap.set(elements, { opacity: 1, y: 0 });
    }

    gsap.set(elements, { opacity: 0, y: 15 });
    return gsap.to(elements, {
      y: 0,
      opacity: 1,
      duration: options?.duration ?? Durations.base,
      stagger: options?.stagger ?? 0.05,
      ease: options?.ease ?? Easings.neo,
      delay: options?.delay ?? 0,
      onComplete: options?.onComplete
    });
  }

  /**
   * Scale pop animation (for notifications, badges, etc.)
   */
  public pop(element: HTMLElement, options?: AnimationOptions): gsap.core.Tween {
    if (this.reducedMotion) {
      return gsap.set(element, { scale: 1, opacity: 1 });
    }

    gsap.set(element, { scale: 0, opacity: 0 });
    return gsap.to(element, {
      scale: 1,
      opacity: 1,
      duration: options?.duration ?? Durations.base,
      ease: Easings.bounce,
      delay: options?.delay ?? 0,
      onComplete: options?.onComplete
    });
  }

  /**
   * Pulse animation (for attention)
   */
  public pulse(element: HTMLElement, options?: AnimationOptions): gsap.core.Tween {
    if (this.reducedMotion) {
      return gsap.set(element, {});
    }

    return gsap.to(element, {
      scale: [1, 1.05, 1],
      duration: options?.duration ?? 0.5,
      ease: Easings.neoInOut,
      repeat: options?.delay ?? 0, // Using delay as repeat count for simplicity
      onComplete: options?.onComplete
    });
  }

  // ========== Utility Methods ==========

  /**
   * Kill all animations on an element
   */
  public kill(element: HTMLElement): void {
    gsap.killTweensOf(element);
  }

  /**
   * Create a new timeline
   */
  public timeline(options?: gsap.TimelineVars): gsap.core.Timeline {
    return gsap.timeline(options);
  }

  /**
   * Direct access to gsap.to for custom animations
   */
  public to(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
    if (this.reducedMotion && vars.duration && vars.duration > 0.05) {
      vars.duration = 0.01;
    }
    return gsap.to(target, vars);
  }

  /**
   * Direct access to gsap.fromTo for custom animations
   */
  public fromTo(
    target: gsap.TweenTarget,
    fromVars: gsap.TweenVars,
    toVars: gsap.TweenVars
  ): gsap.core.Tween {
    if (this.reducedMotion && toVars.duration && toVars.duration > 0.05) {
      toVars.duration = 0.01;
    }
    return gsap.fromTo(target, fromVars, toVars);
  }

  /**
   * Direct access to gsap.set for immediate property changes
   */
  public set(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
    return gsap.set(target, vars);
  }
}

// Export singleton getter for convenience
export function getAnimationService(): AnimationService {
  return AnimationService.getInstance();
}
