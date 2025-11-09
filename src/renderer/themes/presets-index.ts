/**
 * Theme Presets - Central Export
 *
 * Combines dark and light theme presets and provides helper functions
 * for theme management and selection.
 */

import { Theme } from './types.js';
import { darkThemes } from './presets-dark.js';
import { lightThemes } from './presets-light.js';

/**
 * All available themes (dark + light)
 * 40 total themes: 20 dark mode + 20 light mode
 */
export const themes: Theme[] = [...darkThemes, ...lightThemes];

/**
 * Re-export theme arrays for direct access
 */
export { darkThemes, lightThemes };

/**
 * Get theme by ID
 */
export function getThemeById(id: string): Theme | undefined {
  return themes.find(theme => theme.id === id);
}

/**
 * Get themes by category
 */
export function getThemesByCategory(category: string): Theme[] {
  return themes.filter(theme => theme.category === category);
}

/**
 * Get all theme categories
 */
export function getCategories(): string[] {
  return ['calm', 'energetic', 'focus', 'creative', 'balanced'];
}

/**
 * Get default theme
 */
export function getDefaultTheme(): Theme {
  return themes[0]; // Ocean Serenity (dark)
}
