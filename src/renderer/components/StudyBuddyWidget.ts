/**
 * StudyBuddyWidget
 *
 * DOM component that wraps the StudyBuddyCanvas and provides:
 * - Positioning in corner of screen
 * - Drag-to-move functionality
 * - Focus timer display
 * - Quick settings
 * - Integration with main app
 */

import { createLogger } from '../../shared/logger.js';
import { StudyBuddyCanvas } from '../canvas/StudyBuddyCanvas.js';
import { StudyBuddyManager, type PendingRewards } from '../managers/StudyBuddyManager.js';
import { CatSpriteManager, type CatColor } from '../canvas/CatSpriteManager.js';

const logger = createLogger('StudyBuddyWidget');

export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
export type WidgetSize = 'small' | 'medium' | 'large';

interface WidgetSettings {
  enabled: boolean;
  position: WidgetPosition;
  size: WidgetSize;
  showTimer: boolean;
  showMessages: boolean;
  soundEnabled: boolean;
  breakReminders: boolean;
  breakInterval: number; // minutes
}

const DEFAULT_SETTINGS: WidgetSettings = {
  enabled: true,
  position: 'bottom-left',
  size: 'medium',
  showTimer: true,
  showMessages: true,
  soundEnabled: false,
  breakReminders: true,
  breakInterval: 45,
};

const SIZE_SCALES: Record<WidgetSize, number> = {
  small: 0.75,
  medium: 1,
  large: 1.25,
};

export class StudyBuddyWidget {
  private container: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private buddyCanvas: StudyBuddyCanvas | null = null;
  private timerElement: HTMLDivElement | null = null;
  private settingsPanel: HTMLDivElement | null = null;

  private settings: WidgetSettings;
  private isDragging: boolean = false;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  private customPosition: { x: number; y: number } | null = null;

  private breakReminderInterval: ReturnType<typeof setInterval> | null = null;
  private timerUpdateInterval: ReturnType<typeof setInterval> | null = null;

  private onOpenStudyQuest?: () => void;

  constructor() {
    // Load settings
    this.settings = this.loadSettings();

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'study-buddy-widget';
    this.container.id = 'study-buddy-widget';

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'study-buddy-canvas';

    this.buildWidget();
    this.setupEventListeners();
  }

  /**
   * Mount widget to the DOM
   */
  mount(parent: HTMLElement = document.body): void {
    if (!this.settings.enabled) {
      logger.info('Study Buddy is disabled');
      return;
    }

    parent.appendChild(this.container);

    // Initialize canvas
    this.buddyCanvas = new StudyBuddyCanvas(this.canvas);

    // Initialize manager with canvas
    StudyBuddyManager.initialize(this.buddyCanvas, {
      onReward: (xp, gold) => this.onReward(xp, gold),
      onMilestone: (minutes, milestone) => this.onMilestone(minutes, milestone),
    });

    // Start the canvas
    this.buddyCanvas.start();

    // Start tracking activity
    StudyBuddyManager.start();

    // Start timer updates
    this.startTimerUpdates();

    // Set up break reminders
    if (this.settings.breakReminders) {
      this.startBreakReminders();
    }

    // Preload cat sprites
    CatSpriteManager.preloadStarters().catch((err) => {
      logger.warn('Failed to preload cat sprites:', err);
    });

    logger.info('Study Buddy widget mounted');
  }

  /**
   * Unmount widget from the DOM
   */
  unmount(): void {
    StudyBuddyManager.stop();
    this.buddyCanvas?.stop();

    if (this.breakReminderInterval) {
      clearInterval(this.breakReminderInterval);
    }
    if (this.timerUpdateInterval) {
      clearInterval(this.timerUpdateInterval);
    }

    this.container.remove();
    logger.info('Study Buddy widget unmounted');
  }

