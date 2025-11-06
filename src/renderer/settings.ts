/**
 * Settings Manager (Refactored)
 *
 * Coordinator for settings modal UI and user preferences.
 * Delegates specific concerns to specialized managers.
 */

import { ThemeManager } from './themes/ThemeManager.js';
import type { Theme } from './themes/types.js';
import { DriveSettingsManager } from './settings/DriveSettingsManager.js';
import { CanvasSettingsManager } from './settings/CanvasSettingsManager.js';
import { SettingsUIManager } from './settings/SettingsUIManager.js';
import { NotificationToast } from './components/shared/NotificationToast.js';
import { AuthManager } from './managers/AuthManager.js';

export class SettingsManager {
  private settingsModal: HTMLElement;
  private transcriptionMode: 'simulation' | 'assemblyai' = 'simulation';

  // Specialized managers
  private themeManager: ThemeManager;
  private driveSettings: DriveSettingsManager;
  private canvasSettings: CanvasSettingsManager;
  private uiManager: SettingsUIManager;

  // Theme state
  private selectedThemeId: string = '';
  private currentCategoryFilter: string = 'all';
  private currentVariantFilter: string = 'all';

  constructor(themeManager: ThemeManager, authManager: AuthManager) {
    this.themeManager = themeManager;
    this.settingsModal = document.getElementById('settings-modal')!;

    // Initialize specialized managers
    this.driveSettings = new DriveSettingsManager(authManager);
    this.canvasSettings = new CanvasSettingsManager();
    this.uiManager = new SettingsUIManager();

    this.initializeEventListeners();
    this.initializeManagers();
    this.loadSettings();
  }

  /**
   * Initialize specialized managers
   */
  private async initializeManagers(): Promise<void> {
    await Promise.all([
      this.driveSettings.initialize(),
      this.canvasSettings.initialize(),
      this.uiManager.initialize()
    ]);
  }

  /**
   * Initialize all event listeners
   */
  private initializeEventListeners(): void {
    // Settings button - open modal
    const settingsBtn = document.getElementById('settings-btn');
    settingsBtn?.addEventListener('click', () => this.openSettings());

    // Close settings modal
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    closeSettingsBtn?.addEventListener('click', () => this.closeSettings());

    const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
    cancelSettingsBtn?.addEventListener('click', () => this.closeSettings());

    // Save settings
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    saveSettingsBtn?.addEventListener('click', () => this.saveSettings());

    // Close modals on overlay click
    this.settingsModal.querySelector('.modal-overlay')?.addEventListener('click', () => {
      this.closeSettings();
    });

    // Transcription mode change
    const modeRadios = document.querySelectorAll('input[name="transcription-mode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        this.transcriptionMode = target.value as 'simulation' | 'assemblyai';
      });
    });

    // Theme category filter
    const themeCategoryFilter = document.getElementById('theme-category-filter') as HTMLSelectElement;
    themeCategoryFilter?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.currentCategoryFilter = target.value;
      this.filterThemes();
    });

    // Theme variant filter
    const themeVariantFilter = document.getElementById('theme-variant-filter') as HTMLSelectElement;
    themeVariantFilter?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.currentVariantFilter = target.value;
      this.filterThemes();
    });
  }

  /**
   * Load settings from electron-store
   */
  private async loadSettings(): Promise<void> {
    try {
      // Load transcription mode
      const mode = await window.scribeCat.store.get('transcription-mode');
      this.transcriptionMode = (mode as 'simulation' | 'assemblyai') || 'simulation';

      // Update UI
      this.updateUIFromSettings();
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Update UI elements from loaded settings
   */
  private updateUIFromSettings(): void {
    // Set transcription mode radio
    const modeRadio = document.getElementById(
      `mode-${this.transcriptionMode}`
    ) as HTMLInputElement;
    if (modeRadio) {
      modeRadio.checked = true;
    }
  }

  /**
   * Open settings modal
   */
  private openSettings(): void {
    this.settingsModal.classList.remove('hidden');
    // Reload settings to ensure UI is up to date
    this.updateUIFromSettings();
    // Populate themes
    this.populateThemes();
  }

  /**
   * Close settings modal
   */
  private closeSettings(): void {
    this.settingsModal.classList.add('hidden');
  }

  /**
   * Save settings to electron-store
   */
  private async saveSettings(): Promise<void> {
    try {
      // Save transcription mode
      const modeRadio = document.querySelector(
        'input[name="transcription-mode"]:checked'
      ) as HTMLInputElement;
      if (modeRadio) {
        this.transcriptionMode = modeRadio.value as 'simulation' | 'assemblyai';
        await window.scribeCat.store.set('transcription-mode', this.transcriptionMode);
      }

      NotificationToast.success('Settings saved successfully!');
      this.closeSettings();
    } catch (error) {
      console.error('Failed to save settings:', error);
      NotificationToast.error('Failed to save settings');
    }
  }

  /**
   * Populate themes in the settings modal
   */
  private populateThemes(): void {
    const themeGrid = document.getElementById('theme-grid');
    if (!themeGrid) return;

    const currentTheme = this.themeManager.getCurrentTheme();
    this.selectedThemeId = currentTheme.id;

    // Get all themes
    const themes = this.themeManager.getThemes();

    // Build theme cards HTML
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

    // Add click handlers to theme cards
    themeGrid.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        const themeId = card.getAttribute('data-theme-id');
        if (themeId) {
          this.selectTheme(themeId);
        }
      });
    });
  }

  /**
   * Filter themes by category and variant
   */
  private filterThemes(): void {
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
  }

  /**
   * Select a theme
   */
  private async selectTheme(themeId: string): Promise<void> {
    try {
      // Load the theme
      const success = await this.themeManager.loadTheme(themeId);

      if (!success) {
        NotificationToast.error('Failed to load theme');
        return;
      }

      // Update selected theme ID
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

      NotificationToast.success('Theme applied successfully!');
    } catch (error) {
      console.error('Failed to select theme:', error);
      NotificationToast.error('Failed to apply theme');
    }
  }
}

// Add animation styles (can be moved to CSS file if preferred)
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(100px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slideOutRight {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100px);
    }
  }
`;
document.head.appendChild(style);
