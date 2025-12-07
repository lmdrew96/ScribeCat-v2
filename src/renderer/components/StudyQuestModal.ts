/**
 * StudyQuestModal
 *
 * Main container for the StudyQuest RPG mini-game.
 * Manages view switching between title screen, character creation,
 * town hub, dungeons, battles, shop, quests, and leaderboard.
 */

import { createLogger } from '../../shared/logger.js';
import type { StudyQuestManager, StudyQuestState } from '../managers/StudyQuestManager.js';
import type { StudyQuestCharacterData, CharacterClassData } from '../../domain/entities/StudyQuestCharacter.js';
import type { StudyQuestBattleData, BattleLogEntry } from '../../domain/entities/StudyQuestBattle.js';
import { BattleCanvas } from './studyquest/BattleCanvas.js';
import { TownView, createTownModeToggle } from './studyquest/TownView.js';
import { DungeonExploreView } from './studyquest/DungeonExploreView.js';
import { CollectionScreen } from './studyquest/CollectionScreen.js';
import { unlockCelebration } from './studyquest/UnlockCelebration.js';
import { UnlockManager } from '../canvas/UnlockManager.js';
import { PlayerStatsService } from '../canvas/PlayerStatsService.js';

// Helper to generate pixel art icon img tags
const pixelIcon = (name: string, size: number = 16): string => {
  return `<img src="../../assets/sprites/studyquest/icons/${name}.png" width="${size}" height="${size}" style="image-rendering: pixelated; vertical-align: middle;" alt="${name}" />`;
};
import type { CatColor } from './studyquest/SpriteLoader.js';
import { StudyQuestSound } from './studyquest/StudyQuestSound.js';
import { getSettingsPanel } from './studyquest/StudyQuestSettingsPanel.js';
import { themeManager } from './studyquest/StudyQuestThemeManager.js';
import { spriteRenderer } from './studyquest/StudyQuestSpriteRenderer.js';

// Available cat colors for character creation
const CAT_COLORS: { id: CatColor; name: string; hex: string }[] = [
  { id: 'brown', name: 'Brown', hex: '#8B4513' },
  { id: 'orange', name: 'Orange', hex: '#FF8C00' },
  { id: 'grey', name: 'Grey', hex: '#708090' },
  { id: 'black', name: 'Black', hex: '#2F2F2F' },
  { id: 'white', name: 'White', hex: '#F5F5F5' },
];

const logger = createLogger('StudyQuestModal');

// Pixel art icon constants for StudyQuest (16-bit retro style)
const SQ_ICONS = {
  // Header icons
  gamepad: pixelIcon('ducky', 24),
  heart: pixelIcon('heart', 14),
  star: pixelIcon('stars', 14),
  coin: pixelIcon('tuna_coin', 14),

  // Character class icons (24px for cards)
  scholar: pixelIcon('magic', 24),
  knight: pixelIcon('shield', 24),
  rogue: pixelIcon('sword', 24),
  cat: pixelIcon('catnip', 24),

  // Building icons (32px for town)
  castle: pixelIcon('sword', 32),
  shop: pixelIcon('gem', 32),
  inn: pixelIcon('potion', 32),
  questBoard: pixelIcon('scratching_post', 32),

  // Item type icons
  weapon: pixelIcon('sword', 20),
  armor: pixelIcon('shield', 20),
  potion: pixelIcon('potion', 20),
  keyItem: pixelIcon('gem_1', 20),
  item: pixelIcon('gem', 20),

  // Battle action icons
  attack: pixelIcon('sword', 16),
  defend: pixelIcon('shield', 16),
  itemUse: pixelIcon('potion', 16),
  flee: pixelIcon('heart_2', 16),
  arrowLeft: pixelIcon('heart_1', 16),

  // Dungeon icons (32px)
  training: pixelIcon('sword', 32),
  forest: pixelIcon('catnip', 32),
  crystal: pixelIcon('gem_2', 32),
  library: pixelIcon('magic', 32),
  volcano: pixelIcon('fire', 32),
  void: pixelIcon('snowflake', 32),
  lock: pixelIcon('gem_3', 16),

  // Stat icons
  hp: pixelIcon('heart', 14),
  atk: pixelIcon('sword', 14),
  def: pixelIcon('shield', 14),
  spd: pixelIcon('stars', 14),
  gold: pixelIcon('tuna_coin', 14),
  trophy: pixelIcon('stars2', 14),
  quest: pixelIcon('scratching_post', 14),

  // Quest type icons
  daily: pixelIcon('yarn', 14),
  weekly: pixelIcon('ducky', 14),
  story: pixelIcon('magic', 14),

  // Large portrait icons (48px)
  scholarLarge: pixelIcon('magic', 48),
  knightLarge: pixelIcon('shield', 48),
  rogueLarge: pixelIcon('sword', 48),
  catLarge: pixelIcon('catnip', 48),
};

type ViewType =
  | 'title'
  | 'character-create'
  | 'town'
  | 'character-sheet'
  | 'inventory'
  | 'shop'
  | 'dungeon-select'
  | 'dungeon-run'
  | 'dungeon-complete'
  | 'battle'
  | 'quests'
  | 'leaderboard'
  | 'collection';

export class StudyQuestModal {
  private manager: StudyQuestManager;
  private container: HTMLElement | null = null;
  private backdrop: HTMLElement | null = null;
  private currentView: ViewType = 'title';
  private isOpen = false;
  private unsubscribe: (() => void) | null = null;
  private classes: CharacterClassData[] = [];
  private battleCanvas: BattleCanvas | null = null;
  private townView: TownView | null = null;
  private dungeonExploreView: DungeonExploreView | null = null;
  private collectionScreen: CollectionScreen | null = null;
  private townMode: 'canvas' | 'cards' = 'canvas';
  private dungeonMode: 'explore' | 'classic' = 'explore';
  private isBattleProcessing = false;
  private isCurrentBattleBoss = false;
  private selectedColor: CatColor = 'brown';
  private dungeonCompletionRewards: {
    success: boolean;
    xpBonus: number;
    goldBonus: number;
    dungeonName: string;
  } | null = null;
  private themeUnsubscribe: (() => void) | null = null;

