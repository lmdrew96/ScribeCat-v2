/**
 * Easter Egg Themes
 *
 * Hidden themes that can be unlocked through secret actions.
 * These themes are not shown in the theme picker by default.
 */

import { Theme } from './types.js';

/**
 * Easter egg themes (unlockable via secrets)
 */
export const easterEggThemes: Theme[] = [
  {
    id: 'nyan-cat',
    name: 'Nyan Cat 🌈',
    category: 'creative',
    variant: 'dark',
    description: 'Rainbow gradient magic - unlocked with secret meow code!',
    colors: {
      // Base backgrounds with dark tones for contrast
      bgPrimary: '#1a1a2e',
      bgSecondary: '#16213e',
      bgTertiary: '#0f3460',

      // Hot pink accent
      accent: '#ff69b4',
      accentHover: '#ff1493',

      // White text for dark areas
      textPrimary: '#ffffff',
      textSecondary: '#e0e0e0',
      textTertiary: '#c0c0c0',

      // Cyan for record button
      recordColor: '#00ffff',
      recordHover: '#00cccc',

      // Yellow for success
      success: '#ffd700',

      // Purple border
      border: '#9370db',
      shadow: 'rgba(255, 105, 180, 0.3)'
    }
  },
  {
    id: 'nyan-cat-light',
    name: 'Nyan Cat Light 🌈',
    category: 'creative',
    variant: 'light',
    description: 'Rainbow gradient magic in light mode - unlocked with secret meow code!',
    colors: {
      // Light backgrounds with pastel tones
      bgPrimary: '#fff5f8',
      bgSecondary: '#ffe8f0',
      bgTertiary: '#ffd6e8',

      // Hot pink accent (darker for contrast on light bg)
      accent: '#ff1493',
      accentHover: '#ff69b4',

      // Dark text for light areas
      textPrimary: '#2d2d2d',
      textSecondary: '#4a4a4a',
      textTertiary: '#6a6a6a',

      // Magenta for record button
      recordColor: '#ff1493',
      recordHover: '#ff69b4',

      // Gold for success
      success: '#ff8c00',

      // Purple border
      border: '#da70d6',
      shadow: 'rgba(255, 20, 147, 0.15)'
    }
  }
];

/**
 * Storage key for unlocked easter egg themes
 */
export const UNLOCKED_THEMES_KEY = 'unlocked-easter-egg-themes';

/**
 * Check if a theme is unlocked
 */
export function isThemeUnlocked(themeId: string): boolean {
  const unlocked = getUnlockedThemes();
  return unlocked.includes(themeId);
}

/**
 * Get all unlocked theme IDs from localStorage
 */
export function getUnlockedThemes(): string[] {
  const stored = localStorage.getItem(UNLOCKED_THEMES_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse unlocked themes:', e);
    return [];
  }
}

/**
 * Unlock a theme and save to localStorage
 */
export function unlockTheme(themeId: string): void {
  const unlocked = getUnlockedThemes();

  if (!unlocked.includes(themeId)) {
    unlocked.push(themeId);
    localStorage.setItem(UNLOCKED_THEMES_KEY, JSON.stringify(unlocked));
  }
}

/**
 * Get all available easter egg themes (both locked and unlocked)
 */
export function getAllEasterEggThemes(): Theme[] {
  return easterEggThemes;
}

/**
 * Get only unlocked easter egg themes
 */
export function getUnlockedEasterEggThemes(): Theme[] {
  const unlocked = getUnlockedThemes();
  return easterEggThemes.filter(theme => unlocked.includes(theme.id));
}
