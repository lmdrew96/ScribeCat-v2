/**
 * FocusManager - Phase 6.2 Accessibility Enhancement
 *
 * Manages keyboard focus throughout the application:
 * - Focus trapping for modals and dialogs
 * - Focus restoration when modals close
 * - Keyboard navigation utilities
 * - Skip-to-content functionality
 * - Focus indicator management
 *
 * @example
 * // Trap focus in a modal
 * const trap = FocusManager.trapFocus(modalElement);
 * // Later, release the trap
 * trap.release();
 */

/**
 * Represents a focus trap instance
 */
export interface FocusTrap {
  /** Release the focus trap and restore previous focus */
  release: () => void;
  /** Update the trapped element (useful if content changes) */
  update: () => void;
}

/**
 * Configuration for focus trap
 */
export interface FocusTrapConfig {
  /** Initial element to focus (defaults to first focusable element) */
  initialFocus?: HTMLElement | string;
  /** Element to restore focus to when trap is released */
  returnFocus?: HTMLElement | null;
  /** Whether to auto-focus on creation (default: true) */
  autoFocus?: boolean;
  /** Callback when escape key is pressed */
  onEscape?: () => void;
  /** Allow focus outside trap with Cmd/Ctrl+Tab (default: false) */
  allowOutsideClick?: boolean;
}

export class FocusManager {
  private static focusStack: HTMLElement[] = [];
  private static activeTrap: FocusTrap | null = null;

