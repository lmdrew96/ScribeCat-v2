/**
 * StudyQuestDungeonHandler
 *
 * Handles dungeon exploration, random events, and dungeon completion for StudyQuest.
 * Includes the random events system for more engaging dungeon runs.
 */

import { createLogger } from '../../../../shared/logger.js';
import type { StudyQuestManager } from '../../../managers/StudyQuestManager.js';
import { DungeonExploreView } from '../DungeonExploreView.js';
import { StudyQuestSound } from '../StudyQuestSound.js';
import type { CatColor } from '../SpriteLoader.js';
import type { DungeonHandlerCallbacks, DungeonCompletionRewards, ViewType } from './types.js';
import { SQ_ICONS, pixelIcon } from './types.js';

const logger = createLogger('StudyQuestDungeonHandler');

// ============================================================================
// Dungeon Event Types (Item 3: Dungeon Random Events)
// ============================================================================

export type DungeonEventType =
  | 'battle'
  | 'treasure'
  | 'trap'
  | 'rest_spot'
  | 'mystery'
  | 'nothing';

export interface DungeonEventChoice {
  text: string;
  risk?: 'safe' | 'risky' | 'dangerous';
  action: () => Promise<void>;
}

export interface DungeonEvent {
  type: DungeonEventType;
  title: string;
  description: string;
  choices: DungeonEventChoice[];
}

// ============================================================================
// Handler
// ============================================================================

export class StudyQuestDungeonHandler {
  private container: HTMLElement;
  private manager: StudyQuestManager;
  private callbacks: DungeonHandlerCallbacks;
  private dungeonExploreView: DungeonExploreView | null = null;
  private dungeonMode: 'explore' | 'classic' = 'explore';
  private dungeonCompletionRewards: DungeonCompletionRewards | null = null;
  private activeEventOverlay: HTMLElement | null = null;

  constructor(
    container: HTMLElement,
    manager: StudyQuestManager,
    callbacks: DungeonHandlerCallbacks
  ) {
    this.container = container;
    this.manager = manager;
    this.callbacks = callbacks;
  }

  /**
   * Get dungeon completion rewards
   */
  getDungeonCompletionRewards(): DungeonCompletionRewards | null {
    return this.dungeonCompletionRewards;
  }

  /**
   * Set dungeon completion rewards
   */
  setDungeonCompletionRewards(rewards: DungeonCompletionRewards | null): void {
    this.dungeonCompletionRewards = rewards;
  }

  /**
   * Get dungeon explore view
   */
  getDungeonExploreView(): DungeonExploreView | null {
    return this.dungeonExploreView;
  }

  /**
   * Load available dungeons
   */
  async loadDungeons(): Promise<void> {
    const list = this.container.querySelector('#dungeon-list');
    if (!list) return;

    const dungeons = await this.manager.loadDungeons();
    const state = this.manager.getState();
    const playerLevel = state.character?.level || 1;

    const dungeonIcons: Record<string, string> = {
      training_grounds: SQ_ICONS.training,
      dark_forest: SQ_ICONS.forest,
      crystal_caves: SQ_ICONS.crystal,
      haunted_library: SQ_ICONS.library,
      dragons_peak: SQ_ICONS.volcano,
      void_realm: SQ_ICONS.void,
    };

    list.innerHTML = dungeons
      .map((dungeon) => {
        const isLocked = playerLevel < dungeon.requiredLevel;
        return `
          <div class="studyquest-dungeon-card ${isLocked ? 'locked' : ''}"
               data-dungeon-id="${dungeon.id}">
            <span class="studyquest-dungeon-icon">${dungeonIcons[dungeon.id] || SQ_ICONS.castle}</span>
            <div class="studyquest-dungeon-info">
              <h3 class="studyquest-dungeon-name">${dungeon.name}</h3>
              <p class="studyquest-dungeon-level">Lv. ${dungeon.requiredLevel}+ (${dungeon.floorCount} floors)</p>
              <p class="studyquest-dungeon-desc">${dungeon.description || ''}</p>
              ${isLocked ? `<p class="studyquest-dungeon-lock">${SQ_ICONS.lock} Requires Level ${dungeon.requiredLevel}</p>` : ''}
            </div>
          </div>
        `;
      })
      .join('');

    // Add dungeon click handlers
    list.querySelectorAll('.studyquest-dungeon-card:not(.locked)').forEach((card) => {
      card.addEventListener('click', async (e) => {
        const dungeonId = (e.currentTarget as HTMLElement).dataset.dungeonId;
        if (dungeonId) {
          const success = await this.manager.startDungeon(dungeonId);
          if (success) {
            this.callbacks.showView('dungeon-run');
          }
        }
      });
    });
  }

