/**
 * StudyQuestSettingsPanel
 *
 * Settings overlay for StudyQuest with UI theme selection and volume controls.
 */

import { createLogger } from '../../../shared/logger.js';
import { themeManager } from './StudyQuestThemeManager.js';
import { spriteRenderer } from './StudyQuestSpriteRenderer.js';
import { StudyQuestSound } from './StudyQuestSound.js';
import {
  type StudyQuestTheme,
  type StudyQuestThemeId,
  STUDYQUEST_THEMES,
} from './StudyQuestThemes.js';

const logger = createLogger('StudyQuestSettingsPanel');

export class StudyQuestSettingsPanel {
  private container: HTMLElement | null = null;
  private isVisible = false;
  private onCloseCallback: (() => void) | null = null;

  constructor() {
    // Panel created lazily on first show
  }

  /**
   * Create the settings panel DOM
   */
  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'sq-settings-panel';
    panel.innerHTML = `
      <div class="sq-settings-overlay"></div>
      <div class="sq-settings-content">
        <div class="sq-settings-header">
          <h3>Settings</h3>
          <button class="sq-settings-close pixel-btn" title="Close">X</button>
        </div>

        <div class="sq-settings-body">
          <!-- Theme Selection -->
          <div class="sq-settings-section">
            <label class="sq-settings-label">UI Theme</label>
            <div class="sq-theme-grid" id="sq-theme-grid">
              ${this.renderThemeOptions()}
            </div>
          </div>

          <!-- Volume Control -->
          <div class="sq-settings-section">
            <label class="sq-settings-label">Sound Effects</label>
            <div class="sq-volume-control">
              <button class="sq-sound-toggle pixel-btn" id="sq-sound-toggle">
                ${StudyQuestSound.getEnabled() ? '🔊' : '🔇'}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value="${Math.round(StudyQuestSound.getVolume() * 100)}"
                class="sq-volume-slider"
                id="sq-volume-slider"
                ${!StudyQuestSound.getEnabled() ? 'disabled' : ''}
              />
              <span class="sq-volume-value" id="sq-volume-value">
                ${Math.round(StudyQuestSound.getVolume() * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners(panel);
    return panel;
  }

  /**
   * Render theme option cards
   */
  private renderThemeOptions(): string {
    const currentThemeId = themeManager.getThemeId();
    const themes = Object.values(STUDYQUEST_THEMES);

    return themes.map(theme => `
      <div
        class="sq-theme-option ${theme.id === currentThemeId ? 'selected' : ''}"
        data-theme="${theme.id}"
        title="${theme.name}"
      >
        <div
          class="sq-theme-preview"
          style="background-color: ${theme.colors.surface}; border-color: ${theme.colors.border};"
        >
          <div class="sq-theme-preview-accent" style="background-color: ${theme.colors.primary};"></div>
        </div>
        <span class="sq-theme-name">${theme.name}</span>
      </div>
    `).join('');
  }

  /**
   * Attach event listeners to the panel
   */
  private attachEventListeners(panel: HTMLElement): void {
    // Close button
    const closeBtn = panel.querySelector('.sq-settings-close');
    closeBtn?.addEventListener('click', () => {
      StudyQuestSound.play('menu-back');
      this.hide();
    });

    // Overlay click to close
    const overlay = panel.querySelector('.sq-settings-overlay');
    overlay?.addEventListener('click', () => {
      StudyQuestSound.play('menu-back');
      this.hide();
    });

    // Theme selection
    const themeGrid = panel.querySelector('.sq-theme-grid');
    themeGrid?.addEventListener('click', async (e) => {
      const target = (e.target as HTMLElement).closest('.sq-theme-option');
      if (!target) return;

      const themeId = target.getAttribute('data-theme') as StudyQuestThemeId;
      if (themeId && themeId !== themeManager.getThemeId()) {
        StudyQuestSound.play('menu-select');
        await themeManager.setTheme(themeId);
        this.updateThemeSelection(panel);
      }
    });

    // Sound toggle
    const soundToggle = panel.querySelector('#sq-sound-toggle');
    soundToggle?.addEventListener('click', () => {
      const newEnabled = !StudyQuestSound.getEnabled();
      StudyQuestSound.setEnabled(newEnabled);
      this.updateSoundControls(panel);
      if (newEnabled) {
        StudyQuestSound.play('menu-select');
      }
    });

    // Volume slider
    const volumeSlider = panel.querySelector('#sq-volume-slider') as HTMLInputElement;
    volumeSlider?.addEventListener('input', () => {
      const value = parseInt(volumeSlider.value, 10);
      StudyQuestSound.setVolume(value / 100);
      this.updateVolumeDisplay(panel, value);
    });

    volumeSlider?.addEventListener('change', () => {
      StudyQuestSound.play('menu-select');
    });

    // Prevent clicks inside content from closing
    const content = panel.querySelector('.sq-settings-content');
    content?.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Update theme selection UI
   */
  private updateThemeSelection(panel: HTMLElement): void {
    const currentThemeId = themeManager.getThemeId();
    const options = panel.querySelectorAll('.sq-theme-option');

    options.forEach(option => {
      const themeId = option.getAttribute('data-theme');
      option.classList.toggle('selected', themeId === currentThemeId);
    });

    // Update preview colors to match new theme
    const theme = themeManager.getTheme();
    options.forEach(option => {
      const themeId = option.getAttribute('data-theme') as StudyQuestThemeId;
      const optionTheme = STUDYQUEST_THEMES[themeId];
      const preview = option.querySelector('.sq-theme-preview') as HTMLElement;
      const accent = option.querySelector('.sq-theme-preview-accent') as HTMLElement;

      if (preview && optionTheme) {
        preview.style.backgroundColor = optionTheme.colors.surface;
        preview.style.borderColor = optionTheme.colors.border;
      }
      if (accent && optionTheme) {
        accent.style.backgroundColor = optionTheme.colors.primary;
      }
    });
  }

  /**
   * Update sound control UI
   */
  private updateSoundControls(panel: HTMLElement): void {
    const enabled = StudyQuestSound.getEnabled();
    const toggle = panel.querySelector('#sq-sound-toggle');
    const slider = panel.querySelector('#sq-volume-slider') as HTMLInputElement;

    if (toggle) {
      toggle.textContent = enabled ? '🔊' : '🔇';
    }
    if (slider) {
      slider.disabled = !enabled;
    }
  }

  /**
   * Update volume display
   */
  private updateVolumeDisplay(panel: HTMLElement, value: number): void {
    const display = panel.querySelector('#sq-volume-value');
    if (display) {
      display.textContent = `${value}%`;
    }
  }

  /**
   * Show the settings panel
   */
  show(onClose?: () => void): void {
    if (this.isVisible) return;

    this.onCloseCallback = onClose || null;

    // Create panel if needed
    if (!this.container) {
      this.container = this.createPanel();
    }

    // Append to body
    document.body.appendChild(this.container);

    // Force reflow for animation
    void this.container.offsetHeight;

    // Show with animation
    this.container.classList.add('active');
    this.isVisible = true;

    StudyQuestSound.play('menu-confirm');
    logger.info('Settings panel opened');
  }

  /**
   * Hide the settings panel
   */
  hide(): void {
    if (!this.isVisible || !this.container) return;

    this.container.classList.remove('active');

    // Remove from DOM after animation
    setTimeout(() => {
      if (this.container?.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }, 200);

    this.isVisible = false;

    if (this.onCloseCallback) {
      this.onCloseCallback();
      this.onCloseCallback = null;
    }

    logger.info('Settings panel closed');
  }

  /**
   * Toggle visibility
   */
  toggle(onClose?: () => void): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show(onClose);
    }
  }

  /**
   * Check if panel is visible
   */
  isOpen(): boolean {
    return this.isVisible;
  }

  /**
   * Destroy the panel
   */
  destroy(): void {
    this.hide();
    this.container = null;
  }
}

// Export singleton for convenience
let settingsPanelInstance: StudyQuestSettingsPanel | null = null;

export function getSettingsPanel(): StudyQuestSettingsPanel {
  if (!settingsPanelInstance) {
    settingsPanelInstance = new StudyQuestSettingsPanel();
  }
  return settingsPanelInstance;
}
