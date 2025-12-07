/**
 * CollectionScreen
 *
 * Displays all unlockable items organized by category with their
 * locked/unlocked status and progress toward unlocking.
 */

import { createLogger } from '../../../shared/logger.js';
import {
  UnlockManager,
  ALL_UNLOCKS,
  CAT_UNLOCKS,
  TOWN_UNLOCKS,
  DUNGEON_UNLOCKS,
  type Unlockable,
  type UnlockCategory,
  type UnlockTier,
  type PlayerStats,
} from '../../canvas/UnlockManager.js';
import { PlayerStatsService } from '../../canvas/PlayerStatsService.js';

const logger = createLogger('CollectionScreen');

// Category display info
const CATEGORY_INFO: Record<UnlockCategory, { name: string; icon: string; description: string }> = {
  cat: { name: 'Cat Collection', icon: '🐱', description: 'Your feline companions' },
  town_feature: { name: 'Town Features', icon: '🏠', description: 'Unlock new town areas' },
  dungeon: { name: 'Dungeons', icon: '🗡️', description: 'Challenging adventures' },
};

// Tier display info
const TIER_INFO: Record<string, { name: string; color: string; border: string }> = {
  starter: { name: 'Starter', color: '#4ade80', border: '#22c55e' },
  breed: { name: 'Breed', color: '#60a5fa', border: '#3b82f6' },
  themed: { name: 'Themed', color: '#a855f7', border: '#9333ea' },
  seasonal: { name: 'Seasonal', color: '#fb923c', border: '#f97316' },
  secret: { name: 'Secret', color: '#facc15', border: '#eab308' },
};

