/**
 * Modal Animations
 *
 * GSAP-powered modal open/close animations with staggered content.
 * Provides smooth, choreographed transitions for modals.
 */

import gsap from 'gsap';
import { AnimationService, Durations, Easings } from './AnimationService.js';

export interface ModalElements {
  modal: HTMLElement;
  overlay?: HTMLElement | null;
  content?: HTMLElement | null;
  header?: HTMLElement | null;
  body?: HTMLElement | null;
  footer?: HTMLElement | null;
}

export class ModalAnimator {
  private animationService: AnimationService;

  constructor() {
    this.animationService = AnimationService.getInstance();
  }

  /**
   * Animate modal open with choreographed sequence
   */
  public async open(elements: ModalElements): Promise<void> {
    const { modal, overlay, content, header, body, footer } = elements;

    // Find elements if not provided
    const overlayEl = overlay ?? modal.querySelector('.modal-overlay');
    const contentEl = content ?? modal.querySelector('.modal-content');
    const headerEl = header ?? modal.querySelector('.modal-header');
    const bodyEl = body ?? modal.querySelector('.modal-body');
    const footerEl = footer ?? modal.querySelector('.modal-footer');

    // Get body items for stagger animation
    const bodyItems = bodyEl?.children ? Array.from(bodyEl.children) : [];

    // Make modal visible first
    modal.style.display = 'flex';
    modal.classList.remove('hidden');

    // If reduced motion, just show immediately
    if (this.animationService.isReducedMotion()) {
      if (overlayEl) gsap.set(overlayEl, { opacity: 1 });
      if (contentEl) gsap.set(contentEl, { opacity: 1, y: 0, scale: 1 });
      return;
    }

    // Set initial states
    if (overlayEl) gsap.set(overlayEl, { opacity: 0 });
    if (contentEl) gsap.set(contentEl, { y: 30, opacity: 0, scale: 0.95 });
    if (headerEl) gsap.set(headerEl, { x: -15, opacity: 0 });
    if (bodyItems.length > 0) gsap.set(bodyItems, { y: 20, opacity: 0 });
    if (footerEl) gsap.set(footerEl, { y: 15, opacity: 0 });

    // Create timeline
    const tl = gsap.timeline();

    // 1. Fade in overlay
    if (overlayEl) {
      tl.to(overlayEl, {
        opacity: 1,
        duration: 0.2,
        ease: Easings.neo
      });
    }

    // 2. Content slides up with spring
    if (contentEl) {
      tl.to(contentEl, {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: Durations.modal,
        ease: Easings.bounce
      }, overlayEl ? '-=0.1' : 0);
    }

    // 3. Header slides in
    if (headerEl) {
      tl.to(headerEl, {
        x: 0,
        opacity: 1,
        duration: 0.25,
        ease: Easings.neo
      }, '-=0.25');
    }

    // 4. Stagger body items
    if (bodyItems.length > 0) {
      tl.to(bodyItems, {
        y: 0,
        opacity: 1,
        duration: 0.3,
        stagger: 0.04,
        ease: Easings.neo
      }, '-=0.2');
    }

    // 5. Footer slides up
    if (footerEl) {
      tl.to(footerEl, {
        y: 0,
        opacity: 1,
        duration: 0.2,
        ease: Easings.neo
      }, '-=0.15');
    }

    return new Promise(resolve => {
      tl.eventCallback('onComplete', () => resolve());
    });
  }

  /**
   * Animate modal close
   */
  public async close(elements: ModalElements): Promise<void> {
    const { modal, overlay, content } = elements;

    const overlayEl = overlay ?? modal.querySelector('.modal-overlay');
    const contentEl = content ?? modal.querySelector('.modal-content');

    if (this.animationService.isReducedMotion()) {
      modal.style.display = 'none';
      modal.classList.add('hidden');
      return;
    }

    const tl = gsap.timeline();

    // Content scales down and fades
    if (contentEl) {
      tl.to(contentEl, {
        y: 20,
        opacity: 0,
        scale: 0.95,
        duration: 0.2,
        ease: Easings.neoIn
      });
    }

    // Overlay fades out
    if (overlayEl) {
      tl.to(overlayEl, {
        opacity: 0,
        duration: 0.15
      }, '-=0.1');
    }

    return new Promise(resolve => {
      tl.eventCallback('onComplete', () => {
        modal.style.display = 'none';
        modal.classList.add('hidden');

        // Reset transforms for next open
        if (contentEl) gsap.set(contentEl, { clearProps: 'all' });
        if (overlayEl) gsap.set(overlayEl, { clearProps: 'all' });

        resolve();
      });
    });
  }

