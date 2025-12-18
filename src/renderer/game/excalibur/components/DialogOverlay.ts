/**
 * DialogOverlay - Reusable HTML-based dialog component
 *
 * Provides a consistent styled dialog/modal matching the ShopOverlay aesthetic.
 * Use for confirmations, dungeon selection, inn dialogs, etc.
 *
 * Features:
 * - Consistent styling with ShopOverlay and game theme
 * - Keyboard navigation support
 * - Backdrop click to close
 * - Flexible content areas
 */

import { injectOverlayStyles } from '../../css/index.js';

export interface DialogButton {
  id: string;
  label: string;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

export interface DialogItem {
  id: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
  data?: unknown;
}

export interface DialogOverlayOptions {
  title: string;
  width?: number;
  maxHeight?: number;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  items?: DialogItem[];
  buttons?: DialogButton[];
  content?: string;
  controlsHint?: string;
  onClose?: () => void;
  onItemSelect?: (item: DialogItem, index: number) => void;
  onButtonClick?: (buttonId: string) => void;
}

/**
 * DialogOverlay - Reusable modal dialog with consistent styling
 */
export class DialogOverlay {
  private container: HTMLDivElement;
  private options: DialogOverlayOptions;

  // State
  private _isOpen = false;
  private selectedIndex = 0;
  private items: DialogItem[] = [];

  // DOM references
  private listContainer: HTMLDivElement | null = null;
  private contentContainer: HTMLDivElement | null = null;

  // Keyboard navigation
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(parentElement: HTMLElement, options: DialogOverlayOptions) {
    this.options = {
      width: 320,
      maxHeight: 280,
      showCloseButton: true,
      closeOnBackdrop: true,
      ...options,
    };
    this.items = options.items || [];

    // Ensure overlay styles are injected
    injectOverlayStyles();

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'sq-dialog-overlay';
    this.container.style.cssText = `
      display: none;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 100;
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
    const { title, width, maxHeight, showCloseButton, buttons, content, controlsHint } = this.options;

    this.container.innerHTML = `
      <div class="sq-backdrop" data-action="close"></div>
      <div class="sq-panel sq-dialog-panel" style="width: ${width}px; max-height: ${maxHeight}px;">
        <div class="sq-panel-header">
          <h3 class="sq-panel-title">${title}</h3>
          ${showCloseButton ? '<button class="sq-panel-close" data-action="close">&times;</button>' : ''}
        </div>
        <div class="sq-panel-body sq-dialog-body">
          ${content ? `<div class="sq-dialog-content">${content}</div>` : ''}
          <div class="sq-dialog-list sq-list"></div>
        </div>
        ${buttons && buttons.length > 0 ? `
          <div class="sq-dialog-buttons">
            ${buttons.map(btn => `
              <button 
                class="sq-button ${btn.primary ? 'sq-button-primary' : ''} ${btn.danger ? 'sq-button-danger' : ''}"
                data-button="${btn.id}"
                ${btn.disabled ? 'disabled' : ''}
              >${btn.label}</button>
            `).join('')}
          </div>
        ` : ''}
        <div class="sq-panel-footer">
          <div class="sq-controls-hint">
            ${controlsHint || '<kbd>↑↓</kbd> Navigate &nbsp; <kbd>Enter</kbd> Select &nbsp; <kbd>Esc</kbd> Close'}
          </div>
        </div>
      </div>
    `;

    // Cache DOM references
    this.listContainer = this.container.querySelector('.sq-dialog-list');
    this.contentContainer = this.container.querySelector('.sq-dialog-content');

    // Setup click handlers
    this.container.addEventListener('click', (e) => this.handleClick(e));
  }

  /**
   * Add component-specific styles
   */
  private addStyles(): void {
    if (document.getElementById('sq-dialog-overlay-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'sq-dialog-overlay-styles';
    styles.textContent = `
      .sq-dialog-overlay {
        font-family: 'Segoe UI', system-ui, sans-serif;
      }

      .sq-dialog-overlay .sq-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        cursor: pointer;
      }

