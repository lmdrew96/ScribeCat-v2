/**
 * BattleScene
 *
 * Turn-based combat against enemies.
 *
 * FIXES:
 * - Uses smaller sprite scales imported from Enemy.ts
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { GameState } from '../state/GameState.js';
import { loadCatSprites, getCatSpriteName } from '../sprites/catSprites.js';
import { createEnemy, createPlaceholderEnemy, BATTLE_TARGET_SIZE } from '../components/Enemy.js';
import {
  calculateDamage,
  applyDamage,
  applyHealing,
  isDefeated,
  decideEnemyAction,
  attemptFlee,
  getLevelUpStats,
  type BattlePhase,
  type PlayerAction,
  type CombatStats,
} from '../systems/battle.js';
import {
  flashEntity,
  showFloatingNumber,
  shakeCamera,
  playAttackLunge,
  playHurtEffect,
  playVictoryEffect,
  EFFECT_COLORS,
} from '../systems/effects.js';
import { playSound, playCatMeow } from '../systems/sound.js';
import {
  type EnemyDefinition,
  scaleEnemyStats,
  calculateGoldReward,
  calculateXpReward,
} from '../data/enemies.js';
import { getItem } from '../data/items.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config.js';

const BATTLE_PLAYER_SCALE = 2.5; // Cat sprite ~32px, target ~80px display

export interface BattleSceneData {
  enemyDef: EnemyDefinition;
  floorLevel?: number;
  returnScene: string;
  returnData?: unknown;
}

export function registerBattleScene(k: KAPLAYCtx): void {
  k.scene('battle', async (data: BattleSceneData) => {
    const { enemyDef, floorLevel = 1, returnScene, returnData } = data;

    // Initialize combat stats
    const scaledEnemy = scaleEnemyStats(enemyDef, floorLevel);
    const enemyStats: CombatStats = {
      hp: scaledEnemy.hp,
      maxHp: scaledEnemy.hp,
      attack: scaledEnemy.attack,
      defense: scaledEnemy.defense,
    };

    const playerStats: CombatStats = {
      hp: GameState.player.health,
      maxHp: GameState.getEffectiveMaxHealth(),
      attack: GameState.getEffectiveAttack(),
      defense: GameState.getEffectiveDefense(),
      luck: GameState.getEffectiveLuck(),
    };

    // Battle state with scene lifecycle tracking
    let phase: BattlePhase = 'intro';
    let playerDefending = false;
    let selectedAction = 0;
    let menuVisible = false;
    let sceneActive = true;  // Track if scene is still active for promise handling
    let actionInProgress = false;  // Prevent multiple simultaneous actions

    // Track cleanup functions for handlers to prevent accumulation on scene re-entry
    const cleanupFunctions: (() => void)[] = [];

    // Valid phase transitions to prevent race conditions
    const validTransitions: Record<BattlePhase, BattlePhase[]> = {
      intro: ['player_turn'],
      player_turn: ['player_action'],
      player_action: ['enemy_turn', 'victory', 'defeat', 'flee'],
      enemy_turn: ['enemy_action'],
      enemy_action: ['player_turn', 'victory', 'defeat'],
      victory: [],
      defeat: [],
      flee: [],
    };

    function setPhase(newPhase: BattlePhase): boolean {
      if (!sceneActive) return false;
      if (!validTransitions[phase].includes(newPhase)) {
        console.warn(`Invalid battle phase transition: ${phase} -> ${newPhase}`);
        return false;
      }
      phase = newPhase;
      return true;
    }

    function isBattleEnded(): boolean {
      return phase === 'victory' || phase === 'defeat' || phase === 'flee';
    }

    // --- BACKGROUND ---
    let bgLoaded = false;
    try {
      await k.loadSprite('battle-bg', '../../assets/BACKGROUNDS/Alley.png');
      bgLoaded = true;
    } catch {
      console.log('HD background not available, using fallback');
    }

    if (bgLoaded) {
      const bgSprite = k.add([
        k.sprite('battle-bg'),
        k.pos(0, 0),
        k.z(0),
      ]);
      const bgScale = Math.max(CANVAS_WIDTH / 1024, CANVAS_HEIGHT / 576);
      bgSprite.scale = k.vec2(bgScale, bgScale);
    } else {
      // Fallback gradient background
      k.add([k.rect(CANVAS_WIDTH, CANVAS_HEIGHT / 2), k.pos(0, 0), k.color(30, 30, 50), k.z(0)]);
      k.add([k.rect(CANVAS_WIDTH, CANVAS_HEIGHT / 2), k.pos(0, CANVAS_HEIGHT / 2), k.color(45, 45, 70), k.z(0)]);
      k.add([k.rect(CANVAS_WIDTH, 150), k.pos(0, CANVAS_HEIGHT - 150), k.color(50, 70, 50), k.z(1)]);
      k.add([k.rect(CANVAS_WIDTH, 4), k.pos(0, CANVAS_HEIGHT - 150), k.color(70, 100, 70), k.z(1)]);
      k.add([k.rect(CANVAS_WIDTH, 20), k.pos(0, CANVAS_HEIGHT - 20), k.color(35, 50, 35), k.z(1)]);
    }

    // --- HEADER ---
    k.add([k.text(enemyDef.name, { size: 14 }), k.pos(20, 15), k.color(255, 255, 255), k.z(100)]);
    k.add([k.text(`Floor ${floorLevel}`, { size: 10 }), k.pos(CANVAS_WIDTH - 80, 15), k.color(200, 200, 200), k.z(100)]);

    // --- ENEMY SPRITE (uses target size for dynamic scaling) ---
    let enemyEntity: GameObj;
    try {
      const enemy = await createEnemy({
        k,
        x: CANVAS_WIDTH / 2,
        y: 140,
        enemyDef,
        targetSize: BATTLE_TARGET_SIZE,
      });
      enemyEntity = enemy.entity;
    } catch {
      enemyEntity = createPlaceholderEnemy(k, CANVAS_WIDTH / 2, 140, enemyDef);
    }

    // --- PLAYER SPRITE ---
    await loadCatSprites(k, GameState.player.catColor);
    const playerEntity = k.add([
      k.sprite(getCatSpriteName(GameState.player.catColor, 'idle')),
      k.pos(150, CANVAS_HEIGHT - 180),
      k.anchor('center'),
      k.scale(BATTLE_PLAYER_SCALE),
      k.z(25),
      'battle-player',
    ]);
    playerEntity.play('idle');

    // --- HP BARS ---
    // Enemy HP bar
    k.add([k.rect(156, 20), k.pos(CANVAS_WIDTH - 183, 37), k.color(0, 0, 0), k.z(99)]);
    k.add([k.rect(152, 16), k.pos(CANVAS_WIDTH - 181, 39), k.color(40, 40, 40), k.z(100)]);
    k.add([k.rect(148, 12), k.pos(CANVAS_WIDTH - 179, 41), k.color(60, 20, 20), k.z(100)]);
    const enemyHpBar = k.add([k.rect(146, 5), k.pos(CANVAS_WIDTH - 178, 42), k.color(240, 60, 60), k.z(101)]);
    const enemyHpBarBottom = k.add([k.rect(146, 5), k.pos(CANVAS_WIDTH - 178, 47), k.color(180, 40, 40), k.z(101)]);
    k.add([k.rect(140, 2), k.pos(CANVAS_WIDTH - 175, 43), k.color(255, 150, 150), k.opacity(0.4), k.z(102)]);
    const enemyHpLabel = k.add([k.text(`${enemyStats.hp}/${enemyStats.maxHp}`, { size: 8 }), k.pos(CANVAS_WIDTH - 105, 46), k.anchor('center'), k.color(255, 255, 255), k.z(103)]);

    // Player HP bar
    k.add([k.rect(186, 22), k.pos(17, CANVAS_HEIGHT - 113), k.color(0, 0, 0), k.z(99)]);
    k.add([k.rect(182, 18), k.pos(19, CANVAS_HEIGHT - 111), k.color(40, 40, 40), k.z(100)]);
    k.add([k.rect(178, 14), k.pos(21, CANVAS_HEIGHT - 109), k.color(20, 50, 30), k.z(100)]);
    const playerHpBar = k.add([k.rect(176, 6), k.pos(22, CANVAS_HEIGHT - 108), k.color(60, 220, 100), k.z(101)]);
    const playerHpBarBottom = k.add([k.rect(176, 6), k.pos(22, CANVAS_HEIGHT - 102), k.color(40, 160, 70), k.z(101)]);
    k.add([k.rect(168, 2), k.pos(26, CANVAS_HEIGHT - 106), k.color(180, 255, 200), k.opacity(0.4), k.z(102)]);
    const playerHpLabel = k.add([k.text(`HP: ${playerStats.hp}/${playerStats.maxHp}`, { size: 10 }), k.pos(110, CANVAS_HEIGHT - 102), k.anchor('center'), k.color(255, 255, 255), k.z(103)]);

    // --- ACTION MENU ---
    const menuBg = k.add([k.rect(280, 80), k.pos(CANVAS_WIDTH / 2 - 140, CANVAS_HEIGHT - 95), k.color(30, 30, 50), k.outline(3, k.rgb(100, 100, 150)), k.opacity(0), k.z(150)]);

    const actions: PlayerAction[] = ['attack', 'defend', 'item', 'flee'];
    const actionLabels = ['Attack', 'Defend', 'Item', 'Run'];
    const actionEntities: GameObj[] = [];
    const menuStartX = CANVAS_WIDTH / 2 - 120;
    const menuStartY = CANVAS_HEIGHT - 75;

    actions.forEach((action, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const label = k.add([k.text(actionLabels[i], { size: 12 }), k.pos(menuStartX + col * 130, menuStartY + row * 30), k.color(200, 200, 200), k.opacity(0), k.z(151), { action, index: i }]);
      actionEntities.push(label);
    });

    const cursor = k.add([k.text('>', { size: 12 }), k.pos(menuStartX - 15, menuStartY), k.color(255, 255, 100), k.opacity(0), k.z(152)]);

    // --- MESSAGE BOX ---
    let messageBox: GameObj | null = null;
    let messageText: GameObj | null = null;
    let messageTimerCancel: (() => void) | null = null;

    /**
     * Show a message box with proper lifecycle handling.
     * Resolves immediately if scene is no longer active to prevent hanging.
     */
    function showMessage(text: string, duration = 1.5): Promise<void> {
      return new Promise((resolve) => {
        // If scene is no longer active, resolve immediately to prevent hanging
        if (!sceneActive) {
          resolve();
          return;
        }

        // Clean up previous message
        if (messageBox) { try { k.destroy(messageBox); } catch {} }
        if (messageText) { try { k.destroy(messageText); } catch {} }
        if (messageTimerCancel) { try { messageTimerCancel(); } catch {} }

        messageBox = k.add([k.rect(400, 50), k.pos(CANVAS_WIDTH / 2 - 200, 70), k.color(0, 0, 0), k.opacity(0.8), k.z(200)]);
        messageText = k.add([k.text(text, { size: 12 }), k.pos(CANVAS_WIDTH / 2, 95), k.anchor('center'), k.color(255, 255, 255), k.z(201)]);

        const timer = k.wait(duration, () => {
          messageTimerCancel = null;
          if (!sceneActive) {
            resolve();
            return;
          }
          if (messageBox) { try { k.destroy(messageBox); } catch {} }
          if (messageText) { try { k.destroy(messageText); } catch {} }
          messageBox = null;
          messageText = null;
          resolve();
        });
        messageTimerCancel = timer.cancel;
      });
    }

    function clearMessage(): void {
      if (messageTimerCancel) { try { messageTimerCancel(); } catch {} }
      if (messageBox) { try { k.destroy(messageBox); } catch {} }
      if (messageText) { try { k.destroy(messageText); } catch {} }
      messageBox = null;
      messageText = null;
      messageTimerCancel = null;
    }

    // --- HP UPDATE ---
    function updateEnemyHp(): void {
      const ratio = enemyStats.hp / enemyStats.maxHp;
      enemyHpBar.width = 146 * ratio;
      enemyHpBarBottom.width = 146 * ratio;
      enemyHpLabel.text = `${enemyStats.hp}/${enemyStats.maxHp}`;
    }

    function updatePlayerHp(): void {
      const ratio = playerStats.hp / playerStats.maxHp;
      playerHpBar.width = 176 * ratio;
      playerHpBarBottom.width = 176 * ratio;
      playerHpLabel.text = `HP: ${playerStats.hp}/${playerStats.maxHp}`;
      if (ratio > 0.5) {
        playerHpBar.color = k.rgb(60, 220, 100);
        playerHpBarBottom.color = k.rgb(40, 160, 70);
      } else if (ratio > 0.25) {
        playerHpBar.color = k.rgb(240, 200, 60);
        playerHpBarBottom.color = k.rgb(180, 150, 40);
      } else {
        playerHpBar.color = k.rgb(240, 60, 60);
        playerHpBarBottom.color = k.rgb(180, 40, 40);
      }
    }

    // --- MENU ---
    function showMenu(): void {
      menuVisible = true;
      menuBg.opacity = 1;
      actionEntities.forEach((e) => (e.opacity = 1));
      cursor.opacity = 1;
      updateCursor();
    }

    function hideMenu(): void {
      menuVisible = false;
      menuBg.opacity = 0;
      actionEntities.forEach((e) => (e.opacity = 0));
      cursor.opacity = 0;
    }

    function updateCursor(): void {
      const col = selectedAction % 2;
      const row = Math.floor(selectedAction / 2);
      cursor.pos.x = menuStartX - 15 + col * 130;
      cursor.pos.y = menuStartY + row * 30;
      actionEntities.forEach((e, i) => {
        e.color = i === selectedAction ? k.rgb(255, 255, 100) : k.rgb(200, 200, 200);
      });
    }

    // --- BATTLE ACTIONS ---
    async function playerAttack(): Promise<void> {
      if (actionInProgress || !setPhase('player_action')) return;
      actionInProgress = true;
      hideMenu();
      try {
        await showMessage('You attack!', 0.5);
        if (!sceneActive) return;
        playSound(k, 'attack');
        await playAttackLunge(k, playerEntity, enemyEntity.pos.x);
        if (!sceneActive) return;
        const result = calculateDamage(playerStats, enemyStats, false);
        if (result.isMiss) {
          playSound(k, 'miss');
          showFloatingNumber(k, enemyEntity.pos.x, enemyEntity.pos.y - 30, 'MISS', 'miss');
          await showMessage('Miss!', 0.8);
        } else {
          applyDamage(enemyStats, result.damage);
          updateEnemyHp();
          playSound(k, result.isCrit ? 'criticalHit' : 'hit');
          await playHurtEffect(k, enemyEntity);
          shakeCamera(k, result.isCrit ? 8 : 4, 0.2);
          showFloatingNumber(k, enemyEntity.pos.x, enemyEntity.pos.y - 30, result.damage, result.isCrit ? 'crit' : 'damage');
          if (result.isCrit) await showMessage(`Critical! ${result.damage} damage!`, 0.8);
        }
        if (!sceneActive) return;
        if (isDefeated(enemyStats)) { await handleVictory(); return; }
        playerDefending = false;
        await enemyTurn();
      } finally {
        actionInProgress = false;
      }
    }

    async function playerDefend(): Promise<void> {
      if (actionInProgress || !setPhase('player_action')) return;
      actionInProgress = true;
      hideMenu();
      try {
        playerDefending = true;
        playSound(k, 'defend');
        flashEntity(k, playerEntity, [100, 100, 255], 0.3);
        await showMessage('You brace for impact!', 0.8);
        if (!sceneActive) return;
        await enemyTurn();
      } finally {
        actionInProgress = false;
      }
    }

    async function playerUseItem(): Promise<void> {
      const items = GameState.player.items || [];
      const consumables = items.filter((item) => {
        const def = getItem(item.id);
        return def && def.type === 'consumable' && item.quantity > 0;
      });
      if (consumables.length === 0) { await showMessage('No items to use!', 1.0); return; }
      const itemToUse = consumables[0];
      const itemDef = getItem(itemToUse.id);
      if (!itemDef || !itemDef.effect) return;
      if (actionInProgress || !setPhase('player_action')) return;
      actionInProgress = true;
      hideMenu();
      try {
        GameState.removeItem(itemToUse.id, 1);
        if (itemDef.effect.type === 'heal') {
          const healAmount = applyHealing(playerStats, itemDef.effect.value);
          GameState.player.health = playerStats.hp;
          updatePlayerHp();
          playSound(k, 'heal');
          flashEntity(k, playerEntity, EFFECT_COLORS.heal, 0.3);
          showFloatingNumber(k, playerEntity.pos.x, playerEntity.pos.y - 30, healAmount, 'heal');
          await showMessage(`Used ${itemDef.name}! Healed ${healAmount} HP!`, 1.0);
        }
        if (!sceneActive) return;
        playerDefending = false;
        await enemyTurn();
      } finally {
        actionInProgress = false;
      }
    }

    async function playerFlee(): Promise<void> {
      if (actionInProgress || !setPhase('player_action')) return;
      actionInProgress = true;
      hideMenu();
      try {
        await showMessage('Attempting to flee...', 0.8);
        if (!sceneActive) return;
        const success = attemptFlee(GameState.player.level, floorLevel);
        if (success) {
          await showMessage('Got away safely!', 1.0);
          phase = 'flee';  // Direct set for terminal states
          await k.wait(0.5);
          returnToOrigin();
        } else {
          await showMessage('Failed to escape!', 0.8);
          if (!sceneActive) return;
          await enemyTurn();
        }
      } finally {
        actionInProgress = false;
      }
    }

    // --- ENEMY TURN ---
    async function enemyTurn(): Promise<void> {
      if (isBattleEnded() || !sceneActive) return;
      if (!setPhase('enemy_turn')) return;
      const action = decideEnemyAction(enemyDef, enemyStats, playerStats);
      if (action === 'defend') {
        await showMessage(`${enemyDef.name} is defending!`, 0.8);
        if (!sceneActive) return;
        phase = 'player_turn';
        showMenu();
        return;
      }
      phase = 'enemy_action';
      await showMessage(`${enemyDef.name} attacks!`, 0.5);
      if (!sceneActive) return;
      await playAttackLunge(k, enemyEntity, playerEntity.pos.x, 20);
      if (!sceneActive) return;
      const result = calculateDamage(enemyStats, playerStats, playerDefending);
      if (result.isMiss) {
        showFloatingNumber(k, playerEntity.pos.x, playerEntity.pos.y - 30, 'MISS', 'miss');
        await showMessage('Dodged!', 0.8);
      } else {
        applyDamage(playerStats, result.damage);
        GameState.player.health = playerStats.hp;
        updatePlayerHp();
        await playHurtEffect(k, playerEntity);
        shakeCamera(k, playerDefending ? 2 : 5, 0.2);
        showFloatingNumber(k, playerEntity.pos.x, playerEntity.pos.y - 30, result.damage, 'damage');
        if (playerDefending) await showMessage(`Blocked! Took ${result.damage} damage.`, 0.8);
      }
      if (!sceneActive) return;
      if (isDefeated(playerStats)) { await handleDefeat(); return; }
      playerDefending = false;
      phase = 'player_turn';
      showMenu();
    }

    // --- VICTORY ---
    async function handleVictory(): Promise<void> {
      phase = 'victory';  // Terminal state - direct assignment
      hideMenu();
      GameState.recordBattleWin();
      playSound(k, 'victory');
      playVictoryEffect(k, enemyEntity.pos.x, enemyEntity.pos.y);
      k.tween(1, 0, 0.5, (v) => { if (sceneActive) enemyEntity.opacity = v; });
      await showMessage('Victory!', 1.5);
      if (!sceneActive) return;
      const xpGained = calculateXpReward(enemyDef, floorLevel);
      const goldGained = calculateGoldReward(enemyDef, floorLevel);
      GameState.addGold(goldGained);
      const { levelsGained, oldLevel } = GameState.addXp(xpGained);
      playSound(k, 'goldCollect');
      showFloatingNumber(k, CANVAS_WIDTH / 2 - 40, 150, xpGained, 'xp');
      showFloatingNumber(k, CANVAS_WIDTH / 2 + 40, 150, goldGained, 'gold');
      await showMessage(`Gained ${xpGained} XP and ${goldGained} Gold!`, 2.0);
      if (!sceneActive) return;
      if (levelsGained > 0) {
        const newLevel = oldLevel + levelsGained;
        playSound(k, 'levelUp');
        flashEntity(k, playerEntity, [255, 215, 0], 0.5);
        shakeCamera(k, 6, 0.3);
        await showMessage(`LEVEL UP! You are now Level ${newLevel}!`, 2.0);
        if (!sceneActive) return;
        const stats = getLevelUpStats(newLevel);
        await showMessage(`+${stats.maxHp} HP  +${stats.attack} ATK  +${stats.defense} DEF`, 2.0);
        if (!sceneActive) return;
        playerStats.maxHp = GameState.getEffectiveMaxHealth();
        playerStats.hp = GameState.player.health;
        updatePlayerHp();
      }
      await k.wait(0.5);
      if (!sceneActive) return;
      returnToOrigin();
    }

    // --- DEFEAT ---
    async function handleDefeat(): Promise<void> {
      phase = 'defeat';  // Terminal state - direct assignment
      hideMenu();
      playSound(k, 'defeat');
      k.tween(1, 0.3, 0.5, (v) => { if (sceneActive) playerEntity.opacity = v; });
      await showMessage('Defeated...', 2.0);
      if (!sceneActive) return;
      const goldLost = Math.floor(GameState.player.gold * 0.1);
      GameState.player.gold -= goldLost;
      GameState.player.health = Math.floor(GameState.player.maxHealth * 0.5);
      if (goldLost > 0) {
        await showMessage(`Lost ${goldLost} gold...`, 1.5);
        if (!sceneActive) return;
      }
      await k.wait(0.5);
      if (!sceneActive) return;
      cleanup();
      k.go('town');
    }

    // --- CLEANUP ---
    function cleanup(): void {
      // Mark scene as inactive to stop any pending async operations
      sceneActive = false;

      // Cancel message timer
      clearMessage();

      // Cancel all registered event handlers to prevent accumulation on scene re-entry
      cleanupFunctions.forEach((cancel) => {
        try { cancel(); } catch { /* handler may already be cancelled */ }
      });
      cleanupFunctions.length = 0;
    }

    function returnToOrigin(): void {
      cleanup();
      k.go(returnScene, returnData);
    }

    // --- INPUT ---
    // Store cancel functions to clean up when leaving scene
    cleanupFunctions.push(
      k.onKeyPress('up', () => { if (menuVisible && selectedAction >= 2) { selectedAction -= 2; updateCursor(); } }).cancel,
      k.onKeyPress('down', () => { if (menuVisible && selectedAction < 2) { selectedAction += 2; updateCursor(); } }).cancel,
      k.onKeyPress('left', () => { if (menuVisible && selectedAction % 2 === 1) { selectedAction--; updateCursor(); } }).cancel,
      k.onKeyPress('right', () => { if (menuVisible && selectedAction % 2 === 0 && selectedAction < 3) { selectedAction++; updateCursor(); } }).cancel,
      k.onKeyPress('enter', () => {
        if (!menuVisible || phase !== 'player_turn') return;
        const action = actions[selectedAction];
        if (action === 'attack') playerAttack();
        else if (action === 'defend') playerDefend();
        else if (action === 'item') playerUseItem();
        else if (action === 'flee') playerFlee();
      }).cancel,
      k.onKeyPress('space', () => {
        if (!menuVisible || phase !== 'player_turn') return;
        const action = actions[selectedAction];
        if (action === 'attack') playerAttack();
        else if (action === 'defend') playerDefend();
        else if (action === 'item') playerUseItem();
        else if (action === 'flee') playerFlee();
      }).cancel
    );

    // --- START ---
    async function startBattle(): Promise<void> {
      playCatMeow(k);
      await showMessage(`A wild ${enemyDef.name} appeared!`, 1.5);
      if (!sceneActive) return;
      if (setPhase('player_turn')) {
        showMenu();
      }
    }

    startBattle();
    console.log(`=== StudyQuest Battle: ${enemyDef.name} (HP: ${enemyStats.hp}) ===`);
  });
}
