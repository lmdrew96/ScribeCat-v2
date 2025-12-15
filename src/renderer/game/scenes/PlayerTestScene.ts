/**
 * Player Test Scene
 *
 * A simple scene to test player movement and animations.
 * Session 1 of StudyQuest implementation.
 */

import type { KAPLAYCtx } from 'kaplay';
import { createPlayer } from '../components/Player.js';
import { setupMovement } from '../systems/movement.js';
import { PLAYER_SPEED, DUNGEON_CANVAS_WIDTH, DUNGEON_CANVAS_HEIGHT } from '../config.js';
import type { CatColor } from '../sprites/catSprites.js';

// Use dungeon canvas size for test scene
const CANVAS_WIDTH = DUNGEON_CANVAS_WIDTH;
const CANVAS_HEIGHT = DUNGEON_CANVAS_HEIGHT;
const ROOM_PADDING = 40;
const WALL_THICKNESS = 8;

export interface PlayerTestSceneData {
  catColor?: CatColor;
}

/**
 * Register the player test scene
 */
export function registerPlayerTestScene(k: KAPLAYCtx): void {
  k.scene('player-test', async (data: PlayerTestSceneData = {}) => {
    const catColor = data.catColor || 'grey';

    // --- DRAW ROOM ---
    // Floor
    k.add([
      k.rect(CANVAS_WIDTH - ROOM_PADDING * 2, CANVAS_HEIGHT - ROOM_PADDING * 2),
      k.pos(ROOM_PADDING, ROOM_PADDING),
      k.color(42, 42, 78), // #2a2a4e
      k.z(0),
    ]);

    // Walls (top, bottom, left, right)
    const wallColor = k.rgb(26, 26, 46); // #1a1a2e
    // Top wall
    k.add([
      k.rect(CANVAS_WIDTH - ROOM_PADDING * 2 + WALL_THICKNESS * 2, WALL_THICKNESS),
      k.pos(ROOM_PADDING - WALL_THICKNESS, ROOM_PADDING - WALL_THICKNESS),
      k.color(wallColor),
      k.z(1),
    ]);
    // Bottom wall
    k.add([
      k.rect(CANVAS_WIDTH - ROOM_PADDING * 2 + WALL_THICKNESS * 2, WALL_THICKNESS),
      k.pos(ROOM_PADDING - WALL_THICKNESS, CANVAS_HEIGHT - ROOM_PADDING),
      k.color(wallColor),
      k.z(1),
    ]);
    // Left wall
    k.add([
      k.rect(WALL_THICKNESS, CANVAS_HEIGHT - ROOM_PADDING * 2 + WALL_THICKNESS * 2),
      k.pos(ROOM_PADDING - WALL_THICKNESS, ROOM_PADDING - WALL_THICKNESS),
      k.color(wallColor),
      k.z(1),
    ]);
    // Right wall
    k.add([
      k.rect(WALL_THICKNESS, CANVAS_HEIGHT - ROOM_PADDING * 2 + WALL_THICKNESS * 2),
      k.pos(CANVAS_WIDTH - ROOM_PADDING, ROOM_PADDING - WALL_THICKNESS),
      k.color(wallColor),
      k.z(1),
    ]);

    // --- CREATE PLAYER ---
    const player = await createPlayer({
      k,
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      color: catColor,
    });

    // --- SETUP MOVEMENT ---
    const bounds = {
      minX: ROOM_PADDING + 16,
      maxX: CANVAS_WIDTH - ROOM_PADDING - 16,
      minY: ROOM_PADDING + 16,
      maxY: CANVAS_HEIGHT - ROOM_PADDING - 16,
    };

    setupMovement({
      k,
      player,
      speed: PLAYER_SPEED,
      bounds,
    });

    // --- UI ---
    // Title
    k.add([
      k.text('Player Test Scene', { size: 16 }),
      k.pos(CANVAS_WIDTH / 2, 16),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.z(100),
    ]);

    // Controls hint
    k.add([
      k.text('Arrow Keys / WASD to move', { size: 13 }),
      k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 16),
      k.anchor('center'),
      k.color(150, 150, 180),
      k.z(100),
    ]);

    // Cat color indicator
    const colorText = k.add([
      k.text(`Cat: ${catColor}`, { size: 13 }),
      k.pos(10, CANVAS_HEIGHT - 16),
      k.anchor('left'),
      k.color(150, 150, 180),
      k.z(100),
    ]);

    // Position indicator
    const posText = k.add([
      k.text('', { size: 13 }),
      k.pos(CANVAS_WIDTH - 10, CANVAS_HEIGHT - 16),
      k.anchor('right'),
      k.color(150, 150, 180),
      k.z(100),
    ]);

    // Update position display
    k.onUpdate(() => {
      posText.text = `(${Math.round(player.entity.pos.x)}, ${Math.round(player.entity.pos.y)})`;
    });

    // Cat color cycling (C key)
    const catColors: CatColor[] = ['grey', 'white', 'black'];
    let colorIndex = catColors.indexOf(catColor);

    k.onKeyPress('c', () => {
      colorIndex = (colorIndex + 1) % catColors.length;
      const newColor = catColors[colorIndex];
      k.go('player-test', { catColor: newColor });
    });

    // Add color cycle hint
    k.add([
      k.text('C = cycle cat color', { size: 13 }),
      k.pos(10, 10),
      k.color(150, 150, 180),
      k.z(100),
    ]);

    // Debug info
    console.log('=== Player Test Scene ===');
    console.log(`Cat color: ${catColor}`);
    console.log('Controls:');
    console.log('  Arrow keys / WASD = Move');
    console.log('  C = Cycle cat color');
  });
}
