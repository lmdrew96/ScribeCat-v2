/**
 * LayoutManager
 *
 * Manages adaptive workspace layouts with:
 * - Drag-to-resize panel dividers
 * - Collapse/expand panels with animations
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
    this.createCollapseButtons();
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
   * Create collapse/expand buttons for panels
   */
  private createCollapseButtons(): void {
    // Left panel collapse button
    const leftCollapseBtn = document.createElement('button');
    leftCollapseBtn.className = 'panel-collapse-btn left';
    leftCollapseBtn.title = 'Collapse notes panel';
    leftCollapseBtn.innerHTML = '◀';
    leftCollapseBtn.dataset.panel = 'left';

    const leftHeader = this.leftPanel?.querySelector('.panel-header');
    leftHeader?.appendChild(leftCollapseBtn);

    // Right panel collapse button
    const rightCollapseBtn = document.createElement('button');
    rightCollapseBtn.className = 'panel-collapse-btn right';
    rightCollapseBtn.title = 'Collapse transcription panel';
    rightCollapseBtn.innerHTML = '▶';
    rightCollapseBtn.dataset.panel = 'right';

    const rightHeader = this.rightPanel?.querySelector('.panel-header');
    rightHeader?.appendChild(rightCollapseBtn);
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Divider drag events
    this.divider?.addEventListener('mousedown', this.handleDividerMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleDividerMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleDividerMouseUp.bind(this));

    // Collapse button clicks
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const collapseBtn = target.closest('.panel-collapse-btn') as HTMLElement;

      if (collapseBtn) {
        const panel = collapseBtn.dataset.panel as PanelName;
        this.togglePanelCollapse(panel);
      }
    });

    // Window resize - maintain layout proportions
    window.addEventListener('resize', () => {
      this.applyLayout(this.currentLayout);
    });
  }

  /**
   * Handle divider mouse down
   */
  private handleDividerMouseDown(e: MouseEvent): void {
    if (this.currentLayout.leftPanelCollapsed || this.currentLayout.rightPanelCollapsed) {
      return; // Don't allow resize when panels are collapsed
    }

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
   * Toggle panel collapse/expand
   */
  public togglePanelCollapse(panel: PanelName): void {
    if (panel === 'left') {
      this.currentLayout.leftPanelCollapsed = !this.currentLayout.leftPanelCollapsed;

      // If collapsing left, expand right to fill space
      if (this.currentLayout.leftPanelCollapsed) {
        this.currentLayout.rightPanelCollapsed = false;
      }
    } else if (panel === 'right') {
      this.currentLayout.rightPanelCollapsed = !this.currentLayout.rightPanelCollapsed;

      // If collapsing right, expand left to fill space
      if (this.currentLayout.rightPanelCollapsed) {
        this.currentLayout.leftPanelCollapsed = false;
      }
    }

    this.applyLayout(this.currentLayout);
    this.saveLayoutToStorage();
  }

  /**
   * Apply layout to panels
   */
  private applyLayout(layout: LayoutState): void {
    if (!this.leftPanel || !this.rightPanel) return;

    // Update collapse button icons and titles
    this.updateCollapseButtons();

    if (layout.leftPanelCollapsed) {
      this.leftPanel.classList.add('collapsed');
      this.rightPanel.classList.remove('collapsed');
      this.leftPanel.style.flex = '0 0 48px'; // Just enough for collapsed header
      this.rightPanel.style.flex = '1';
    } else if (layout.rightPanelCollapsed) {
      this.leftPanel.classList.remove('collapsed');
      this.rightPanel.classList.add('collapsed');
      this.leftPanel.style.flex = '1';
      this.rightPanel.style.flex = '0 0 48px'; // Just enough for collapsed header
    } else {
      // Both panels visible - use width percentages
      this.leftPanel.classList.remove('collapsed');
      this.rightPanel.classList.remove('collapsed');
      this.leftPanel.style.flex = `0 0 ${layout.leftPanelWidth}%`;
      this.rightPanel.style.flex = `0 0 ${layout.rightPanelWidth}%`;
    }

    this.currentLayout = { ...layout };
  }

  /**
   * Update collapse button icons and titles based on state
   */
  private updateCollapseButtons(): void {
    const leftBtn = this.leftPanel?.querySelector('.panel-collapse-btn') as HTMLElement;
    const rightBtn = this.rightPanel?.querySelector('.panel-collapse-btn') as HTMLElement;

    if (leftBtn) {
      if (this.currentLayout.leftPanelCollapsed) {
        leftBtn.innerHTML = '▶';
        leftBtn.title = 'Expand notes panel';
      } else {
        leftBtn.innerHTML = '◀';
        leftBtn.title = 'Collapse notes panel';
      }
    }

    if (rightBtn) {
      if (this.currentLayout.rightPanelCollapsed) {
        rightBtn.innerHTML = '◀';
        rightBtn.title = 'Expand transcription panel';
      } else {
        rightBtn.innerHTML = '▶';
        rightBtn.title = 'Collapse transcription panel';
      }
    }
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
