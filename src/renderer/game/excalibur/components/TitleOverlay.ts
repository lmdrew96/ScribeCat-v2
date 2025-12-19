/**
 * TitleOverlay - HTML-based title screen UI overlay component
 *
 * Provides a hybrid Canvas/HTML implementation for the title screen.
 * Uses HTML/CSS for the menu, cat selection carousel, and settings panel
 * while the game scene handles the animated background.
 *
 * Benefits over pure Canvas:
 * - Smoother animations with CSS transitions
 * - Better text rendering and styling
 * - Native hover states and focus handling
 * - Cleaner, more maintainable code
 */

import { GameState } from '../../state/GameState.js';
import {
  ALL_CAT_COLORS,
  CAT_DISPLAY_NAMES,
  CAT_UNLOCK_REQUIREMENTS,
  isCatUnlocked,
} from '../../data/catSprites.js';
import type { CatColor } from '../adapters/SpriteAdapter.js';
import { loadCatAnimation } from '../adapters/SpriteAdapter.js';
import { AudioManager } from '../../audio/AudioManager.js';
import { injectOverlayStyles } from '../../css/index.js';

/**
 * Title overlay events
 */
export interface TitleOverlayCallbacks {
  /** Called when New Game is selected with the chosen cat */
  onNewGame: (catColor: CatColor) => void;
  /** Called when Continue is selected */
  onContinue: () => Promise<{ success: boolean; catColor?: CatColor }>;
  /** Called when game should resume after continue mode */
  onResumeGame: (catColor: CatColor) => void;
}

type MenuOption = 'new-game' | 'continue' | 'settings';

/**
 * TitleOverlay manages the HTML-based title screen UI
 */
export class TitleOverlay {
  private container: HTMLDivElement;
  private callbacks: TitleOverlayCallbacks;

  // State
  private _isOpen = false;
  private selectedMenuOption: MenuOption = 'new-game';
  private selectedCatIndex = 0;
  private continueMode = false;
  private settingsOpen = false;

  // Keyboard navigation
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  // Animation frame for cat sprite
  private catSpriteCanvas: HTMLCanvasElement | null = null;
  private catAnimationFrame: number | null = null;
  private currentCatAnimation: { frames: HTMLImageElement[]; frameIndex: number; lastTime: number } | null = null;

