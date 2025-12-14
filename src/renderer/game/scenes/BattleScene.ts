/**
 * BattleScene
 *
 * Turn-based combat against enemies.
 * Features:
 * - Player and enemy sprites
 * - HP bars
 * - Action menu (Attack, Defend, Item, Run)
 * - Damage calculation and effects
 * - Victory/defeat outcomes
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { GameState } from '../state/GameState.js';
import { loadCatSprites, getCatSpriteName } from '../sprites/catSprites.js';
import { createEnemy, createPlaceholderEnemy } from '../components/Enemy.js';
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

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 400;

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

    // Battle state
    let phase: BattlePhase = 'intro';
    let playerDefending = false;
    let selectedAction = 0;
    let menuVisible = false;

    // --- BACKGROUND (HD Image) ---
    let bgLoaded = false;
    try {
      // Try to load HD background
      await k.loadSprite('battle-bg', '../../assets/BACKGROUNDS/Alley.png');
      bgLoaded = true;
    } catch {
      console.log('HD background not available, using fallback');
    }

    if (bgLoaded) {
      // Use HD background scaled to fit canvas
      const bgSprite = k.add([
        k.sprite('battle-bg'),
        k.pos(0, 0),
        k.z(0),
      ]);
      // Scale to cover canvas (assuming background is larger)
      const bgScale = Math.max(CANVAS_WIDTH / 1024, CANVAS_HEIGHT / 576);
      bgSprite.scale = k.vec2(bgScale, bgScale);
    } else {
      // Fallback: gradient-like background with multiple rects
      // Dark sky gradient
      k.add([
        k.rect(CANVAS_WIDTH, CANVAS_HEIGHT / 2),
        k.pos(0, 0),
        k.color(30, 30, 50),
        k.z(0),
      ]);
      k.add([
        k.rect(CANVAS_WIDTH, CANVAS_HEIGHT / 2),
        k.pos(0, CANVAS_HEIGHT / 2),
        k.color(45, 45, 70),
        k.z(0),
      ]);

      // Ground with texture pattern
      k.add([
        k.rect(CANVAS_WIDTH, 150),
        k.pos(0, CANVAS_HEIGHT - 150),
        k.color(50, 70, 50),
        k.z(1),
      ]);
      // Ground highlight stripe
      k.add([
        k.rect(CANVAS_WIDTH, 4),
        k.pos(0, CANVAS_HEIGHT - 150),
        k.color(70, 100, 70),
        k.z(1),
      ]);
      // Ground shadow at bottom
      k.add([
        k.rect(CANVAS_WIDTH, 20),
        k.pos(0, CANVAS_HEIGHT - 20),
        k.color(35, 50, 35),
        k.z(1),
      ]);
    }

    // --- HEADER ---
    const enemyNameLabel = k.add([
      k.text(enemyDef.name, { size: 14 }),
      k.pos(20, 15),
      k.color(255, 255, 255),
      k.z(100),
    ]);

    k.add([
      k.text(`Floor ${floorLevel}`, { size: 10 }),
      k.pos(CANVAS_WIDTH - 80, 15),
      k.color(200, 200, 200),
      k.z(100),
    ]);

    // --- ENEMY SPRITE ---
    let enemyEntity: GameObj;
    try {
      const enemy = await createEnemy({
        k,
        x: CANVAS_WIDTH / 2,
        y: 140,
        enemyDef,
        scale: 4,
      });
      enemyEntity = enemy.entity;
    } catch {
      // Use placeholder
      enemyEntity = createPlaceholderEnemy(k, CANVAS_WIDTH / 2, 140, enemyDef);
    }

    // --- PLAYER SPRITE ---
    await loadCatSprites(k, GameState.player.catColor);
    const playerEntity = k.add([
      k.sprite(getCatSpriteName(GameState.player.catColor, 'idle')),
      k.pos(150, CANVAS_HEIGHT - 180),
      k.anchor('center'),
      k.scale(3),
      k.z(25),
      'battle-player',
    ]);
    playerEntity.play('idle');

    // --- HP BARS (Styled with borders and gradient effect) ---
    // Enemy HP bar
    // Outer border (black)
    k.add([
      k.rect(156, 20),
      k.pos(CANVAS_WIDTH - 183, 37),
      k.color(0, 0, 0),
      k.z(99),
    ]);
    // Inner border (dark grey)
    k.add([
      k.rect(152, 16),
      k.pos(CANVAS_WIDTH - 181, 39),
      k.color(40, 40, 40),
      k.z(100),
    ]);
    // Background (empty HP - dark red)
    k.add([
      k.rect(148, 12),
      k.pos(CANVAS_WIDTH - 179, 41),
      k.color(60, 20, 20),
      k.z(100),
    ]);
    // HP fill top (brighter red)
    const enemyHpBar = k.add([
      k.rect(146, 5),
      k.pos(CANVAS_WIDTH - 178, 42),
      k.color(240, 60, 60),
      k.z(101),
    ]);
    // HP fill bottom (darker red for gradient)
    const enemyHpBarBottom = k.add([
      k.rect(146, 5),
      k.pos(CANVAS_WIDTH - 178, 47),
      k.color(180, 40, 40),
      k.z(101),
    ]);
    // HP shine highlight
    k.add([
      k.rect(140, 2),
      k.pos(CANVAS_WIDTH - 175, 43),
      k.color(255, 150, 150),
      k.opacity(0.4),
      k.z(102),
    ]);

    const enemyHpLabel = k.add([
      k.text(`${enemyStats.hp}/${enemyStats.maxHp}`, { size: 8 }),
      k.pos(CANVAS_WIDTH - 105, 46),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.z(103),
    ]);

    // Player HP bar
    // Outer border (black)
    k.add([
      k.rect(186, 22),
      k.pos(17, CANVAS_HEIGHT - 113),
      k.color(0, 0, 0),
      k.z(99),
    ]);
    // Inner border (dark grey)
    k.add([
      k.rect(182, 18),
      k.pos(19, CANVAS_HEIGHT - 111),
      k.color(40, 40, 40),
      k.z(100),
    ]);
    // Background (empty HP - dark green)
    k.add([
      k.rect(178, 14),
      k.pos(21, CANVAS_HEIGHT - 109),
      k.color(20, 50, 30),
      k.z(100),
    ]);
    // HP fill top (brighter green)
    const playerHpBar = k.add([
      k.rect(176, 6),
      k.pos(22, CANVAS_HEIGHT - 108),
      k.color(60, 220, 100),
      k.z(101),
    ]);
    // HP fill bottom (darker green for gradient)
    const playerHpBarBottom = k.add([
      k.rect(176, 6),
      k.pos(22, CANVAS_HEIGHT - 102),
      k.color(40, 160, 70),
      k.z(101),
    ]);
    // HP shine highlight
    k.add([
      k.rect(168, 2),
      k.pos(26, CANVAS_HEIGHT - 106),
      k.color(180, 255, 200),
      k.opacity(0.4),
      k.z(102),
    ]);

    const playerHpLabel = k.add([
      k.text(`HP: ${playerStats.hp}/${playerStats.maxHp}`, { size: 10 }),
      k.pos(110, CANVAS_HEIGHT - 102),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.z(103),
    ]);

    // --- ACTION MENU ---
    const menuBg = k.add([
      k.rect(280, 80),
      k.pos(CANVAS_WIDTH / 2 - 140, CANVAS_HEIGHT - 95),
      k.color(30, 30, 50),
      k.outline(3, k.rgb(100, 100, 150)),
      k.opacity(0),
      k.z(150),
    ]);

    const actions: PlayerAction[] = ['attack', 'defend', 'item', 'flee'];
    const actionLabels = ['Attack', 'Defend', 'Item', 'Run'];
    const actionEntities: GameObj[] = [];

    const menuStartX = CANVAS_WIDTH / 2 - 120;
    const menuStartY = CANVAS_HEIGHT - 75;

    actions.forEach((action, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = menuStartX + col * 130;
      const y = menuStartY + row * 30;

      const label = k.add([
        k.text(actionLabels[i], { size: 12 }),
        k.pos(x, y),
        k.color(200, 200, 200),
        k.opacity(0),
        k.z(151),
        { action, index: i },
      ]);
      actionEntities.push(label);
    });

    const cursor = k.add([
      k.text('>', { size: 12 }),
      k.pos(menuStartX - 15, menuStartY),
      k.color(255, 255, 100),
      k.opacity(0),
      k.z(152),
    ]);

    // --- MESSAGE BOX ---
    let messageBox: GameObj | null = null;
    let messageText: GameObj | null = null;

    function showMessage(text: string, duration = 1.5): Promise<void> {
      return new Promise((resolve) => {
        if (messageBox) k.destroy(messageBox);
        if (messageText) k.destroy(messageText);

        messageBox = k.add([
          k.rect(400, 50),
          k.pos(CANVAS_WIDTH / 2 - 200, 70),
          k.color(0, 0, 0),
          k.opacity(0.8),
          k.z(200),
        ]);

        messageText = k.add([
          k.text(text, { size: 12 }),
          k.pos(CANVAS_WIDTH / 2, 95),
          k.anchor('center'),
          k.color(255, 255, 255),
          k.z(201),
        ]);

        k.wait(duration, () => {
          if (messageBox) k.destroy(messageBox);
          if (messageText) k.destroy(messageText);
          messageBox = null;
          messageText = null;
          resolve();
        });
      });
    }

    // --- HP UPDATE FUNCTIONS ---
    function updateEnemyHp(): void {
      const ratio = enemyStats.hp / enemyStats.maxHp;
      const barWidth = 146 * ratio;
      enemyHpBar.width = barWidth;
      enemyHpBarBottom.width = barWidth;
      enemyHpLabel.text = `${enemyStats.hp}/${enemyStats.maxHp}`;
    }

    function updatePlayerHp(): void {
      const ratio = playerStats.hp / playerStats.maxHp;
      const barWidth = 176 * ratio;
      playerHpBar.width = barWidth;
      playerHpBarBottom.width = barWidth;
      playerHpLabel.text = `HP: ${playerStats.hp}/${playerStats.maxHp}`;

      // Color based on HP (update both gradient parts)
      if (ratio > 0.5) {
        playerHpBar.color = k.rgb(60, 220, 100); // Bright green
        playerHpBarBottom.color = k.rgb(40, 160, 70); // Dark green
      } else if (ratio > 0.25) {
        playerHpBar.color = k.rgb(240, 200, 60); // Bright yellow
        playerHpBarBottom.color = k.rgb(180, 150, 40); // Dark yellow
      } else {
        playerHpBar.color = k.rgb(240, 60, 60); // Bright red
        playerHpBarBottom.color = k.rgb(180, 40, 40); // Dark red
      }
    }

    // --- MENU FUNCTIONS ---
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

      // Highlight selected
      actionEntities.forEach((e, i) => {
        e.color = i === selectedAction ? k.rgb(255, 255, 100) : k.rgb(200, 200, 200);
      });
    }

    // --- BATTLE ACTIONS ---
    async function playerAttack(): Promise<void> {
      phase = 'player_action';
      hideMenu();

      await showMessage('You attack!', 0.5);
      playSound(k, 'attack');

      // Lunge animation
      await playAttackLunge(k, playerEntity, enemyEntity.pos.x);

      // Calculate damage
      const result = calculateDamage(playerStats, enemyStats, false);

      if (result.isMiss) {
        playSound(k, 'miss');
        showFloatingNumber(k, enemyEntity.pos.x, enemyEntity.pos.y - 30, 'MISS', 'miss');
        await showMessage('Miss!', 0.8);
      } else {
        // Apply damage
        applyDamage(enemyStats, result.damage);
        updateEnemyHp();

        // Sound based on crit
        playSound(k, result.isCrit ? 'criticalHit' : 'hit');

        // Effects
        await playHurtEffect(k, enemyEntity);
        shakeCamera(k, result.isCrit ? 8 : 4, 0.2);
        showFloatingNumber(
          k,
          enemyEntity.pos.x,
          enemyEntity.pos.y - 30,
          result.damage,
          result.isCrit ? 'crit' : 'damage'
        );

        if (result.isCrit) {
          await showMessage(`Critical! ${result.damage} damage!`, 0.8);
        }
      }

      // Check victory
      if (isDefeated(enemyStats)) {
        await handleVictory();
        return;
      }

      playerDefending = false;
      await enemyTurn();
    }

    async function playerDefend(): Promise<void> {
      phase = 'player_action';
      hideMenu();

      playerDefending = true;
      playSound(k, 'defend');
      flashEntity(k, playerEntity, [100, 100, 255], 0.3);
      await showMessage('You brace for impact!', 0.8);

      await enemyTurn();
    }

    async function playerUseItem(): Promise<void> {
      // Check if player has items
      const items = GameState.player.items || [];
      const consumables = items.filter((item) => {
        const def = getItem(item.id);
        return def && def.type === 'consumable' && item.quantity > 0;
      });

      if (consumables.length === 0) {
        await showMessage('No items to use!', 1.0);
        return;
      }

      // For now, use first consumable (health potion)
      const itemToUse = consumables[0];
      const itemDef = getItem(itemToUse.id);
      if (!itemDef || !itemDef.effect) return;

      phase = 'player_action';
      hideMenu();

      // Use item
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

      playerDefending = false;
      await enemyTurn();
    }

    async function playerFlee(): Promise<void> {
      phase = 'player_action';
      hideMenu();

      await showMessage('Attempting to flee...', 0.8);

      const success = attemptFlee(GameState.player.level, floorLevel);

      if (success) {
        await showMessage('Got away safely!', 1.0);
        phase = 'flee';
        await k.wait(0.5);
        returnToOrigin();
      } else {
        await showMessage('Failed to escape!', 0.8);
        // Enemy gets a free attack
        await enemyTurn();
      }
    }

    // --- ENEMY TURN ---
    async function enemyTurn(): Promise<void> {
      if (phase === 'victory' || phase === 'defeat' || phase === 'flee') return;

      phase = 'enemy_turn';

      const action = decideEnemyAction(enemyDef, enemyStats, playerStats);

      if (action === 'defend') {
        await showMessage(`${enemyDef.name} is defending!`, 0.8);
        phase = 'player_turn';
        showMenu();
        return;
      }

      // Enemy attacks
      phase = 'enemy_action';
      await showMessage(`${enemyDef.name} attacks!`, 0.5);

      // Attack animation
      await playAttackLunge(k, enemyEntity, playerEntity.pos.x, 20);

      // Calculate damage
      const result = calculateDamage(enemyStats, playerStats, playerDefending);

      if (result.isMiss) {
        showFloatingNumber(k, playerEntity.pos.x, playerEntity.pos.y - 30, 'MISS', 'miss');
        await showMessage('Dodged!', 0.8);
      } else {
        // Apply damage
        applyDamage(playerStats, result.damage);
        GameState.player.health = playerStats.hp;
        updatePlayerHp();

        // Effects
        await playHurtEffect(k, playerEntity);
        shakeCamera(k, playerDefending ? 2 : 5, 0.2);
        showFloatingNumber(k, playerEntity.pos.x, playerEntity.pos.y - 30, result.damage, 'damage');

        if (playerDefending) {
          await showMessage(`Blocked! Took ${result.damage} damage.`, 0.8);
        }
      }

      // Check defeat
      if (isDefeated(playerStats)) {
        await handleDefeat();
        return;
      }

      // Back to player turn
      playerDefending = false;
      phase = 'player_turn';
      showMenu();
    }

    // --- VICTORY ---
    async function handleVictory(): Promise<void> {
      phase = 'victory';
      hideMenu();

      // Record the win for unlocks
      GameState.recordBattleWin();

      // Victory sound and effects
      playSound(k, 'victory');
      playVictoryEffect(k, enemyEntity.pos.x, enemyEntity.pos.y);

      // Fade out enemy
      k.tween(1, 0, 0.5, (v) => {
        enemyEntity.opacity = v;
      });

      await showMessage('Victory!', 1.5);

      // Calculate rewards
      const xpGained = calculateXpReward(enemyDef, floorLevel);
      const goldGained = calculateGoldReward(enemyDef, floorLevel);

      // Apply gold (tracks totalGoldEarned for unlocks)
      GameState.addGold(goldGained);

      // Apply XP and check for level ups
      const { levelsGained, oldLevel } = GameState.addXp(xpGained);

      // Show rewards with sound
      playSound(k, 'goldCollect');
      showFloatingNumber(k, CANVAS_WIDTH / 2 - 40, 150, xpGained, 'xp');
      showFloatingNumber(k, CANVAS_WIDTH / 2 + 40, 150, goldGained, 'gold');
      await showMessage(`Gained ${xpGained} XP and ${goldGained} Gold!`, 2.0);

      // Show level up celebration!
      if (levelsGained > 0) {
        const newLevel = oldLevel + levelsGained;

        // Level up sound and effects
        playSound(k, 'levelUp');
        flashEntity(k, playerEntity, [255, 215, 0], 0.5);
        shakeCamera(k, 6, 0.3);

        await showMessage(`LEVEL UP! You are now Level ${newLevel}!`, 2.0);

        // Show stat increases
        const stats = getLevelUpStats(newLevel);
        await showMessage(
          `+${stats.maxHp} HP  +${stats.attack} ATK  +${stats.defense} DEF`,
          2.0
        );

        // Update player HP bar with new max
        playerStats.maxHp = GameState.getEffectiveMaxHealth();
        playerStats.hp = GameState.player.health;
        updatePlayerHp();
      }

      await k.wait(0.5);
      returnToOrigin();
    }

    // --- DEFEAT ---
    async function handleDefeat(): Promise<void> {
      phase = 'defeat';
      hideMenu();

      // Defeat sound
      playSound(k, 'defeat');

      // Fade out player
      k.tween(1, 0.3, 0.5, (v) => {
        playerEntity.opacity = v;
      });

      await showMessage('Defeated...', 2.0);

      // Lose some gold (10%)
      const goldLost = Math.floor(GameState.player.gold * 0.1);
      GameState.player.gold -= goldLost;

      // Restore some HP
      GameState.player.health = Math.floor(GameState.player.maxHealth * 0.5);

      if (goldLost > 0) {
        await showMessage(`Lost ${goldLost} gold...`, 1.5);
      }

      await k.wait(0.5);

      // Return to town on defeat
      k.go('town');
    }

    // --- RETURN TO ORIGIN ---
    function returnToOrigin(): void {
      k.go(returnScene, returnData);
    }

    // --- INPUT HANDLING ---
    k.onKeyPress('up', () => {
      if (!menuVisible) return;
      if (selectedAction >= 2) selectedAction -= 2;
      updateCursor();
    });

    k.onKeyPress('down', () => {
      if (!menuVisible) return;
      if (selectedAction < 2) selectedAction += 2;
      updateCursor();
    });

    k.onKeyPress('left', () => {
      if (!menuVisible) return;
      if (selectedAction % 2 === 1) selectedAction--;
      updateCursor();
    });

    k.onKeyPress('right', () => {
      if (!menuVisible) return;
      if (selectedAction % 2 === 0 && selectedAction < 3) selectedAction++;
      updateCursor();
    });

    k.onKeyPress('enter', () => {
      if (!menuVisible || phase !== 'player_turn') return;

      const action = actions[selectedAction];
      switch (action) {
        case 'attack':
          playerAttack();
          break;
        case 'defend':
          playerDefend();
          break;
        case 'item':
          playerUseItem();
          break;
        case 'flee':
          playerFlee();
          break;
      }
    });

    k.onKeyPress('space', () => {
      if (!menuVisible || phase !== 'player_turn') return;
      // Same as enter
      const action = actions[selectedAction];
      switch (action) {
        case 'attack':
          playerAttack();
          break;
        case 'defend':
          playerDefend();
          break;
        case 'item':
          playerUseItem();
          break;
        case 'flee':
          playerFlee();
          break;
      }
    });

    // --- INTRO SEQUENCE ---
    async function startBattle(): Promise<void> {
      // Cat meow on battle start!
      playCatMeow(k);
      await showMessage(`A wild ${enemyDef.name} appeared!`, 1.5);
      phase = 'player_turn';
      showMenu();
    }

    // Start the battle
    startBattle();

    console.log('=== StudyQuest Battle ===');
    console.log(`Enemy: ${enemyDef.name} (HP: ${enemyStats.hp})`);
  });
}
