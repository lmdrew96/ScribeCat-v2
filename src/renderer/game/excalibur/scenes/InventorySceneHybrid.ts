/**
 * InventoryScene - Hybrid Canvas + HTML inventory scene
 *
 * Uses Canvas for background and HTML overlay for the inventory UI.
 * Much cleaner than the pure canvas implementation.
 */

import * as ex from 'excalibur';
import { GameState } from '../../state/GameState.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../config.js';
import { InventoryOverlay } from '../components/InventoryOverlay.js';

export interface InventorySceneData {
  fromScene?: string;
  // For returning to town with player position preserved
  playerX?: number;
  playerY?: number;
  // For returning to dungeon with full state
  dungeonReturnData?: {
    catColor?: string;
    dungeonId?: string;
    floorNumber?: number;
    currentRoomId?: string;
    playerX?: number;
    playerY?: number;
  };
}

export interface InventorySceneConfig {
  onExit?: (scene: string, data?: unknown) => void;
}

/**
 * Hybrid Inventory Scene - Canvas background + HTML UI overlay
 */
export class InventoryScene extends ex.Scene {
  private sceneData: InventorySceneData = {};

  // HTML overlay
  private inventoryOverlay: InventoryOverlay | null = null;

  // Callbacks
  public onExit: ((scene: string, data?: unknown) => void) | null = null;

  constructor(config?: InventorySceneConfig) {
    super();
    if (config?.onExit) {
      this.onExit = config.onExit;
    }
  }

  onActivate(ctx: ex.SceneActivationContext<InventorySceneData>): void {
    this.sceneData = ctx.data || {};

    this.clear();
    this.setupBackground();
    this.setupOverlay();

    // Open the overlay immediately
    this.inventoryOverlay?.open();

    console.log('=== StudyQuest Inventory (Hybrid) ===');
  }

  onDeactivate(): void {
    // Cleanup HTML overlay
    this.inventoryOverlay?.destroy();
    this.inventoryOverlay = null;
  }

  private setupBackground(): void {
    // Dark background
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
        color: ex.Color.fromHex('#141423'),
      })
    );
    this.add(bg);

    // Decorative pattern (subtle grid)
    for (let x = 0; x < CANVAS_WIDTH; x += 32) {
      for (let y = 0; y < CANVAS_HEIGHT; y += 32) {
        const dot = new ex.Actor({
          pos: new ex.Vector(x + 16, y + 16),
          z: 1,
        });
        dot.graphics.use(
          new ex.Circle({
            radius: 1,
            color: ex.Color.fromRGB(60, 60, 80, 0.3),
          })
        );
        this.add(dot);
      }
    }
  }

  private setupOverlay(): void {
    const canvas = this.engine.canvas;
    const container = canvas.parentElement;

    if (!container) {
      console.warn('InventoryScene: Could not find canvas container for overlay');
      return;
    }

    // Ensure container has relative positioning for absolute overlay
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    this.inventoryOverlay = new InventoryOverlay(container, {
      onClose: () => {
        this.exitScene();
      },
      onUseItem: () => {
        // Item was used, could play a sound here
      },
      onEquip: () => {
        // Item was equipped
      },
      onUnequip: () => {
        // Item was unequipped
      },
    });
  }

  private exitScene(): void {
    const fromScene = this.sceneData.fromScene || 'town';
    if (this.onExit) {
      if (fromScene === 'dungeon' && this.sceneData.dungeonReturnData) {
        this.onExit('dungeon', this.sceneData.dungeonReturnData);
      } else if (fromScene === 'town') {
        // Pass back player position so town can restore it
        this.onExit('town', {
          playerX: this.sceneData.playerX,
          playerY: this.sceneData.playerY,
        });
      } else {
        this.onExit(fromScene);
      }
    }
  }
}