// Condition type display
const CONDITION_DISPLAY: Record<string, string> = {
  free: 'Always available',
  level: 'Reach level {value}',
  battles_won: 'Win {value} battles',
  gold_collected: 'Collect {value} gold',
  treasures_found: 'Find {value} treasures',
  dungeons_cleared: 'Clear {value} dungeons',
  quests_completed: 'Complete {value} quests',
  study_buddy_days: 'Use Study Buddy {value} days',
  seasonal: 'Play in {month}',
  secret_name: 'Name your cat "{value}"',
  all_dungeons: 'Clear all dungeons',
  custom: 'Special condition',
};

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export class CollectionScreen {
  private container: HTMLDivElement;
  private currentCategory: UnlockCategory = 'cat';
  private stats: PlayerStats;

  constructor() {
    this.stats = PlayerStatsService.getStats();
    this.container = document.createElement('div');
    this.container.className = 'collection-screen';
    this.injectStyles();
    this.render();
  }

  /**
   * Get the container element
   */
  getElement(): HTMLElement {
    return this.container;
  }

  /**
   * Refresh the collection display
   */
  refresh(): void {
    this.stats = PlayerStatsService.getStats();
    this.render();
  }

  /**
   * Set the current category
   */
  setCategory(category: UnlockCategory): void {
    this.currentCategory = category;
    this.render();
  }

  /**
   * Render the collection screen
   */
  private render(): void {
    const unlocks = this.getUnlocksForCategory(this.currentCategory);
    const unlockedCount = unlocks.filter((u) => UnlockManager.isUnlocked(u.id)).length;
    const totalCount = unlocks.length;

    this.container.innerHTML = `
      <div class="collection-header">
        <h2 class="collection-title">Collection</h2>
        <div class="collection-progress">
          <span class="collection-count">${this.getTotalUnlockedCount()} / ${ALL_UNLOCKS.length}</span>
          <span class="collection-label">Total Unlocked</span>
        </div>
      </div>

      <div class="collection-tabs">
        ${this.renderTabs()}
      </div>

      <div class="collection-category-header">
        <span class="category-icon">${CATEGORY_INFO[this.currentCategory].icon}</span>
        <div class="category-info">
          <h3 class="category-name">${CATEGORY_INFO[this.currentCategory].name}</h3>
          <p class="category-description">${CATEGORY_INFO[this.currentCategory].description}</p>
        </div>
        <div class="category-progress">
          <div class="category-progress-bar">
            <div class="category-progress-fill" style="width: ${(unlockedCount / totalCount) * 100}%"></div>
          </div>
          <span class="category-progress-text">${unlockedCount} / ${totalCount}</span>
        </div>
      </div>

      <div class="collection-grid">
        ${this.renderItems(unlocks)}
      </div>
    `;

    // Add event listeners
    this.container.querySelectorAll('.collection-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const category = (tab as HTMLElement).dataset.category as UnlockCategory;
        this.setCategory(category);
      });
    });

    // Item click for locked items to show how to unlock
    this.container.querySelectorAll('.collection-item.locked').forEach((item) => {
      item.addEventListener('click', () => {
        const id = (item as HTMLElement).dataset.id;
        if (id) this.showUnlockHint(id);
      });
    });
  }

  /**
   * Render category tabs
   */
  private renderTabs(): string {
    return Object.entries(CATEGORY_INFO)
      .map(([key, info]) => {
        const isActive = key === this.currentCategory;
        const count = this.getUnlocksForCategory(key as UnlockCategory).filter(
          (u) => UnlockManager.isUnlocked(u.id)
        ).length;
        const total = this.getUnlocksForCategory(key as UnlockCategory).length;

        return `
          <button class="collection-tab ${isActive ? 'active' : ''}" data-category="${key}">
            <span class="tab-icon">${info.icon}</span>
            <span class="tab-name">${info.name}</span>
            <span class="tab-count">${count}/${total}</span>
          </button>
        `;
      })
      .join('');
  }

  /**
   * Render collection items
   */
  private renderItems(unlocks: Unlockable[]): string {
    // Group by tier if category is 'cat'
    if (this.currentCategory === 'cat') {
      return this.renderCatItems(unlocks);
    }

    return unlocks.map((unlock) => this.renderItem(unlock)).join('');
  }

  /**
   * Render cat items grouped by tier
   */
  private renderCatItems(unlocks: Unlockable[]): string {
    const tiers: UnlockTier[] = ['starter', 'breed', 'themed', 'seasonal', 'secret'];
    let html = '';

    for (const tier of tiers) {
      const tierUnlocks = unlocks.filter((u) => u.tier === tier);
      if (tierUnlocks.length === 0) continue;

      const tierInfo = TIER_INFO[tier] || TIER_INFO.starter;
      html += `
        <div class="collection-tier-group">
          <div class="tier-header" style="--tier-color: ${tierInfo.color}">
            <span class="tier-badge">${tierInfo.name}</span>
          </div>
          <div class="tier-items">
            ${tierUnlocks.map((u) => this.renderItem(u)).join('')}
          </div>
        </div>
      `;
    }

    return html;
  }

  /**
   * Render a single collection item
   */
  private renderItem(unlock: Unlockable): string {
    const isUnlocked = UnlockManager.isUnlocked(unlock.id);
    const tier = unlock.tier || 'default';
    const tierInfo = TIER_INFO[tier] || { color: '#6366f1', border: '#4f46e5' };
    const progress = UnlockManager.getProgress(unlock.id, this.stats);

    let progressHtml = '';
    if (!isUnlocked && progress && progress.required > 0) {
      progressHtml = `
        <div class="item-progress">
          <div class="item-progress-bar">
            <div class="item-progress-fill" style="width: ${progress.percent}%"></div>
          </div>
          <span class="item-progress-text">${progress.current} / ${progress.required}</span>
        </div>
      `;
    }

    return `
      <div
        class="collection-item ${isUnlocked ? 'unlocked' : 'locked'}"
        data-id="${unlock.id}"
        style="--item-color: ${tierInfo.color}; --item-border: ${tierInfo.border}"
      >
        <div class="item-icon-wrapper">
          <div class="item-icon">${isUnlocked ? this.getIcon(unlock) : '?'}</div>
          ${!isUnlocked ? '<div class="item-lock">🔒</div>' : ''}
        </div>
        <div class="item-info">
          <h4 class="item-name">${isUnlocked ? unlock.name : '???'}</h4>
          <p class="item-description">${isUnlocked ? unlock.description : this.getConditionText(unlock)}</p>
        </div>
        ${progressHtml}
      </div>
    `;
  }

  /**
   * Get icon for unlock
   */
  private getIcon(unlock: Unlockable): string {
    if (unlock.category === 'cat') return '🐱';
    if (unlock.category === 'town_feature') return '🏠';
    if (unlock.category === 'dungeon') return '🗡️';
    return '⭐';
  }

  /**
   * Get condition text for locked item
   */
  private getConditionText(unlock: Unlockable): string {
    const condition = unlock.condition;
    let template = CONDITION_DISPLAY[condition.type] || 'Unknown condition';

    if (condition.value !== undefined) {
      if (condition.type === 'seasonal') {
        template = template.replace('{month}', MONTH_NAMES[condition.value as number] || 'unknown');
      } else {
        template = template.replace('{value}', String(condition.value));
      }
    }

    return template;
  }

  /**
   * Show unlock hint popup
   */
  private showUnlockHint(id: string): void {
    const unlock = ALL_UNLOCKS.find((u) => u.id === id);
    if (!unlock) return;

    const progress = UnlockManager.getProgress(id, this.stats);
    const progressText = progress
      ? `Progress: ${progress.current} / ${progress.required} (${Math.floor(progress.percent)}%)`
      : '';

    // Create tooltip
    const existing = document.querySelector('.unlock-hint-tooltip');
    if (existing) existing.remove();

    const tooltip = document.createElement('div');
    tooltip.className = 'unlock-hint-tooltip';
    tooltip.innerHTML = `
      <div class="hint-content">
        <h4>How to Unlock</h4>
        <p>${this.getConditionText(unlock)}</p>
        ${progressText ? `<p class="hint-progress">${progressText}</p>` : ''}
      </div>
    `;

    document.body.appendChild(tooltip);

    // Position tooltip
    const rect = this.container.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top + rect.height / 2}px`;

    // Remove after delay
    setTimeout(() => tooltip.remove(), 3000);

    // Remove on click
    tooltip.addEventListener('click', () => tooltip.remove());
  }

  /**
   * Get unlocks for a category
   */
  private getUnlocksForCategory(category: UnlockCategory): Unlockable[] {
    switch (category) {
      case 'cat':
        return CAT_UNLOCKS;
      case 'town_feature':
        return TOWN_UNLOCKS;
      case 'dungeon':
        return DUNGEON_UNLOCKS;
      default:
        return [];
    }
  }

  /**
   * Get total unlocked count
   */
  private getTotalUnlockedCount(): number {
    return ALL_UNLOCKS.filter((u) => UnlockManager.isUnlocked(u.id)).length;
  }

  /**
   * Inject styles
   */
  private injectStyles(): void {
    if (document.getElementById('collection-screen-styles')) return;

    const style = document.createElement('style');
    style.id = 'collection-screen-styles';
    style.textContent = `
      .collection-screen {
        padding: 16px;
        height: 100%;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .collection-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 12px;
        border-bottom: 2px solid var(--sq-border, #4a4a6a);
      }

      .collection-title {
        margin: 0;
        font-size: 20px;
        color: var(--sq-text, #ffffff);
      }

      .collection-progress {
        text-align: right;
      }

      .collection-count {
        display: block;
        font-size: 18px;
        font-weight: bold;
        color: var(--sq-primary, #6366f1);
      }

      .collection-label {
        font-size: 11px;
        color: var(--sq-text-muted, #9ca3af);
      }

      .collection-tabs {
        display: flex;
        gap: 8px;
      }

      .collection-tab {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 10px 8px;
        background: var(--sq-surface, #2a2a4e);
        border: 2px solid var(--sq-border, #4a4a6a);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        color: var(--sq-text, #ffffff);
      }

      .collection-tab:hover {
        background: var(--sq-surface-alt, #3a3a5e);
      }

      .collection-tab.active {
        background: var(--sq-primary, #6366f1);
        border-color: var(--sq-primary, #6366f1);
      }

      .tab-icon {
        font-size: 20px;
      }

      .tab-name {
        font-size: 11px;
        font-weight: 500;
      }

      .tab-count {
        font-size: 10px;
        color: var(--sq-text-muted, #9ca3af);
      }

      .collection-tab.active .tab-count {
        color: rgba(255, 255, 255, 0.8);
      }

      .collection-category-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--sq-surface, #2a2a4e);
        border-radius: 8px;
      }

      .category-icon {
        font-size: 32px;
      }

      .category-info {
        flex: 1;
      }

      .category-name {
        margin: 0 0 4px 0;
        font-size: 16px;
        color: var(--sq-text, #ffffff);
      }

      .category-description {
        margin: 0;
        font-size: 12px;
        color: var(--sq-text-muted, #9ca3af);
      }

      .category-progress {
        text-align: right;
      }

      .category-progress-bar {
        width: 80px;
        height: 6px;
        background: var(--sq-border, #4a4a6a);
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 4px;
      }

      .category-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--sq-primary, #6366f1), #a855f7);
        border-radius: 3px;
        transition: width 0.3s ease;
      }

      .category-progress-text {
        font-size: 11px;
        color: var(--sq-text-muted, #9ca3af);
      }

      .collection-grid {
        display: flex;
        flex-direction: column;
        gap: 16px;
        flex: 1;
      }

      .collection-tier-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .tier-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .tier-badge {
        display: inline-block;
        padding: 4px 12px;
        background: var(--tier-color);
        border-radius: 12px;
        font-size: 11px;
        font-weight: bold;
        color: #000000;
      }

      .tier-items {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 8px;
      }

      .collection-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--sq-surface, #2a2a4e);
        border: 2px solid var(--sq-border, #4a4a6a);
        border-radius: 8px;
        transition: all 0.2s;
      }

      .collection-item.unlocked {
        border-color: var(--item-border);
      }

      .collection-item.unlocked:hover {
        background: var(--sq-surface-alt, #3a3a5e);
        transform: translateY(-2px);
      }

      .collection-item.locked {
        opacity: 0.7;
        cursor: pointer;
      }

      .collection-item.locked:hover {
        opacity: 0.9;
        background: var(--sq-surface-alt, #3a3a5e);
      }

      .item-icon-wrapper {
        position: relative;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--item-color), var(--item-border));
        border-radius: 8px;
      }

      .collection-item.locked .item-icon-wrapper {
        background: var(--sq-border, #4a4a6a);
      }

      .item-icon {
        font-size: 20px;
      }

      .item-lock {
        position: absolute;
        bottom: -4px;
        right: -4px;
        font-size: 12px;
      }

      .item-info {
        flex: 1;
        min-width: 0;
      }

      .item-name {
        margin: 0 0 4px 0;
        font-size: 14px;
        color: var(--sq-text, #ffffff);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .item-description {
        margin: 0;
        font-size: 11px;
        color: var(--sq-text-muted, #9ca3af);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .item-progress {
        width: 60px;
      }

      .item-progress-bar {
        height: 4px;
        background: var(--sq-border, #4a4a6a);
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 2px;
      }

      .item-progress-fill {
        height: 100%;
        background: var(--item-color);
        border-radius: 2px;
      }

      .item-progress-text {
        font-size: 9px;
        color: var(--sq-text-muted, #9ca3af);
        text-align: center;
        display: block;
      }

      .unlock-hint-tooltip {
        position: fixed;
        z-index: 100001;
        transform: translate(-50%, -50%);
        padding: 16px;
        background: var(--sq-surface, #2a2a4e);
        border: 2px solid var(--sq-primary, #6366f1);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        animation: hintAppear 0.2s ease-out;
      }

      @keyframes hintAppear {
        from {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
      }

      .hint-content h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: var(--sq-primary, #6366f1);
      }

      .hint-content p {
        margin: 0;
        font-size: 12px;
        color: var(--sq-text, #ffffff);
      }

      .hint-progress {
        margin-top: 8px !important;
        color: var(--sq-text-muted, #9ca3af) !important;
      }
    `;

    document.head.appendChild(style);
  }
}
