/**
 * DungeonHUD - HUD component for dungeon scene
 *
 * Displays player stats (HP bar, gold, floor number) in a compact overlay.
 * Extracted from DungeonScene to improve maintainability.
 */

import * as ex from 'excalibur';
import { GameState } from '../../state/GameState.js';
import { SceneFontCache } from '../ui/FontCache.js';
import { DUNGEON_CONFIGS } from '../../../canvas/dungeon/DungeonGenerator.js';

/**
 * HUD configuration
 */
export interface DungeonHUDConfig {
  /** Canvas width */
  canvasWidth: number;
  /** Canvas height */
  canvasHeight: number;
  /** Dungeon ID for floor count */
  dungeonId: string;
  /** Current floor number */
  floorNumber: number;
  /** Z-index base (defaults to 50) */
  zIndex?: number;
}

/**
 * DungeonHUD manages the HUD display for dungeon scenes
 */
export class DungeonHUD {
  private scene: ex.Scene;
  private config: DungeonHUDConfig;
  private fontCache: SceneFontCache;

  // Actors
  private actors: ex.Actor[] = [];
  private hpBar: ex.Actor | null = null;
  private goldLabel: ex.Actor | null = null;
  private floorLabel: ex.Actor | null = null;

  constructor(scene: ex.Scene, config: DungeonHUDConfig, fontCache?: SceneFontCache) {
    this.scene = scene;
    this.config = config;
    this.fontCache = fontCache || new SceneFontCache();
  }

  /**
   * Initialize and add HUD to scene
   */
  setup(): void {
    const { canvasWidth, dungeonId, floorNumber, zIndex = 50 } = this.config;
    const dungeonConfig = DUNGEON_CONFIGS[dungeonId] || DUNGEON_CONFIGS.training;

    // HUD background
    const hudBg = new ex.Actor({
      pos: ex.vec(canvasWidth - 75, 45),
      width: 130,
      height: 70,
      z: zIndex,
    });
    hudBg.graphics.use(
      new ex.Rectangle({ width: 130, height: 70, color: ex.Color.fromRGB(0, 0, 0, 0.7) })
    );
    this.scene.add(hudBg);
    this.actors.push(hudBg);

    // HP Bar background
    const hpBg = new ex.Actor({
      pos: ex.vec(canvasWidth - 60, 20),
      width: 80,
      height: 12,
      z: zIndex + 1,
    });
    hpBg.graphics.use(
      new ex.Rectangle({ width: 80, height: 12, color: ex.Color.fromRGB(60, 20, 20) })
    );
    this.scene.add(hpBg);
    this.actors.push(hpBg);

    // HP Bar (foreground)
    this.hpBar = new ex.Actor({
      pos: ex.vec(canvasWidth - 60, 20),
      width: 80,
      height: 12,
      z: zIndex + 2,
    });
    this.hpBar.graphics.use(
      new ex.Rectangle({ width: 80, height: 12, color: ex.Color.fromRGB(60, 220, 100) })
    );
    this.scene.add(this.hpBar);
    this.actors.push(this.hpBar);

    // Gold label
    this.goldLabel = new ex.Actor({
      pos: ex.vec(canvasWidth - 130, 38),
      z: zIndex + 1,
    });
    this.goldLabel.graphics.use(
      new ex.Text({
        text: `Gold: ${GameState.player.gold}`,
        font: this.fontCache.getFontHex(13, '#fbbf24'),
      })
    );
    this.scene.add(this.goldLabel);
    this.actors.push(this.goldLabel);

    // Floor label
    this.floorLabel = new ex.Actor({
      pos: ex.vec(canvasWidth - 130, 55),
      z: zIndex + 1,
    });
    this.floorLabel.graphics.use(
      new ex.Text({
        text: `Floor ${floorNumber}/${dungeonConfig.totalFloors}`,
        font: this.fontCache.getFontRGB(13, 200, 200, 200),
      })
    );
    this.scene.add(this.floorLabel);
    this.actors.push(this.floorLabel);
  }

  /**
   * Update HUD display with current player stats
   */
  update(): void {
    this.updateHPBar();
    this.updateGoldLabel();
  }

  /**
   * Update HP bar based on current health
   */
  private updateHPBar(): void {
    if (!this.hpBar) return;

    const effectiveMaxHp = GameState.getEffectiveMaxHealth();
    const ratio = Math.max(0, GameState.player.health / effectiveMaxHp);
    const hpWidth = Math.max(0, 80 * ratio);

    let hpColor = ex.Color.fromRGB(60, 220, 100); // Green
    if (ratio <= 0.25) {
      hpColor = ex.Color.fromRGB(240, 60, 60); // Red
    } else if (ratio <= 0.5) {
      hpColor = ex.Color.fromRGB(240, 200, 60); // Yellow
    }

    this.hpBar.graphics.use(new ex.Rectangle({ width: hpWidth, height: 12, color: hpColor }));
  }

  /**
   * Update gold label with current gold
   */
  private updateGoldLabel(): void {
    if (!this.goldLabel) return;

    this.goldLabel.graphics.use(
      new ex.Text({
        text: `Gold: ${GameState.player.gold}`,
        font: this.fontCache.getFontHex(13, '#fbbf24'),
      })
    );
  }

  /**
   * Update floor label (when changing floors)
   */
  updateFloor(floorNumber: number): void {
    if (!this.floorLabel) return;

    this.config.floorNumber = floorNumber;
    const dungeonConfig = DUNGEON_CONFIGS[this.config.dungeonId] || DUNGEON_CONFIGS.training;

    this.floorLabel.graphics.use(
      new ex.Text({
        text: `Floor ${floorNumber}/${dungeonConfig.totalFloors}`,
        font: this.fontCache.getFontRGB(13, 200, 200, 200),
      })
    );
  }

  /**
   * Remove all HUD actors from scene
   */
  clear(): void {
    for (const actor of this.actors) {
      actor.kill();
    }
    this.actors = [];
    this.hpBar = null;
    this.goldLabel = null;
    this.floorLabel = null;
  }

  /**
   * Get all HUD actors (for z-index management)
   */
  getActors(): ex.Actor[] {
    return [...this.actors];
  }

  /**
   * Dispose and clean up resources
   */
  dispose(): void {
    this.clear();
    this.fontCache.clear();
  }
}
