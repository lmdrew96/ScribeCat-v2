/**
 * High Contrast Theme Presets
 *
 * WCAG AAA compliant themes for users with low vision or visual impairments.
 * All text/background combinations meet 7:1 contrast ratio minimum.
 *
 * Design principles:
 * - Maximum contrast for text readability (7:1+ ratio)
 * - Bold, saturated accent colors that are still distinguishable
 * - Strong borders for clear element boundaries
 * - Options for different visual needs (colorblind-friendly, reduced glare, etc.)
 *
 * Contrast ratios verified with WebAIM contrast checker.
 */

import { Theme } from './types.js';

export const highContrastThemes: Theme[] = [
  // ===== DARK HIGH CONTRAST =====

  {
    id: 'high-contrast-dark',
    name: 'High Contrast Dark',
    category: 'high-contrast',
    variant: 'dark',
    description: 'Pure black with white text and cyan accents — maximum readability',
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#0d0d0d',
      bgTertiary: '#1a1a1a',
      accent: '#00e5ff',
      accentHover: '#00d0e8',
      accentSecondary: '#ffeb3b',
      accentSecondaryHover: '#fdd835',
      textPrimary: '#ffffff',
      textSecondary: '#e0e0e0',
      textTertiary: '#bdbdbd',
      recordColor: '#ff4081',
      recordHover: '#f50057',
      success: '#00e676',
      border: '#616161',
      shadow: 'rgba(0, 0, 0, 0.9)'
    }
  },

  {
    id: 'high-contrast-amber-terminal',
    name: 'Amber Terminal',
    category: 'high-contrast',
    variant: 'dark',
    description: 'Retro amber-on-black — reduces eye strain, nostalgic terminal feel',
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#0a0800',
      bgTertiary: '#141000',
      accent: '#ffb300',
      accentHover: '#ffa000',
      accentSecondary: '#ff6f00',
      accentSecondaryHover: '#e65100',
      textPrimary: '#fff8e1',
      textSecondary: '#ffecb3',
      textTertiary: '#ffe082',
      recordColor: '#ff5722',
      recordHover: '#e64a19',
      success: '#aeea00',
      border: '#5d4037',
      shadow: 'rgba(0, 0, 0, 0.9)'
    }
  },

  {
    id: 'high-contrast-green-terminal',
    name: 'Green Terminal',
    category: 'high-contrast',
    variant: 'dark',
    description: 'Classic green-on-black — easy on eyes for extended reading',
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#001a00',
      bgTertiary: '#003300',
      accent: '#00e676',
      accentHover: '#00c853',
      accentSecondary: '#76ff03',
      accentSecondaryHover: '#64dd17',
      textPrimary: '#e8f5e9',
      textSecondary: '#c8e6c9',
      textTertiary: '#a5d6a7',
      recordColor: '#ffea00',
      recordHover: '#ffd600',
      success: '#00bcd4',
      border: '#2e7d32',
      shadow: 'rgba(0, 255, 0, 0.2)'
    }
  },

  {
    id: 'high-contrast-blue-dark',
    name: 'Arctic Night',
    category: 'high-contrast',
    variant: 'dark',
    description: 'Cool blue tones on black — reduces eye strain, calming',
    colors: {
      bgPrimary: '#000000',
      bgSecondary: '#000a14',
      bgTertiary: '#001428',
      accent: '#40c4ff',
      accentHover: '#00b0ff',
      accentSecondary: '#ea80fc',
      accentSecondaryHover: '#e040fb',
      textPrimary: '#e3f2fd',
      textSecondary: '#bbdefb',
      textTertiary: '#90caf9',
      recordColor: '#ff4081',
      recordHover: '#f50057',
      success: '#1de9b6',
      border: '#1565c0',
      shadow: 'rgba(0, 0, 0, 0.9)'
    }
  },

  // ===== LIGHT HIGH CONTRAST =====

  {
    id: 'high-contrast-light',
    name: 'High Contrast Light',
    category: 'high-contrast',
    variant: 'light',
    description: 'Pure white with black text and blue accents — maximum clarity',
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#fafafa',
      bgTertiary: '#f0f0f0',
      accent: '#0d47a1',
      accentHover: '#1565c0',
      accentSecondary: '#6a1b9a',
      accentSecondaryHover: '#7b1fa2',
      textPrimary: '#000000',
      textSecondary: '#212121',
      textTertiary: '#424242',
      recordColor: '#c62828',
      recordHover: '#b71c1c',
      success: '#2e7d32',
      border: '#757575',
      shadow: 'rgba(0, 0, 0, 0.3)'
    }
  },

  {
    id: 'high-contrast-cream',
    name: 'Warm Paper',
    category: 'high-contrast',
    variant: 'light',
    description: 'Cream background reduces glare — easier than pure white',
    colors: {
      bgPrimary: '#fffdf7',
      bgSecondary: '#fff9e8',
      bgTertiary: '#fff3d4',
      accent: '#4e342e',
      accentHover: '#3e2723',
      accentSecondary: '#bf360c',
      accentSecondaryHover: '#d84315',
      textPrimary: '#1a1a1a',
      textSecondary: '#2d2d2d',
      textTertiary: '#424242',
      recordColor: '#b71c1c',
      recordHover: '#c62828',
      success: '#1b5e20',
      border: '#8d6e63',
      shadow: 'rgba(62, 39, 35, 0.2)'
    }
  },

  {
    id: 'high-contrast-mint',
    name: 'Mint Paper',
    category: 'high-contrast',
    variant: 'light',
    description: 'Soft mint background — gentle on eyes, reduces fatigue',
    colors: {
      bgPrimary: '#f1f8f4',
      bgSecondary: '#e8f5e9',
      bgTertiary: '#dcedc8',
      accent: '#00695c',
      accentHover: '#00796b',
      accentSecondary: '#1565c0',
      accentSecondaryHover: '#1976d2',
      textPrimary: '#0d1f14',
      textSecondary: '#1b3d28',
      textTertiary: '#2e5a3c',
      recordColor: '#ad1457',
      recordHover: '#c2185b',
      success: '#0d47a1',
      border: '#4db6ac',
      shadow: 'rgba(0, 77, 64, 0.15)'
    }
  },

  {
    id: 'high-contrast-lavender',
    name: 'Lavender Paper',
    category: 'high-contrast',
    variant: 'light',
    description: 'Soft lavender background — calming, reduces harsh glare',
    colors: {
      bgPrimary: '#f8f5ff',
      bgSecondary: '#ede7f6',
      bgTertiary: '#e1d5f0',
      accent: '#4527a0',
      accentHover: '#512da8',
      accentSecondary: '#c2185b',
      accentSecondaryHover: '#d81b60',
      textPrimary: '#12001a',
      textSecondary: '#2a1a3d',
      textTertiary: '#4a3a5d',
      recordColor: '#880e4f',
      recordHover: '#ad1457',
      success: '#00695c',
      border: '#9575cd',
      shadow: 'rgba(69, 39, 160, 0.15)'
    }
  }
];

