/**
 * ExcaliburBattleScene
 *
 * Turn-based combat scene against enemies.
 * Supports Attack, Magic, Defend, Item, Flee actions.
 * Uses actual enemy sprites from assets/ENEMIES.
 */

import * as ex from 'excalibur';
import { GameState } from '../../state/GameState.js';
import { InputManager } from '../adapters/InputAdapter.js';
import {
  calculateDamage,
  isDefeated,
  decideEnemyAction,
  attemptFlee,
  type BattlePhase,
  type CombatStats,
} from '../../data/battle.js';
import {
  type EnemyDefinition,
  scaleEnemyStats,
  calculateGoldReward,
  calculateXpReward,
} from '../../data/enemies.js';
import { getItem } from '../../data/items.js';
import { AudioManager } from '../../audio/AudioManager.js';
import { createLogger } from '../../../../shared/logger.js';
import { MessageToast } from '../components/MessageToast.js';
import { BattleMenuOverlay } from '../components/BattleMenuOverlay.js';
import { BattleAnimator, BattleSetup } from './battle/index.js';

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

/**
 * Main Battle Scene - orchestrates combat flow using extracted utilities
 */
export class BattleScene extends ex.Scene {
  private inputManager: InputManager | null = null;
  private sceneData: BattleSceneData | null = null;

  // Combat state
  private phase: BattlePhase = 'intro';
  private enemyStats: CombatStats | null = null;
  private playerStats: CombatStats | null = null;
  private playerDefending = false;
  private actionInProgress = false;

  // Item menu state
  private itemMenuVisible = false;

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

  // Extracted utilities
  private animator: BattleAnimator;
  private battleSetup: BattleSetup | null = null;

  // Callbacks
  public onBattleEnd: ((result: 'victory' | 'defeat' | 'flee', data?: unknown) => void) | null = null;

  constructor() {
    super();
    this.animator = new BattleAnimator({
      playerSize: BATTLE_CONFIG.playerSize,
      enemySize: BATTLE_CONFIG.enemySize,
      shakeDuration: BATTLE_CONFIG.shakeDuration,
      shakeIntensity: BATTLE_CONFIG.shakeIntensity,
    });
  }

  onActivate(ctx: ex.SceneActivationContext<BattleSceneData>): void {
    this.sceneData = ctx.data || null;
    if (!this.sceneData) {
      logger.error('No battle data provided');
      return;
    }

    const { enemyDef, floorLevel = 1, dungeonId } = this.sceneData;

    // Calculate dungeon tier for scaling
    const dungeonTier = dungeonId ? DUNGEON_TIER_MAP[dungeonId] || 1 : 1;

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
    this.actionInProgress = false;
    this.itemMenuVisible = false;

    this.clear();
    this.initializeBattle(enemyDef, floorLevel);

    logger.info('Battle started', { enemy: enemyDef.name, floor: floorLevel });
  }

  private async initializeBattle(enemyDef: EnemyDefinition, floorLevel: number): Promise<void> {
    // Create setup helper
    this.battleSetup = new BattleSetup(this, {
      enemySize: BATTLE_CONFIG.enemySize,
      playerSize: BATTLE_CONFIG.playerSize,
    });

    // Setup background
    const bgElements = await this.battleSetup.setupBackground(floorLevel);
    this.uiElements.push(...bgElements);

    // Setup combatants
    const combatants = await this.battleSetup.setupCombatants(enemyDef);
    this.playerEntity = combatants.playerEntity;
    this.enemyEntity = combatants.enemyEntity;
    this.playerStartPos = combatants.playerStartPos;
    this.enemyStartPos = combatants.enemyStartPos;
    this.uiElements.push(...combatants.uiElements);

    // Configure animator with entities
    this.animator.setPlayer(combatants.playerEntity, combatants.playerAnimations);
    this.animator.setEnemy(
      combatants.enemyEntity,
      combatants.enemyAnimations,
      combatants.enemyIsAnimated
    );

    // Setup overlays
    this.setupOverlays();

    // Initialize stats bars with current values
    this.initializeStatsBars(enemyDef.name);

    // Start battle intro
    await this.showMessage(`A wild ${enemyDef.name} appeared!`);
    this.phase = 'player_turn';
    this.showMenu();
  }

  private initializeStatsBars(enemyName: string): void {
    if (!this.battleMenuOverlay) return;
    this.battleMenuOverlay.setEnemyName(enemyName);
    this.updateEnemyHp();
    this.updatePlayerHp();
    this.updatePlayerMp();
  }

  onDeactivate(): void {
    this.messageToast?.destroy();
    this.messageToast = null;
    this.battleMenuOverlay?.destroy();
    this.battleMenuOverlay = null;
    this.inputManager?.destroy();
    this.inputManager = null;
    this.uiElements = [];
    this.enemyEntity = null;
    this.playerEntity = null;
    this.animator.clear();
  }

  private showMenu(): void {
    if (this.battleMenuOverlay?.isVisible) {
      this.battleMenuOverlay.enableActions();
    } else {
      this.battleMenuOverlay?.show();
    }
  }

  private hideMenu(): void {
    this.battleMenuOverlay?.hide();
  }

  // --- Player Actions ---

