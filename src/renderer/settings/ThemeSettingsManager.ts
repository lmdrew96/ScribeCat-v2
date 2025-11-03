/**
 * ThemeSettingsManager
 *
 * Manages theme selection and filtering.
 */

import type { ThemeManager } from '../themes/ThemeManager.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('ThemeSettingsManager');

export class ThemeSettingsManager {
  private themeManager: ThemeManager;
  private selectedThemeId: string = '';
  private currentCategoryFilter: string = 'all';
  private currentVariantFilter: string = 'all';

  constructor(themeManager: ThemeManager) {
    this.themeManager = themeManager;
  }

  /**
   * Load current theme
   */
  loadCurrentTheme(): void {
    const currentTheme = this.themeManager.getCurrentTheme();
    this.selectedThemeId = currentTheme.id;
    logger.info(`Current theme loaded: ${this.selectedThemeId}`);
  }

  /**
   * Populate themes in the grid
   */
  populateThemes(): void {
    const themeGrid = document.getElementById('theme-grid');
    if (!themeGrid) return;

    const themes = this.themeManager.getThemes();

    themeGrid.innerHTML = themes.map(theme => {
      const metadata = this.themeManager.getThemeMetadata(theme);
      const isSelected = theme.id === this.selectedThemeId;
      const variantLabel = theme.variant === 'light' ? 'Light' : 'Dark';
      const variantClass = theme.variant === 'light' ? 'variant-light' : 'variant-dark';

      return `
        <div class="theme-card ${isSelected ? 'selected' : ''}" data-theme-id="${theme.id}" data-category="${theme.category}" data-variant="${theme.variant}">
          <div class="theme-preview">
            ${metadata.previewColors.map(color => `
              <div class="theme-preview-color" style="background-color: ${color};"></div>
            `).join('')}
          </div>
          <div class="theme-info">
            <h4 class="theme-name">${theme.name}</h4>
            <div class="theme-badges">
              <span class="theme-category ${theme.category}">${theme.category}</span>
              <span class="theme-variant ${variantClass}">${variantLabel}</span>
            </div>
            <p class="theme-description">${theme.description}</p>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    themeGrid.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        const themeId = card.getAttribute('data-theme-id');
        if (themeId) {
          this.selectTheme(themeId);
        }
      });
    });

    logger.debug(`Populated ${themes.length} themes`);
  }

  /**
   * Filter themes by category and variant
   */
  filterThemes(): void {
    const themeGrid = document.getElementById('theme-grid');
    if (!themeGrid) return;

    const themeCards = themeGrid.querySelectorAll('.theme-card');

    themeCards.forEach(card => {
      const cardCategory = card.getAttribute('data-category');
      const cardVariant = card.getAttribute('data-variant');

      const categoryMatch = this.currentCategoryFilter === 'all' || cardCategory === this.currentCategoryFilter;
      const variantMatch = this.currentVariantFilter === 'all' || cardVariant === this.currentVariantFilter;

      if (categoryMatch && variantMatch) {
        (card as HTMLElement).style.display = 'block';
      } else {
        (card as HTMLElement).style.display = 'none';
      }
    });

    logger.debug(`Filtered themes: category=${this.currentCategoryFilter}, variant=${this.currentVariantFilter}`);
  }

  /**
   * Select a theme
   */
  async selectTheme(themeId: string): Promise<{ success: boolean; message: string }> {
    try {
      const success = await this.themeManager.loadTheme(themeId);

      if (!success) {
        return { success: false, message: 'Failed to load theme' };
      }

      this.selectedThemeId = themeId;

      // Update UI to show selected state
      const themeGrid = document.getElementById('theme-grid');
      if (themeGrid) {
        themeGrid.querySelectorAll('.theme-card').forEach(card => {
          if (card.getAttribute('data-theme-id') === themeId) {
            card.classList.add('selected');
          } else {
            card.classList.remove('selected');
          }
        });
      }

      logger.info(`Theme selected: ${themeId}`);
      return { success: true, message: 'Theme applied successfully!' };
    } catch (error) {
      logger.error('Failed to select theme', error);
      return { success: false, message: 'Failed to apply theme' };
    }
  }

  /**
   * Set category filter
   */
  setCategoryFilter(category: string): void {
    this.currentCategoryFilter = category;
    this.filterThemes();
  }

  /**
   * Set variant filter
   */
  setVariantFilter(variant: string): void {
    this.currentVariantFilter = variant;
    this.filterThemes();
  }

  /**
   * Get current theme ID
   */
  getSelectedThemeId(): string {
    return this.selectedThemeId;
  }
}
