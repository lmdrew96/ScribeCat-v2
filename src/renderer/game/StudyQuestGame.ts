/**
 * StudyQuestGame
 *
 * The main StudyQuest game. This is the actual game, not a test harness.
 * Start here and build incrementally.
 */

import type { KAPLAYCtx } from 'kaplay';
import { initGame, destroyGame } from './index.js';
import { registerTitleScene } from './scenes/TitleScene.js';
import { registerTownScene } from './scenes/TownScene.js';
import { registerHomeScene } from './scenes/HomeScene.js';
import { registerShopScene } from './scenes/ShopScene.js';
import { registerInnScene } from './scenes/InnScene.js';
import { registerDungeonScene } from './scenes/DungeonScene.js';
import { registerBattleScene } from './scenes/BattleScene.js';
import { registerInventoryScene } from './scenes/InventoryScene.js';
import { GameState } from './state/GameState.js';
import { loadGameSounds } from './systems/sound.js';
import type { CatColor } from './sprites/catSprites.js';

export class StudyQuestGame {
  private k: KAPLAYCtx;
  private canvasId: string;

  constructor(canvas: HTMLCanvasElement) {
    this.canvasId = canvas.id || `studyquest-${Date.now()}`;
    canvas.id = this.canvasId;

    this.k = initGame({
      canvas,
      width: 640,
      height: 400,
      scale: 1,
      background: [26, 26, 46], // Dark purple - matches game aesthetic
      debug: false,
    });

    // Register all game scenes
    this.registerScenes();
  }

  /**
   * Register all game scenes
   */
  private registerScenes(): void {
    registerTitleScene(this.k);
    registerTownScene(this.k);
    registerHomeScene(this.k);
    registerShopScene(this.k);
    registerInnScene(this.k);
    registerDungeonScene(this.k);
    registerBattleScene(this.k);
    registerInventoryScene(this.k);
  }

  /**
   * Start the game (shows title screen)
   */
  async start(): Promise<void> {
    // Load sounds asynchronously (don't block game start)
    loadGameSounds(this.k).catch((err) => {
      console.warn('Failed to load some sounds:', err);
    });

    this.k.go('title');
  }

  /**
   * Start a new game with a specific cat color
   */
  newGame(catColor: CatColor = 'grey'): void {
    GameState.reset();
    GameState.setCatColor(catColor);
    this.k.go('town');
  }

  // NOTE: continueGame() removed - will be implemented when save/load feature is added

  /**
   * Go to a specific scene
   */
  goTo(scene: string, data?: Record<string, unknown>): void {
    this.k.go(scene, data);
  }

  /**
   * Get the KAPLAY context (for advanced usage)
   */
  getContext(): KAPLAYCtx {
    return this.k;
  }

  /**
   * Destroy the game and clean up
   */
  destroy(): void {
    destroyGame(this.canvasId);
  }
}
