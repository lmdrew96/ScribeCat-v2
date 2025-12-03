/**
 * FocusModeManager
 *
 * Manages focus modes to reduce cognitive load during different activities.
 * Modes: Normal, Recording Focus, Review Focus, Study Focus
 */

import { createLogger } from '../../shared/logger.js';

const logger = createLogger('FocusModeManager');

export type FocusMode = 'normal' | 'recording' | 'review' | 'study';

export interface FocusModeConfig {
  mode: FocusMode;
  name: string;
  description: string;
  icon: string;
  panelVisibility: {
    transcription: boolean;
    notes: boolean;
    aiTools: boolean;
    audio: boolean;
  };
  layout?: 'split' | 'single-notes' | 'single-transcription' | 'ai-prominent';
}

export class FocusModeManager {
  private currentMode: FocusMode = 'normal';
  private modes: Map<FocusMode, FocusModeConfig> = new Map();
  private onModeChangeCallbacks: Array<(mode: FocusMode) => void> = [];

  constructor() {
    this.initializeModes();
  }

  /**
   * Initialize focus mode configurations
   */
  private initializeModes(): void {
    // Normal Mode: Everything visible, balanced layout
    this.modes.set('normal', {
      mode: 'normal',
      name: 'Normal',
      description: 'All panels visible, balanced layout',
      icon: '📋',
      panelVisibility: {
        transcription: true,
        notes: true,
        aiTools: true,
        audio: true
      },
      layout: 'split'
    });

    // Recording Focus: Hide transcription, maximize notes
    this.modes.set('recording', {
      mode: 'recording',
      name: 'Recording Focus',
      description: 'Hide transcription, focus on note-taking during class',
      icon: '🎙️',
      panelVisibility: {
        transcription: false,
        notes: true,
        aiTools: false,
        audio: true
      },
      layout: 'single-notes'
    });

    // Review Focus: Hide AI tools, maximize content
    this.modes.set('review', {
      mode: 'review',
      name: 'Review Focus',
      description: 'Hide AI tools, focus on reading transcription and notes',
      icon: '📖',
      panelVisibility: {
        transcription: true,
        notes: true,
        aiTools: false,
        audio: true
      },
      layout: 'split'
    });

    // Study Focus: AI tools prominent, side-by-side layout
    this.modes.set('study', {
      mode: 'study',
      name: 'Study Focus',
      description: 'AI tools prominent, optimize for active studying',
      icon: '🧠',
      panelVisibility: {
        transcription: true,
        notes: true,
        aiTools: true,
        audio: true
      },
      layout: 'ai-prominent'
    });
  }

  /**
   * Set focus mode
   */
  public setMode(mode: FocusMode): void {
    if (!this.modes.has(mode)) {
      console.warn(`Unknown focus mode: ${mode}`);
      return;
    }

    this.currentMode = mode;
    const config = this.modes.get(mode)!;

    console.log(`🎯 Focus mode: ${config.name}`);

    // Apply mode configuration
    this.applyModeConfig(config);

    // Save preference
    this.savePreference(mode);

    // Notify listeners
    this.notifyModeChange(mode);
  }

  /**
   * Apply focus mode configuration to UI
   */
  private applyModeConfig(config: FocusModeConfig): void {
    // Apply layout through LayoutManager if available
    const layoutManager = (window as any).layoutManager;

    if (config.layout) {
      if (!layoutManager) {
        logger.warn(`LayoutManager not available, cannot apply layout: ${config.layout}`);
      } else {
        switch (config.layout) {
          case 'single-notes':
            // Focus: Notes layout
            layoutManager.applyPreset('focus-notes');
            break;
          case 'single-transcription':
            // Focus: Transcription layout
            layoutManager.applyPreset('focus-transcription');
            break;
          case 'split':
            // Balanced layout
            layoutManager.applyPreset('balanced');
            break;
          case 'ai-prominent':
            // Recording setup (gives more space to transcription + AI)
            layoutManager.applyPreset('recording');
            break;
        }
      }
    }

    // Handle AI drawer visibility
    const aiDrawer = document.getElementById('ai-chat-drawer') as HTMLElement;
    if (aiDrawer && !config.panelVisibility.aiTools && !aiDrawer.classList.contains('hidden')) {
      // Just close it if it's open
      const closeBtn = document.getElementById('close-drawer-btn');
      if (closeBtn) {
        closeBtn.click();
      }
    }
  }

  /**
   * Get current focus mode
   */
  public getCurrentMode(): FocusMode {
    return this.currentMode;
  }

  /**
   * Get all available modes
   */
  public getAllModes(): FocusModeConfig[] {
    return Array.from(this.modes.values());
  }

  /**
   * Get mode config
   */
  public getModeConfig(mode: FocusMode): FocusModeConfig | undefined {
    return this.modes.get(mode);
  }

  /**
   * Cycle to next focus mode
   */
  public cycleMode(): void {
    const modeOrder: FocusMode[] = ['normal', 'recording', 'review', 'study'];
    const currentIndex = modeOrder.indexOf(this.currentMode);
    const nextIndex = (currentIndex + 1) % modeOrder.length;
    const nextMode = modeOrder[nextIndex];

    this.setMode(nextMode);
  }

  /**
   * Toggle between normal and a specific mode
   */
  public toggleMode(targetMode: FocusMode): void {
    if (this.currentMode === targetMode) {
      this.setMode('normal');
    } else {
      this.setMode(targetMode);
    }
  }

  /**
   * Register callback for mode changes
   */
  public onModeChange(callback: (mode: FocusMode) => void): void {
    this.onModeChangeCallbacks.push(callback);
  }

  /**
   * Notify listeners of mode change
   */
  private notifyModeChange(mode: FocusMode): void {
    for (const callback of this.onModeChangeCallbacks) {
      callback(mode);
    }
  }

  /**
   * Save focus mode preference
   */
  private savePreference(mode: FocusMode): void {
    try {
      localStorage.setItem('scribecat_focus_mode', mode);
    } catch (error) {
      console.warn('Failed to save focus mode preference:', error);
    }
  }

  /**
   * Load focus mode preference
   */
  public loadPreference(): void {
    try {
      const savedMode = localStorage.getItem('scribecat_focus_mode') as FocusMode;
      if (savedMode && this.modes.has(savedMode)) {
        this.setMode(savedMode);
      }
    } catch (error) {
      console.warn('Failed to load focus mode preference:', error);
    }
  }

  /**
   * Reset to normal mode
   */
  public reset(): void {
    this.setMode('normal');
  }
}
