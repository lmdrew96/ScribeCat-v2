/**
 * FloatingToolbar
 *
 * Floating formatting toolbar that appears on text selection.
 * Provides quick access to common formatting actions.
 */

export interface FloatingToolbarAction {
  id: string;
  icon: string;
  title: string;
  shortcut?: string;
  action: () => void;
  isActive?: () => boolean;
}

export class FloatingToolbar {
  private toolbar: HTMLElement | null = null;
  private isVisible: boolean = false;
  private actions: FloatingToolbarAction[] = [];
  private editor: any = null; // Tiptap editor instance
  private shouldShowCallback?: () => boolean; // Callback to check if toolbar should show

  constructor() {
    // Toolbar will be created in initialize()
  }

  /**
   * Set callback to determine if toolbar should show
   */
  public setShouldShowCallback(callback: () => boolean): void {
    this.shouldShowCallback = callback;
  }

  /**
   * Initialize the floating toolbar
   */
  public initialize(editor: any): void {
    this.editor = editor;
    this.createToolbar();
    this.setupSelectionListener();
  }

  /**
   * Register an action
   */
  public registerAction(action: FloatingToolbarAction): void {
    this.actions.push(action);
    this.renderActions();
  }

  /**
   * Register multiple actions
   */
  public registerActions(actions: FloatingToolbarAction[]): void {
    this.actions.push(...actions);
    this.renderActions();
  }

  /**
   * Clear all actions
   */
  public clearActions(): void {
    this.actions = [];
    this.renderActions();
  }

  /**
   * Create the toolbar element
   */
  private createToolbar(): void {
    const toolbarHTML = `
      <div id="floating-toolbar" class="floating-toolbar" style="display: none;">
        <div class="floating-toolbar-content">
          <div class="floating-toolbar-actions" id="floating-toolbar-actions">
            <!-- Actions will be rendered here -->
          </div>
        </div>
        <div class="floating-toolbar-arrow"></div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', toolbarHTML);
    this.toolbar = document.getElementById('floating-toolbar');
  }

  /**
   * Setup selection listener
   */
  private setupSelectionListener(): void {
    if (!this.editor) return;

    // Listen to selection changes
    this.editor.on('selectionUpdate', () => {
      this.handleSelectionChange();
    });

    // Also handle focus loss
    this.editor.on('blur', () => {
      // Delay hiding to allow button clicks
      setTimeout(() => {
        if (!this.isMouseOverToolbar()) {
          this.hide();
        }
      }, 200);
    });

    // Hide on click outside
    document.addEventListener('mousedown', (e) => {
      if (!this.toolbar || !this.isVisible) return;

      const target = e.target as HTMLElement;
      if (!this.toolbar.contains(target) && !this.editor.view.dom.contains(target)) {
        this.hide();
      }
    });
  }

  /**
   * Handle selection change
   */
  private handleSelectionChange(): void {
    if (!this.editor) return;

    // Check if we should show the toolbar (e.g., full toolbar might be open)
    if (this.shouldShowCallback && !this.shouldShowCallback()) {
      this.hide();
      return;
    }

    const { from, to, empty } = this.editor.state.selection;

    // Show toolbar only if there's a non-empty selection
    if (empty || from === to) {
      this.hide();
      return;
    }

    // Get selection coordinates
    const coords = this.getSelectionCoords();
    if (!coords) {
      this.hide();
      return;
    }

    // Show and position toolbar
    this.show(coords);
    this.updateActionStates();
  }

  /**
   * Get selection coordinates
   */
  private getSelectionCoords(): { x: number; y: number } | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) return null;

    return {
      x: rect.left + rect.width / 2,
      y: rect.top
    };
  }

  /**
   * Show the toolbar at given coordinates
   */
  private show(coords: { x: number; y: number }): void {
    if (!this.toolbar) return;

    this.isVisible = true;
    this.toolbar.style.display = 'flex';

    // Position toolbar above selection
    const toolbarRect = this.toolbar.getBoundingClientRect();
    const offsetY = 10; // Space between selection and toolbar

    let x = coords.x - toolbarRect.width / 2;
    let y = coords.y - toolbarRect.height - offsetY;

    // Keep toolbar within viewport
    const margin = 10;
    x = Math.max(margin, Math.min(x, window.innerWidth - toolbarRect.width - margin));

    // If toolbar would go above viewport, show below selection instead
    if (y < margin) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        y = rect.bottom + offsetY;
      }
    }

    this.toolbar.style.left = `${x}px`;
    this.toolbar.style.top = `${y}px`;

    // Animate in
    this.toolbar.classList.add('visible');
  }

  /**
   * Hide the toolbar
   */
  private hide(): void {
    if (!this.toolbar) return;

    this.isVisible = false;
    this.toolbar.classList.remove('visible');

    // Wait for animation before hiding
    setTimeout(() => {
      if (!this.isVisible && this.toolbar) {
        this.toolbar.style.display = 'none';
      }
    }, 150);
  }

  /**
   * Check if mouse is over toolbar
   */
  private isMouseOverToolbar(): boolean {
    if (!this.toolbar) return false;
    return this.toolbar.matches(':hover');
  }

  /**
   * Render actions
   */
  private renderActions(): void {
    const actionsContainer = document.getElementById('floating-toolbar-actions');
    if (!actionsContainer) return;

    let html = '';

    this.actions.forEach((action) => {
      const isActive = action.isActive ? action.isActive() : false;
      html += `
        <button
          class="floating-toolbar-btn ${isActive ? 'active' : ''}"
          data-action-id="${action.id}"
          title="${action.title}${action.shortcut ? ` (${action.shortcut})` : ''}"
        >
          <span class="btn-icon">${action.icon}</span>
        </button>
      `;
    });

    actionsContainer.innerHTML = html;

    // Add click listeners
    actionsContainer.querySelectorAll('.floating-toolbar-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const actionId = (btn as HTMLElement).getAttribute('data-action-id');
        const action = this.actions.find(a => a.id === actionId);

        if (action) {
          action.action();
          this.updateActionStates();
        }
      });
    });
  }

  /**
   * Update action states (active/inactive)
   */
  private updateActionStates(): void {
    const actionsContainer = document.getElementById('floating-toolbar-actions');
    if (!actionsContainer) return;

    this.actions.forEach((action) => {
      const btn = actionsContainer.querySelector(`[data-action-id="${action.id}"]`);
      if (btn && action.isActive) {
        if (action.isActive()) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });
  }

  /**
   * Get visibility state
   */
  public getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Manually hide (useful for cleanup)
   */
  public forceHide(): void {
    this.hide();
  }
}