  /**
   * Show/hide the widget
   */
  setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none';
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<WidgetSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    this.applySettings();
  }

  /**
   * Get current settings
   */
  getSettings(): WidgetSettings {
    return { ...this.settings };
  }

  /**
   * Set callback for opening StudyQuest modal
   */
  setOnOpenStudyQuest(callback: () => void): void {
    this.onOpenStudyQuest = callback;
  }

  /**
   * Get pending rewards from manager
   */
  getPendingRewards(): PendingRewards {
    return StudyBuddyManager.getPendingRewards();
  }

  /**
   * Claim rewards (called when opening StudyQuest)
   */
  claimRewards(): PendingRewards {
    return StudyBuddyManager.claimRewards();
  }

  /**
   * Record user activity
   */
  recordActivity(): void {
    StudyBuddyManager.recordActivity();
  }

  /**
   * Set the cat color
   */
  setCatColor(color: CatColor): void {
    StudyBuddyManager.setCatColor(color);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildWidget(): void {
    // Apply styles
    this.applyStyles();

    // Canvas container
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'study-buddy-canvas-container';
    canvasContainer.appendChild(this.canvas);
    this.container.appendChild(canvasContainer);

    // Timer display
    if (this.settings.showTimer) {
      this.timerElement = document.createElement('div');
      this.timerElement.className = 'study-buddy-timer';
      this.timerElement.textContent = '0:00';
      this.container.appendChild(this.timerElement);
    }

    // Settings button
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'study-buddy-settings-btn';
    settingsBtn.innerHTML = '⚙️';
    settingsBtn.title = 'Settings';
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSettingsPanel();
    });
    this.container.appendChild(settingsBtn);

    // Build settings panel (hidden by default)
    this.buildSettingsPanel();
  }

  private buildSettingsPanel(): void {
    this.settingsPanel = document.createElement('div');
    this.settingsPanel.className = 'study-buddy-settings-panel';
    this.settingsPanel.style.display = 'none';

    this.settingsPanel.innerHTML = `
      <div class="settings-header">
        <span>Study Buddy Settings</span>
        <button class="settings-close">×</button>
      </div>
      <div class="settings-content">
        <label class="settings-row">
          <span>Show Timer</span>
          <input type="checkbox" id="sb-show-timer" ${this.settings.showTimer ? 'checked' : ''}>
        </label>
        <label class="settings-row">
          <span>Show Messages</span>
          <input type="checkbox" id="sb-show-messages" ${this.settings.showMessages ? 'checked' : ''}>
        </label>
        <label class="settings-row">
          <span>Break Reminders</span>
          <input type="checkbox" id="sb-break-reminders" ${this.settings.breakReminders ? 'checked' : ''}>
        </label>
        <label class="settings-row">
          <span>Size</span>
          <select id="sb-size">
            <option value="small" ${this.settings.size === 'small' ? 'selected' : ''}>Small</option>
            <option value="medium" ${this.settings.size === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="large" ${this.settings.size === 'large' ? 'selected' : ''}>Large</option>
          </select>
        </label>
        <label class="settings-row">
          <span>Position</span>
          <select id="sb-position">
            <option value="bottom-right" ${this.settings.position === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
            <option value="bottom-left" ${this.settings.position === 'bottom-left' ? 'selected' : ''}>Bottom Left</option>
            <option value="top-right" ${this.settings.position === 'top-right' ? 'selected' : ''}>Top Right</option>
            <option value="top-left" ${this.settings.position === 'top-left' ? 'selected' : ''}>Top Left</option>
          </select>
        </label>
        <button class="settings-open-studyquest">Open StudyQuest</button>
      </div>
    `;

    // Event listeners for settings
    this.settingsPanel.querySelector('.settings-close')?.addEventListener('click', () => {
      this.toggleSettingsPanel();
    });

    this.settingsPanel.querySelector('#sb-show-timer')?.addEventListener('change', (e) => {
      this.updateSettings({ showTimer: (e.target as HTMLInputElement).checked });
    });

    this.settingsPanel.querySelector('#sb-show-messages')?.addEventListener('change', (e) => {
      this.updateSettings({ showMessages: (e.target as HTMLInputElement).checked });
    });

    this.settingsPanel.querySelector('#sb-break-reminders')?.addEventListener('change', (e) => {
      this.updateSettings({ breakReminders: (e.target as HTMLInputElement).checked });
    });

    this.settingsPanel.querySelector('#sb-size')?.addEventListener('change', (e) => {
      this.updateSettings({ size: (e.target as HTMLSelectElement).value as WidgetSize });
    });

    this.settingsPanel.querySelector('#sb-position')?.addEventListener('change', (e) => {
      this.customPosition = null; // Reset custom position
      this.updateSettings({ position: (e.target as HTMLSelectElement).value as WidgetPosition });
    });

    this.settingsPanel.querySelector('.settings-open-studyquest')?.addEventListener('click', () => {
      if (this.onOpenStudyQuest) {
        this.onOpenStudyQuest();
      }
      this.toggleSettingsPanel();
    });

    this.container.appendChild(this.settingsPanel);
  }

  private applyStyles(): void {
    const scale = SIZE_SCALES[this.settings.size];
    const width = 100 * scale;
    const height = 140 * scale;

    // Container styles
    Object.assign(this.container.style, {
      position: 'fixed',
      width: `${width}px`,
      height: `${height}px`,
      zIndex: '9999',
      cursor: 'grab',
      userSelect: 'none',
      transition: 'opacity 0.3s ease',
    });

    // Position
    if (this.customPosition) {
      this.container.style.left = `${this.customPosition.x}px`;
      this.container.style.top = `${this.customPosition.y}px`;
      this.container.style.right = 'auto';
      this.container.style.bottom = 'auto';
    } else {
      this.applyPosition();
    }

    // Canvas styles
    Object.assign(this.canvas.style, {
      width: `${width}px`,
      height: `${height - 20}px`,
      imageRendering: 'pixelated',
    });
  }

  private applyPosition(): void {
    const margin = '20px';

    // Reset all positions
    this.container.style.top = 'auto';
    this.container.style.bottom = 'auto';
    this.container.style.left = 'auto';
    this.container.style.right = 'auto';

    switch (this.settings.position) {
      case 'bottom-right':
        this.container.style.bottom = margin;
        this.container.style.right = margin;
        break;
      case 'bottom-left':
        this.container.style.bottom = margin;
        this.container.style.left = margin;
        break;
      case 'top-right':
        this.container.style.top = margin;
        this.container.style.right = margin;
        break;
      case 'top-left':
        this.container.style.top = margin;
        this.container.style.left = margin;
        break;
    }
  }

  private applySettings(): void {
    this.applyStyles();

    // Timer visibility
    if (this.timerElement) {
      this.timerElement.style.display = this.settings.showTimer ? 'block' : 'none';
    }

    // Break reminders
    if (this.settings.breakReminders) {
      this.startBreakReminders();
    } else if (this.breakReminderInterval) {
      clearInterval(this.breakReminderInterval);
      this.breakReminderInterval = null;
    }
  }

  private setupEventListeners(): void {
    // Drag functionality
    this.container.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON' ||
          (e.target as HTMLElement).tagName === 'INPUT' ||
          (e.target as HTMLElement).tagName === 'SELECT') {
        return;
      }

      this.isDragging = true;
      this.container.style.cursor = 'grabbing';

      const rect = this.container.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;

      // Keep within viewport
      const maxX = window.innerWidth - this.container.offsetWidth;
      const maxY = window.innerHeight - this.container.offsetHeight;

      this.customPosition = {
        x: Math.max(0, Math.min(x, maxX)),
        y: Math.max(0, Math.min(y, maxY)),
      };

      this.container.style.left = `${this.customPosition.x}px`;
      this.container.style.top = `${this.customPosition.y}px`;
      this.container.style.right = 'auto';
      this.container.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.container.style.cursor = 'grab';
        this.saveCustomPosition();
      }
    });

    // Click to open StudyQuest
    this.canvas.addEventListener('dblclick', () => {
      if (this.onOpenStudyQuest) {
        this.onOpenStudyQuest();
      }
    });

    // Activity tracking from global events
    document.addEventListener('keydown', () => this.recordActivity());
    document.addEventListener('mousedown', () => this.recordActivity());
  }

  private toggleSettingsPanel(): void {
    if (!this.settingsPanel) return;

    const isVisible = this.settingsPanel.style.display !== 'none';
    this.settingsPanel.style.display = isVisible ? 'none' : 'block';
  }

  private startTimerUpdates(): void {
    if (this.timerUpdateInterval) {
      clearInterval(this.timerUpdateInterval);
    }

    this.timerUpdateInterval = setInterval(() => {
      if (this.timerElement && this.settings.showTimer) {
        const minutes = StudyBuddyManager.getFocusMinutes();
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        if (hours > 0) {
          this.timerElement.textContent = `${hours}:${mins.toString().padStart(2, '0')}`;
        } else {
          this.timerElement.textContent = `${mins}:00`;
        }
      }
    }, 1000);
  }

  private startBreakReminders(): void {
    if (this.breakReminderInterval) {
      clearInterval(this.breakReminderInterval);
    }

    const interval = this.settings.breakInterval * 60 * 1000;
    this.breakReminderInterval = setInterval(() => {
      StudyBuddyManager.showBreakReminder();
    }, interval);
  }

  private onReward(xp: number, gold: number): void {
    logger.info(`Reward earned: ${xp} XP, ${gold} gold`);
    // Could add visual indicator here
  }

  private onMilestone(minutes: number, milestone: string): void {
    logger.info(`Milestone reached: ${milestone} (${minutes} minutes)`);
    // Could trigger special celebration
  }

  private loadSettings(): WidgetSettings {
    try {
      const saved = localStorage.getItem('study-buddy-settings');
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (error) {
      logger.warn('Failed to load settings:', error);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('study-buddy-settings', JSON.stringify(this.settings));
    } catch (error) {
      logger.warn('Failed to save settings:', error);
    }
  }

  private saveCustomPosition(): void {
    if (this.customPosition) {
      try {
        localStorage.setItem('study-buddy-position', JSON.stringify(this.customPosition));
      } catch (error) {
        logger.warn('Failed to save position:', error);
      }
    }
  }

  private loadCustomPosition(): { x: number; y: number } | null {
    try {
      const saved = localStorage.getItem('study-buddy-position');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      logger.warn('Failed to load position:', error);
    }
    return null;
  }
}

