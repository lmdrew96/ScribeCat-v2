/**
 * InventoryOverlay - HTML-based inventory UI overlay component
 *
 * Provides a hybrid Canvas/HTML implementation for the inventory interface.
 * Uses HTML/CSS for complex UI elements (tabs, scrollable lists, item details)
 * while the game scene handles the background.
 *
 * Benefits over pure Canvas:
 * - Native scrolling for item lists
 * - CSS hover states and transitions
 * - Easier text wrapping and formatting
 * - Better accessibility
 */

import { GameState } from '../../state/GameState.js';
import {
  getItem,
  type ItemDefinition,
  type EquipmentSlot,
} from '../../data/items.js';
import { injectOverlayStyles } from '../../css/index.js';

/**
 * Inventory tab configuration
 */
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'items', label: 'Items' },
  { id: 'equip', label: 'Equipment' },
  { id: 'special', label: 'Special' },
  { id: 'decor', label: 'Decor' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Inventory overlay events
 */
export interface InventoryOverlayCallbacks {
  /** Called when overlay is closed */
  onClose: () => void;
  /** Called when an item is used */
  onUseItem?: (itemId: string) => void;
  /** Called when an item is equipped */
  onEquip?: (itemId: string, slot: EquipmentSlot) => void;
  /** Called when an item is unequipped */
  onUnequip?: (slot: EquipmentSlot) => void;
}

/**
 * InventoryOverlay manages the HTML-based inventory UI
 */
export class InventoryOverlay {
  private container: HTMLDivElement;
  private callbacks: InventoryOverlayCallbacks;

  // State
  private _isOpen = false;
  private selectedTab: TabId = 'all';
  private selectedIndex = 0;
  private isProcessing = false;

  // DOM references
  private tabsContainer: HTMLDivElement | null = null;
  private listContainer: HTMLDivElement | null = null;
  private detailsContainer: HTMLDivElement | null = null;
  private goldDisplay: HTMLSpanElement | null = null;
  private messageContainer: HTMLDivElement | null = null;

  // Keyboard navigation
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(parentElement: HTMLElement, callbacks: InventoryOverlayCallbacks) {
    this.callbacks = callbacks;

    // Ensure overlay styles are injected
    injectOverlayStyles();

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'sq-inventory-overlay';
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
    this.container.innerHTML = `
      <div class="sq-backdrop" data-action="close"></div>
      <div class="sq-panel sq-inventory-panel">
        <div class="sq-panel-header">
          <h3 class="sq-panel-title">📦 Inventory</h3>
          <div class="sq-gold-display">
            <span class="sq-gold-icon">💰</span>
            <span class="sq-gold-value">0</span>G
          </div>
          <button class="sq-panel-close" data-action="close">&times;</button>
        </div>
        <div class="sq-tabs sq-inventory-tabs"></div>
        <div class="sq-panel-body sq-inventory-body">
          <div class="sq-inventory-list-container">
            <div class="sq-list sq-inventory-list"></div>
          </div>
          <div class="sq-inventory-details"></div>
        </div>
        <div class="sq-panel-footer">
          <div class="sq-controls-hint">
            <kbd>↑↓</kbd> Navigate &nbsp;
            <kbd>←→</kbd> Tabs &nbsp;
            <kbd>U</kbd> Use &nbsp;
            <kbd>E</kbd> Equip &nbsp;
            <kbd>Esc</kbd> Close
          </div>
        </div>
        <div class="sq-inventory-message"></div>
      </div>
    `;

    // Cache DOM references
    this.tabsContainer = this.container.querySelector('.sq-inventory-tabs');
    this.listContainer = this.container.querySelector('.sq-inventory-list');
    this.detailsContainer = this.container.querySelector('.sq-inventory-details');
    this.goldDisplay = this.container.querySelector('.sq-gold-value');
    this.messageContainer = this.container.querySelector('.sq-inventory-message');

    // Setup click handlers
    this.container.addEventListener('click', (e) => this.handleClick(e));
  }

  /**
   * Add component-specific styles
   */
  private addStyles(): void {
    if (document.getElementById('sq-inventory-overlay-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'sq-inventory-overlay-styles';
    styles.textContent = `
      .sq-inventory-overlay {
        font-family: 'Segoe UI', system-ui, sans-serif;
      }

      .sq-inventory-overlay .sq-backdrop {
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

      .sq-inventory-panel {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 420px;
        max-height: 340px;
        display: flex;
        flex-direction: column;
        background: linear-gradient(180deg, #2a2a4e 0%, #1e1e32 100%);
        border: 3px solid #6496ff;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        padding: 0;
        overflow: hidden;
      }

      .sq-inventory-panel .sq-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: linear-gradient(180deg, #3a3a6e 0%, #2a2a4e 100%);
        border-bottom: 2px solid #4a6aaa;
      }

      .sq-inventory-panel .sq-panel-title {
        margin: 0;
        font-size: 16px;
        color: #fff;
        font-weight: 600;
      }

      .sq-inventory-panel .sq-gold-display {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 14px;
        color: #ffd700;
        font-weight: 600;
      }

      .sq-inventory-panel .sq-panel-close {
        background: none;
        border: none;
        color: #888;
        font-size: 24px;
        cursor: pointer;
        line-height: 1;
        padding: 0 4px;
        transition: color 0.15s;
      }

      .sq-inventory-panel .sq-panel-close:hover {
        color: #fff;
      }

      .sq-inventory-tabs {
        display: flex;
        gap: 2px;
        padding: 8px 12px 0;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid #3a4a6a;
      }

      .sq-inventory-tabs .sq-tab {
        padding: 8px 12px;
        font-size: 11px;
        color: #999;
        background: transparent;
        border: none;
        border-radius: 6px 6px 0 0;
        cursor: pointer;
        transition: all 0.15s;
      }

      .sq-inventory-tabs .sq-tab:hover {
        color: #ccc;
        background: rgba(100, 150, 255, 0.1);
      }

      .sq-inventory-tabs .sq-tab.active {
        color: #6496ff;
        background: rgba(100, 150, 255, 0.2);
        border-bottom: 2px solid #6496ff;
      }

      .sq-inventory-body {
        display: flex;
        flex: 1;
        min-height: 0;
        padding: 12px;
        gap: 12px;
      }

      .sq-inventory-list-container {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .sq-inventory-list {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .sq-inventory-list::-webkit-scrollbar {
        width: 6px;
      }

      .sq-inventory-list::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 3px;
      }

      .sq-inventory-list::-webkit-scrollbar-thumb {
        background: #6496ff;
        border-radius: 3px;
      }

      .sq-inventory-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        background: rgba(40, 40, 70, 0.6);
        border: 2px solid transparent;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.12s;
      }

      .sq-inventory-item:hover {
        background: rgba(100, 150, 255, 0.15);
        border-color: rgba(100, 150, 255, 0.3);
      }

      .sq-inventory-item.selected {
        background: rgba(100, 150, 255, 0.25);
        border-color: #6496ff;
      }

      .sq-inventory-item-icon {
        width: 28px;
        height: 28px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        flex-shrink: 0;
      }

      .sq-inventory-item-info {
        flex: 1;
        min-width: 0;
      }

      .sq-inventory-item-name {
        font-size: 12px;
        color: #fff;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .sq-inventory-item-type {
        font-size: 10px;
        color: #888;
        text-transform: uppercase;
      }

      .sq-inventory-item-qty {
        font-size: 12px;
        color: #8f8;
        font-weight: 500;
      }

      .sq-inventory-item-equipped {
        font-size: 10px;
        color: #6496ff;
        font-weight: 600;
      }

      .sq-inventory-details {
        width: 160px;
        flex-shrink: 0;
        padding: 10px;
        background: rgba(20, 20, 40, 0.6);
        border: 1px solid #3a4a6a;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .sq-inventory-details-name {
        font-size: 13px;
        color: #fff;
        font-weight: 600;
        text-align: center;
        border-bottom: 1px solid #3a4a6a;
        padding-bottom: 6px;
      }

      .sq-inventory-details-type {
        font-size: 10px;
        color: #6496ff;
        text-align: center;
        text-transform: uppercase;
      }

      .sq-inventory-details-desc {
        font-size: 11px;
        color: #aaa;
        line-height: 1.4;
      }

      .sq-inventory-details-stats {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .sq-inventory-details-stat {
        font-size: 11px;
        color: #8f8;
      }

      .sq-inventory-details-effect {
        font-size: 11px;
        color: #88ccff;
      }

      .sq-inventory-details-actions {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: auto;
      }

      .sq-inventory-action-btn {
        padding: 6px 10px;
        font-size: 11px;
        background: linear-gradient(180deg, #3a5a8a 0%, #2a4a6a 100%);
        border: 1px solid #4a6aaa;
        border-radius: 4px;
        color: #fff;
        cursor: pointer;
        transition: all 0.15s;
      }

      .sq-inventory-action-btn:hover:not(:disabled) {
        background: linear-gradient(180deg, #4a6a9a 0%, #3a5a7a 100%);
        border-color: #6496ff;
      }

      .sq-inventory-action-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .sq-inventory-empty {
        text-align: center;
        color: #666;
        padding: 30px 20px;
        font-size: 13px;
      }

      .sq-panel-footer {
        padding: 8px 16px;
        background: rgba(0, 0, 0, 0.2);
        border-top: 1px solid #3a4a6a;
      }

      .sq-controls-hint {
        font-size: 10px;
        color: #666;
        text-align: center;
      }

      .sq-controls-hint kbd {
        display: inline-block;
        padding: 2px 5px;
        background: #2a2a4e;
        border: 1px solid #4a6aaa;
        border-radius: 3px;
        font-family: inherit;
        font-size: 9px;
        color: #aaa;
      }

      .sq-inventory-message {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 12px 24px;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid #6496ff;
        border-radius: 8px;
        color: #fff;
        font-size: 13px;
        font-weight: 500;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
        z-index: 10;
      }

      .sq-inventory-message.visible {
        opacity: 1;
      }
    `;
    document.head.appendChild(styles);
  }

  /**
   * Open the inventory overlay
   */
  open(): void {
    this._isOpen = true;
    this.selectedIndex = 0;
    this.container.style.display = 'block';
    this.updateGoldDisplay();
    this.renderTabs();
    this.renderList();
    this.renderDetails();
    this.setupKeyboardHandlers();
  }

  /**
   * Close the inventory overlay
   */
  close(): void {
    this._isOpen = false;
    this.container.style.display = 'none';
    this.removeKeyboardHandlers();
    this.callbacks.onClose();
  }

  /**
   * Update gold display
   */
  private updateGoldDisplay(): void {
    if (this.goldDisplay) {
      this.goldDisplay.textContent = GameState.player.gold.toString();
    }
  }

  /**
   * Render tabs
   */
  private renderTabs(): void {
    if (!this.tabsContainer) return;

    this.tabsContainer.innerHTML = TABS.map(tab => `
      <button 
        class="sq-tab ${tab.id === this.selectedTab ? 'active' : ''}"
        data-tab="${tab.id}"
      >${tab.label}</button>
    `).join('');
  }

  /**
   * Get filtered inventory items based on current tab
   */
  private getFilteredItems(): { id: string; quantity: number; item: ItemDefinition }[] {
    const allItems = GameState.player.items
      .map(inv => ({ ...inv, item: getItem(inv.id) }))
      .filter((inv): inv is { id: string; quantity: number; item: ItemDefinition } => inv.item !== undefined);

    switch (this.selectedTab) {
      case 'all':
        return allItems;
      case 'items':
        return allItems.filter(inv => inv.item.type === 'consumable');
      case 'equip':
        return allItems.filter(inv => inv.item.type === 'equipment');
      case 'special':
        return allItems.filter(inv => inv.item.type === 'special' || inv.item.type === 'key');
      case 'decor':
        return allItems.filter(inv => inv.item.type === 'decoration');
      default:
        return allItems;
    }
  }

  /**
   * Render inventory list
   */
  private renderList(): void {
    if (!this.listContainer) return;

    const items = this.getFilteredItems();

    if (items.length === 0) {
      this.listContainer.innerHTML = '<div class="sq-inventory-empty">No items in this category</div>';
      return;
    }

    // Clamp selected index
    if (this.selectedIndex >= items.length) {
      this.selectedIndex = Math.max(0, items.length - 1);
    }

    this.listContainer.innerHTML = items.map((inv, index) => {
      const isSelected = index === this.selectedIndex;
      const isEquipped = inv.item.type === 'equipment' && inv.item.slot && 
        GameState.player.equipped[inv.item.slot] === inv.id;
      
      const iconColor = inv.item.iconColor || [100, 100, 100];
      const bgColor = `rgb(${iconColor[0]}, ${iconColor[1]}, ${iconColor[2]})`;
      
      // Get an emoji icon based on item type
      const getTypeIcon = (type: string): string => {
        switch (type) {
          case 'consumable': return '🧪';
          case 'equipment': return '⚔️';
          case 'special': return '✨';
          case 'key': return '🔑';
          case 'decoration': return '🏠';
          default: return '📦';
        }
      };

      return `
        <div 
          class="sq-inventory-item ${isSelected ? 'selected' : ''}"
          data-index="${index}"
          data-item-id="${inv.id}"
        >
          <div class="sq-inventory-item-icon" style="background: ${bgColor}">
            ${getTypeIcon(inv.item.type)}
          </div>
          <div class="sq-inventory-item-info">
            <div class="sq-inventory-item-name">${inv.item.name}</div>
            <div class="sq-inventory-item-type">${inv.item.type}</div>
          </div>
          <div class="sq-inventory-item-qty">×${inv.quantity}</div>
          ${isEquipped ? '<div class="sq-inventory-item-equipped">EQUIPPED</div>' : ''}
        </div>
      `;
    }).join('');

    // Scroll selected into view
    const selectedEl = this.listContainer.querySelector('.selected');
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }

  /**
   * Render details panel for selected item
   */
  private renderDetails(): void {
    if (!this.detailsContainer) return;

    const items = this.getFilteredItems();
    if (items.length === 0 || this.selectedIndex >= items.length) {
      this.detailsContainer.innerHTML = '<div class="sq-inventory-empty">Select an item</div>';
      return;
    }

    const inv = items[this.selectedIndex];
    const item = inv.item;
    const isEquipped = item.type === 'equipment' && item.slot && 
      GameState.player.equipped[item.slot] === inv.id;

    // Build stats string
    const stats: string[] = [];
    if (item.stats?.attack) stats.push(`+${item.stats.attack} ATK`);
    if (item.stats?.defense) stats.push(`+${item.stats.defense} DEF`);
    if (item.stats?.luck) stats.push(`+${item.stats.luck} LCK`);
    if (item.stats?.maxHealth) stats.push(`+${item.stats.maxHealth} HP`);
    if (item.stats?.maxMana) stats.push(`+${item.stats.maxMana} MP`);

    // Build effect string
    let effectStr = '';
    if (item.effect?.type === 'heal') effectStr = `Heals ${item.effect.value} HP`;
    else if (item.effect?.type === 'mana_restore') effectStr = `Restores ${item.effect.value} MP`;

    // Build actions
    const canUse = item.type === 'consumable' && item.effect;
    const canEquip = item.type === 'equipment' && item.slot;

    this.detailsContainer.innerHTML = `
      <div class="sq-inventory-details-name">${item.name}</div>
      <div class="sq-inventory-details-type">${item.type}</div>
      <div class="sq-inventory-details-desc">${item.description}</div>
      ${stats.length > 0 ? `
        <div class="sq-inventory-details-stats">
          ${stats.map(s => `<div class="sq-inventory-details-stat">${s}</div>`).join('')}
        </div>
      ` : ''}
      ${effectStr ? `<div class="sq-inventory-details-effect">${effectStr}</div>` : ''}
      <div class="sq-inventory-details-actions">
        ${canUse ? `
          <button class="sq-inventory-action-btn" data-action="use" data-item-id="${inv.id}">
            Use [U]
          </button>
        ` : ''}
        ${canEquip ? `
          <button class="sq-inventory-action-btn" data-action="${isEquipped ? 'unequip' : 'equip'}" data-item-id="${inv.id}">
            ${isEquipped ? 'Unequip [E]' : 'Equip [E]'}
          </button>
        ` : ''}
      </div>
    `;
  }

  /**
   * Handle click events
   */
  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    // Close button or backdrop
    if (target.dataset.action === 'close' || target.classList.contains('sq-backdrop')) {
      this.close();
      return;
    }

    // Tab click
    const tab = target.closest('[data-tab]') as HTMLElement;
    if (tab) {
      this.selectedTab = tab.dataset.tab as TabId;
      this.selectedIndex = 0;
      this.renderTabs();
      this.renderList();
      this.renderDetails();
      return;
    }

    // Item click
    const itemEl = target.closest('[data-item-id]') as HTMLElement;
    if (itemEl && !itemEl.dataset.action) {
      const index = parseInt(itemEl.dataset.index || '0', 10);
      this.selectedIndex = index;
      this.renderList();
      this.renderDetails();
      return;
    }

    // Action button click
    const actionBtn = target.closest('[data-action]') as HTMLElement;
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      const itemId = actionBtn.dataset.itemId;
      if (action === 'use' && itemId) {
        this.useItem(itemId);
      } else if (action === 'equip' && itemId) {
        this.equipItem(itemId);
      } else if (action === 'unequip' && itemId) {
        this.unequipItem(itemId);
      }
    }
  }

  /**
   * Setup keyboard handlers
   */
  private setupKeyboardHandlers(): void {
    this.removeKeyboardHandlers();

    this.keyHandler = (e: KeyboardEvent) => {
      if (!this._isOpen) return;

      const key = e.key.toLowerCase();
      const items = this.getFilteredItems();

      if (key === 'escape') {
        e.preventDefault();
        this.close();
      } else if (key === 'arrowup' || key === 'w') {
        e.preventDefault();
        if (this.selectedIndex > 0) {
          this.selectedIndex--;
          this.renderList();
          this.renderDetails();
        }
      } else if (key === 'arrowdown' || key === 's') {
        e.preventDefault();
        if (this.selectedIndex < items.length - 1) {
          this.selectedIndex++;
          this.renderList();
          this.renderDetails();
        }
      } else if (key === 'arrowleft' || key === 'q') {
        e.preventDefault();
        const currentTabIndex = TABS.findIndex(t => t.id === this.selectedTab);
        if (currentTabIndex > 0) {
          this.selectedTab = TABS[currentTabIndex - 1].id;
          this.selectedIndex = 0;
          this.renderTabs();
          this.renderList();
          this.renderDetails();
        }
      } else if (key === 'arrowright' || key === 'e') {
        e.preventDefault();
        // Don't move right on 'e' key since it's used for equip
        if (key === 'arrowright') {
          const currentTabIndex = TABS.findIndex(t => t.id === this.selectedTab);
          if (currentTabIndex < TABS.length - 1) {
            this.selectedTab = TABS[currentTabIndex + 1].id;
            this.selectedIndex = 0;
            this.renderTabs();
            this.renderList();
            this.renderDetails();
          }
        } else {
          // E key - equip/unequip
          if (items.length > 0 && this.selectedIndex < items.length) {
            const inv = items[this.selectedIndex];
            if (inv.item.type === 'equipment' && inv.item.slot) {
              const isEquipped = GameState.player.equipped[inv.item.slot] === inv.id;
              if (isEquipped) {
                this.unequipItem(inv.id);
              } else {
                this.equipItem(inv.id);
              }
            }
          }
        }
      } else if (key === 'u') {
        e.preventDefault();
        if (items.length > 0 && this.selectedIndex < items.length) {
          const inv = items[this.selectedIndex];
          if (inv.item.type === 'consumable') {
            this.useItem(inv.id);
          }
        }
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
   * Use a consumable item
   */
  private useItem(itemId: string): void {
    if (this.isProcessing) return;

    const item = getItem(itemId);
    if (!item || item.type !== 'consumable') {
      this.showMessage('Cannot use this item!', 'error');
      return;
    }

    if (item.effect?.type === 'heal') {
      if (GameState.player.health >= GameState.getEffectiveMaxHealth()) {
        this.showMessage('HP already full!', 'warning');
        return;
      }

      this.isProcessing = true;
      GameState.removeItem(itemId, 1);
      const oldHp = GameState.player.health;
      GameState.player.health = Math.min(
        GameState.player.health + item.effect.value,
        GameState.getEffectiveMaxHealth()
      );
      const actualHeal = GameState.player.health - oldHp;
      this.showMessage(`Healed ${actualHeal} HP!`, 'success');
      this.callbacks.onUseItem?.(itemId);

      setTimeout(() => {
        this.isProcessing = false;
        this.renderList();
        this.renderDetails();
      }, 100);
      return;
    }

    if (item.effect?.type === 'mana_restore') {
      if (GameState.player.mana >= GameState.getEffectiveMaxMana()) {
        this.showMessage('MP already full!', 'warning');
        return;
      }

      this.isProcessing = true;
      GameState.removeItem(itemId, 1);
      const actualRestore = GameState.restoreMana(item.effect.value);
      this.showMessage(`Restored ${actualRestore} MP!`, 'success');
      this.callbacks.onUseItem?.(itemId);

      setTimeout(() => {
        this.isProcessing = false;
        this.renderList();
        this.renderDetails();
      }, 100);
      return;
    }

    this.showMessage('Cannot use this item here!', 'error');
  }

  /**
   * Equip an item
   */
  private equipItem(itemId: string): void {
    if (this.isProcessing) return;

    const item = getItem(itemId);
    if (!item || item.type !== 'equipment' || !item.slot) {
      this.showMessage('Cannot equip this item!', 'error');
      return;
    }

    this.isProcessing = true;
    const success = GameState.equipItem(itemId);

    if (success) {
      this.showMessage(`Equipped ${item.name}!`, 'success');
      this.callbacks.onEquip?.(itemId, item.slot);
    } else {
      this.showMessage('Failed to equip!', 'error');
    }

    setTimeout(() => {
      this.isProcessing = false;
      this.renderList();
      this.renderDetails();
    }, 100);
  }

  /**
   * Unequip an item
   */
  private unequipItem(itemId: string): void {
    if (this.isProcessing) return;

    const item = getItem(itemId);
    if (!item || !item.slot) {
      this.showMessage('Cannot unequip!', 'error');
      return;
    }

    this.isProcessing = true;
    GameState.unequipItem(item.slot);
    this.showMessage(`Unequipped ${item.name}!`, 'success');
    this.callbacks.onUnequip?.(item.slot);

    setTimeout(() => {
      this.isProcessing = false;
      this.renderList();
      this.renderDetails();
    }, 100);
  }

  /**
   * Show a temporary message
   */
  private showMessage(text: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    if (!this.messageContainer) return;

    // Set color based on type
    const colors = {
      success: '#4ade80',
      error: '#f87171',
      warning: '#fbbf24',
    };

    this.messageContainer.textContent = text;
    this.messageContainer.style.borderColor = colors[type];
    this.messageContainer.classList.add('visible');

    setTimeout(() => {
      this.messageContainer?.classList.remove('visible');
    }, 1500);
  }

  /**
   * Destroy the overlay
   */
  destroy(): void {
    this.removeKeyboardHandlers();
    this.container.remove();
  }
}
