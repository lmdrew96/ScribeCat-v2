/**
 * Theme Types
 * 
 * Type definitions for the theme system.
 */

/**
 * Theme category for organizing themes by emotional impact
 */
export type ThemeCategory = 'calm' | 'energetic' | 'focus' | 'creative' | 'balanced' | 'high-contrast' | 'special';

/**
 * Theme variant for light/dark mode
 */
export type ThemeVariant = 'dark' | 'light';

/**
 * Theme color palette
 */
export interface ThemeColors {
  // Background colors
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  
  // Accent colors
  accent: string;
  accentHover: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  
  // Functional colors
  recordColor: string;
  recordHover: string;
  success: string;
  border: string;
  shadow: string;
}

/**
 * Complete theme definition
 */
export interface Theme {
  id: string;
  name: string;
  category: ThemeCategory;
  variant: ThemeVariant;
  description: string;
  colors: ThemeColors;
}

/**
 * Theme metadata for display
 */
export interface ThemeMetadata {
  id: string;
  name: string;
  category: ThemeCategory;
  description: string;
  previewColors: [string, string, string]; // Three main colors for preview
}