  /**
   * Initialize dungeon explore view component
   */
  initializeDungeonExploreView(): void {
    const canvasContainer = this.container.querySelector('#dungeon-canvas-container');
    const classicContainer = this.container.querySelector('#dungeon-run-content');
    const toggleContainer = this.container.querySelector('#dungeon-mode-toggle');

    if (!canvasContainer || !classicContainer || !toggleContainer) return;

    // Create DungeonExploreView with callbacks
    this.dungeonExploreView = new DungeonExploreView({
      onEnemyEncounter: async (enemyData: any, isBoss: boolean) => {
        // Set boss flag via callback to Modal's battleHandler
        this.callbacks.setBattleBossFlag(isBoss);
        const battle = await this.manager.startBattle(isBoss);
        if (battle) {
          this.callbacks.showView('battle');
        }
      },
      onChestOpen: async (lootData: any) => {
        const goldAmount = lootData?.gold || Math.floor(Math.random() * 50) + 10;
        await this.manager.awardGold(goldAmount);
        this.showTreasurePopup(goldAmount);
        this.callbacks.updatePlayerInfo();
        StudyQuestSound.play('item-pickup');
      },
      onTrapTriggered: async (trapData: any) => {
        const damage = trapData?.damage || Math.floor(Math.random() * 10) + 5;
        await this.manager.takeDamage(damage);
        this.callbacks.showToast(`Trap! Took ${damage} damage!`);
        StudyQuestSound.play('damage-taken');
      },
      onMerchantInteract: () => {
        this.callbacks.showView('shop');
      },
      onRestPointUse: async (healPercent: number) => {
        const state = this.manager.getState();
        const char = state.character;
        if (char) {
          const healAmount = Math.floor(char.maxHp * (healPercent / 100));
          await this.manager.healCharacterDirect(healAmount);
          this.callbacks.showToast(`Rested and recovered ${healAmount} HP!`);
          StudyQuestSound.play('heal');
        }
      },
      onFloorExit: () => {
        this.dungeonExploreView?.advanceFloor();
        this.callbacks.showToast('Descending to next floor...');
      },
      onDungeonComplete: async () => {
        const completionResult = await this.manager.completeDungeon();
        if (completionResult) {
          this.dungeonCompletionRewards = completionResult;
        }
        this.dungeonExploreView?.stop();
        this.callbacks.showView('dungeon-complete');
      },
      onFlee: async () => {
        await this.manager.abandonDungeon();
        this.dungeonExploreView?.stop();
        this.callbacks.showView('town');
      },
    });

    // Set cat color
    const savedColor = this.callbacks.getSelectedColor();
    this.dungeonExploreView.setCatColor(savedColor);

    // Mount DungeonExploreView
    canvasContainer.appendChild(this.dungeonExploreView.getElement());

    // Create mode toggle
    const toggle = this.createDungeonModeToggle(
      () => {
        this.dungeonMode = 'explore';
        (canvasContainer as HTMLElement).style.display = 'block';
        (classicContainer as HTMLElement).style.display = 'none';
        this.dungeonExploreView?.start();
      },
      () => {
        this.dungeonMode = 'classic';
        (canvasContainer as HTMLElement).style.display = 'none';
        (classicContainer as HTMLElement).style.display = 'block';
        this.dungeonExploreView?.stop();
        this.renderDungeonRunClassic();
      },
      this.dungeonMode
    );
    toggleContainer.appendChild(toggle);

    logger.info('DungeonExploreView initialized');
  }

  /**
   * Create dungeon mode toggle element
   */
  private createDungeonModeToggle(
    onExplore: () => void,
    onClassic: () => void,
    initialMode: 'explore' | 'classic'
  ): HTMLElement {
    const toggle = document.createElement('div');
    toggle.className = 'dungeon-mode-toggle';
    toggle.innerHTML = `
      <button class="dungeon-mode-btn ${initialMode === 'explore' ? 'active' : ''}" data-mode="explore">
        Explore
      </button>
      <button class="dungeon-mode-btn ${initialMode === 'classic' ? 'active' : ''}" data-mode="classic">
        Classic
      </button>
    `;

    const exploreBtn = toggle.querySelector('[data-mode="explore"]');
    const classicBtn = toggle.querySelector('[data-mode="classic"]');

    exploreBtn?.addEventListener('click', () => {
      exploreBtn.classList.add('active');
      classicBtn?.classList.remove('active');
      onExplore();
    });

    classicBtn?.addEventListener('click', () => {
      classicBtn.classList.add('active');
      exploreBtn?.classList.remove('active');
      onClassic();
    });

    return toggle;
  }

