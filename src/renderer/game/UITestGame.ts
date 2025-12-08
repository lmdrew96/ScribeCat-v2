/**
 * UI Test Game
 *
 * A standalone game wrapper for testing the UI system.
 * Creates a canvas and runs the UI test scene.
 */

import { initGame } from './index.js';
import { registerUITestScene } from './scenes/UITestScene.js';
import type { KAPLAYCtx } from 'kaplay';

export class UITestGame {
  private k: KAPLAYCtx;
  private canvasId: string;

  constructor(canvas: HTMLCanvasElement) {
    this.canvasId = canvas.id || `ui-test-${Date.now()}`;
    canvas.id = this.canvasId;

    this.k = initGame({
      canvas,
      width: 480,
      height: 320,
      scale: 1,
      background: [40, 40, 60], // Slightly purple background
      debug: false,
    });

    // Register the test scene
    registerUITestScene(this.k);
  }

  /**
   * Start the UI test scene
   */
  start(): void {
    this.k.go('ui-test');
  }

  /**
   * Get the KAPLAY context
   */
  getContext(): KAPLAYCtx {
    return this.k;
  }

  /**
   * Destroy the game
   */
  destroy(): void {
    this.k.quit();
  }
}

/**
 * Quick helper to create and start a UI test game on a canvas
 */
export function runUITest(canvas: HTMLCanvasElement): UITestGame {
  const game = new UITestGame(canvas);
  game.start();
  return game;
}
