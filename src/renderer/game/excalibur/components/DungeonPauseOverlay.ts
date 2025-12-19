/**
 * DungeonPauseOverlay - HTML-based pause menu for dungeon scene
 *
 * Provides a styled pause menu with Resume and Leave Dungeon options.
 */

import { injectOverlayStyles } from '../../css/index.js';

export interface PauseMenuCallbacks {
  onResume: () => void;
  onLeaveDungeon: () => void;
  onSettings?: () => void;
}

/**
 * DungeonPauseOverlay - Pause menu overlay for dungeon scene
 */
export class DungeonPauseOverlay {
  private container: HTMLDivElement;
  private callbacks: PauseMenuCallbacks;
  private _isOpen = false;
  private selectedIndex = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private settingsOpen = false;
  private settingsIndex = 0;

  private readonly options = ['Resume', 'Settings', 'Leave Dungeon'];

  constructor(parentElement: HTMLElement, callbacks: PauseMenuCallbacks) {
    this.callbacks = callbacks;

    injectOverlayStyles();

    this.container = document.createElement('div');
    this.container.className = 'sq-dungeon-pause-overlay';
    this.container.style.cssText = `
      display: none;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 200;
    `;

    this.buildDOM();
    this.addStyles();
    parentElement.appendChild(this.container);
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  private buildDOM(): void {
    this.container.innerHTML = `
      <div class="sq-pause-backdrop"></div>
      <div class="sq-pause-panel">
        <div class="sq-pause-header">
          <h3 class="sq-pause-title">⏸️ PAUSED</h3>
        </div>
        <div class="sq-pause-body">
          <div class="sq-pause-options"></div>
        </div>
        <div class="sq-pause-footer">
          <div class="sq-pause-hint">
            <kbd>↑↓</kbd> Navigate &nbsp; <kbd>Enter</kbd> Select
          </div>
        </div>
      </div>
    `;

    this.container.addEventListener('click', (e) => this.handleClick(e));
  }

  private addStyles(): void {
    if (document.getElementById('sq-dungeon-pause-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'sq-dungeon-pause-styles';
    styles.textContent = `
      .sq-dungeon-pause-overlay {
        font-family: 'Segoe UI', system-ui, sans-serif;
      }

      .sq-pause-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }

      .sq-pause-panel {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 260px;
        background: linear-gradient(180deg, #2a2a4e 0%, #1e1e32 100%);
        border: 3px solid #6496ff;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        overflow: hidden;
      }

      .sq-pause-header {
        padding: 16px;
        background: linear-gradient(180deg, #3a3a6e 0%, #2a2a4e 100%);
        border-bottom: 2px solid #4a6aaa;
        text-align: center;
      }

      .sq-pause-title {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        color: #fbbf24;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        letter-spacing: 2px;
      }

      .sq-pause-body {
        padding: 16px;
      }

      .sq-pause-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .sq-pause-option {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 14px 20px;
        background: rgba(42, 42, 78, 0.6);
        border: 2px solid transparent;
        border-radius: 8px;
        color: #c4c4c4;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .sq-pause-option:hover {
        background: rgba(100, 150, 255, 0.2);
        color: #fff;
      }

      .sq-pause-option.selected {
        background: linear-gradient(90deg, rgba(100, 150, 255, 0.35) 0%, rgba(100, 150, 255, 0.15) 100%);
        border-color: #fbbf24;
        color: #fff;
        box-shadow: 0 0 12px rgba(251, 191, 36, 0.25);
      }

      .sq-pause-option.selected::before {
        content: '▸ ';
        color: #fbbf24;
      }

      .sq-pause-option.danger:hover,
      .sq-pause-option.danger.selected {
        border-color: #ff6464;
        box-shadow: 0 0 12px rgba(255, 100, 100, 0.25);
      }

      .sq-pause-footer {
        padding: 12px 16px;
        background: rgba(0, 0, 0, 0.2);
        border-top: 1px solid #4a6aaa;
      }

      .sq-pause-hint {
        font-size: 11px;
        color: #888;
        text-align: center;
      }

      .sq-pause-hint kbd {
        display: inline-block;
        padding: 2px 6px;
        background: #2a2a4e;
        border: 1px solid #4a6aaa;
        border-radius: 4px;
        font-family: inherit;
        font-size: 10px;
        color: #b4b4b4;
      }
      
      /* Settings Panel */
      .sq-settings-panel {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 300px;
        background: linear-gradient(180deg, #2a2a4e 0%, #1e1e32 100%);
        border: 3px solid #6496ff;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        overflow: hidden;
      }
      
      .sq-settings-header {
        padding: 16px;
        background: linear-gradient(180deg, #3a3a6e 0%, #2a2a4e 100%);
        border-bottom: 2px solid #4a6aaa;
        text-align: center;
      }
      
      .sq-settings-title {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        color: #fbbf24;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }
      
      .sq-settings-body {
        padding: 16px;
      }
      
      .sq-settings-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        margin-bottom: 8px;
        background: rgba(42, 42, 78, 0.6);
        border: 2px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      
      .sq-settings-row.selected {
        background: linear-gradient(90deg, rgba(100, 150, 255, 0.35) 0%, rgba(100, 150, 255, 0.15) 100%);
        border-color: #fbbf24;
        box-shadow: 0 0 12px rgba(251, 191, 36, 0.25);
      }
      
      .sq-settings-label {
        color: #c4c4c4;
        font-size: 14px;
      }
      
      .sq-settings-row.selected .sq-settings-label {
        color: #fff;
      }
      
      .sq-settings-value {
        color: #64dc64;
        font-size: 14px;
        font-weight: 600;
      }
      
      .sq-settings-hint {
        padding: 12px 16px;
        background: rgba(0, 0, 0, 0.2);
        border-top: 1px solid #4a6aaa;
        font-size: 11px;
        color: #888;
        text-align: center;
      }
      
      .sq-settings-hint kbd {
        display: inline-block;
        padding: 2px 6px;
        background: #2a2a4e;
        border: 1px solid #4a6aaa;
        border-radius: 4px;
        font-family: inherit;
        font-size: 10px;
        color: #b4b4b4;
      }
    `;
    document.head.appendChild(styles);
  }

  private renderOptions(): void {
    const optionsContainer = this.container.querySelector('.sq-pause-options');
    if (!optionsContainer) return;

    optionsContainer.innerHTML = this.options.map((opt, index) => `
      <div 
        class="sq-pause-option ${index === this.selectedIndex ? 'selected' : ''} ${index === 2 ? 'danger' : ''}"
        data-index="${index}"
      >
        ${opt}
      </div>
    `).join('');
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    if (target.classList.contains('sq-pause-backdrop')) {
      this.callbacks.onResume();
      this.close();
      return;
    }

    const optionEl = target.closest('.sq-pause-option') as HTMLElement;
    if (optionEl) {
      const index = parseInt(optionEl.dataset.index || '0');
      this.selectedIndex = index;
      this.confirmSelection();
    }
  }

  private setupKeyboardHandlers(): void {
    this.keyHandler = (e: KeyboardEvent) => {
      if (!this._isOpen) return;

      // Settings panel navigation
      if (this.settingsOpen) {
        switch (e.key) {
          case 'ArrowUp':
          case 'w':
          case 'W':
            e.preventDefault();
            e.stopPropagation();
            this.settingsIndex = Math.max(0, this.settingsIndex - 1);
            this.renderSettingsPanel();
            break;
          case 'ArrowDown':
          case 's':
          case 'S':
            e.preventDefault();
            e.stopPropagation();
            this.settingsIndex = Math.min(4, this.settingsIndex + 1);
            this.renderSettingsPanel();
            break;
          case 'ArrowLeft':
          case 'a':
          case 'A':
            e.preventDefault();
            e.stopPropagation();
            this.adjustSetting(-1);
            break;
          case 'ArrowRight':
          case 'd':
          case 'D':
            e.preventDefault();
            e.stopPropagation();
            this.adjustSetting(1);
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            e.stopPropagation();
            if (this.settingsIndex === 4) {
              this.closeSettings();
            } else if (this.settingsIndex === 2 || this.settingsIndex === 3) {
              this.adjustSetting(1); // Toggle
            }
            break;
          case 'Escape':
            e.preventDefault();
            e.stopPropagation();
            this.closeSettings();
            break;
        }
        return;
      }

      // Main menu navigation
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          e.stopPropagation();
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          this.renderOptions();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          e.stopPropagation();
          this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1);
          this.renderOptions();
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          e.stopPropagation();
          this.confirmSelection();
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          this.callbacks.onResume();
          this.close();
          break;
      }
    };

    window.addEventListener('keydown', this.keyHandler, true);
  }

  private removeKeyboardHandlers(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
  }

  private confirmSelection(): void {
    if (this.selectedIndex === 0) {
      this.callbacks.onResume();
      this.close();
    } else if (this.selectedIndex === 1) {
      // Open settings panel
      this.openSettings();
    } else {
      this.callbacks.onLeaveDungeon();
      this.close();
    }
  }
  
  private openSettings(): void {
    this.settingsOpen = true;
    this.settingsIndex = 0;
    this.renderSettingsPanel();
  }
  
  private closeSettings(): void {
    this.settingsOpen = false;
    this.renderOptions();
    this.renderMainPanel();
  }
  
  private renderMainPanel(): void {
    const panel = this.container.querySelector('.sq-pause-panel') as HTMLElement;
    if (!panel) return;
    panel.style.display = 'block';
    const settingsPanel = this.container.querySelector('.sq-settings-panel') as HTMLElement;
    if (settingsPanel) settingsPanel.style.display = 'none';
  }
  
  private renderSettingsPanel(): void {
    const panel = this.container.querySelector('.sq-pause-panel') as HTMLElement;
    if (panel) panel.style.display = 'none';
    
    let settingsPanel = this.container.querySelector('.sq-settings-panel') as HTMLElement;
    if (!settingsPanel) {
      settingsPanel = document.createElement('div');
      settingsPanel.className = 'sq-settings-panel';
      this.container.appendChild(settingsPanel);
    }
    settingsPanel.style.display = 'block';
    
    // Dynamic import AudioManager to get current values
    const audio = (window as any).__studyquest_audio__ || { musicVolume: 0.5, sfxVolume: 0.5, musicEnabled: true, sfxEnabled: true };
    
    const settings = [
      { id: 'music-vol', label: 'Music Volume', value: `${Math.round((audio.musicVolume || 0.5) * 100)}%`, type: 'slider' },
      { id: 'sfx-vol', label: 'SFX Volume', value: `${Math.round((audio.sfxVolume || 0.5) * 100)}%`, type: 'slider' },
      { id: 'music-toggle', label: 'Music', value: audio.musicEnabled !== false ? 'ON' : 'OFF', type: 'toggle' },
      { id: 'sfx-toggle', label: 'Sound FX', value: audio.sfxEnabled !== false ? 'ON' : 'OFF', type: 'toggle' },
      { id: 'back', label: 'Back', value: '', type: 'button' },
    ];
    
    settingsPanel.innerHTML = `
      <div class="sq-settings-header">
        <h3 class="sq-settings-title">Settings</h3>
      </div>
      <div class="sq-settings-body">
        ${settings.map((s, i) => `
          <div class="sq-settings-row ${i === this.settingsIndex ? 'selected' : ''}" data-id="${s.id}" data-index="${i}">
            <span class="sq-settings-label">${s.label}</span>
            ${s.value ? `<span class="sq-settings-value">${s.value}</span>` : ''}
          </div>
        `).join('')}
      </div>
      <div class="sq-settings-hint">
        <kbd>↑↓</kbd> Navigate &nbsp; <kbd>←→</kbd> Adjust &nbsp; <kbd>Esc</kbd> Back
      </div>
    `;
  }
  
  private adjustSetting(direction: number): void {
    const audio = (window as any).__studyquest_audio__;
    if (!audio) return;
    
    const step = 0.1;
    
    switch (this.settingsIndex) {
      case 0: // Music Volume
        audio.musicVolume = Math.max(0, Math.min(1, (audio.musicVolume || 0.5) + direction * step));
        audio.setMusicVolume?.(audio.musicVolume);
        break;
      case 1: // SFX Volume
        audio.sfxVolume = Math.max(0, Math.min(1, (audio.sfxVolume || 0.5) + direction * step));
        audio.setSfxVolume?.(audio.sfxVolume);
        break;
      case 2: // Music Toggle
        audio.musicEnabled = !audio.musicEnabled;
        audio.setMusicEnabled?.(audio.musicEnabled);
        break;
      case 3: // SFX Toggle
        audio.sfxEnabled = !audio.sfxEnabled;
        audio.setSfxEnabled?.(audio.sfxEnabled);
        break;
      case 4: // Back
        this.closeSettings();
        return;
    }
    
    this.renderSettingsPanel();
  }

  open(): void {
    if (this._isOpen) return;

    this.selectedIndex = 0;
    this.renderOptions();
    this.container.style.display = 'block';
    this._isOpen = true;

    setTimeout(() => {
      if (this._isOpen) {
        this.setupKeyboardHandlers();
      }
    }, 100);
  }

  close(): void {
    if (!this._isOpen) return;

    this.container.style.display = 'none';
    this._isOpen = false;
    this.removeKeyboardHandlers();
  }

  destroy(): void {
    this.removeKeyboardHandlers();
    this.container.remove();
  }
}
