/**
 * StudyQuestInventoryHandler
 *
 * Handles inventory display and item interactions for StudyQuest.
 * Includes item detail popups, equip/unequip, use consumables, and drop items.
 */

import { createLogger } from '../../../../shared/logger.js';
import type { StudyQuestManager } from '../../../managers/StudyQuestManager.js';
import type { InventorySlot } from '../../../../domain/entities/StudyQuestItem.js';
import { StudyQuestSound } from '../StudyQuestSound.js';
import type { InventoryHandlerCallbacks } from './types.js';
import { SQ_ICONS } from './types.js';

const logger = createLogger('StudyQuestInventoryHandler');

export class StudyQuestInventoryHandler {
  private container: HTMLElement;
  private manager: StudyQuestManager;
  private callbacks: InventoryHandlerCallbacks;
  private activePopup: HTMLElement | null = null;
  private popupClickOutsideHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    container: HTMLElement,
    manager: StudyQuestManager,
    callbacks: InventoryHandlerCallbacks
  ) {
    this.container = container;
    this.manager = manager;
    this.callbacks = callbacks;
  }

  /**
   * Load and render inventory
   */
  async loadInventory(): Promise<void> {
    const grid = this.container.querySelector('#inventory-grid');
    if (!grid) return;

    const inventory = await this.manager.loadInventory();

    if (inventory.length === 0) {
      grid.innerHTML = '<p class="studyquest-empty">Your inventory is empty</p>';
      return;
    }

    const itemIcons: Record<string, string> = {
      weapon: SQ_ICONS.weapon,
      armor: SQ_ICONS.armor,
      consumable: SQ_ICONS.potion,
      key_item: SQ_ICONS.keyItem,
    };

    grid.innerHTML = inventory
      .map(
        (slot) => `
        <div class="studyquest-inventory-slot ${slot.isEquipped ? 'equipped' : ''}"
             data-item-id="${slot.item.id}"
             data-slot-id="${slot.id}"
             title="${slot.item.name}">
          <span class="studyquest-inventory-slot-icon">
            ${itemIcons[slot.item.itemType] || SQ_ICONS.item}
          </span>
          ${slot.quantity > 1 ? `<span class="studyquest-inventory-slot-qty">${slot.quantity}</span>` : ''}
          ${slot.isEquipped ? '<span class="studyquest-equipped-badge">E</span>' : ''}
        </div>
      `
      )
      .join('');

    // Add click handlers for items
    grid.querySelectorAll('.studyquest-inventory-slot').forEach((slotEl) => {
      slotEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        const itemId = (slotEl as HTMLElement).dataset.itemId;
        if (itemId) {
          const slot = inventory.find(s => s.item.id === itemId);
          if (slot) {
            this.showItemDetailPopup(slot, e as MouseEvent);
          }
        }
      });
    });
  }

  /**
   * Show item detail popup with actions
   */
  private showItemDetailPopup(slot: InventorySlot, event: MouseEvent): void {
    // Close any existing popup
    this.closeItemPopup();

    const popup = document.createElement('div');
    popup.className = 'studyquest-item-popup';

    const item = slot.item;
    const stats: string[] = [];
    if (item.attackBonus) stats.push(`+${item.attackBonus} ATK`);
    if (item.defenseBonus) stats.push(`+${item.defenseBonus} DEF`);
    if (item.speedBonus) stats.push(`+${item.speedBonus} SPD`);
    if (item.hpBonus) stats.push(`+${item.hpBonus} Max HP`);
    if (item.healAmount) stats.push(`Restores ${item.healAmount} HP`);

    popup.innerHTML = `
      <div class="studyquest-item-popup-header">
        <span class="studyquest-item-popup-icon">${this.getItemIcon(item.itemType)}</span>
        <div class="studyquest-item-popup-title">
          <h4>${item.name}</h4>
          <span class="studyquest-item-popup-type">${this.formatItemType(item.itemType)}</span>
        </div>
      </div>
      <p class="studyquest-item-popup-desc">${item.description || 'No description'}</p>
      ${stats.length > 0 ? `
        <div class="studyquest-item-popup-stats">
          ${stats.map(s => `<span class="studyquest-item-popup-stat">${s}</span>`).join('')}
        </div>
      ` : ''}
      <div class="studyquest-item-popup-actions">
        ${this.getItemActions(slot)}
      </div>
    `;

    // Position popup near click
    const rect = this.container.getBoundingClientRect();
    let left = event.clientX - rect.left + 10;
    let top = event.clientY - rect.top + 10;

    // Keep popup within container bounds
    const popupWidth = 220;
    const popupHeight = 200;
    if (left + popupWidth > rect.width) {
      left = event.clientX - rect.left - popupWidth - 10;
    }
    if (top + popupHeight > rect.height) {
      top = event.clientY - rect.top - popupHeight - 10;
    }

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;

    this.container.appendChild(popup);
    this.activePopup = popup;

    // Attach action handlers
    popup.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = (btn as HTMLElement).dataset.action;
        if (action) {
          await this.handleItemAction(slot.item.id, action);
        }
      });
    });

    // Click outside to close
    this.popupClickOutsideHandler = (e: MouseEvent) => {
      if (this.activePopup && !this.activePopup.contains(e.target as Node)) {
        this.closeItemPopup();
      }
    };
    setTimeout(() => {
      document.addEventListener('click', this.popupClickOutsideHandler!);
    }, 0);

    logger.info(`Showing item popup for: ${item.name}`);
  }

  /**
   * Get action buttons based on item type
   */
  private getItemActions(slot: InventorySlot): string {
    const actions: string[] = [];
    const item = slot.item;

    switch (item.itemType) {
      case 'consumable':
        actions.push(`<button class="pixel-btn pixel-btn-small" data-action="use">Use</button>`);
        break;
      case 'weapon':
      case 'armor':
      case 'accessory':
        if (slot.isEquipped) {
          actions.push(`<button class="pixel-btn pixel-btn-small" data-action="unequip">Unequip</button>`);
        } else {
          actions.push(`<button class="pixel-btn pixel-btn-small pixel-btn-success" data-action="equip">Equip</button>`);
        }
        break;
    }

    // All items can be dropped (except key items)
    if (item.itemType !== 'key_item') {
      actions.push(`<button class="pixel-btn pixel-btn-small pixel-btn-danger" data-action="drop">Drop</button>`);
    }

    return actions.join('');
  }

  /**
   * Handle item action
   */
  private async handleItemAction(itemId: string, action: string): Promise<void> {
    this.closeItemPopup();

    try {
      switch (action) {
        case 'use':
          const useSuccess = await this.manager.useItem(itemId);
          if (useSuccess) {
            StudyQuestSound.play('heal');
            this.callbacks.showToast('Item used!');
            this.callbacks.updatePlayerInfo();
          } else {
            StudyQuestSound.play('error');
            this.callbacks.showToast('Cannot use item');
          }
          break;

        case 'equip':
          const equipSuccess = await this.manager.equipItem(itemId);
          if (equipSuccess) {
            StudyQuestSound.play('item-pickup');
            this.callbacks.showToast('Item equipped!');
            this.callbacks.updatePlayerInfo();
          } else {
            StudyQuestSound.play('error');
            this.callbacks.showToast('Cannot equip item');
          }
          break;

        case 'unequip':
          const unequipSuccess = await this.manager.unequipItem(itemId);
          if (unequipSuccess) {
            StudyQuestSound.play('menu-select');
            this.callbacks.showToast('Item unequipped');
            this.callbacks.updatePlayerInfo();
          } else {
            StudyQuestSound.play('error');
            this.callbacks.showToast('Cannot unequip item');
          }
          break;

        case 'drop':
          const confirmed = await this.callbacks.showConfirmDialog(
            'Drop Item',
            'Are you sure you want to drop this item? This cannot be undone.'
          );
          if (confirmed) {
            const dropSuccess = await this.manager.dropItem(itemId);
            if (dropSuccess) {
              StudyQuestSound.play('menu-back');
              this.callbacks.showToast('Item dropped');
            } else {
              StudyQuestSound.play('error');
              this.callbacks.showToast('Cannot drop item');
            }
          }
          break;
      }

      // Refresh inventory display
      await this.loadInventory();
    } catch (error) {
      logger.error('Item action error:', error);
      StudyQuestSound.play('error');
      this.callbacks.showToast('Action failed');
    }
  }

  /**
   * Close item detail popup
   */
  closeItemPopup(): void {
    if (this.activePopup) {
      this.activePopup.remove();
      this.activePopup = null;
    }
    if (this.popupClickOutsideHandler) {
      document.removeEventListener('click', this.popupClickOutsideHandler);
      this.popupClickOutsideHandler = null;
    }
  }

  /**
   * Get icon for item type
   */
  private getItemIcon(itemType: string): string {
    const icons: Record<string, string> = {
      weapon: SQ_ICONS.weapon,
      armor: SQ_ICONS.armor,
      accessory: SQ_ICONS.item,
      consumable: SQ_ICONS.potion,
      key_item: SQ_ICONS.keyItem,
    };
    return icons[itemType] || SQ_ICONS.item;
  }

  /**
   * Format item type for display
   */
  private formatItemType(itemType: string): string {
    const labels: Record<string, string> = {
      weapon: 'Weapon',
      armor: 'Armor',
      accessory: 'Accessory',
      consumable: 'Consumable',
      key_item: 'Key Item',
    };
    return labels[itemType] || itemType;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.closeItemPopup();
  }
}
