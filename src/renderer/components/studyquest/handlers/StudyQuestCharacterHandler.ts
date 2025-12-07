/**
 * StudyQuestCharacterHandler
 *
 * Handles character creation, character sheet, and class selection for StudyQuest.
 * Includes cat preview animation and stat explanations.
 */

import { createLogger } from '../../../../shared/logger.js';
import type { StudyQuestManager } from '../../../managers/StudyQuestManager.js';
import type { CharacterClassData, CharacterClass } from '../../../../domain/entities/StudyQuestCharacter.js';
import { SpriteLoader, type CatColor } from '../SpriteLoader.js';
import { StudyQuestSound } from '../StudyQuestSound.js';
import { getXpRequiredForLevel, getXpProgress } from '../../../../domain/entities/StudyQuestCharacter.js';
import type { CharacterHandlerCallbacks } from './types.js';
import { SQ_ICONS, pixelIcon } from './types.js';

const logger = createLogger('StudyQuestCharacterHandler');

// Stat explanations for tooltips (Item 7)
const STAT_EXPLANATIONS: Record<string, string> = {
  hp: 'Health Points. Reach 0 and you lose the battle.',
  attack: 'Determines damage dealt. Final damage = ATK - enemy DEF.',
  defense: 'Reduces incoming damage. Higher = less damage taken.',
  speed: 'Affects turn order and flee chance. +10% flee per SPD above enemy.',
  gold: 'Currency for buying items at the shop.',
  xp: 'Experience Points. Earn enough to level up!',
};

export class StudyQuestCharacterHandler {
  private container: HTMLElement;
  private manager: StudyQuestManager;
  private callbacks: CharacterHandlerCallbacks;
  private classes: CharacterClassData[] = [];
  private selectedColor: CatColor = 'brown';

  // Cat preview animation (Item 5)
  private catPreviewCanvas: HTMLCanvasElement | null = null;
  private catPreviewCtx: CanvasRenderingContext2D | null = null;
  private previewAnimationFrame: number | null = null;
  private previewFrameCounter = 0;

  constructor(
    container: HTMLElement,
    manager: StudyQuestManager,
    callbacks: CharacterHandlerCallbacks
  ) {
    this.container = container;
    this.manager = manager;
    this.callbacks = callbacks;

    // Item 10: Load color from consolidated manager state
    this.selectedColor = this.manager.getSelectedCatColor();
  }

  /**
   * Get selected cat color
   */
  getSelectedColor(): CatColor {
    return this.selectedColor;
  }

  /**
   * Set selected cat color (Item 10: Uses consolidated manager state)
   */
  setSelectedColor(color: CatColor): void {
    this.selectedColor = color;
    this.manager.setSelectedCatColor(color);
  }

  /**
   * Load character classes for creation
   */
  async loadClasses(): Promise<void> {
    this.classes = await this.manager.getClasses();
    this.renderClassGrid();
    this.initCatPreview();
  }

