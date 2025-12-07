/**
 * StudyQuestThemeManager
 *
 * Singleton manager for StudyQuest UI theming.
 * Handles theme loading, switching, and applying to UI elements.
 */

import { createLogger } from '../../../shared/logger.js';
import {
  type StudyQuestTheme,
  type StudyQuestThemeId,
  type ThemeSpriteMap,
  STUDYQUEST_THEMES,
  getTheme,
} from './StudyQuestThemes.js';
import { spriteRenderer } from './StudyQuestSpriteRenderer.js';

const logger = createLogger('StudyQuestThemeManager');

const STORAGE_KEY = 'studyquest-ui-theme';

type ThemeChangeListener = (theme: StudyQuestTheme) => void;

interface RegisteredElement {
  element: HTMLElement;
  spriteKey: keyof ThemeSpriteMap;
  scale: number;
}

export class StudyQuestThemeManager {
  private static instance: StudyQuestThemeManager;
  private currentThemeId: StudyQuestThemeId = 'default';
  private currentTheme: StudyQuestTheme;
  private listeners: Set<ThemeChangeListener> = new Set();
  private registeredElements: RegisteredElement[] = [];
  private container: HTMLElement | null = null;
  private isInitialized = false;

  private constructor() {
    this.currentTheme = STUDYQUEST_THEMES.default;
    this.loadFromStorage();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): StudyQuestThemeManager {
    if (!StudyQuestThemeManager.instance) {
      StudyQuestThemeManager.instance = new StudyQuestThemeManager();
    }
    return StudyQuestThemeManager.instance;
  }

  /**
   * Initialize the theme manager with a container element
   */
  async initialize(container: HTMLElement): Promise<void> {
    this.container = container;

    // Load the current theme's sprite sheet if applicable
    if (this.currentTheme.spriteSheet) {
      try {
        await spriteRenderer.loadSpriteSheet(this.currentTheme.spriteSheet);
      } catch (error) {
        logger.error('Failed to load theme sprite sheet:', error);
        // Fall back to default theme
        this.currentThemeId = 'default';
        this.currentTheme = STUDYQUEST_THEMES.default;
      }
    }

    // Apply theme to container
    this.applyThemeToContainer();
    this.isInitialized = true;

    logger.info(`Theme manager initialized with theme: ${this.currentThemeId}`);
  }

  /**
   * Load saved theme from localStorage
   */
  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved in STUDYQUEST_THEMES) {
        this.currentThemeId = saved as StudyQuestThemeId;
        this.currentTheme = getTheme(this.currentThemeId);
        logger.info(`Loaded saved theme: ${this.currentThemeId}`);
      }
    } catch (error) {
      logger.warn('Failed to load theme from storage:', error);
    }
  }

  /**
   * Save current theme to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, this.currentThemeId);
    } catch (error) {
      logger.warn('Failed to save theme to storage:', error);
    }
  }

  /**
   * Get current theme
   */
  getTheme(): StudyQuestTheme {
    return this.currentTheme;
  }

  /**
   * Get current theme ID
   */
  getThemeId(): StudyQuestThemeId {
    return this.currentThemeId;
  }

  /**
   * Check if using a sprite-based theme
   */
  isUsingSprites(): boolean {
    return this.currentTheme.spriteSheet !== null;
  }

  /**
   * Set the active theme
   */
  async setTheme(themeId: StudyQuestThemeId): Promise<void> {
    if (themeId === this.currentThemeId) {
      return;
    }

    const theme = getTheme(themeId);

    // Load sprite sheet if needed
    if (theme.spriteSheet) {
      try {
        await spriteRenderer.loadSpriteSheet(theme.spriteSheet);
      } catch (error) {
        logger.error(`Failed to load sprite sheet for theme ${themeId}:`, error);
        return;
      }
    }

    this.currentThemeId = themeId;
    this.currentTheme = theme;
    this.saveToStorage();

    // Apply to container
    this.applyThemeToContainer();

    // Update all registered elements
    this.updateRegisteredElements();

    // Notify listeners
    this.notifyListeners();

    logger.info(`Theme changed to: ${themeId}`);
  }

  /**
   * Apply theme CSS variables and class to container
   */
  private applyThemeToContainer(): void {
    if (!this.container) return;

    // Remove old theme classes
    const themeClasses = Array.from(this.container.classList).filter(c => c.startsWith('sq-theme-'));
    themeClasses.forEach(c => this.container!.classList.remove(c));

    // Add new theme class
    this.container.classList.add(`sq-theme-${this.currentThemeId}`);

    // Apply CSS variables
    spriteRenderer.applyThemeColors(this.container, this.currentTheme);
  }

  /**
   * Register an element for automatic theme updates
   */
  registerElement(
    element: HTMLElement,
    spriteKey: keyof ThemeSpriteMap,
    scale: number = 2
  ): void {
    this.registeredElements.push({ element, spriteKey, scale });

    // Apply current theme immediately
    this.applyThemeToElement(element, spriteKey, scale);
  }

  /**
   * Unregister an element
   */
  unregisterElement(element: HTMLElement): void {
    this.registeredElements = this.registeredElements.filter(
      reg => reg.element !== element
    );
  }

  /**
   * Clear all registered elements
   */
  clearRegisteredElements(): void {
    this.registeredElements = [];
  }

  /**
   * Apply current theme to a specific element
   */
  applyThemeToElement(
    element: HTMLElement,
    spriteKey: keyof ThemeSpriteMap,
    scale: number = 2
  ): void {
    const theme = this.currentTheme;

    if (theme.sprites && theme.spriteSheet) {
      const region = theme.sprites[spriteKey];
      if (region) {
        spriteRenderer.applySpriteToElement(
          element,
          theme.spriteSheet,
          region,
          scale
        );
      }
    } else {
      // Clear sprite styling for default theme
      element.style.backgroundImage = '';
      element.style.backgroundPosition = '';
      element.style.backgroundSize = '';
    }
  }

  /**
   * Update all registered elements with current theme
   */
  private updateRegisteredElements(): void {
    for (const reg of this.registeredElements) {
      // Check if element is still in DOM
      if (!document.contains(reg.element)) {
        continue;
      }
      this.applyThemeToElement(reg.element, reg.spriteKey, reg.scale);
    }

    // Clean up elements no longer in DOM
    this.registeredElements = this.registeredElements.filter(
      reg => document.contains(reg.element)
    );
  }

  /**
   * Get sprite sheet path for current theme
   */
  getSpriteSheetPath(): string | null {
    return this.currentTheme.spriteSheet;
  }

  /**
   * Get sprite region for a specific element type
   */
  getSpriteRegion(spriteKey: keyof ThemeSpriteMap) {
    return this.currentTheme.sprites?.[spriteKey] || null;
  }

  /**
   * Subscribe to theme changes
   */
  subscribe(listener: ThemeChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of theme change
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentTheme);
      } catch (error) {
        logger.error('Theme listener error:', error);
      }
    }
  }

  /**
   * Get all available themes
   */
  getAllThemes(): StudyQuestTheme[] {
    return Object.values(STUDYQUEST_THEMES);
  }

  /**
   * Get all theme IDs
   */
  getAllThemeIds(): StudyQuestThemeId[] {
    return Object.keys(STUDYQUEST_THEMES) as StudyQuestThemeId[];
  }

  /**
   * Preload all theme sprite sheets for faster switching
   */
  async preloadAllThemes(): Promise<void> {
    const themes = this.getAllThemes().filter(t => t.spriteSheet);
    await spriteRenderer.preloadAllThemes(themes);
  }
}

// Export singleton getter
export const themeManager = StudyQuestThemeManager.getInstance();
