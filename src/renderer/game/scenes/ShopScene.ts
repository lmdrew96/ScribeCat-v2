/**
 * ShopScene
 *
 * Where players can buy:
 * - Consumable items (potions, etc.)
 * - Equipment (weapons, armor)
 * - Furniture for their home
 *
 * Placeholder implementation - will be expanded later.
 */

import type { KAPLAYCtx } from 'kaplay';
import { GameState } from '../state/GameState.js';
import { createPlayer } from '../components/Player.js';
import { setupMovement } from '../systems/movement.js';
import { setupInteraction, type Interactable } from '../systems/interaction.js';
import { createDoor } from '../components/Door.js';
import { PLAYER_SPEED } from '../config.js';
import type { CatColor } from '../sprites/catSprites.js';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 400;

export interface ShopSceneData {
  catColor?: CatColor;
  fromScene?: string;
}

export function registerShopScene(k: KAPLAYCtx): void {
  k.scene('shop', async (data: ShopSceneData = {}) => {
    const catColor = data.catColor || GameState.player.catColor;

    // --- BACKGROUND ---
    // Floor
    k.add([
      k.rect(CANVAS_WIDTH, CANVAS_HEIGHT),
      k.pos(0, 0),
      k.color(101, 67, 33), // Dark wood floor
      k.z(0),
    ]);

    // Wall
    k.add([
      k.rect(CANVAS_WIDTH, 180),
      k.pos(0, 0),
      k.color(70, 130, 180), // Steel blue wall
      k.z(1),
    ]);

    // Wall border
    k.add([
      k.rect(CANVAS_WIDTH, 8),
      k.pos(0, 180),
      k.color(50, 50, 50),
      k.z(2),
    ]);

    // --- SHOP COUNTER ---
    k.add([
      k.rect(400, 60),
      k.pos(120, 200),
      k.color(139, 69, 19), // Wood counter
      k.outline(3, k.rgb(0, 0, 0)),
      k.z(5),
    ]);

    // --- SHOPKEEPER (placeholder) ---
    const shopkeeper = k.add([
      k.rect(40, 60),
      k.pos(CANVAS_WIDTH / 2 - 20, 140),
      k.color(255, 182, 193), // Pink (placeholder)
      k.outline(2, k.rgb(0, 0, 0)),
      k.z(6),
      'shopkeeper',
    ]);

    // Shopkeeper label
    k.add([
      k.text('Shopkeeper', { size: 10 }),
      k.pos(CANVAS_WIDTH / 2, 130),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.z(10),
    ]);

    // --- ITEM DISPLAYS ---
    const displayItems = [
      { x: 150, label: 'Potions', color: k.rgb(255, 0, 128) },
      { x: 280, label: 'Weapons', color: k.rgb(192, 192, 192) },
      { x: 410, label: 'Armor', color: k.rgb(255, 215, 0) },
    ];

    displayItems.forEach((item) => {
      k.add([
        k.rect(60, 40),
        k.pos(item.x - 30, 50),
        k.color(item.color),
        k.outline(2, k.rgb(0, 0, 0)),
        k.z(4),
      ]);
      k.add([
        k.text(item.label, { size: 8 }),
        k.pos(item.x, 90),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.z(10),
      ]);
    });

    // --- DOOR ---
    const exitDoor = createDoor({
      k,
      x: CANVAS_WIDTH / 2,
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
      k.text('Exit', { size: 10 }),
      k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.z(10),
    ]);

    // --- PLAYER ---
    const player = await createPlayer({
      k,
      x: CANVAS_WIDTH / 2,
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
        minY: 270,
        maxY: CANVAS_HEIGHT - 60,
      },
    });

    // --- INTERACTIONS ---
    const interactables: Interactable[] = [
      {
        entity: exitDoor.entity,
        type: 'door',
        promptText: exitDoor.getPromptText(),
        onInteract: () => exitDoor.enter(),
      },
      {
        entity: shopkeeper,
        type: 'npc',
        promptText: 'ENTER to browse wares',
        range: 80,
        onInteract: () => {
          // Placeholder - would open shop UI
          console.log('Shop UI would open here!');
          showShopMessage(k, 'Welcome! (Shop UI coming soon)');
        },
      },
    ];

    setupInteraction({
      k,
      player,
      interactables,
    });

    // --- UI ---
    // Gold display
    k.add([
      k.rect(100, 30),
      k.pos(CANVAS_WIDTH - 110, 10),
      k.color(0, 0, 0),
      k.opacity(0.6),
      k.z(50),
    ]);

    k.add([
      k.text(`Gold: ${GameState.player.gold}`, { size: 12 }),
      k.pos(CANVAS_WIDTH - 100, 18),
      k.color(251, 191, 36),
      k.z(51),
    ]);

    // Scene label
    k.add([
      k.text('Shop', { size: 16 }),
      k.pos(20, 20),
      k.color(255, 255, 255),
      k.z(50),
    ]);

    // Controls hint
    k.add([
      k.text('Arrow/WASD: Move | ENTER: Interact | ESC: Back', { size: 8 }),
      k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10),
      k.anchor('bottom'),
      k.color(200, 200, 200),
      k.z(50),
    ]);

    // --- ESC to go back ---
    k.onKeyPress('escape', () => {
      k.go('town');
    });

    console.log('=== StudyQuest Shop ===');
  });
}

/**
 * Show a temporary message from the shopkeeper
 */
function showShopMessage(k: KAPLAYCtx, text: string): void {
  const msgBg = k.add([
    k.rect(300, 40),
    k.pos(170, 120),
    k.color(0, 0, 0),
    k.opacity(0.8),
    k.z(200),
  ]);

  const msgText = k.add([
    k.text(text, { size: 12 }),
    k.pos(320, 140),
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
