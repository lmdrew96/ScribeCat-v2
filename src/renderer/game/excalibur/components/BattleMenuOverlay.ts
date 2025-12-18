/**
 * BattleMenuOverlay - HTML-based battle action menu
 *
 * Provides a styled action menu and item selection for battle scene.
 * Replaces canvas-based menu for better responsiveness and styling.
 */

import { injectOverlayStyles } from '../../css/index.js';
import { getItem, type ItemDefinition } from '../../data/items.js';

export interface BattleItem {
  id: string;
  name: string;
  quantity: number;
  description?: string;
}

export interface BattleMenuCallbacks {
  onSelectAction: (action: string) => void;
  onUseItem: (itemId: string) => void;
  onCloseItemMenu: () => void;
  getConsumableItems: () => BattleItem[];
  getPlayerMana: () => number;
  getManaPerMagic: () => number;
}

const ACTIONS = [
  { id: 'Attack', icon: '⚔️', hint: 'Deal physical damage' },
  { id: 'Magic', icon: '✨', hint: 'Spend MP for powerful attack' },
  { id: 'Defend', icon: '🛡️', hint: 'Reduce incoming damage' },
  { id: 'Item', icon: '🎒', hint: 'Use consumable items' },
  { id: 'Run', icon: '💨', hint: 'Attempt to flee battle' },
];

/**
 * BattleMenuOverlay - Action menu and item selection for battle scene
 */