  /**
   * Quick open animation (simpler, faster)
   */
  public async quickOpen(modal: HTMLElement): Promise<void> {
    const overlay = modal.querySelector('.modal-overlay');
    const content = modal.querySelector('.modal-content');

    modal.style.display = 'flex';
    modal.classList.remove('hidden');

    if (this.animationService.isReducedMotion()) {
      return;
    }

    gsap.set(overlay, { opacity: 0 });
    gsap.set(content, { scale: 0.9, opacity: 0 });

    const tl = gsap.timeline();

    tl.to(overlay, {
      opacity: 1,
      duration: 0.15
    });

    tl.to(content, {
      scale: 1,
      opacity: 1,
      duration: 0.2,
      ease: Easings.bounce
    }, '-=0.1');

    return new Promise(resolve => {
      tl.eventCallback('onComplete', () => resolve());
    });
  }

  /**
   * Quick close animation
   */
  public async quickClose(modal: HTMLElement): Promise<void> {
    const overlay = modal.querySelector('.modal-overlay');
    const content = modal.querySelector('.modal-content');

    if (this.animationService.isReducedMotion()) {
      modal.style.display = 'none';
      modal.classList.add('hidden');
      return;
    }

    const tl = gsap.timeline();

    tl.to(content, {
      scale: 0.9,
      opacity: 0,
      duration: 0.15,
      ease: Easings.neoIn
    });

    tl.to(overlay, {
      opacity: 0,
      duration: 0.1
    }, '-=0.05');

    return new Promise(resolve => {
      tl.eventCallback('onComplete', () => {
        modal.style.display = 'none';
        modal.classList.add('hidden');
        gsap.set([overlay, content], { clearProps: 'all' });
        resolve();
      });
    });
  }

  /**
   * Animate content transition within modal (e.g., tab switching)
   */
  public async transitionContent(
    outgoing: HTMLElement | null,
    incoming: HTMLElement,
    direction: 'left' | 'right' = 'right'
  ): Promise<void> {
    const xOffset = direction === 'right' ? 30 : -30;

    if (this.animationService.isReducedMotion()) {
      if (outgoing) outgoing.style.display = 'none';
      incoming.style.display = 'block';
      return;
    }

    const tl = gsap.timeline();

    // Fade out and slide outgoing
    if (outgoing) {
      tl.to(outgoing, {
        x: -xOffset,
        opacity: 0,
        duration: 0.15,
        ease: Easings.neoIn,
        onComplete: () => {
          outgoing.style.display = 'none';
          gsap.set(outgoing, { clearProps: 'all' });
        }
      });
    }

    // Set up and animate incoming
    incoming.style.display = 'block';
    gsap.set(incoming, { x: xOffset, opacity: 0 });

    tl.to(incoming, {
      x: 0,
      opacity: 1,
      duration: 0.2,
      ease: Easings.neo
    }, outgoing ? '-=0.05' : 0);

    return new Promise(resolve => {
      tl.eventCallback('onComplete', () => resolve());
    });
  }

  /**
   * Shake modal for error/attention
   */
  public shake(modal: HTMLElement): void {
    const content = modal.querySelector('.modal-content') ?? modal;

    if (this.animationService.isReducedMotion()) {
      return;
    }

    gsap.to(content, {
      x: [-8, 8, -8, 8, -4, 4, 0],
      duration: 0.4,
      ease: 'power2.inOut'
    });
  }
}

// Singleton instance
let modalAnimatorInstance: ModalAnimator | null = null;

/**
 * Get or create the ModalAnimator instance
 */
export function getModalAnimator(): ModalAnimator {
  if (!modalAnimatorInstance) {
    modalAnimatorInstance = new ModalAnimator();
  }
  return modalAnimatorInstance;
}
