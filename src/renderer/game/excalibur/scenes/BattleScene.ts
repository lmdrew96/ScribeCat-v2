/**
 * ExcaliburBattleScene
 *
 * Turn-based combat scene against enemies.
 * Supports Attack, Magic, Defend, Item, Flee actions.
 * Uses actual enemy sprites from assets/ENEMIES.
 */

import * as ex from 'excalibur';
import { GameState } from '../../state/GameState.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../config.js';
import { loadCatAnimation, type CatColor } from '../adapters/SpriteAdapter.js';
import { InputManager } from '../adapters/InputAdapter.js';
import {
  calculateDamage,
  applyDamage,
  isDefeated,
  decideEnemyAction,
  attemptFlee,
  getLevelUpStats,
  type BattlePhase,
  type CombatStats,
} from '../../data/battle.js';
import { type EnemyDefinition, scaleEnemyStats, calculateGoldReward, calculateXpReward, calculateEnemyScale } from '../../data/enemies.js';
import { getItem } from '../../data/items.js';
import { loadBackground, createBackgroundActor } from '../../loaders/BackgroundLoader.js';
import {
  loadStaticEnemySprite,
  loadSlimeAnimation,
  getSlimeColorFromFolder,
  getStaticEnemyIdFromFile,
  type SlimeColor,
} from '../../loaders/EnemySpriteLoader.js';
import { AudioManager } from '../../audio/AudioManager.js';
import { createLogger } from '../../../../shared/logger.js';
import { MessageToast } from '../components/MessageToast.js';
import { BattleMenuOverlay } from '../components/BattleMenuOverlay.js';

const logger = createLogger('BattleScene');

// Battle UI Constants
const BATTLE_CONFIG = {
  enemySize: 80,
  playerSize: 64,
  manaPerMagicAttack: 10,
  magicDamageMultiplier: 1.5,
  hitFlashDuration: 150,
  shakeDuration: 300,
  shakeIntensity: 8,
  attackMoveDistance: 40,
  attackMoveDuration: 200,
  messageDisplayDuration: 1.5,
  inputCooldownDelay: 200,
  enemyTurnDelay: 800,
  turnTransitionDelay: 400,
  victoryDelay: 500,
} as const;

// Dungeon tier mapping for difficulty scaling
const DUNGEON_TIER_MAP: Record<string, number> = {
  training: 1,
  forest: 1,
  crystal: 2,
  library: 2,
  volcano: 3,
  void: 3,
};

export interface BattleSceneData {
  enemyDef: EnemyDefinition;
  floorLevel?: number;
  dungeonId?: string;
  returnScene: string;
  returnData?: unknown;
}

const ACTIONS = ['Attack', 'Magic', 'Defend', 'Item', 'Run'];

/**
 * Main Battle Scene
 */
export class BattleScene extends ex.Scene {
  private inputManager: InputManager | null = null;
  private sceneData: BattleSceneData | null = null;

  // Combat state
  private phase: BattlePhase = 'intro';
  private enemyStats: CombatStats | null = null;
  private playerStats: CombatStats | null = null;
  private playerDefending = false;
  private selectedAction = 0;
  private actionInProgress = false;

  // Item menu state
  private itemMenuVisible = false;
  private selectedItemIndex = 0;

  // UI elements
  private uiElements: ex.Actor[] = [];

  // HTML overlay components
  private messageToast: MessageToast | null = null;
  private battleMenuOverlay: BattleMenuOverlay | null = null;

  // Entity references
  private enemyEntity: ex.Actor | null = null;
  private playerEntity: ex.Actor | null = null;

  // Original positions for animations
  private playerStartPos: ex.Vector | null = null;
  private enemyStartPos: ex.Vector | null = null;
  
  // Player animations cache for battle
  private playerAnimations: Map<string, ex.Animation> = new Map();
  
  // Enemy animations cache for battle
  private enemyAnimations: Map<string, ex.Animation> = new Map();
  private enemyIsAnimated = false;

  // Callbacks
  public onBattleEnd: ((result: 'victory' | 'defeat' | 'flee', data?: unknown) => void) | null = null;

