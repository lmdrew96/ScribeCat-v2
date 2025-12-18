/**
 * DungeonMerchantOverlay - HTML-based merchant shop for dungeon scene
 *
 * Provides a styled merchant interface with item listing and purchase functionality.
 */

import { injectOverlayStyles } from '../../css/index.js';
import { getItem, GameItem } from '../../data/items.js';

export interface MerchantCallbacks {
  onBuy: (itemId: string) => boolean; // Returns true if purchase successful
  onClose: () => void;
  getGold: () => number;
}

/**
 * DungeonMerchantOverlay - Merchant shop overlay for dungeon scene
 */
export class DungeonMerchantOverlay {
  private container: HTMLDivElement;
  private callbacks: MerchantCallbacks;
  private _isOpen = false;
  private selectedIndex = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  private inventory: string[] = [];
  private items: GameItem[] = [];

  constructor(parentElement: HTMLElement, callbacks: MerchantCallbacks) {
    this.callbacks = callbacks;

    injectOverlayStyles();

    this.container = document.createElement('div');
    this.container.className = 'sq-dungeon-merchant-overlay';
    this.container.style.cssText = `
      display: none;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 200;
    `;

    this.buildDOM();
    this.addStyles();
    parentElement.appendChild(this.container);
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  private buildDOM(): void {
    this.container.innerHTML = `
      <div class="sq-merchant-backdrop"></div>
      <div class="sq-merchant-panel">
        <div class="sq-merchant-header">
          <h3 class="sq-merchant-title">🛒 Merchant</h3>
          <div class="sq-merchant-gold">💰 <span class="gold-amount">0</span></div>
        </div>
        <div class="sq-merchant-body">
          <div class="sq-merchant-items"></div>
        </div>
        <div class="sq-merchant-footer">
          <div class="sq-merchant-hint">
            <kbd>↑↓</kbd> Select &nbsp; <kbd>Enter</kbd> Buy &nbsp; <kbd>Esc</kbd> Leave
          </div>
        </div>
      </div>
    `;

    this.container.addEventListener('click', (e) => this.handleClick(e));
  }

  private addStyles(): void {
    if (document.getElementById('sq-dungeon-merchant-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'sq-dungeon-merchant-styles';
    styles.textContent = `
      .sq-dungeon-merchant-overlay {
        font-family: 'Segoe UI', system-ui, sans-serif;
      }

      .sq-merchant-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
      }

      .sq-merchant-panel {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 340px;
        max-height: 320px;
        background: linear-gradient(180deg, #2a2436 0%, #1e1828 100%);
        border: 3px solid #ffc864;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .sq-merchant-header {
        padding: 14px 16px;
        background: linear-gradient(180deg, #3a3046 0%, #2a2436 100%);
        border-bottom: 2px solid #aa8844;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .sq-merchant-title {
        margin: 0;
        font-size: 17px;
        font-weight: 600;
        color: #ffc864;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .sq-merchant-gold {
        font-size: 14px;
        color: #fbbf24;
        font-weight: 500;
      }

      .sq-merchant-body {
        flex: 1;
        padding: 12px;
        overflow-y: auto;
        min-height: 0;
      }

      .sq-merchant-items {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .sq-merchant-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        background: rgba(42, 36, 54, 0.6);
        border: 2px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .sq-merchant-item:hover:not(.cannot-afford) {
        background: rgba(255, 200, 100, 0.15);
      }

      .sq-merchant-item.selected {
        background: linear-gradient(90deg, rgba(255, 200, 100, 0.25) 0%, rgba(255, 200, 100, 0.1) 100%);
        border-color: #ffc864;
        box-shadow: 0 0 12px rgba(255, 200, 100, 0.2);
      }

      .sq-merchant-item.cannot-afford {
        opacity: 0.5;
      }

      .sq-merchant-item-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .sq-merchant-item-name {
        font-size: 14px;
        font-weight: 500;
        color: #fff;
      }

      .sq-merchant-item.selected .sq-merchant-item-name::before {
        content: '▸ ';
        color: #ffc864;
      }

      .sq-merchant-item-desc {
        font-size: 11px;
        color: #999;
      }

      .sq-merchant-item-price {
        font-size: 14px;
        font-weight: 600;
        color: #fbbf24;
      }

      .sq-merchant-item.cannot-afford .sq-merchant-item-price {
        color: #ff6464;
      }

      .sq-merchant-footer {
        padding: 10px 16px;
        background: rgba(0, 0, 0, 0.2);
        border-top: 1px solid #aa8844;
      }

      .sq-merchant-hint {
        font-size: 11px;
        color: #888;
        text-align: center;
      }

      .sq-merchant-hint kbd {
        display: inline-block;
        padding: 2px 6px;
        background: #2a2436;
        border: 1px solid #aa8844;
        border-radius: 4px;
        font-family: inherit;
        font-size: 10px;
        color: #b4b4b4;
      }

      .sq-merchant-body::-webkit-scrollbar {
        width: 6px;
      }

      .sq-merchant-body::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 3px;
      }

      .sq-merchant-body::-webkit-scrollbar-thumb {
        background: #ffc864;
        border-radius: 3px;
      }
    `;
    document.head.appendChild(styles);
  }

  private updateGoldDisplay(): void {
    const goldEl = this.container.querySelector('.gold-amount');
    if (goldEl) {
      goldEl.textContent = this.callbacks.getGold().toString();
    }
  }

  private renderItems(): void {
    const itemsContainer = this.container.querySelector('.sq-merchant-items');
    if (!itemsContainer) return;

    const gold = this.callbacks.getGold();

    itemsContainer.innerHTML = this.items.map((item, index) => {
      const canAfford = gold >= item.buyPrice;
      return `
        <div 
          class="sq-merchant-item ${index === this.selectedIndex ? 'selected' : ''} ${!canAfford ? 'cannot-afford' : ''}"
          data-index="${index}"
        >
          <div class="sq-merchant-item-info">
            <div class="sq-merchant-item-name">${item.name}</div>
            <div class="sq-merchant-item-desc">${item.description || ''}</div>
          </div>
          <div class="sq-merchant-item-price">${item.buyPrice}g</div>
        </div>
      `;
    }).join('');

    // Scroll selected into view
    const selectedEl = itemsContainer.querySelector('.selected');
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    if (target.classList.contains('sq-merchant-backdrop')) {
      this.callbacks.onClose();
      this.close();
      return;
    }

    const itemEl = target.closest('.sq-merchant-item') as HTMLElement;
    if (itemEl && !itemEl.classList.contains('cannot-afford')) {
      const index = parseInt(itemEl.dataset.index || '0');
      this.selectedIndex = index;
      this.tryPurchase();
    }
  }

  private setupKeyboardHandlers(): void {
    this.keyHandler = (e: KeyboardEvent) => {
      if (!this._isOpen) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          e.stopPropagation();
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          this.renderItems();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          e.stopPropagation();
          this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
          this.renderItems();
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          e.stopPropagation();
          this.tryPurchase();
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          this.callbacks.onClose();
          this.close();
          break;
      }
    };

    window.addEventListener('keydown', this.keyHandler, true);
  }

  private removeKeyboardHandlers(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
  }

  private tryPurchase(): void {
    if (this.items.length === 0) return;

    const item = this.items[this.selectedIndex];
    const itemId = this.inventory[this.selectedIndex];
    
    if (item && this.callbacks.getGold() >= item.buyPrice) {
      const success = this.callbacks.onBuy(itemId);
      if (success) {
        this.updateGoldDisplay();
        this.renderItems();
      }
    }
  }

  open(inventory: string[]): void {
    if (this._isOpen) return;

    this.inventory = inventory;
    this.items = inventory.map(id => getItem(id)).filter((item): item is GameItem => item !== null);
    this.selectedIndex = 0;

    this.updateGoldDisplay();
    this.renderItems();
    this.container.style.display = 'block';
    this._isOpen = true;

    setTimeout(() => {
      if (this._isOpen) {
        this.setupKeyboardHandlers();
      }
    }, 100);
  }

  close(): void {
    if (!this._isOpen) return;

    this.container.style.display = 'none';
    this._isOpen = false;
    this.removeKeyboardHandlers();
  }

  destroy(): void {
    this.removeKeyboardHandlers();
    this.container.remove();
  }
}