/**
 * Detect if OS has high contrast mode enabled
 * Call this to auto-switch to high contrast theme
 */
export function detectHighContrastMode(): boolean {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-contrast: more)').matches ||
           window.matchMedia('(prefers-contrast: high)').matches;
  }
  return false;
}

/**
 * Get recommended high contrast theme based on current variant
 */
export function getRecommendedHighContrastTheme(preferDark: boolean = true): Theme {
  if (preferDark) {
    return highContrastThemes.find(t => t.id === 'high-contrast-dark') || highContrastThemes[0];
  } else {
    return highContrastThemes.find(t => t.id === 'high-contrast-light') || highContrastThemes[4];
  }
}

/**
 * Listen for OS high contrast mode changes
 */
export function watchHighContrastMode(callback: (isHighContrast: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {}; // No-op cleanup
  }

  const mediaQuery = window.matchMedia('(prefers-contrast: more)');
  const fallbackQuery = window.matchMedia('(prefers-contrast: high)');

  const handler = () => {
    callback(mediaQuery.matches || fallbackQuery.matches);
  };

  // Initial call
  handler();

  // Listen for changes
  mediaQuery.addEventListener('change', handler);
  fallbackQuery.addEventListener('change', handler);

  // Return cleanup function
  return () => {
    mediaQuery.removeEventListener('change', handler);
    fallbackQuery.removeEventListener('change', handler);
  };
}

/**
 * Colorblind-friendly theme recommendations
 * These themes avoid red-green combinations that are problematic for colorblindness
 */
export const colorblindFriendlyThemeIds = [
  'high-contrast-dark',        // Cyan/Yellow - safe for all types
  'high-contrast-amber-terminal', // Amber/Orange - safe for all types
  'high-contrast-blue-dark',   // Blue/Pink - safe for all types
  'high-contrast-light',       // Blue/Purple - safe for all types
  'high-contrast-lavender'     // Purple/Pink - safe for all types
];
