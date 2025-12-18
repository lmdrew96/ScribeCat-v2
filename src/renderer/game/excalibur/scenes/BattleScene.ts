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

const logger = createLogger('BattleScene');

// Battle UI Constants
const BATTLE_CONFIG = {
  enemySize: 80,
  playerSize: 64,
  manaPerMagicAttack: 10,
  magicDamageMultiplier: 1.5,
  hitFlashDuration: 100,
  messageDisplayDuration: 1.5,
  inputCooldownDelay: 200,
  enemyTurnDelay: 500,
} as const;

export interface BattleSceneData {
  enemyDef: EnemyDefinition;
  floorLevel?: number;
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
  private menuElements: ex.Actor[] = [];
  private itemMenuElements: ex.Actor[] = [];
  private messageElements: ex.Actor[] = [];

  // Entity references
  private enemyEntity: ex.Actor | null = null;
  private playerEntity: ex.Actor | null = null;
  private enemyHpBar: ex.Actor | null = null;
  private playerHpBar: ex.Actor | null = null;
  private playerMpBar: ex.Actor | null = null;
  private enemyHpLabel: ex.Label | null = null;
  private playerHpLabel: ex.Label | null = null;
  private playerMpLabel: ex.Label | null = null;

  // Callbacks
  public onBattleEnd: ((result: 'victory' | 'defeat' | 'flee', data?: unknown) => void) | null = null;

  onActivate(ctx: ex.SceneActivationContext<BattleSceneData>): void {
    this.sceneData = ctx.data || null;
    if (!this.sceneData) {
      logger.error('No battle data provided');
      return;
    }

    const { enemyDef, floorLevel = 1 } = this.sceneData;

    // Initialize combat stats
    const scaledEnemy = scaleEnemyStats(enemyDef, floorLevel);
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
    this.setupInputHandlers();

    // Start battle intro
    this.showMessage(`A wild ${enemyDef.name} appeared!`).then(() => {
      this.phase = 'player_turn';
      this.showMenu();
    });

    logger.info('Battle started', { enemy: enemyDef.name, floor: floorLevel });
  }