  private async playerAttack(): Promise<void> {
    if (!this.enemyStats || !this.playerStats || !this.playerEntity || !this.enemyEntity) return;

    if (!this.playerStartPos) {
      this.playerStartPos = this.playerEntity.pos.clone();
    }

    await this.animator.playPlayerAnimation('attack');

    const targetX = this.playerEntity.pos.x + BATTLE_CONFIG.attackMoveDistance;
    await this.animator.animateMove(
      this.playerEntity,
      new ex.Vector(targetX, this.playerEntity.pos.y),
      BATTLE_CONFIG.attackMoveDuration
    );

    const damage = calculateDamage(this.playerStats.attack, this.enemyStats.defense);
    this.enemyStats.hp = Math.max(0, this.enemyStats.hp - damage);
    this.updateEnemyHp();

    await this.showMessage(`You attack for ${damage} damage!`, 1.0);
    await this.animator.playHitEffect(this.enemyEntity, 'enemy');

    await this.animator.animateMove(
      this.playerEntity,
      this.playerStartPos,
      BATTLE_CONFIG.attackMoveDuration
    );
    this.animator.playPlayerAnimation('idle', false);

    if (isDefeated(this.enemyStats)) {
      if (this.animator.isEnemyAnimated) {
        await this.animator.playEnemyAnimation('death1');
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

    this.playerStats.mana = (this.playerStats.mana || 0) - manaCost;
    GameState.player.mana = this.playerStats.mana;
    this.updatePlayerMp();

    await this.animator.playMagicCastEffect(this.playerEntity);

    const damage = Math.floor(this.playerStats.attack * BATTLE_CONFIG.magicDamageMultiplier);
    this.enemyStats.hp = Math.max(0, this.enemyStats.hp - damage);
    this.updateEnemyHp();

    await this.showMessage(`Magic attack for ${damage} damage!`, 1.0);
    await this.animator.playMagicHitEffect(this.enemyEntity);

    if (isDefeated(this.enemyStats)) {
      if (this.animator.isEnemyAnimated) {
        await this.animator.playEnemyAnimation('death1');
      }
      await this.handleVictory();
    }
  }

  private async playerDefend(): Promise<void> {
    this.playerDefending = true;
    if (this.playerEntity) {
      await this.animator.playDefendEffect(this.playerEntity);
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

  // --- Enemy Turn ---

  private async enemyTurn(): Promise<void> {
    if (!this.enemyStats || !this.playerStats || !this.sceneData || !this.enemyEntity || !this.playerEntity) return;

    this.phase = 'enemy_turn';

    if (!this.enemyStartPos) {
      this.enemyStartPos = this.enemyEntity.pos.clone();
    }

    const action = decideEnemyAction(this.enemyStats);
    await this.delay(BATTLE_CONFIG.turnTransitionDelay);

    if (action === 'attack') {
      if (this.animator.isEnemyAnimated) {
        await this.animator.playEnemyAnimation('attack');
      }

      const targetY = this.enemyEntity.pos.y + BATTLE_CONFIG.attackMoveDistance;
      await this.animator.animateMove(
        this.enemyEntity,
        new ex.Vector(this.enemyEntity.pos.x, targetY),
        BATTLE_CONFIG.attackMoveDuration
      );

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

      await this.animator.playHitEffect(this.playerEntity, 'player');

      await this.animator.animateMove(
        this.enemyEntity,
        this.enemyStartPos,
        BATTLE_CONFIG.attackMoveDuration
      );
      if (this.animator.isEnemyAnimated) {
        this.animator.playEnemyAnimation('idle', false);
      }

      if (isDefeated(this.playerStats)) {
        await this.handleDefeat();
      }
    }
  }

  // --- Victory/Defeat ---

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

    if (levelsGained > 0) {
      for (let i = 0; i < levelsGained; i++) {
        const levelAtGain = GameState.player.level - levelsGained + i + 1;
        await this.showMessage(`Level Up! You are now level ${levelAtGain}!`);
        AudioManager.playSfx('levelUp');
      }
    }

    this.endBattle('victory');
  }

  private async handleDefeat(): Promise<void> {
    this.phase = 'defeat';

    await this.animator.playPlayerAnimation('die');
    GameState.recordBattleLoss();

    const goldLoss = Math.floor(GameState.player.gold * 0.1);
    GameState.spendGold(goldLoss);

    await this.showMessage(`Defeated! Lost ${goldLoss}G...`);
    await this.showMessage('Returning to town...');

    GameState.dungeon.floor = null;
    GameState.dungeon.currentRoomId = '';
    GameState.dungeon.floorNumber = 1;
    GameState.dungeon.dungeonId = null;

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

  private async useItemById(itemId: string): Promise<void> {
    if (!this.playerStats) return;

    const itemDef = getItem(itemId);
    if (!itemDef) return;

    this.actionInProgress = true;
    this.itemMenuVisible = false;
    this.battleMenuOverlay?.disableActions();

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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private setupOverlays(): void {
    const canvas = this.engine.canvas;
    const container = canvas.parentElement;

    if (!container) {
      console.warn('BattleScene: Could not find canvas container for overlays');
      return;
    }

    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    this.messageToast = new MessageToast(container);

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
}
