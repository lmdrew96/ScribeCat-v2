/**
 * StudyQuestModal
 *
 * Main container for the StudyQuest RPG mini-game.
 * Manages view switching between title screen, character creation,
 * town hub, dungeons, battles, shop, quests, and leaderboard.
 *
 * REFACTORED: Logic delegated to handlers in ./studyquest/handlers/
 */

import { createLogger } from '../../shared/logger.js';
import type { StudyQuestManager, StudyQuestState } from '../managers/StudyQuestManager.js';
import type { StudyQuestCharacterData } from '../../domain/entities/StudyQuestCharacter.js';
import { getXpRequiredForLevel } from '../../domain/entities/StudyQuestCharacter.js';
import { TownView, createTownModeToggle } from './studyquest/TownView.js';
import { CollectionScreen } from './studyquest/CollectionScreen.js';
import { unlockCelebration } from './studyquest/UnlockCelebration.js';
import { UnlockManager } from '../canvas/UnlockManager.js';
import { PlayerStatsService } from '../canvas/PlayerStatsService.js';
import type { CatColor } from './studyquest/SpriteLoader.js';
import { StudyQuestSound } from './studyquest/StudyQuestSound.js';
import { getSettingsPanel } from './studyquest/StudyQuestSettingsPanel.js';
import { themeManager } from './studyquest/StudyQuestThemeManager.js';
import { spriteRenderer } from './studyquest/StudyQuestSpriteRenderer.js';

// Import handlers
import {
  StudyQuestBattleHandler,
  StudyQuestInventoryHandler,
  StudyQuestShopHandler,
  StudyQuestDungeonHandler,
  StudyQuestCharacterHandler,
  SQ_ICONS,
  pixelIcon,
  type ViewType,
  type DungeonCompletionRewards,
} from './studyquest/handlers/index.js';

// Available cat colors for character creation
const CAT_COLORS: { id: CatColor; name: string; hex: string }[] = [
  { id: 'brown', name: 'Brown', hex: '#8B4513' },
  { id: 'orange', name: 'Orange', hex: '#FF8C00' },
  { id: 'grey', name: 'Grey', hex: '#708090' },
  { id: 'black', name: 'Black', hex: '#2F2F2F' },
  { id: 'white', name: 'White', hex: '#F5F5F5' },
];

const logger = createLogger('StudyQuestModal');

export class StudyQuestModal {
  private manager: StudyQuestManager;
  private container: HTMLElement | null = null;
  private backdrop: HTMLElement | null = null;
  private currentView: ViewType = 'title';
  private isOpen = false;
  private unsubscribe: (() => void) | null = null;
  private townView: TownView | null = null;
  private collectionScreen: CollectionScreen | null = null;
  private townMode: 'canvas' | 'cards' = 'canvas';
  private themeUnsubscribe: (() => void) | null = null;

  // Handlers
  private battleHandler: StudyQuestBattleHandler | null = null;
  private inventoryHandler: StudyQuestInventoryHandler | null = null;
  private shopHandler: StudyQuestShopHandler | null = null;
  private dungeonHandler: StudyQuestDungeonHandler | null = null;
  private characterHandler: StudyQuestCharacterHandler | null = null;

  constructor(manager: StudyQuestManager) {
    this.manager = manager;
    logger.info('StudyQuestModal initialized');
  }

  /**
   * Initialize the modal - create DOM elements
   */
  public initialize(): void {
    this.createModal();
    this.initializeHandlers();
    this.attachEventListeners();
    this.initializeDebugCommands();
    logger.info('StudyQuestModal DOM created');
  }

  /**
   * Initialize all handlers
   */
  private initializeHandlers(): void {
    if (!this.container) return;

    const baseCallbacks = {
      showView: (view: ViewType) => this.showView(view),
      showToast: (msg: string) => this.showToast(msg),
      showConfirmDialog: (title: string, msg: string) => this.showConfirmDialog(title, msg),
      updatePlayerInfo: () => this.updatePlayerInfo(this.manager.getState().character),
    };

    // Battle handler
    this.battleHandler = new StudyQuestBattleHandler(this.container, this.manager, {
      ...baseCallbacks,
      resumeDungeonExploration: () => this.dungeonHandler?.resumeDungeonExploration(),
      getDungeonExploreView: () => this.dungeonHandler?.getDungeonExploreView() || null,
      setDungeonCompletionRewards: (rewards) => this.dungeonHandler?.setDungeonCompletionRewards(rewards),
    });

    // Inventory handler
    this.inventoryHandler = new StudyQuestInventoryHandler(this.container, this.manager, {
      ...baseCallbacks,
      refreshInventory: async () => this.inventoryHandler?.loadInventory(),
    });

    // Shop handler
    this.shopHandler = new StudyQuestShopHandler(this.container, this.manager, baseCallbacks);

    // Dungeon handler
    this.dungeonHandler = new StudyQuestDungeonHandler(this.container, this.manager, {
      ...baseCallbacks,
      getDungeonExploreView: () => this.dungeonHandler?.getDungeonExploreView() || null,
      setDungeonExploreView: () => {}, // Managed internally
      getBattleCanvas: () => this.battleHandler?.getBattleCanvas() || null,
      getSelectedColor: () => this.characterHandler?.getSelectedColor() || 'brown',
      setBattleBossFlag: (isBoss: boolean) => this.battleHandler?.setIsCurrentBattleBoss(isBoss),
    });

    // Character handler
    this.characterHandler = new StudyQuestCharacterHandler(this.container, this.manager, {
      ...baseCallbacks,
      getSelectedColor: () => this.characterHandler?.getSelectedColor() || 'brown',
      setSelectedColor: (color) => this.characterHandler?.setSelectedColor(color),
    });

    logger.info('Handlers initialized');
  }