  onDeactivate(): void {
    // Clean up input manager to remove engine-level event listeners
    this.inputManager?.destroy();
    this.inputManager = null;
    this.uiElements = [];
    this.menuElements = [];
    this.itemMenuElements = [];
    this.messageElements = [];
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

    // Try to load actual enemy sprite
    let spriteLoaded = false;

    if (enemyDef.spriteFolder) {
      // Animated slime enemy
      const slimeColor = getSlimeColorFromFolder(enemyDef.spriteFolder);
      if (slimeColor) {
        const idleAnim = await loadSlimeAnimation(slimeColor, 'idle');
        if (idleAnim) {
          // Scale up slime sprites (32x32) to target size
          const scale = calculateEnemyScale(enemyDef, targetEnemySize);
          idleAnim.scale = new ex.Vector(scale, scale);
          this.enemyEntity.graphics.use(idleAnim);
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

    // Enemy name
    const enemyName = new ex.Label({
      text: enemyDef.name,
      pos: new ex.Vector(CANVAS_WIDTH / 2, 40),
      font: new ex.Font({ size: 14, color: ex.Color.White }), z: 100,
    });
    enemyName.graphics.anchor = ex.Vector.Half;
    this.add(enemyName);
    this.uiElements.push(enemyName);

    // Player
    this.playerEntity = new ex.Actor({
      pos: new ex.Vector(150, CANVAS_HEIGHT - 180),
      width: BATTLE_CONFIG.playerSize, height: BATTLE_CONFIG.playerSize, z: 25,
    });

    try {
      const idleAnim = await loadCatAnimation(GameState.player.catColor, 'idle');
      idleAnim.scale = new ex.Vector(2, 2);
      this.playerEntity.graphics.use(idleAnim);
    } catch {
      this.playerEntity.graphics.use(new ex.Rectangle({
        width: BATTLE_CONFIG.playerSize, height: BATTLE_CONFIG.playerSize, color: ex.Color.Gray,
      }));
    }
    this.add(this.playerEntity);
  }

  private setupHPBars(): void {
    // Enemy HP bar
    const enemyHpBg = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH - 105, 47),
      width: 150, height: 16, z: 100,
    });
    enemyHpBg.graphics.use(new ex.Rectangle({ width: 150, height: 16, color: ex.Color.fromHex('#280000') }));
    this.add(enemyHpBg);

    this.enemyHpBar = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH - 178, 47),
      width: 146, height: 12, anchor: new ex.Vector(0, 0.5), z: 101,
    });
    this.enemyHpBar.graphics.use(new ex.Rectangle({ width: 146, height: 12, color: ex.Color.fromHex('#F03C3C') }));
    this.add(this.enemyHpBar);

    this.enemyHpLabel = new ex.Label({
      text: `${this.enemyStats?.hp}/${this.enemyStats?.maxHp}`,
      pos: new ex.Vector(CANVAS_WIDTH - 105, 47),
      font: new ex.Font({ size: 12, color: ex.Color.White }), z: 103,
    });
    this.enemyHpLabel.graphics.anchor = ex.Vector.Half;
    this.add(this.enemyHpLabel);

    // Player HP bar
    const playerHpBg = new ex.Actor({
      pos: new ex.Vector(110, CANVAS_HEIGHT - 122),
      width: 180, height: 18, z: 100,
    });
    playerHpBg.graphics.use(new ex.Rectangle({ width: 180, height: 18, color: ex.Color.fromHex('#143228') }));
    this.add(playerHpBg);

    this.playerHpBar = new ex.Actor({
      pos: new ex.Vector(22, CANVAS_HEIGHT - 122),
      width: 176, height: 14, anchor: new ex.Vector(0, 0.5), z: 101,
    });
    this.playerHpBar.graphics.use(new ex.Rectangle({ width: 176, height: 14, color: ex.Color.fromHex('#3CDC64') }));
    this.add(this.playerHpBar);

    this.playerHpLabel = new ex.Label({
      text: `HP: ${this.playerStats?.hp}/${this.playerStats?.maxHp}`,
      pos: new ex.Vector(110, CANVAS_HEIGHT - 122),
      font: new ex.Font({ size: 13, color: ex.Color.White }), z: 103,
    });
    this.playerHpLabel.graphics.anchor = ex.Vector.Half;
    this.add(this.playerHpLabel);

    // Player MP bar
    const playerMpBg = new ex.Actor({
      pos: new ex.Vector(110, CANVAS_HEIGHT - 102),
      width: 180, height: 14, z: 100,
    });
    playerMpBg.graphics.use(new ex.Rectangle({ width: 180, height: 14, color: ex.Color.fromHex('#141E32') }));
    this.add(playerMpBg);

    this.playerMpBar = new ex.Actor({
      pos: new ex.Vector(22, CANVAS_HEIGHT - 102),
      width: 176, height: 10, anchor: new ex.Vector(0, 0.5), z: 101,
    });
    this.playerMpBar.graphics.use(new ex.Rectangle({ width: 176, height: 10, color: ex.Color.fromHex('#6496FF') }));
    this.add(this.playerMpBar);

    this.playerMpLabel = new ex.Label({
      text: `MP: ${this.playerStats?.mana}/${this.playerStats?.maxMana}`,
      pos: new ex.Vector(110, CANVAS_HEIGHT - 102),
      font: new ex.Font({ size: 12, color: ex.Color.White }), z: 103,
    });
    this.playerMpLabel.graphics.anchor = ex.Vector.Half;
    this.add(this.playerMpLabel);
  }

  private setupMenu(): void {
    // Menu will be shown after intro
  }

  private showMenu(): void {
    this.clearMenu();

    // Menu background
    const menuBg = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 55),
      width: 340, height: 80, z: 150,
    });
    menuBg.graphics.use(new ex.Rectangle({
      width: 340, height: 80,
      color: ex.Color.fromHex('#1E1E32'),
      strokeColor: ex.Color.fromHex('#6496FF'), lineWidth: 3,
    }));
    this.add(menuBg);
    this.menuElements.push(menuBg);

    // Action buttons
    ACTIONS.forEach((action, i) => {
      const isSelected = i === this.selectedAction;
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = CANVAS_WIDTH / 2 - 100 + col * 100;
      const y = CANVAS_HEIGHT - 70 + row * 25;

      const label = new ex.Label({
        text: isSelected ? `> ${action}` : action,
        pos: new ex.Vector(x, y),
        font: new ex.Font({ size: 13, color: isSelected ? ex.Color.fromHex('#FFFF64') : ex.Color.fromRGB(200, 200, 200) }), z: 151,
      });
      this.add(label);
      this.menuElements.push(label);
    });
  }

  private clearMenu(): void {
    for (const e of this.menuElements) e.kill();
    this.menuElements = [];
  }

  private hideMenu(): void {
    this.clearMenu();
  }

  private setupInputHandlers(): void {
    const engine = this.engine;
    if (!engine) return;

    this.inputManager = new InputManager(engine);

    this.inputManager.onKeyPress('left', () => {
      if (this.phase !== 'player_turn' || this.actionInProgress) return;
      if (this.itemMenuVisible) return;
      if (this.selectedAction > 0) {
        this.selectedAction--;
        this.showMenu();
      }
    });

    this.inputManager.onKeyPress('a', () => {
      if (this.phase !== 'player_turn' || this.actionInProgress) return;
      if (this.itemMenuVisible) return;
      if (this.selectedAction > 0) {
        this.selectedAction--;
        this.showMenu();
      }
    });

    this.inputManager.onKeyPress('right', () => {
      if (this.phase !== 'player_turn' || this.actionInProgress) return;
      if (this.itemMenuVisible) return;
      if (this.selectedAction < ACTIONS.length - 1) {
        this.selectedAction++;
        this.showMenu();
      }
    });

    this.inputManager.onKeyPress('d', () => {
      if (this.phase !== 'player_turn' || this.actionInProgress) return;
      if (this.itemMenuVisible) return;
      if (this.selectedAction < ACTIONS.length - 1) {
        this.selectedAction++;
        this.showMenu();
      }
    });

    this.inputManager.onKeyPress('up', () => {
      if (this.phase !== 'player_turn' || this.actionInProgress) return;
      if (this.itemMenuVisible) {
        if (this.selectedItemIndex > 0) {
          this.selectedItemIndex--;
          this.showItemMenu();
        }
      } else if (this.selectedAction >= 3) {
        this.selectedAction -= 3;
        this.showMenu();
      }
    });

    this.inputManager.onKeyPress('w', () => {
      if (this.phase !== 'player_turn' || this.actionInProgress) return;
      if (this.itemMenuVisible) {
        if (this.selectedItemIndex > 0) {
          this.selectedItemIndex--;
          this.showItemMenu();
        }
      } else if (this.selectedAction >= 3) {
        this.selectedAction -= 3;
        this.showMenu();
      }
    });

    this.inputManager.onKeyPress('down', () => {
      if (this.phase !== 'player_turn' || this.actionInProgress) return;
      if (this.itemMenuVisible) {
        const items = this.getConsumableItems();
        if (this.selectedItemIndex < items.length - 1) {
          this.selectedItemIndex++;
          this.showItemMenu();
        }
      } else if (this.selectedAction < 3 && this.selectedAction + 3 < ACTIONS.length) {
        this.selectedAction += 3;
        this.showMenu();
      }
    });

    this.inputManager.onKeyPress('s', () => {
      if (this.phase !== 'player_turn' || this.actionInProgress) return;
      if (this.itemMenuVisible) {
        const items = this.getConsumableItems();
        if (this.selectedItemIndex < items.length - 1) {
          this.selectedItemIndex++;
          this.showItemMenu();
        }
      } else if (this.selectedAction < 3 && this.selectedAction + 3 < ACTIONS.length) {
        this.selectedAction += 3;
        this.showMenu();
      }
    });

    this.inputManager.onKeyPress('enter', () => {
      if (this.phase !== 'player_turn' || this.actionInProgress) return;
      if (this.itemMenuVisible) {
        this.useSelectedItem();
      } else {
        this.executeAction();
      }
    });

    this.inputManager.onKeyPress('escape', () => {
      if (this.itemMenuVisible) {
        this.hideItemMenu();
        this.showMenu();
      }
    });
  }

  private async executeAction(): Promise<void> {
    if (this.actionInProgress) return;

    const action = ACTIONS[this.selectedAction];
    this.actionInProgress = true;
    this.hideMenu();

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
      case 'Item':
        this.showItemMenu();
        this.actionInProgress = false;
        return;
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

  private async playerAttack(): Promise<void> {
    if (!this.enemyStats || !this.playerStats) return;

    const damage = calculateDamage(this.playerStats.attack, this.enemyStats.defense);
    this.enemyStats.hp = Math.max(0, this.enemyStats.hp - damage);
    this.updateEnemyHp();

    await this.showMessage(`You attack for ${damage} damage!`);

    // Flash enemy white to indicate hit
    if (this.enemyEntity) {
      const origGraphic = this.enemyEntity.graphics.current; // Save original BEFORE replacing
      this.enemyEntity.graphics.use(new ex.Rectangle({ width: BATTLE_CONFIG.enemySize, height: BATTLE_CONFIG.enemySize, color: ex.Color.White }));
      await this.delay(BATTLE_CONFIG.hitFlashDuration);
      if (origGraphic) this.enemyEntity.graphics.use(origGraphic);
    }

    if (isDefeated(this.enemyStats)) {
      await this.handleVictory();
    }
  }

  private async playerMagic(): Promise<void> {
    if (!this.playerStats || !this.enemyStats) return;

    const manaCost = BATTLE_CONFIG.manaPerMagicAttack;
    if ((this.playerStats.mana || 0) < manaCost) {
      await this.showMessage('Not enough MP!');
      this.actionInProgress = false;
      this.phase = 'player_turn';
      this.showMenu();
      return;
    }

    this.playerStats.mana = (this.playerStats.mana || 0) - manaCost;
    GameState.player.mana = this.playerStats.mana;
    this.updatePlayerMp();

    const damage = Math.floor(this.playerStats.attack * BATTLE_CONFIG.magicDamageMultiplier);
    this.enemyStats.hp = Math.max(0, this.enemyStats.hp - damage);
    this.updateEnemyHp();

    await this.showMessage(`Magic attack for ${damage} damage!`);

    if (isDefeated(this.enemyStats)) {
      await this.handleVictory();
    }
  }

  private async playerDefend(): Promise<void> {
    this.playerDefending = true;
    await this.showMessage('You brace for impact!');
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
    if (!this.enemyStats || !this.playerStats || !this.sceneData) return;

    this.phase = 'enemy_turn';

    const action = decideEnemyAction(this.enemyStats);
    await this.delay(BATTLE_CONFIG.enemyTurnDelay);

    if (action === 'attack') {
      let damage = calculateDamage(this.enemyStats.attack, this.playerStats.defense);
      if (this.playerDefending) {
        damage = Math.floor(damage / 2);
        this.playerDefending = false;
      }

      this.playerStats.hp = Math.max(0, this.playerStats.hp - damage);
      GameState.player.health = this.playerStats.hp;
      this.updatePlayerHp();

      await this.showMessage(`${this.sceneData.enemyDef.name} attacks for ${damage} damage!`);

      // Flash player red to indicate damage taken
      if (this.playerEntity) {
        const origGraphic = this.playerEntity.graphics.current; // Save original BEFORE replacing
        this.playerEntity.graphics.use(new ex.Rectangle({ width: BATTLE_CONFIG.playerSize, height: BATTLE_CONFIG.playerSize, color: ex.Color.Red }));
        await this.delay(BATTLE_CONFIG.hitFlashDuration);
        if (origGraphic) this.playerEntity.graphics.use(origGraphic);
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
    GameState.addXp(xpReward);
    GameState.recordBattleWin();

    await this.showMessage(`Victory! +${goldReward}G +${xpReward}XP`);

    // Check level up
    const leveledUp = GameState.checkLevelUp();
    if (leveledUp) {
      await this.showMessage(`Level Up! You are now level ${GameState.player.level}!`);
    }

    this.endBattle('victory');
  }

  private async handleDefeat(): Promise<void> {
    this.phase = 'defeat';

    // Record loss
    GameState.recordBattleLoss();

    // Lose some gold
    const goldLoss = Math.floor(GameState.player.gold * 0.1);
    GameState.spendGold(goldLoss);

    await this.showMessage(`Defeated! Lost ${goldLoss}G...`);

    // Restore some HP
    GameState.player.health = Math.floor(GameState.getEffectiveMaxHealth() * 0.25);

    this.endBattle('defeat');
  }

  private endBattle(result: 'victory' | 'defeat' | 'flee'): void {
    if (this.onBattleEnd && this.sceneData) {
      this.onBattleEnd(result, this.sceneData.returnData);
    }
  }

  // --- Item Menu ---

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
    this.clearItemMenu();

    const items = this.getConsumableItems();
    const menuX = CANVAS_WIDTH / 2;
    const menuY = 150;
    const menuWidth = 280;
    const menuHeight = Math.min(items.length, 5) * 28 + 60;

    // Background
    const bg = new ex.Actor({
      pos: new ex.Vector(menuX, menuY + menuHeight / 2),
      width: menuWidth, height: menuHeight, z: 200,
    });
    bg.graphics.use(new ex.Rectangle({
      width: menuWidth, height: menuHeight,
      color: ex.Color.fromHex('#141428'),
      strokeColor: ex.Color.fromHex('#6496FF'), lineWidth: 3,
    }));
    this.add(bg);
    this.itemMenuElements.push(bg);

    // Title
    const title = new ex.Label({
      text: 'Select Item',
      pos: new ex.Vector(menuX, menuY + 15),
      font: new ex.Font({ size: 14, color: ex.Color.White }), z: 201,
    });
    title.graphics.anchor = ex.Vector.Half;
    this.add(title);
    this.itemMenuElements.push(title);

    if (items.length === 0) {
      const noItems = new ex.Label({
        text: 'No items available!',
        pos: new ex.Vector(menuX, menuY + 50),
        font: new ex.Font({ size: 13, color: ex.Color.fromRGB(150, 150, 150) }), z: 201,
      });
      noItems.graphics.anchor = ex.Vector.Half;
      this.add(noItems);
      this.itemMenuElements.push(noItems);
    } else {
      items.slice(0, 5).forEach((item, i) => {
        const isSelected = i === this.selectedItemIndex;
        const y = menuY + 35 + i * 28;

        const rowBg = new ex.Actor({
          pos: new ex.Vector(menuX, y + 12),
          width: menuWidth - 20, height: 24, z: 201,
        });
        rowBg.graphics.use(new ex.Rectangle({
          width: menuWidth - 20, height: 24,
          color: isSelected ? ex.Color.fromHex('#3C3C64') : ex.Color.fromHex('#1E1E32'),
          strokeColor: isSelected ? ex.Color.fromHex('#FBBF24') : ex.Color.fromHex('#3C3C50'), lineWidth: 1,
        }));
        this.add(rowBg);
        this.itemMenuElements.push(rowBg);

        const nameLabel = new ex.Label({
          text: isSelected ? `> ${item.name}` : item.name,
          pos: new ex.Vector(menuX - menuWidth / 2 + 25, y + 12),
          font: new ex.Font({ size: 13, color: isSelected ? ex.Color.fromHex('#FFFF64') : ex.Color.White }), z: 202,
        });
        nameLabel.graphics.anchor = new ex.Vector(0, 0.5);
        this.add(nameLabel);
        this.itemMenuElements.push(nameLabel);

        const qtyLabel = new ex.Label({
          text: `x${item.quantity}`,
          pos: new ex.Vector(menuX + menuWidth / 2 - 25, y + 12),
          font: new ex.Font({ size: 12, color: ex.Color.fromRGB(150, 200, 150) }), z: 202,
        });
        qtyLabel.graphics.anchor = new ex.Vector(1, 0.5);
        this.add(qtyLabel);
        this.itemMenuElements.push(qtyLabel);
      });
    }

    // Instructions
    const instr = new ex.Label({
      text: 'ENTER: Use | ESC: Back',
      pos: new ex.Vector(menuX, menuY + menuHeight - 15),
      font: new ex.Font({ size: 11, color: ex.Color.fromRGB(150, 150, 150) }), z: 201,
    });
    instr.graphics.anchor = ex.Vector.Half;
    this.add(instr);
    this.itemMenuElements.push(instr);
  }

  private clearItemMenu(): void {
    for (const e of this.itemMenuElements) e.kill();
    this.itemMenuElements = [];
  }

  private hideItemMenu(): void {
    this.itemMenuVisible = false;
    this.clearItemMenu();
  }

  private async useSelectedItem(): Promise<void> {
    if (!this.playerStats) return;

    const items = this.getConsumableItems();
    if (items.length === 0 || this.selectedItemIndex >= items.length) return;

    const selectedItem = items[this.selectedItemIndex];
    const itemDef = getItem(selectedItem.id);
    if (!itemDef) return;

    this.actionInProgress = true;
    this.hideItemMenu();

    // Use item
    GameState.removeItem(selectedItem.id, 1);

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

  // --- HP Updates ---

  private updateEnemyHp(): void {
    if (!this.enemyStats || !this.enemyHpBar || !this.enemyHpLabel) return;
    const ratio = this.enemyStats.hp / this.enemyStats.maxHp;
    this.enemyHpBar.graphics.use(new ex.Rectangle({
      width: 146 * ratio, height: 12, color: ex.Color.fromHex('#F03C3C'),
    }));
    this.enemyHpLabel.text = `${this.enemyStats.hp}/${this.enemyStats.maxHp}`;
  }

  private updatePlayerHp(): void {
    if (!this.playerStats || !this.playerHpBar || !this.playerHpLabel) return;
    const ratio = this.playerStats.hp / this.playerStats.maxHp;
    const color = ratio > 0.5 ? '#3CDC64' : ratio > 0.25 ? '#F0C83C' : '#F03C3C';
    this.playerHpBar.graphics.use(new ex.Rectangle({
      width: 176 * ratio, height: 14, color: ex.Color.fromHex(color),
    }));
    this.playerHpLabel.text = `HP: ${this.playerStats.hp}/${this.playerStats.maxHp}`;
  }

  private updatePlayerMp(): void {
    if (!this.playerStats || !this.playerMpBar || !this.playerMpLabel) return;
    const ratio = (this.playerStats.mana || 0) / (this.playerStats.maxMana || 1);
    this.playerMpBar.graphics.use(new ex.Rectangle({
      width: 176 * ratio, height: 10, color: ex.Color.fromHex('#6496FF'),
    }));
    this.playerMpLabel.text = `MP: ${this.playerStats.mana}/${this.playerStats.maxMana}`;
  }

  // --- Utilities ---

  private showMessage(text: string, duration = 1.5): Promise<void> {
    return new Promise(resolve => {
      this.clearMessages();

      const msgBg = new ex.Actor({
        pos: new ex.Vector(CANVAS_WIDTH / 2, 70),
        width: 400, height: 50, z: 200,
      });
      msgBg.graphics.use(new ex.Rectangle({ width: 400, height: 50, color: ex.Color.fromRGB(0, 0, 0, 0.8) }));
      this.add(msgBg);
      this.messageElements.push(msgBg);

      const msgLabel = new ex.Label({
        text,
        pos: new ex.Vector(CANVAS_WIDTH / 2, 70),
        font: new ex.Font({ size: 13, color: ex.Color.White }), z: 201,
      });
      msgLabel.graphics.anchor = ex.Vector.Half;
      this.add(msgLabel);
      this.messageElements.push(msgLabel);

      setTimeout(() => {
        this.clearMessages();
        resolve();
      }, duration * 1000);
    });
  }

  private clearMessages(): void {
    for (const e of this.messageElements) e.kill();
    this.messageElements = [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