  /**
   * Initialize dungeon run view
   */
  initDungeonRun(): void {
    const state = this.manager.getState();
    const dungeonState = state.dungeonState;
    const nameEl = this.container.querySelector('#dungeon-name');

    if (!dungeonState) {
      this.callbacks.showView('town');
      return;
    }

    // Find dungeon info
    const dungeon = state.dungeons.find((d) => d.id === dungeonState.dungeonId);
    if (nameEl && dungeon) {
      nameEl.textContent = dungeon.name;
    }

    const totalFloors = dungeon?.floorCount || 5;

    // Initialize DungeonExploreView if not already done
    if (!this.dungeonExploreView) {
      this.initializeDungeonExploreView();
    }

    // Set up dungeon in explore view
    if (this.dungeonMode === 'explore' && this.dungeonExploreView) {
      const canvasContainer = this.container.querySelector('#dungeon-canvas-container') as HTMLElement;
      const classicContainer = this.container.querySelector('#dungeon-run-content') as HTMLElement;

      if (canvasContainer) canvasContainer.style.display = 'block';
      if (classicContainer) classicContainer.style.display = 'none';

      // Only initialize dungeon if this is a NEW dungeon run, not resuming from battle
      // Check if we're resuming the same dungeon (already initialized)
      const currentViewState = this.dungeonExploreView.getState();
      const isSameDungeon = currentViewState?.dungeonId === dungeonState.dungeonId;

      if (!currentViewState || !isSameDungeon) {
        // Initialize dungeon in explore view (new dungeon)
        this.dungeonExploreView.initialize(
          dungeonState.dungeonId,
          dungeon?.name || 'Dungeon',
          totalFloors
        );
        logger.info('Initialized new dungeon run');
      } else {
        // Resuming same dungeon - no reinitialization needed
        // NPCs now require explicit interaction (Enter key), so no repositioning needed
        logger.info('Resuming existing dungeon run');
      }

      // Update player HP
      const char = state.character;
      if (char) {
        this.dungeonExploreView.updatePlayerHp(char.hp, char.maxHp);
      }

      this.dungeonExploreView.start();
    } else {
      // Classic mode
      const canvasContainer = this.container.querySelector('#dungeon-canvas-container') as HTMLElement;
      const classicContainer = this.container.querySelector('#dungeon-run-content') as HTMLElement;

      if (canvasContainer) canvasContainer.style.display = 'none';
      if (classicContainer) classicContainer.style.display = 'block';

      this.renderDungeonRunClassic();
    }
  }

  /**
   * Resume dungeon exploration after battle
   */
  resumeDungeonExploration(): void {
    if (this.dungeonMode === 'explore' && this.dungeonExploreView) {
      this.dungeonExploreView.resume();
    }
  }

