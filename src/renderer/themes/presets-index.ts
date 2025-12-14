/**
 * Theme Presets Index
 *
 * Central export for all theme presets, organized by variant and category.
 * Redesigned with color psychology principles for intentional emotional impact.
 */

import { Theme } from './types.js';
import { darkThemes } from './presets-dark.js';
import { lightThemes } from './presets-light.js';
import { highContrastThemes } from './presets-high-contrast.js';
import { getAllEasterEggThemes, getUnlockedEasterEggThemes } from './easter-egg-themes.js';

// Export all themes
export { darkThemes } from './presets-dark.js';
export { lightThemes } from './presets-light.js';
export { highContrastThemes } from './presets-high-contrast.js';

/**
 * All preset themes combined (base themes without easter eggs)
 * 40 total themes: 16 dark + 16 light + 8 high contrast
 */
export const allPresetThemes: Theme[] = [
  ...darkThemes,
  ...lightThemes,
  ...highContrastThemes
];

/**
 * All themes including easter eggs
 * This is used internally to allow loading of locked themes
 */
export const themes: Theme[] = [...allPresetThemes, ...getAllEasterEggThemes()];

/**
 * Get themes that should be visible in the theme picker
 * (base themes + unlocked easter egg themes)
 */
export function getVisibleThemes(): Theme[] {
  return [...allPresetThemes, ...getUnlockedEasterEggThemes()];
}

/**
 * Get themes by category
 */
export function getThemesByCategory(category: string): Theme[] {
  return allPresetThemes.filter(theme => theme.category === category);
}

/**
 * Get themes by variant (dark/light)
 */
export function getThemesByVariant(variant: 'dark' | 'light'): Theme[] {
  return allPresetThemes.filter(theme => theme.variant === variant);
}

/**
 * Find a theme by ID (searches all themes including easter eggs)
 */
export function findThemeById(id: string): Theme | undefined {
  return themes.find(theme => theme.id === id);
}

/**
 * Get theme by ID (alias for findThemeById)
 */
export function getThemeById(id: string): Theme | undefined {
  return themes.find(theme => theme.id === id);
}

/**
 * Get all theme categories
 */
export function getCategories(): string[] {
  return ['calm', 'energetic', 'focus', 'creative', 'balanced', 'special', 'high-contrast'];
}

/**
 * Get default theme
 * Returns High Contrast Light for new users
 */
export function getDefaultTheme(): Theme {
  return themes.find(t => t.id === 'high-contrast-light') || themes[0];
}

/**
 * Theme categories with metadata
 */
export const themeCategories = {
  calm: {
    name: 'Calm & Peaceful',
    emoji: '🌊',
    description: 'Lower arousal, trust, tranquility. Cool temperatures, lower saturation.'
  },
  energetic: {
    name: 'Energetic & Motivated',
    emoji: '⚡',
    description: 'High arousal, motivation, action. Warm temperatures, high saturation.'
  },
  focus: {
    name: 'Focus & Productivity',
    emoji: '🎯',
    description: 'Minimal distraction, professional, sustained attention. Muted, strategic.'
  },
  creative: {
    name: 'Creative & Inspired',
    emoji: '🎨',
    description: 'Inspiration, imagination, playfulness. Unexpected combinations, artistic.'
  },
  balanced: {
    name: 'Balanced & Harmonious',
    emoji: '☯️',
    description: 'Harmony, versatility, sophistication. Complementary pairs, earth tones.'
  },
  special: {
    name: 'Special Themes',
    emoji: '✨',
    description: 'Themed experiences based on beloved aesthetics and pop culture.'
  },
  'high-contrast': {
    name: 'High Contrast',
    emoji: '👁️',
    description: 'Maximum readability for accessibility needs.'
  }
} as const;
