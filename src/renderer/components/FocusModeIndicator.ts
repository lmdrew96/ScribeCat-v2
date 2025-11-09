/**
 * FocusModeIndicator
 *
 * UI component that displays the current focus mode and allows mode switching.
 * Shows at bottom-left corner with mode icon and name.
 */

import type { FocusModeManager, FocusMode, FocusModeConfig } from '../managers/FocusModeManager.js';

export class FocusModeIndicator {
  private focusModeManager: FocusModeManager;
  private indicator: HTMLElement | null = null;
  private selector: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private isVisible: boolean = false;

  constructor(focusModeManager: FocusModeManager) {
    this.focusModeManager = focusModeManager;
  }

  /**
   * Initialize the focus mode indicator
   */
  public initialize(): void {
    this.createIndicator();
    this.createSelector();
    this.setupEventListeners();

    // Listen for mode changes
    this.focusModeManager.onModeChange((mode) => {
      this.updateIndicator(mode);
    });

    // Initial update
    const currentMode = this.focusModeManager.getCurrentMode();
    this.updateIndicator(currentMode);

    // Show indicator after a short delay
    setTimeout(() => this.show(), 500);
  }

  /**
   * Create the indicator element
   */
  private createIndicator(): void {
    const indicatorHTML = `
      <div id="focus-mode-indicator" class="focus-mode-indicator">
        <div class="focus-mode-icon" id="focus-mode-icon">📋</div>
        <div class="focus-mode-text">
          <div class="focus-mode-name" id="focus-mode-name">Normal</div>
          <div class="focus-mode-hint">Click to change</div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', indicatorHTML);
    this.indicator = document.getElementById('focus-mode-indicator');
  }

  /**
   * Create the mode selector modal
   */
  private createSelector(): void {
    const modes = this.focusModeManager.getAllModes();
    const currentMode = this.focusModeManager.getCurrentMode();

    const modeOptionsHTML = modes.map(mode => `
      <div class="focus-mode-option ${mode.mode === currentMode ? 'active' : ''}"
           data-mode="${mode.mode}"
           tabindex="0"
           role="button"
           aria-pressed="${mode.mode === currentMode}">
        <div class="focus-mode-option-icon">${mode.icon}</div>
        <div class="focus-mode-option-content">
          <div class="focus-mode-option-name">${mode.name}</div>
          <div class="focus-mode-option-description">${mode.description}</div>
        </div>
      </div>
    `).join('');

    const selectorHTML = `
      <div class="focus-mode-overlay" id="focus-mode-overlay"></div>
      <div class="focus-mode-selector" id="focus-mode-selector">
        <div class="focus-mode-selector-header">
          <div class="focus-mode-selector-title">Focus Mode</div>
          <div class="focus-mode-selector-subtitle">
            Choose a mode to optimize your workspace for different activities
          </div>
        </div>
        <div class="focus-mode-grid" id="focus-mode-grid">
          ${modeOptionsHTML}
        </div>
        <div class="focus-mode-selector-footer">
          <button class="focus-mode-selector-btn focus-mode-selector-btn-cancel" id="focus-mode-cancel">
            Cancel
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', selectorHTML);
    this.selector = document.getElementById('focus-mode-selector');
    this.overlay = document.getElementById('focus-mode-overlay');
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Click indicator to open selector
    this.indicator?.addEventListener('click', () => {
      this.openSelector();
    });

    // Click overlay to close
    this.overlay?.addEventListener('click', () => {
      this.closeSelector();
    });

    // Click cancel to close
    const cancelBtn = document.getElementById('focus-mode-cancel');
    cancelBtn?.addEventListener('click', () => {
      this.closeSelector();
    });

    // Click mode option to select
    const modeGrid = document.getElementById('focus-mode-grid');
    modeGrid?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const modeOption = target.closest('.focus-mode-option') as HTMLElement;

      if (modeOption) {
        const mode = modeOption.dataset.mode as FocusMode;
        this.selectMode(mode);
      }
    });

    // Keyboard navigation for mode options
    modeGrid?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const target = e.target as HTMLElement;
        if (target.classList.contains('focus-mode-option')) {
          const mode = target.dataset.mode as FocusMode;
          this.selectMode(mode);
          e.preventDefault();
        }
      }
    });

    // Escape to close selector
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.selector?.classList.contains('visible')) {
        this.closeSelector();
      }
    });
  }

  /**
   * Update indicator to show current mode
   */
  private updateIndicator(mode: FocusMode): void {
    const config = this.focusModeManager.getModeConfig(mode);
    if (!config) return;

    const icon = document.getElementById('focus-mode-icon');
    const name = document.getElementById('focus-mode-name');

    if (icon) icon.textContent = config.icon;
    if (name) name.textContent = config.name;

    // Update active state in selector
    const modeOptions = document.querySelectorAll('.focus-mode-option');
    modeOptions.forEach(option => {
      const optionMode = (option as HTMLElement).dataset.mode;
      if (optionMode === mode) {
        option.classList.add('active');
        option.setAttribute('aria-pressed', 'true');
      } else {
        option.classList.remove('active');
        option.setAttribute('aria-pressed', 'false');
      }
    });

    // Add pulse animation if not normal mode
    if (mode !== 'normal') {
      this.indicator?.classList.add('active');
    } else {
      this.indicator?.classList.remove('active');
    }
  }

  /**
   * Show the indicator
   */
  public show(): void {
    this.isVisible = true;
    this.indicator?.classList.add('visible');
  }

  /**
   * Hide the indicator
   */
  public hide(): void {
    this.isVisible = false;
    this.indicator?.classList.remove('visible');
  }

  /**
   * Open the mode selector
   */
  public openSelector(): void {
    this.selector?.classList.add('visible');
    this.overlay?.classList.add('visible');

    // Focus first option
    const firstOption = this.selector?.querySelector('.focus-mode-option') as HTMLElement;
    firstOption?.focus();
  }

  /**
   * Close the mode selector
   */
  public closeSelector(): void {
    this.selector?.classList.remove('visible');
    this.overlay?.classList.remove('visible');
  }

  /**
   * Select a focus mode
   */
  private selectMode(mode: FocusMode): void {
    this.focusModeManager.setMode(mode);
    this.closeSelector();

    // Show toast notification
    this.showModeChangeToast(mode);
  }

  /**
   * Show a toast notification for mode change
   */
  private showModeChangeToast(mode: FocusMode): void {
    const config = this.focusModeManager.getModeConfig(mode);
    if (!config) return;

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'focus-mode-toast';
    toast.innerHTML = `
      <span>${config.icon}</span>
      <span>${config.name} activated</span>
    `;
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10000;
      padding: 12px 20px;
      background: var(--bg-secondary, #2d2d2d);
      border: 1px solid var(--accent, #007acc);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      color: var(--text-primary, #ffffff);
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      opacity: 0;
      animation: focusModeToastIn 0.3s ease forwards;
    `;

    document.body.appendChild(toast);

    // Add fade in animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes focusModeToastIn {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `;
    document.head.appendChild(style);

    // Remove after 2 seconds
    setTimeout(() => {
      toast.style.animation = 'focusModeToastOut 0.3s ease forwards';
      const outStyle = document.createElement('style');
      outStyle.textContent = `
        @keyframes focusModeToastOut {
          from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
          to {
            opacity: 0;
            transform: translateX(-50%) translateY(-10px);
          }
        }
      `;
      document.head.appendChild(outStyle);

      setTimeout(() => {
        toast.remove();
        style.remove();
        outStyle.remove();
      }, 300);
    }, 2000);
  }

  /**
   * Check if indicator is visible
   */
  public getIsVisible(): boolean {
    return this.isVisible;
  }
}
