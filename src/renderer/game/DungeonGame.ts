/**
 * DungeonGame
 *
 * Simple wrapper for the dungeon KAPLAY game.
 */

import type { KAPLAYCtx } from 'kaplay';
import { initGame, destroyGame } from './index.js';
import { registerDungeonScene, type DungeonSceneData } from './scenes/index.js';
import { GameState } from './state/GameState.js';
import type { CatColor } from './sprites/catSprites.js';

export class DungeonGame {
  private k: KAPLAYCtx;
  private canvasId: string;

  constructor(canvas: HTMLCanvasElement) {
    this.canvasId = canvas.id || `dungeon-${Date.now()}`;
    canvas.id = this.canvasId;

    this.k = initGame({
      canvas,
      width: 480,
      height: 320,
      scale: 1,
      background: [10, 10, 30],
      debug: false,
    });

    registerDungeonScene(this.k);
  }

  setCatColor(color: CatColor): void {
    GameState.setCatColor(color);
  }

  start(data: Partial<DungeonSceneData> = {}): void {
    this.k.go('dungeon', data);
  }

  destroy(): void {
    destroyGame(this.canvasId);
  }
}