      .sq-dialog-panel {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        background: linear-gradient(180deg, #2a2a4e 0%, #1e1e32 100%);
        border: 3px solid #6496ff;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        padding: 0;
        overflow: hidden;
      }

      .sq-dialog-panel .sq-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: linear-gradient(180deg, #3a3a6e 0%, #2a2a4e 100%);
        border-bottom: 2px solid #4a6aaa;
      }

      .sq-dialog-panel .sq-panel-title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #fff;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .sq-dialog-panel .sq-panel-close {
        background: none;
        border: none;
        color: #888;
        font-size: 20px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
        transition: color 0.15s;
      }

      .sq-dialog-panel .sq-panel-close:hover {
        color: #ff6464;
      }

      .sq-dialog-body {
        flex: 1;
        padding: 12px;
        overflow-y: auto;
        min-height: 0;
      }

      .sq-dialog-content {
        color: #d4d4d4;
        font-size: 13px;
        line-height: 1.5;
        margin-bottom: 12px;
        text-align: center;
      }

      .sq-dialog-list {
        max-height: 160px;
        overflow-y: auto;
      }

      .sq-dialog-list::-webkit-scrollbar {
        width: 6px;
      }

      .sq-dialog-list::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 3px;
      }

      .sq-dialog-list::-webkit-scrollbar-thumb {
        background: #6496ff;
        border-radius: 3px;
      }

