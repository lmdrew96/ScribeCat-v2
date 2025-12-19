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
import { AuthManager } from './managers/AuthManager.js';
import { AccountSettingsModal } from './components/AccountSettingsModal.js';
import { unlockTheme, isThemeUnlocked } from './themes/easter-egg-themes.js';
import { SoundManager } from './audio/SoundManager.js';

export interface TranscriptionAccuracySettings {
  speechModel: 'best' | 'nano';
  languageCode: string;
  speakerLabels: boolean;
  disfluencies: boolean;
  punctuate: boolean;
  formatText: boolean;
  keyterms?: string[];  // Custom vocabulary for improved accuracy
}

export class SettingsManager {
  private settingsModal: HTMLElement;
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
  private accountSettingsModal: AccountSettingsModal;

  // Theme state
  private selectedThemeId: string = '';

  constructor(themeManager: ThemeManager, authManager: AuthManager, accountSettingsModal: AccountSettingsModal) {
    this.themeManager = themeManager;
    this.accountSettingsModal = accountSettingsModal;
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

    // Manage Account button - open account settings modal
    const manageAccountBtn = document.getElementById('manage-account-btn');
    manageAccountBtn?.addEventListener('click', () => {
      this.accountSettingsModal.show();
    });

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

    // Event delegation for theme category section collapse/expand
    // IMPORTANT: Attach to modal-content, not settingsModal, because modal-content calls stopPropagation()
    modalContent?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const header = target.closest('.theme-category-header');

      if (header) {
        const section = header.closest('.theme-category-section');
        const content = section?.querySelector('.theme-category-content') as HTMLElement;

        if (!section || !content) return;

        const isCollapsed = section.classList.contains('collapsed');

        if (isCollapsed) {
          // Expand this section
          section.classList.remove('collapsed');
          content.style.maxHeight = '5000px';
          content.style.opacity = '1';
          content.style.paddingTop = '15px';
          content.style.paddingBottom = '15px';
          content.style.overflow = 'visible';
        } else {
          // Collapse this section
          section.classList.add('collapsed');
          content.style.maxHeight = '0';
          content.style.opacity = '0';
          content.style.paddingTop = '0';
          content.style.paddingBottom = '0';
          content.style.overflow = 'hidden';
        }
      }
    });

    // Event delegation for theme card selection
    // IMPORTANT: Attach to modal-content, not settingsModal, because modal-content calls stopPropagation()
    modalContent?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const card = target.closest('.theme-card');

      if (card) {
        const themeId = card.getAttribute('data-theme-id');
        if (themeId) {
          this.selectTheme(themeId);
        }
      }
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
      const notificationTicker = (window as any).notificationTicker;
      if (notificationTicker) {
        notificationTicker.info('🌈 Nyan Cat themes are already unlocked!');
      }
      return;
    }

    // Unlock both themes
    unlockTheme(darkThemeId);
    unlockTheme(lightThemeId);

    // Show success notification
    const notificationTicker = (window as any).notificationTicker;
    if (notificationTicker) {
      notificationTicker.success('🌈 Secret themes unlocked: Nyan Cat (Dark & Light)!', 4000);
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
      // Load transcription settings
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
    // Set transcription settings
    const languageSelect = document.getElementById('language-select') as HTMLSelectElement;
    if (languageSelect) {
      languageSelect.value = this.transcriptionSettings.languageCode;
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

    // Set keyterms input
    const keytermsInput = document.getElementById('keyterms-input') as HTMLTextAreaElement;
    if (keytermsInput && this.transcriptionSettings.keyterms) {
      keytermsInput.value = this.transcriptionSettings.keyterms.join(', ');
    }

    // Set sound effects checkbox
    const soundEffectsCheckbox = document.getElementById('sound-effects-checkbox') as HTMLInputElement;
    if (soundEffectsCheckbox) {
      soundEffectsCheckbox.checked = SoundManager.isEnabled();
    }
  }

  /**
   * Open settings modal (public API)
   */
  open(): void {
    this.openSettings();
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
      // Save transcription settings
      const languageSelect = document.getElementById('language-select') as HTMLSelectElement;
      const disfluenciesCheckbox = document.getElementById('disfluencies-checkbox') as HTMLInputElement;
      const punctuateCheckbox = document.getElementById('punctuate-checkbox') as HTMLInputElement;
      const formatTextCheckbox = document.getElementById('format-text-checkbox') as HTMLInputElement;
      const keytermsInput = document.getElementById('keyterms-input') as HTMLTextAreaElement;

      // Parse keyterms from comma-separated input
      let keyterms: string[] | undefined;
      if (keytermsInput?.value.trim()) {
        keyterms = keytermsInput.value
          .split(',')
          .map(term => term.trim())
          .filter(term => term.length >= 5 && term.length <= 50);  // Validate term length
      }

      this.transcriptionSettings = {
        speechModel: 'best',  // Default value (not supported in real-time API)
        languageCode: languageSelect?.value || '',
        speakerLabels: false,  // Not supported for real-time streaming
        disfluencies: disfluenciesCheckbox?.checked ?? true,
        punctuate: punctuateCheckbox?.checked ?? true,
        formatText: formatTextCheckbox?.checked ?? true,
        keyterms: keyterms
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

      const notificationTicker = (window as any).notificationTicker;
      if (notificationTicker) {
        notificationTicker.success('Settings saved successfully!');
      }
      this.closeSettings();
    } catch (error) {
      console.error('Failed to save settings:', error);
      const notificationTicker = (window as any).notificationTicker;
      if (notificationTicker) {
        notificationTicker.error('Failed to save settings');
      }
    }
  }

  /**
   * Populate themes in the settings modal grouped by category
   */
  private populateThemes(): void {
    const currentTheme = this.themeManager.getCurrentTheme();
    this.selectedThemeId = currentTheme.id;

    // Get all themes
    const themes = this.themeManager.getThemes();

    // Group themes by category
    const categories = ['calm', 'energetic', 'focus', 'creative', 'balanced', 'high-contrast', 'special'];
    const themesByCategory = new Map<string, typeof themes>();

    categories.forEach(category => {
      themesByCategory.set(category, []);
    });

    themes.forEach(theme => {
      const category = theme.category || 'balanced'; // Default fallback
      if (themesByCategory.has(category)) {
        themesByCategory.get(category)!.push(theme);
      }
    });

    // Populate each category's theme grid
    let activeCategoryFound = false;
    let activeCategory = '';

    categories.forEach(category => {
      const categoryThemes = themesByCategory.get(category) || [];
      const themeGrid = document.querySelector(`[data-category-grid="${category}"]`);

      if (!themeGrid) return;

      // Check if current theme is in this category
      const hasActiveTheme = categoryThemes.some(theme => theme.id === this.selectedThemeId);
      if (hasActiveTheme) {
        activeCategoryFound = true;
        activeCategory = category;
      }

      // Build theme cards HTML
      themeGrid.innerHTML = categoryThemes.map(theme => {
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

      // Note: Click handlers are now managed via event delegation in initializeEventListeners()
    });

    // Initialize collapsible category sections
    this.initializeThemeCategorySections(activeCategory);
  }

  /**
   * Initialize collapsible theme category sections
   */
  private initializeThemeCategorySections(activeCategoryToExpand: string): void {
    const categorySections = document.querySelectorAll('.theme-category-section');

    categorySections.forEach(section => {
      const header = section.querySelector('.theme-category-header');
      const content = section.querySelector('.theme-category-content') as HTMLElement;
      const category = section.getAttribute('data-category');

      if (!header || !content) return;

      // Collapse all sections by default
      section.classList.add('collapsed');
      content.style.maxHeight = '0';
      content.style.opacity = '0';
      content.style.paddingTop = '0';
      content.style.paddingBottom = '0';
      content.style.overflow = 'hidden';

      // Expand the active category
      if (category === activeCategoryToExpand) {
        section.classList.remove('collapsed');
        content.style.maxHeight = '5000px';
        content.style.opacity = '1';
        content.style.paddingTop = '15px';
        content.style.paddingBottom = '15px';
        content.style.overflow = 'visible';
      }

      // Note: Click handlers are now managed via event delegation in initializeEventListeners()
    });
  }

  /**
   * Filter themes by category and variant (DEPRECATED - no longer used)
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
        const notificationTicker = (window as any).notificationTicker;
        if (notificationTicker) {
          notificationTicker.error('Failed to load theme');
        }
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

      const notificationTicker = (window as any).notificationTicker;
      if (notificationTicker) {
        notificationTicker.success('Theme applied successfully!');
      }
    } catch (error) {
      console.error('Failed to select theme:', error);
      const notificationTicker = (window as any).notificationTicker;
      if (notificationTicker) {
        notificationTicker.error('Failed to apply theme');
      }
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
