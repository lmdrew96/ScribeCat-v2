/**
 * DungeonHUDManager.ts
 * 
 * Manages the dungeon HUD: HP bar, level, XP, gold, floor labels.
 */

import * as ex from 'excalibur';
import { GameState } from '../../../state/GameState.js';
import { DUNGEON_CONFIGS } from '../../../../canvas/dungeon/DungeonGenerator.js';
import { SceneFontCache } from '../../ui/FontCache.js';

export interface HUDConfig {
  dungeonId: string;
  floorNumber: number;
}

/**
 * Manages the dungeon HUD display.
 */
export class DungeonHUDManager {
  private scene: ex.Scene;
  private fontCache: SceneFontCache;
  private dungeonId: string;
  private floorNumber: number;
  
  // UI actors
  private uiActors: ex.Actor[] = [];
  
  // HUD elements
  private hpBar!: ex.Actor;
  private hpTextLabel!: ex.Actor;
  private levelLabel!: ex.Actor;
  private xpLabel!: ex.Actor;
  private goldLabel!: ex.Actor;
  private floorLabel!: ex.Actor;
  
  constructor(scene: ex.Scene, config: HUDConfig) {
    this.scene = scene;
    this.dungeonId = config.dungeonId;
    this.floorNumber = config.floorNumber;
    this.fontCache = new SceneFontCache();
  }
  
  /**
   * Setup the HUD elements
   */
  setup(): void {
    const config = DUNGEON_CONFIGS[this.dungeonId] || DUNGEON_CONFIGS.training;

    // HUD background (top-left for consistency with town)
    const hudBg = new ex.Actor({
      pos: ex.vec(70, 50),
      width: 140,
      height: 100,
      z: 50,
    });
    hudBg.graphics.use(
      new ex.Rectangle({ width: 140, height: 100, color: ex.Color.fromRGB(0, 0, 0, 0.7) })
    );
    this.scene.add(hudBg);
    this.uiActors.push(hudBg);

    // HP Bar background (left-aligned)
    const hpBg = new ex.Actor({
      pos: ex.vec(10, 12),
      width: 120,
      height: 14,
      anchor: ex.vec(0, 0.5),
      z: 51,
    });
    hpBg.graphics.use(
      new ex.Rectangle({ width: 120, height: 14, color: ex.Color.fromRGB(60, 20, 20) })
    );
    this.scene.add(hpBg);
    this.uiActors.push(hpBg);

    // HP Bar (left-aligned anchor so it grows from left)
    this.hpBar = new ex.Actor({
      pos: ex.vec(10, 12),
      width: 120,
      height: 14,
      anchor: ex.vec(0, 0.5),
      z: 52,
    });
    this.hpBar.graphics.use(
      new ex.Rectangle({ width: 120, height: 14, color: ex.Color.fromRGB(60, 220, 100) })
    );
    this.scene.add(this.hpBar);
    this.uiActors.push(this.hpBar);

    // HP Text overlay
    this.hpTextLabel = new ex.Actor({
      pos: ex.vec(70, 12),
      z: 53,
    });
    this.hpTextLabel.graphics.use(
      new ex.Text({
        text: `${GameState.player.health}/${GameState.getEffectiveMaxHealth()}`,
        font: this.fontCache.getFont(11, ex.Color.White),
      })
    );
    this.scene.add(this.hpTextLabel);
    this.uiActors.push(this.hpTextLabel);

    // Level label
    this.levelLabel = new ex.Actor({
      pos: ex.vec(10, 32),
      anchor: ex.vec(0, 0.5),
      z: 51,
    });
    this.levelLabel.graphics.use(
      new ex.Text({
        text: `Lv.${GameState.player.level}`,
        font: this.fontCache.getFont(12, ex.Color.White),
      })
    );
    this.scene.add(this.levelLabel);
    this.uiActors.push(this.levelLabel);

    // XP label
    this.xpLabel = new ex.Actor({
      pos: ex.vec(60, 32),
      anchor: ex.vec(0, 0.5),
      z: 51,
    });
    this.xpLabel.graphics.use(
      new ex.Text({
        text: `XP: ${GameState.player.xp}`,
        font: this.fontCache.getFontHex(11, '#a78bfa'),
      })
    );
    this.scene.add(this.xpLabel);
    this.uiActors.push(this.xpLabel);

    // Gold label
    this.goldLabel = new ex.Actor({
      pos: ex.vec(10, 52),
      anchor: ex.vec(0, 0.5),
      z: 51,
    });
    this.goldLabel.graphics.use(
      new ex.Text({
        text: `Gold: ${GameState.player.gold}`,
        font: this.fontCache.getFontHex(12, '#fbbf24'),
      })
    );
    this.scene.add(this.goldLabel);
    this.uiActors.push(this.goldLabel);

    // Floor label
    this.floorLabel = new ex.Actor({
      pos: ex.vec(10, 72),
      anchor: ex.vec(0, 0.5),
      z: 51,
    });
    this.floorLabel.graphics.use(
      new ex.Text({
        text: `Floor ${this.floorNumber}/${config.totalFloors}`,
        font: this.fontCache.getFontRGB(12, 200, 200, 200),
      })
    );
    this.scene.add(this.floorLabel);
    this.uiActors.push(this.floorLabel);

    // Controls hint (bottom of HUD)
    const controlsHint = new ex.Actor({
      pos: ex.vec(10, 92),
      anchor: ex.vec(0, 0.5),
      z: 51,
    });
    controlsHint.graphics.use(
      new ex.Text({
        text: 'I:Inv ESC:Menu',
        font: this.fontCache.getFontRGB(10, 150, 150, 150),
      })
    );
    this.scene.add(controlsHint);
    this.uiActors.push(controlsHint);
  }
  