  /**
   * Initialize debug commands on window.debugStudyQuest
   */
  private initializeDebugCommands(): void {
    const win = window as unknown as {
      debugStudyQuest?: {
        forceUnlock: (id: string) => void;
        resetUnlocks: () => void;
        setStats: (stats: any) => void;
        celebrateUnlock: (id: string) => void;
        listUnlocks: () => void;
        getStats: () => ReturnType<typeof PlayerStatsService.getStats>;
        unlockAll: () => void;
      };
    };

    win.debugStudyQuest = {
      forceUnlock: (id: string) => {
        UnlockManager.forceUnlock(id);
        logger.info(`[DEBUG] Force unlocked: ${id}`);
      },
      resetUnlocks: () => {
        UnlockManager.reset();
        logger.info('[DEBUG] All unlocks reset');
      },
      setStats: (stats) => {
        PlayerStatsService.update(stats);
        logger.info('[DEBUG] Stats updated:', stats);
      },
      celebrateUnlock: (id: string) => {
        UnlockManager.forceUnlock(id);
        const unlocks = UnlockManager.getNewUnlocks();
        if (unlocks.length > 0) {
          unlockCelebration.show(unlocks);
        } else {
          const allUnlocks = UnlockManager.getAllWithStatus();
          const unlock = allUnlocks.find((u) => u.id === id);
          if (unlock) {
            unlockCelebration.show([unlock]);
          }
        }
        logger.info(`[DEBUG] Celebration triggered for: ${id}`);
      },
      listUnlocks: () => {
        const allUnlocks = UnlockManager.getAllWithStatus();
        console.log('=== All Unlocks ===');
        for (const unlock of allUnlocks) {
          const status = unlock.unlocked ? '✓' : '✗';
          console.log(`[${status}] ${unlock.id} - ${unlock.name} (${unlock.category})`);
        }
      },
      getStats: () => {
        const stats = PlayerStatsService.getStats();
        console.log('=== Player Stats ===', stats);
        return stats;
      },
      unlockAll: () => {
        const allUnlocks = UnlockManager.getAllWithStatus();
        for (const unlock of allUnlocks) {
          if (!unlock.unlocked) {
            UnlockManager.forceUnlock(unlock.id);
          }
        }
        logger.info('[DEBUG] All items unlocked');
      },
    };

    logger.info('Debug commands initialized on window.debugStudyQuest');
  }

  /**
   * Open the StudyQuest modal
   */
  public async open(): Promise<void> {
    if (this.isOpen) return;

    this.isOpen = true;
    this.backdrop?.classList.add('active');
    this.container?.classList.add('active');

    // Initialize theme manager with container
    if (this.container) {
      await themeManager.initialize(this.container);
      await this.applySpritesToUI();
      this.themeUnsubscribe = themeManager.subscribe(() => {
        this.applySpritesToUI();
      });
    }

    // Subscribe to state changes
    this.unsubscribe = this.manager.subscribe((state) => this.onStateChange(state));

    // Load character data
    await this.manager.loadCharacter();

    // Determine starting view
    const state = this.manager.getState();
    if (state.character) {
      this.showView('town');
    } else {
      this.showView('title');
    }

    logger.info('StudyQuest opened');
  }

  /**
   * Close the StudyQuest modal
   */
  public close(): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.backdrop?.classList.remove('active');
    this.container?.classList.remove('active');

    // Stop canvas animations
    this.townView?.stop();

