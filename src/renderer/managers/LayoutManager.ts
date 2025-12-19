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

  constructor() {
    this.loadLayoutFromStorage();
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

    // Add resizing class to disable transitions for instant feedback
    this.leftPanel?.classList.add('resizing');
    this.rightPanel?.classList.add('resizing');
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

    // Remove resizing class to restore smooth transitions
    this.leftPanel?.classList.remove('resizing');
    this.rightPanel?.classList.remove('resizing');
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
      // Both panels visible - use flex-grow ratios instead of fixed percentages
      // This allows panels to shrink if needed while maintaining proportions
      this.leftPanel.style.display = '';
      this.rightPanel.style.display = '';
      this.divider.style.display = '';
      // Use flex-grow ratio based on percentages, with flex-shrink: 1 to allow shrinking
      this.leftPanel.style.flex = `${layout.leftPanelWidth} 1 0`;
      this.rightPanel.style.flex = `${layout.rightPanelWidth} 1 0`;
    }

    this.currentLayout = { ...layout };
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
}