  /**
   * Update the HUD with current game state
   */
  update(): void {
    // Update HP bar (use effective max health to include equipment bonuses)
    const effectiveMaxHp = GameState.getEffectiveMaxHealth();
    const currentHp = GameState.player.health;
    const ratio = currentHp / effectiveMaxHp;
    const hpWidth = Math.max(0, 120 * ratio);

    let hpColor = ex.Color.fromRGB(60, 220, 100);
    if (ratio <= 0.25) {
      hpColor = ex.Color.fromRGB(240, 60, 60);
    } else if (ratio <= 0.5) {
      hpColor = ex.Color.fromRGB(240, 200, 60);
    }

    this.hpBar.graphics.use(new ex.Rectangle({ width: hpWidth, height: 14, color: hpColor }));

    // Update HP text
    this.hpTextLabel.graphics.use(
      new ex.Text({
        text: `${currentHp}/${effectiveMaxHp}`,
        font: this.fontCache.getFont(11, ex.Color.White),
      })
    );

    // Update level
    this.levelLabel.graphics.use(
      new ex.Text({
        text: `Lv.${GameState.player.level}`,
        font: this.fontCache.getFont(12, ex.Color.White),
      })
    );

    // Update XP
    this.xpLabel.graphics.use(
      new ex.Text({
        text: `XP: ${GameState.player.xp}`,
        font: this.fontCache.getFontHex(11, '#a78bfa'),
      })
    );

    // Update gold
    this.goldLabel.graphics.use(
      new ex.Text({
        text: `Gold: ${GameState.player.gold}`,
        font: this.fontCache.getFontHex(12, '#fbbf24'),
      })
    );
  }
  
  /**
   * Update floor number display
   */
  setFloorNumber(floorNumber: number): void {
    this.floorNumber = floorNumber;
    const config = DUNGEON_CONFIGS[this.dungeonId] || DUNGEON_CONFIGS.training;
    this.floorLabel.graphics.use(
      new ex.Text({
        text: `Floor ${this.floorNumber}/${config.totalFloors}`,
        font: this.fontCache.getFontRGB(13, 200, 200, 200),
      })
    );
  }
  
  /**
   * Get current floor number
   */
  getFloorNumber(): number {
    return this.floorNumber;
  }
  
  /**
   * Cleanup all HUD actors
   */
  destroy(): void {
    for (const actor of this.uiActors) {
      actor.kill();
    }
    this.uiActors = [];
  }
}
