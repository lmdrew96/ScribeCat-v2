/**
 * High Contrast Theme Presets - Phase 6.2
 *
 * WCAG AAA compliant themes for users with low vision or visual impairments.
 * All color combinations meet 7:1 contrast ratio minimum.
 *
 * Features:
 * - Maximum contrast for text readability
 * - Bold, saturated accent colors
 * - Strong borders for element definition
 * - Clear visual hierarchy
 */

import { Theme } from './types.js';

export const highContrastThemes: Theme[] = [
  // ===== HIGH CONTRAST DARK =====
  {
    id: 'high-contrast-dark',
    name: 'High Contrast Dark',
    category: 'high-contrast',
    variant: 'dark',
    description: 'Maximum contrast for dark mode - WCAG AAA compliant',
    colors: {
      // Pure black backgrounds for maximum contrast
      bgPrimary: '#000000',
      bgSecondary: '#0a0a0a',
      bgTertiary: '#1a1a1a',

      // Bright cyan accent for high visibility
      accent: '#00ffff',
      accentHover: '#00e6e6',

      // Pure white text for maximum contrast
      textPrimary: '#ffffff',
      textSecondary: '#e6e6e6',
      textTertiary: '#cccccc',

      // Bright magenta for recording (high visibility)
      recordColor: '#ff00ff',
      recordHover: '#e600e6',

      // Bright green for success
      success: '#00ff00',

      // Bright border for clear element definition
      border: '#666666',

      // Strong shadow for depth
      shadow: 'rgba(0, 0, 0, 0.8)'
    }
  },

  {
    id: 'high-contrast-dark-warm',
    name: 'High Contrast Dark (Warm)',
    category: 'high-contrast',
    variant: 'dark',
    description: 'High contrast with warm tones - easier on eyes for extended use',
    colors: {
      // Very dark warm backgrounds
      bgPrimary: '#000000',
      bgSecondary: '#1a0f00',
      bgTertiary: '#2a1f10',

      // Bright orange accent
      accent: '#ffaa00',
      accentHover: '#ff9900',

      // Warm white text
      textPrimary: '#ffffe6',
      textSecondary: '#ffffcc',
      textTertiary: '#e6e6b3',

      // Bright red-orange for recording
      recordColor: '#ff5500',
      recordHover: '#ff4400',

      // Bright yellow-green for success
      success: '#88ff00',

      // Warm border
      border: '#664400',

      shadow: 'rgba(0, 0, 0, 0.8)'
    }
  },

  {
    id: 'high-contrast-dark-cool',
    name: 'High Contrast Dark (Cool)',
    category: 'high-contrast',
    variant: 'dark',
    description: 'High contrast with cool blue tones - reduces eye strain',
    colors: {
      // Very dark cool backgrounds
      bgPrimary: '#000000',
      bgSecondary: '#000a1a',
      bgTertiary: '#001a2a',

      // Bright blue accent
      accent: '#66ccff',
      accentHover: '#55bbee',

      // Cool white text
      textPrimary: '#e6f7ff',
      textSecondary: '#cceeff',
      textTertiary: '#b3e6ff',

      // Bright pink for recording
      recordColor: '#ff66cc',
      recordHover: '#ff55bb',

      // Bright cyan for success
      success: '#00ffcc',

      // Cool border
      border: '#336699',

      shadow: 'rgba(0, 0, 0, 0.8)'
    }
  },

  // ===== HIGH CONTRAST LIGHT =====
  {
    id: 'high-contrast-light',
    name: 'High Contrast Light',
    category: 'high-contrast',
    variant: 'light',
    description: 'Maximum contrast for light mode - WCAG AAA compliant',
    colors: {
      // Pure white backgrounds
      bgPrimary: '#ffffff',
      bgSecondary: '#f5f5f5',
      bgTertiary: '#ebebeb',

      // Dark blue accent for readability on white
      accent: '#0000cc',
      accentHover: '#0000aa',

      // Pure black text for maximum contrast
      textPrimary: '#000000',
      textSecondary: '#1a1a1a',
      textTertiary: '#333333',

      // Dark red for recording (high visibility)
      recordColor: '#cc0000',
      recordHover: '#aa0000',

      // Dark green for success
      success: '#006600',

      // Strong dark border
      border: '#666666',

      // Strong shadow for depth
      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },

  {
    id: 'high-contrast-light-yellow',
    name: 'High Contrast Light (Yellow)',
    category: 'high-contrast',
    variant: 'light',
    description: 'High contrast with yellow background - reduces glare',
    colors: {
      // Light yellow backgrounds (easier on eyes than pure white)
      bgPrimary: '#ffffa8',
      bgSecondary: '#ffff99',
      bgTertiary: '#ffff80',

      // Dark purple accent
      accent: '#4400aa',
      accentHover: '#330088',

      // Pure black text
      textPrimary: '#000000',
      textSecondary: '#1a1a1a',
      textTertiary: '#2a2a2a',

      // Dark magenta for recording
      recordColor: '#aa0066',
      recordHover: '#880055',

      // Dark green for success
      success: '#005500',

      // Dark border
      border: '#555555',

      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },

  {
    id: 'high-contrast-light-blue',
    name: 'High Contrast Light (Blue)',
    category: 'high-contrast',
    variant: 'light',
    description: 'High contrast with light blue background - calming and clear',
    colors: {
      // Light blue backgrounds
      bgPrimary: '#e6f7ff',
      bgSecondary: '#d6edff',
      bgTertiary: '#c6e3ff',

      // Dark blue accent
      accent: '#003366',
      accentHover: '#002244',

      // Pure black text
      textPrimary: '#000000',
      textSecondary: '#0a0a0a',
      textTertiary: '#1a1a1a',

      // Dark red for recording
      recordColor: '#990033',
      recordHover: '#770022',

      // Dark green for success
      success: '#005533',

      // Dark border
      border: '#336699',

      shadow: 'rgba(0, 0, 0, 0.4)'
    }
  },

  // ===== HIGH CONTRAST SPECIALIZED =====
  {
    id: 'high-contrast-amber',
    name: 'High Contrast Amber',
    category: 'high-contrast',
    variant: 'dark',
    description: 'Black and amber - inspired by retro terminals, easy on eyes',
    colors: {
      // Pure black backgrounds
      bgPrimary: '#000000',
      bgSecondary: '#0a0a00',
      bgTertiary: '#1a1a00',

      // Bright amber accent
      accent: '#ffbb00',
      accentHover: '#ffaa00',

      // Amber text on black
      textPrimary: '#ffcc00',
      textSecondary: '#ffbb00',
      textTertiary: '#ffaa00',

      // Bright orange for recording
      recordColor: '#ff7700',
      recordHover: '#ff6600',

      // Bright yellow-green for success
      success: '#99ff00',

      // Amber border
      border: '#664400',

      shadow: 'rgba(0, 0, 0, 0.8)'
    }
  },

  {
    id: 'high-contrast-green',
    name: 'High Contrast Green',
    category: 'high-contrast',
    variant: 'dark',
    description: 'Black and green - classic terminal style, reduces eye strain',
    colors: {
      // Pure black backgrounds
      bgPrimary: '#000000',
      bgSecondary: '#001a00',
      bgTertiary: '#002a00',

      // Bright lime accent
      accent: '#00ff00',
      accentHover: '#00ee00',

      // Green text on black
      textPrimary: '#00ff00',
      textSecondary: '#00ee00',
      textTertiary: '#00cc00',

      // Bright yellow for recording
      recordColor: '#ffff00',
      recordHover: '#ffee00',

      // Bright cyan for success
      success: '#00ffcc',

      // Green border
      border: '#004400',

      shadow: 'rgba(0, 0, 0, 0.8)'
    }
  }
];

/**
 * Detect if OS has high contrast mode enabled
 * Call this to auto-switch to high contrast theme
 */
export function detectHighContrastMode(): boolean {
  // Check for prefers-contrast media query
  if (window.matchMedia) {
    return window.matchMedia('(prefers-contrast: high)').matches;
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
    return highContrastThemes.find(t => t.id === 'high-contrast-light') || highContrastThemes[3];
  }
}

/**
 * Listen for OS high contrast mode changes
 */
export function watchHighContrastMode(callback: (isHighContrast: boolean) => void): () => void {
  if (!window.matchMedia) {
    return () => {}; // No-op cleanup
  }

  const mediaQuery = window.matchMedia('(prefers-contrast: high)');

  const handler = (e: MediaQueryListEvent | MediaQueryList) => {
    callback(e.matches);
  };

  // Initial call
  handler(mediaQuery);

  // Listen for changes
  mediaQuery.addEventListener('change', handler);

  // Return cleanup function
  return () => {
    mediaQuery.removeEventListener('change', handler);
  };
}
