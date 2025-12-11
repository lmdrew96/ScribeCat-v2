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

// Collision check function type: (x, y, halfWidth, halfHeight) => isColliding
export type CollisionCheck = (x: number, y: number, halfWidth: number, halfHeight: number) => boolean;

export interface MovementConfig {
  k: KAPLAYCtx;
  player: Player;
  speed: number;
  bounds: MovementBounds;
  collisionCheck?: CollisionCheck;
}

// Player collision half-sizes (based on 32x32 sprite at scale 1, with 50% area)
const PLAYER_HALF_WIDTH = 8;
const PLAYER_HALF_HEIGHT = 8;

export function setupMovement(config: MovementConfig): () => void {
  const { k, player, speed, bounds, collisionCheck } = config;

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

      // Calculate new position with bounds
      let newX = Math.max(bounds.minX, Math.min(player.entity.pos.x + moveX, bounds.maxX));
      let newY = Math.max(bounds.minY, Math.min(player.entity.pos.y + moveY, bounds.maxY));

      // Check collision if callback provided
      if (collisionCheck) {
        // Try moving in both directions
        if (collisionCheck(newX, newY, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT)) {
          // Try X only
          const xOnly = collisionCheck(newX, player.entity.pos.y, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT);
          // Try Y only
          const yOnly = collisionCheck(player.entity.pos.x, newY, PLAYER_HALF_WIDTH, PLAYER_HALF_HEIGHT);

          if (!xOnly) {
            // Can move in X
            newY = player.entity.pos.y;
          } else if (!yOnly) {
            // Can move in Y
            newX = player.entity.pos.x;
          } else {
            // Can't move at all
            newX = player.entity.pos.x;
            newY = player.entity.pos.y;
          }
        }
      }

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
