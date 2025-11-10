/**
 * LayoutManager
 *
 * Manages adaptive workspace layouts with:
 * - Drag-to-resize panel dividers
 * - Custom layout saving/loading
 * - Workspace presets for different activities
 * - Persistent layout preferences
 */

export type PanelName = 'left' | 'right' | 'ai-drawer';

export interface LayoutState {
  leftPanelWidth: number; // percentage (0-100)
  rightPanelWidth: number; // percentage (0-100)
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  aiDrawerWidth: number; // pixels
}

export interface WorkspacePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  layout: LayoutState;
}

export class LayoutManager {
  private mainContent: HTMLElement | null = null;
  private leftPanel: HTMLElement | null = null;
  private rightPanel: HTMLElement | null = null;
  private divider: HTMLElement | null = null;

  private isDragging: boolean = false;
  private startX: number = 0;
  private startLeftWidth: number = 0;
  private resizeListenerEnabled: boolean = true;

  private currentLayout: LayoutState = {
    leftPanelWidth: 60,
    rightPanelWidth: 40,
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    aiDrawerWidth: 400
  };

  private customLayouts: Map<string, WorkspacePreset> = new Map();

  // Workspace presets
  private presets: WorkspacePreset[] = [
    {
      id: 'balanced',
      name: 'Balanced',
      description: 'Equal space for notes and transcription',
      icon: '⚖️',
      layout: {
        leftPanelWidth: 50,
        rightPanelWidth: 50,
        leftPanelCollapsed: false,
        rightPanelCollapsed: false,
        aiDrawerWidth: 400
      }
    },
    {
      id: 'recording',
      name: 'Recording Setup',
      description: 'Focus on transcription while taking notes',
      icon: '🎙️',
      layout: {
        leftPanelWidth: 40,
        rightPanelWidth: 60,
        leftPanelCollapsed: false,
        rightPanelCollapsed: false,
        aiDrawerWidth: 400
      }
    },
    {
      id: 'review',
      name: 'Review Layout',
      description: 'Maximize notes for reviewing and editing',
      icon: '📝',
      layout: {
        leftPanelWidth: 70,
        rightPanelWidth: 30,
        leftPanelCollapsed: false,
        rightPanelCollapsed: false,
        aiDrawerWidth: 400
      }
    },
    {
      id: 'focus-notes',
      name: 'Focus: Notes',
      description: 'Full screen for notes, transcription collapsed',
      icon: '📋',
      layout: {
        leftPanelWidth: 100,
        rightPanelWidth: 0,
        leftPanelCollapsed: false,
        rightPanelCollapsed: true,
        aiDrawerWidth: 400
      }
    },
    {
      id: 'focus-transcription',
      name: 'Focus: Transcription',
      description: 'Full screen for transcription, notes collapsed',
      icon: '🎧',
      layout: {
        leftPanelWidth: 0,
        rightPanelWidth: 100,
        leftPanelCollapsed: true,
        rightPanelCollapsed: false,
        aiDrawerWidth: 400
      }
    }
  ];

  constructor() {
    this.loadLayoutFromStorage();
    this.loadCustomLayoutsFromStorage();
  }

  /**
   * Initialize layout manager
   */
  public initialize(): void {
    this.mainContent = document.querySelector('.main-content');
    this.leftPanel = document.querySelector('.left-panel');
    this.rightPanel = document.querySelector('.right-panel');

    if (!this.mainContent || !this.leftPanel || !this.rightPanel) {
      console.error('LayoutManager: Required elements not found');
      return;
    }

    this.createDivider();
    this.applyLayout(this.currentLayout);
    this.setupEventListeners();
  }

  /**
   * Create resizable divider between panels
   */
  private createDivider(): void {
    this.divider = document.createElement('div');
    this.divider.className = 'panel-divider';
    this.divider.innerHTML = '<div class="divider-handle"></div>';

    // Insert divider between left and right panels
    this.leftPanel?.insertAdjacentElement('afterend', this.divider);
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Divider drag events
    this.divider?.addEventListener('mousedown', this.handleDividerMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleDividerMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleDividerMouseUp.bind(this));

    // Window resize - maintain layout proportions
    window.addEventListener('resize', () => {
      if (this.resizeListenerEnabled) {
        this.applyLayout(this.currentLayout);
      }
    });
  }