  constructor(parentElement: HTMLElement, callbacks: TitleOverlayCallbacks) {
    this.callbacks = callbacks;

    // Ensure overlay styles are injected
    injectOverlayStyles();

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'sq-title-overlay';
    this.container.style.cssText = `
      display: none;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 50;
    `;

    this.buildDOM();
    this.addStyles();
    parentElement.appendChild(this.container);
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * Build the overlay DOM structure
   */
  private buildDOM(): void {
    this.container.innerHTML = `
      <div class="sq-title-content">
        <!-- Title Section -->
        <div class="sq-title-header">
          <h1 class="sq-title-logo">StudyQuest</h1>
          <p class="sq-title-subtitle">A Cozy Cat RPG</p>
        </div>

        <!-- Cat Selection Carousel -->
        <div class="sq-cat-carousel">
          <button class="sq-carousel-arrow sq-carousel-prev" data-action="prev-cat">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <div class="sq-cat-display">
            <div class="sq-cat-name"></div>
            <div class="sq-cat-unlock-status"></div>
            <div class="sq-cat-preview">
              <canvas class="sq-cat-sprite-canvas" width="96" height="96"></canvas>
              <div class="sq-cat-lock-overlay">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1C8.676 1 6 3.676 6 7v2H4v14h16V9h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v2H8V7c0-2.276 1.724-4 4-4zm0 10c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/>
                </svg>
              </div>
            </div>
            <div class="sq-cat-hint">< > to browse (${ALL_CAT_COLORS.length} cats)</div>
          </div>
          <button class="sq-carousel-arrow sq-carousel-next" data-action="next-cat">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

        <!-- Menu Buttons -->
        <div class="sq-title-menu">
          <button class="sq-menu-btn" data-action="new-game">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span>New Game</span>
          </button>
          <button class="sq-menu-btn" data-action="continue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 11-9-9"></path>
              <polyline points="21 3 21 9 15 9"></polyline>
            </svg>
            <span>Continue</span>
          </button>
          <button class="sq-menu-btn" data-action="settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
            </svg>
            <span>Settings</span>
          </button>
        </div>

        <!-- Continue Mode Info -->
        <div class="sq-continue-info" style="display: none;">
          <div class="sq-continue-stats"></div>
          <p class="sq-continue-hint">Change your cat? Press ENTER to confirm</p>
        </div>

        <!-- Footer Controls -->
        <div class="sq-title-footer">
          <span><kbd>W</kbd>/<kbd>S</kbd> Menu</span>
          <span><kbd>A</kbd>/<kbd>D</kbd> Cat</span>
          <span><kbd>Enter</kbd> Select</span>
        </div>

        <!-- Message Display -->
        <div class="sq-title-message" style="display: none;"></div>
      </div>

      <!-- Settings Panel -->
      <div class="sq-settings-panel" style="display: none;">
        <div class="sq-settings-backdrop" data-action="close-settings"></div>
        <div class="sq-settings-content">
          <div class="sq-settings-header">
            <h2>Settings</h2>
            <button class="sq-settings-close" data-action="close-settings">&times;</button>
          </div>
          <div class="sq-settings-body">
            <div class="sq-setting-row" data-setting="music-volume">
              <span class="sq-setting-label">Music Volume</span>
              <div class="sq-setting-control">
                <button class="sq-setting-btn" data-action="decrease">-</button>
                <span class="sq-setting-value">100%</span>
                <button class="sq-setting-btn" data-action="increase">+</button>
              </div>
            </div>
            <div class="sq-setting-row" data-setting="sfx-volume">
              <span class="sq-setting-label">SFX Volume</span>
              <div class="sq-setting-control">
                <button class="sq-setting-btn" data-action="decrease">-</button>
                <span class="sq-setting-value">100%</span>
                <button class="sq-setting-btn" data-action="increase">+</button>
              </div>
            </div>
            <div class="sq-setting-row" data-setting="music-enabled">
              <span class="sq-setting-label">Music</span>
              <div class="sq-setting-control">
                <button class="sq-toggle-btn active" data-action="toggle">ON</button>
              </div>
            </div>
            <div class="sq-setting-row" data-setting="sfx-enabled">
              <span class="sq-setting-label">Sound Effects</span>
              <div class="sq-setting-control">
                <button class="sq-toggle-btn active" data-action="toggle">ON</button>
              </div>
            </div>
          </div>
          <div class="sq-settings-footer">
            <span><kbd>W</kbd>/<kbd>S</kbd> Navigate</span>
            <span><kbd>A</kbd>/<kbd>D</kbd> Adjust</span>
            <span><kbd>Esc</kbd> Back</span>
          </div>
        </div>
      </div>
    `;

    // Cache DOM references
    this.catSpriteCanvas = this.container.querySelector('.sq-cat-sprite-canvas');

    // Setup click handlers
    this.container.addEventListener('click', (e) => this.handleClick(e));
  }

  /**
   * Add component-specific styles
   */
  private addStyles(): void {
    if (document.getElementById('sq-title-overlay-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'sq-title-overlay-styles';
    styles.textContent = `
      .sq-title-overlay {
        font-family: 'Segoe UI', system-ui, sans-serif;
        color: #ffffff;
        text-align: center;
      }

      .sq-title-content {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        background: linear-gradient(
          180deg,
          rgba(0, 0, 0, 0.3) 0%,
          rgba(0, 0, 0, 0.1) 30%,
          rgba(0, 0, 0, 0.1) 70%,
          rgba(0, 0, 0, 0.4) 100%
        );
      }

      /* Title Header */
      .sq-title-header {
        margin-top: 8px;
      }

      .sq-title-logo {
        font-size: 36px;
        font-weight: 800;
        margin: 0;
        color: #ffd700;
        text-shadow:
          3px 3px 0 #8b4513,
          -1px -1px 0 #8b4513,
          1px -1px 0 #8b4513,
          -1px 1px 0 #8b4513,
          0 0 20px rgba(255, 215, 0, 0.5);
        letter-spacing: 2px;
        animation: titleFloat 3s ease-in-out infinite;
      }

      @keyframes titleFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }

      .sq-title-subtitle {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.7);
        margin: 4px 0 0 0;
        letter-spacing: 1px;
      }

      /* Cat Carousel */
      .sq-cat-carousel {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin: 8px 0;
      }

      .sq-carousel-arrow {
        background: rgba(0, 0, 0, 0.5);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.8);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .sq-carousel-arrow:hover {
        background: rgba(100, 150, 255, 0.4);
        border-color: rgba(100, 150, 255, 0.8);
        color: #ffffff;
        transform: scale(1.1);
      }

      .sq-carousel-arrow:active {
        transform: scale(0.95);
      }

      .sq-cat-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }

      .sq-cat-name {
        font-size: 14px;
        font-weight: 600;
        color: #fbbf24;
        text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.5);
      }

      .sq-cat-name.locked {
        color: #888888;
      }

      .sq-cat-unlock-status {
        font-size: 10px;
        color: #ff6b6b;
        min-height: 14px;
      }

      .sq-cat-preview {
        position: relative;
        width: 96px;
        height: 96px;
        background: rgba(0, 0, 0, 0.3);
        border: 3px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        overflow: hidden;
        margin: 4px 0;
      }

      .sq-cat-sprite-canvas {
        width: 100%;
        height: 100%;
        image-rendering: pixelated;
      }

      .sq-cat-lock-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.6);
        color: #888888;
      }

      .sq-cat-lock-overlay.visible {
        display: flex;
      }

      .sq-cat-hint {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.5);
      }

      /* Menu Buttons */
      .sq-title-menu {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 8px 0;
      }

      .sq-menu-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-width: 180px;
        padding: 10px 20px;
        background: linear-gradient(180deg, rgba(42, 42, 78, 0.9) 0%, rgba(30, 30, 50, 0.9) 100%);
        border: 2px solid rgba(100, 150, 255, 0.4);
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.8);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }

      .sq-menu-btn:hover {
        background: linear-gradient(180deg, rgba(58, 58, 110, 0.95) 0%, rgba(42, 42, 78, 0.95) 100%);
        border-color: rgba(100, 150, 255, 0.8);
        color: #ffffff;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(100, 150, 255, 0.3);
      }

      .sq-menu-btn:active {
        transform: translateY(0);
      }

      .sq-menu-btn.selected {
        background: linear-gradient(180deg, rgba(100, 150, 255, 0.3) 0%, rgba(58, 58, 110, 0.9) 100%);
        border-color: #fbbf24;
        color: #fbbf24;
        box-shadow: 0 0 12px rgba(251, 191, 36, 0.3);
      }

      .sq-menu-btn svg {
        flex-shrink: 0;
      }

      /* Continue Mode Info */
      .sq-continue-info {
        background: rgba(0, 100, 0, 0.3);
        border: 2px solid rgba(100, 255, 100, 0.5);
        border-radius: 8px;
        padding: 8px 16px;
        margin: 4px 0;
      }

      .sq-continue-stats {
        font-size: 13px;
        color: #64ff64;
        font-weight: 500;
      }

      .sq-continue-hint {
        font-size: 10px;
        color: rgba(100, 255, 100, 0.7);
        margin: 4px 0 0 0;
      }

      /* Footer */
      .sq-title-footer {
        display: flex;
        gap: 16px;
        font-size: 10px;
        color: rgba(255, 255, 255, 0.4);
        margin-bottom: 4px;
      }

      .sq-title-footer kbd {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        padding: 1px 4px;
        font-family: inherit;
        font-size: 9px;
      }

      /* Message Display */
      .sq-title-message {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid #6496ff;
        border-radius: 8px;
        padding: 12px 24px;
        font-size: 12px;
        z-index: 100;
        animation: messageIn 0.2s ease-out;
      }

      .sq-title-message.error {
        border-color: #ff6b6b;
        color: #ff6b6b;
      }

      .sq-title-message.success {
        border-color: #64ff64;
        color: #64ff64;
      }

      .sq-title-message.loading {
        border-color: #fbbf24;
        color: #fbbf24;
      }

      @keyframes messageIn {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }

      /* Settings Panel */
      .sq-settings-panel {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 200;
      }

      .sq-settings-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        cursor: pointer;
      }

      .sq-settings-content {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 280px;
        max-height: 85%;
        background: linear-gradient(180deg, #2a2a4e 0%, #1e1e32 100%);
        border: 3px solid #6496ff;
        border-radius: 12px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: settingsIn 0.2s ease-out;
      }

      @keyframes settingsIn {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }

      .sq-settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: linear-gradient(180deg, #3a3a6e 0%, #2a2a4e 100%);
        border-bottom: 2px solid #4a6aaa;
      }

      .sq-settings-header h2 {
        margin: 0;
        font-size: 16px;
        color: #fbbf24;
      }

      .sq-settings-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.6);
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }

      .sq-settings-close:hover {
        color: #ff6b6b;
      }

      .sq-settings-body {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
      }

      .sq-setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 6px;
        transition: background 0.15s;
      }

      .sq-setting-row.selected {
        background: rgba(100, 150, 255, 0.2);
        outline: 2px solid rgba(100, 150, 255, 0.5);
      }

      .sq-setting-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
      }

      .sq-setting-control {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .sq-setting-btn {
        width: 24px;
        height: 24px;
        background: rgba(100, 150, 255, 0.3);
        border: 1px solid rgba(100, 150, 255, 0.5);
        border-radius: 4px;
        color: #ffffff;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .sq-setting-btn:hover {
        background: rgba(100, 150, 255, 0.5);
      }

      .sq-setting-value {
        min-width: 40px;
        text-align: center;
        font-size: 12px;
        color: #60a5fa;
      }

      .sq-toggle-btn {
        padding: 4px 12px;
        background: rgba(100, 100, 100, 0.3);
        border: 1px solid rgba(100, 100, 100, 0.5);
        border-radius: 4px;
        color: #888888;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
      }

      .sq-toggle-btn.active {
        background: rgba(100, 255, 100, 0.2);
        border-color: rgba(100, 255, 100, 0.5);
        color: #64ff64;
      }

      .sq-settings-footer {
        display: flex;
        justify-content: center;
        gap: 12px;
        padding: 12px 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        font-size: 9px;
        color: rgba(255, 255, 255, 0.4);
      }

      .sq-settings-footer kbd {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        padding: 1px 4px;
        font-family: inherit;
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Handle click events
   */
  private handleClick(e: Event): void {
    const target = e.target as HTMLElement;
    const action = target.closest('[data-action]')?.getAttribute('data-action');

    if (!action) return;

    switch (action) {
      case 'new-game':
        this.handleNewGame();
        break;
      case 'continue':
        this.handleContinue();
        break;
      case 'settings':
        this.openSettings();
        break;
      case 'close-settings':
        this.closeSettings();
        break;
      case 'prev-cat':
        this.selectPreviousCat();
        break;
      case 'next-cat':
        this.selectNextCat();
        break;
    }
  }

  /**
   * Setup keyboard navigation
   */
  private setupKeyboardHandlers(): void {
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
    }

    this.keyHandler = (e: KeyboardEvent) => {
      if (!this._isOpen) return;

      // Prevent default for game controls
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'Enter', ' ', 'Escape'].includes(e.key)) {
        e.preventDefault();
      }

      if (this.settingsOpen) {
        this.handleSettingsKey(e);
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.selectPreviousMenuItem();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.selectNextMenuItem();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.selectPreviousCat();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.selectNextCat();
          break;
        case 'Enter':
        case ' ':
          this.activateSelectedMenuItem();
          break;
        case 'Escape':
          if (this.continueMode) {
            this.exitContinueMode();
          }
          break;
      }
    };

    document.addEventListener('keydown', this.keyHandler);
  }

  /**
   * Handle keyboard input in settings menu
   */
  private handleSettingsKey(e: KeyboardEvent): void {
    const settingsRows = this.container.querySelectorAll('.sq-setting-row');
    let selectedIndex = Array.from(settingsRows).findIndex(row => row.classList.contains('selected'));
    if (selectedIndex === -1) selectedIndex = 0;

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        selectedIndex = (selectedIndex - 1 + settingsRows.length) % settingsRows.length;
        this.updateSettingsSelection(selectedIndex);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        selectedIndex = (selectedIndex + 1) % settingsRows.length;
        this.updateSettingsSelection(selectedIndex);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.adjustSetting(selectedIndex, -1);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.adjustSetting(selectedIndex, 1);
        break;
      case 'Enter':
      case ' ':
        this.toggleSetting(selectedIndex);
        break;
      case 'Escape':
        this.closeSettings();
        break;
    }
  }

  /**
   * Update settings row selection
   */
  private updateSettingsSelection(index: number): void {
    const settingsRows = this.container.querySelectorAll('.sq-setting-row');
    settingsRows.forEach((row, i) => {
      row.classList.toggle('selected', i === index);
    });
  }

  /**
   * Adjust a setting value
   */
  private adjustSetting(index: number, delta: number): void {
    const settingsRows = this.container.querySelectorAll('.sq-setting-row');
    const row = settingsRows[index] as HTMLElement;
    if (!row) return;

    const setting = row.dataset.setting;
    const step = 0.1;

    switch (setting) {
      case 'music-volume':
        AudioManager.musicVolume = Math.max(0, Math.min(1, AudioManager.musicVolume + delta * step));
        break;
      case 'sfx-volume':
        AudioManager.sfxVolume = Math.max(0, Math.min(1, AudioManager.sfxVolume + delta * step));
        if (delta !== 0) AudioManager.playSfx('coin');
        break;
      case 'music-enabled':
        AudioManager.musicEnabled = delta > 0;
        break;
      case 'sfx-enabled':
        AudioManager.sfxEnabled = delta > 0;
        break;
    }

    this.refreshSettingsValues();
  }

  /**
   * Toggle a boolean setting
   */
  private toggleSetting(index: number): void {
    const settingsRows = this.container.querySelectorAll('.sq-setting-row');
    const row = settingsRows[index] as HTMLElement;
    if (!row) return;

    const setting = row.dataset.setting;

    switch (setting) {
      case 'music-enabled':
        AudioManager.musicEnabled = !AudioManager.musicEnabled;
        break;
      case 'sfx-enabled':
        AudioManager.sfxEnabled = !AudioManager.sfxEnabled;
        break;
    }

    this.refreshSettingsValues();
  }

  /**
   * Refresh settings panel values
   */
  private refreshSettingsValues(): void {
    const panel = this.container.querySelector('.sq-settings-panel');
    if (!panel) return;

    // Music volume
    const musicVolumeRow = panel.querySelector('[data-setting="music-volume"] .sq-setting-value');
    if (musicVolumeRow) musicVolumeRow.textContent = Math.round(AudioManager.musicVolume * 100) + '%';

    // SFX volume
    const sfxVolumeRow = panel.querySelector('[data-setting="sfx-volume"] .sq-setting-value');
    if (sfxVolumeRow) sfxVolumeRow.textContent = Math.round(AudioManager.sfxVolume * 100) + '%';

    // Music enabled
    const musicToggle = panel.querySelector('[data-setting="music-enabled"] .sq-toggle-btn');
    if (musicToggle) {
      musicToggle.classList.toggle('active', AudioManager.musicEnabled);
      musicToggle.textContent = AudioManager.musicEnabled ? 'ON' : 'OFF';
    }

    // SFX enabled
    const sfxToggle = panel.querySelector('[data-setting="sfx-enabled"] .sq-toggle-btn');
    if (sfxToggle) {
      sfxToggle.classList.toggle('active', AudioManager.sfxEnabled);
      sfxToggle.textContent = AudioManager.sfxEnabled ? 'ON' : 'OFF';
    }
  }

  /**
   * Select previous menu item
   */
  private selectPreviousMenuItem(): void {
    const options: MenuOption[] = ['new-game', 'continue', 'settings'];
    const currentIndex = options.indexOf(this.selectedMenuOption);
    this.selectedMenuOption = options[(currentIndex - 1 + options.length) % options.length];
    this.updateMenuHighlight();
  }

  /**
   * Select next menu item
   */
  private selectNextMenuItem(): void {
    const options: MenuOption[] = ['new-game', 'continue', 'settings'];
    const currentIndex = options.indexOf(this.selectedMenuOption);
    this.selectedMenuOption = options[(currentIndex + 1) % options.length];
    this.updateMenuHighlight();
  }

  /**
   * Activate the selected menu item
   */
  private activateSelectedMenuItem(): void {
    switch (this.selectedMenuOption) {
      case 'new-game':
        this.handleNewGame();
        break;
      case 'continue':
        this.handleContinue();
        break;
      case 'settings':
        this.openSettings();
        break;
    }
  }

  /**
   * Update menu button highlights
   */
  private updateMenuHighlight(): void {
    const buttons = this.container.querySelectorAll('.sq-menu-btn');
    buttons.forEach(btn => {
      const action = btn.getAttribute('data-action');
      btn.classList.toggle('selected', action === this.selectedMenuOption);
    });
  }

  /**
   * Select previous cat
   */
  private selectPreviousCat(): void {
    this.selectedCatIndex = (this.selectedCatIndex - 1 + ALL_CAT_COLORS.length) % ALL_CAT_COLORS.length;
    this.updateCatDisplay();
  }

  /**
   * Select next cat
   */
  private selectNextCat(): void {
    this.selectedCatIndex = (this.selectedCatIndex + 1) % ALL_CAT_COLORS.length;
    this.updateCatDisplay();
  }

  /**
   * Update the cat display
   */
  private async updateCatDisplay(): Promise<void> {
    const color = ALL_CAT_COLORS[this.selectedCatIndex];
    const isUnlocked = isCatUnlocked(color);
    const req = CAT_UNLOCK_REQUIREMENTS[color];

    // Update name
    const nameEl = this.container.querySelector('.sq-cat-name');
    if (nameEl) {
      nameEl.textContent = CAT_DISPLAY_NAMES[color];
      nameEl.classList.toggle('locked', !isUnlocked);
    }

    // Update unlock status
    const unlockEl = this.container.querySelector('.sq-cat-unlock-status');
    if (unlockEl) {
      unlockEl.textContent = isUnlocked ? '' : req.description;
    }

    // Update lock overlay
    const lockOverlay = this.container.querySelector('.sq-cat-lock-overlay');
    if (lockOverlay) {
      lockOverlay.classList.toggle('visible', !isUnlocked);
    }

    // Update cat sprite
    if (isUnlocked) {
      await this.loadCatSprite(color);
    } else {
      // Show dark silhouette for locked cats
      const canvas = this.catSpriteCanvas;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'rgba(50, 50, 50, 0.5)';
          ctx.fillRect(16, 16, 64, 64);
        }
      }
      this.stopCatAnimation();
    }
  }

  /**
   * Load and animate cat sprite
   */
  private async loadCatSprite(color: CatColor): Promise<void> {
    try {
      const animation = await loadCatAnimation(color, 'idle');
      
      // Convert Excalibur animation to image frames for HTML canvas
      // For now, just draw a placeholder
      const canvas = this.catSpriteCanvas;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw the first frame from the sprite
          if (animation.frames.length > 0) {
            const sprite = animation.frames[0].graphic;
            // The Excalibur sprite needs to be drawn via its image source
            // Access the underlying image
            const imageSource = (sprite as any)._image || (sprite as any).image;
            if (imageSource && imageSource.image) {
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(imageSource.image, 0, 0, 32, 32, 16, 16, 64, 64);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load cat sprite:', err);
      // Draw placeholder on error
      const canvas = this.catSpriteCanvas;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'rgba(100, 100, 150, 0.5)';
          ctx.fillRect(16, 16, 64, 64);
        }
      }
    }
  }

  /**
   * Stop cat animation loop
   */
  private stopCatAnimation(): void {
    if (this.catAnimationFrame) {
      cancelAnimationFrame(this.catAnimationFrame);
      this.catAnimationFrame = null;
    }
    this.currentCatAnimation = null;
  }

  /**
   * Handle New Game action
   */
  private handleNewGame(): void {
    const selectedCat = ALL_CAT_COLORS[this.selectedCatIndex];
    const isUnlocked = isCatUnlocked(selectedCat);

    if (!isUnlocked) {
      this.showMessage('Cat is locked! Choose an unlocked cat.', 'error');
      return;
    }

    if (this.continueMode) {
      // In continue mode, New Game acts as confirmation
      this.exitContinueMode();
    }

    this.callbacks.onNewGame(selectedCat);
  }

  /**
   * Handle Continue action
   */
  private async handleContinue(): Promise<void> {
    if (this.continueMode) {
      // Confirm continue with selected cat
      const selectedCat = ALL_CAT_COLORS[this.selectedCatIndex];
      const isUnlocked = isCatUnlocked(selectedCat);

      if (!isUnlocked) {
        this.showMessage('Cat is locked! Choose an unlocked cat.', 'error');
        return;
      }

      this.exitContinueMode();
      this.callbacks.onResumeGame(selectedCat);
      return;
    }

    this.showMessage('Loading cloud save...', 'loading');

    const result = await this.callbacks.onContinue();

    this.hideMessage();

    if (!result.success) {
      this.showMessage('No saved game found. Sign in or start a new game!', 'error');
      return;
    }

    // Enter continue mode
    this.enterContinueMode();
  }

  /**
   * Enter continue mode - allow cat selection before resuming
   */
  private enterContinueMode(): void {
    this.continueMode = true;

    // Select the player's current cat
    const currentCatIndex = ALL_CAT_COLORS.indexOf(GameState.player.catColor);
    if (currentCatIndex >= 0) {
      this.selectedCatIndex = currentCatIndex;
      this.updateCatDisplay();
    }

    // Show continue info
    const continueInfo = this.container.querySelector('.sq-continue-info') as HTMLElement;
    if (continueInfo) {
      continueInfo.style.display = 'block';
      const stats = continueInfo.querySelector('.sq-continue-stats');
      if (stats) {
        stats.textContent = `Level ${GameState.player.level} | ${GameState.player.gold}G`;
      }
    }

    // Select continue button
    this.selectedMenuOption = 'continue';
    this.updateMenuHighlight();
  }

  /**
   * Exit continue mode
   */
  private exitContinueMode(): void {
    this.continueMode = false;

    const continueInfo = this.container.querySelector('.sq-continue-info') as HTMLElement;
    if (continueInfo) {
      continueInfo.style.display = 'none';
    }
  }

  /**
   * Open settings panel
   */
  private openSettings(): void {
    this.settingsOpen = true;

    const panel = this.container.querySelector('.sq-settings-panel') as HTMLElement;
    if (panel) {
      panel.style.display = 'block';
    }

    // Select first row
    this.updateSettingsSelection(0);
    this.refreshSettingsValues();
  }

  /**
   * Close settings panel
   */
  private closeSettings(): void {
    this.settingsOpen = false;

    const panel = this.container.querySelector('.sq-settings-panel') as HTMLElement;
    if (panel) {
      panel.style.display = 'none';
    }
  }

  /**
   * Show a message
   */
  private showMessage(text: string, type: 'error' | 'success' | 'loading' = 'loading'): void {
    const messageEl = this.container.querySelector('.sq-title-message') as HTMLElement;
    if (messageEl) {
      messageEl.textContent = text;
      messageEl.className = `sq-title-message ${type}`;
      messageEl.style.display = 'block';

      if (type !== 'loading') {
        setTimeout(() => this.hideMessage(), 2000);
      }
    }
  }

  /**
   * Hide the message
   */
  private hideMessage(): void {
    const messageEl = this.container.querySelector('.sq-title-message') as HTMLElement;
    if (messageEl) {
      messageEl.style.display = 'none';
    }
  }

  /**
   * Open the overlay
   */
  public open(): void {
    this._isOpen = true;
    this.container.style.display = 'block';
    this.setupKeyboardHandlers();
    this.updateMenuHighlight();
    this.updateCatDisplay();
  }

  /**
   * Close the overlay
   */
  public close(): void {
    this._isOpen = false;
    this.container.style.display = 'none';
    this.stopCatAnimation();

    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  /**
   * Destroy the overlay and clean up
   */
  public destroy(): void {
    this.close();
    this.container.remove();

    const styles = document.getElementById('sq-title-overlay-styles');
    if (styles) {
      styles.remove();
    }
  }
}