// CSS styles (injected once)
const injectStyles = (): void => {
  if (document.getElementById('study-buddy-styles')) return;

  const style = document.createElement('style');
  style.id = 'study-buddy-styles';
  style.textContent = `
    .study-buddy-widget {
      background: transparent;
      border-radius: 8px;
      overflow: visible;
    }

    .study-buddy-canvas-container {
      background: rgba(26, 26, 46, 0.5);
      border-radius: 8px;
      padding: 4px;
    }

    .study-buddy-canvas {
      display: block;
    }

    .study-buddy-timer {
      text-align: center;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      font-weight: bold;
      color: #ffffff;
      text-shadow: 1px 1px 2px #000000;
      padding: 4px 0;
    }

    .study-buddy-settings-btn {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      cursor: pointer;
      font-size: 10px;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .study-buddy-widget:hover .study-buddy-settings-btn {
      opacity: 1;
    }

    .study-buddy-settings-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .study-buddy-settings-panel {
      position: absolute;
      bottom: 100%;
      right: 0;
      margin-bottom: 8px;
      width: 200px;
      background: #2a2a4e;
      border: 2px solid #4a4a6a;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      font-family: 'Courier New', monospace;
      font-size: 11px;
      color: #ffffff;
    }

    .settings-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-bottom: 1px solid #4a4a6a;
      font-weight: bold;
    }

    .settings-close {
      background: none;
      border: none;
      color: #ffffff;
      cursor: pointer;
      font-size: 16px;
      padding: 0 4px;
    }

    .settings-close:hover {
      color: #ff6b6b;
    }

    .settings-content {
      padding: 8px 12px;
    }

    .settings-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      cursor: pointer;
    }

    .settings-row input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .settings-row select {
      background: #1a1a2e;
      color: #ffffff;
      border: 1px solid #4a4a6a;
      border-radius: 4px;
      padding: 4px;
      cursor: pointer;
    }

    .settings-open-studyquest {
      width: 100%;
      margin-top: 8px;
      padding: 8px;
      background: #6366f1;
      color: #ffffff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      font-weight: bold;
    }

    .settings-open-studyquest:hover {
      background: #4f46e5;
    }
  `;

  document.head.appendChild(style);
};

// Inject styles on module load
injectStyles();
