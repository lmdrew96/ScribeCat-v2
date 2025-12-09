/**
 * HomeScene
 *
 * The player's personal space where they can:
 * - View their cat collection
 * - Place and arrange furniture
 * - See achievements
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

export interface HomeSceneData {
  catColor?: CatColor;
  fromScene?: string;
}

export function registerHomeScene(k: KAPLAYCtx): void {
  k.scene('home', async (data: HomeSceneData = {}) => {
    const catColor = data.catColor || GameState.player.catColor;

    // --- BACKGROUND ---
    // Floor
    k.add([
      k.rect(CANVAS_WIDTH, CANVAS_HEIGHT),
      k.pos(0, 0),
      k.color(139, 119, 101), // Warm wood floor
      k.z(0),
    ]);

    // Wall
    k.add([
      k.rect(CANVAS_WIDTH, 150),
      k.pos(0, 0),
      k.color(255, 228, 196), // Bisque/cream wall
      k.z(1),
    ]);

    // Wall border
    k.add([
      k.rect(CANVAS_WIDTH, 8),
      k.pos(0, 150),
      k.color(139, 90, 43), // Wood trim
      k.z(2),
    ]);

    // --- DECORATIVE FURNITURE (placeholders) ---
    // Bed
    k.add([
      k.rect(100, 60),
      k.pos(50, 200),
      k.color(135, 206, 250), // Light blue
      k.outline(2, k.rgb(0, 0, 0)),
      k.z(3),
    ]);
    k.add([
      k.text('Bed', { size: 10 }),
      k.pos(100, 230),
      k.anchor('center'),
      k.color(50, 50, 50),
      k.z(4),
    ]);

    // Bookshelf
    k.add([
      k.rect(60, 100),
      k.pos(500, 50),
      k.color(139, 69, 19), // Saddle brown
      k.outline(2, k.rgb(0, 0, 0)),
      k.z(3),
    ]);
    k.add([
      k.text('Books', { size: 10 }),
      k.pos(530, 100),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.z(4),
    ]);

    // Rug
    k.add([
      k.rect(120, 80),
      k.pos(CANVAS_WIDTH / 2 - 60, CANVAS_HEIGHT / 2),
      k.color(178, 34, 34), // Firebrick red
      k.outline(2, k.rgb(128, 0, 0)),
      k.z(2),
    ]);

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
      y: CANVAS_HEIGHT / 2 + 50,
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
        minY: 160,
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
    ];

    setupInteraction({
      k,
      player,
      interactables,
    });

    // --- UI ---
    // Scene label
    k.add([
      k.text('Home', { size: 16 }),
      k.pos(20, 20),
      k.color(50, 50, 50),
      k.z(50),
    ]);

    // Status
    k.add([
      k.text('(Placeholder - Furniture coming soon!)', { size: 10 }),
      k.pos(20, 45),
      k.color(100, 100, 100),
      k.z(50),
    ]);

    // Controls hint
    k.add([
      k.text('Arrow/WASD: Move | ENTER: Interact | ESC: Back', { size: 8 }),
      k.pos(CANVAS_WIDTH / 2, 10),
      k.anchor('top'),
      k.color(100, 100, 120),
      k.z(50),
    ]);

    // --- ESC to go back ---
    k.onKeyPress('escape', () => {
      k.go('town');
    });

    console.log('=== StudyQuest Home ===');
  });
}