      .sq-dialog-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.1s;
        border: 1px solid transparent;
        margin-bottom: 4px;
      }

      .sq-dialog-item:hover:not(.disabled) {
        background-color: rgba(100, 150, 255, 0.15);
      }

      .sq-dialog-item.selected {
        background: linear-gradient(90deg, rgba(100, 150, 255, 0.3) 0%, rgba(100, 150, 255, 0.1) 100%);
        border-color: #fbbf24;
        box-shadow: 0 0 8px rgba(251, 191, 36, 0.2);
      }

      .sq-dialog-item.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .sq-dialog-item-label {
        flex: 1;
        font-size: 14px;
        color: #fff;
      }

      .sq-dialog-item.disabled .sq-dialog-item-label {
        color: #888;
      }

      .sq-dialog-item-sublabel {
        font-size: 12px;
        color: #96c896;
        margin-left: 12px;
      }

      .sq-dialog-item.disabled .sq-dialog-item-sublabel {
        color: #b46464;
      }

      .sq-dialog-buttons {
        display: flex;
        justify-content: center;
        gap: 12px;
        padding: 12px 16px;
        border-top: 1px solid rgba(100, 150, 255, 0.2);
      }

      .sq-dialog-buttons .sq-button {
        min-width: 80px;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 500;
        border-radius: 6px;
        transition: all 0.15s;
      }

      .sq-panel-footer {
        padding: 10px 16px;
        background: rgba(0, 0, 0, 0.2);
        border-top: 1px solid #4a6aaa;
      }

      .sq-controls-hint {
        font-size: 11px;
        color: #888;
        text-align: center;
      }

      .sq-controls-hint kbd {
        display: inline-block;
        padding: 2px 6px;
        background: #2a2a4e;
        border: 1px solid #4a6aaa;
        border-radius: 4px;
        font-family: inherit;
        font-size: 10px;
        color: #b4b4b4;
      }
    `;
    document.head.appendChild(styles);
  }

  /**
   * Render the list items
   */
  private renderList(): void {
    if (!this.listContainer) return;

    if (this.items.length === 0) {
      this.listContainer.innerHTML = '';
      return;
    }

    this.listContainer.innerHTML = this.items.map((item, index) => `
      <div 
        class="sq-dialog-item ${index === this.selectedIndex ? 'selected' : ''} ${item.disabled ? 'disabled' : ''}"
        data-index="${index}"
        data-id="${item.id}"
      >
        <span class="sq-dialog-item-label">${item.label}</span>
        ${item.sublabel ? `<span class="sq-dialog-item-sublabel">${item.sublabel}</span>` : ''}
      </div>
    `).join('');

    // Scroll selected item into view
    const selectedEl = this.listContainer.querySelector('.selected');
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }

  /**
   * Handle click events
   */
  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    // Close button or backdrop
    if (target.dataset.action === 'close') {
      if (target.classList.contains('sq-backdrop') && !this.options.closeOnBackdrop) {
        return;
      }
      this.close();
      return;
    }

    // Button click
    const buttonId = target.dataset.button;
    if (buttonId) {
      this.options.onButtonClick?.(buttonId);
      return;
    }

    // Item click
    const itemEl = target.closest('.sq-dialog-item') as HTMLElement;
    if (itemEl && !itemEl.classList.contains('disabled')) {
      const index = parseInt(itemEl.dataset.index || '0');
      this.selectItem(index);
      this.confirmSelection();
    }
  }

  /**
   * Setup keyboard handlers
   */
  private setupKeyboardHandlers(): void {
    this.keyHandler = (e: KeyboardEvent) => {
      if (!this._isOpen) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          this.selectPrevious();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          this.selectNext();
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          this.confirmSelection();
          break;
        case 'Escape':
          e.preventDefault();
          this.close();
          break;
      }
    };

    window.addEventListener('keydown', this.keyHandler);
  }

  /**
   * Remove keyboard handlers
   */
  private removeKeyboardHandlers(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  /**
   * Select previous item (skip disabled)
   */
  private selectPrevious(): void {
    let newIndex = this.selectedIndex - 1;
    while (newIndex >= 0) {
      if (!this.items[newIndex].disabled) {
        this.selectItem(newIndex);
        return;
      }
      newIndex--;
    }
  }

  /**
   * Select next item (skip disabled)
   */
  private selectNext(): void {
    let newIndex = this.selectedIndex + 1;
    while (newIndex < this.items.length) {
      if (!this.items[newIndex].disabled) {
        this.selectItem(newIndex);
        return;
      }
      newIndex++;
    }
  }

  /**
   * Select an item by index
   */
  private selectItem(index: number): void {
    if (index < 0 || index >= this.items.length) return;
    this.selectedIndex = index;
    this.renderList();
  }

  /**
   * Confirm selection
   */
  private confirmSelection(): void {
    if (this.items.length === 0) return;
    const item = this.items[this.selectedIndex];
    if (item && !item.disabled) {
      this.options.onItemSelect?.(item, this.selectedIndex);
    }
  }

  /**
   * Open the dialog
   */
  open(items?: DialogItem[]): void {
    if (this._isOpen) return;

    if (items) {
      this.items = items;
    }

    // Find first non-disabled item
    this.selectedIndex = 0;
    for (let i = 0; i < this.items.length; i++) {
      if (!this.items[i].disabled) {
        this.selectedIndex = i;
        break;
      }
    }

    this.renderList();
    this.container.style.display = 'block';
    this._isOpen = true;
    this.setupKeyboardHandlers();
  }

  /**
   * Close the dialog
   */
  close(): void {
    if (!this._isOpen) return;

    this.container.style.display = 'none';
    this._isOpen = false;
    this.removeKeyboardHandlers();
    this.options.onClose?.();
  }

  /**
   * Update dialog title
   */
  setTitle(title: string): void {
    const titleEl = this.container.querySelector('.sq-panel-title');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  /**
   * Update content text
   */
  setContent(content: string): void {
    if (this.contentContainer) {
      this.contentContainer.innerHTML = content;
    }
  }

  /**
   * Update items and re-render
   */
  setItems(items: DialogItem[]): void {
    this.items = items;
    this.selectedIndex = 0;
    for (let i = 0; i < this.items.length; i++) {
      if (!this.items[i].disabled) {
        this.selectedIndex = i;
        break;
      }
    }
    this.renderList();
  }

  /**
   * Get currently selected item
   */
  getSelectedItem(): DialogItem | null {
    if (this.items.length === 0) return null;
    return this.items[this.selectedIndex] || null;
  }

  /**
   * Destroy the overlay and clean up
   */
  destroy(): void {
    this.removeKeyboardHandlers();
    this.container.remove();
  }
}
