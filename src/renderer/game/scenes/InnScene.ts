/**
 * InnScene
 *
 * Where players can rest to heal HP and restore mana for gold.
 * A cozy resting spot.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { GameState } from '../state/GameState.js';
import { createPlayer } from '../components/Player.js';
import { setupMovement } from '../systems/movement.js';
import { setupInteraction, type Interactable } from '../systems/interaction.js';
import { createDoor } from '../components/Door.js';
import { PLAYER_SPEED, CANVAS_WIDTH, CANVAS_HEIGHT } from '../config.js';
import type { CatColor } from '../sprites/catSprites.js';
import { playSound } from '../systems/sound.js';

const REST_COST = 10; // Gold cost to rest (full HP and MP restore)

export interface InnSceneData {
  catColor?: CatColor;
  fromScene?: string;
}

export function registerInnScene(k: KAPLAYCtx): void {
  k.scene('inn', async (data: InnSceneData = {}) => {
    const catColor = data.catColor || GameState.player.catColor;

    // --- BACKGROUND (HD Image) ---
    let bgLoaded = false;
    try {
      await k.loadSprite('inn-bg', '../../assets/BACKGROUNDS/Cozy Living Room by the Fire.png');
      bgLoaded = true;
    } catch {
      console.log('HD inn background not available, using fallback');
    }

    if (bgLoaded) {
      const bgSprite = k.add([
        k.sprite('inn-bg'),
        k.pos(0, 0),
        k.z(0),
      ]);
      // Scale to cover canvas
      const bgScale = Math.max(CANVAS_WIDTH / 1024, CANVAS_HEIGHT / 576);
      bgSprite.scale = k.vec2(bgScale, bgScale);
    } else {
      // Fallback: original colored rectangles
      // Floor
      k.add([
        k.rect(CANVAS_WIDTH, CANVAS_HEIGHT),
        k.pos(0, 0),
        k.color(139, 90, 43),
        k.z(0),
      ]);

      // Wall
      k.add([
        k.rect(CANVAS_WIDTH, 180),
        k.pos(0, 0),
        k.color(178, 34, 34),
        k.z(1),
      ]);

      // Wall border
      k.add([
        k.rect(CANVAS_WIDTH, 8),
        k.pos(0, 180),
        k.color(128, 0, 0),
        k.z(2),
      ]);

      // Fireplace (only show in fallback mode - HD background has one)
      k.add([
        k.rect(100, 80),
        k.pos(50, 100),
        k.color(80, 80, 80),
        k.outline(3, k.rgb(50, 50, 50)),
        k.z(3),
      ]);

      // Fire
      k.add([
        k.rect(60, 40),
        k.pos(70, 130),
        k.color(255, 100, 0),
        k.z(4),
      ]);

      // Fire glow
      k.add([
        k.rect(40, 30),
        k.pos(80, 135),
        k.color(255, 200, 50),
        k.z(5),
      ]);
    }

    // Tables
    const tables = [
      { x: 200, y: 250 },
      { x: 350, y: 280 },
      { x: 500, y: 240 },
    ];

    tables.forEach((table) => {
      k.add([
        k.rect(60, 40),
        k.pos(table.x - 30, table.y - 20),
        k.color(139, 69, 19),
        k.outline(2, k.rgb(0, 0, 0)),
        k.z(3),
      ]);
    });

    // --- INNKEEPER COUNTER ---
    k.add([
      k.rect(150, 50),
      k.pos(CANVAS_WIDTH - 200, 190),
      k.color(101, 67, 33),
      k.outline(3, k.rgb(0, 0, 0)),
      k.z(5),
    ]);

    // --- INNKEEPER (placeholder) ---
    const innkeeper = k.add([
      k.rect(40, 60),
      k.pos(CANVAS_WIDTH - 150, 130),
      k.color(144, 238, 144), // Light green (placeholder)
      k.outline(2, k.rgb(0, 0, 0)),
      k.z(6),
      'innkeeper',
    ]);

    // Innkeeper label
    k.add([
      k.text('Innkeeper', { size: 13 }),
      k.pos(CANVAS_WIDTH - 130, 120),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.z(10),
    ]);

    // --- DOOR ---
    const exitDoor = createDoor({
      k,
      x: 50,
      y: CANVAS_HEIGHT - 30,
      width: 50,
      height: 40,
      label: 'Town',
      targetScene: 'town',
      color: k.rgb(101, 67, 33),
      visible: true,
    });

    // Door label
    k.add([
      k.text('Exit', { size: 13 }),
      k.pos(50, CANVAS_HEIGHT - 10),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.z(10),
    ]);

    // --- PLAYER ---
    const player = await createPlayer({
      k,
      x: 100,
      y: CANVAS_HEIGHT - 100,
      color: catColor,
    });

    // --- MOVEMENT ---
    setupMovement({
      k,
      player,
      speed: PLAYER_SPEED,
      bounds: {
        minX: 30,
        maxX: CANVAS_WIDTH - 30,
        minY: 200,
        maxY: CANVAS_HEIGHT - 60,
      },
    });

    // --- HP/MP DISPLAY (will update after resting) ---
    let hpDisplay: GameObj | null = null;
    let mpDisplay: GameObj | null = null;

    function updateStatsDisplay(): void {
      if (hpDisplay) k.destroy(hpDisplay);
      if (mpDisplay) k.destroy(mpDisplay);

      const hp = GameState.player.health;
      const maxHp = GameState.getEffectiveMaxHealth();
      const mp = GameState.player.mana;
      const maxMp = GameState.getEffectiveMaxMana();

      const hpColor = hp < maxHp ? k.rgb(255, 100, 100) : k.rgb(100, 255, 100);
      const mpColor = mp < maxMp ? k.rgb(100, 150, 255) : k.rgb(100, 200, 255);

      hpDisplay = k.add([
        k.text(`HP: ${hp}/${maxHp}`, { size: 14 }),
        k.pos(CANVAS_WIDTH - 100, 45),
        k.color(hpColor),
        k.z(51),
      ]);

      mpDisplay = k.add([
        k.text(`MP: ${mp}/${maxMp}`, { size: 14 }),
        k.pos(CANVAS_WIDTH - 100, 60),
        k.color(mpColor),
        k.z(51),
      ]);
    }

    // --- INTERACTIONS ---
    const interactables: Interactable[] = [
      {
        entity: exitDoor.entity,
        type: 'door',
        promptText: exitDoor.getPromptText(),
        onInteract: () => exitDoor.enter(),
      },
      {
        entity: innkeeper,
        type: 'npc',
        promptText: `ENTER to rest (${REST_COST} gold)`,
        range: 80,
        onInteract: () => handleRest(k, updateStatsDisplay),
      },
    ];

    setupInteraction({
      k,
      player,
      interactables,
    });

    // --- UI ---
    // Stats display background
    k.add([
      k.rect(100, 65),
      k.pos(CANVAS_WIDTH - 110, 10),
      k.color(0, 0, 0),
      k.opacity(0.6),
      k.z(50),
    ]);

    const goldDisplay = k.add([
      k.text(`Gold: ${GameState.player.gold}`, { size: 14 }),
      k.pos(CANVAS_WIDTH - 100, 18),
      k.color(251, 191, 36),
      k.z(51),
    ]);

    updateStatsDisplay();

    // Scene label
    k.add([
      k.text('The Cozy Inn', { size: 16 }),
      k.pos(20, 20),
      k.color(255, 255, 255),
      k.z(50),
    ]);

    // Status
    k.add([
      k.text('Rest here to recover HP and MP', { size: 13 }),
      k.pos(20, 45),
      k.color(200, 200, 200),
      k.z(50),
    ]);

    // Controls hint
    k.add([
      k.text('Arrow/WASD: Move | ENTER: Interact | ESC: Back', { size: 12 }),
      k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 15),
      k.anchor('center'),
      k.color(200, 200, 200),
      k.z(50),
    ]);

    // --- ESC to go back ---
    k.onKeyPress('escape', () => {
      k.go('town');
    });

    console.log('=== StudyQuest Inn ===');
  });
}

/**
 * Handle the rest/heal interaction
 */