  /**
   * Query selector for all focusable elements
   */
  private static readonly FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]:not([contenteditable="false"])'
  ].join(',');

  /**
   * Get all focusable elements within a container
   */
  public static getFocusableElements(container: HTMLElement): HTMLElement[] {
    const elements = Array.from(
      container.querySelectorAll<HTMLElement>(this.FOCUSABLE_SELECTOR)
    );

    // Filter out invisible elements
    return elements.filter(el => {
      return el.offsetParent !== null && // Not display:none
             window.getComputedStyle(el).visibility !== 'hidden' &&
             !el.hasAttribute('aria-hidden');
    });
  }

  /**
   * Get the first focusable element in a container
   */
  public static getFirstFocusable(container: HTMLElement): HTMLElement | null {
    const focusable = this.getFocusableElements(container);
    return focusable.length > 0 ? focusable[0] : null;
  }

  /**
   * Get the last focusable element in a container
   */
  public static getLastFocusable(container: HTMLElement): HTMLElement | null {
    const focusable = this.getFocusableElements(container);
    return focusable.length > 0 ? focusable[focusable.length - 1] : null;
  }

  /**
   * Trap focus within an element (e.g., modal dialog)
   *
   * @param element - The element to trap focus within
   * @param config - Configuration options
   * @returns FocusTrap instance with release() method
   *
   * @example
   * const trap = FocusManager.trapFocus(modalElement, {
   *   initialFocus: '.modal-input',
   *   onEscape: () => closeModal()
   * });
   */
  public static trapFocus(
    element: HTMLElement,
    config: FocusTrapConfig = {}
  ): FocusTrap {
    const {
      initialFocus,
      returnFocus = document.activeElement as HTMLElement,
      autoFocus = true,
      onEscape,
      allowOutsideClick = false
    } = config;

    // Release any existing trap
    if (this.activeTrap) {
      this.activeTrap.release();
    }

    let focusableElements: HTMLElement[] = [];
    let firstFocusable: HTMLElement | null = null;
    let lastFocusable: HTMLElement | null = null;

    /**
     * Update the list of focusable elements
     */
    const updateFocusableElements = () => {
      focusableElements = this.getFocusableElements(element);
      firstFocusable = focusableElements[0] || null;
      lastFocusable = focusableElements[focusableElements.length - 1] || null;
    };

    updateFocusableElements();

    /**
     * Handle tab key navigation to cycle focus within trap
     */
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Escape key
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      // Only trap Tab key
      if (e.key !== 'Tab') return;

      // No focusable elements - prevent default
      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      // Single focusable element - prevent tab
      if (focusableElements.length === 1) {
        e.preventDefault();
        focusableElements[0].focus();
        return;
      }

      // Tab forward: if on last element, go to first
      if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
        return;
      }

      // Tab backward: if on first element, go to last
      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
        return;
      }
    };

    /**
     * Handle focus events to prevent focus from leaving the trap
     */
    const handleFocusOut = (e: FocusEvent) => {
      // Allow outside clicks if configured
      if (allowOutsideClick) return;

      const newFocusTarget = e.relatedTarget as HTMLElement;

      // If focus is leaving the trapped element, bring it back
      if (newFocusTarget && !element.contains(newFocusTarget)) {
        e.preventDefault();

        // Determine if we should focus first or last element
        const shouldFocusLast = document.activeElement === firstFocusable;
        (shouldFocusLast ? lastFocusable : firstFocusable)?.focus();
      }
    };

    // Set up event listeners
    element.addEventListener('keydown', handleKeyDown);
    element.addEventListener('focusout', handleFocusOut);

    // Save current focus to stack
    if (returnFocus) {
      this.focusStack.push(returnFocus);
    }

    // Set initial focus
    if (autoFocus) {
      if (initialFocus) {
        const targetElement = typeof initialFocus === 'string'
          ? element.querySelector<HTMLElement>(initialFocus)
          : initialFocus;

        if (targetElement) {
          // Use setTimeout to ensure modal is fully rendered
          setTimeout(() => targetElement.focus(), 100);
        } else {
          firstFocusable?.focus();
        }
      } else {
        firstFocusable?.focus();
      }
    }

    // Mark element with data attribute for styling
    element.setAttribute('data-focus-trap', 'true');

    /**
     * Release the focus trap
     */
    const release = () => {
      element.removeEventListener('keydown', handleKeyDown);
      element.removeEventListener('focusout', handleFocusOut);
      element.removeAttribute('data-focus-trap');

      // Restore previous focus
      const previousFocus = this.focusStack.pop();
      if (previousFocus && document.body.contains(previousFocus)) {
        previousFocus.focus();
      }

      // Clear active trap
      if (this.activeTrap && this.activeTrap === trap) {
        this.activeTrap = null;
      }
    };

    const trap: FocusTrap = {
      release,
      update: updateFocusableElements
    };

    this.activeTrap = trap;

    return trap;
  }

  /**
   * Focus the first element in a container
   */
  public static focusFirst(container: HTMLElement): boolean {
    const first = this.getFirstFocusable(container);
    if (first) {
      first.focus();
      return true;
    }
    return false;
  }

  /**
   * Focus the last element in a container
   */
  public static focusLast(container: HTMLElement): boolean {
    const last = this.getLastFocusable(container);
    if (last) {
      last.focus();
      return true;
    }
    return false;
  }

  /**
   * Safely focus an element with error handling
   */
  public static safeFocus(element: HTMLElement | null): boolean {
    if (!element) return false;

    try {
      element.focus();
      return document.activeElement === element;
    } catch (error) {
      console.warn('Failed to focus element:', error);
      return false;
    }
  }

  /**
   * Create a skip-to-content link for accessibility
   * Call this once during app initialization
   *
   * @param targetSelector - CSS selector for main content area
   */
  public static createSkipLink(targetSelector: string = '#main-content'): void {
    const skipLink = document.createElement('a');
    skipLink.href = targetSelector;
    skipLink.textContent = 'Skip to main content';
    skipLink.className = 'skip-to-content';
    skipLink.style.cssText = `
      position: fixed;
      top: -100px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10001;
      padding: 8px 16px;
      background: var(--accent);
      color: white;
      text-decoration: none;
      border-radius: 0 0 4px 4px;
      font-weight: 600;
      transition: top 0.2s ease-out;
    `;

    // Show on focus
    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '0';
    });

    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-100px';
    });

    // Navigate on click
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(targetSelector) as HTMLElement;
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // Insert as first element in body
    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  /**
   * Lock scroll when modal is open (prevents background scrolling)
   */
  public static lockScroll(): void {
    // Only add padding if there's actually a scrollbar (scrollbar width > 0)
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';

    // Only add padding if there was a visible scrollbar to prevent content shift
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  /**
   * Unlock scroll when modal is closed
   */
  public static unlockScroll(): void {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }

  /**
   * Announce a message to screen readers
   * Creates a live region for ARIA announcements
   */
  public static announce(message: string, politeness: 'polite' | 'assertive' = 'polite'): void {
    let liveRegion = document.getElementById('aria-live-region') as HTMLElement;

    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'aria-live-region';
      liveRegion.setAttribute('aria-live', politeness);
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
      document.body.appendChild(liveRegion);
    }

    // Update politeness if different
    if (liveRegion.getAttribute('aria-live') !== politeness) {
      liveRegion.setAttribute('aria-live', politeness);
    }

    // Clear and set new message (triggers announcement)
    liveRegion.textContent = '';
    setTimeout(() => {
      liveRegion.textContent = message;
    }, 100);
  }

  /**
   * Check if element is currently focused
   */
  public static isFocused(element: HTMLElement): boolean {
    return document.activeElement === element;
  }

  /**
   * Get currently focused element
   */
  public static getCurrentFocus(): HTMLElement | null {
    return document.activeElement as HTMLElement;
  }

  /**
   * Check if element contains focused element
   */
  public static containsFocus(container: HTMLElement): boolean {
    return container.contains(document.activeElement);
  }

  /**
   * Navigate to next focusable element
   */
  public static focusNext(): void {
    const focusable = this.getFocusableElements(document.body);
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);

    if (currentIndex < focusable.length - 1) {
      focusable[currentIndex + 1].focus();
    } else {
      // Wrap to first
      focusable[0]?.focus();
    }
  }

  /**
   * Navigate to previous focusable element
   */
  public static focusPrevious(): void {
    const focusable = this.getFocusableElements(document.body);
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);

    if (currentIndex > 0) {
      focusable[currentIndex - 1].focus();
    } else {
      // Wrap to last
      focusable[focusable.length - 1]?.focus();
    }
  }

  /**
   * Clear the focus stack (useful for cleanup)
   */
  public static clearFocusStack(): void {
    this.focusStack = [];
  }

  /**
   * Debug: Log all focusable elements in container
   */
  public static debugFocusableElements(container: HTMLElement = document.body): void {
    const elements = this.getFocusableElements(container);
    console.group('Focusable Elements');
    console.log('Count:', elements.length);
    elements.forEach((el, index) => {
      console.log(`${index + 1}.`, el.tagName, el.className, el);
    });
    console.groupEnd();
  }
}

/**
 * Helper CSS class for visually hidden content that's still accessible to screen readers
 */
export const VISUALLY_HIDDEN_CLASS = 'sr-only';

/**
 * Initialize CSS for screen-reader-only content
 * Call this once during app initialization
 */
export function initializeA11yStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    /* Screen reader only - visually hidden but accessible */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }

    /* Focusable when navigated to with keyboard */
    .sr-only-focusable:focus {
      position: static;
      width: auto;
      height: auto;
      padding: inherit;
      margin: inherit;
      overflow: visible;
      clip: auto;
      white-space: normal;
    }

    /* Enhanced focus indicator */
    *:focus-visible {
      outline: 2px solid var(--accent, #007acc);
      outline-offset: 2px;
      border-radius: 2px;
    }
  `;
  document.head.appendChild(style);
}
