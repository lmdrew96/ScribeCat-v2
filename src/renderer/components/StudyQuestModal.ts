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
import { getIconHTML } from '../utils/iconMap.js';
import { BattleCanvas } from './studyquest/BattleCanvas.js';
import type { CatColor } from './studyquest/SpriteLoader.js';
import { StudyQuestSound } from './studyquest/StudyQuestSound.js';

// Available cat colors for character creation
const CAT_COLORS: { id: CatColor; name: string; hex: string }[] = [
  { id: 'brown', name: 'Brown', hex: '#8B4513' },
  { id: 'orange', name: 'Orange', hex: '#FF8C00' },
  { id: 'grey', name: 'Grey', hex: '#708090' },
  { id: 'black', name: 'Black', hex: '#2F2F2F' },
  { id: 'white', name: 'White', hex: '#F5F5F5' },
];

const logger = createLogger('StudyQuestModal');

// SVG icon constants for StudyQuest (16-bit retro style)
const SQ_ICONS = {
  // Header icons
  gamepad: getIconHTML('gamepad', { size: 24, strokeWidth: 2 }),
  heart: getIconHTML('flame', { size: 14, strokeWidth: 2, color: '#ff4444' }),
  star: getIconHTML('star', { size: 14, strokeWidth: 2, color: '#ffd700' }),
  coin: getIconHTML('gem', { size: 14, strokeWidth: 2, color: '#ffd700' }),

  // Character class icons (24px for cards)
  scholar: getIconHTML('book', { size: 24, strokeWidth: 2 }),
  knight: getIconHTML('shield', { size: 24, strokeWidth: 2 }),
  rogue: getIconHTML('zap', { size: 24, strokeWidth: 2 }),
  cat: getIconHTML('smile', { size: 24, strokeWidth: 2 }),

  // Building icons (32px for town)
  castle: getIconHTML('map', { size: 32, strokeWidth: 2 }),
  shop: getIconHTML('gem', { size: 32, strokeWidth: 2 }),
  inn: getIconHTML('coffee', { size: 32, strokeWidth: 2 }),
  questBoard: getIconHTML('clipboard', { size: 32, strokeWidth: 2 }),

  // Item type icons
  weapon: getIconHTML('zap', { size: 20, strokeWidth: 2 }),
  armor: getIconHTML('shield', { size: 20, strokeWidth: 2 }),
  potion: getIconHTML('flame', { size: 20, strokeWidth: 2, color: '#66ff66' }),
  keyItem: getIconHTML('lock', { size: 20, strokeWidth: 2 }),
  item: getIconHTML('gem', { size: 20, strokeWidth: 2 }),

  // Battle action icons
  attack: getIconHTML('zap', { size: 16, strokeWidth: 2 }),
  defend: getIconHTML('shield', { size: 16, strokeWidth: 2 }),
  itemUse: getIconHTML('flame', { size: 16, strokeWidth: 2 }),
  flee: getIconHTML('arrowRight', { size: 16, strokeWidth: 2 }),

  // Dungeon icons (32px)
  training: getIconHTML('target', { size: 32, strokeWidth: 2 }),
  forest: getIconHTML('flame', { size: 32, strokeWidth: 2, color: '#4a9a4a' }),
  crystal: getIconHTML('gem', { size: 32, strokeWidth: 2, color: '#66ccff' }),
  library: getIconHTML('book', { size: 32, strokeWidth: 2 }),
  volcano: getIconHTML('flame', { size: 32, strokeWidth: 2, color: '#ff6600' }),
  void: getIconHTML('sparkles', { size: 32, strokeWidth: 2, color: '#aa66ff' }),
  lock: getIconHTML('lock', { size: 16, strokeWidth: 2 }),

  // Stat icons
  hp: getIconHTML('flame', { size: 14, strokeWidth: 2, color: '#ff4444' }),
  atk: getIconHTML('zap', { size: 14, strokeWidth: 2, color: '#ff8844' }),
  def: getIconHTML('shield', { size: 14, strokeWidth: 2, color: '#4488ff' }),
  spd: getIconHTML('rocket', { size: 14, strokeWidth: 2, color: '#44ff88' }),
  gold: getIconHTML('gem', { size: 14, strokeWidth: 2, color: '#ffd700' }),
  trophy: getIconHTML('trophy', { size: 14, strokeWidth: 2, color: '#ffd700' }),
  quest: getIconHTML('clipboard', { size: 14, strokeWidth: 2 }),

  // Quest type icons
  daily: getIconHTML('calendar', { size: 14, strokeWidth: 2 }),
  weekly: getIconHTML('calendar', { size: 14, strokeWidth: 2 }),
  story: getIconHTML('book', { size: 14, strokeWidth: 2 }),

  // Large portrait icons (48px)
  scholarLarge: getIconHTML('book', { size: 48, strokeWidth: 1.5 }),
  knightLarge: getIconHTML('shield', { size: 48, strokeWidth: 1.5 }),
  rogueLarge: getIconHTML('zap', { size: 48, strokeWidth: 1.5 }),
  catLarge: getIconHTML('smile', { size: 48, strokeWidth: 1.5 }),
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
  | 'battle'
  | 'quests'
  | 'leaderboard';

export class StudyQuestModal {
  private manager: StudyQuestManager;
  private container: HTMLElement | null = null;
  private backdrop: HTMLElement | null = null;
  private currentView: ViewType = 'title';
  private isOpen = false;
  private unsubscribe: (() => void) | null = null;
  private classes: CharacterClassData[] = [];
  private battleCanvas: BattleCanvas | null = null;
  private isBattleProcessing = false;
  private selectedColor: CatColor = 'brown';

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
    logger.info('StudyQuestModal DOM created');
  }

  /**
   * Open the StudyQuest modal
   */
  public async open(): Promise<void> {
    if (this.isOpen) return;

    this.isOpen = true;
    this.backdrop?.classList.add('active');
    this.container?.classList.add('active');

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
        <div class="studyquest-title">
          <span class="studyquest-title-icon">${SQ_ICONS.gamepad}</span>
          <h2>StudyQuest</h2>
        </div>
        <div class="studyquest-player-info" id="studyquest-player-info" style="display: none;">
          <div class="studyquest-stat">
            <span class="studyquest-stat-icon">${SQ_ICONS.heart}</span>
            <span class="studyquest-stat-value" id="studyquest-hp">--</span>
          </div>
          <div class="studyquest-stat">
            <span class="studyquest-stat-icon">${SQ_ICONS.star}</span>
            <span class="studyquest-stat-value" id="studyquest-level">Lv.--</span>
          </div>
          <div class="studyquest-stat">
            <span class="studyquest-stat-icon">${SQ_ICONS.coin}</span>
            <span class="studyquest-stat-value" id="studyquest-gold">--</span>
          </div>
        </div>
        <button class="studyquest-close-btn" id="studyquest-close">EXIT</button>
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
          <h2 class="studyquest-section-title">Cat Village</h2>
          <div class="studyquest-town">
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
          <h2 class="studyquest-section-title" id="dungeon-name">Dungeon</h2>
          <div id="dungeon-run-content">
            <!-- Populated dynamically -->
          </div>
        </div>

        <!-- Battle -->
        <div class="studyquest-view" id="view-battle">
          <div class="studyquest-battle" id="battle-content">
            <div class="studyquest-battle-canvas-container">
              <canvas class="studyquest-battle-canvas" id="battle-canvas" width="480" height="270"></canvas>
            </div>
            <div class="studyquest-battle-ui">
              <div class="studyquest-battle-actions">
                <button class="pixel-btn studyquest-battle-action" data-action="attack">${SQ_ICONS.attack} Attack</button>
                <button class="pixel-btn studyquest-battle-action" data-action="defend">${SQ_ICONS.defend} Defend</button>
                <button class="pixel-btn studyquest-battle-action" data-action="item">${SQ_ICONS.itemUse} Item</button>
                <button class="pixel-btn studyquest-battle-action" data-action="flee">${SQ_ICONS.flee} Flee</button>
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

    // Town buildings
    this.container.querySelectorAll('.studyquest-town-building').forEach((building) => {
      building.addEventListener('click', (e) => {
        const type = (e.currentTarget as HTMLElement).dataset.building;
        this.handleBuildingClick(type);
      });
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

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
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
    const showNav = view !== 'title' && view !== 'character-create';

    if (nav) nav.style.display = showNav ? 'flex' : 'none';
    if (playerInfo) playerInfo.style.display = showNav ? 'flex' : 'none';

    // Load view-specific data
    this.loadViewData(view);

    logger.info(`Showing view: ${view}`);
  }

  /**
   * Load data for specific view
   */
  private async loadViewData(view: ViewType): Promise<void> {
    switch (view) {
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
        this.renderDungeonRun();
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

    if (hpEl) hpEl.textContent = `${character.hp}/${character.maxHp}`;
    if (levelEl) levelEl.textContent = `Lv.${character.level}`;
    if (goldEl) goldEl.textContent = `${character.gold}`;
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
    }
  }

  /**
   * Handle inn (healing)
   */
  private async handleInn(): Promise<void> {
    const success = await this.manager.healCharacter();
    if (success) {
      // Show heal notification - manager handles this
    }
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
      scholar: getIconHTML('book', { size: 96, strokeWidth: 1 }),
      knight: getIconHTML('shield', { size: 96, strokeWidth: 1 }),
      rogue: getIconHTML('zap', { size: 96, strokeWidth: 1 }),
    };

    content.innerHTML = `
      <div class="pixel-card studyquest-character-portrait">
        <div class="studyquest-portrait-icon">${classIcons[char.classId] || getIconHTML('smile', { size: 96, strokeWidth: 1 })}</div>
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
            <span class="studyquest-price">${SQ_ICONS.gold} ${item.price}</span>
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

  // ============================================================================
  // Dungeon Run
  // ============================================================================

  /**
   * Render dungeon run view
   */
  private renderDungeonRun(): void {
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
        this.renderDungeonRun();
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
   * Start a battle encounter
   */
  private async startEncounter(isBoss: boolean): Promise<void> {
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
          // TODO: Show item selection modal
          this.addBattleLogEntry('No items available!', 'miss');
          this.isBattleProcessing = false;
          this.updateBattleActionButtons(true);
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
  private handleBattleLogEntry(entry: BattleLogEntry): void {
    const target = entry.actor === 'player' ? 'enemy' : 'player';

    if (entry.action === 'attack' && entry.damage) {
      this.battleCanvas?.playDamageAnimation(target, entry.damage, entry.isCritical || false);
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
      // Attack missed
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

    if (battle.result === 'victory') {
      StudyQuestSound.play('victory');
      this.addBattleLogEntry('VICTORY!', 'crit');
      if (battle.rewards) {
        this.addBattleLogEntry(`+${battle.rewards.xp} XP, +${battle.rewards.gold} Gold`, 'heal');
        setTimeout(() => StudyQuestSound.play('item-pickup'), 500);
      }
    } else if (battle.result === 'defeat') {
      StudyQuestSound.play('defeat');
      this.addBattleLogEntry('DEFEAT...', 'damage');
      this.addBattleLogEntry('Lost 25% gold. Returning to town...', 'miss');
    } else if (battle.result === 'fled') {
      // Flee sound already played in handleBattleLogEntry
      this.addBattleLogEntry('Escaped successfully!', 'info');
    }

    // Wait, then return to appropriate view
    setTimeout(() => {
      this.battleCanvas?.clear();
      this.isBattleProcessing = false;

      if (battle.result === 'defeat') {
        this.showView('town');
      } else {
        this.showView('dungeon-run');
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