  onActivate(ctx: ex.SceneActivationContext<BattleSceneData>): void {
    this.sceneData = ctx.data || null;
    if (!this.sceneData) {
      logger.error('No battle data provided');
      return;
    }

    const { enemyDef, floorLevel = 1, dungeonId } = this.sceneData;
    
    // Calculate dungeon tier for scaling
    const dungeonTier = dungeonId ? (DUNGEON_TIER_MAP[dungeonId] || 1) : 1;

    // Initialize combat stats with floor and dungeon tier scaling
    const scaledEnemy = scaleEnemyStats(enemyDef, floorLevel, dungeonTier);
    this.enemyStats = {
      hp: scaledEnemy.hp,
      maxHp: scaledEnemy.hp,
      attack: scaledEnemy.attack,
      defense: scaledEnemy.defense,
    };

    this.playerStats = {
      hp: GameState.player.health,
      maxHp: GameState.getEffectiveMaxHealth(),
      attack: GameState.getEffectiveAttack(),
      defense: GameState.getEffectiveDefense(),
      luck: GameState.getEffectiveLuck(),
      mana: GameState.player.mana,
      maxMana: GameState.getEffectiveMaxMana(),
    };

    this.phase = 'intro';
    this.playerDefending = false;
    this.selectedAction = 0;
    this.actionInProgress = false;
    this.itemMenuVisible = false;

    this.clear();
    this.setupBackground();
    this.setupCombatants(enemyDef);
    this.setupHPBars();
    this.setupMenu();
    this.setupOverlays();
    this.setupInputHandlers();

    // Initialize stats bars with current values
    this.initializeStatsBars(enemyDef.name);

    // Start battle intro
    this.showMessage(`A wild ${enemyDef.name} appeared!`).then(() => {
      this.phase = 'player_turn';
      this.showMenu();
    });

    logger.info('Battle started', { enemy: enemyDef.name, floor: floorLevel });
  }

  /**
   * Initialize the HTML stats bars with enemy name and current HP/MP values
   */
  private initializeStatsBars(enemyName: string): void {
    if (!this.battleMenuOverlay) return;
    
    this.battleMenuOverlay.setEnemyName(enemyName);
    this.updateEnemyHp();
    this.updatePlayerHp();
    this.updatePlayerMp();
  }

  onDeactivate(): void {
    // Cleanup HTML overlays
    this.messageToast?.destroy();
    this.messageToast = null;
    this.battleMenuOverlay?.destroy();
    this.battleMenuOverlay = null;

    // Clean up input manager to remove engine-level event listeners
    this.inputManager?.destroy();
    this.inputManager = null;
    this.uiElements = [];
    this.enemyEntity = null;
    this.playerEntity = null;
  }