  /**
   * Render class selection grid
   */
  private renderClassGrid(): void {
    const grid = this.container.querySelector('#class-grid');
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
  validateCharacterForm(): void {
    const nameInput = this.container.querySelector('#character-name-input') as HTMLInputElement;
    const selectedClass = this.container.querySelector('.studyquest-class-card.selected');
    const createBtn = this.container.querySelector('#btn-create-character') as HTMLButtonElement;

    const isValid = nameInput?.value.trim().length >= 2 && selectedClass !== null;
    if (createBtn) createBtn.disabled = !isValid;
  }

  /**
   * Create character
   * @param forceReplace If true, delete existing character first
   */
  async createCharacter(forceReplace = false): Promise<boolean> {
    const nameInput = this.container.querySelector('#character-name-input') as HTMLInputElement;
    const selectedClass = this.container.querySelector('.studyquest-class-card.selected');

    if (!nameInput || !selectedClass) return false;

    const name = nameInput.value.trim();
    const classId = selectedClass.getAttribute('data-class');

    if (!classId) return false;

    const success = await this.manager.createCharacter(name, classId as CharacterClass, forceReplace);
    if (success) {
      StudyQuestSound.play('menu-confirm');
      this.stopPreviewAnimation();
      return true;
    } else {
      // Check if this is a duplicate character error
      if (this.manager.hasExistingCharacterError()) {
        // Show confirmation dialog
        const confirmed = await this.showReplaceConfirmation();
        if (confirmed) {
          // Retry with force replace
          return this.createCharacter(true);
        }
      } else {
        StudyQuestSound.play('error');
      }
      return false;
    }
  }

  /**
   * Show confirmation dialog for replacing existing character
   */
  private showReplaceConfirmation(): Promise<boolean> {
    return new Promise((resolve) => {
      // Create confirmation overlay
      const overlay = document.createElement('div');
      overlay.className = 'studyquest-confirm-overlay';
      overlay.innerHTML = `
        <div class="studyquest-confirm-dialog pixel-card">
          <h3 class="studyquest-confirm-title">${pixelIcon('warning', 24)} Character Exists</h3>
          <p class="studyquest-confirm-message">
            You already have a character. Starting a new game will <strong>permanently delete</strong> all your progress, items, and gold.
          </p>
          <div class="studyquest-confirm-actions">
            <button class="pixel-btn" id="confirm-cancel">Cancel</button>
            <button class="pixel-btn pixel-btn-danger" id="confirm-replace">Delete & Start New</button>
          </div>
        </div>
      `;

      this.container.appendChild(overlay);
      StudyQuestSound.play('menu-open');

      // Add event listeners
      overlay.querySelector('#confirm-cancel')?.addEventListener('click', () => {
        StudyQuestSound.play('menu-close');
        overlay.remove();
        resolve(false);
      });

      overlay.querySelector('#confirm-replace')?.addEventListener('click', () => {
        StudyQuestSound.play('menu-confirm');
        overlay.remove();
        resolve(true);
      });

      // Close on backdrop click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          StudyQuestSound.play('menu-close');
          overlay.remove();
          resolve(false);
        }
      });
    });
  }

  // ============================================================================
  // Cat Preview Animation (Item 5)
  // ============================================================================

  /**
   * Initialize cat preview canvas
   */
  private initCatPreview(): void {
    // Check if preview canvas exists, if not create it
    let previewContainer = this.container.querySelector('.studyquest-cat-preview');
    if (!previewContainer) {
      // Insert preview before color picker
      const colorPicker = this.container.querySelector('#color-picker');
      if (colorPicker) {
        previewContainer = document.createElement('div');
        previewContainer.className = 'studyquest-cat-preview';
        previewContainer.innerHTML = `
          <canvas id="cat-preview-canvas" width="128" height="128"></canvas>
          <p class="preview-label">Your Cat</p>
        `;
        colorPicker.parentNode?.insertBefore(previewContainer, colorPicker);
      }
    }

    this.catPreviewCanvas = this.container.querySelector('#cat-preview-canvas');
    if (!this.catPreviewCanvas) return;

    this.catPreviewCtx = this.catPreviewCanvas.getContext('2d');
    if (this.catPreviewCtx) {
      this.catPreviewCtx.imageSmoothingEnabled = false;
    }

    this.updateCatPreview();
  }

  /**
   * Update cat preview with current color
   */
  async updateCatPreview(): Promise<void> {
    if (!this.catPreviewCtx) return;

    // Load sprite for current color
    await SpriteLoader.loadCatSprites(this.selectedColor);

    // Start animation loop
    this.startPreviewAnimation();
  }

  /**
   * Start preview animation loop
   */
  private startPreviewAnimation(): void {
    if (this.previewAnimationFrame) return;

    const animate = () => {
      this.renderCatPreview();
      this.previewFrameCounter++;
      this.previewAnimationFrame = requestAnimationFrame(animate);
    };

    this.previewAnimationFrame = requestAnimationFrame(animate);
  }

  /**
   * Stop preview animation
   */
  stopPreviewAnimation(): void {
    if (this.previewAnimationFrame) {
      cancelAnimationFrame(this.previewAnimationFrame);
      this.previewAnimationFrame = null;
    }
  }

  /**
   * Render cat preview frame
   */
  private renderCatPreview(): void {
    if (!this.catPreviewCtx || !this.catPreviewCanvas) return;

    const ctx = this.catPreviewCtx;
    const canvas = this.catPreviewCanvas;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw cat idle animation
    const sprite = SpriteLoader.getCatSprite(this.selectedColor, 'idle');
    if (sprite) {
      const frameIndex = Math.floor(this.previewFrameCounter / 8) % sprite.frameCount;
      // Scale 3 = 96x96 sprite. Center on 128x128 canvas:
      // x = 64 (center, drawFrame uses x - width/2)
      // y = (128 - 96) / 2 = 16 (top of sprite for vertical centering)
      SpriteLoader.drawFrame(ctx, sprite, frameIndex, 64, 16, 3, false);
    }
  }

  /**
   * Handle color selection (Item 10: Uses consolidated manager state)
   */
  handleColorSelection(colorId: CatColor): void {
    this.selectedColor = colorId;
    this.manager.setSelectedCatColor(colorId);
    this.updateCatPreview();
  }

  // ============================================================================
  // Character Sheet (with Item 7: Stat Explanations)
  // ============================================================================

  /**
   * Render character sheet
   */
  renderCharacterSheet(): void {
    const content = this.container.querySelector('#character-sheet-content');
    const state = this.manager.getState();
    const char = state.character;

    if (!content || !char) return;

    const classIcons: Record<string, string> = {
      scholar: pixelIcon('magic', 96),
      knight: pixelIcon('shield', 96),
      rogue: pixelIcon('sword', 96),
    };

    // Get XP progress using centralized formula
    const xpProgress = getXpProgress(char);

    // Get equipped items info
    const inventory = state.inventory || [];
    const equippedWeapon = inventory.find(s => s.item.id === char.equippedWeaponId);
    const equippedArmor = inventory.find(s => s.item.id === char.equippedArmorId);

    content.innerHTML = `
      <div class="pixel-card studyquest-character-portrait">
        <div class="studyquest-portrait-icon">${classIcons[char.classId] || pixelIcon('catnip', 96)}</div>
        <h3 class="studyquest-character-name">${char.name}</h3>
        <p class="studyquest-character-class">${char.classId.charAt(0).toUpperCase() + char.classId.slice(1)}</p>
        <p class="studyquest-character-level">Level ${char.level}</p>
        <div style="margin-top: 16px;">
          <div class="pixel-bar-container" style="margin-bottom: 8px;">
            <div class="pixel-bar pixel-bar-xp" style="width: ${xpProgress.percent}%;"></div>
            <span class="pixel-bar-label">${xpProgress.current} / ${xpProgress.required} XP</span>
          </div>
        </div>
      </div>

      <div class="pixel-card studyquest-equipment-section">
        <h3>Equipment</h3>
        <div class="studyquest-equipment-slots">
          <div class="studyquest-equipment-slot">
            <span class="slot-label">${SQ_ICONS.weapon} Weapon:</span>
            <span class="slot-value">${equippedWeapon ? equippedWeapon.item.name : 'None'}</span>
          </div>
          <div class="studyquest-equipment-slot">
            <span class="slot-label">${SQ_ICONS.armor} Armor:</span>
            <span class="slot-value">${equippedArmor ? equippedArmor.item.name : 'None'}</span>
          </div>
        </div>
      </div>

      <div class="pixel-card studyquest-stats-panel">
        <div class="studyquest-stat-row">
          <span class="studyquest-stat-label">
            ${SQ_ICONS.hp} HP
            <span class="stat-info" data-tooltip="${STAT_EXPLANATIONS.hp}">?</span>
          </span>
          <span class="studyquest-stat-value">${char.hp} / ${char.maxHp}</span>
        </div>
        <div class="studyquest-stat-row">
          <span class="studyquest-stat-label">
            ${SQ_ICONS.atk} Attack
            <span class="stat-info" data-tooltip="${STAT_EXPLANATIONS.attack}">?</span>
          </span>
          <span class="studyquest-stat-value">${char.attack}</span>
        </div>
        <div class="studyquest-stat-row">
          <span class="studyquest-stat-label">
            ${SQ_ICONS.def} Defense
            <span class="stat-info" data-tooltip="${STAT_EXPLANATIONS.defense}">?</span>
          </span>
          <span class="studyquest-stat-value">${char.defense}</span>
        </div>
        <div class="studyquest-stat-row">
          <span class="studyquest-stat-label">
            ${SQ_ICONS.spd} Speed
            <span class="stat-info" data-tooltip="${STAT_EXPLANATIONS.speed}">?</span>
          </span>
          <span class="studyquest-stat-value">${char.speed}</span>
        </div>
        <div class="studyquest-stat-row">
          <span class="studyquest-stat-label">
            ${SQ_ICONS.gold} Gold
            <span class="stat-info" data-tooltip="${STAT_EXPLANATIONS.gold}">?</span>
          </span>
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
   * Cleanup resources
   */
  cleanup(): void {
    this.stopPreviewAnimation();
    this.catPreviewCanvas = null;
    this.catPreviewCtx = null;
  }
}
