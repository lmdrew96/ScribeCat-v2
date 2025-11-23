/**
 * Theme Manager
 *
 * Manages theme loading, application, and persistence.
 */

import { Theme, ThemeMetadata } from './types.js';
import { themes, getThemeById, getThemesByCategory, getCategories, getDefaultTheme, getVisibleThemes } from './presets-index.js';
import { getNyanEffects } from '../effects/nyan-effects.js';

export class ThemeManager {
  private currentTheme: Theme;
  private readonly STORAGE_KEY = 'selected-theme';

  constructor() {
    this.currentTheme = getDefaultTheme();
  }

  /**
   * Initialize theme system
   * Loads saved theme from storage and applies it
   */
  public async initialize(): Promise<void> {
    try {
      // Load saved theme preference
      const savedThemeId = await window.scribeCat.store.get(this.STORAGE_KEY);
      
      if (savedThemeId && typeof savedThemeId === 'string') {
        const theme = getThemeById(savedThemeId);
        if (theme) {
          this.currentTheme = theme;
        }
      }
      
      // Apply the theme
      this.applyTheme(this.currentTheme);
    } catch (error) {
      console.error('Failed to initialize theme:', error);
      // Fall back to default theme
      this.applyTheme(getDefaultTheme());
    }
  }

  /**
   * Load and apply a theme by ID
   */
  public async loadTheme(themeId: string): Promise<boolean> {
    const theme = getThemeById(themeId);
    
    if (!theme) {
      console.error(`Theme not found: ${themeId}`);
      return false;
    }

    try {
      // Apply the theme
      this.applyTheme(theme);
      this.currentTheme = theme;
      
      // Save preference
      await window.scribeCat.store.set(this.STORAGE_KEY, themeId);
      
      return true;
    } catch (error) {
      console.error('Failed to load theme:', error);
      return false;
    }
  }

  /**
   * Apply theme by updating CSS variables
   */
  private applyTheme(theme: Theme): void {
    const root = document.documentElement;
    const colors = theme.colors;

    // Update all CSS variables
    root.style.setProperty('--bg-primary', colors.bgPrimary);
    root.style.setProperty('--bg-secondary', colors.bgSecondary);
    root.style.setProperty('--bg-tertiary', colors.bgTertiary);
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--accent-hover', colors.accentHover);
    root.style.setProperty('--text-primary', colors.textPrimary);
    root.style.setProperty('--text-secondary', colors.textSecondary);
    root.style.setProperty('--text-tertiary', colors.textTertiary);
    root.style.setProperty('--record-color', colors.recordColor);
    root.style.setProperty('--record-hover', colors.recordHover);
    root.style.setProperty('--success', colors.success);
    root.style.setProperty('--border', colors.border);
    root.style.setProperty('--shadow', colors.shadow);

    // Handle Nyan Cat theme effects
    const nyanEffects = getNyanEffects();
    const isNyanTheme = theme.id === 'nyan-cat' || theme.id === 'nyan-cat-light';

    if (isNyanTheme) {
      // Activate Nyan effects for Nyan Cat themes
      nyanEffects.activate();
    } else {
      // Deactivate Nyan effects for other themes
      nyanEffects.deactivate();
    }
  }

  /**
   * Get current theme
   */
  public getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  /**
   * Get all available themes (including unlocked easter eggs)
   */
  public getThemes(): Theme[] {
    return getVisibleThemes();
  }

  /**
   * Get themes by category
   */
  public getThemesByCategory(category: string): Theme[] {
    return getThemesByCategory(category);
  }

  /**
   * Get all categories
   */
  public getCategories(): string[] {
    return getCategories();
  }

  /**
   * Get theme metadata for display
   */
  public getThemeMetadata(theme: Theme): ThemeMetadata {
    return {
      id: theme.id,
      name: theme.name,
      category: theme.category,
      description: theme.description,
      previewColors: [
        theme.colors.accent,
        theme.colors.bgSecondary,
        theme.colors.textPrimary
      ]
    };
  }

  /**
   * Get all theme metadata
   */
  public getAllThemeMetadata(): ThemeMetadata[] {
    return themes.map(theme => this.getThemeMetadata(theme));
  }
}
