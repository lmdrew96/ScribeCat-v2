/**
 * Player Component Factory
 *
 * Creates the player entity with all necessary components.
 * Movement logic is handled by the movement system, not here.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { loadCatSprites, getCatSpriteName, type CatColor, type Direction } from '../sprites/catSprites.js';

export interface PlayerConfig {
  x: number;
  y: number;
  color: CatColor;
}

export interface PlayerComp {
  direction: Direction;
  isMoving: boolean;
  canMove: boolean;
  setMoving(moving: boolean): void;
  setDirection(dir: Direction): void;
  freeze(): void;
  unfreeze(): void;
}

/**
 * Custom player behavior component
 */
function playerBehavior(): PlayerComp & { id: string } {
  return {
    id: 'playerBehavior',
    direction: 'down' as Direction,
    isMoving: false,
    canMove: true,

    setMoving(moving: boolean) {
      this.isMoving = moving;
    },

    setDirection(dir: Direction) {
      this.direction = dir;
    },

    freeze() {
      this.canMove = false;
    },

    unfreeze() {
      this.canMove = true;
    },
  };
}

/**
 * Create a player entity
 */
export async function createPlayer(k: KAPLAYCtx, config: PlayerConfig): Promise<GameObj> {
  // Ensure sprites are loaded
  await loadCatSprites(k, config.color);

  const player = k.add([
    k.sprite(getCatSpriteName(config.color, 'idle')),
    k.pos(config.x, config.y),
    k.anchor('center'),
    k.scale(2),
    k.area({ scale: 0.5 }),
    k.z(10),
    'player',
    playerBehavior(),
  ]);

  player.play('idle');

  return player;
}

/**
 * Update player animation based on state
 */
export function updatePlayerAnimation(k: KAPLAYCtx, player: GameObj, color: CatColor): void {
  const behavior = player as unknown as GameObj & PlayerComp;

  if (behavior.isMoving) {
    const walkSprite = getCatSpriteName(color, 'walk');
    // Check if we need to switch sprites
    try {
      player.use(k.sprite(walkSprite));
      player.play('walk');
    } catch {
      // Sprite already loaded
    }
  } else {
    const idleSprite = getCatSpriteName(color, 'idle');
    try {
      player.use(k.sprite(idleSprite));
      player.play('idle');
    } catch {
      // Sprite already loaded
    }
  }
}
