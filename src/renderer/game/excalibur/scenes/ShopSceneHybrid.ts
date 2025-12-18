/**
 * ShopSceneHybrid
 *
 * Refactored shop scene using hybrid Canvas + HTML approach:
 * - Canvas: Background, shopkeeper NPC, player movement, door
 * - HTML: Shop overlay UI (tabs, item list, details)
 *
 * Benefits:
 * - Much cleaner code (~200 lines vs ~800 lines)
 * - Native scrolling for item lists
 * - Easier to maintain and extend
 * - Better keyboard handling via ShopOverlay
 */

import * as ex from 'excalibur';
import { GameState } from '../../state/GameState.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../config.js';
import type { CatColor } from '../adapters/SpriteAdapter.js';
import { loadBackground, createBackgroundActor } from '../../loaders/BackgroundLoader.js';
import { createNPCActor } from '../../loaders/NPCSpriteLoader.js';
import { AudioManager } from '../../audio/AudioManager.js';
import { ShopOverlay } from '../components/ShopOverlay.js';
import { PlayerActor } from '../actors/PlayerActor.js';

export interface ShopSceneData {
  catColor?: CatColor;
  fromScene?: string;
}

/**
 * Hybrid Shop Scene - Canvas background + HTML UI overlay
 */
export class ShopSceneHybrid extends ex.Scene {
  private player: PlayerActor | null = null;
  private sceneData: ShopSceneData = {};

  // HTML Shop overlay
  private shopOverlay: ShopOverlay | null = null;

  // Input state
  private inputEnabled = false;

  // UI elements (Canvas-based)
  private goldLabel: ex.Label | null = null;

  // Callbacks
  public onExitToTown: (() => void) | null = null;

  onActivate(ctx: ex.SceneActivationContext<ShopSceneData>): void {
    this.sceneData = ctx.data || {};
    const catColor = this.sceneData.catColor || GameState.player.catColor;

    // Disable input briefly to prevent key events from previous scene
    this.inputEnabled = false;
    setTimeout(() => {
      this.inputEnabled = true;
    }, 200);

    this.clear();
    this.setupBackground();
    this.setupShopkeeper();
    this.setupDoor();
    this.setupPlayer(catColor);
    this.setupUI();
    this.setupInputHandlers();
    this.setupShopOverlay();

    console.log('=== StudyQuest Shop (Hybrid) ===');
  }

  onDeactivate(): void {
    // Reset input state
    this.inputEnabled = false;

    // Cleanup shop overlay
    this.shopOverlay?.destroy();
    this.shopOverlay = null;

    this.player = null;
    this.goldLabel = null;
  }

  /**
   * Setup the HTML shop overlay
   */
  private setupShopOverlay(): void {
    // Find the game canvas parent container
    const canvas = this.engine.canvas;
    const container = canvas.parentElement;

    if (!container) {
      console.warn('ShopSceneHybrid: Could not find canvas container for overlay');
      return;
    }

    // Ensure container has relative positioning for absolute overlay
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    this.shopOverlay = new ShopOverlay(container, {
      onClose: () => {
        this.player?.unfreeze();
        this.updateGoldDisplay();
      },
      onPurchase: () => {
        this.updateGoldDisplay();
      },
      onSell: () => {
        this.updateGoldDisplay();
      },
    });
  }