function handleRest(k: KAPLAYCtx, updateStatsDisplay: () => void): void {
  const hp = GameState.player.health;
  const maxHp = GameState.getEffectiveMaxHealth();
  const mp = GameState.player.mana;
  const maxMp = GameState.getEffectiveMaxMana();
  const gold = GameState.player.gold;

  // Already at full HP and MP
  if (hp >= maxHp && mp >= maxMp) {
    showInnMessage(k, "You're already feeling great!");
    return;
  }

  // Not enough gold
  if (gold < REST_COST) {
    showInnMessage(k, `Not enough gold! (Need ${REST_COST})`);
    return;
  }

  // Rest - restore HP and MP
  GameState.player.gold -= REST_COST;
  GameState.player.health = maxHp;
  GameState.fullRestoreMana();

  // Play sound
  try {
    playSound(k, 'heal');
  } catch {
    // Sound not available
  }

  // Update displays
  updateStatsDisplay();

  // Show success message
  showInnMessage(k, 'You feel refreshed! HP and MP restored.');

  // Visual effect
  const overlay = k.add([
    k.rect(640, 400),
    k.pos(0, 0),
    k.color(100, 255, 100),
    k.opacity(0),
    k.z(500),
  ]);

  k.tween(0, 0.3, 0.2, (v) => (overlay.opacity = v));
  k.wait(0.3, () => {
    k.tween(0.3, 0, 0.3, (v) => (overlay.opacity = v));
    k.wait(0.3, () => k.destroy(overlay));
  });

  console.log(`Rested! HP: ${maxHp}, MP: ${maxMp}, Gold remaining: ${GameState.player.gold}`);
}

/**
 * Show a temporary message
 */
function showInnMessage(k: KAPLAYCtx, text: string): void {
  const msgBg = k.add([
    k.rect(300, 40),
    k.pos(170, 100),
    k.color(0, 0, 0),
    k.opacity(0.8),
    k.z(200),
  ]);

  const msgText = k.add([
    k.text(text, { size: 12 }),
    k.pos(320, 120),
    k.anchor('center'),
    k.color(255, 255, 255),
    k.z(201),
  ]);

  // Auto-hide after 2 seconds
  k.wait(2, () => {
    k.destroy(msgBg);
    k.destroy(msgText);
  });
}
