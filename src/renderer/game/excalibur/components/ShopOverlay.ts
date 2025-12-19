/**
 * ShopOverlay - HTML-based shop UI overlay component
 *
 * Provides a hybrid Canvas/HTML implementation for the shop interface.
 * Uses HTML/CSS for complex UI elements (tabs, scrollable lists, item details)
 * while the game scene handles the background, NPCs, and player movement.
 *
 * Benefits over pure Canvas:
 * - Native scrolling for item lists
 * - CSS hover states and transitions
 * - Easier text wrapping and formatting
 * - Better accessibility
 * - Simpler tooltip implementation
 */

import { GameState } from '../../state/GameState.js';
import {
  getItem,
  getShopItemsForTier,
  getUnlockedTier,
  type ItemDefinition,
  type EquipmentSlot,
} from '../../data/items.js';
import { injectOverlayStyles } from '../../css/index.js';

/**
 * Shop tab configuration
 */
const TABS = [
  { id: 'items', label: 'Items' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'armor', label: 'Armor' },
  { id: 'special', label: 'Special' },
  { id: 'decor', label: 'Decor' },
  { id: 'equip', label: 'Equip' },
  { id: 'sell', label: 'Sell' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Shop overlay events
 */
export interface ShopOverlayCallbacks {
  /** Called when overlay is closed */
  onClose: () => void;
  /** Called when an item is purchased */
  onPurchase?: (itemId: string) => void;
  /** Called when an item is sold */
  onSell?: (itemId: string) => void;
  /** Called when an item is equipped */
  onEquip?: (itemId: string, slot: EquipmentSlot) => void;
  /** Called when an item is unequipped */
  onUnequip?: (slot: EquipmentSlot) => void;
}

/**
 * ShopOverlay manages the HTML-based shop UI
 */
export class ShopOverlay {
  private container: HTMLDivElement;
  private callbacks: ShopOverlayCallbacks;

  // State
  private _isOpen = false;
  private selectedTab: TabId = 'items';
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

  constructor(parentElement: HTMLElement, callbacks: ShopOverlayCallbacks) {
    this.callbacks = callbacks;

    // Ensure overlay styles are injected
    injectOverlayStyles();

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'sq-shop-overlay';
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
    parentElement.appendChild(this.container);
  }

  /**
   * Build the overlay DOM structure
   */
  private buildDOM(): void {
    this.container.innerHTML = `
      <div class="sq-backdrop" data-action="close"></div>
      <div class="sq-panel sq-shop-panel">
        <div class="sq-panel-header">
          <h3 class="sq-panel-title">Shop</h3>
          <div class="sq-gold-display">
            <span class="sq-gold-value">0</span>G
          </div>
          <button class="sq-panel-close" data-action="close">&times;</button>
        </div>
        <div class="sq-tabs sq-shop-tabs"></div>
        <div class="sq-panel-body sq-shop-body">
          <div class="sq-shop-list-container">
            <div class="sq-list sq-shop-list"></div>
          </div>
          <div class="sq-shop-details"></div>
        </div>
        <div class="sq-panel-footer">
          <div class="sq-controls-hint">
            <kbd>↑↓</kbd> Navigate &nbsp;
            <kbd>←→</kbd> Tabs &nbsp;
            <kbd>Enter</kbd> Select &nbsp;
            <kbd>Esc</kbd> Close
          </div>
        </div>
        <div class="sq-shop-message"></div>
      </div>
    `;

    // Add component-specific styles
    this.addStyles();

    // Cache DOM references
    this.tabsContainer = this.container.querySelector('.sq-shop-tabs');
    this.listContainer = this.container.querySelector('.sq-shop-list');
    this.detailsContainer = this.container.querySelector('.sq-shop-details');
    this.goldDisplay = this.container.querySelector('.sq-gold-value');
    this.messageContainer = this.container.querySelector('.sq-shop-message');

    // Setup click handlers
    this.container.addEventListener('click', (e) => this.handleClick(e));
  }

  /**
   * Add component-specific styles
   */
  private addStyles(): void {
    if (document.getElementById('sq-shop-overlay-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'sq-shop-overlay-styles';
    styles.textContent = `
      .sq-shop-overlay {
        font-family: 'Segoe UI', system-ui, sans-serif;
      }

      .sq-shop-overlay .sq-backdrop {
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

      .sq-shop-panel {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 380px;
        max-height: 85%;
        display: flex;
        flex-direction: column;
        background: linear-gradient(180deg, #2a2a4e 0%, #1e1e32 100%);
        border: 3px solid #6496ff;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        padding: 0;
        overflow: hidden;
      }

      .sq-shop-panel .sq-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: linear-gradient(180deg, #3a3a6e 0%, #2a2a4e 100%);
        border-bottom: 2px solid #4a6aaa;
      }

      .sq-shop-panel .sq-panel-title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #fff;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .sq-shop-panel .sq-gold-display {
        font-size: 14px;
        font-weight: 600;
        color: #fbbf24;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      }

      .sq-shop-panel .sq-panel-close {
        background: none;
        border: none;
        color: #888;
        font-size: 20px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
        transition: color 0.15s;
      }

      .sq-shop-panel .sq-panel-close:hover {
        color: #ff6464;
      }

      .sq-shop-tabs {
        display: flex;
        gap: 2px;
        padding: 8px 12px;
        background-color: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid #4a6aaa;
        flex-shrink: 0;
        overflow-x: auto;
      }

      .sq-shop-tabs .sq-tab {
        background: #2a2a4e;
        border: 1px solid #4a6aaa;
        border-radius: 6px;
        color: #b4b4b4;
        font-size: 11px;
        padding: 6px 10px;
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
      }

      .sq-shop-tabs .sq-tab:hover {
        background: #3a3a5e;
        color: #fff;
      }

      .sq-shop-tabs .sq-tab.active {
        background: linear-gradient(180deg, #5a7aff 0%, #4a6aee 100%);
        border-color: #7ab4ff;
        color: #fff;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(100, 150, 255, 0.3);
      }

      .sq-shop-body {
        display: flex;
        gap: 12px;
        flex: 1;
        min-height: 0;
        padding: 12px;
      }

      .sq-shop-list-container {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        padding: 8px;
      }

      .sq-shop-list {
        flex: 1;
        min-height: 80px;
        overflow-y: auto;
      }

      .sq-shop-list::-webkit-scrollbar {
        width: 6px;
      }

      .sq-shop-list::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 3px;
      }

      .sq-shop-list::-webkit-scrollbar-thumb {
        background: #6496ff;
        border-radius: 3px;
      }

      .sq-shop-list::-webkit-scrollbar-thumb:hover {
        background: #7ab4ff;
      }

      .sq-shop-details {
        width: 130px;
        flex-shrink: 0;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        padding: 10px;
        font-size: 11px;
        overflow-y: auto;
        border: 1px solid rgba(100, 150, 255, 0.2);
      }

      .sq-shop-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.1s;
        border: 1px solid transparent;
        margin-bottom: 2px;
      }

      .sq-shop-item:hover {
        background-color: rgba(100, 150, 255, 0.15);
      }

      .sq-shop-item.selected {
        background: linear-gradient(90deg, rgba(100, 150, 255, 0.3) 0%, rgba(100, 150, 255, 0.1) 100%);
        border-color: #fbbf24;
        box-shadow: 0 0 8px rgba(251, 191, 36, 0.2);
      }

      .sq-shop-item-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
        color: #fff;
      }

      .sq-shop-item-owned {
        color: #64ff64;
        font-size: 10px;
        margin-left: 8px;
        font-weight: 600;
      }

      .sq-shop-item-price {
        color: #fbbf24;
        font-size: 11px;
        margin-left: 8px;
        font-weight: 600;
      }

      .sq-shop-details-name {
        color: #fbbf24;
        margin-bottom: 10px;
        font-size: 13px;
        font-weight: 600;
        border-bottom: 1px solid rgba(251, 191, 36, 0.3);
        padding-bottom: 8px;
      }

      .sq-shop-details-desc {
        color: #d4d4d4;
        line-height: 1.5;
        margin-bottom: 10px;
        font-size: 10px;
      }

      .sq-shop-details-stats {
        border-top: 1px solid rgba(100, 150, 255, 0.3);
        padding-top: 10px;
        font-size: 10px;
      }

      .sq-shop-details-stat {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
        color: #b4b4b4;
      }

      .sq-shop-details-stat-value {
        color: #64ff64;
        font-weight: 600;
      }

      .sq-panel-footer {
        padding: 10px 16px;
        background: rgba(0, 0, 0, 0.3);
        border-top: 1px solid #4a6aaa;
      }

      .sq-controls-hint {
        font-size: 10px;
        color: #888;
        text-align: center;
      }

      .sq-controls-hint kbd {
        background: #3a3a5e;
        border: 1px solid #4a6aaa;
        border-radius: 3px;
        padding: 2px 5px;
        font-size: 9px;
        color: #b4b4b4;
        font-family: inherit;
      }

      .sq-shop-message {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(180deg, #2a2a4e 0%, #1e1e32 100%);
        border: 2px solid #6496ff;
        border-radius: 8px;
        padding: 16px 24px;
        font-size: 13px;
        display: none;
        z-index: 10;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        text-align: center;
        color: #fff;
      }

      .sq-shop-message.visible {
        display: block;
        animation: sq-message-in 0.2s ease-out;
      }

      .sq-shop-message.success {
        border-color: #64ff64;
        box-shadow: 0 8px 32px rgba(100, 255, 100, 0.2);
      }

      .sq-shop-message.error {
        border-color: #ff6464;
        box-shadow: 0 8px 32px rgba(255, 100, 100, 0.2);
      }

      .sq-shop-empty {
        color: #888;
        text-align: center;
        padding: 24px;
        font-size: 12px;
        font-style: italic;
      }

      @keyframes sq-message-in {
        from {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Open the shop overlay
   */
  open(): void {
    if (this._isOpen) return;

    this._isOpen = true;
    this.selectedTab = 'items';
    this.selectedIndex = 0;
    this.container.style.display = 'block';

    this.render();
    this.setupKeyboardNavigation();
  }

  /**
   * Close the shop overlay
   */
  close(): void {
    if (!this._isOpen) return;

    this._isOpen = false;
    this.container.style.display = 'none';
    this.removeKeyboardNavigation();
    this.callbacks.onClose();
  }

  /**
   * Check if overlay is open
   */
  get isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * Render the entire shop UI
   */
  private render(): void {
    this.renderGold();
    this.renderTabs();
    this.renderList();
    this.renderDetails();
  }

  /**
   * Render gold display
   */
  private renderGold(): void {
    if (this.goldDisplay) {
      this.goldDisplay.textContent = String(GameState.player.gold);
    }
  }

  /**
   * Render tab bar
   */
  private renderTabs(): void {
    if (!this.tabsContainer) return;

    this.tabsContainer.innerHTML = TABS.map(
      (tab) => `
        <button 
          class="sq-tab ${tab.id === this.selectedTab ? 'active' : ''}"
          data-tab="${tab.id}"
        >
          ${tab.label}
        </button>
      `
    ).join('');
  }

  /**
   * Get items for the current tab
   */
  private getTabItems(): { id: string; item: ItemDefinition }[] {
    const tier = getUnlockedTier(GameState.player.level);
    const shopItems = getShopItemsForTier(tier);

    let itemIds: string[] = [];

    switch (this.selectedTab) {
      case 'items':
        itemIds = shopItems.consumables;
        break;
      case 'weapons':
        itemIds = shopItems.weapons;
        break;
      case 'armor':
        itemIds = shopItems.armor;
        break;
      case 'special':
        itemIds = shopItems.special;
        break;
      case 'decor':
        itemIds = shopItems.decorations;
        break;
      case 'equip':
        return this.getPlayerEquipment();
      case 'sell':
        return this.getSellableItems();
    }

    return itemIds
      .map((id) => {
        const item = getItem(id);
        return item ? { id, item } : null;
      })
      .filter((x): x is { id: string; item: ItemDefinition } => x !== null);
  }

  /**
   * Get player's equipment items
   */
  private getPlayerEquipment(): { id: string; item: ItemDefinition; slot: EquipmentSlot }[] {
    const equipment: { id: string; item: ItemDefinition; slot: EquipmentSlot }[] = [];

    for (const invItem of GameState.player.items) {
      const item = getItem(invItem.id);
      if (item?.type === 'equipment' && item.slot) {
        for (let i = 0; i < invItem.quantity; i++) {
          equipment.push({ id: invItem.id, item, slot: item.slot });
        }
      }
    }

    return equipment;
  }

  /**
   * Get sellable items
   */
  private getSellableItems(): { id: string; item: ItemDefinition; quantity: number }[] {
    const sellable: { id: string; item: ItemDefinition; quantity: number }[] = [];

    for (const invItem of GameState.player.items) {
      const item = getItem(invItem.id);
      if (item && item.sellPrice > 0) {
        sellable.push({ id: invItem.id, item, quantity: invItem.quantity });
      }
    }

    return sellable;
  }

  /**
   * Render item list
   */
  private renderList(): void {
    if (!this.listContainer) return;

    const items = this.getTabItems();

    if (items.length === 0) {
      this.listContainer.innerHTML = `<div class="sq-shop-empty">No items available</div>`;
      return;
    }

    // Clamp selection
    if (this.selectedIndex >= items.length) {
      this.selectedIndex = Math.max(0, items.length - 1);
    }

    const isSellTab = this.selectedTab === 'sell';
    const isEquipTab = this.selectedTab === 'equip';

    this.listContainer.innerHTML = items
      .map((entry, index) => {
        const { id, item } = entry;
        const isSelected = index === this.selectedIndex;
        const owned = GameState.getItemCount(id);
        const price = isSellTab ? item.sellPrice : item.buyPrice;

        // Check if equipped
        const equipped = GameState.player.equipped;
        const isEquipped = equipped.weapon === id || equipped.armor === id || equipped.accessory === id;

        return `
          <div 
            class="sq-shop-item ${isSelected ? 'selected' : ''}"
            data-index="${index}"
            data-item-id="${id}"
          >
            <span class="sq-shop-item-name">${item.name}</span>
            ${isEquipped ? '<span class="sq-shop-item-owned">[E]</span>' : ''}
            ${!isEquipTab && !isSellTab && owned > 0 ? `<span class="sq-shop-item-owned">x${owned}</span>` : ''}
            ${isSellTab && (entry as any).quantity > 1 ? `<span class="sq-shop-item-owned">x${(entry as any).quantity}</span>` : ''}
            <span class="sq-shop-item-price">${price}G</span>
          </div>
        `;
      })
      .join('');

    // Scroll selected item into view
    const selectedElement = this.listContainer.querySelector('.sq-shop-item.selected');
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /**
   * Render item details panel
   */
  private renderDetails(): void {
    if (!this.detailsContainer) return;

    const items = this.getTabItems();
    if (items.length === 0 || this.selectedIndex >= items.length) {
      this.detailsContainer.innerHTML = `<div class="sq-shop-empty">Select an item</div>`;
      return;
    }

    const { item } = items[this.selectedIndex];

    let statsHtml = '';
    if (item.type === 'equipment' && item.stats) {
      const stats = item.stats;
      const statEntries = [
        stats.attack && ['ATK', `+${stats.attack}`],
        stats.defense && ['DEF', `+${stats.defense}`],
        stats.health && ['HP', `+${stats.health}`],
        stats.speed && ['SPD', `+${stats.speed}`],
      ].filter(Boolean);

      if (statEntries.length > 0) {
        statsHtml = `
          <div class="sq-shop-details-stats">
            ${statEntries
              .map(
                ([label, value]) => `
                  <div class="sq-shop-details-stat">
                    <span>${label}</span>
                    <span class="sq-shop-details-stat-value">${value}</span>
                  </div>
                `
              )
              .join('')}
          </div>
        `;
      }
    }

    this.detailsContainer.innerHTML = `
      <div class="sq-shop-details-name">${item.name}</div>
      <div class="sq-shop-details-desc">${item.description}</div>
      ${statsHtml}
    `;
  }

  /**
   * Setup keyboard navigation
   */
  private setupKeyboardNavigation(): void {
    this.keyHandler = (e: KeyboardEvent) => {
      if (!this._isOpen) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          this.navigateList(-1);
          break;

        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          this.navigateList(1);
          break;

        case 'ArrowLeft':
        case 'q':
        case 'Q':
          e.preventDefault();
          this.navigateTab(-1);
          break;

        case 'ArrowRight':
        case 'e':
        case 'E':
          e.preventDefault();
          this.navigateTab(1);
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          this.handleSelect();
          break;

        case 'u':
        case 'U':
          if (this.selectedTab === 'equip') {
            e.preventDefault();
            this.handleUnequip();
          }
          break;

        case 'Escape':
          e.preventDefault();
          this.close();
          break;
      }
    };

    document.addEventListener('keydown', this.keyHandler);
  }

  /**
   * Remove keyboard navigation
   */
  private removeKeyboardNavigation(): void {
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  /**
   * Navigate list up/down
   */
  private navigateList(direction: number): void {
    const items = this.getTabItems();
    if (items.length === 0) return;

    this.selectedIndex = Math.max(0, Math.min(items.length - 1, this.selectedIndex + direction));
    this.renderList();
    this.renderDetails();
  }

  /**
   * Navigate tabs left/right
   */
  private navigateTab(direction: number): void {
    const currentIndex = TABS.findIndex((t) => t.id === this.selectedTab);
    const newIndex = Math.max(0, Math.min(TABS.length - 1, currentIndex + direction));
    const newTab = TABS[newIndex];

    if (newTab.id !== this.selectedTab) {
      this.selectedTab = newTab.id;
      this.selectedIndex = 0;
      this.render();
    }
  }

  /**
   * Handle click events
   */
  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    // Close button or backdrop
    if (target.dataset.action === 'close') {
      this.close();
      return;
    }

    // Tab click
    const tabButton = target.closest('[data-tab]') as HTMLElement;
    if (tabButton) {
      const tabId = tabButton.dataset.tab as TabId;
      if (tabId !== this.selectedTab) {
        this.selectedTab = tabId;
        this.selectedIndex = 0;
        this.render();
      }
      return;
    }

    // Item click
    const itemElement = target.closest('[data-index]') as HTMLElement;
    if (itemElement) {
      const index = parseInt(itemElement.dataset.index!, 10);
      if (index !== this.selectedIndex) {
        this.selectedIndex = index;
        this.renderList();
        this.renderDetails();
      } else {
        // Double-click behavior: select the item
        this.handleSelect();
      }
      return;
    }
  }

  /**
   * Handle item selection (buy/equip/sell)
   */
  private handleSelect(): void {
    if (this.isProcessing) return;

    const items = this.getTabItems();
    if (items.length === 0 || this.selectedIndex >= items.length) {
      this.showMessage('No item selected!', 'error');
      return;
    }

    switch (this.selectedTab) {
      case 'equip':
        this.handleEquip();
        break;
      case 'sell':
        this.handleSell();
        break;
      default:
        this.handleBuy();
        break;
    }
  }

  /**
   * Handle buying an item
   */
  private handleBuy(): void {
    const items = this.getTabItems();
    const { id, item } = items[this.selectedIndex];

    if (GameState.player.gold < item.buyPrice) {
      this.showMessage('Not enough gold!', 'error');
      return;
    }

    this.isProcessing = true;
    GameState.spendGold(item.buyPrice);
    GameState.addItem(id, 1);

    this.showMessage(`Purchased ${item.name}!`, 'success');
    this.callbacks.onPurchase?.(id);

    if (GameState.isCloudSyncEnabled()) {
      GameState.saveToCloud().catch((err) => console.warn('Autosave failed:', err));
    }

    setTimeout(() => {
      this.isProcessing = false;
      this.render();
    }, 100);
  }

  /**
   * Handle equipping an item
   */
  private handleEquip(): void {
    const items = this.getPlayerEquipment();
    if (items.length === 0 || this.selectedIndex >= items.length) return;

    const { id, slot } = items[this.selectedIndex];
    const item = getItem(id);

    this.isProcessing = true;
    const success = GameState.equipItem(id);

    if (success) {
      this.showMessage(`Equipped ${item?.name}!`, 'success');
      this.callbacks.onEquip?.(id, slot);
    } else {
      this.showMessage('Failed to equip!', 'error');
    }

    setTimeout(() => {
      this.isProcessing = false;
      this.render();
    }, 100);
  }

  /**
   * Handle unequipping an item
   */
  private handleUnequip(): void {
    const items = this.getPlayerEquipment();
    if (items.length === 0 || this.selectedIndex >= items.length) return;

    const { id, slot } = items[this.selectedIndex];
    const item = getItem(id);

    // Check if this item is actually equipped
    if (GameState.player.equipped[slot] !== id) {
      this.showMessage('Item not equipped!', 'error');
      return;
    }

    this.isProcessing = true;
    GameState.unequipItem(slot);

    this.showMessage(`Unequipped ${item?.name}!`, 'success');
    this.callbacks.onUnequip?.(slot);

    // Adjust selection
    const updated = this.getPlayerEquipment();
    if (this.selectedIndex >= updated.length) {
      this.selectedIndex = Math.max(0, updated.length - 1);
    }

    setTimeout(() => {
      this.isProcessing = false;
      this.render();
    }, 100);
  }

  /**
   * Handle selling an item
   */
  private handleSell(): void {
    const items = this.getSellableItems();
    if (items.length === 0 || this.selectedIndex >= items.length) return;

    const { id, item } = items[this.selectedIndex];

    // Check if equipped
    const equipped = GameState.player.equipped;
    if (equipped.weapon === id || equipped.armor === id || equipped.accessory === id) {
      this.showMessage('Unequip item first!', 'error');
      return;
    }

    this.isProcessing = true;
    GameState.removeItem(id, 1);
    GameState.addGold(item.sellPrice);

    this.showMessage(`Sold ${item.name} for ${item.sellPrice}G!`, 'success');
    this.callbacks.onSell?.(id);

    // Adjust selection
    const updated = this.getSellableItems();
    if (this.selectedIndex >= updated.length) {
      this.selectedIndex = Math.max(0, updated.length - 1);
    }

    setTimeout(() => {
      this.isProcessing = false;
      this.render();
    }, 100);
  }

  /**
   * Show a temporary message
   */
  private showMessage(text: string, type: 'success' | 'error' = 'success'): void {
    if (!this.messageContainer) return;

    this.messageContainer.textContent = text;
    this.messageContainer.className = `sq-shop-message visible ${type}`;

    // Hide after delay
    setTimeout(() => {
      if (this.messageContainer) {
        this.messageContainer.className = 'sq-shop-message';
      }
    }, 1500);
  }

  /**
   * Destroy and clean up
   */
  destroy(): void {
    this.removeKeyboardNavigation();
    this.container.remove();
  }
}
