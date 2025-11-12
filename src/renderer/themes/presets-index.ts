/**
 * Theme Presets - Central Export
 *
 * Combines dark and light theme presets and provides helper functions
 * for theme management and selection.
 */

import { Theme } from './types.js';
import { darkThemes } from './presets-dark.js';
import { lightThemes } from './presets-light.js';
import { highContrastThemes } from './presets-high-contrast.js';
import { getAllEasterEggThemes, getUnlockedEasterEggThemes } from './easter-egg-themes.js';

/**
 * All available themes (dark + light + high contrast)
 * 48 total themes: 20 dark mode + 20 light mode + 8 high contrast
 */
const baseThemes: Theme[] = [...darkThemes, ...lightThemes, ...highContrastThemes];

/**
 * All themes including easter eggs
 * This is used internally to allow loading of locked themes
 */
export const themes: Theme[] = [...baseThemes, ...getAllEasterEggThemes()];

/**
 * Get themes that should be visible in the theme picker
 * (base themes + unlocked easter egg themes)
 */
export function getVisibleThemes(): Theme[] {
  return [...baseThemes, ...getUnlockedEasterEggThemes()];
}

/**
 * Re-export theme arrays for direct access
 */
export { darkThemes, lightThemes, highContrastThemes };

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
 * Returns High Contrast Light (Blue) for new users
 */
export function getDefaultTheme(): Theme {
  return themes.find(t => t.id === 'high-contrast-light-blue') || themes[0];
}
