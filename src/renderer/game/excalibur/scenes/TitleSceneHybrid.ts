/**
 * TitleSceneHybrid
 *
 * Refactored title scene using hybrid Canvas + HTML approach:
 * - Canvas: Beautiful Tuna Springs background image
 * - HTML: Title, menu buttons, cat selection carousel, settings
 *
 * This replaces the pure canvas TitleScene with a much cleaner implementation.
 */

import * as ex from 'excalibur';
import { GameState } from '../../state/GameState.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../config.js';
import type { CatColor } from '../adapters/SpriteAdapter.js';
import { loadBackground, createBackgroundActor } from '../../loaders/BackgroundLoader.js';
import { AudioManager } from '../../audio/AudioManager.js';
import { TitleOverlay } from '../components/TitleOverlay.js';

export interface TitleSceneData {
  // No data needed for title scene
}

/**
 * Hybrid Title Scene - Canvas background + HTML UI overlay
 */
export class TitleSceneHybrid extends ex.Scene {
  // HTML overlay
  private titleOverlay: TitleOverlay | null = null;

  // Callbacks
  public onStartNewGame: ((catColor: CatColor) => void) | null = null;
  public onContinueGame: (() => Promise<{ success: boolean; catColor?: CatColor; dungeonData?: { dungeonId: string; floorNumber: number } }>) | null = null;

  onActivate(_ctx: ex.SceneActivationContext<TitleSceneData>): void {
    this.clear();
    this.setupBackground();
    this.setupOverlay();

    // Play title music
    AudioManager.playSceneMusic('title');

    console.log('=== StudyQuest Title Scene (Hybrid) ===');
  }

  onDeactivate(): void {
    // Cleanup HTML overlay
    this.titleOverlay?.destroy();
    this.titleOverlay = null;
  }

  /**
   * Setup the Tuna Springs background
   */
  private async setupBackground(): Promise<void> {
    // Load the beautiful Tuna Springs background
    const bgImage = await loadBackground('tunaSprings');

    if (bgImage) {
      const bgActor = createBackgroundActor(bgImage, CANVAS_WIDTH, CANVAS_HEIGHT, 0);
      this.add(bgActor);
    } else {
      // Fallback to dark gradient if image fails to load
      const bg = new ex.Actor({
        pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        z: 0,
      });
      bg.graphics.use(
        new ex.Rectangle({
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          color: ex.Color.fromHex('#1a1a2e'),
        })
      );
      this.add(bg);
    }
  }

  /**
   * Setup the HTML overlay
   */
  private setupOverlay(): void {
    const canvas = this.engine.canvas;
    const container = canvas.parentElement;

    if (!container) {
      console.warn('TitleSceneHybrid: Could not find canvas container for overlay');
      return;
    }

    // Ensure container has relative positioning for absolute overlay
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    this.titleOverlay = new TitleOverlay(container, {
      onNewGame: async (catColor: CatColor) => {
        // Initialize cloud sync for new game
        await GameState.initializeCloudForNewGame();

        GameState.reset();
        GameState.setCatColor(catColor);

        if (this.onStartNewGame) {
          this.onStartNewGame(catColor);
        }
      },

      onContinue: async () => {
        // Load from cloud
        const success = await GameState.loadFromCloud();
        return {
          success,
          catColor: success ? GameState.player.catColor : undefined,
        };
      },

      onResumeGame: (catColor: CatColor) => {
        // Apply selected cat color
        GameState.setCatColor(catColor);

        // Navigate to appropriate scene
        if (GameState.hasActiveDungeonRun() && this.onContinueGame) {
          this.onContinueGame();
        } else if (this.onStartNewGame) {
          // Go to town if no active dungeon
          this.onStartNewGame(catColor);
        }
      },
    });

    // Open the overlay immediately
    this.titleOverlay.open();
  }
}
