/**
 * Movement System
 *
 * Handles player movement input and physics.
 * Extracted from DungeonScene for reuse.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { PLAYER_SPEED } from '../config.js';
import { updatePlayerAnimation, type PlayerComp } from '../components/player.js';
import type { CatColor } from '../sprites/catSprites.js';

export interface MovementBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface MovementSystemConfig {
  player: GameObj;
  catColor: CatColor;
  bounds: MovementBounds;
  speed?: number;
}

/**
 * Setup movement system for a player
 * Returns a cancel function to stop the system
 */
export function setupMovementSystem(k: KAPLAYCtx, config: MovementSystemConfig): () => void {
  const { player, catColor, bounds, speed = PLAYER_SPEED } = config;
  const behavior = player as unknown as GameObj & PlayerComp;

  // Track last sprite state to avoid unnecessary updates
  let lastMovingState = false;

  const cancel = k.onUpdate(() => {
    // Skip if player can't move (during transitions, dialogs, etc.)
    if (!behavior.canMove) {
      if (behavior.isMoving) {
        behavior.setMoving(false);
        updatePlayerAnimation(k, player, catColor);
      }
      return;
    }

    // Read input
    let dx = 0;
    let dy = 0;

    if (k.isKeyDown('left') || k.isKeyDown('a')) dx = -1;
    if (k.isKeyDown('right') || k.isKeyDown('d')) dx = 1;
    if (k.isKeyDown('up') || k.isKeyDown('w')) dy = -1;
    if (k.isKeyDown('down') || k.isKeyDown('s')) dy = 1;

    const moving = dx !== 0 || dy !== 0;

    if (moving) {
      // Normalize diagonal movement
      const len = Math.sqrt(dx * dx + dy * dy);
      const moveX = (dx / len) * speed * k.dt();
      const moveY = (dy / len) * speed * k.dt();

      // Apply movement with bounds clamping
      player.pos.x = Math.max(bounds.minX, Math.min(player.pos.x + moveX, bounds.maxX));
      player.pos.y = Math.max(bounds.minY, Math.min(player.pos.y + moveY, bounds.maxY));

      // Update direction
      if (dy < 0) behavior.setDirection('up');
      else if (dy > 0) behavior.setDirection('down');
      else if (dx < 0) behavior.setDirection('left');
      else if (dx > 0) behavior.setDirection('right');

      // Flip sprite for left movement
      player.flipX = dx < 0;
    }

    // Update animation if state changed
    if (moving !== lastMovingState) {
      behavior.setMoving(moving);
      updatePlayerAnimation(k, player, catColor);
      lastMovingState = moving;
    }
  });

  return cancel;
}
