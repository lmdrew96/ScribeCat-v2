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
    category: 'special',
    variant: 'dark',
    description: 'Rainbow gradient magic - unlocked with secret meow code!',
    colors: {
      // Deep space backgrounds for maximum color pop
      bgPrimary: '#0a0a1a',
      bgSecondary: '#12001f',
      bgTertiary: '#1a0033',

      // Vibrant neon pink/magenta accents
      accent: '#ff00ff',
      accentHover: '#ff1aff',

      // Bright white text with neon glow
      textPrimary: '#ffffff',
      textSecondary: '#f0f0ff',
      textTertiary: '#d0d0ff',

      // Electric cyan for record button
      recordColor: '#00ffff',
      recordHover: '#33ffff',

      // Bright neon yellow/gold for success
      success: '#ffff00',

      // Electric purple border
      border: '#b300ff',
      shadow: 'rgba(255, 0, 255, 0.5)'
    }
  },
  {
    id: 'nyan-cat-light',
    name: 'Nyan Cat Light 🌈',
    category: 'special',
    variant: 'light',
    description: 'Rainbow gradient magic in light mode - unlocked with secret meow code!',
    colors: {
      // Bright pastel rainbow backgrounds
      bgPrimary: '#fff0ff',
      bgSecondary: '#ffe0ff',
      bgTertiary: '#ffc8ff',

      // Vibrant magenta accent
      accent: '#ff00aa',
      accentHover: '#ff33bb',

      // Deep purple/pink text for contrast
      textPrimary: '#330033',
      textSecondary: '#550055',
      textTertiary: '#770077',

      // Electric pink for record button
      recordColor: '#ff0088',
      recordHover: '#ff33aa',

      // Bright orange/gold for success
      success: '#ff9900',

      // Vibrant purple border
      border: '#cc00ff',
      shadow: 'rgba(204, 0, 255, 0.3)'
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