  /**
   * Render classic dungeon run view (button-based with random events)
   */
  renderDungeonRunClassic(): void {
    const content = this.container.querySelector('#dungeon-run-content');
    const nameEl = this.container.querySelector('#dungeon-name');
    const state = this.manager.getState();
    const dungeonState = state.dungeonState;

    if (!content || !dungeonState) {
      if (content) content.innerHTML = '<p class="studyquest-empty">No active dungeon run</p>';
      return;
    }

    // Find dungeon info
    const dungeon = state.dungeons.find((d) => d.id === dungeonState.dungeonId);
    if (nameEl && dungeon) {
      nameEl.textContent = dungeon.name;
    }

    const totalFloors = dungeon?.floorCount || 5;
    const currentFloor = dungeonState.currentFloor;

    content.innerHTML = `
      <div class="studyquest-dungeon-progress">
        <div class="studyquest-floor-indicator">
          <h3>Floor ${currentFloor} / ${totalFloors}</h3>
          <div class="pixel-bar-container" style="width: 300px; margin: 12px auto;">
            <div class="pixel-bar pixel-bar-xp" style="width: ${(currentFloor / totalFloors) * 100}%;"></div>
          </div>
        </div>

        <div class="studyquest-dungeon-actions" style="display: flex; gap: 16px; justify-content: center; margin-top: 24px;">
          <button class="pixel-btn pixel-btn-primary" id="btn-explore-dungeon">
            ${SQ_ICONS.quest} Explore
          </button>
          ${currentFloor < totalFloors ? `
            <button class="pixel-btn" id="btn-next-floor">
              ${SQ_ICONS.castle} Next Floor
            </button>
          ` : `
            <button class="pixel-btn pixel-btn-success" id="btn-boss-fight">
              ${SQ_ICONS.attack} Boss Battle
            </button>
          `}
        </div>

        <div style="margin-top: 24px; text-align: center;">
          <button class="pixel-btn" id="btn-leave-dungeon">Leave Dungeon</button>
        </div>
      </div>
    `;

    // Attach event listeners
    content.querySelector('#btn-explore-dungeon')?.addEventListener('click', async () => {
      await this.exploreDungeon(currentFloor, dungeon?.id || 'default');
    });

    content.querySelector('#btn-next-floor')?.addEventListener('click', async () => {
      if (this.manager.advanceFloor()) {
        this.renderDungeonRunClassic();
      }
    });

    content.querySelector('#btn-boss-fight')?.addEventListener('click', async () => {
      await this.startBossEncounter();
    });

    content.querySelector('#btn-leave-dungeon')?.addEventListener('click', async () => {
      await this.manager.abandonDungeon();
      this.callbacks.showView('town');
    });
  }

  // ============================================================================
  // Random Events System (Item 3)
  // ============================================================================

  /**
   * Explore dungeon - generate and show random event
   */
  private async exploreDungeon(floor: number, dungeonId: string): Promise<void> {
    const event = this.generateDungeonEvent(floor);
    await this.showDungeonEvent(event);
  }

  /**
   * Generate a random dungeon event
   */
  private generateDungeonEvent(floor: number): DungeonEvent {
    const roll = Math.random() * 100;

    // Weighted probabilities
    if (roll < 40) return this.createBattleEvent();
    if (roll < 55) return this.createTreasureEvent(floor);
    if (roll < 65) return this.createTrapEvent(floor);
    if (roll < 75) return this.createRestSpotEvent();
    if (roll < 85) return this.createMysteryEvent(floor);
    return this.createEmptyEvent();
  }

  /**
   * Create battle event (40%)
   */
  private createBattleEvent(): DungeonEvent {
    return {
      type: 'battle',
      title: `${SQ_ICONS.attack} Enemy Encounter!`,
      description: 'A monster blocks your path. Prepare for battle!',
      choices: [
        {
          text: 'Fight!',
          risk: 'risky',
          action: async () => {
            this.closeEventOverlay();
            const battle = await this.manager.startBattle(false);
            if (battle) {
              this.callbacks.showView('battle');
            }
          }
        },
        {
          text: 'Try to sneak past (50% chance)',
          risk: 'risky',
          action: async () => {
            this.closeEventOverlay();
            if (Math.random() > 0.5) {
              this.callbacks.showToast('You sneak past the enemy!');
              StudyQuestSound.play('flee');
            } else {
              this.callbacks.showToast('You were spotted! Forced to fight!');
              const battle = await this.manager.startBattle(false);
              if (battle) {
                this.callbacks.showView('battle');
              }
            }
          }
        }
      ]
    };
  }

  /**
   * Create treasure event (15%)
   */
  private createTreasureEvent(floor: number): DungeonEvent {
    const goldAmount = 10 + floor * 5 + Math.floor(Math.random() * 20);
    return {
      type: 'treasure',
      title: `${pixelIcon('tuna_coin', 24)} Treasure Found!`,
      description: `You discover a hidden stash containing ${goldAmount} gold!`,
      choices: [
        {
          text: `Take the gold (+${goldAmount}G)`,
          risk: 'safe',
          action: async () => {
            await this.manager.awardGold(goldAmount);
            this.callbacks.showToast(`Found ${goldAmount} gold!`);
            StudyQuestSound.play('item-pickup');
            this.callbacks.updatePlayerInfo();
            this.closeEventOverlay();
          }
        }
      ]
    };
  }