  private async setupBackground(): Promise<void> {
    // Load the general store background
    const bgImage = await loadBackground('generalStore');

    if (bgImage) {
      const bgActor = createBackgroundActor(bgImage, CANVAS_WIDTH, CANVAS_HEIGHT, 0);
      this.add(bgActor);
    } else {
      // Fallback to solid colors
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
          color: ex.Color.fromHex('#654321'),
        })
      );
      this.add(bg);

      // Wall
      const wall = new ex.Actor({
        pos: new ex.Vector(CANVAS_WIDTH / 2, 90),
        width: CANVAS_WIDTH,
        height: 180,
        z: 1,
      });
      wall.graphics.use(
        new ex.Rectangle({
          width: CANVAS_WIDTH,
          height: 180,
          color: ex.Color.fromHex('#4682B4'),
        })
      );
      this.add(wall);
    }

    // Counter
    const counter = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, 230),
      width: 400,
      height: 60,
      z: 5,
    });
    counter.graphics.use(
      new ex.Rectangle({
        width: 400,
        height: 60,
        color: ex.Color.fromHex('#8B4513'),
        strokeColor: ex.Color.Black,
        lineWidth: 3,
      })
    );
    this.add(counter);

    // Play shop music
    AudioManager.playSceneMusic('shop');
  }

  private async setupShopkeeper(): Promise<void> {
    const shopkeeper = await createNPCActor('shopkeeper', CANVAS_WIDTH / 2, 170, 60, 6);
    this.add(shopkeeper);

    const label = new ex.Label({
      text: 'Shopkeeper',
      pos: new ex.Vector(CANVAS_WIDTH / 2, 130),
      font: new ex.Font({ size: 13, color: ex.Color.White }),
      z: 10,
    });
    label.graphics.anchor = ex.Vector.Half;
    this.add(label);
  }

  private setupDoor(): void {
    const door = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30),
      width: 50,
      height: 40,
      z: 3,
    });
    door.graphics.use(
      new ex.Rectangle({
        width: 50,
        height: 40,
        color: ex.Color.fromHex('#654321'),
        strokeColor: ex.Color.Black,
        lineWidth: 2,
      })
    );
    this.add(door);

    const exitLabel = new ex.Label({
      text: 'Exit',
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10),
      font: new ex.Font({ size: 13, color: ex.Color.White }),
      z: 10,
    });
    exitLabel.graphics.anchor = ex.Vector.Half;
    this.add(exitLabel);
  }

  private setupPlayer(catColor: CatColor): void {
    this.player = new PlayerActor({
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 120,
      catColor,
      bounds: {
        minX: 30,
        maxX: CANVAS_WIDTH - 30,
        minY: 200,
        maxY: CANVAS_HEIGHT - 60,
      },
    });
    this.add(this.player);
  }

  private setupUI(): void {
    // Gold display
    const goldBg = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH - 60, 25),
      width: 100,
      height: 30,
      z: 50,
    });
    goldBg.graphics.use(new ex.Rectangle({ width: 100, height: 30, color: ex.Color.fromRGB(0, 0, 0, 0.6) }));
    this.add(goldBg);

    this.goldLabel = new ex.Label({
      text: `Gold: ${GameState.player.gold}`,
      pos: new ex.Vector(CANVAS_WIDTH - 100, 25),
      font: new ex.Font({ size: 12, color: ex.Color.fromHex('#FBBF24') }),
      z: 51,
    });
    this.add(this.goldLabel);

    // Scene label
    const sceneLabel = new ex.Label({
      text: 'Shop',
      pos: new ex.Vector(20, 20),
      font: new ex.Font({ size: 16, color: ex.Color.White }),
      z: 50,
    });
    this.add(sceneLabel);

    // Controls hint
    const controls = new ex.Label({
      text: 'Arrow/WASD: Move | ENTER: Browse | ESC: Exit',
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 15),
      font: new ex.Font({ size: 12, color: ex.Color.fromRGB(200, 200, 200) }),
      z: 50,
    });
    controls.graphics.anchor = ex.Vector.Half;
    this.add(controls);
  }

  private setupInputHandlers(): void {
    const checkPlayer = () => {
      if (this.player?.getInputManager()) {
        const input = this.player.getInputManager()!;

        // Enter/Space: Open shop or check door
        input.onKeyPress('enter', () => {
          if (!this.inputEnabled || this.shopOverlay?.isOpen) return;
          this.checkInteraction();
        });

        input.onKeyPress('space', () => {
          if (!this.inputEnabled || this.shopOverlay?.isOpen) return;
          this.checkInteraction();
        });

        // Escape: Close shop or exit scene
        input.onKeyPress('escape', () => {
          if (!this.inputEnabled) return;
          if (this.shopOverlay?.isOpen) {
            this.shopOverlay.close();
          } else {
            this.exitToTown();
          }
        });
      } else {
        setTimeout(checkPlayer, 100);
      }
    };
    checkPlayer();
  }

  /**
   * Check for interaction with shopkeeper or door
   */
  private checkInteraction(): void {
    if (!this.player) return;

    // Check shopkeeper distance
    const shopkeeperPos = new ex.Vector(CANVAS_WIDTH / 2, 170);
    if (this.player.pos.distance(shopkeeperPos) < 100) {
      this.openShop();
      return;
    }

    // Check door distance
    const doorPos = new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30);
    if (this.player.pos.distance(doorPos) < 60) {
      this.exitToTown();
    }
  }

  /**
   * Open the HTML shop overlay
   */
  private openShop(): void {
    if (!this.shopOverlay || this.shopOverlay.isOpen) return;

    this.player?.freeze();
    this.shopOverlay.open();
  }

  /**
   * Update gold display on canvas
   */
  private updateGoldDisplay(): void {
    if (this.goldLabel) {
      this.goldLabel.text = `Gold: ${GameState.player.gold}`;
    }
  }

  /**
   * Exit to town scene
   */
  private exitToTown(): void {
    if (this.onExitToTown) {
      this.onExitToTown();
    }
  }
}