  constructor(manager: StudyQuestManager) {
    this.manager = manager;
    logger.info('StudyQuestModal initialized');
  }

  /**
   * Initialize the modal - create DOM elements
   */
  public initialize(): void {
    this.createModal();
    this.attachEventListeners();
    this.initializeDebugCommands();
    logger.info('StudyQuestModal DOM created');
  }

  /**
   * Initialize debug commands on window.debugStudyQuest
   */
  private initializeDebugCommands(): void {
    // Type declaration for window
    const win = window as unknown as {
      debugStudyQuest?: {
        forceUnlock: (id: string) => void;
        resetUnlocks: () => void;
        setStats: (stats: {
          totalGoldCollected?: number;
          treasuresFound?: number;
          dungeonsCleared?: string[];
          studyBuddyDaysUsed?: number;
        }) => void;
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
          // Find the unlock info manually for already-unlocked items
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
      // Apply sprite theming to UI elements
      await this.applySpritesToUI();
      // Subscribe to theme changes for live updates
      this.themeUnsubscribe = themeManager.subscribe(() => {
        this.applySpritesToUI(); // async but fire-and-forget on theme change
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

    // Unsubscribe from state changes
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Unsubscribe from theme changes
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
   * Apply theme styling to UI elements based on current theme
   * Applies sprite backgrounds to PANELS and CARDS (which don't have baked text)
   * Buttons use CSS colors only (sprite buttons have baked text like "PLAY", "EXIT")
   */
  private async applySpritesToUI(): Promise<void> {
    if (!this.container) return;

    const theme = themeManager.getTheme();
    const sprites = theme.sprites;
    const spriteSheet = theme.spriteSheet;

    // If no sprite sheet (default theme), clear sprite styling and use CSS only
    if (!spriteSheet || !sprites) {
      this.clearSpriteStyles();
      return;
    }

    const scale = 2; // 2x scale for pixel art

    // Preload sprite sheet to get dimensions for backgroundSize
    let spriteSheetImg: HTMLImageElement | null = null;
    try {
      spriteSheetImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load sprite sheet: ${spriteSheet}`));
        img.src = spriteSheet;
      });
    } catch (error) {
      logger.warn('Failed to load sprite sheet, using CSS fallback:', error);
      this.clearSpriteStyles();
      return;
    }

    // Helper to apply sprite background to an element
    const applySprite = (el: HTMLElement, region: { x: number; y: number; width: number; height: number }) => {
      // Skip if region is placeholder (1x1)
      if (region.width <= 1 || region.height <= 1) return;

      el.style.backgroundImage = `url("${spriteSheet}")`;
      el.style.backgroundPosition = `-${region.x * scale}px -${region.y * scale}px`;
      el.style.backgroundRepeat = 'no-repeat';
      el.style.imageRendering = 'pixelated';
      // THE CRITICAL FIX - add backgroundSize to match scaled sprite sheet
      if (spriteSheetImg) {
        el.style.backgroundSize = `${spriteSheetImg.width * scale}px ${spriteSheetImg.height * scale}px`;
      }
    };

    // Apply panel sprites to CARDS/PANELS (not buttons - they have baked text)
    // Town buildings get panelMedium
    this.container.querySelectorAll('.studyquest-town-building').forEach((el) => {
      applySprite(el as HTMLElement, sprites.panelMedium);
    });

    // Pixel cards get panelSmall
    this.container.querySelectorAll('.pixel-card').forEach((el) => {
      applySprite(el as HTMLElement, sprites.panelSmall);
    });

    // Class cards, shop items, quest cards get panelSmall
    this.container.querySelectorAll('.studyquest-class-card').forEach((el) => {
      applySprite(el as HTMLElement, sprites.panelSmall);
    });
    this.container.querySelectorAll('.studyquest-shop-item').forEach((el) => {
      applySprite(el as HTMLElement, sprites.panelSmall);
    });
    this.container.querySelectorAll('.studyquest-quest-card').forEach((el) => {
      applySprite(el as HTMLElement, sprites.panelMedium);
    });

    // Dungeon cards get panelLarge
    this.container.querySelectorAll('.studyquest-dungeon-card').forEach((el) => {
      applySprite(el as HTMLElement, sprites.panelLarge);
    });

    // Inventory slots
    this.container.querySelectorAll('.studyquest-inventory-slot').forEach((el) => {
      applySprite(el as HTMLElement, sprites.inventorySlot);
    });

    // NOTE: Buttons (.pixel-btn, .studyquest-nav-btn, etc.) use CSS colors only
    // because sprite buttons have baked-in text that doesn't match our dynamic content

    logger.info(`Theme applied: ${theme.name} (sprites + CSS colors)`);
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

    this.container.querySelectorAll('.pixel-btn').forEach((el) => clearElement(el as HTMLElement));
    this.container.querySelectorAll('.pixel-btn-success').forEach((el) => clearElement(el as HTMLElement));
    this.container.querySelectorAll('.studyquest-town-building').forEach((el) => clearElement(el as HTMLElement));
    this.container.querySelectorAll('.studyquest-class-card').forEach((el) => clearElement(el as HTMLElement));
    this.container.querySelectorAll('.pixel-card').forEach((el) => clearElement(el as HTMLElement));
    this.container.querySelectorAll('.studyquest-shop-item').forEach((el) => clearElement(el as HTMLElement));
    this.container.querySelectorAll('.studyquest-dungeon-card').forEach((el) => clearElement(el as HTMLElement));
    this.container.querySelectorAll('.studyquest-quest-card').forEach((el) => clearElement(el as HTMLElement));
    this.container.querySelectorAll('.studyquest-inventory-slot').forEach((el) => clearElement(el as HTMLElement));
    this.container.querySelectorAll('.studyquest-nav-btn').forEach((el) => clearElement(el as HTMLElement));

    const backBtn = this.container.querySelector('.studyquest-back-btn');
    if (backBtn) clearElement(backBtn as HTMLElement);

    logger.info('Cleared sprite styling (using default CSS theme)');
  }

  /**
   * Create modal DOM structure
   */
  private createModal(): void {
    // Create backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'studyquest-backdrop';
    this.backdrop.addEventListener('click', () => this.close());
    document.body.appendChild(this.backdrop);

    // Create container
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

      <!-- Navigation (hidden on title screen) -->
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
              <input
                type="text"
                class="studyquest-input"
                id="character-name-input"
                placeholder="Enter name..."
                maxlength="20"
              />
            </div>

            <label class="studyquest-label">Choose Your Cat Color</label>
            <div class="studyquest-color-picker" id="color-picker">
              ${CAT_COLORS.map(
                (c) => `
                <div class="studyquest-color-option ${c.id === 'brown' ? 'selected' : ''}"
                     data-color="${c.id}"
                     style="background-color: ${c.hex};"
                     title="${c.name}">
                </div>
              `
              ).join('')}
            </div>

            <label class="studyquest-label">Choose Your Class</label>
            <div class="studyquest-class-grid" id="class-grid">
              <!-- Classes populated dynamically -->
            </div>

            <div style="display: flex; gap: 12px; justify-content: center;">
              <button class="pixel-btn" id="btn-back-to-title">Back</button>
              <button class="pixel-btn pixel-btn-success" id="btn-create-character" disabled>
                Begin Adventure
              </button>
            </div>
          </div>
        </div>

        <!-- Town View -->
        <div class="studyquest-view" id="view-town">
          <div class="studyquest-town-header">
            <h2 class="studyquest-section-title">Cat Village</h2>
            <div class="studyquest-town-mode-toggle" id="town-mode-toggle"></div>
          </div>

          <!-- Canvas-based town (default) -->
          <div class="studyquest-town-canvas-wrapper" id="town-canvas-container"></div>

          <!-- Card-based town (fallback) -->
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
          <div class="studyquest-character-sheet" id="character-sheet-content">
            <!-- Populated dynamically -->
          </div>
        </div>

        <!-- Inventory -->
        <div class="studyquest-view" id="view-inventory">
          <h2 class="studyquest-section-title">Inventory</h2>
          <div class="studyquest-inventory">
            <div class="studyquest-inventory-grid" id="inventory-grid">
              <!-- Populated dynamically -->
            </div>
          </div>
        </div>

        <!-- Shop -->
        <div class="studyquest-view" id="view-shop">
          <h2 class="studyquest-section-title">Cat Shop</h2>
          <div class="studyquest-shop">
            <div class="studyquest-shop-grid" id="shop-grid">
              <!-- Populated dynamically -->
            </div>
          </div>
          <div style="margin-top: 20px; text-align: center;">
            <button class="pixel-btn" id="btn-back-to-town">Back to Town</button>
          </div>
        </div>

        <!-- Dungeon Select -->
        <div class="studyquest-view" id="view-dungeon-select">
          <h2 class="studyquest-section-title">Select Dungeon</h2>
          <div class="studyquest-dungeon-select">
            <div class="studyquest-dungeon-list" id="dungeon-list">
              <!-- Populated dynamically -->
            </div>
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

          <!-- Canvas-based exploration (default) -->
          <div class="studyquest-dungeon-canvas-wrapper" id="dungeon-canvas-container"></div>

          <!-- Classic button-based mode (fallback) -->
          <div id="dungeon-run-content" style="display: none;">
            <!-- Populated dynamically -->
          </div>
        </div>

        <!-- Dungeon Complete -->
        <div class="studyquest-view" id="view-dungeon-complete">
          <div class="studyquest-content">
            <!-- Populated dynamically by renderDungeonComplete -->
          </div>
        </div>

        <!-- Battle -->
        <div class="studyquest-view" id="view-battle">
          <div class="studyquest-battle" id="battle-content">
            <div class="studyquest-battle-canvas-container">
              <canvas class="studyquest-battle-canvas" id="battle-canvas" width="480" height="270"></canvas>
            </div>
            <div class="studyquest-battle-ui">
              <div class="studyquest-battle-actions" id="battle-actions">
                <button class="pixel-btn studyquest-battle-action" data-action="attack">${SQ_ICONS.attack} Attack</button>
                <button class="pixel-btn studyquest-battle-action" data-action="defend">${SQ_ICONS.defend} Defend</button>
                <button class="pixel-btn studyquest-battle-action" data-action="item">${SQ_ICONS.itemUse} Item</button>
                <button class="pixel-btn studyquest-battle-action" data-action="flee">${SQ_ICONS.flee} Flee</button>
              </div>
              <div class="studyquest-battle-items" id="battle-items" style="display: none;">
                <div class="studyquest-battle-items-grid" id="battle-items-grid">
                  <!-- Populated with consumable items -->
                </div>
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
          <div class="studyquest-quests" id="quests-content">
            <!-- Populated dynamically -->
          </div>
        </div>

        <!-- Leaderboard -->
        <div class="studyquest-view" id="view-leaderboard">
          <h2 class="studyquest-section-title">Rankings</h2>
          <div class="studyquest-leaderboard" id="leaderboard-content">
            <!-- Populated dynamically -->
          </div>
        </div>

        <!-- Collection -->
        <div class="studyquest-view" id="view-collection">
          <div id="collection-container">
            <!-- CollectionScreen component mounted here -->
          </div>
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
    this.container.querySelector('#studyquest-close')?.addEventListener('click', () => {
      this.close();
    });

    // Settings button
    this.container.querySelector('#studyquest-settings')?.addEventListener('click', () => {
      StudyQuestSound.play('menu-select');
      getSettingsPanel().show();
    });

    // Back button - return to town from sub-views
    this.container.querySelector('#studyquest-back')?.addEventListener('click', () => {
      this.handleBackButton();
    });

    // Navigation buttons
    this.container.querySelectorAll('.studyquest-nav-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const view = (e.currentTarget as HTMLElement).dataset.view as ViewType;
        if (view) this.showView(view);
      });
    });

    // Title screen buttons
    this.container.querySelector('#btn-new-game')?.addEventListener('click', async () => {
      await this.loadClasses();
      this.showView('character-create');
    });

    this.container.querySelector('#btn-continue')?.addEventListener('click', () => {
      this.showView('town');
    });

    // Character creation
    this.container.querySelector('#btn-back-to-title')?.addEventListener('click', () => {
      this.showView('title');
    });

    this.container.querySelector('#btn-create-character')?.addEventListener('click', async () => {
      await this.createCharacter();
    });

    const nameInput = this.container.querySelector('#character-name-input') as HTMLInputElement;
    nameInput?.addEventListener('input', () => this.validateCharacterForm());

    // Color picker
    this.container.querySelectorAll('.studyquest-color-option').forEach((option) => {
      option.addEventListener('click', (e) => {
        const colorId = (e.currentTarget as HTMLElement).dataset.color as CatColor;
        if (colorId) {
          // Update selection
          this.container?.querySelectorAll('.studyquest-color-option').forEach((o) => o.classList.remove('selected'));
          (e.currentTarget as HTMLElement).classList.add('selected');
          this.selectedColor = colorId;
          // Save to localStorage for persistence
          localStorage.setItem('studyquest-cat-color', colorId);
        }
      });
    });

    // Load saved color from localStorage
    const savedColor = localStorage.getItem('studyquest-cat-color') as CatColor | null;
    if (savedColor && CAT_COLORS.some((c) => c.id === savedColor)) {
      this.selectedColor = savedColor;
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
    this.container.querySelector('#btn-collection-back')?.addEventListener('click', () => {
      this.showView('town');
    });

    // Back buttons
    this.container.querySelector('#btn-back-to-town')?.addEventListener('click', () => {
      this.showView('town');
    });

    this.container.querySelector('#btn-dungeon-back')?.addEventListener('click', () => {
      this.showView('town');
    });

    // Battle actions
    this.container.querySelectorAll('.studyquest-battle-action').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        if (action) await this.handleBattleAction(action);
      });
    });

    // Cancel item selection button
    this.container.querySelector('#btn-cancel-item')?.addEventListener('click', () => {
      this.hideBattleItems();
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

    // Create TownView with building callbacks
    this.townView = new TownView({
      onShop: () => this.handleBuildingClick('shop'),
      onInn: () => this.handleBuildingClick('inn'),
      onDungeons: () => this.handleBuildingClick('dungeon'),
      onQuests: () => this.handleBuildingClick('quests'),
      onHome: () => this.handleBuildingClick('home'),
    });

    // Set cat color
    const savedColor = localStorage.getItem('studyquest-cat-color') as CatColor | null;
    if (savedColor) {
      this.townView.setCatColor(savedColor);
    }

    // Mount TownView
    canvasContainer.appendChild(this.townView.getElement());

    // Create mode toggle
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
   * Initialize DungeonExploreView canvas component
   */
  private initializeDungeonExploreView(): void {
    if (!this.container) return;

    const canvasContainer = this.container.querySelector('#dungeon-canvas-container');
    const classicContainer = this.container.querySelector('#dungeon-run-content');
    const toggleContainer = this.container.querySelector('#dungeon-mode-toggle');

    if (!canvasContainer || !classicContainer || !toggleContainer) return;

    // Create DungeonExploreView with callbacks
    this.dungeonExploreView = new DungeonExploreView({
      onEnemyEncounter: async (enemyData: any, isBoss: boolean) => {
        this.isCurrentBattleBoss = isBoss;
        const battle = await this.manager.startBattle(isBoss);
        if (battle) {
          this.showView('battle');
        }
      },
      onChestOpen: async (lootData: any) => {
        // Award chest loot
        const goldAmount = lootData?.gold || Math.floor(Math.random() * 50) + 10;
        await this.manager.awardGold(goldAmount);
        this.showToast(`Found ${goldAmount} gold!`);
        StudyQuestSound.play('item-pickup');
      },
      onTrapTriggered: async (trapData: any) => {
        // Take trap damage
        const damage = trapData?.damage || Math.floor(Math.random() * 10) + 5;
        await this.manager.takeDamage(damage);
        this.showToast(`Trap! Took ${damage} damage!`);
        StudyQuestSound.play('damage-taken');
      },
      onMerchantInteract: () => {
        // Open shop from dungeon
        this.showView('shop');
      },
      onRestPointUse: async (healPercent: number) => {
        const state = this.manager.getState();
        const char = state.character;
        if (char) {
          const healAmount = Math.floor(char.maxHp * (healPercent / 100));
          await this.manager.healCharacterDirect(healAmount);
          this.showToast(`Rested and recovered ${healAmount} HP!`);
          StudyQuestSound.play('heal');
        }
      },
      onFloorExit: () => {
        // Advance to next floor
        this.dungeonExploreView?.advanceFloor();
        this.showToast('Descending to next floor...');
      },
      onDungeonComplete: async () => {
        // Complete the dungeon
        const completionResult = await this.manager.completeDungeon();
        if (completionResult) {
          this.dungeonCompletionRewards = completionResult;
        }
        this.dungeonExploreView?.stop();
        this.showView('dungeon-complete');
      },
      onFlee: async () => {
        await this.manager.abandonDungeon();
        this.dungeonExploreView?.stop();
        this.showView('town');
      },
    });

    // Set cat color
    const savedColor = localStorage.getItem('studyquest-cat-color') as CatColor | null;
    if (savedColor) {
      this.dungeonExploreView.setCatColor(savedColor);
    }

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
   * Handle back button click - navigate to appropriate parent view
   */
  private handleBackButton(): void {
    // Map sub-views to their parent views
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

    // Play appropriate sound based on view transition
    if (view === 'battle') {
      StudyQuestSound.play('battle-start');
    } else if (view === 'title' || view === 'character-create') {
      // No sound for title/creation views
    } else {
      StudyQuestSound.play('menu-select');
    }

    this.currentView = view;

    // Hide all views
    this.container.querySelectorAll('.studyquest-view').forEach((v) => {
      v.classList.remove('active');
    });

    // Show target view
    const viewEl = this.container.querySelector(`#view-${view}`);
    viewEl?.classList.add('active');

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

    // Show back button for views that can go back
    const viewsWithBack: ViewType[] = ['town', 'dungeon-select', 'shop', 'dungeon-run', 'battle', 'collection'];
    if (backBtn) backBtn.style.display = viewsWithBack.includes(view) ? 'flex' : 'none';

    // Load view-specific data
    this.loadViewData(view);

    logger.info(`Showing view: ${view}`);
  }

  /**
   * Load data for specific view
   */
  private async loadViewData(view: ViewType): Promise<void> {
    // Stop town canvas when leaving town view
    if (view !== 'town' && this.townView?.isRunning()) {
      this.townView.stop();
    }

    // Stop dungeon canvas when leaving dungeon-run view
    if (view !== 'dungeon-run' && this.dungeonExploreView?.isRunning()) {
      this.dungeonExploreView.stop();
    }

    switch (view) {
      case 'town':
        // Start town canvas if in canvas mode
        if (this.townMode === 'canvas') {
          this.townView?.start();
        }
        // Check for unlock updates
        this.checkUnlocks();
        break;
      case 'character-sheet':
        this.renderCharacterSheet();
        break;
      case 'inventory':
        await this.loadInventory();
        break;
      case 'shop':
        await this.loadShop();
        break;
      case 'dungeon-select':
        await this.loadDungeons();
        break;
      case 'dungeon-run':
        this.initDungeonRun();
        break;
      case 'dungeon-complete':
        this.renderDungeonComplete();
        break;
      case 'battle':
        this.initBattle();
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

    // Update title screen buttons
    if (this.container) {
      const continueBtn = this.container.querySelector('#btn-continue') as HTMLElement;
      if (continueBtn) {
        continueBtn.style.display = state.character ? 'block' : 'none';
      }
    }
  }

  /**
   * Update player info in header
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

    // Update XP bar progress
    if (xpBar) {
      // XP needed formula: 100 + (level * 50)
      const xpNeeded = 100 + (character.level * 50);
      const currentXp = character.currentXp || 0;
      const percent = Math.min(100, (currentXp / xpNeeded) * 100);
      xpBar.style.width = `${percent}%`;
    }
  }

  /**
   * Load character classes for creation
   */
  private async loadClasses(): Promise<void> {
    this.classes = await this.manager.getClasses();
    this.renderClassGrid();
  }

  /**
   * Render class selection grid
   */
  private renderClassGrid(): void {
    const grid = this.container?.querySelector('#class-grid');
    if (!grid) return;

    const classIcons: Record<string, string> = {
      scholar: SQ_ICONS.scholarLarge,
      knight: SQ_ICONS.knightLarge,
      rogue: SQ_ICONS.rogueLarge,
    };

    grid.innerHTML = this.classes
      .map(
        (cls) => `
        <div class="studyquest-class-card" data-class="${cls.id}">
          <div class="studyquest-class-icon">${classIcons[cls.id] || SQ_ICONS.catLarge}</div>
          <h3 class="studyquest-class-name">${cls.name}</h3>
          <p class="studyquest-class-desc">${cls.description}</p>
          <div class="studyquest-class-stats">
            <div class="studyquest-class-stat">
              <span>HP</span>
              <span class="studyquest-class-stat-value">${cls.baseHp}</span>
            </div>
            <div class="studyquest-class-stat">
              <span>ATK</span>
              <span class="studyquest-class-stat-value">${cls.baseAttack}</span>
            </div>
            <div class="studyquest-class-stat">
              <span>DEF</span>
              <span class="studyquest-class-stat-value">${cls.baseDefense}</span>
            </div>
            <div class="studyquest-class-stat">
              <span>SPD</span>
              <span class="studyquest-class-stat-value">${cls.baseSpeed}</span>
            </div>
          </div>
        </div>
      `
      )
      .join('');

    // Add class selection listeners
    grid.querySelectorAll('.studyquest-class-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        grid.querySelectorAll('.studyquest-class-card').forEach((c) => c.classList.remove('selected'));
        (e.currentTarget as HTMLElement).classList.add('selected');
        this.validateCharacterForm();
      });
    });
  }

  /**
   * Validate character creation form
   */
  private validateCharacterForm(): void {
    const nameInput = this.container?.querySelector('#character-name-input') as HTMLInputElement;
    const selectedClass = this.container?.querySelector('.studyquest-class-card.selected');
    const createBtn = this.container?.querySelector('#btn-create-character') as HTMLButtonElement;

    const isValid = nameInput?.value.trim().length >= 2 && selectedClass !== null;
    if (createBtn) createBtn.disabled = !isValid;
  }

  /**
   * Create character
   */
  private async createCharacter(): Promise<void> {
    const nameInput = this.container?.querySelector('#character-name-input') as HTMLInputElement;
    const selectedClass = this.container?.querySelector('.studyquest-class-card.selected');

    if (!nameInput || !selectedClass) return;

    const name = nameInput.value.trim();
    const classId = selectedClass.getAttribute('data-class');

    if (!classId) return;

    const success = await this.manager.createCharacter(name, classId as any);
    if (success) {
      StudyQuestSound.play('menu-confirm');
      this.showView('town');
    } else {
      StudyQuestSound.play('error');
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
   * Handle inn (healing)
   * Shows cost confirmation before healing
   */
  private async handleInn(): Promise<void> {
    const state = this.manager.getState();
    const char = state.character;
    if (!char) return;

    // Check if already at full health
    const healingInfo = this.manager.getInnHealingCost();
    if (!healingInfo || healingInfo.missingHp === 0) {
      this.showToast('Already at full health!');
      return;
    }

    // Check if enough gold
    if (char.gold < healingInfo.cost) {
      this.showToast(`Not enough gold! Need ${healingInfo.cost}G`);
      return;
    }

    // Show confirmation dialog
    const confirmed = await this.showConfirmDialog(
      'Rest at Inn',
      `Restore ${healingInfo.missingHp} HP for ${healingInfo.cost} Gold?`
    );

    if (confirmed) {
      const success = await this.manager.healCharacter(healingInfo.cost);
      if (success) {
        // Manager handles notification
        this.renderCharacterSheet();
        this.updatePlayerInfo(this.manager.getState().character);
      }
    }
  }

  /**
   * Show a toast message
   */
  private showToast(message: string): void {
    // Use the existing notification ticker if available
    const ticker = (window as any).notificationTicker;
    if (ticker) {
      ticker.show(message);
    } else {
      console.log('[Toast]', message);
    }
  }

  /**
   * Show a confirmation dialog
   * Returns true if user confirms, false if cancelled
   */
  private async showConfirmDialog(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Create dialog overlay
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

      const cancelBtn = overlay.querySelector('.studyquest-confirm-cancel');
      const okBtn = overlay.querySelector('.studyquest-confirm-ok');

      cancelBtn?.addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });

      okBtn?.addEventListener('click', () => {
        overlay.remove();
        resolve(true);
      });

      this.container?.appendChild(overlay);
    });
  }

  /**
   * Render character sheet
   */
  private renderCharacterSheet(): void {
    const content = this.container?.querySelector('#character-sheet-content');
    const state = this.manager.getState();
    const char = state.character;

    if (!content || !char) return;

    const classIcons: Record<string, string> = {
      scholar: pixelIcon('magic', 96),
      knight: pixelIcon('shield', 96),
      rogue: pixelIcon('sword', 96),
    };

    content.innerHTML = `
      <div class="pixel-card studyquest-character-portrait">
        <div class="studyquest-portrait-icon">${classIcons[char.classId] || pixelIcon('catnip', 96)}</div>
        <h3 class="studyquest-character-name">${char.name}</h3>
        <p class="studyquest-character-class">${char.classId.charAt(0).toUpperCase() + char.classId.slice(1)}</p>
        <p class="studyquest-character-level">Level ${char.level}</p>
        <div style="margin-top: 16px;">
          <div class="pixel-bar-container" style="margin-bottom: 8px;">
            <div class="pixel-bar pixel-bar-xp" style="width: ${(char.currentXp / (100 + char.level * 50)) * 100}%;"></div>
            <span class="pixel-bar-label">${char.currentXp} / ${100 + char.level * 50} XP</span>
          </div>
        </div>
      </div>
      <div class="pixel-card studyquest-stats-panel">
        <div class="studyquest-stat-row">
          <span class="studyquest-stat-label">${SQ_ICONS.hp} HP</span>
          <span class="studyquest-stat-value">${char.hp} / ${char.maxHp}</span>
        </div>
        <div class="studyquest-stat-row">
          <span class="studyquest-stat-label">${SQ_ICONS.atk} Attack</span>
          <span class="studyquest-stat-value">${char.attack}</span>
        </div>
        <div class="studyquest-stat-row">
          <span class="studyquest-stat-label">${SQ_ICONS.def} Defense</span>
          <span class="studyquest-stat-value">${char.defense}</span>
        </div>
        <div class="studyquest-stat-row">
          <span class="studyquest-stat-label">${SQ_ICONS.spd} Speed</span>
          <span class="studyquest-stat-value">${char.speed}</span>
        </div>
        <div class="studyquest-stat-row">
          <span class="studyquest-stat-label">${SQ_ICONS.gold} Gold</span>
          <span class="studyquest-stat-value">${char.gold}</span>
        </div>
        <div class="studyquest-stat-row">
          <span class="studyquest-stat-label">${SQ_ICONS.trophy} Battles Won</span>
          <span class="studyquest-stat-value">${char.battlesWon}</span>
        </div>
        <div class="studyquest-stat-row">
          <span class="studyquest-stat-label">${SQ_ICONS.quest} Quests Done</span>
          <span class="studyquest-stat-value">${char.questsCompleted}</span>
        </div>
      </div>
    `;
  }

  /**
   * Load inventory
   */
  private async loadInventory(): Promise<void> {
    const grid = this.container?.querySelector('#inventory-grid');
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
             title="${slot.item.name}">
          <span class="studyquest-inventory-slot-icon">
            ${itemIcons[slot.item.itemType] || SQ_ICONS.item}
          </span>
          ${slot.quantity > 1 ? `<span class="studyquest-inventory-slot-qty">${slot.quantity}</span>` : ''}
        </div>
      `
      )
      .join('');

    // Add click handlers for items
    grid.querySelectorAll('.studyquest-inventory-slot').forEach((slot) => {
      slot.addEventListener('click', async (e) => {
        const itemId = (e.currentTarget as HTMLElement).dataset.itemId;
        if (itemId) {
          // TODO: Show item details / use / equip menu
          logger.info(`Clicked item: ${itemId}`);
        }
      });
    });
  }

  /**
   * Load shop items
   */
  private async loadShop(): Promise<void> {
    const grid = this.container?.querySelector('#shop-grid');
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

    grid.innerHTML = items
      .map(
        (item) => `
        <div class="studyquest-shop-item">
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
            ${item.healAmount ? `+${item.healAmount} HP ` : ''}
          </p>
          <p class="studyquest-item-desc">${item.description || ''}</p>
          <div class="studyquest-item-price">
            <span class="studyquest-price">${SQ_ICONS.gold} ${item.buyPrice ?? 0}</span>
            <button class="pixel-btn pixel-btn-gold studyquest-buy-btn" data-item-id="${item.id}">
              Buy
            </button>
          </div>
        </div>
      `
      )
      .join('');

    // Add buy handlers
    grid.querySelectorAll('.studyquest-buy-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const itemId = (e.currentTarget as HTMLElement).dataset.itemId;
        if (itemId) {
          const success = await this.manager.buyItem(itemId);
          if (success) {
            StudyQuestSound.play('item-pickup');
          } else {
            StudyQuestSound.play('error');
          }
        }
      });
    });
  }

  /**
   * Load dungeons
   */
  private async loadDungeons(): Promise<void> {
    const list = this.container?.querySelector('#dungeon-list');
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
            // TODO: Start dungeon run view
            this.showView('dungeon-run');
          }
        }
      });
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

    // Group by type
    const dailyQuests = quests.filter((q) => q.quest.questType === 'daily');
    const weeklyQuests = quests.filter((q) => q.quest.questType === 'weekly');
    const storyQuests = quests.filter((q) => q.quest.questType === 'story');

    const renderQuestList = (questList: typeof quests, title: string, icon: string) => {
      if (questList.length === 0) return '';
      return `
        <div class="studyquest-quest-section">
          <h3 class="studyquest-quest-section-title">${icon} ${title}</h3>
          <div class="studyquest-quest-list">
            ${questList
              .map((q) => {
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
                  ${
                    isComplete
                      ? `<button class="pixel-btn pixel-btn-success studyquest-quest-claim" data-quest-id="${q.quest.id}">Claim Reward</button>`
                      : ''
                  }
                </div>
              `;
              })
              .join('')}
          </div>
        </div>
      `;
    };

    content.innerHTML =
      renderQuestList(dailyQuests, 'Daily Quests', SQ_ICONS.daily) +
      renderQuestList(weeklyQuests, 'Weekly Quests', SQ_ICONS.weekly) +
      renderQuestList(storyQuests, 'Story Quests', SQ_ICONS.story);

    // Add claim handlers
    content.querySelectorAll('.studyquest-quest-claim').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const questId = (e.currentTarget as HTMLElement).dataset.questId;
        if (questId) {
          StudyQuestSound.play('quest-complete');
          await this.manager.completeQuest(questId);
          await this.loadQuests(); // Refresh
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
          ${leaderboard
            .map((entry, index) => {
              const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
              return `
              <tr class="studyquest-leaderboard-row">
                <td class="studyquest-leaderboard-cell studyquest-leaderboard-rank ${rankClass}">
                  #${index + 1}
                </td>
                <td class="studyquest-leaderboard-cell studyquest-leaderboard-name">
                  ${entry.characterName}
                </td>
                <td class="studyquest-leaderboard-cell studyquest-leaderboard-level">
                  Lv. ${entry.level}
                </td>
                <td class="studyquest-leaderboard-cell studyquest-leaderboard-xp">
                  ${entry.totalXpEarned} XP
                </td>
              </tr>
            `;
            })
            .join('')}
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

    // Create or refresh collection screen
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

    // Build stats for unlock checking
    const stats = PlayerStatsService.getStats();

    // Update stats from character data
    stats.level = character.level;
    stats.battlesWon = character.battlesWon;
    stats.totalGoldCollected = character.totalGoldEarned || 0;
    stats.questsCompleted = character.questsCompleted;
    stats.characterName = character.name;
    stats.currentMonth = new Date().getMonth() + 1;

    // Check for unlocks
    const newUnlocks = UnlockManager.checkUnlocks(stats);

    // Show celebration for new unlocks
    if (newUnlocks.length > 0) {
      const unlockables = UnlockManager.getNewUnlocks();
      if (unlockables.length > 0) {
        unlockCelebration.show(unlockables);
        UnlockManager.clearNewUnlocks();
      }
    }
  }

  // ============================================================================
  // Dungeon Run
  // ============================================================================

  /**
   * Initialize dungeon run view
   */
  private initDungeonRun(): void {
    const state = this.manager.getState();
    const dungeonState = state.dungeonState;
    const nameEl = this.container?.querySelector('#dungeon-name');

    if (!dungeonState) {
      this.showView('town');
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
      const canvasContainer = this.container?.querySelector('#dungeon-canvas-container') as HTMLElement;
      const classicContainer = this.container?.querySelector('#dungeon-run-content') as HTMLElement;

      if (canvasContainer) canvasContainer.style.display = 'block';
      if (classicContainer) classicContainer.style.display = 'none';

      // Initialize dungeon in explore view
      this.dungeonExploreView.initialize(
        dungeonState.dungeonId,
        dungeon?.name || 'Dungeon',
        totalFloors
      );

      // Update player HP
      const char = state.character;
      if (char) {
        this.dungeonExploreView.updatePlayerHp(char.hp, char.maxHp);
      }

      this.dungeonExploreView.start();
    } else {
      // Classic mode
      const canvasContainer = this.container?.querySelector('#dungeon-canvas-container') as HTMLElement;
      const classicContainer = this.container?.querySelector('#dungeon-run-content') as HTMLElement;

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
   * Render classic dungeon run view (button-based)
   */
  private renderDungeonRunClassic(): void {
    const content = this.container?.querySelector('#dungeon-run-content');
    const nameEl = this.container?.querySelector('#dungeon-name');
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
          <button class="pixel-btn pixel-btn-danger" id="btn-encounter">
            ${SQ_ICONS.attack} Find Enemy
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
    content.querySelector('#btn-encounter')?.addEventListener('click', async () => {
      await this.startEncounter(false);
    });

    content.querySelector('#btn-next-floor')?.addEventListener('click', async () => {
      // Advance to next floor
      const state = this.manager.getState();
      if (state.dungeonState) {
        state.dungeonState.currentFloor++;
        this.renderDungeonRunClassic();
      }
    });

    content.querySelector('#btn-boss-fight')?.addEventListener('click', async () => {
      await this.startEncounter(true);
    });

    content.querySelector('#btn-leave-dungeon')?.addEventListener('click', async () => {
      await this.manager.abandonDungeon();
      this.showView('town');
    });
  }

  /**
   * Render dungeon completion screen
   */
  private renderDungeonComplete(): void {
    const content = this.container?.querySelector('#view-dungeon-complete .studyquest-content') as HTMLElement;
    if (!content) return;

    const rewards = this.dungeonCompletionRewards;
    const state = this.manager.getState();
    const character = state.character;

    if (!rewards || !character) {
      this.showView('town');
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

        <button id="btn-return-to-town" class="studyquest-btn studyquest-btn-primary" style="margin-top: 24px;">
          ${SQ_ICONS.arrowLeft} Return to Town
        </button>
      </div>
    `;

    content.querySelector('#btn-return-to-town')?.addEventListener('click', () => {
      this.dungeonCompletionRewards = null;
      this.showView('town');
    });
  }

  /**
   * Start a battle encounter
   */
  private async startEncounter(isBoss: boolean): Promise<void> {
    this.isCurrentBattleBoss = isBoss;
    const battle = await this.manager.startBattle(isBoss);
    if (battle) {
      this.showView('battle');
    }
  }

  // ============================================================================
  // Battle System
  // ============================================================================

  /**
   * Initialize battle view
   */
  private initBattle(): void {
    const state = this.manager.getState();
    const battle = state.currentBattle;
    const character = state.character;

    if (!battle || !character) {
      logger.warn('No active battle to display');
      this.showView('dungeon-run');
      return;
    }

    // Initialize canvas
    const canvas = this.container?.querySelector('#battle-canvas') as HTMLCanvasElement;
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
  private async handleBattleAction(action: string): Promise<void> {
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
        this.handleBattleLogEntry(result.playerLog);

        // Check if battle ended after player action
        if (result.battle.result !== 'in_progress') {
          await this.handleBattleEnd(result.battle);
          return;
        }

        // Show enemy action if there was one
        if (result.enemyLog) {
          // Delay enemy action display for better UX
          setTimeout(() => {
            if (result.enemyLog) {
              this.handleBattleLogEntry(result.enemyLog);
            }

            // Check if battle ended after enemy action
            if (result.battle.result !== 'in_progress') {
              this.handleBattleEnd(result.battle);
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
    } else if (battle.result === 'defeat') {
      // Play death animation for player before defeat message
      await this.battleCanvas?.playDeathAnimation('player');

      StudyQuestSound.play('defeat');
      this.addBattleLogEntry('DEFEAT...', 'damage');
      this.addBattleLogEntry('Lost 25% gold. Returning to town...', 'miss');
    } else if (battle.result === 'fled') {
      // Flee sound already played in handleBattleLogEntry
      this.addBattleLogEntry('Escaped successfully!', 'info');
    }

    // Wait, then return to appropriate view
    setTimeout(async () => {
      this.battleCanvas?.clear();
      this.isBattleProcessing = false;
      this.isCurrentBattleBoss = false;

      if (battle.result === 'defeat') {
        this.dungeonExploreView?.stop();
        this.showView('town');
      } else if (isBossVictoryOnFinalFloor) {
        // Complete the dungeon and show completion screen
        this.dungeonExploreView?.stop();
        const completionResult = await this.manager.completeDungeon();
        if (completionResult) {
          this.dungeonCompletionRewards = completionResult;
        }
        this.showView('dungeon-complete');
      } else {
        // Resume exploration after victory or flee
        this.showView('dungeon-run');
        this.resumeDungeonExploration();
      }
    }, 2500);
  }

  /**
   * Update battle action buttons enabled state
   */
  private updateBattleActionButtons(enabled: boolean): void {
    this.container?.querySelectorAll('.studyquest-battle-action').forEach((btn) => {
      (btn as HTMLButtonElement).disabled = !enabled;
    });
  }

  /**
   * Show item selection panel in battle
   */
  private showBattleItems(): void {
    const actionsPanel = this.container?.querySelector('#battle-actions') as HTMLElement;
    const itemsPanel = this.container?.querySelector('#battle-items') as HTMLElement;
    const itemsGrid = this.container?.querySelector('#battle-items-grid') as HTMLElement;

    if (!itemsPanel || !actionsPanel || !itemsGrid) return;

    // Get consumable items
    const consumables = this.manager.getConsumableItems();

    if (consumables.length === 0) {
      this.addBattleLogEntry('No items available!', 'miss');
      // Re-enable action buttons since we're not showing items panel
      this.updateBattleActionButtons(true);
      return;
    }

    // Render items
    itemsGrid.innerHTML = consumables
      .map(
        (slot) => `
        <button class="studyquest-battle-item-btn" data-item-id="${slot.item.id}" title="${slot.item.description || slot.item.name}">
          <span class="item-icon">${slot.item.icon || '🧪'}</span>
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
    actionsPanel.style.display = 'none';
    itemsPanel.style.display = 'flex';
  }

  /**
   * Hide item selection panel and show action buttons
   */
  private hideBattleItems(): void {
    const actionsPanel = this.container?.querySelector('#battle-actions') as HTMLElement;
    const itemsPanel = this.container?.querySelector('#battle-items') as HTMLElement;

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

    const success = await this.manager.useItemInBattle(itemId);
    if (!success) {
      this.addBattleLogEntry('Failed to use item!', 'miss');
      this.isBattleProcessing = false;
      this.updateBattleActionButtons(true);
      return;
    }

    // Update battle state - manager already handled the battle action
    const state = this.manager.getState();
    if (state.currentBattle) {
      this.battleCanvas?.updateBattle(state.currentBattle);

      // Check if battle ended
      if (state.currentBattle.result !== 'in_progress') {
        await this.handleBattleEnd(state.currentBattle);
      } else if (state.currentBattle.currentTurn === 'player') {
        this.updateBattleActionButtons(true);
      }
    }

    this.isBattleProcessing = false;
  }

  /**
   * Add entry to battle log
   */
  private addBattleLogEntry(message: string, type?: string): void {
    const log = this.container?.querySelector('#battle-log');
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
  private clearBattleLog(): void {
    const log = this.container?.querySelector('#battle-log');
    if (log) {
      log.innerHTML = '';
    }
  }
}