  /**
   * Create trap event (10%)
   */
  private createTrapEvent(floor: number): DungeonEvent {
    const damage = 5 + floor * 2;
    return {
      type: 'trap',
      title: `${pixelIcon('fire', 24)} Trap!`,
      description: 'You triggered a hidden trap!',
      choices: [
        {
          text: `Take the hit (-${damage} HP)`,
          risk: 'dangerous',
          action: async () => {
            await this.manager.takeDamage(damage);
            this.callbacks.showToast(`Trap dealt ${damage} damage!`);
            StudyQuestSound.play('damage-taken');
            this.callbacks.updatePlayerInfo();
            this.closeEventOverlay();
          }
        },
        {
          text: 'Try to dodge (50% chance)',
          risk: 'risky',
          action: async () => {
            if (Math.random() > 0.5) {
              this.callbacks.showToast('You dodged the trap!');
              StudyQuestSound.play('flee');
            } else {
              const extraDamage = Math.floor(damage * 1.5);
              await this.manager.takeDamage(extraDamage);
              this.callbacks.showToast(`Failed to dodge! Took ${extraDamage} damage!`);
              StudyQuestSound.play('damage-taken');
              this.callbacks.updatePlayerInfo();
            }
            this.closeEventOverlay();
          }
        }
      ]
    };
  }

  /**
   * Create rest spot event (10%)
   */
  private createRestSpotEvent(): DungeonEvent {
    return {
      type: 'rest_spot',
      title: `${SQ_ICONS.inn} Safe Haven`,
      description: 'You find a peaceful spot to rest. Recover 25% of your HP!',
      choices: [
        {
          text: 'Rest here',
          risk: 'safe',
          action: async () => {
            const state = this.manager.getState();
            const char = state.character;
            if (char) {
              const healAmount = Math.floor(char.maxHp * 0.25);
              await this.manager.healCharacterDirect(healAmount);
              this.callbacks.showToast(`Rested and recovered ${healAmount} HP!`);
              StudyQuestSound.play('heal');
              this.callbacks.updatePlayerInfo();
            }
            this.closeEventOverlay();
          }
        },
        {
          text: 'Continue exploring',
          risk: 'safe',
          action: async () => {
            this.closeEventOverlay();
          }
        }
      ]
    };
  }

  /**
   * Create mystery event (10%)
   */
  private createMysteryEvent(floor: number): DungeonEvent {
    return {
      type: 'mystery',
      title: `${pixelIcon('magic', 24)} Mysterious Altar`,
      description: 'You find a strange altar with glowing runes. Touch it?',
      choices: [
        {
          text: 'Touch the altar',
          risk: 'risky',
          action: async () => {
            const outcome = Math.random();
            if (outcome < 0.4) {
              // Good outcome - gold
              const gold = 20 + floor * 10;
              await this.manager.awardGold(gold);
              this.callbacks.showToast(`The altar blesses you with ${gold} gold!`);
              StudyQuestSound.play('item-pickup');
            } else if (outcome < 0.7) {
              // Good outcome - heal
              const state = this.manager.getState();
              const char = state.character;
              if (char) {
                const healAmount = Math.floor(char.maxHp * 0.3);
                await this.manager.healCharacterDirect(healAmount);
                this.callbacks.showToast(`The altar heals you for ${healAmount} HP!`);
                StudyQuestSound.play('heal');
              }
            } else {
              // Bad outcome - damage
              const damage = 10 + floor * 2;
              await this.manager.takeDamage(damage);
              this.callbacks.showToast(`The altar curses you! Lost ${damage} HP!`);
              StudyQuestSound.play('damage-taken');
            }
            this.callbacks.updatePlayerInfo();
            this.closeEventOverlay();
          }
        },
        {
          text: 'Leave it alone',
          risk: 'safe',
          action: async () => {
            this.callbacks.showToast('You decide not to risk it.');
            this.closeEventOverlay();
          }
        }
      ]
    };
  }

  /**
   * Create empty event (15%)
   */
  private createEmptyEvent(): DungeonEvent {
    const descriptions = [
      'The corridor is empty. Nothing of interest here.',
      'You find some old cobwebs and dust. Nothing useful.',
      'A cool breeze blows through. The path ahead is clear.',
      'You see some scratches on the walls. Perhaps from a previous adventurer.',
    ];
    return {
      type: 'nothing',
      title: `${pixelIcon('heart_2', 24)} Empty Room`,
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      choices: [
        {
          text: 'Continue',
          risk: 'safe',
          action: async () => {
            this.closeEventOverlay();
          }
        }
      ]
    };
  }

  /**
   * Show dungeon event overlay
   */
  private showDungeonEvent(event: DungeonEvent): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'studyquest-event-overlay';