    // Cleanup handlers
    this.battleHandler?.cleanup();
    this.inventoryHandler?.cleanup();
    this.dungeonHandler?.cleanup();
    this.characterHandler?.cleanup();

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.themeUnsubscribe) {
      this.themeUnsubscribe();
      this.themeUnsubscribe = null;
    }

    logger.info('StudyQuest closed');
  }

  /**
   * Toggle open/close
   */
  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Check if modal is open
   */
  public isVisible(): boolean {
    return this.isOpen;
  }

  /**
   * Apply theme styling to UI elements
   */
  private async applySpritesToUI(): Promise<void> {
    if (!this.container) return;

    const theme = themeManager.getTheme();
    const sprites = theme.sprites;
    const spriteSheet = theme.spriteSheet;

    // For themes with no sprite sheet but with direct images (like Kenney theme)
    // we can still apply sprites via themeManager which handles both approaches
    if (!sprites) {
      this.clearSpriteStyles();
      return;
    }

    // Load sprite sheet if using traditional sprite-based theme
    if (spriteSheet) {
      try {
        await spriteRenderer.loadSpriteSheet(spriteSheet);
      } catch (error) {
        logger.warn('Failed to load sprite sheet, using CSS fallback:', error);
        // Don't return - the theme might still have direct images
      }
    }

    // Apply theme to town location cards (buildings)
    this.container.querySelectorAll('.studyquest-town-building').forEach((el) => {
      themeManager.applyThemeToElement(el as HTMLElement, 'panelMedium');
    });

    // Apply theme to class/session cards
    this.container.querySelectorAll('.studyquest-class-card').forEach((el) => {
      themeManager.applyThemeToElement(el as HTMLElement, 'panelSmall');
    });

    // Apply theme to dungeon cards
    this.container.querySelectorAll('.studyquest-dungeon-card').forEach((el) => {
      themeManager.applyThemeToElement(el as HTMLElement, 'panelMedium');
    });

    // Apply theme to quest cards
    this.container.querySelectorAll('.studyquest-quest-card').forEach((el) => {
      themeManager.applyThemeToElement(el as HTMLElement, 'panelMedium');
    });

    // Apply theme to shop items
    this.container.querySelectorAll('.studyquest-shop-item').forEach((el) => {
      themeManager.applyThemeToElement(el as HTMLElement, 'panelSmall');
    });

    // Apply theme to inventory slots
    this.container.querySelectorAll('.studyquest-inventory-slot').forEach((el) => {
      themeManager.applyThemeToElement(el as HTMLElement, 'inventorySlot');
    });

    logger.info(`Theme applied: ${theme.name}`);
  }

  /**
   * Clear sprite styling (for default CSS theme)
   */
  private clearSpriteStyles(): void {
    if (!this.container) return;

    const clearElement = (el: HTMLElement) => {
      el.style.backgroundImage = '';
      el.style.backgroundPosition = '';
      el.style.backgroundSize = '';
      el.style.backgroundRepeat = '';
      el.classList.remove('sq-sprite-btn');
    };

    const selectors = [
      '.pixel-btn', '.pixel-btn-success', '.studyquest-town-building',
      '.studyquest-class-card', '.pixel-card', '.studyquest-shop-item',
      '.studyquest-dungeon-card', '.studyquest-quest-card',
      '.studyquest-inventory-slot', '.studyquest-nav-btn'
    ];

    selectors.forEach(sel => {
      this.container?.querySelectorAll(sel).forEach(el => clearElement(el as HTMLElement));
    });

    const backBtn = this.container.querySelector('.studyquest-back-btn');
    if (backBtn) clearElement(backBtn as HTMLElement);

    logger.info('Cleared sprite styling (using default CSS theme)');
  }

  /**
   * Create modal DOM structure
   */
  private createModal(): void {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'studyquest-backdrop';
    this.backdrop.addEventListener('click', () => this.close());
    document.body.appendChild(this.backdrop);

    this.container = document.createElement('div');
    this.container.className = 'studyquest-container';
    this.container.innerHTML = this.getModalHTML();
    document.body.appendChild(this.container);
  }

  /**
   * Get modal HTML structure
   */
  private getModalHTML(): string {
    return `
      <!-- Header -->
      <div class="studyquest-header">
        <button class="studyquest-back-btn" id="studyquest-back" style="display: none;">
          ${SQ_ICONS.arrowLeft} Back
        </button>
        <div class="studyquest-title">
          <span class="studyquest-title-icon">${SQ_ICONS.gamepad}</span>
          <h2>StudyQuest</h2>
        </div>
        <div class="studyquest-player-info" id="studyquest-player-info" style="display: none;">
          <div class="studyquest-stat">
            <span class="studyquest-stat-icon">${SQ_ICONS.heart}</span>
            <span class="studyquest-stat-value" id="studyquest-hp">--</span>
          </div>
          <div class="studyquest-stat studyquest-xp-stat">
            <span class="studyquest-stat-icon">${SQ_ICONS.star}</span>
            <div class="studyquest-mini-xp-bar">
              <div class="studyquest-mini-xp-fill" id="studyquest-xp-bar"></div>
            </div>
            <span class="studyquest-stat-value" id="studyquest-level">Lv.--</span>
          </div>
          <div class="studyquest-stat">
            <span class="studyquest-stat-icon">${SQ_ICONS.coin}</span>
            <span class="studyquest-stat-value" id="studyquest-gold">--</span>
          </div>
        </div>
        <div class="studyquest-header-actions">
          <button class="studyquest-settings-btn" id="studyquest-settings" title="Settings">
            <span style="font-size: 16px;">&#9881;</span>
          </button>
          <button class="studyquest-close-btn" id="studyquest-close">EXIT</button>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="studyquest-nav" id="studyquest-nav" style="display: none;">
        <button class="studyquest-nav-btn" data-view="town">Town</button>
        <button class="studyquest-nav-btn" data-view="character-sheet">Character</button>
        <button class="studyquest-nav-btn" data-view="inventory">Inventory</button>
        <button class="studyquest-nav-btn" data-view="quests">Quests</button>
        <button class="studyquest-nav-btn" data-view="leaderboard">Ranks</button>
      </nav>

      <!-- Main Content -->
      <div class="studyquest-main">
        <!-- Title Screen -->
        <div class="studyquest-view studyquest-title-screen active" id="view-title">
          <div class="studyquest-logo">${SQ_ICONS.gamepad}</div>
          <h1 class="studyquest-title-text">STUDYQUEST</h1>
          <p class="studyquest-subtitle">A Cat's Adventure</p>
          <div class="studyquest-menu-buttons">
            <button class="pixel-btn studyquest-menu-btn" id="btn-new-game">New Game</button>
            <button class="pixel-btn studyquest-menu-btn" id="btn-continue" style="display: none;">Continue</button>
          </div>
        </div>

        <!-- Character Creation -->
        <div class="studyquest-view" id="view-character-create">
          <div class="studyquest-character-create">
            <h2 class="studyquest-section-title">Create Your Hero</h2>
            <div class="studyquest-input-group">
              <label class="studyquest-label">Character Name</label>
              <input type="text" class="studyquest-input" id="character-name-input" placeholder="Enter name..." maxlength="20" />
            </div>
            <label class="studyquest-label">Choose Your Cat Color</label>
            <div class="studyquest-color-picker" id="color-picker">
              ${CAT_COLORS.map(c => `
                <div class="studyquest-color-option ${c.id === 'brown' ? 'selected' : ''}"
                     data-color="${c.id}" style="background-color: ${c.hex};" title="${c.name}">
                </div>
              `).join('')}
            </div>
            <label class="studyquest-label">Choose Your Class</label>
            <div class="studyquest-class-grid" id="class-grid"></div>
            <div style="display: flex; gap: 12px; justify-content: center;">
              <button class="pixel-btn" id="btn-back-to-title">Back</button>
              <button class="pixel-btn pixel-btn-success" id="btn-create-character" disabled>Begin Adventure</button>
            </div>
          </div>
        </div>

        <!-- Town View -->
        <div class="studyquest-view" id="view-town">
          <div class="studyquest-town-header">
            <h2 class="studyquest-section-title">Cat Village</h2>
            <div class="studyquest-town-mode-toggle" id="town-mode-toggle"></div>
          </div>
          <div class="studyquest-town-canvas-wrapper" id="town-canvas-container"></div>
          <div class="studyquest-town studyquest-town-cards" id="town-cards-container" style="display: none;">
            <div class="studyquest-town-building" data-building="dungeon">
              <div class="studyquest-building-icon">${SQ_ICONS.castle}</div>
              <h3 class="studyquest-building-name">Dungeons</h3>
              <p class="studyquest-building-desc">Battle monsters and earn loot</p>
            </div>
            <div class="studyquest-town-building" data-building="shop">
              <div class="studyquest-building-icon">${SQ_ICONS.shop}</div>
              <h3 class="studyquest-building-name">Shop</h3>
              <p class="studyquest-building-desc">Buy weapons and potions</p>
            </div>
            <div class="studyquest-town-building" data-building="inn">
              <div class="studyquest-building-icon">${SQ_ICONS.inn}</div>
              <h3 class="studyquest-building-name">Inn</h3>
              <p class="studyquest-building-desc">Rest and restore HP</p>
            </div>
            <div class="studyquest-town-building" data-building="quests">
              <div class="studyquest-building-icon">${SQ_ICONS.questBoard}</div>
              <h3 class="studyquest-building-name">Quest Board</h3>
              <p class="studyquest-building-desc">Accept and complete quests</p>
            </div>
            <div class="studyquest-town-building" data-building="home">
              <div class="studyquest-building-icon">${pixelIcon('heart', 32)}</div>
              <h3 class="studyquest-building-name">Home</h3>
              <p class="studyquest-building-desc">Collection & settings</p>
            </div>
          </div>
        </div>

        <!-- Character Sheet -->
        <div class="studyquest-view" id="view-character-sheet">
          <h2 class="studyquest-section-title">Character</h2>
          <div class="studyquest-character-sheet" id="character-sheet-content"></div>
        </div>

        <!-- Inventory -->
        <div class="studyquest-view" id="view-inventory">
          <h2 class="studyquest-section-title">Inventory</h2>
          <div class="studyquest-inventory">
            <div class="studyquest-inventory-grid" id="inventory-grid"></div>
          </div>
        </div>

        <!-- Shop -->
        <div class="studyquest-view" id="view-shop">
          <h2 class="studyquest-section-title">Cat Shop</h2>
          <div class="studyquest-shop">
            <div class="studyquest-shop-grid" id="shop-grid"></div>
          </div>
          <div style="margin-top: 20px; text-align: center;">
            <button class="pixel-btn" id="btn-back-to-town">Back to Town</button>
          </div>
        </div>

        <!-- Dungeon Select -->
        <div class="studyquest-view" id="view-dungeon-select">
          <h2 class="studyquest-section-title">Select Dungeon</h2>
          <div class="studyquest-dungeon-select">
            <div class="studyquest-dungeon-list" id="dungeon-list"></div>
          </div>
          <div style="margin-top: 20px; text-align: center;">
            <button class="pixel-btn" id="btn-dungeon-back">Back to Town</button>
          </div>
        </div>

        <!-- Dungeon Run -->
        <div class="studyquest-view" id="view-dungeon-run">
          <div class="studyquest-dungeon-header">
            <h2 class="studyquest-section-title" id="dungeon-name">Dungeon</h2>
            <div class="studyquest-dungeon-mode-toggle" id="dungeon-mode-toggle"></div>
          </div>
          <div class="studyquest-dungeon-canvas-wrapper" id="dungeon-canvas-container"></div>
          <div id="dungeon-run-content" style="display: none;"></div>
        </div>

        <!-- Dungeon Complete -->
        <div class="studyquest-view" id="view-dungeon-complete">
          <div class="studyquest-content"></div>
        </div>

        <!-- Battle -->
        <div class="studyquest-view" id="view-battle">
          <div class="studyquest-battle" id="battle-content">
            <div class="studyquest-battle-canvas-container">
              <canvas class="studyquest-battle-canvas" id="battle-canvas" width="480" height="270"></canvas>
            </div>
            <div class="studyquest-battle-ui">
              <div class="studyquest-battle-actions" id="battle-actions">
                <button class="pixel-btn studyquest-battle-action" data-action="attack" data-tooltip="Deal damage based on ATK. May crit for 1.5x!">${SQ_ICONS.attack} Attack</button>
                <button class="pixel-btn studyquest-battle-action" data-action="defend" data-tooltip="Recover 10% HP, reduce incoming damage by 50%">${SQ_ICONS.defend} Defend</button>
                <button class="pixel-btn studyquest-battle-action" data-action="item" data-tooltip="Use a consumable from your inventory">${SQ_ICONS.itemUse} Item</button>
                <button class="pixel-btn studyquest-battle-action" data-action="flee" data-tooltip="50% base + 10% per SPD above enemy">${SQ_ICONS.flee} Flee</button>
              </div>
              <div class="studyquest-battle-items" id="battle-items" style="display: none;">
                <div class="studyquest-battle-items-grid" id="battle-items-grid"></div>
                <button class="pixel-btn studyquest-battle-items-cancel" id="btn-cancel-item">Cancel</button>
              </div>
              <div class="studyquest-battle-log" id="battle-log">
                <div class="studyquest-battle-log-entry">Battle started!</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quests -->
        <div class="studyquest-view" id="view-quests">
          <h2 class="studyquest-section-title">Quest Board</h2>
          <div class="studyquest-quests" id="quests-content"></div>
        </div>

        <!-- Leaderboard -->
        <div class="studyquest-view" id="view-leaderboard">
          <h2 class="studyquest-section-title">Rankings</h2>
          <div class="studyquest-leaderboard" id="leaderboard-content"></div>
        </div>

        <!-- Collection -->
        <div class="studyquest-view" id="view-collection">
          <div id="collection-container"></div>
          <div style="margin-top: 16px; text-align: center;">
            <button class="pixel-btn" id="btn-collection-back">Back to Town</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.container) return;

    // Close button
    this.container.querySelector('#studyquest-close')?.addEventListener('click', () => this.close());

    // Settings button
    this.container.querySelector('#studyquest-settings')?.addEventListener('click', () => {
      StudyQuestSound.play('menu-select');
      getSettingsPanel().show();
    });

    // Back button
    this.container.querySelector('#studyquest-back')?.addEventListener('click', () => this.handleBackButton());

    // Navigation buttons
    this.container.querySelectorAll('.studyquest-nav-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const view = (e.currentTarget as HTMLElement).dataset.view as ViewType;
        if (view) this.showView(view);
      });
    });

    // Title screen buttons
    this.container.querySelector('#btn-new-game')?.addEventListener('click', async () => {
      await this.characterHandler?.loadClasses();
      this.showView('character-create');
    });

    this.container.querySelector('#btn-continue')?.addEventListener('click', () => this.showView('town'));

    // Character creation
    this.container.querySelector('#btn-back-to-title')?.addEventListener('click', () => this.showView('title'));

    this.container.querySelector('#btn-create-character')?.addEventListener('click', async () => {
      logger.debug('Begin Adventure button clicked');
      if (!this.characterHandler) {
        logger.error('characterHandler is null - cannot create character');
        return;
      }
      const success = await this.characterHandler.createCharacter();
      logger.debug('Character creation result:', success);
      if (success) {
        this.showView('town');
      }
    });

    const nameInput = this.container.querySelector('#character-name-input') as HTMLInputElement;
    nameInput?.addEventListener('input', () => this.characterHandler?.validateCharacterForm());

    // Color picker
    this.container.querySelectorAll('.studyquest-color-option').forEach((option) => {
      option.addEventListener('click', (e) => {
        const colorId = (e.currentTarget as HTMLElement).dataset.color as CatColor;
        if (colorId) {
          this.container?.querySelectorAll('.studyquest-color-option').forEach((o) => o.classList.remove('selected'));
          (e.currentTarget as HTMLElement).classList.add('selected');
          this.characterHandler?.handleColorSelection(colorId);
          // Update town view and battle handler colors
          this.townView?.setCatColor(colorId);
          this.battleHandler?.setSelectedColor(colorId);
        }
      });
    });

    // Load saved color
    const savedColor = localStorage.getItem('studyquest-cat-color') as CatColor | null;
    if (savedColor && CAT_COLORS.some((c) => c.id === savedColor)) {
      this.container.querySelectorAll('.studyquest-color-option').forEach((o) => {
        o.classList.toggle('selected', o.getAttribute('data-color') === savedColor);
      });
    }

    // Town buildings (for card mode)
    this.container.querySelectorAll('.studyquest-town-building').forEach((building) => {
      building.addEventListener('click', (e) => {
        const type = (e.currentTarget as HTMLElement).dataset.building;
        this.handleBuildingClick(type);
      });
    });

    // Initialize TownView (canvas mode)
    this.initializeTownView();

    // Collection back button
    this.container.querySelector('#btn-collection-back')?.addEventListener('click', () => this.showView('town'));

    // Back buttons
    this.container.querySelector('#btn-back-to-town')?.addEventListener('click', () => this.showView('town'));
    this.container.querySelector('#btn-dungeon-back')?.addEventListener('click', () => this.showView('town'));

    // Battle actions - delegate to handler
    this.container.querySelectorAll('.studyquest-battle-action').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        if (action) await this.battleHandler?.handleBattleAction(action);
      });
    });

    // Cancel item selection button
    this.container.querySelector('#btn-cancel-item')?.addEventListener('click', () => {
      this.battleHandler?.hideBattleItems();
    });

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  /**
   * Initialize TownView canvas component
   */
  private initializeTownView(): void {
    if (!this.container) return;

    const canvasContainer = this.container.querySelector('#town-canvas-container');
    const cardsContainer = this.container.querySelector('#town-cards-container');
    const toggleContainer = this.container.querySelector('#town-mode-toggle');

    if (!canvasContainer || !cardsContainer || !toggleContainer) return;

    this.townView = new TownView({
      onShop: () => this.handleBuildingClick('shop'),
      onInn: () => this.handleBuildingClick('inn'),
      onDungeons: () => this.handleBuildingClick('dungeon'),
      onQuests: () => this.handleBuildingClick('quests'),
      onHome: () => this.handleBuildingClick('home'),
    });

    const savedColor = localStorage.getItem('studyquest-cat-color') as CatColor | null;
    if (savedColor) {
      this.townView.setCatColor(savedColor);
    }

    canvasContainer.appendChild(this.townView.getElement());

    const toggle = createTownModeToggle(
      () => {
        this.townMode = 'canvas';
        (canvasContainer as HTMLElement).style.display = 'block';
        (cardsContainer as HTMLElement).style.display = 'none';
        this.townView?.start();
      },
      () => {
        this.townMode = 'cards';
        (canvasContainer as HTMLElement).style.display = 'none';
        (cardsContainer as HTMLElement).style.display = 'grid';
        this.townView?.stop();
      },
      this.townMode
    );
    toggleContainer.appendChild(toggle);

    logger.info('TownView initialized');
  }

  /**
   * Handle back button click
   */
  private handleBackButton(): void {
    const parentViews: Partial<Record<ViewType, ViewType>> = {
      town: 'title',
      'dungeon-select': 'town',
      shop: 'town',
      'dungeon-run': 'town',
      battle: 'dungeon-run',
      collection: 'town',
    };

    const parentView = parentViews[this.currentView] || 'town';
    StudyQuestSound.play('menu-back');
    this.showView(parentView);
  }

  /**
   * Show a specific view
   */
  private showView(view: ViewType): void {
    if (!this.container) return;

    // Play appropriate sound
    if (view === 'battle') {
      StudyQuestSound.play('battle-start');
    } else if (view !== 'title' && view !== 'character-create') {
      StudyQuestSound.play('menu-select');
    }

    this.currentView = view;

    // Hide all views, show target
    this.container.querySelectorAll('.studyquest-view').forEach((v) => v.classList.remove('active'));
    this.container.querySelector(`#view-${view}`)?.classList.add('active');

    // Update nav active state
    this.container.querySelectorAll('.studyquest-nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    });

    // Show/hide nav and player info
    const nav = this.container.querySelector('#studyquest-nav') as HTMLElement;
    const playerInfo = this.container.querySelector('#studyquest-player-info') as HTMLElement;
    const backBtn = this.container.querySelector('#studyquest-back') as HTMLElement;
    const showNav = view !== 'title' && view !== 'character-create';

    if (nav) nav.style.display = showNav ? 'flex' : 'none';
    if (playerInfo) playerInfo.style.display = showNav ? 'flex' : 'none';

    const viewsWithBack: ViewType[] = ['town', 'dungeon-select', 'shop', 'dungeon-run', 'battle', 'collection'];
    if (backBtn) backBtn.style.display = viewsWithBack.includes(view) ? 'flex' : 'none';

    this.loadViewData(view);
    logger.info(`Showing view: ${view}`);
  }

  /**
   * Load data for specific view
   */
  private async loadViewData(view: ViewType): Promise<void> {
    // Stop canvases when leaving their views
    if (view !== 'town' && this.townView?.isRunning()) {
      this.townView.stop();
    }
    if (view !== 'dungeon-run') {
      this.dungeonHandler?.getDungeonExploreView()?.stop();
    }

    switch (view) {
      case 'town':
        if (this.townMode === 'canvas') this.townView?.start();
        this.checkUnlocks();
        break;
      case 'character-sheet':
        this.characterHandler?.renderCharacterSheet();
        break;
      case 'inventory':
        await this.inventoryHandler?.loadInventory();
        break;
      case 'shop':
        await this.shopHandler?.loadShop();
        break;
      case 'dungeon-select':
        await this.dungeonHandler?.loadDungeons();
        break;
      case 'dungeon-run':
        this.dungeonHandler?.initDungeonRun();
        break;
      case 'dungeon-complete':
        this.dungeonHandler?.renderDungeonComplete();
        break;
      case 'battle':
        this.battleHandler?.initBattle();
        break;
      case 'quests':
        await this.loadQuests();
        break;
      case 'leaderboard':
        await this.loadLeaderboard();
        break;
      case 'collection':
        this.loadCollection();
        break;
    }
  }

  /**
   * Handle state changes from manager
   */
  private onStateChange(state: StudyQuestState): void {
    this.updatePlayerInfo(state.character);

    if (this.container) {
      const continueBtn = this.container.querySelector('#btn-continue') as HTMLElement;
      if (continueBtn) {
        continueBtn.style.display = state.character ? 'block' : 'none';
      }
    }
    // Note: Save indicator is now triggered by explicit save operations, not state changes
  }

  /**
   * Update player info in header (uses centralized XP formula - Item 8)
   */
  private updatePlayerInfo(character: StudyQuestCharacterData | null): void {
    if (!this.container || !character) return;

    const hpEl = this.container.querySelector('#studyquest-hp');
    const levelEl = this.container.querySelector('#studyquest-level');
    const goldEl = this.container.querySelector('#studyquest-gold');
    const xpBar = this.container.querySelector('#studyquest-xp-bar') as HTMLElement;

    if (hpEl) hpEl.textContent = `${character.hp}/${character.maxHp}`;
    if (levelEl) levelEl.textContent = `Lv.${character.level}`;
    if (goldEl) goldEl.textContent = `${character.gold}`;

    if (xpBar) {
      const xpNeeded = getXpRequiredForLevel(character.level);
      const currentXp = character.currentXp || 0;
      const percent = Math.min(100, (currentXp / xpNeeded) * 100);
      xpBar.style.width = `${percent}%`;
    }
  }

  /**
   * Handle building click in town
   */
  private async handleBuildingClick(type: string | undefined): Promise<void> {
    switch (type) {
      case 'dungeon':
        this.showView('dungeon-select');
        break;
      case 'shop':
        this.showView('shop');
        break;
      case 'inn':
        await this.handleInn();
        break;
      case 'quests':
        this.showView('quests');
        break;
      case 'home':
        this.showView('collection');
        break;
    }
  }

  /**
   * Handle inn (healing) with animation (Item 14)
   */
  private async handleInn(): Promise<void> {
    const state = this.manager.getState();
    const char = state.character;
    if (!char) return;

    const healingInfo = this.manager.getInnHealingCost();
    if (!healingInfo || healingInfo.missingHp === 0) {
      this.showToast('Already at full health!');
      return;
    }

    if (char.gold < healingInfo.cost) {
      this.showToast(`Not enough gold! Need ${healingInfo.cost}G`);
      return;
    }

    const confirmed = await this.showConfirmDialog(
      'Rest at Inn',
      `Restore ${healingInfo.missingHp} HP for ${healingInfo.cost} Gold?`
    );

    if (confirmed) {
      // Show inn animation (Item 14)
      await this.showInnAnimation();

      const success = await this.manager.healCharacter(healingInfo.cost);
      if (success) {
        this.characterHandler?.renderCharacterSheet();
        this.updatePlayerInfo(this.manager.getState().character);
      }
    }
  }

  /**
   * Show inn sleep animation (Item 14)
   */
  private showInnAnimation(): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'studyquest-inn-animation';
      overlay.innerHTML = `
        <div class="inn-animation-content">
          <div class="zzz zzz-1">Z</div>
          <div class="zzz zzz-2">z</div>
          <div class="zzz zzz-3">Z</div>
          <div class="inn-text">Resting...</div>
        </div>
      `;
      this.container?.appendChild(overlay);
      StudyQuestSound.play('heal');

      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 1500);
    });
  }

  /**
   * Show a toast message
   */
  private showToast(message: string): void {
    const ticker = (window as any).notificationTicker;
    if (ticker) {
      ticker.show(message);
    } else {
      console.log('[Toast]', message);
    }
  }

  // ============================================================================
  // Item 12: Save Indicator
  // ============================================================================

  private saveIndicator: HTMLElement | null = null;
  private saveTimeout: number | null = null;

  /**
   * Show save indicator when saving game state
   */
  private showSaveIndicator(): void {
    // Create indicator if it doesn't exist
    if (!this.saveIndicator) {
      this.saveIndicator = document.createElement('div');
      this.saveIndicator.className = 'studyquest-save-indicator';
      this.saveIndicator.innerHTML = `
        <span class="save-icon">⏳</span>
        <span class="save-text">Saving...</span>
      `;
      this.container?.appendChild(this.saveIndicator);
    }

    // Clear any existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Show indicator
    this.saveIndicator.classList.remove('saved');
    this.saveIndicator.classList.add('visible');

    // Auto-hide after a short delay and show "saved" state
    this.saveTimeout = window.setTimeout(() => {
      if (this.saveIndicator) {
        this.saveIndicator.innerHTML = `
          <span class="save-icon">✓</span>
          <span class="save-text">Saved!</span>
        `;
        this.saveIndicator.classList.add('saved');

        // Hide completely after showing "saved"
        setTimeout(() => {
          this.saveIndicator?.classList.remove('visible');
          // Reset content for next save
          setTimeout(() => {
            if (this.saveIndicator) {
              this.saveIndicator.innerHTML = `
                <span class="save-icon">⏳</span>
                <span class="save-text">Saving...</span>
              `;
              this.saveIndicator.classList.remove('saved');
            }
          }, 300);
        }, 1000);
      }
    }, 500);
  }

  /**
   * Show a confirmation dialog
   */
  private showConfirmDialog(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'studyquest-confirm-overlay';
      overlay.innerHTML = `
        <div class="studyquest-confirm-dialog">
          <h3 class="studyquest-confirm-title">${title}</h3>
          <p class="studyquest-confirm-message">${message}</p>
          <div class="studyquest-confirm-buttons">
            <button class="pixel-btn studyquest-confirm-cancel">Cancel</button>
            <button class="pixel-btn studyquest-confirm-ok">OK</button>
          </div>
        </div>
      `;

      overlay.querySelector('.studyquest-confirm-cancel')?.addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });
      overlay.querySelector('.studyquest-confirm-ok')?.addEventListener('click', () => {
        overlay.remove();
        resolve(true);
      });

      this.container?.appendChild(overlay);
    });
  }

  /**
   * Load quests
   */
  private async loadQuests(): Promise<void> {
    const content = this.container?.querySelector('#quests-content');
    if (!content) return;

    const quests = await this.manager.loadActiveQuests();

    if (quests.length === 0) {
      content.innerHTML = '<p class="studyquest-empty">No active quests</p>';
      return;
    }

    const dailyQuests = quests.filter((q) => q.quest.questType === 'daily');
    const weeklyQuests = quests.filter((q) => q.quest.questType === 'weekly');
    const storyQuests = quests.filter((q) => q.quest.questType === 'story');

    const renderQuestList = (questList: typeof quests, title: string, icon: string) => {
      if (questList.length === 0) return '';
      return `
        <div class="studyquest-quest-section">
          <h3 class="studyquest-quest-section-title">${icon} ${title}</h3>
          <div class="studyquest-quest-list">
            ${questList.map((q) => {
              const progress = q.progress?.currentProgress || 0;
              const required = q.quest.requirementValue;
              const isComplete = progress >= required;
              return `
                <div class="studyquest-quest-card ${isComplete ? 'completed' : ''}">
                  <div class="studyquest-quest-header">
                    <h4 class="studyquest-quest-name">${q.quest.name}</h4>
                    <span class="studyquest-quest-rewards">
                      ${SQ_ICONS.star} ${q.quest.rewardXp} XP | ${SQ_ICONS.gold} ${q.quest.rewardGold}
                    </span>
                  </div>
                  <p class="studyquest-quest-desc">${q.quest.description}</p>
                  <div class="studyquest-quest-progress">
                    <div class="pixel-bar-container">
                      <div class="pixel-bar pixel-bar-xp" style="width: ${Math.min((progress / required) * 100, 100)}%;"></div>
                      <span class="pixel-bar-label">${progress} / ${required}</span>
                    </div>
                  </div>
                  ${isComplete ? `<button class="pixel-btn pixel-btn-success studyquest-quest-claim" data-quest-id="${q.quest.id}">Claim Reward</button>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    };

    content.innerHTML =
      renderQuestList(dailyQuests, 'Daily Quests', SQ_ICONS.daily) +
      renderQuestList(weeklyQuests, 'Weekly Quests', SQ_ICONS.weekly) +
      renderQuestList(storyQuests, 'Story Quests', SQ_ICONS.story);

    content.querySelectorAll('.studyquest-quest-claim').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const questId = (e.currentTarget as HTMLElement).dataset.questId;
        if (questId) {
          StudyQuestSound.play('quest-complete');
          await this.manager.completeQuest(questId);
          await this.loadQuests();
        }
      });
    });
  }

  /**
   * Load leaderboard
   */
  private async loadLeaderboard(): Promise<void> {
    const content = this.container?.querySelector('#leaderboard-content');
    if (!content) return;

    const leaderboard = await this.manager.getLeaderboard(10);

    if (leaderboard.length === 0) {
      content.innerHTML = '<p class="studyquest-empty">No rankings yet</p>';
      return;
    }

    content.innerHTML = `
      <table class="studyquest-leaderboard-table">
        <tbody>
          ${leaderboard.map((entry, index) => {
            const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
            return `
              <tr class="studyquest-leaderboard-row">
                <td class="studyquest-leaderboard-cell studyquest-leaderboard-rank ${rankClass}">#${index + 1}</td>
                <td class="studyquest-leaderboard-cell studyquest-leaderboard-name">${entry.characterName}</td>
                <td class="studyquest-leaderboard-cell studyquest-leaderboard-level">Lv. ${entry.level}</td>
                <td class="studyquest-leaderboard-cell studyquest-leaderboard-xp">${entry.totalXpEarned} XP</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  /**
   * Load collection screen
   */
  private loadCollection(): void {
    const container = this.container?.querySelector('#collection-container');
    if (!container) return;

    if (!this.collectionScreen) {
      this.collectionScreen = new CollectionScreen();
      container.appendChild(this.collectionScreen.getElement());
    } else {
      this.collectionScreen.refresh();
    }
  }

  /**
   * Check for new unlocks and show celebration
   */
  private checkUnlocks(): void {
    const state = this.manager.getState();
    const character = state.character;
    if (!character) return;

    const stats = PlayerStatsService.getStats();
    stats.level = character.level;
    stats.battlesWon = character.battlesWon;
    stats.totalGoldCollected = character.totalGoldEarned || 0;
    stats.questsCompleted = character.questsCompleted;
    stats.characterName = character.name;
    stats.currentMonth = new Date().getMonth() + 1;

    const newUnlocks = UnlockManager.checkUnlocks(stats);

    if (newUnlocks.length > 0) {
      const unlockables = UnlockManager.getNewUnlocks();
      if (unlockables.length > 0) {
        unlockCelebration.show(unlockables);
        UnlockManager.clearNewUnlocks();
      }
    }
  }
}
