/**
 * ViewModeManager
 *
 * Manages different session view modes:
 * - Timeline: Calendar view showing sessions by date
 * - Grid: Card-based grid layout (current default)
 * - List: Compact table-style view
 * - Board: Kanban board (To Review | Studying | Mastered)
 */

import type { Session } from '../../domain/entities/Session.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('ViewModeManager');

export type ViewMode = 'timeline' | 'grid' | 'list' | 'board';

export interface ViewModeConfig {
  mode: ViewMode;
  label: string;
  icon: string;
  description: string;
}

export const VIEW_MODES: Record<ViewMode, ViewModeConfig> = {
  timeline: {
    mode: 'timeline',
    label: 'Timeline',
    icon: '📅',
    description: 'Calendar view showing sessions by date'
  },
  grid: {
    mode: 'grid',
    label: 'Grid',
    icon: '⊞',
    description: 'Card-based grid layout'
  },
  list: {
    mode: 'list',
    label: 'List',
    icon: '☰',
    description: 'Compact table-style view'
  },
  board: {
    mode: 'board',
    label: 'Board',
    icon: '▦',
    description: 'Kanban board organization'
  }
};

export class ViewModeManager {
  private currentMode: ViewMode = 'grid';
  private container: HTMLElement;
  private onModeChange: ((mode: ViewMode) => void) | null = null;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`ViewMode container not found: ${containerId}`);
    }

    this.container = container;
    this.loadSavedMode();
  }

  /**
   * Get current view mode
   */
  getCurrentMode(): ViewMode {
    return this.currentMode;
  }

  /**
   * Set view mode
   */
  setMode(mode: ViewMode): void {
    if (this.currentMode === mode) return;

    logger.info(`Switching view mode: ${this.currentMode} → ${mode}`);

    this.currentMode = mode;
    this.saveMode();

    // Update container class for CSS styling (preserve session-list for scrolling!)
    this.container.className = `session-list session-view-${mode}`;

    // Notify listeners
    if (this.onModeChange) {
      this.onModeChange(mode);
    }

    // Show notification
    const notificationTicker = (window as any).notificationTicker;
    if (notificationTicker) {
      const config = VIEW_MODES[mode];
      notificationTicker.info(`${config.icon} View: ${config.label}`, 2000);
    }
  }

  /**
   * Cycle to next view mode
   */
  cycleMode(): void {
    const modes: ViewMode[] = ['grid', 'list', 'timeline', 'board'];
    const currentIndex = modes.indexOf(this.currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.setMode(modes[nextIndex]);
  }

  /**
   * Set mode change callback
   */
  onChange(callback: (mode: ViewMode) => void): void {
    this.onModeChange = callback;
  }

  /**
   * Get all view modes
   */
  getAllModes(): ViewModeConfig[] {
    return Object.values(VIEW_MODES);
  }

  /**
   * Create view mode switcher UI
   */
  createViewModeSwitcher(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) {
      logger.error(`View mode switcher container not found: ${containerId}`);
      return;
    }

    container.innerHTML = `
      <div class="view-mode-switcher">
        ${this.getAllModes().map(config => `
          <button
            class="view-mode-btn ${config.mode === this.currentMode ? 'active' : ''}"
            data-mode="${config.mode}"
            title="${config.description}"
            aria-label="${config.label} view"
          >
            <span class="view-mode-icon">${config.icon}</span>
            <span class="view-mode-label">${config.label}</span>
          </button>
        `).join('')}
      </div>
    `;

    // Add click handlers
    container.querySelectorAll('.view-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode') as ViewMode;
        this.setMode(mode);
        this.updateSwitcherUI(container);
      });
    });
  }

  /**
   * Update switcher UI to reflect current mode
   */
  private updateSwitcherUI(container: HTMLElement): void {
    container.querySelectorAll('.view-mode-btn').forEach(btn => {
      const mode = btn.getAttribute('data-mode');
      if (mode === this.currentMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /**
   * Save current mode to localStorage
   */
  private saveMode(): void {
    try {
      localStorage.setItem('scribecat-view-mode', this.currentMode);
    } catch (error) {
      logger.error('Failed to save view mode', error);
    }
  }

  /**
   * Load saved mode from localStorage
   */
  private loadSavedMode(): void {
    try {
      const saved = localStorage.getItem('scribecat-view-mode');
      if (saved && (saved in VIEW_MODES)) {
        this.currentMode = saved as ViewMode;
        this.container.className = `session-list session-view-${this.currentMode}`;
      }
    } catch (error) {
      logger.error('Failed to load view mode', error);
    }
  }
}
