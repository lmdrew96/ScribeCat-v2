/**
 * Movement System
 *
 * Handles player input and movement.
 */

import type { KAPLAYCtx } from 'kaplay';
import type { Player } from '../components/Player.js';

export interface MovementBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface MovementConfig {
  k: KAPLAYCtx;
  player: Player;
  speed: number;
  bounds: MovementBounds;
}

export function setupMovement(config: MovementConfig): () => void {
  const { k, player, speed, bounds } = config;

  const cancel = k.onUpdate(() => {
    if (!player.canMove) {
      if (player.isMoving) {
        player.isMoving = false;
        player.setAnimation('idle');
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
      // Normalize diagonal
      const len = Math.sqrt(dx * dx + dy * dy);
      const moveX = (dx / len) * speed * k.dt();
      const moveY = (dy / len) * speed * k.dt();

      // Apply with bounds
      const newX = Math.max(bounds.minX, Math.min(player.entity.pos.x + moveX, bounds.maxX));
      const newY = Math.max(bounds.minY, Math.min(player.entity.pos.y + moveY, bounds.maxY));
      player.moveTo(newX, newY);

      // Flip sprite
      player.entity.flipX = dx < 0;

      if (!player.isMoving) {
        player.isMoving = true;
        player.setAnimation('walk');
      }
    } else {
      if (player.isMoving) {
        player.isMoving = false;
        player.setAnimation('idle');
      }
    }
  });

  return cancel;
}
