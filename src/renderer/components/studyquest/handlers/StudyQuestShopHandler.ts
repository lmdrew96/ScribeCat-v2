/**
 * StudyQuestShopHandler
 *
 * Handles shop display and purchasing for StudyQuest.
 */

import { createLogger } from '../../../../shared/logger.js';
import type { StudyQuestManager } from '../../../managers/StudyQuestManager.js';
import { StudyQuestSound } from '../StudyQuestSound.js';
import type { HandlerCallbacks } from './types.js';
import { SQ_ICONS } from './types.js';

const logger = createLogger('StudyQuestShopHandler');

export class StudyQuestShopHandler {
  private container: HTMLElement;
  private manager: StudyQuestManager;
  private callbacks: HandlerCallbacks;

  constructor(
    container: HTMLElement,
    manager: StudyQuestManager,
    callbacks: HandlerCallbacks
  ) {
    this.container = container;
    this.manager = manager;
    this.callbacks = callbacks;
  }

  /**
   * Load and render shop items
   */
  async loadShop(): Promise<void> {
    const grid = this.container.querySelector('#shop-grid');
    if (!grid) return;

    const items = await this.manager.getShopItems();

    if (items.length === 0) {
      grid.innerHTML = '<p class="studyquest-empty">No items available</p>';
      return;
    }

    const itemIcons: Record<string, string> = {
      weapon: SQ_ICONS.weapon,
      armor: SQ_ICONS.armor,
      consumable: SQ_ICONS.potion,
    };

    const state = this.manager.getState();
    const playerGold = state.character?.gold || 0;

    grid.innerHTML = items
      .map((item) => {
        const canAfford = playerGold >= (item.buyPrice ?? 0);
        return `
          <div class="studyquest-shop-item ${!canAfford ? 'cannot-afford' : ''}">
            <div class="studyquest-item-header">
              <span class="studyquest-item-icon">${itemIcons[item.itemType] || SQ_ICONS.item}</span>
              <div>
                <h4 class="studyquest-item-name">${item.name}</h4>
                <p class="studyquest-item-type">${item.itemType}</p>
              </div>
            </div>
            <p class="studyquest-item-stats">
              ${item.attackBonus ? `+${item.attackBonus} ATK ` : ''}
              ${item.defenseBonus ? `+${item.defenseBonus} DEF ` : ''}
              ${item.speedBonus ? `+${item.speedBonus} SPD ` : ''}
              ${item.healAmount ? `+${item.healAmount} HP ` : ''}
            </p>
            <p class="studyquest-item-desc">${item.description || ''}</p>
            <div class="studyquest-item-price">
              <span class="studyquest-price ${!canAfford ? 'insufficient' : ''}">${SQ_ICONS.gold} ${item.buyPrice ?? 0}</span>
              <button class="pixel-btn pixel-btn-gold studyquest-buy-btn"
                      data-item-id="${item.id}"
                      ${!canAfford ? 'disabled' : ''}>
                ${canAfford ? 'Buy' : 'Can\'t Afford'}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    // Add buy handlers
    grid.querySelectorAll('.studyquest-buy-btn:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const itemId = (e.currentTarget as HTMLElement).dataset.itemId;
        if (itemId) {
          await this.buyItem(itemId);
        }
      });
    });
  }

  /**
   * Buy an item
   */
  private async buyItem(itemId: string): Promise<void> {
    try {
      const success = await this.manager.buyItem(itemId);
      if (success) {
        StudyQuestSound.play('item-pickup');
        this.callbacks.showToast('Item purchased!');
        this.callbacks.updatePlayerInfo();
        // Refresh shop to update afford status
        await this.loadShop();
      } else {
        StudyQuestSound.play('error');
        this.callbacks.showToast('Cannot buy item');
      }
    } catch (error) {
      logger.error('Buy item error:', error);
      StudyQuestSound.play('error');
      this.callbacks.showToast('Purchase failed');
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // No resources to clean up
  }
}
