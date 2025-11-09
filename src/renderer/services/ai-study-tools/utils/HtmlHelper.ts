/**
 * HtmlHelper
 *
 * Utility functions for HTML manipulation and sanitization
 */

export class HtmlHelper {
  /**
   * Escape HTML to prevent XSS attacks
   */
  static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
