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
  calculateDamageWithBuffs,
  applyDamage,
  applyHealing,
  isDefeated,
  decideEnemyAction,
  attemptFlee,
  getLevelUpStats,
  applyBuff,
  tickBuffs,
  getBuffBonus,
  regenerateMana,
  type BattlePhase,
  type PlayerAction,
  type CombatStats,
  type ActiveBuff,
  type BuffType,
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
      mana: GameState.player.mana,
      maxMana: GameState.getEffectiveMaxMana(),
      manaRegen: GameState.getEffectiveManaRegen(),
    };

    // Buff tracking
    let playerBuffs: ActiveBuff[] = [];

    // Battle state with scene lifecycle tracking
    let phase: BattlePhase = 'intro';
    let playerDefending = false;
    let selectedAction = 0;
    let menuVisible = false;
    let sceneActive = true;  // Track if scene is still active for promise handling
    let actionInProgress = false;  // Prevent multiple simultaneous actions

    // Item menu state
    let itemMenuVisible = false;
    let selectedItemIndex = 0;
    let itemMenuElements: GameObj[] = [];

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
    k.add([k.text(`Floor ${floorLevel}`, { size: 13 }), k.pos(CANVAS_WIDTH - 80, 15), k.color(200, 200, 200), k.z(100)]);

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
    const enemyHpLabel = k.add([k.text(`${enemyStats.hp}/${enemyStats.maxHp}`, { size: 12 }), k.pos(CANVAS_WIDTH - 105, 46), k.anchor('center'), k.color(255, 255, 255), k.z(103)]);

    // Player HP bar
    k.add([k.rect(186, 22), k.pos(17, CANVAS_HEIGHT - 133), k.color(0, 0, 0), k.z(99)]);
    k.add([k.rect(182, 18), k.pos(19, CANVAS_HEIGHT - 131), k.color(40, 40, 40), k.z(100)]);
    k.add([k.rect(178, 14), k.pos(21, CANVAS_HEIGHT - 129), k.color(20, 50, 30), k.z(100)]);
    const playerHpBar = k.add([k.rect(176, 6), k.pos(22, CANVAS_HEIGHT - 128), k.color(60, 220, 100), k.z(101)]);
    const playerHpBarBottom = k.add([k.rect(176, 6), k.pos(22, CANVAS_HEIGHT - 122), k.color(40, 160, 70), k.z(101)]);
    k.add([k.rect(168, 2), k.pos(26, CANVAS_HEIGHT - 126), k.color(180, 255, 200), k.opacity(0.4), k.z(102)]);
    const playerHpLabel = k.add([k.text(`HP: ${playerStats.hp}/${playerStats.maxHp}`, { size: 13 }), k.pos(110, CANVAS_HEIGHT - 122), k.anchor('center'), k.color(255, 255, 255), k.z(103)]);

    // Player MP bar (below HP bar)
    k.add([k.rect(186, 18), k.pos(17, CANVAS_HEIGHT - 113), k.color(0, 0, 0), k.z(99)]);
    k.add([k.rect(182, 14), k.pos(19, CANVAS_HEIGHT - 111), k.color(40, 40, 40), k.z(100)]);
    k.add([k.rect(178, 10), k.pos(21, CANVAS_HEIGHT - 109), k.color(20, 30, 50), k.z(100)]);
    const playerMpBar = k.add([k.rect(176, 4), k.pos(22, CANVAS_HEIGHT - 108), k.color(100, 150, 255), k.z(101)]);
    const playerMpBarBottom = k.add([k.rect(176, 4), k.pos(22, CANVAS_HEIGHT - 104), k.color(70, 110, 200), k.z(101)]);
    k.add([k.rect(168, 2), k.pos(26, CANVAS_HEIGHT - 107), k.color(180, 200, 255), k.opacity(0.4), k.z(102)]);
    const playerMpLabel = k.add([k.text(`MP: ${playerStats.mana}/${playerStats.maxMana}`, { size: 12 }), k.pos(110, CANVAS_HEIGHT - 105), k.anchor('center'), k.color(255, 255, 255), k.z(103)]);

    // Buff indicator area (shows active buffs)
    const buffLabel = k.add([k.text('', { size: 12 }), k.pos(17, CANVAS_HEIGHT - 93), k.color(255, 220, 100), k.z(103)]);

    // --- ACTION MENU ---
    const menuBg = k.add([k.rect(340, 80), k.pos(CANVAS_WIDTH / 2 - 170, CANVAS_HEIGHT - 95), k.color(30, 30, 50), k.outline(3, k.rgb(100, 100, 150)), k.opacity(0), k.z(150)]);

    type ExtendedPlayerAction = PlayerAction | 'magic';
    const actions: ExtendedPlayerAction[] = ['attack', 'magic', 'defend', 'item', 'flee'];
    const actionLabels = ['Attack', 'Magic', 'Defend', 'Item', 'Run'];
    const actionEntities: GameObj[] = [];
    const menuStartX = CANVAS_WIDTH / 2 - 150;
    const menuStartY = CANVAS_HEIGHT - 75;

    // Layout: Row 1: Attack, Magic, Defend | Row 2: Item, Run
    const menuPositions = [
      { col: 0, row: 0 }, // Attack
      { col: 1, row: 0 }, // Magic
      { col: 2, row: 0 }, // Defend
      { col: 0, row: 1 }, // Item
      { col: 1, row: 1 }, // Run
    ];
    actions.forEach((action, i) => {
      const { col, row } = menuPositions[i];
      const label = k.add([k.text(actionLabels[i], { size: 12 }), k.pos(menuStartX + col * 110, menuStartY + row * 30), k.color(200, 200, 200), k.opacity(0), k.z(151), { action, index: i }]);
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
      const { col, row } = menuPositions[selectedAction];
      cursor.pos.x = menuStartX - 15 + col * 110;
      cursor.pos.y = menuStartY + row * 30;
      actionEntities.forEach((e, i) => {
        e.color = i === selectedAction ? k.rgb(255, 255, 100) : k.rgb(200, 200, 200);
      });
    }

    function updatePlayerMp(): void {
      const ratio = (playerStats.mana || 0) / (playerStats.maxMana || 1);
      playerMpBar.width = 176 * ratio;
      playerMpBarBottom.width = 176 * ratio;
      playerMpLabel.text = `MP: ${playerStats.mana}/${playerStats.maxMana}`;
    }

    function updateBuffDisplay(): void {
      if (playerBuffs.length === 0) {
        buffLabel.text = '';
        return;
      }
      const buffTexts = playerBuffs.map((buff) => {
        const sign = buff.value > 0 ? '+' : '';
        const statName = buff.type.toUpperCase().slice(0, 3);
        return `${statName}${sign}${buff.value}(${buff.remainingTurns})`;
      });
      buffLabel.text = buffTexts.join(' ');
    }

    // --- ITEM MENU ---
    function getConsumableItems(): { id: string; quantity: number; name: string; description: string }[] {
      const items = GameState.player.items || [];
      return items
        .filter((item) => {
          const def = getItem(item.id);
          return def && def.type === 'consumable' && item.quantity > 0;
        })
        .map((item) => {
          const def = getItem(item.id)!;
          return {
            id: item.id,
            quantity: item.quantity,
            name: def.name,
            description: def.description,
          };
        });
    }

    function clearItemMenu(): void {
      for (const e of itemMenuElements) {
        try { if (e.exists()) k.destroy(e); } catch {}
      }
      itemMenuElements = [];
    }

    function showItemMenu(): void {
      itemMenuVisible = true;
      selectedItemIndex = 0;
      hideMenu();
      renderItemMenu();
    }

    function hideItemMenu(): void {
      itemMenuVisible = false;
      clearItemMenu();
    }

    function renderItemMenu(): void {
      clearItemMenu();

      const consumables = getConsumableItems();
      const menuX = CANVAS_WIDTH / 2 - 150;
      const menuY = 130;
      const menuWidth = 300;
      const itemHeight = 28;
      const maxVisible = 5;
      const menuHeight = Math.min(consumables.length, maxVisible) * itemHeight + 60;

      // Background
      const bg = k.add([
        k.rect(menuWidth, menuHeight),
        k.pos(menuX, menuY),
        k.color(20, 20, 40),
        k.outline(3, k.rgb(100, 100, 150)),
        k.z(200),
      ]);
      itemMenuElements.push(bg);

      // Title
      const title = k.add([
        k.text('Select Item', { size: 14 }),
        k.pos(CANVAS_WIDTH / 2, menuY + 15),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.z(201),
      ]);
      itemMenuElements.push(title);

      if (consumables.length === 0) {
        const noItems = k.add([
          k.text('No items available!', { size: 13 }),
          k.pos(CANVAS_WIDTH / 2, menuY + 50),
          k.anchor('center'),
          k.color(150, 150, 150),
          k.z(201),
        ]);
        itemMenuElements.push(noItems);
      } else {
        // Calculate scroll offset
        const scrollOffset = Math.max(0, selectedItemIndex - maxVisible + 1);
        const visibleItems = consumables.slice(scrollOffset, scrollOffset + maxVisible);

        visibleItems.forEach((item, i) => {
          const actualIndex = scrollOffset + i;
          const isSelected = actualIndex === selectedItemIndex;
          const y = menuY + 35 + i * itemHeight;

          // Item row background
          const rowBg = k.add([
            k.rect(menuWidth - 20, itemHeight - 4),
            k.pos(menuX + 10, y),
            k.color(isSelected ? 60 : 30, isSelected ? 60 : 30, isSelected ? 100 : 50),
            k.outline(isSelected ? 2 : 1, k.rgb(isSelected ? 251 : 60, isSelected ? 191 : 60, isSelected ? 36 : 80)),
            k.z(201),
          ]);
          itemMenuElements.push(rowBg);

          // Cursor
          if (isSelected) {
            const cursor = k.add([
              k.text('>', { size: 14 }),
              k.pos(menuX + 15, y + 6),
              k.color(255, 255, 100),
              k.z(202),
            ]);
            itemMenuElements.push(cursor);
          }

          // Item name
          const nameText = k.add([
            k.text(item.name, { size: 13 }),
            k.pos(menuX + 30, y + 6),
            k.color(isSelected ? 255 : 200, isSelected ? 255 : 200, isSelected ? 255 : 200),
            k.z(202),
          ]);
          itemMenuElements.push(nameText);

          // Quantity
          const qtyText = k.add([
            k.text(`x${item.quantity}`, { size: 12 }),
            k.pos(menuX + menuWidth - 35, y + 7),
            k.color(150, 200, 150),
            k.z(202),
          ]);
          itemMenuElements.push(qtyText);
        });

        // Scroll indicator
        if (consumables.length > maxVisible) {
          const scrollText = k.add([
            k.text(`${selectedItemIndex + 1}/${consumables.length}`, { size: 11 }),
            k.pos(CANVAS_WIDTH / 2, menuY + menuHeight - 18),
            k.anchor('center'),
            k.color(150, 150, 150),
            k.z(201),
          ]);
          itemMenuElements.push(scrollText);
        }
      }

      // Instructions
      const instructions = k.add([
        k.text('Up/Down: Select | ENTER: Use | ESC: Back', { size: 11 }),
        k.pos(CANVAS_WIDTH / 2, menuY + menuHeight - 5),
        k.anchor('center'),
        k.color(120, 120, 120),
        k.z(201),
      ]);
      itemMenuElements.push(instructions);
    }

    function endTurnEffects(): void {
      // Tick buffs
      playerBuffs = tickBuffs(playerBuffs);
      updateBuffDisplay();

      // Regenerate mana
      regenerateMana(playerStats);
      GameState.player.mana = playerStats.mana || 0;
      updatePlayerMp();
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
        // Use calculateDamageWithBuffs to include buff effects
        const result = calculateDamageWithBuffs(playerStats, enemyStats, playerBuffs, [], false);
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

    async function playerMagic(): Promise<void> {
      // Check if player has a magic weapon equipped
      const weaponId = GameState.player.equipped.weapon;
      if (!weaponId) {
        await showMessage('No weapon equipped!', 1.0);
        return;
      }
      const weaponDef = getItem(weaponId);
      if (!weaponDef?.specialAbility) {
        await showMessage('No magic ability available!', 1.0);
        return;
      }

      const ability = weaponDef.specialAbility;
      const manaCost = ability.manaCost;

      if ((playerStats.mana || 0) < manaCost) {
        await showMessage(`Not enough MP! Need ${manaCost} MP.`, 1.0);
        return;
      }

      if (actionInProgress || !setPhase('player_action')) return;
      actionInProgress = true;
      hideMenu();

      try {
        // Use mana
        playerStats.mana = (playerStats.mana || 0) - manaCost;
        GameState.player.mana = playerStats.mana;
        updatePlayerMp();

        await showMessage(`${ability.name}!`, 0.5);
        if (!sceneActive) return;

        playSound(k, 'magic');
        flashEntity(k, playerEntity, [150, 100, 255], 0.3);
        await k.wait(0.3);
        if (!sceneActive) return;

        // Magic attacks deal direct damage based on ability effect
        const baseDamage = ability.effect.value;
        const buffBonus = getBuffBonus(playerBuffs, 'attack');
        const luckBonus = getBuffBonus(playerBuffs, 'luck');

        // Magic has lower miss chance (2.5%)
        if (Math.random() < 0.025) {
          playSound(k, 'miss');
          showFloatingNumber(k, enemyEntity.pos.x, enemyEntity.pos.y - 30, 'MISS', 'miss');
          await showMessage('Miss!', 0.8);
        } else {
          // Magic crits based on luck
          const critChance = 0.10 + ((playerStats.luck || 0) + luckBonus) * 0.01;
          const isCrit = Math.random() < critChance;
          const critMultiplier = isCrit ? 1.5 : 1.0;

          // Magic ignores some defense
          const effectiveDefense = Math.floor(enemyStats.defense * 0.3);
          const variance = 0.9 + Math.random() * 0.2;
          let damage = Math.floor((baseDamage + buffBonus - effectiveDefense) * variance * critMultiplier);
          damage = Math.max(1, damage);

          applyDamage(enemyStats, damage);
          updateEnemyHp();
          playSound(k, isCrit ? 'criticalHit' : 'hit');
          await playHurtEffect(k, enemyEntity);
          shakeCamera(k, isCrit ? 10 : 6, 0.25);
          flashEntity(k, enemyEntity, [200, 100, 255], 0.4);
          showFloatingNumber(k, enemyEntity.pos.x, enemyEntity.pos.y - 30, damage, isCrit ? 'crit' : 'damage');
          if (isCrit) await showMessage(`Critical! ${damage} magic damage!`, 0.8);
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
        // Note: Don't call endTurnEffects here - wait until after enemy turn
        await enemyTurn();
      } finally {
        actionInProgress = false;
      }
    }

    async function playerUseItem(): Promise<void> {
      const consumables = getConsumableItems();
      if (consumables.length === 0) {
        await showMessage('No items to use!', 1.0);
        return;
      }
      // Show item selection menu instead of auto-selecting
      showItemMenu();
    }

    async function useSelectedItem(): Promise<void> {
      const consumables = getConsumableItems();
      if (consumables.length === 0 || selectedItemIndex >= consumables.length) {
        hideItemMenu();
        showMenu();
        return;
      }

      const itemToUse = consumables[selectedItemIndex];
      const itemDef = getItem(itemToUse.id);
      if (!itemDef || !itemDef.effect) {
        hideItemMenu();
        showMenu();
        return;
      }

      if (actionInProgress || !setPhase('player_action')) return;
      actionInProgress = true;
      hideItemMenu();

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
        } else if (itemDef.effect.type === 'mana_restore') {
          const oldMana = playerStats.mana || 0;
          playerStats.mana = Math.min((playerStats.mana || 0) + itemDef.effect.value, playerStats.maxMana || 30);
          GameState.player.mana = playerStats.mana;
          const manaRestored = playerStats.mana - oldMana;
          updatePlayerMp();
          playSound(k, 'heal');
          flashEntity(k, playerEntity, [100, 150, 255], 0.3);
          showFloatingNumber(k, playerEntity.pos.x, playerEntity.pos.y - 30, manaRestored, 'heal');
          await showMessage(`Used ${itemDef.name}! Restored ${manaRestored} MP!`, 1.0);
        } else if (itemDef.effect.type === 'buff_attack') {
          const buff: ActiveBuff = {
            type: 'attack',
            value: itemDef.effect.value,
            remainingTurns: itemDef.effect.duration || 3,
            source: itemDef.id,
          };
          applyBuff(playerBuffs, buff);
          updateBuffDisplay();
          playSound(k, 'powerUp');
          flashEntity(k, playerEntity, [255, 150, 100], 0.3);
          await showMessage(`Used ${itemDef.name}! ATK +${buff.value} for ${buff.remainingTurns} turns!`, 1.0);
        } else if (itemDef.effect.type === 'buff_defense') {
          const buff: ActiveBuff = {
            type: 'defense',
            value: itemDef.effect.value,
            remainingTurns: itemDef.effect.duration || 3,
            source: itemDef.id,
          };
          applyBuff(playerBuffs, buff);
          updateBuffDisplay();
          playSound(k, 'powerUp');
          flashEntity(k, playerEntity, [100, 150, 255], 0.3);
          await showMessage(`Used ${itemDef.name}! DEF +${buff.value} for ${buff.remainingTurns} turns!`, 1.0);
        } else if (itemDef.effect.type === 'buff_luck') {
          const buff: ActiveBuff = {
            type: 'luck',
            value: itemDef.effect.value,
            remainingTurns: itemDef.effect.duration || 3,
            source: itemDef.id,
          };
          applyBuff(playerBuffs, buff);
          updateBuffDisplay();
          playSound(k, 'powerUp');
          flashEntity(k, playerEntity, [255, 220, 100], 0.3);
          await showMessage(`Used ${itemDef.name}! LUCK +${buff.value} for ${buff.remainingTurns} turns!`, 1.0);
        } else if (itemDef.effect.type === 'damage') {
          // Damage items like Yarn Ball Bomb
          const damage = itemDef.effect.value;
          applyDamage(enemyStats, damage);
          updateEnemyHp();
          playSound(k, 'hit');
          await playHurtEffect(k, enemyEntity);
          shakeCamera(k, 5, 0.2);
          showFloatingNumber(k, enemyEntity.pos.x, enemyEntity.pos.y - 30, damage, 'damage');
          await showMessage(`Used ${itemDef.name}! Dealt ${damage} damage!`, 1.0);
          if (isDefeated(enemyStats)) { await handleVictory(); return; }
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
        // End of round effects (buff tick, mana regen)
        endTurnEffects();
        phase = 'player_turn';
        showMenu();
        return;
      }
      phase = 'enemy_action';
      await showMessage(`${enemyDef.name} attacks!`, 0.5);
      if (!sceneActive) return;
      await playAttackLunge(k, enemyEntity, playerEntity.pos.x, 20);
      if (!sceneActive) return;
      // Use calculateDamageWithBuffs to apply player's defense buffs
      const result = calculateDamageWithBuffs(enemyStats, playerStats, [], playerBuffs, playerDefending);
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
      // End of round effects (buff tick, mana regen)
      endTurnEffects();
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

      // Clear item menu if open
      clearItemMenu();

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
    // Menu navigation for 5 items:
    // Row 0: Attack(0), Magic(1), Defend(2)
    // Row 1: Item(3), Run(4)
    function navigateUp(): void {
      // Item menu navigation
      if (itemMenuVisible) {
        const consumables = getConsumableItems();
        if (selectedItemIndex > 0) {
          selectedItemIndex--;
          renderItemMenu();
        }
        return;
      }

      if (!menuVisible) return;
      const { row } = menuPositions[selectedAction];
      if (row === 1) {
        // Move from row 1 to row 0
        selectedAction = selectedAction === 3 ? 0 : 1;
        updateCursor();
      }
    }

    function navigateDown(): void {
      // Item menu navigation
      if (itemMenuVisible) {
        const consumables = getConsumableItems();
        if (selectedItemIndex < consumables.length - 1) {
          selectedItemIndex++;
          renderItemMenu();
        }
        return;
      }

      if (!menuVisible) return;
      const { row } = menuPositions[selectedAction];
      if (row === 0) {
        // Move from row 0 to row 1
        selectedAction = selectedAction <= 1 ? 3 : 4;
        updateCursor();
      }
    }

    function navigateLeft(): void {
      if (itemMenuVisible) return; // No left/right in item menu

      if (!menuVisible) return;
      const { col, row } = menuPositions[selectedAction];
      if (col > 0) {
        // Find previous item in same row
        const prevIndex = menuPositions.findIndex(
          (p, i) => p.row === row && p.col === col - 1 && i !== selectedAction
        );
        if (prevIndex !== -1) {
          selectedAction = prevIndex;
          updateCursor();
        }
      }
    }

    function navigateRight(): void {
      if (itemMenuVisible) return; // No left/right in item menu

      if (!menuVisible) return;
      const { col, row } = menuPositions[selectedAction];
      // Find next item in same row
      const nextIndex = menuPositions.findIndex(
        (p, i) => p.row === row && p.col === col + 1 && i !== selectedAction
      );
      if (nextIndex !== -1) {
        selectedAction = nextIndex;
        updateCursor();
      }
    }

    function executeAction(): void {
      // Item menu selection
      if (itemMenuVisible) {
        useSelectedItem();
        return;
      }

      if (!menuVisible || phase !== 'player_turn') return;
      const action = actions[selectedAction];
      if (action === 'attack') playerAttack();
      else if (action === 'magic') playerMagic();
      else if (action === 'defend') playerDefend();
      else if (action === 'item') playerUseItem();
      else if (action === 'flee') playerFlee();
    }

    function handleEscape(): void {
      // Close item menu and return to main battle menu
      if (itemMenuVisible) {
        hideItemMenu();
        showMenu();
      }
    }

    // Store cancel functions to clean up when leaving scene
    cleanupFunctions.push(
      k.onKeyPress('up', navigateUp).cancel,
      k.onKeyPress('down', navigateDown).cancel,
      k.onKeyPress('left', navigateLeft).cancel,
      k.onKeyPress('right', navigateRight).cancel,
      k.onKeyPress('w', navigateUp).cancel,
      k.onKeyPress('s', navigateDown).cancel,
      k.onKeyPress('a', navigateLeft).cancel,
      k.onKeyPress('d', navigateRight).cancel,
      k.onKeyPress('enter', executeAction).cancel,
      k.onKeyPress('space', executeAction).cancel,
      k.onKeyPress('escape', handleEscape).cancel
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
