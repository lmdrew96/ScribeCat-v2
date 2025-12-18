/**
 * Overlay Styles Injector
 *
 * Utility to inject the overlay CSS styles into the document.
 * Call this once during game initialization.
 */

import overlayCSS from './overlay.css?raw';

let stylesInjected = false;

/**
 * Inject overlay styles into the document head
 */
export function injectOverlayStyles(): void {
  if (stylesInjected) return;

  const styleElement = document.createElement('style');
  styleElement.id = 'sq-overlay-styles';
  styleElement.textContent = overlayCSS;
  document.head.appendChild(styleElement);

  stylesInjected = true;
}

/**
 * Check if overlay styles have been injected
 */
export function areOverlayStylesInjected(): boolean {
  return stylesInjected || document.getElementById('sq-overlay-styles') !== null;
}

/**
 * Remove overlay styles from the document
 */
export function removeOverlayStyles(): void {
  const existing = document.getElementById('sq-overlay-styles');
  if (existing) {
    existing.remove();
  }
  stylesInjected = false;
}
