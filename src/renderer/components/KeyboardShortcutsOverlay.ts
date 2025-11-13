/**
 * KeyboardShortcutsOverlay Component
 *
 * Display keyboard shortcuts in a beautiful overlay.
 * Triggered by pressing "?" key.
 */

export interface ShortcutCategory {
  name: string;
  shortcuts: Shortcut[];
}

export interface Shortcut {
  keys: string[];
  description: string;
}

export class KeyboardShortcutsOverlay {
  private overlay: HTMLElement | null = null;
  private isVisible: boolean = false;
  private categories: ShortcutCategory[] = [];

  /**
   * Initialize shortcuts overlay
   */
  initialize(categories: ShortcutCategory[]): void {
    this.categories = categories;
    this.createOverlay();
    this.setupEventListeners();
  }

  /**
   * Create overlay element
   */
  private createOverlay(): void {
    const overlayHTML = `
      <div id="keyboard-shortcuts-overlay" class="keyboard-shortcuts-overlay" style="display: none;">
        <div class="keyboard-shortcuts-backdrop"></div>
        <div class="keyboard-shortcuts-modal">
          <div class="keyboard-shortcuts-header">
            <h2>Keyboard Shortcuts</h2>
            <button id="close-shortcuts-overlay" class="close-shortcuts-btn" aria-label="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          <div class="keyboard-shortcuts-content" id="keyboard-shortcuts-content">
            <!-- Content will be rendered here -->
          </div>
          <div class="keyboard-shortcuts-footer">
            <p>Press <kbd>?</kbd> to toggle this overlay</p>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', overlayHTML);
    this.overlay = document.getElementById('keyboard-shortcuts-overlay');

    this.renderContent();
  }

  /**
   * Render shortcuts content
   */
  private renderContent(): void {
    const content = document.getElementById('keyboard-shortcuts-content');
    if (!content) return;

    content.innerHTML = `
      <div class="shortcuts-grid">
        ${this.categories.map(category => `
          <div class="shortcuts-category">
            <h3 class="shortcuts-category-name">${category.name}</h3>
            <div class="shortcuts-list">
              ${category.shortcuts.map(shortcut => `
                <div class="shortcut-item">
                  <div class="shortcut-keys">
                    ${shortcut.keys.map(key => `<kbd>${key}</kbd>`).join('')}
                  </div>
                  <div class="shortcut-description">${shortcut.description}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Close button
    const closeBtn = document.getElementById('close-shortcuts-overlay');
    closeBtn?.addEventListener('click', () => {
      this.hide();
    });

    // Backdrop click
    const backdrop = document.querySelector('.keyboard-shortcuts-backdrop');
    backdrop?.addEventListener('click', () => {
      this.hide();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }

      // "?" key to toggle
      if (e.key === '?' && !this.isInputFocused()) {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Show overlay
   */
  show(): void {
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      this.isVisible = true;
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Hide overlay
   */
  hide(): void {
    if (this.overlay) {
      this.overlay.style.display = 'none';
      this.isVisible = false;
      document.body.style.overflow = '';
    }
  }

  /**
   * Toggle overlay
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if input is focused
   */
  private isInputFocused(): boolean {
    const activeElement = document.activeElement;
    return (
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      (activeElement as HTMLElement)?.isContentEditable
    );
  }

  /**
   * Get default shortcuts
   */
  static getDefaultShortcuts(): ShortcutCategory[] {
    return [
      {
        name: 'Navigation',
        shortcuts: [
          { keys: ['↑', '↓'], description: 'Navigate sessions' },
          { keys: ['Enter'], description: 'Open selected session' },
          { keys: ['Space'], description: 'Preview session' },
          { keys: ['Esc'], description: 'Close preview/modal' }
        ]
      },
      {
        name: 'Search & Filter',
        shortcuts: [
          { keys: ['Cmd', 'F'], description: 'Focus search' },
          { keys: ['Cmd', 'K'], description: 'Command palette' }
        ]
      },
      {
        name: 'View Modes',
        shortcuts: [
          { keys: ['Cmd', '1'], description: 'Grid view' },
          { keys: ['Cmd', '2'], description: 'List view' },
          { keys: ['Cmd', '3'], description: 'Timeline view' },
          { keys: ['Cmd', '4'], description: 'Board view' }
        ]
      },
      {
        name: 'Actions',
        shortcuts: [
          { keys: ['Cmd', 'N'], description: 'New recording' },
          { keys: ['Cmd', 'S'], description: 'Save notes' },
          { keys: ['Del'], description: 'Delete selected' }
        ]
      },
      {
        name: 'Recording',
        shortcuts: [
          { keys: ['Shift', 'Space'], description: 'Start/Stop recording' },
          { keys: ['Cmd', 'P'], description: 'Pause/Resume' }
        ]
      }
    ];
  }
}
