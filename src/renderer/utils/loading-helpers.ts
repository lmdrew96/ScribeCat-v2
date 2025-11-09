/**
 * Loading Helpers Utility
 * Centralized loading UI generation with cat facts easter egg
 */

import { getRandomCatFact } from './cat-facts.js';

/**
 * Creates standardized loading HTML with spinner, message, and optional cat fact
 * @param message - The loading message to display (e.g., "Generating summary...")
 * @param showCatFact - Whether to include a random cat fact (default: true)
 * @returns HTML string for loading state
 */
export function createLoadingHTML(message: string, showCatFact: boolean = true): string {
  const catFact = showCatFact ? getRandomCatFact() : '';

  return `
    <div class="study-loading">
      <div class="study-loading-spinner"></div>
      <div class="study-loading-text">${message}</div>
      ${catFact ? `<div class="study-loading-cat-fact">${catFact}</div>` : ''}
    </div>
  `;
}
