/**
 * Player Component
 *
 * Creates and manages the player cat entity.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { loadCatSprites, getCatSpriteName, type CatColor } from '../sprites/catSprites.js';

export interface PlayerConfig {
  k: KAPLAYCtx;
  x: number;
  y: number;
  color: CatColor;
}

export interface Player {
  entity: GameObj;
  color: CatColor;
  isMoving: boolean;
  canMove: boolean;

  freeze(): void;
  unfreeze(): void;
  moveTo(x: number, y: number): void;
  setAnimation(anim: 'idle' | 'walk'): void;
}

export async function createPlayer(config: PlayerConfig): Promise<Player> {
  const { k, x, y, color } = config;

  await loadCatSprites(k, color);

  const entity = k.add([
    k.sprite(getCatSpriteName(color, 'idle')),
    k.pos(x, y),
    k.anchor('center'),
    k.scale(1),
    k.area({ scale: 0.5 }),
    k.z(10),
    'player',
  ]);

  entity.play('idle');

  let isMoving = false;
  let canMove = true;
  let currentAnim: 'idle' | 'walk' = 'idle';

  const player: Player = {
    entity,
    color,

    get isMoving() {
      return isMoving;
    },
    set isMoving(val: boolean) {
      isMoving = val;
    },

    get canMove() {
      return canMove;
    },
    set canMove(val: boolean) {
      canMove = val;
    },

    freeze() {
      canMove = false;
    },

    unfreeze() {
      canMove = true;
    },

    moveTo(newX: number, newY: number) {
      entity.pos.x = newX;
      entity.pos.y = newY;
    },

    setAnimation(anim: 'idle' | 'walk') {
      if (currentAnim === anim) return;
      currentAnim = anim;
      entity.use(k.sprite(getCatSpriteName(color, anim)));
      entity.play(anim);
    },
  };

  return player;
}