export class BattleMenuOverlay {
  private container: HTMLDivElement;
  private callbacks: BattleMenuCallbacks;
  private _isVisible = false;
  private _itemMenuVisible = false;
  private selectedActionIndex = 0;
  private selectedItemIndex = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(parentElement: HTMLElement, callbacks: BattleMenuCallbacks) {
    this.callbacks = callbacks;

    injectOverlayStyles();

    this.container = document.createElement('div');
    this.container.className = 'sq-battle-menu-overlay';
    this.container.style.cssText = `
      display: none;
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      z-index: 150;
      pointer-events: auto;
    `;

    this.buildDOM();
    this.addStyles();
    parentElement.appendChild(this.container);
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  get itemMenuVisible(): boolean {
    return this._itemMenuVisible;
  }

  private buildDOM(): void {
    this.container.innerHTML = `
      <div class="sq-battle-menu">
        <div class="sq-battle-actions"></div>
        <div class="sq-battle-hint"></div>
      </div>
      <div class="sq-battle-items" style="display: none;">
        <div class="sq-battle-items-header">
          <span>📦 Items</span>
          <span class="sq-battle-items-close">✕</span>
        </div>
        <div class="sq-battle-items-list"></div>
        <div class="sq-battle-items-hint">
          <kbd>↑↓</kbd> Select &nbsp; <kbd>Enter</kbd> Use &nbsp; <kbd>Esc</kbd> Back
        </div>
      </div>
    `;

    this.container.addEventListener('click', (e) => this.handleClick(e));
  }

  private addStyles(): void {
    if (document.getElementById('sq-battle-menu-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'sq-battle-menu-styles';
    styles.textContent = `
      .sq-battle-menu-overlay {
        font-family: 'Segoe UI', system-ui, sans-serif;
      }

      .sq-battle-menu {
        background: linear-gradient(180deg, rgba(30, 30, 50, 0.95) 0%, rgba(20, 20, 40, 0.98) 100%);
        border-top: 3px solid #6496FF;
        padding: 12px 20px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .sq-battle-actions {
        display: flex;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .sq-battle-action {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 16px;
        min-width: 65px;
        background: rgba(40, 40, 60, 0.8);
        border: 2px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
        color: #ccc;
      }

      .sq-battle-action:hover:not(.disabled) {
        background: rgba(100, 150, 255, 0.2);
        color: #fff;
      }

      .sq-battle-action.selected {
        background: linear-gradient(180deg, rgba(100, 150, 255, 0.3) 0%, rgba(80, 120, 220, 0.2) 100%);
        border-color: #6496FF;
        color: #FFD700;
        box-shadow: 0 0 12px rgba(100, 150, 255, 0.3);
      }

      .sq-battle-action.disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .sq-battle-action-icon {
        font-size: 20px;
        line-height: 1;
        margin-bottom: 4px;
      }

      .sq-battle-action-label {
        font-size: 11px;
        font-weight: 500;
      }

      .sq-battle-hint {
        text-align: center;
        font-size: 11px;
        color: #888;
        min-height: 14px;
      }

      /* Item Menu */
      .sq-battle-items {
        position: absolute;
        left: 50%;
        bottom: 100px;
        transform: translateX(-50%);
        width: 280px;
        max-height: 220px;
        background: linear-gradient(180deg, #2a2436 0%, #1e1828 100%);
        border: 3px solid #6496FF;
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .sq-battle-items-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid #6496FF;
        color: #6496FF;
        font-weight: 600;
        font-size: 14px;
      }

      .sq-battle-items-close {
        cursor: pointer;
        opacity: 0.6;
        font-size: 16px;
      }

      .sq-battle-items-close:hover {
        opacity: 1;
      }

      .sq-battle-items-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
        min-height: 0;
      }

      .sq-battle-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        background: rgba(40, 36, 54, 0.6);
        border: 2px solid transparent;
        border-radius: 6px;
        margin-bottom: 6px;
        cursor: pointer;
        transition: all 0.12s ease;
      }

      .sq-battle-item:last-child {
        margin-bottom: 0;
      }

      .sq-battle-item:hover {
        background: rgba(100, 150, 255, 0.15);
      }

      .sq-battle-item.selected {
        background: rgba(100, 150, 255, 0.25);
        border-color: #6496FF;
      }

      .sq-battle-item-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .sq-battle-item-name {
        font-size: 13px;
        color: #fff;
        font-weight: 500;
      }

      .sq-battle-item.selected .sq-battle-item-name::before {
        content: '▸ ';
        color: #FFD700;
      }

      .sq-battle-item-desc {
        font-size: 10px;
        color: #888;
      }

      .sq-battle-item-qty {
        font-size: 12px;
        color: #8f8;
        font-weight: 500;
      }

      .sq-battle-items-empty {
        text-align: center;
        color: #666;
        padding: 20px;
        font-size: 13px;
      }

      .sq-battle-items-hint {
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.2);
        border-top: 1px solid rgba(100, 150, 255, 0.3);
        font-size: 10px;
        color: #666;
        text-align: center;
      }

      .sq-battle-items-hint kbd {
        display: inline-block;
        padding: 2px 5px;
        background: #2a2436;
        border: 1px solid #6496FF;
        border-radius: 3px;
        font-family: inherit;
        font-size: 9px;
        color: #aaa;
      }

      .sq-battle-items-list::-webkit-scrollbar {
        width: 5px;
      }

      .sq-battle-items-list::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
      }

      .sq-battle-items-list::-webkit-scrollbar-thumb {
        background: #6496FF;
        border-radius: 3px;
      }
    `;
    document.head.appendChild(styles);
  }

  show(): void {
    this._isVisible = true;
    this._itemMenuVisible = false;
    this.selectedActionIndex = 0;
    this.container.style.display = 'block';
    this.renderActions();
    this.hideItemMenu();
    this.setupKeyboardHandlers();
  }

  hide(): void {
    this._isVisible = false;
    this._itemMenuVisible = false;
    this.container.style.display = 'none';
    this.removeKeyboardHandlers();
  }

  private renderActions(): void {
    const actionsContainer = this.container.querySelector('.sq-battle-actions');
    const hintContainer = this.container.querySelector('.sq-battle-hint');
    if (!actionsContainer || !hintContainer) return;

    const playerMana = this.callbacks.getPlayerMana();
    const manaPerMagic = this.callbacks.getManaPerMagic();

    actionsContainer.innerHTML = ACTIONS.map((action, index) => {
      const isSelected = index === this.selectedActionIndex;
      const isDisabled = action.id === 'Magic' && playerMana < manaPerMagic;
      return `
        <div 
          class="sq-battle-action ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}"
          data-index="${index}"
          data-action="${action.id}"
        >
          <span class="sq-battle-action-icon">${action.icon}</span>
          <span class="sq-battle-action-label">${action.id}</span>
        </div>
      `;
    }).join('');

    // Show hint for selected action
    const selectedAction = ACTIONS[this.selectedActionIndex];
    let hint = selectedAction.hint;
    if (selectedAction.id === 'Magic') {
      hint += ` (${manaPerMagic} MP)`;
      if (playerMana < manaPerMagic) {
        hint = `Not enough MP! (Need ${manaPerMagic})`;
      }
    }
    hintContainer.textContent = hint;
  }

  showItemMenu(): void {
    this._itemMenuVisible = true;
    this.selectedItemIndex = 0;
    const itemsPanel = this.container.querySelector('.sq-battle-items') as HTMLElement;
    if (itemsPanel) {
      itemsPanel.style.display = 'flex';
    }
    this.renderItems();
  }

  hideItemMenu(): void {
    this._itemMenuVisible = false;
    const itemsPanel = this.container.querySelector('.sq-battle-items') as HTMLElement;
    if (itemsPanel) {
      itemsPanel.style.display = 'none';
    }
  }

  private renderItems(): void {
    const listContainer = this.container.querySelector('.sq-battle-items-list');
    if (!listContainer) return;

    const items = this.callbacks.getConsumableItems();

    if (items.length === 0) {
      listContainer.innerHTML = '<div class="sq-battle-items-empty">No usable items!</div>';
      return;
    }

    listContainer.innerHTML = items.map((item, index) => {
      const isSelected = index === this.selectedItemIndex;
      return `
        <div 
          class="sq-battle-item ${isSelected ? 'selected' : ''}"
          data-index="${index}"
          data-item-id="${item.id}"
        >
          <div class="sq-battle-item-info">
            <div class="sq-battle-item-name">${item.name}</div>
            <div class="sq-battle-item-desc">${item.description || ''}</div>
          </div>
          <div class="sq-battle-item-qty">×${item.quantity}</div>
        </div>
      `;
    }).join('');

    // Scroll selected into view
    const selectedEl = listContainer.querySelector('.selected');
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    // Close item menu
    if (target.classList.contains('sq-battle-items-close')) {
      this.hideItemMenu();
      this.callbacks.onCloseItemMenu();
      return;
    }

    // Action click
    const actionEl = target.closest('.sq-battle-action') as HTMLElement;
    if (actionEl && !actionEl.classList.contains('disabled')) {
      const action = actionEl.dataset.action;
      if (action) {
        if (action === 'Item') {
          this.showItemMenu();
        } else {
          this.callbacks.onSelectAction(action);
        }
      }
      return;
    }

    // Item click
    const itemEl = target.closest('.sq-battle-item') as HTMLElement;
    if (itemEl) {
      const itemId = itemEl.dataset.itemId;
      if (itemId) {
        this.hideItemMenu();
        this.callbacks.onUseItem(itemId);
      }
      return;
    }
  }

  private setupKeyboardHandlers(): void {
    this.removeKeyboardHandlers();

    this.keyHandler = (e: KeyboardEvent) => {
      if (!this._isVisible) return;

      if (this._itemMenuVisible) {
        this.handleItemMenuKeyboard(e);
      } else {
        this.handleActionMenuKeyboard(e);
      }
    };

    window.addEventListener('keydown', this.keyHandler);
  }

  private handleActionMenuKeyboard(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();

    if (key === 'arrowleft' || key === 'a') {
      e.preventDefault();
      if (this.selectedActionIndex > 0) {
        this.selectedActionIndex--;
        this.renderActions();
      }
    } else if (key === 'arrowright' || key === 'd') {
      e.preventDefault();
      if (this.selectedActionIndex < ACTIONS.length - 1) {
        this.selectedActionIndex++;
        this.renderActions();
      }
    } else if (key === 'enter' || key === ' ') {
      e.preventDefault();
      const action = ACTIONS[this.selectedActionIndex];
      
      // Check if magic is disabled
      if (action.id === 'Magic') {
        const playerMana = this.callbacks.getPlayerMana();
        const manaPerMagic = this.callbacks.getManaPerMagic();
        if (playerMana < manaPerMagic) return;
      }
      
      if (action.id === 'Item') {
        this.showItemMenu();
      } else {
        this.callbacks.onSelectAction(action.id);
      }
    }
  }

  private handleItemMenuKeyboard(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    const items = this.callbacks.getConsumableItems();

    if (key === 'arrowup' || key === 'w') {
      e.preventDefault();
      if (this.selectedItemIndex > 0) {
        this.selectedItemIndex--;
        this.renderItems();
      }
    } else if (key === 'arrowdown' || key === 's') {
      e.preventDefault();
      if (this.selectedItemIndex < items.length - 1) {
        this.selectedItemIndex++;
        this.renderItems();
      }
    } else if (key === 'enter' || key === ' ') {
      e.preventDefault();
      if (items.length > 0 && this.selectedItemIndex < items.length) {
        const item = items[this.selectedItemIndex];
        this.hideItemMenu();
        this.callbacks.onUseItem(item.id);
      }
    } else if (key === 'escape') {
      e.preventDefault();
      this.hideItemMenu();
      this.callbacks.onCloseItemMenu();
    }
  }

  private removeKeyboardHandlers(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  destroy(): void {
    this.removeKeyboardHandlers();
    this.container.remove();
  }
}
