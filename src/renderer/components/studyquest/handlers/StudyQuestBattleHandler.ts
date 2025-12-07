/**
 * StudyQuestBattleHandler
 *
 * Handles all battle-related UI and interactions for StudyQuest.
 * Extracted from StudyQuestModal for better maintainability.
 *
 * Includes:
 * - Item 13: Boss Introduction Screen
 * - Item 15: Victory/Defeat Overlay Screens
 */

import { createLogger } from '../../../../shared/logger.js';
import type { StudyQuestManager } from '../../../managers/StudyQuestManager.js';
import type { StudyQuestBattleData, BattleLogEntry } from '../../../../domain/entities/StudyQuestBattle.js';
import { BattleCanvas } from '../BattleCanvas.js';
import { StudyQuestSound } from '../StudyQuestSound.js';
import type { CatColor } from '../SpriteLoader.js';
import type { ViewType, BattleHandlerCallbacks, DungeonCompletionRewards, SQ_ICONS as SQ_ICONS_TYPE } from './types.js';
import { SQ_ICONS } from './types.js';

const logger = createLogger('StudyQuestBattleHandler');

export class StudyQuestBattleHandler {
  private container: HTMLElement;
  private manager: StudyQuestManager;
  private callbacks: BattleHandlerCallbacks;
  private battleCanvas: BattleCanvas | null = null;
  private isBattleProcessing = false;
  private isCurrentBattleBoss = false;
  private selectedColor: CatColor = 'brown';

  constructor(
    container: HTMLElement,
    manager: StudyQuestManager,
    callbacks: BattleHandlerCallbacks
  ) {
    this.container = container;
    this.manager = manager;
    this.callbacks = callbacks;
  }

  /**
   * Set the selected cat color for battle
   */
  setSelectedColor(color: CatColor): void {
    this.selectedColor = color;
  }

  /**
   * Get current boss battle flag
   */
  getIsCurrentBattleBoss(): boolean {
    return this.isCurrentBattleBoss;
  }

  /**
   * Set boss battle flag
   */
  setIsCurrentBattleBoss(isBoss: boolean): void {
    this.isCurrentBattleBoss = isBoss;
  }

  /**
   * Get the battle canvas instance
   */
  getBattleCanvas(): BattleCanvas | null {
    return this.battleCanvas;
  }

  /**
   * Initialize battle view
   */
  initBattle(): void {
    const state = this.manager.getState();
    const battle = state.currentBattle;
    const character = state.character;

    if (!battle || !character) {
      logger.warn('No active battle to display');
      this.callbacks.showView('dungeon-run');
      return;
    }

    // Reset panel display states (fix for items panel persisting across battles)
    const actionsPanel = this.container.querySelector('#battle-actions') as HTMLElement;
    const itemsPanel = this.container.querySelector('#battle-items') as HTMLElement;
    if (actionsPanel) actionsPanel.style.display = 'grid';
    if (itemsPanel) itemsPanel.style.display = 'none';

    // Initialize canvas
    const canvas = this.container.querySelector('#battle-canvas') as HTMLCanvasElement;
    if (canvas) {
      if (!this.battleCanvas) {
        this.battleCanvas = new BattleCanvas(canvas);
      }
      // Load saved color or use default
      const savedColor = localStorage.getItem('studyquest-cat-color') as CatColor | null;
      const playerColor = savedColor || this.selectedColor;
      this.battleCanvas.setBattle(battle, playerColor);
    }

    // Clear battle log
    this.clearBattleLog();
    this.addBattleLogEntry(`A wild ${battle.enemy.name} appears!`);

    // Update action buttons state - player always goes first
    this.updateBattleActionButtons(true);
  }