  private async setupBackground(): Promise<void> {
    // Try to load a themed background based on dungeon
    const bgImage = await loadBackground('moonlake');

    if (bgImage) {
      const bgActor = createBackgroundActor(bgImage, CANVAS_WIDTH, CANVAS_HEIGHT, 0);
      this.add(bgActor);
    } else {
      // Fallback to solid color
      const bg = new ex.Actor({
        pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
        width: CANVAS_WIDTH, height: CANVAS_HEIGHT, z: 0,
      });
      bg.graphics.use(new ex.Rectangle({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, color: ex.Color.fromHex('#1E1E32') }));
      this.add(bg);
    }

    // Floor/ground area
    const floor = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 75),
      width: CANVAS_WIDTH, height: 150, z: 1,
    });
    floor.graphics.use(new ex.Rectangle({ width: CANVAS_WIDTH, height: 150, color: ex.Color.fromHex('#324632') }));
    this.add(floor);

    // Floor level label
    const floorLabel = new ex.Label({
      text: `Floor ${this.sceneData?.floorLevel || 1}`,
      pos: new ex.Vector(CANVAS_WIDTH - 80, 15),
      font: new ex.Font({ size: 13, color: ex.Color.fromRGB(200, 200, 200) }), z: 100,
    });
    this.add(floorLabel);
    this.uiElements.push(floorLabel);

    // Start battle music
    AudioManager.playSceneMusic('battle');
  }

  private async setupCombatants(enemyDef: EnemyDefinition): Promise<void> {
    // Target display size for enemies (normalized)
    const targetEnemySize = BATTLE_CONFIG.enemySize;

    // Enemy actor
    this.enemyEntity = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, 120),
      width: targetEnemySize, height: targetEnemySize, z: 20,
    });

    // Clear previous enemy animations
    this.enemyAnimations.clear();
    this.enemyIsAnimated = false;

    // Try to load actual enemy sprite
    let spriteLoaded = false;

    if (enemyDef.spriteFolder) {
      // Animated slime enemy - load all animations
      const slimeColor = getSlimeColorFromFolder(enemyDef.spriteFolder);
      if (slimeColor) {
        const animTypes = ['idle', 'attack', 'hurt', 'death1'] as const;
        for (const animType of animTypes) {
          const anim = await loadSlimeAnimation(slimeColor, animType);
          if (anim) {
            const scale = calculateEnemyScale(enemyDef, targetEnemySize);
            anim.scale = new ex.Vector(scale, scale);
            this.enemyAnimations.set(animType, anim);
          }
        }
        
        const idleAnim = this.enemyAnimations.get('idle');
        if (idleAnim) {
          this.enemyEntity.graphics.use(idleAnim);
          this.enemyIsAnimated = true;
          spriteLoaded = true;
        }
      }
    } else if (enemyDef.spriteFile) {
      // Static enemy (single PNG)
      const enemyId = getStaticEnemyIdFromFile(enemyDef.spriteFile);
      if (enemyId) {
        const sprite = await loadStaticEnemySprite(enemyId);
        if (sprite) {
          // Scale to normalize display size
          const scale = calculateEnemyScale(enemyDef, targetEnemySize);
          sprite.scale = new ex.Vector(scale, scale);
          this.enemyEntity.graphics.use(sprite);
          spriteLoaded = true;
        }
      }
    }

    // Fallback to placeholder if sprite loading failed
    if (!spriteLoaded) {
      const enemyColor = enemyDef.placeholderColor || [150, 50, 50];
      this.enemyEntity.graphics.use(new ex.Rectangle({
        width: targetEnemySize, height: targetEnemySize,
        color: ex.Color.fromRGB(enemyColor[0], enemyColor[1], enemyColor[2]),
        strokeColor: ex.Color.Black, lineWidth: 3,
      }));
    }
    this.add(this.enemyEntity);

    // Store enemy starting position for animations
    this.enemyStartPos = this.enemyEntity.pos.clone();

    // Enemy name
    const enemyName = new ex.Label({
      text: enemyDef.name,
      pos: new ex.Vector(CANVAS_WIDTH / 2, 40),
      font: new ex.Font({ size: 14, color: ex.Color.White }), z: 100,
    });
    enemyName.graphics.anchor = ex.Vector.Half;
    this.add(enemyName);
    this.uiElements.push(enemyName);

    // Player - positioned in lower-left of visible battle area
    // Note: HTML battle menu + stats panel covers bottom ~140px
    this.playerEntity = new ex.Actor({
      pos: new ex.Vector(100, 190),
      width: BATTLE_CONFIG.playerSize, height: BATTLE_CONFIG.playerSize, z: 25,
    });

    // Load all battle animations for player
    this.playerAnimations.clear();
    const animTypes = ['idle', 'attack', 'hurt', 'die'] as const;
    for (const animType of animTypes) {
      try {
        const anim = await loadCatAnimation(GameState.player.catColor, animType);
        if (anim) {
          anim.scale = new ex.Vector(2, 2);
          this.playerAnimations.set(animType, anim);
        }
      } catch {
        // Animation not available, skip
      }
    }
    
    // Use idle animation as default
    const idleAnim = this.playerAnimations.get('idle');
    if (idleAnim) {
      this.playerEntity.graphics.use(idleAnim);
    } else {
      this.playerEntity.graphics.use(new ex.Rectangle({
        width: BATTLE_CONFIG.playerSize, height: BATTLE_CONFIG.playerSize, color: ex.Color.Gray,
      }));
    }
    this.add(this.playerEntity);

    // Store player starting position for animations
    this.playerStartPos = this.playerEntity.pos.clone();
  }

  private setupHPBars(): void {
    // HP/MP bars are now rendered in the BattleMenuOverlay HTML component
    // Initial values are set in onActivate after overlay setup
  }

  private setupMenu(): void {
    // Menu will be shown after intro (HTML overlay handles rendering)
  }

  private showMenu(): void {
    // Use HTML overlay for menu
    if (this.battleMenuOverlay?.isVisible) {
      // Already visible, just re-enable actions
      this.battleMenuOverlay.enableActions();
    } else {
      this.battleMenuOverlay?.show();
    }
  }

  private hideMenu(): void {
    this.battleMenuOverlay?.hide();
  }

  private setupInputHandlers(): void {
    // Input is now handled by the HTML BattleMenuOverlay
    // No additional handlers needed
  }

  private async playerAttack(): Promise<void> {
    if (!this.enemyStats || !this.playerStats || !this.playerEntity || !this.enemyEntity) return;

    // Store original position if not set
    if (!this.playerStartPos) {
      this.playerStartPos = this.playerEntity.pos.clone();
    }

    // Play attack animation if available
    await this.playPlayerAnimation('attack');

    // Animate player moving toward enemy
    const targetX = this.playerEntity.pos.x + BATTLE_CONFIG.attackMoveDistance;
    await this.animateMove(this.playerEntity, new ex.Vector(targetX, this.playerEntity.pos.y), BATTLE_CONFIG.attackMoveDuration);

    // Calculate and apply damage
    const damage = calculateDamage(this.playerStats.attack, this.enemyStats.defense);
    this.enemyStats.hp = Math.max(0, this.enemyStats.hp - damage);
    this.updateEnemyHp();

    // Show damage message
    await this.showMessage(`You attack for ${damage} damage!`, 1.0);

    // Enemy hit reaction - flash and shake
    await this.playHitEffect(this.enemyEntity, 'enemy');

    // Animate player moving back and return to idle
    await this.animateMove(this.playerEntity, this.playerStartPos, BATTLE_CONFIG.attackMoveDuration);
    this.playPlayerAnimation('idle', false);

    if (isDefeated(this.enemyStats)) {
      // Play enemy death animation if available
      if (this.enemyIsAnimated) {
        await this.playEnemyAnimation('death1');
      }
      await this.handleVictory();
    }
  }

  private async playerMagic(): Promise<void> {
    if (!this.playerStats || !this.enemyStats || !this.playerEntity || !this.enemyEntity) return;

    const manaCost = BATTLE_CONFIG.manaPerMagicAttack;
    if ((this.playerStats.mana || 0) < manaCost) {
      await this.showMessage('Not enough MP!');
      this.actionInProgress = false;
      this.phase = 'player_turn';
      this.showMenu();
      return;
    }

    // Consume mana
    this.playerStats.mana = (this.playerStats.mana || 0) - manaCost;
    GameState.player.mana = this.playerStats.mana;
    this.updatePlayerMp();

    // Magic effect - flash player with magic color
    await this.playMagicCastEffect(this.playerEntity);

    // Calculate magic damage
    const damage = Math.floor(this.playerStats.attack * BATTLE_CONFIG.magicDamageMultiplier);
    this.enemyStats.hp = Math.max(0, this.enemyStats.hp - damage);
    this.updateEnemyHp();

    await this.showMessage(`Magic attack for ${damage} damage!`, 1.0);

    // Enemy hit with magic effect
    await this.playMagicHitEffect(this.enemyEntity);

    if (isDefeated(this.enemyStats)) {
      // Play enemy death animation if available
      if (this.enemyIsAnimated) {
        await this.playEnemyAnimation('death1');
      }
      await this.handleVictory();
    }
  }

  private async playerDefend(): Promise<void> {
    this.playerDefending = true;
    
    // Visual feedback - brief defensive glow
    if (this.playerEntity) {
      await this.playDefendEffect(this.playerEntity);
    }
    
    await this.showMessage('You brace for impact!', 0.8);
  }

  private async playerFlee(): Promise<void> {
    if (!this.playerStats) return;

    const success = attemptFlee(this.playerStats.luck || 0);
    if (success) {
      await this.showMessage('You escaped!');
      this.phase = 'flee';
      this.endBattle('flee');
    } else {
      await this.showMessage('Failed to escape!');
    }
  }

  private async enemyTurn(): Promise<void> {
    if (!this.enemyStats || !this.playerStats || !this.sceneData || !this.enemyEntity || !this.playerEntity) return;

    this.phase = 'enemy_turn';

    // Store enemy start position if not set
    if (!this.enemyStartPos) {
      this.enemyStartPos = this.enemyEntity.pos.clone();
    }

    const action = decideEnemyAction(this.enemyStats);
    await this.delay(BATTLE_CONFIG.turnTransitionDelay);

    if (action === 'attack') {
      // Play enemy attack animation if available
      if (this.enemyIsAnimated) {
        await this.playEnemyAnimation('attack');
      }

      // Animate enemy moving toward player
      const targetY = this.enemyEntity.pos.y + BATTLE_CONFIG.attackMoveDistance;
      await this.animateMove(this.enemyEntity, new ex.Vector(this.enemyEntity.pos.x, targetY), BATTLE_CONFIG.attackMoveDuration);

      // Calculate damage
      let damage = calculateDamage(this.enemyStats.attack, this.playerStats.defense);
      const wasDefending = this.playerDefending;
      if (this.playerDefending) {
        damage = Math.floor(damage / 2);
        this.playerDefending = false;
      }

      this.playerStats.hp = Math.max(0, this.playerStats.hp - damage);
      GameState.player.health = this.playerStats.hp;
      this.updatePlayerHp();

      const defendText = wasDefending ? ' (blocked!)' : '';
      await this.showMessage(`${this.sceneData.enemyDef.name} attacks for ${damage} damage!${defendText}`, 1.0);

      // Player hit reaction
      await this.playHitEffect(this.playerEntity, 'player');

      // Animate enemy moving back and return to idle
      await this.animateMove(this.enemyEntity, this.enemyStartPos, BATTLE_CONFIG.attackMoveDuration);
      if (this.enemyIsAnimated) {
        this.playEnemyAnimation('idle', false);
      }

      if (isDefeated(this.playerStats)) {
        await this.handleDefeat();
      }
    }
  }

  private async handleVictory(): Promise<void> {
    if (!this.sceneData) return;

    this.phase = 'victory';
    const { enemyDef, floorLevel = 1 } = this.sceneData;

    const goldReward = calculateGoldReward(enemyDef, floorLevel);
    const xpReward = calculateXpReward(enemyDef, floorLevel);

    GameState.addGold(goldReward);
    const { levelsGained } = GameState.addXp(xpReward);
    GameState.recordBattleWin();

    await this.showMessage(`Victory! +${goldReward}G +${xpReward}XP`);

    // Show all level ups
    if (levelsGained > 0) {
      for (let i = 0; i < levelsGained; i++) {
        const levelAtGain = GameState.player.level - levelsGained + i + 1;
        await this.showMessage(`Level Up! You are now level ${levelAtGain}!`);
        // Play level up sound
        AudioManager.playSfx('levelUp');
      }
    }

    this.endBattle('victory');
  }

  private async handleDefeat(): Promise<void> {
    this.phase = 'defeat';

    // Play death animation
    await this.playPlayerAnimation('die');

    // Record loss
    GameState.recordBattleLoss();

    // Lose some gold
    const goldLoss = Math.floor(GameState.player.gold * 0.1);
    GameState.spendGold(goldLoss);

    await this.showMessage(`Defeated! Lost ${goldLoss}G...`);
    await this.showMessage('Returning to town...');

    // Clear dungeon state (same as trap death)
    GameState.dungeon.floor = null;
    GameState.dungeon.currentRoomId = '';
    GameState.dungeon.floorNumber = 1;
    GameState.dungeon.dungeonId = null;

    // Restore some HP so player isn't stuck at 0
    GameState.player.health = Math.floor(GameState.getEffectiveMaxHealth() * 0.25);

    this.endBattle('defeat');
  }

  private endBattle(result: 'victory' | 'defeat' | 'flee'): void {
    if (this.onBattleEnd && this.sceneData) {
      this.onBattleEnd(result, this.sceneData.returnData);
    }
  }

  // --- Item Menu (handled by HTML overlay) ---

  private getConsumableItems(): { id: string; quantity: number; name: string }[] {
    return GameState.player.items
      .filter(item => {
        const def = getItem(item.id);
        return def && def.type === 'consumable' && item.quantity > 0;
      })
      .map(item => {
        const def = getItem(item.id)!;
        return { id: item.id, quantity: item.quantity, name: def.name };
      });
  }

  private showItemMenu(): void {
    this.itemMenuVisible = true;
    this.hideMenu();
    // Show HTML item menu overlay
    const items = this.getConsumableItems();
    this.battleMenuOverlay?.showItemMenu(items);
  }

  private hideItemMenu(): void {
    this.itemMenuVisible = false;
    this.battleMenuOverlay?.hideItemMenu();
  }

  // --- HP Updates ---

  private updateEnemyHp(): void {
    if (!this.enemyStats) return;
    this.battleMenuOverlay?.updateEnemyHP(this.enemyStats.hp, this.enemyStats.maxHp);
  }

  private updatePlayerHp(): void {
    if (!this.playerStats) return;
    this.battleMenuOverlay?.updatePlayerHP(this.playerStats.hp, this.playerStats.maxHp);
  }

  private updatePlayerMp(): void {
    if (!this.playerStats) return;
    this.battleMenuOverlay?.updatePlayerMP(this.playerStats.mana || 0, this.playerStats.maxMana || 1);
  }

  // --- Utilities ---

  private showMessage(text: string, duration = 1.5): Promise<void> {
    return this.messageToast?.show(text, { duration: duration * 1000, position: 'top' }) || Promise.resolve();
  }

  /**
   * Setup HTML overlay components
   */
  private setupOverlays(): void {
    const canvas = this.engine.canvas;
    const container = canvas.parentElement;

    if (!container) {
      console.warn('BattleScene: Could not find canvas container for overlays');
      return;
    }

    // Ensure container has relative positioning for absolute overlays
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    // Create message toast
    this.messageToast = new MessageToast(container);

    // Create battle menu overlay
    this.battleMenuOverlay = new BattleMenuOverlay(container, {
      onSelectAction: (action: string) => {
        if (this.phase !== 'player_turn' || this.actionInProgress) return;
        this.executeActionByName(action);
      },
      onUseItem: (itemId: string) => {
        if (this.phase !== 'player_turn' || this.actionInProgress) return;
        this.useItemById(itemId);
      },
      onCloseItemMenu: () => {
        this.itemMenuVisible = false;
      },
      getConsumableItems: () => this.getConsumableItems(),
      getPlayerMana: () => this.playerStats?.mana || 0,
      getManaPerMagic: () => BATTLE_CONFIG.manaPerMagicAttack,
    });
  }

  /**
   * Execute an action by name (used by HTML overlay)
   */
  private async executeActionByName(action: string): Promise<void> {
    if (this.actionInProgress) return;

    this.actionInProgress = true;
    this.battleMenuOverlay?.disableActions();

    switch (action) {
      case 'Attack':
        await this.playerAttack();
        break;
      case 'Magic':
        await this.playerMagic();
        break;
      case 'Defend':
        await this.playerDefend();
        break;
      case 'Run':
        await this.playerFlee();
        break;
    }

    if (this.phase !== 'victory' && this.phase !== 'defeat' && this.phase !== 'flee') {
      await this.enemyTurn();
    }

    if (this.phase !== 'victory' && this.phase !== 'defeat' && this.phase !== 'flee') {
      this.phase = 'player_turn';
      this.actionInProgress = false;
      this.showMenu();
    }
  }

  /**
   * Use an item by ID (used by HTML overlay)
   */
  private async useItemById(itemId: string): Promise<void> {
    if (!this.playerStats) return;

    const itemDef = getItem(itemId);
    if (!itemDef) return;

    this.actionInProgress = true;
    this.itemMenuVisible = false;
    this.battleMenuOverlay?.disableActions();

    // Use item
    GameState.removeItem(itemId, 1);

    if (itemDef.effect?.type === 'heal') {
      const healAmount = itemDef.effect.value;
      const actualHeal = Math.min(healAmount, this.playerStats.maxHp - this.playerStats.hp);
      this.playerStats.hp += actualHeal;
      GameState.player.health = this.playerStats.hp;
      this.updatePlayerHp();
      await this.showMessage(`Used ${itemDef.name}! Healed ${actualHeal} HP!`);
    } else if (itemDef.effect?.type === 'mana_restore') {
      const restoreAmount = itemDef.effect.value;
      const actualRestore = Math.min(restoreAmount, (this.playerStats.maxMana || 0) - (this.playerStats.mana || 0));
      this.playerStats.mana = (this.playerStats.mana || 0) + actualRestore;
      GameState.player.mana = this.playerStats.mana;
      this.updatePlayerMp();
      await this.showMessage(`Used ${itemDef.name}! Restored ${actualRestore} MP!`);
    } else {
      await this.showMessage(`Used ${itemDef.name}!`);
    }

    // Enemy turn after using item
    if (this.phase !== 'victory' && this.phase !== 'defeat') {
      await this.enemyTurn();
    }

    if (this.phase !== 'victory' && this.phase !== 'defeat' && this.phase !== 'flee') {
      this.phase = 'player_turn';
      this.actionInProgress = false;
      this.showMenu();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --- Animation Helper Methods ---

  /**
   * Animate an actor moving to a target position
   */
  private animateMove(actor: ex.Actor, target: ex.Vector, duration: number): Promise<void> {
    return new Promise(resolve => {
      const startPos = actor.pos.clone();
      const startTime = Date.now();

      const updatePos = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        // Ease out quad for smooth deceleration
        const eased = 1 - (1 - t) * (1 - t);
        
        actor.pos = new ex.Vector(
          startPos.x + (target.x - startPos.x) * eased,
          startPos.y + (target.y - startPos.y) * eased
        );

        if (t < 1) {
          requestAnimationFrame(updatePos);
        } else {
          actor.pos = target.clone();
          resolve();
        }
      };

      requestAnimationFrame(updatePos);
    });
  }

  /**
   * Play hit effect - flash and shake
   */
  private async playHitEffect(actor: ex.Actor, type: 'player' | 'enemy'): Promise<void> {
    const origGraphic = actor.graphics.current;
    const origPos = actor.pos.clone();
    const size = type === 'player' ? BATTLE_CONFIG.playerSize : BATTLE_CONFIG.enemySize;
    const flashColor = type === 'player' ? ex.Color.Red : ex.Color.White;

    // For player, use hurt animation if available
    if (type === 'player' && this.playerAnimations.has('hurt')) {
      await this.playPlayerAnimation('hurt');
    } else if (type === 'enemy' && this.enemyIsAnimated && this.enemyAnimations.has('hurt')) {
      // Use enemy hurt animation if available
      await this.playEnemyAnimation('hurt');
    } else {
      // Flash for static enemies or fallback
      actor.graphics.use(new ex.Rectangle({ width: size, height: size, color: flashColor }));
    }

    // Shake
    const shakeStart = Date.now();
    const shakeDuration = BATTLE_CONFIG.shakeDuration;
    const intensity = BATTLE_CONFIG.shakeIntensity;

    await new Promise<void>(resolve => {
      const shake = () => {
        const elapsed = Date.now() - shakeStart;
        if (elapsed < shakeDuration) {
          const decay = 1 - (elapsed / shakeDuration);
          const offsetX = (Math.random() - 0.5) * intensity * decay * 2;
          const offsetY = (Math.random() - 0.5) * intensity * decay * 2;
          actor.pos = new ex.Vector(origPos.x + offsetX, origPos.y + offsetY);
          requestAnimationFrame(shake);
        } else {
          actor.pos = origPos.clone();
          resolve();
        }
      };
      requestAnimationFrame(shake);
    });

    // Restore original graphic (return to idle for player/enemy)
    if (type === 'player') {
      this.playPlayerAnimation('idle', false);
    } else if (type === 'enemy' && this.enemyIsAnimated) {
      this.playEnemyAnimation('idle', false);
    } else if (origGraphic) {
      actor.graphics.use(origGraphic);
    }
  }

  /**
   * Play magic cast effect
   */
  private async playMagicCastEffect(actor: ex.Actor): Promise<void> {
    const origGraphic = actor.graphics.current;
    const origPos = actor.pos.clone();

    // Quick scale pulse
    const pulseStart = Date.now();
    const pulseDuration = 300;

    await new Promise<void>(resolve => {
      const pulse = () => {
        const elapsed = Date.now() - pulseStart;
        if (elapsed < pulseDuration) {
          const t = elapsed / pulseDuration;
          const scale = 1 + Math.sin(t * Math.PI) * 0.15;
          actor.scale = new ex.Vector(scale, scale);
          requestAnimationFrame(pulse);
        } else {
          actor.scale = new ex.Vector(1, 1);
          resolve();
        }
      };
      requestAnimationFrame(pulse);
    });

    // Flash blue/purple for magic
    actor.graphics.use(new ex.Rectangle({ 
      width: BATTLE_CONFIG.playerSize, 
      height: BATTLE_CONFIG.playerSize, 
      color: ex.Color.fromHex('#9966FF') 
    }));
    await this.delay(150);
    if (origGraphic) actor.graphics.use(origGraphic);
  }

  /**
   * Play magic hit effect on target
   */
  private async playMagicHitEffect(actor: ex.Actor): Promise<void> {
    const origGraphic = actor.graphics.current;
    const origPos = actor.pos.clone();

    // Multi-flash with purple/blue
    const colors = [
      ex.Color.fromHex('#9966FF'),
      ex.Color.fromHex('#6699FF'),
      ex.Color.fromHex('#9966FF'),
    ];

    for (const color of colors) {
      actor.graphics.use(new ex.Rectangle({ 
        width: BATTLE_CONFIG.enemySize, 
        height: BATTLE_CONFIG.enemySize, 
        color 
      }));
      await this.delay(80);
    }

    // Shake
    const shakeStart = Date.now();
    await new Promise<void>(resolve => {
      const shake = () => {
        const elapsed = Date.now() - shakeStart;
        if (elapsed < 200) {
          const offsetX = (Math.random() - 0.5) * 6;
          const offsetY = (Math.random() - 0.5) * 6;
          actor.pos = new ex.Vector(origPos.x + offsetX, origPos.y + offsetY);
          requestAnimationFrame(shake);
        } else {
          actor.pos = origPos.clone();
          resolve();
        }
      };
      requestAnimationFrame(shake);
    });

    if (origGraphic) actor.graphics.use(origGraphic);
  }

  /**
   * Play defend effect
   */
  private async playDefendEffect(actor: ex.Actor): Promise<void> {
    const origGraphic = actor.graphics.current;

    // Brief defensive color flash
    actor.graphics.use(new ex.Rectangle({ 
      width: BATTLE_CONFIG.playerSize, 
      height: BATTLE_CONFIG.playerSize, 
      color: ex.Color.fromHex('#66CCFF') 
    }));
    await this.delay(200);
    if (origGraphic) actor.graphics.use(origGraphic);
  }

  /**
   * Play a player animation by type
   * @param animType - Type of animation ('idle', 'attack', 'hurt', 'die')
   * @param wait - Whether to wait for the animation to complete (default: true)
   */
  private async playPlayerAnimation(animType: string, wait = true): Promise<void> {
    if (!this.playerEntity) return;
    
    const anim = this.playerAnimations.get(animType);
    if (!anim) return;
    
    // Reset animation to start from beginning
    anim.reset();
    this.playerEntity.graphics.use(anim);
    
    if (wait) {
      // Wait for animation duration (estimate based on frames)
      // Non-looping animations like attack/hurt/die should complete
      const frameCount = anim.frames.length;
      const duration = frameCount * (1000 / 12); // Assuming ~12 FPS
      await this.delay(Math.min(duration, 500)); // Cap at 500ms
    }
  }

  /**
   * Play an enemy animation by type (for animated enemies like slimes)
   * @param animType - Type of animation ('idle', 'attack', 'hurt', 'death1')
   * @param wait - Whether to wait for the animation to complete (default: true)
   */
  private async playEnemyAnimation(animType: string, wait = true): Promise<void> {
    if (!this.enemyEntity || !this.enemyIsAnimated) return;
    
    const anim = this.enemyAnimations.get(animType);
    if (!anim) return;
    
    // Reset animation to start from beginning
    anim.reset();
    this.enemyEntity.graphics.use(anim);
    
    if (wait) {
      // Wait for animation duration (estimate based on frames)
      const frameCount = anim.frames.length;
      const duration = frameCount * (1000 / 8); // Slimes use ~8 FPS
      await this.delay(Math.min(duration, 600)); // Cap at 600ms
    }
  }
}