  /**
   * Handle divider mouse down
   */
  private handleDividerMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.startX = e.clientX;
    this.startLeftWidth = this.currentLayout.leftPanelWidth;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    this.divider?.classList.add('dragging');
  }

  /**
   * Handle divider mouse move
   */
  private handleDividerMouseMove(e: MouseEvent): void {
    if (!this.isDragging || !this.mainContent) return;

    const containerWidth = this.mainContent.offsetWidth;
    const deltaX = e.clientX - this.startX;
    const deltaPercent = (deltaX / containerWidth) * 100;

    let newLeftWidth = this.startLeftWidth + deltaPercent;

    // Constrain to min/max widths (20%-80%)
    newLeftWidth = Math.max(20, Math.min(80, newLeftWidth));

    this.currentLayout.leftPanelWidth = newLeftWidth;
    this.currentLayout.rightPanelWidth = 100 - newLeftWidth;

    this.applyLayout(this.currentLayout);
  }

  /**
   * Handle divider mouse up
   */
  private handleDividerMouseUp(): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    this.divider?.classList.remove('dragging');

    // Save layout after resize
    this.saveLayoutToStorage();
  }

  /**
   * Apply layout to panels
   */
  private applyLayout(layout: LayoutState): void {
    if (!this.leftPanel || !this.rightPanel || !this.divider) return;

    // Handle collapsed states (from presets like Focus modes)
    if (layout.leftPanelCollapsed) {
      this.leftPanel.style.display = 'none';
      this.rightPanel.style.flex = '1';
      this.divider.style.display = 'none';
    } else if (layout.rightPanelCollapsed) {
      this.leftPanel.style.flex = '1';
      this.rightPanel.style.display = 'none';
      this.divider.style.display = 'none';
    } else {
      // Both panels visible - use width percentages
      this.leftPanel.style.display = '';
      this.rightPanel.style.display = '';
      this.divider.style.display = '';
      this.leftPanel.style.flex = `0 0 ${layout.leftPanelWidth}%`;
      this.rightPanel.style.flex = `0 0 ${layout.rightPanelWidth}%`;
    }

    this.currentLayout = { ...layout };
  }

  /**
   * Apply a workspace preset
   */
  public applyPreset(presetId: string): void {
    const preset = this.presets.find(p => p.id === presetId) ||
                   this.customLayouts.get(presetId);

    if (!preset) {
      console.error(`Preset not found: ${presetId}`);
      return;
    }

    this.applyLayout(preset.layout);
    this.saveLayoutToStorage();

    // Show toast notification
    const toastManager = (window as any).toastManager;
    if (toastManager) {
      toastManager.success(`Layout: ${preset.name}`, {
        icon: preset.icon,
        duration: 2000,
        position: 'bottom-center'
      });
    }
  }

  /**
   * Save current layout as custom preset
   */
  public saveCustomLayout(name: string, description: string, icon: string): void {
    const id = `custom-${Date.now()}`;
    const preset: WorkspacePreset = {
      id,
      name,
      description,
      icon,
      layout: { ...this.currentLayout }
    };

    this.customLayouts.set(id, preset);
    this.saveCustomLayoutsToStorage();

    // Show success toast
    const toastManager = (window as any).toastManager;
    if (toastManager) {
      toastManager.success(`Saved layout: ${name}`, {
        icon: '💾',
        duration: 2000
      });
    }
  }

  /**
   * Delete custom layout
   */
  public deleteCustomLayout(id: string): void {
    this.customLayouts.delete(id);
    this.saveCustomLayoutsToStorage();
  }

  /**
   * Get all workspace presets (built-in + custom)
   */
  public getAllPresets(): WorkspacePreset[] {
    return [
      ...this.presets,
      ...Array.from(this.customLayouts.values())
    ];
  }

  /**
   * Temporarily disable resize listener (useful during tutorials/animations)
   */
  public disableResizeListener(): void {
    this.resizeListenerEnabled = false;
  }

  /**
   * Re-enable resize listener
   */
  public enableResizeListener(): void {
    this.resizeListenerEnabled = true;
  }

  /**
   * Get current layout state
   */
  public getCurrentLayout(): LayoutState {
    return { ...this.currentLayout };
  }

  /**
   * Save layout to localStorage
   */
  private saveLayoutToStorage(): void {
    try {
      localStorage.setItem('scribecat-layout', JSON.stringify(this.currentLayout));
    } catch (error) {
      console.error('Failed to save layout to storage:', error);
    }
  }

  /**
   * Load layout from localStorage
   */
  private loadLayoutFromStorage(): void {
    try {
      const saved = localStorage.getItem('scribecat-layout');
      if (saved) {
        this.currentLayout = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load layout from storage:', error);
    }
  }

  /**
   * Save custom layouts to localStorage
   */
  private saveCustomLayoutsToStorage(): void {
    try {
      const layouts = Array.from(this.customLayouts.entries());
      localStorage.setItem('scribecat-custom-layouts', JSON.stringify(layouts));
    } catch (error) {
      console.error('Failed to save custom layouts:', error);
    }
  }

  /**
   * Load custom layouts from localStorage
   */
  private loadCustomLayoutsFromStorage(): void {
    try {
      const saved = localStorage.getItem('scribecat-custom-layouts');
      if (saved) {
        const layouts = JSON.parse(saved);
        this.customLayouts = new Map(layouts);
      }
    } catch (error) {
      console.error('Failed to load custom layouts:', error);
    }
  }
}
