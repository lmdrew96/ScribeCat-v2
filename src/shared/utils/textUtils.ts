/**
 * Text utility functions for safe rendering in KAPLAY
 *
 * KAPLAY uses square brackets [] for styled text tags (like [red]text[/red]).
 * Any literal brackets in text will cause parsing errors.
 */

/**
 * Sanitizes text for safe use in KAPLAY's k.text() and k.drawText()
 *
 * Replaces square brackets with parentheses to prevent KAPLAY styled text
 * parsing errors.
 *
 * @param text - The text to sanitize
 * @returns Sanitized text safe for KAPLAY rendering
 *
 * @example
 * sanitizeText('[EQUIPPED]') // Returns: '(EQUIPPED)'
 * sanitizeText('Normal text') // Returns: 'Normal text'
 * sanitizeText('[ATK +5]')   // Returns: '(ATK +5)'
 *
 * **When to use:**
 * - ALWAYS use this for any dynamic text from user input or data sources
 * - Item names, descriptions
 * - Enemy names
 * - Achievement names
 * - Any text loaded from external data
 * - Status effect names
 *
 * **When NOT needed:**
 * - Hardcoded string literals that you control (e.g., 'Press ENTER')
 * - Numbers and stats (e.g., `+${value}`)
 */
export function sanitizeText(text: string): string {
  if (!text) return text;
  return text.replace(/\[/g, '(').replace(/\]/g, ')');
}

/**
 * Alias for sanitizeText for backwards compatibility
 */
export const escapeStyledText = sanitizeText;
