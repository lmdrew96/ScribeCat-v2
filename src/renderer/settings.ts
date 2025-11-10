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
import { unlockTheme, isThemeUnlocked } from './themes/easter-egg-themes.js';
import { SoundManager } from './audio/SoundManager.js';

export interface TranscriptionAccuracySettings {
  speechModel: 'best' | 'nano';
  languageCode: string;
  speakerLabels: boolean;
  disfluencies: boolean;
  punctuate: boolean;
  formatText: boolean;
}

export class SettingsManager {
  private settingsModal: HTMLElement;
  private transcriptionMode: 'assemblyai' = 'assemblyai';
  private transcriptionSettings: TranscriptionAccuracySettings = {
    speechModel: 'best',
    languageCode: '',
    speakerLabels: false,
    disfluencies: true,
    punctuate: true,
    formatText: true
  };

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

    // Close modal when clicking the overlay (backdrop)
    const overlay = this.settingsModal.querySelector('.modal-overlay');
    overlay?.addEventListener('click', () => {
      this.closeSettings();
    });

    // Prevent clicks inside modal-content from closing the modal
    const modalContent = this.settingsModal.querySelector('.modal-content');
    modalContent?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Transcription mode change
    const modeRadios = document.querySelectorAll('input[name="transcription-mode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        this.transcriptionMode = target.value as 'assemblyai';
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

    // 🎉 Easter Egg: Secret theme unlock with "meow meow meow"
    this.initializeThemeEasterEgg();
  }

  /**
   * Initialize easter egg theme unlock
   */
  private initializeThemeEasterEgg(): void {
    let typedSequence = '';
    let sequenceTimer: NodeJS.Timeout | null = null;
    const secretPhrase = 'meow meow meow';

    document.addEventListener('keypress', (e: KeyboardEvent) => {
      // Only listen when settings modal is open
      if (this.settingsModal.classList.contains('hidden')) {
        return;
      }

      // Ignore if typing in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Add character to sequence
      typedSequence += e.key.toLowerCase();

      // Reset timer
      if (sequenceTimer) {
        clearTimeout(sequenceTimer);
      }

      // Check if we've typed the secret phrase
      if (typedSequence.includes(secretPhrase)) {
        this.unlockNyanCatTheme();
        typedSequence = '';
      } else {
        // Reset after 2 seconds of inactivity
        sequenceTimer = setTimeout(() => {
          typedSequence = '';
        }, 2000);
      }
    });
  }

  /**
   * Unlock the Nyan Cat themes (both dark and light)
   */
  private unlockNyanCatTheme(): void {
    const darkThemeId = 'nyan-cat';
    const lightThemeId = 'nyan-cat-light';

    // Check if already unlocked
    if (isThemeUnlocked(darkThemeId) && isThemeUnlocked(lightThemeId)) {
      NotificationToast.show('🌈 Nyan Cat themes are already unlocked!', 'info');
      return;
    }

    // Unlock both themes
    unlockTheme(darkThemeId);
    unlockTheme(lightThemeId);

    // Show success notification with rainbow styling
    const toast = NotificationToast.show('🌈 Secret themes unlocked: Nyan Cat (Dark & Light)!', 'success', 4000);
    if (toast) {
      toast.classList.add('theme-unlock-toast');
    }

    // Refresh the theme grid to show the newly unlocked themes
    this.populateThemes();
    this.filterThemes();
  }

  /**
   * Load settings from electron-store
   */
  private async loadSettings(): Promise<void> {
    try {
      // Load transcription mode
      const mode = await window.scribeCat.store.get('transcription-mode');
      this.transcriptionMode = (mode as 'assemblyai') || 'assemblyai';

      // Load transcription accuracy settings
      const settings = await window.scribeCat.store.get('transcription-accuracy-settings');
      if (settings) {
        this.transcriptionSettings = settings as TranscriptionAccuracySettings;
      }

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

    // Set transcription accuracy settings
    const speechModelSelect = document.getElementById('speech-model-select') as HTMLSelectElement;
    if (speechModelSelect) {
      speechModelSelect.value = this.transcriptionSettings.speechModel;
    }

    const languageSelect = document.getElementById('language-select') as HTMLSelectElement;
    if (languageSelect) {
      languageSelect.value = this.transcriptionSettings.languageCode;
    }

    const speakerLabelsCheckbox = document.getElementById('speaker-labels-checkbox') as HTMLInputElement;
    if (speakerLabelsCheckbox) {
      speakerLabelsCheckbox.checked = this.transcriptionSettings.speakerLabels;
    }

    const disfluenciesCheckbox = document.getElementById('disfluencies-checkbox') as HTMLInputElement;
    if (disfluenciesCheckbox) {
      disfluenciesCheckbox.checked = this.transcriptionSettings.disfluencies;
    }

    const punctuateCheckbox = document.getElementById('punctuate-checkbox') as HTMLInputElement;
    if (punctuateCheckbox) {
      punctuateCheckbox.checked = this.transcriptionSettings.punctuate;
    }

    const formatTextCheckbox = document.getElementById('format-text-checkbox') as HTMLInputElement;
    if (formatTextCheckbox) {
      formatTextCheckbox.checked = this.transcriptionSettings.formatText;
    }

    // Set sound effects checkbox
    const soundEffectsCheckbox = document.getElementById('sound-effects-checkbox') as HTMLInputElement;
    if (soundEffectsCheckbox) {
      soundEffectsCheckbox.checked = SoundManager.isEnabled();
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
        this.transcriptionMode = modeRadio.value as 'assemblyai';
        await window.scribeCat.store.set('transcription-mode', this.transcriptionMode);
      }

      // Save transcription accuracy settings
      const speechModelSelect = document.getElementById('speech-model-select') as HTMLSelectElement;
      const languageSelect = document.getElementById('language-select') as HTMLSelectElement;
      const speakerLabelsCheckbox = document.getElementById('speaker-labels-checkbox') as HTMLInputElement;
      const disfluenciesCheckbox = document.getElementById('disfluencies-checkbox') as HTMLInputElement;
      const punctuateCheckbox = document.getElementById('punctuate-checkbox') as HTMLInputElement;
      const formatTextCheckbox = document.getElementById('format-text-checkbox') as HTMLInputElement;

      this.transcriptionSettings = {
        speechModel: speechModelSelect?.value as 'best' | 'nano' || 'best',
        languageCode: languageSelect?.value || '',
        speakerLabels: speakerLabelsCheckbox?.checked || false,
        disfluencies: disfluenciesCheckbox?.checked || true,
        punctuate: punctuateCheckbox?.checked || true,
        formatText: formatTextCheckbox?.checked || true
      };

      await window.scribeCat.store.set('transcription-accuracy-settings', this.transcriptionSettings);

      // Save sound effects setting
      const soundEffectsCheckbox = document.getElementById('sound-effects-checkbox') as HTMLInputElement;
      if (soundEffectsCheckbox) {
        if (soundEffectsCheckbox.checked) {
          SoundManager.enable();
        } else {
          SoundManager.disable();
        }
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
   * Get current transcription accuracy settings
   */
  getTranscriptionSettings(): TranscriptionAccuracySettings {
    return this.transcriptionSettings;
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
