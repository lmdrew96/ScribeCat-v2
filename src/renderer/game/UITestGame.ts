/**
 * UI Test Game
 *
 * A standalone game wrapper for testing UI and player systems.
 * Creates a canvas and runs test scenes.
 */

import { initGame } from './index.js';
import { registerUITestScene } from './scenes/UITestScene.js';
import { registerPlayerTestScene } from './scenes/PlayerTestScene.js';
import type { KAPLAYCtx } from 'kaplay';
import type { CatColor } from './sprites/catSprites.js';

export type TestScene = 'ui-test' | 'player-test';

export class UITestGame {
  private k: KAPLAYCtx;
  private canvasId: string;
  private currentScene: TestScene = 'ui-test';

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

    // Register all test scenes
    registerUITestScene(this.k);
    registerPlayerTestScene(this.k);

    // Setup scene switching hotkey (T key in both scenes)
    this.setupSceneSwitching();
  }

  /**
   * Setup T key to toggle between scenes
   */
  private setupSceneSwitching(): void {
    this.k.onKeyPress('t', () => {
      if (this.currentScene === 'ui-test') {
        this.goToScene('player-test');
      } else {
        this.goToScene('ui-test');
      }
    });
  }

  /**
   * Start with UI test scene (default)
   */
  start(): void {
    this.k.go('ui-test');
    this.currentScene = 'ui-test';
  }

  /**
   * Start with player test scene
   */
  startPlayerTest(catColor?: CatColor): void {
    this.k.go('player-test', { catColor });
    this.currentScene = 'player-test';
  }

  /**
   * Go to a specific scene
   */
  goToScene(scene: TestScene, data?: Record<string, unknown>): void {
    this.k.go(scene, data);
    this.currentScene = scene;
  }

  /**
   * Get current scene
   */
  getCurrentScene(): TestScene {
    return this.currentScene;
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

/**
 * Quick helper to create and start a player test game on a canvas
 */
export function runPlayerTest(canvas: HTMLCanvasElement, catColor?: CatColor): UITestGame {
  const game = new UITestGame(canvas);
  game.startPlayerTest(catColor);
  return game;
}