      const riskColors: Record<string, string> = {
        safe: 'pixel-btn-success',
        risky: 'pixel-btn-warning',
        dangerous: 'pixel-btn-danger',
      };

      overlay.innerHTML = `
        <div class="studyquest-event-card">
          <h3 class="studyquest-event-title">${event.title}</h3>
          <p class="studyquest-event-description">${event.description}</p>
          <div class="studyquest-event-choices">
            ${event.choices.map((choice, i) => `
              <button class="pixel-btn ${riskColors[choice.risk || 'safe'] || ''} studyquest-event-choice"
                      data-choice="${i}">
                ${choice.text}
              </button>
            `).join('')}
          </div>
        </div>
      `;

      this.container.appendChild(overlay);
      this.activeEventOverlay = overlay;

      // Attach choice handlers
      overlay.querySelectorAll('.studyquest-event-choice').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const choiceIndex = parseInt((btn as HTMLElement).dataset.choice || '0', 10);
          const choice = event.choices[choiceIndex];
          if (choice) {
            await choice.action();
            resolve();
          }
        });
      });

      StudyQuestSound.play('menu-select');
    });
  }

  /**
   * Close event overlay
   */
  private closeEventOverlay(): void {
    if (this.activeEventOverlay) {
      this.activeEventOverlay.remove();
      this.activeEventOverlay = null;
    }
  }

  /**
   * Start boss encounter
   */
  private async startBossEncounter(): Promise<void> {
    const battle = await this.manager.startBattle(true);
    if (battle) {
      this.callbacks.showView('battle');
    }
  }

  /**
   * Render dungeon complete screen
   */
  renderDungeonComplete(): void {
    const content = this.container.querySelector('#view-dungeon-complete .studyquest-content') as HTMLElement;
    if (!content) return;

    const rewards = this.dungeonCompletionRewards;
    const state = this.manager.getState();
    const character = state.character;

    if (!rewards || !character) {
      this.callbacks.showView('town');
      return;
    }

    content.innerHTML = `
      <div class="studyquest-dungeon-complete">
        <div class="dungeon-complete-banner">
          <div class="dungeon-complete-icon">${pixelIcon('stars', 64)}</div>
          <h2 class="dungeon-complete-title">DUNGEON COMPLETE!</h2>
          <p class="dungeon-complete-subtitle">${rewards.dungeonName}</p>
        </div>

        <div class="dungeon-complete-rewards pixel-card">
          <h3>Completion Rewards</h3>
          <div class="reward-row">
            <span class="reward-icon">${SQ_ICONS.star}</span>
            <span class="reward-value">+${rewards.xpBonus} XP</span>
          </div>
          <div class="reward-row">
            <span class="reward-icon">${SQ_ICONS.coin}</span>
            <span class="reward-value">+${rewards.goldBonus} Gold</span>
          </div>
        </div>

        <div class="dungeon-complete-stats pixel-card">
          <h3>Character Stats</h3>
          <div class="stat-row">
            <span>Level:</span>
            <span class="stat-value">${character.level}</span>
          </div>
          <div class="stat-row">
            <span>Dungeons Completed:</span>
            <span class="stat-value">${character.dungeonsCompleted}</span>
          </div>
          <div class="stat-row">
            <span>Battles Won:</span>
            <span class="stat-value">${character.battlesWon}</span>
          </div>
        </div>

        <button id="btn-return-to-town" class="pixel-btn pixel-btn-primary" style="margin-top: 24px;">
          ${SQ_ICONS.arrowLeft} Return to Town
        </button>
      </div>
    `;

    content.querySelector('#btn-return-to-town')?.addEventListener('click', () => {
      this.dungeonCompletionRewards = null;
      this.callbacks.showView('town');
    });
  }

  /**
   * Show animated treasure popup when opening chests
   */
  private showTreasurePopup(goldAmount: number): void {
    const popup = document.createElement('div');
    popup.className = 'studyquest-treasure-popup';
    popup.innerHTML = `
      <div class="treasure-popup-content">
        <div class="treasure-icon">${pixelIcon('tuna_coin', 48)}</div>
        <div class="treasure-amount">+${goldAmount} Gold!</div>
      </div>
    `;

    this.container.appendChild(popup);

    // Remove after animation completes
    setTimeout(() => popup.remove(), 2000);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.closeEventOverlay();
    this.dungeonExploreView?.stop();
    this.dungeonExploreView = null;
    this.dungeonCompletionRewards = null;
  }
}