  /**
   * Handle battle action
   */
  async handleBattleAction(action: string): Promise<void> {
    if (this.isBattleProcessing) return;

    const state = this.manager.getState();
    if (!state.currentBattle || state.currentBattle.result !== 'in_progress') {
      return;
    }

    if (state.currentBattle.currentTurn !== 'player') {
      logger.warn('Not player turn');
      return;
    }

    this.isBattleProcessing = true;
    this.updateBattleActionButtons(false);

    logger.info(`Battle action: ${action}`);

    try {
      let result: {
        battle: StudyQuestBattleData;
        playerLog: BattleLogEntry;
        enemyLog: BattleLogEntry | null;
      } | null = null;

      switch (action) {
        case 'attack':
          result = await this.manager.battleAction('attack');
          break;
        case 'defend':
          result = await this.manager.battleAction('defend');
          break;
        case 'item':
          // Show item selection panel
          this.isBattleProcessing = false;
          this.showBattleItems();
          return;
        case 'flee':
          result = await this.manager.battleAction('flee');
          break;
      }

      if (result) {
        // Update canvas
        this.battleCanvas?.updateBattle(result.battle);

        // Show player action result
        await this.handleBattleLogEntry(result.playerLog);

        // Check if battle ended after player action
        if (result.battle.result !== 'in_progress') {
          await this.handleBattleEnd(result.battle);
          return;
        }

        // Show enemy action if there was one
        if (result.enemyLog) {
          // Delay enemy action display for better UX
          setTimeout(async () => {
            if (result.enemyLog) {
              await this.handleBattleLogEntry(result.enemyLog);
            }

            // Check if battle ended after enemy action
            if (result.battle.result !== 'in_progress') {
              await this.handleBattleEnd(result.battle);
            } else {
              // Back to player turn
              this.isBattleProcessing = false;
              this.updateBattleActionButtons(true);
            }
          }, 800);
        } else {
          // No enemy turn (battle might have ended from player action)
          this.isBattleProcessing = false;
          this.updateBattleActionButtons(true);
        }
      } else {
        this.isBattleProcessing = false;
        this.updateBattleActionButtons(true);
      }
    } catch (error) {
      logger.error('Battle action error:', error);
      this.isBattleProcessing = false;
      // Ensure panel states are reset on error
      const actionsPanel = this.container.querySelector('#battle-actions') as HTMLElement;
      const itemsPanel = this.container.querySelector('#battle-items') as HTMLElement;
      if (actionsPanel) actionsPanel.style.display = 'grid';
      if (itemsPanel) itemsPanel.style.display = 'none';
      this.updateBattleActionButtons(true);
    }
  }

  /**
   * Handle battle log entry display
   */
  private async handleBattleLogEntry(entry: BattleLogEntry): Promise<void> {
    const target = entry.actor === 'player' ? 'enemy' : 'player';

    if (entry.action === 'attack' && entry.damage) {
      // Play attack sequence: attack animation THEN damage animation
      await this.battleCanvas?.playAttackSequence(entry.actor, entry.damage, entry.isCritical || false);
      const type = entry.isCritical ? 'crit' : 'damage';
      this.addBattleLogEntry(entry.message, type);
      // Play appropriate attack sound
      if (entry.isCritical) {
        StudyQuestSound.play('attack-crit');
      } else {
        StudyQuestSound.play('attack-hit');
      }
      // Play damage sound if player was hit
      if (entry.actor === 'enemy') {
        setTimeout(() => StudyQuestSound.play('damage-taken'), 100);
      }
    } else if (entry.action === 'attack' && !entry.damage) {
      // Attack missed - still play attack animation
      this.battleCanvas?.playAttackAnimation(entry.actor);
      await new Promise(resolve => setTimeout(resolve, 300));
      this.battleCanvas?.playMissAnimation(target);
      this.addBattleLogEntry(entry.message, 'miss');
      StudyQuestSound.play('attack-miss');
    } else if (entry.action === 'defend' && entry.healing) {
      this.battleCanvas?.playHealAnimation(entry.actor, entry.healing);
      this.addBattleLogEntry(entry.message, 'heal');
      StudyQuestSound.play('defend');
      if (entry.healing > 0) {
        setTimeout(() => StudyQuestSound.play('heal'), 200);
      }
    } else if (entry.action === 'flee') {
      const failed = entry.message.includes('failed');
      this.addBattleLogEntry(entry.message, failed ? 'miss' : 'info');
      if (failed) {
        StudyQuestSound.play('error');
      } else {
        StudyQuestSound.play('flee');
      }
    } else if (entry.action === 'item' && entry.healing) {
      this.battleCanvas?.playHealAnimation(entry.actor, entry.healing);
      this.addBattleLogEntry(entry.message, 'heal');
      StudyQuestSound.play('heal');
    } else {
      this.addBattleLogEntry(entry.message);
    }
  }

  /**
   * Handle battle end
   */
  private async handleBattleEnd(battle: StudyQuestBattleData): Promise<void> {
    this.updateBattleActionButtons(false);

    // Check if this was a boss victory on final floor (dungeon complete!)
    const isBossVictoryOnFinalFloor =
      battle.result === 'victory' &&
      this.isCurrentBattleBoss &&
      this.manager.isOnFinalFloor();

    if (battle.result === 'victory') {
      // Play death animation for enemy before victory fanfare
      await this.battleCanvas?.playDeathAnimation('enemy');

      StudyQuestSound.play('victory');
      this.addBattleLogEntry('VICTORY!', 'crit');
      if (battle.rewards) {
        this.addBattleLogEntry(`+${battle.rewards.xp} XP, +${battle.rewards.gold} Gold`, 'heal');
        setTimeout(() => StudyQuestSound.play('item-pickup'), 500);
      }

      if (isBossVictoryOnFinalFloor) {
        this.addBattleLogEntry('DUNGEON COMPLETE!', 'crit');
      }

      // Item 15: Show victory overlay screen
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.showVictoryOverlay(battle);
    } else if (battle.result === 'defeat') {
      // Play death animation for player before defeat message
      await this.battleCanvas?.playDeathAnimation('player');

      StudyQuestSound.play('defeat');
      this.addBattleLogEntry('DEFEAT...', 'damage');
      this.addBattleLogEntry('Lost 25% gold. Returning to town...', 'miss');

      // Item 15: Show defeat overlay screen
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.showDefeatOverlay(battle);
    } else if (battle.result === 'fled') {
      // Flee sound already played in handleBattleLogEntry
      this.addBattleLogEntry('Escaped successfully!', 'info');
      // Brief delay before resuming
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Cleanup and return to appropriate view
    this.battleCanvas?.clear();
    this.isBattleProcessing = false;
    this.isCurrentBattleBoss = false;

    // Clear battle state in manager (we're done rendering)
    this.manager.clearBattle();

    if (battle.result === 'defeat') {
      this.callbacks.getDungeonExploreView()?.stop();
      this.callbacks.showView('town');
    } else if (isBossVictoryOnFinalFloor) {
      // Complete the dungeon and show completion screen
      this.callbacks.getDungeonExploreView()?.stop();
      const completionResult = await this.manager.completeDungeon();
      if (completionResult) {
        this.callbacks.setDungeonCompletionRewards(completionResult);
      }
      this.callbacks.showView('dungeon-complete');
    } else {
      // Resume exploration after victory or flee
      this.callbacks.showView('dungeon-run');
      this.callbacks.resumeDungeonExploration();
    }
  }

  /**
   * Update battle action buttons enabled state
   */
  updateBattleActionButtons(enabled: boolean): void {
    this.container.querySelectorAll('.studyquest-battle-action').forEach((btn) => {
      (btn as HTMLButtonElement).disabled = !enabled;
    });
  }

  /**
   * Show item selection panel in battle
   */
  showBattleItems(): void {
    const actionsPanel = this.container.querySelector('#battle-actions') as HTMLElement;
    const itemsPanel = this.container.querySelector('#battle-items') as HTMLElement;
    const itemsGrid = this.container.querySelector('#battle-items-grid') as HTMLElement;

    if (!itemsPanel || !actionsPanel || !itemsGrid) {
      // Elements not found - show error and restore button state
      logger.warn('Battle items panel elements not found');
      this.addBattleLogEntry('Item menu unavailable!', 'miss');
      // Explicitly ensure actions panel is visible if it exists
      if (actionsPanel) actionsPanel.style.display = 'grid';
      if (itemsPanel) itemsPanel.style.display = 'none';
      this.updateBattleActionButtons(true);
      return;
    }

    // Get consumable items
    const consumables = this.manager.getConsumableItems();

    if (consumables.length === 0) {
      this.addBattleLogEntry('No items available!', 'miss');
      // Ensure actions panel is visible and re-enable buttons
      actionsPanel.style.display = 'grid';
      itemsPanel.style.display = 'none';
      this.updateBattleActionButtons(true);
      return;
    }

    // Render items
    itemsGrid.innerHTML = consumables
      .map(
        (slot) => `
        <button class="studyquest-battle-item-btn" data-item-id="${slot.item.id}" title="${slot.item.description || slot.item.name}">
          <span class="item-icon">${slot.item.icon || SQ_ICONS.potion}</span>
          <span class="item-name">${slot.item.name}</span>
          <span class="item-qty">x${slot.quantity}</span>
          ${slot.item.healAmount ? `<span class="item-effect">+${slot.item.healAmount} HP</span>` : ''}
        </button>
      `
      )
      .join('');

    // Add click handlers
    itemsGrid.querySelectorAll('.studyquest-battle-item-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const itemId = (btn as HTMLElement).dataset.itemId;
        if (itemId) {
          await this.useItemInBattle(itemId);
        }
      });
    });

    // Show items panel, hide actions
    // Use 'flex' to match the CSS definition for .studyquest-battle-items
    actionsPanel.style.display = 'none';
    itemsPanel.style.display = 'flex';
  }

  /**
   * Hide item selection panel and show action buttons
   */
  hideBattleItems(): void {
    const actionsPanel = this.container.querySelector('#battle-actions') as HTMLElement;
    const itemsPanel = this.container.querySelector('#battle-items') as HTMLElement;

    if (actionsPanel) actionsPanel.style.display = 'grid';
    if (itemsPanel) itemsPanel.style.display = 'none';

    // Re-enable action buttons when returning from items panel
    this.updateBattleActionButtons(true);
  }

  /**
   * Use an item in battle
   */
  private async useItemInBattle(itemId: string): Promise<void> {
    this.hideBattleItems();
    this.isBattleProcessing = true;
    this.updateBattleActionButtons(false);

    const result = await this.manager.useItemInBattle(itemId);

    if (!result || !result.success) {
      this.addBattleLogEntry('Failed to use item!', 'miss');
      this.isBattleProcessing = false;
      this.updateBattleActionButtons(true);
      return;
    }

    // Update canvas with new battle state
    if (result.battle) {
      this.battleCanvas?.updateBattle(result.battle);
    }

    // Show player action (item use)
    if (result.playerLog) {
      await this.handleBattleLogEntry(result.playerLog);
    }

    // Check if battle ended after player action
    if (result.battle && result.battle.result !== 'in_progress') {
      await this.handleBattleEnd(result.battle);
      this.isBattleProcessing = false;
      return;
    }

    // Show enemy action if there was one
    if (result.enemyLog) {
      // Delay enemy action display for better UX
      await new Promise(resolve => setTimeout(resolve, 800));
      await this.handleBattleLogEntry(result.enemyLog);

      // Check if battle ended after enemy action
      if (result.battle && result.battle.result !== 'in_progress') {
        await this.handleBattleEnd(result.battle);
        this.isBattleProcessing = false;
        return;
      }
    }

    // Back to player turn
    this.isBattleProcessing = false;
    this.updateBattleActionButtons(true);
  }

  /**
   * Add entry to battle log
   */
  addBattleLogEntry(message: string, type?: string): void {
    const log = this.container.querySelector('#battle-log');
    if (!log) return;

    const entry = document.createElement('div');
    entry.className = `studyquest-battle-log-entry${type ? ` ${type}` : ''}`;
    entry.textContent = message;
    log.appendChild(entry);

    // Scroll to bottom
    log.scrollTop = log.scrollHeight;
  }

  /**
   * Clear battle log
   */
  clearBattleLog(): void {
    const log = this.container.querySelector('#battle-log');
    if (log) {
      log.innerHTML = '';
    }
  }

  /**
   * Start a battle encounter
   */
  async startEncounter(isBoss: boolean): Promise<void> {
    this.isCurrentBattleBoss = isBoss;
    const battle = await this.manager.startBattle(isBoss);
    if (battle) {
      // Item 13: Show boss intro screen for boss battles
      if (isBoss) {
        await this.showBossIntro(battle);
      }
      this.callbacks.showView('battle');
    }
  }

  // ============================================================================
  // Item 13: Boss Introduction Screen
  // ============================================================================

  /**
   * Show boss introduction screen with dramatic reveal
   */
  private showBossIntro(battle: StudyQuestBattleData): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'studyquest-boss-intro';
      overlay.innerHTML = `
        <div class="boss-intro-warning">⚠ WARNING ⚠</div>
        <div class="boss-intro-sprite">
          <canvas id="boss-intro-canvas" width="128" height="128"></canvas>
        </div>
        <h2 class="boss-intro-name">${battle.enemy.name}</h2>
        <p class="boss-intro-title">Floor Guardian</p>
        <div class="boss-intro-stats">
          <div class="boss-stat">
            <div class="stat-icon">${SQ_ICONS.hp}</div>
            <div class="stat-value">${battle.enemy.hp}</div>
            <div class="stat-label">HP</div>
          </div>
          <div class="boss-stat">
            <div class="stat-icon">${SQ_ICONS.atk}</div>
            <div class="stat-value">${battle.enemy.attack}</div>
            <div class="stat-label">ATK</div>
          </div>
          <div class="boss-stat">
            <div class="stat-icon">${SQ_ICONS.def}</div>
            <div class="stat-value">${battle.enemy.defense}</div>
            <div class="stat-label">DEF</div>
          </div>
        </div>
        <p class="boss-intro-continue">Press any key or click to continue...</p>
      `;

      document.body.appendChild(overlay);

      // Play boss music/sound
      StudyQuestSound.play('boss-appear');

      const dismiss = () => {
        overlay.remove();
        document.removeEventListener('keydown', dismiss);
        document.removeEventListener('click', dismiss);
        resolve();
      };

      // Auto-dismiss after 4 seconds
      setTimeout(dismiss, 4000);

      // Allow early dismiss
      setTimeout(() => {
        document.addEventListener('keydown', dismiss, { once: true });
        document.addEventListener('click', dismiss, { once: true });
      }, 500);
    });
  }

  // ============================================================================
  // Item 15: Victory/Defeat Overlay Screens
  // ============================================================================

  /**
   * Show victory overlay screen
   */
  private showVictoryOverlay(battle: StudyQuestBattleData): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'studyquest-battle-result-overlay victory';

      const xpReward = battle.rewards?.xp || 0;
      const goldReward = battle.rewards?.gold || 0;

      overlay.innerHTML = `
        <div class="victory-banner">
          <h1 class="victory-title">VICTORY!</h1>
        </div>
        <div class="victory-rewards">
          <div class="victory-reward">
            <span class="reward-icon">${SQ_ICONS.xp}</span>
            <span class="reward-value">+${xpReward}</span>
            <span class="reward-label">Experience</span>
          </div>
          <div class="victory-reward">
            <span class="reward-icon">${SQ_ICONS.gold}</span>
            <span class="reward-value">+${goldReward}</span>
            <span class="reward-label">Gold</span>
          </div>
        </div>
        <p class="victory-continue">Click to continue...</p>
      `;

      document.body.appendChild(overlay);

      const dismiss = () => {
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.remove();
          resolve();
        }, 300);
      };

      // Auto-dismiss after 3 seconds
      setTimeout(dismiss, 3000);

      // Allow early dismiss after 1 second
      setTimeout(() => {
        overlay.addEventListener('click', dismiss, { once: true });
        document.addEventListener('keydown', dismiss, { once: true });
      }, 1000);
    });
  }

  /**
   * Show defeat overlay screen
   */
  private showDefeatOverlay(battle: StudyQuestBattleData): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'studyquest-battle-result-overlay defeat';

      // Calculate gold lost (25%)
      const state = this.manager.getState();
      const goldLost = Math.floor((state.character?.gold || 0) * 0.25);

      overlay.innerHTML = `
        <div class="defeat-banner">
          <h1 class="defeat-title">DEFEAT</h1>
        </div>
        <p class="defeat-message">You have been defeated by ${battle.enemy.name}...</p>
        <div class="defeat-lost">
          <div class="defeat-lost-item">
            <span class="lost-value">-${goldLost}</span>
            <span class="lost-label">Gold Lost</span>
          </div>
        </div>
        <div class="defeat-actions">
          <button class="pixel-btn" id="defeat-continue">Return to Town</button>
        </div>
      `;

      document.body.appendChild(overlay);

      const continueBtn = overlay.querySelector('#defeat-continue');
      const dismiss = () => {
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.remove();
          resolve();
        }, 300);
      };

      continueBtn?.addEventListener('click', dismiss);

      // Auto-dismiss after 5 seconds
      setTimeout(dismiss, 5000);
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.battleCanvas?.clear();
    this.battleCanvas = null;
    this.isBattleProcessing = false;
    this.isCurrentBattleBoss = false;
  }
}
