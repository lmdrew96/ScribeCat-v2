/**
 * ExcaliburInnScene
 *
 * The Inn scene implemented in Excalibur.js.
 * Players can rest here to restore HP and MP for gold.
 *
 * Uses background images from assets/BACKGROUNDS.
 */

import * as ex from 'excalibur';
import { GameState } from '../../state/GameState.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../config.js';
import type { CatColor } from '../adapters/SpriteAdapter.js';
import { loadBackground, createBackgroundActor } from '../../loaders/BackgroundLoader.js';
import { loadNPCSprite } from '../../loaders/NPCSpriteLoader.js';
import { AudioManager } from '../../audio/AudioManager.js';
import { SceneFontCache } from '../ui/FontCache.js';
import { PlayerActor } from '../actors/PlayerActor.js';
import { MessageToast } from '../components/MessageToast.js';
import { DialogOverlay, type DialogItem } from '../components/DialogOverlay.js';

const REST_COST = 10; // Gold cost to rest

export interface InnSceneData {
  catColor?: CatColor;
  fromScene?: string;
}

/**
 * Innkeeper NPC Actor
 */
class InnkeeperActor extends ex.Actor {
  private targetSize = 60;

  constructor(x: number, y: number) {
    super({
      pos: new ex.Vector(x, y),
      width: 40,
      height: 60,
      anchor: ex.Vector.Half,
      z: 6,
    });
  }

  async onInitialize(): Promise<void> {
    // Try to load the actual innkeeper sprite
    const sprite = await loadNPCSprite('innkeeper');
    if (sprite) {
      // Scale sprite to target size
      const scale = this.targetSize / Math.max(sprite.width, sprite.height);
      sprite.scale = new ex.Vector(scale, scale);
      this.graphics.use(sprite);
    } else {
      // Fallback to placeholder rectangle if sprite fails to load
      this.graphics.use(new ex.Rectangle({
        width: 40,
        height: 60,
        color: ex.Color.fromHex('#90EE90'), // Light green
        strokeColor: ex.Color.Black,
        lineWidth: 2,
      }));
    }
  }
}

/**
 * Door Actor
 */
class DoorActor extends ex.Actor {
  public targetScene: string;
  public label: string;

  constructor(config: { x: number; y: number; width: number; height: number; label: string; targetScene: string }) {
    super({
      pos: new ex.Vector(config.x, config.y),
      width: config.width,
      height: config.height,
      anchor: ex.Vector.Half,
      z: 3,
    });
    this.targetScene = config.targetScene;
    this.label = config.label;
  }

  onInitialize(): void {
    this.graphics.use(new ex.Rectangle({
      width: this.width,
      height: this.height,
      color: ex.Color.fromHex('#654321'),
      strokeColor: ex.Color.Black,
      lineWidth: 2,
    }));
  }
}

/**
 * Main Inn Scene
 */
export class InnScene extends ex.Scene {
  private player: PlayerActor | null = null;
  private innkeeper: InnkeeperActor | null = null;
  private door: DoorActor | null = null;
  private sceneData: InnSceneData = {};

  // Input cooldown to prevent key events carrying over from scene transitions
  private inputEnabled = false;

  // Font cache for performance optimization
  private fontCache = new SceneFontCache();

  // UI elements
  private goldLabel: ex.Label | null = null;
  private hpLabel: ex.Label | null = null;
  private mpLabel: ex.Label | null = null;

  // HTML overlay components
  private messageToast: MessageToast | null = null;
  private restDialog: DialogOverlay | null = null;

  // Callback for scene transitions (set by game coordinator)
  public onExitToTown: (() => void) | null = null;

  onActivate(ctx: ex.SceneActivationContext<InnSceneData>): void {
    this.sceneData = ctx.data || {};
    const catColor = this.sceneData.catColor || GameState.player.catColor;

    // Disable input briefly to prevent key events from previous scene
    this.inputEnabled = false;
    setTimeout(() => { this.inputEnabled = true; }, 200);

    // Clear any existing actors from previous activation
    this.clear();

    // Setup background
    this.setupBackground();

    // Setup tables (decoration)
    this.setupTables();

    // Setup innkeeper
    this.setupInnkeeper();

    // Setup door
    this.setupDoor();

    // Setup player
    this.setupPlayer(catColor);

    // Setup UI
    this.setupUI();

    // Setup HTML overlays
    this.setupOverlays();

    // Setup input handlers
    this.setupInputHandlers();

    console.log('=== StudyQuest Inn (Excalibur) ===');
  }

  onDeactivate(): void {
    // Reset input state to prevent stale handlers from firing
    this.inputEnabled = false;

    // Cleanup HTML overlays
    this.messageToast?.destroy();
    this.messageToast = null;
    this.restDialog?.destroy();
    this.restDialog = null;

    // Excalibur handles cleanup automatically!
    // This is a major improvement over KAPLAY's manual cleanup
    this.player = null;
    this.innkeeper = null;
    this.door = null;
    this.goldLabel = null;
    this.hpLabel = null;
    this.mpLabel = null;
  }

  private async setupBackground(): Promise<void> {
    // Try to load the living room background
    const bgImage = await loadBackground('livingRoom');

    if (bgImage) {
      const bgActor = createBackgroundActor(bgImage, CANVAS_WIDTH, CANVAS_HEIGHT, 0);
      this.add(bgActor);
    } else {
      // Fallback to solid colors
      const floor = new ex.Actor({
        pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        z: 0,
      });
      floor.graphics.use(new ex.Rectangle({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        color: ex.Color.fromHex('#8B5A2B'),
      }));
      this.add(floor);

      // Wall
      const wall = new ex.Actor({
        pos: new ex.Vector(CANVAS_WIDTH / 2, 90),
        width: CANVAS_WIDTH,
        height: 180,
        z: 1,
      });
      wall.graphics.use(new ex.Rectangle({
        width: CANVAS_WIDTH,
        height: 180,
        color: ex.Color.fromHex('#B22222'),
      }));
      this.add(wall);

      // Wall border
      const wallBorder = new ex.Actor({
        pos: new ex.Vector(CANVAS_WIDTH / 2, 184),
        width: CANVAS_WIDTH,
        height: 8,
        z: 2,
      });
      wallBorder.graphics.use(new ex.Rectangle({
        width: CANVAS_WIDTH,
        height: 8,
        color: ex.Color.fromHex('#800000'),
      }));
      this.add(wallBorder);
    }

    // Fireplace
    const fireplace = new ex.Actor({
      pos: new ex.Vector(100, 140),
      width: 100,
      height: 80,
      z: 3,
    });
    fireplace.graphics.use(new ex.Rectangle({
      width: 100,
      height: 80,
      color: ex.Color.fromHex('#505050'),
      strokeColor: ex.Color.fromHex('#323232'),
      lineWidth: 3,
    }));
    this.add(fireplace);

    // Fire
    const fire = new ex.Actor({
      pos: new ex.Vector(100, 150),
      width: 60,
      height: 40,
      z: 4,
    });
    fire.graphics.use(new ex.Rectangle({
      width: 60,
      height: 40,
      color: ex.Color.fromHex('#FF6400'),
    }));
    this.add(fire);

    // Fire glow
    const fireGlow = new ex.Actor({
      pos: new ex.Vector(100, 150),
      width: 40,
      height: 30,
      z: 5,
    });
    fireGlow.graphics.use(new ex.Rectangle({
      width: 40,
      height: 30,
      color: ex.Color.fromHex('#FFC832'),
    }));
    this.add(fireGlow);

    // Innkeeper counter
    const counter = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH - 125, 215),
      width: 150,
      height: 50,
      z: 5,
    });
    counter.graphics.use(new ex.Rectangle({
      width: 150,
      height: 50,
      color: ex.Color.fromHex('#654321'),
      strokeColor: ex.Color.Black,
      lineWidth: 3,
    }));
    this.add(counter);
  }

  private setupTables(): void {
    const tables = [
      { x: 200, y: 250 },
      { x: 350, y: 280 },
      { x: 500, y: 240 },
    ];

    tables.forEach((table) => {
      const tableActor = new ex.Actor({
        pos: new ex.Vector(table.x, table.y),
        width: 60,
        height: 40,
        z: 3,
      });
      tableActor.graphics.use(new ex.Rectangle({
        width: 60,
        height: 40,
        color: ex.Color.fromHex('#8B4513'),
        strokeColor: ex.Color.Black,
        lineWidth: 2,
      }));
      this.add(tableActor);
    });
  }

  private setupInnkeeper(): void {
    this.innkeeper = new InnkeeperActor(CANVAS_WIDTH - 130, 160);
    this.add(this.innkeeper);

    // Innkeeper label
    const label = new ex.Label({
      text: 'Innkeeper',
      pos: new ex.Vector(CANVAS_WIDTH - 130, 120),
      font: this.fontCache.getFont(13, ex.Color.White),
      z: 10,
    });
    label.graphics.anchor = ex.Vector.Half;
    this.add(label);
  }

  private setupDoor(): void {
    this.door = new DoorActor({
      x: 50,
      y: CANVAS_HEIGHT - 30,
      width: 50,
      height: 40,
      label: 'Town',
      targetScene: 'town',
    });
    this.add(this.door);

    // Door label
    const label = new ex.Label({
      text: 'Exit',
      pos: new ex.Vector(50, CANVAS_HEIGHT - 10),
      font: this.fontCache.getFont(13, ex.Color.White),
      z: 10,
    });
    label.graphics.anchor = ex.Vector.Half;
    this.add(label);
  }

  private setupPlayer(catColor: CatColor): void {
    this.player = new PlayerActor({
      x: 100,
      y: CANVAS_HEIGHT - 100,
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
    // Stats background
    const statsBg = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH - 60, 42),
      width: 100,
      height: 65,
      z: 50,
    });
    statsBg.graphics.use(new ex.Rectangle({
      width: 100,
      height: 65,
      color: ex.Color.fromRGB(0, 0, 0, 0.6),
    }));
    this.add(statsBg);

    // Gold display
    this.goldLabel = new ex.Label({
      text: `Gold: ${GameState.player.gold}`,
      pos: new ex.Vector(CANVAS_WIDTH - 100, 18),
      font: this.fontCache.getFontHex(14, '#FBBF24'),
      z: 51,
    });
    this.add(this.goldLabel);

    // HP display
    this.hpLabel = new ex.Label({
      text: '',
      pos: new ex.Vector(CANVAS_WIDTH - 100, 45),
      font: this.fontCache.getFont(14, ex.Color.Green),
      z: 51,
    });
    this.add(this.hpLabel);

    // MP display
    this.mpLabel = new ex.Label({
      text: '',
      pos: new ex.Vector(CANVAS_WIDTH - 100, 60),
      font: this.fontCache.getFontHex(14, '#6496FF'),
      z: 51,
    });
    this.add(this.mpLabel);

    this.updateStatsDisplay();

    // Scene label
    const sceneLabel = new ex.Label({
      text: 'The Cozy Inn',
      pos: new ex.Vector(20, 20),
      font: this.fontCache.getFont(16, ex.Color.White),
      z: 50,
    });
    this.add(sceneLabel);

    // Status text
    const statusLabel = new ex.Label({
      text: 'Rest here to recover HP and MP',
      pos: new ex.Vector(20, 45),
      font: this.fontCache.getFontRGB(13, 200, 200, 200),
      z: 50,
    });
    this.add(statusLabel);

    // Controls hint
    const controlsLabel = new ex.Label({
      text: 'Arrow/WASD: Move | ENTER: Interact | ESC: Back',
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 15),
      font: this.fontCache.getFontRGB(12, 200, 200, 200),
      z: 50,
    });
    controlsLabel.graphics.anchor = ex.Vector.Half;
    this.add(controlsLabel);
  }

  private updateStatsDisplay(): void {
    const hp = GameState.player.health;
    const maxHp = GameState.getEffectiveMaxHealth();
    const mp = GameState.player.mana;
    const maxMp = GameState.getEffectiveMaxMana();

    if (this.hpLabel) {
      this.hpLabel.text = `HP: ${hp}/${maxHp}`;
      this.hpLabel.font = this.fontCache.getFontHex(
        14,
        hp < maxHp ? '#FF6464' : '#64FF64'
      );
    }

    if (this.mpLabel) {
      this.mpLabel.text = `MP: ${mp}/${maxMp}`;
      this.mpLabel.font = this.fontCache.getFontHex(
        14,
        mp < maxMp ? '#6496FF' : '#64C8FF'
      );
    }

    if (this.goldLabel) {
      this.goldLabel.text = `Gold: ${GameState.player.gold}`;
    }
  }

  private setupInputHandlers(): void {
    // Wait for player to be initialized
    const checkPlayer = () => {
      if (this.player?.getInputManager()) {
        const input = this.player.getInputManager()!;

        // ESC to exit
        input.onKeyPress('escape', () => {
          if (!this.inputEnabled) return;
          this.exitToTown();
        });

        // ENTER/SPACE to interact
        input.onKeyPress('enter', () => {
          if (!this.inputEnabled) return;
          this.checkInteraction();
        });
        input.onKeyPress('space', () => {
          if (!this.inputEnabled) return;
          this.checkInteraction();
        });
      } else {
        // Retry next frame
        setTimeout(checkPlayer, 100);
      }
    };
    checkPlayer();
  }

  private checkInteraction(): void {
    if (!this.player) return;

    const playerPos = this.player.pos;

    // Check innkeeper interaction
    if (this.innkeeper) {
      const dist = playerPos.distance(this.innkeeper.pos);
      if (dist < 80) {
        this.handleRest();
        return;
      }
    }

    // Check door interaction
    if (this.door) {
      const dist = playerPos.distance(this.door.pos);
      if (dist < 60) {
        this.exitToTown();
        return;
      }
    }
  }

  private handleRest(): void {
    const hp = GameState.player.health;
    const maxHp = GameState.getEffectiveMaxHealth();
    const mp = GameState.player.mana;
    const maxMp = GameState.getEffectiveMaxMana();
    const gold = GameState.player.gold;

    // Already at full HP and MP
    if (hp >= maxHp && mp >= maxMp) {
      this.showMessage("You're already feeling great!", 'warning');
      return;
    }

    // Not enough gold
    if (gold < REST_COST) {
      this.showMessage(`Not enough gold! (Need ${REST_COST})`, 'error');
      return;
    }

    // Show rest confirmation dialog
    this.player?.freeze();
    if (this.restDialog) {
      this.restDialog.setContent(
        `<p style="margin: 0 0 8px;">Restore HP and MP for <span style="color: #fbbf24;">${REST_COST}G</span>?</p>
         <p style="margin: 0; font-size: 12px; color: #888;">Current Gold: <span style="color: #fbbf24;">${gold}G</span></p>`
      );
      this.restDialog.open();
    }
  }

  private performRest(): void {
    const maxHp = GameState.getEffectiveMaxHealth();
    const maxMp = GameState.getEffectiveMaxMana();

    // Deduct gold and restore HP/MP
    GameState.player.gold -= REST_COST;
    GameState.player.health = maxHp;
    GameState.fullRestoreMana();

    // Update displays
    this.updateStatsDisplay();

    // Show success message
    this.showMessage('You feel refreshed! HP and MP restored.', 'success');

    // Visual effect - green flash
    this.showHealEffect();

    // Autosave after resting
    if (GameState.isCloudSyncEnabled()) {
      console.log('Autosaving after inn rest...');
      GameState.saveToCloud().catch(err => console.warn('Failed to autosave:', err));
    }

    console.log(`Rested! HP: ${maxHp}, MP: ${maxMp}, Gold remaining: ${GameState.player.gold}`);
  }

  private showMessage(text: string, type: 'default' | 'success' | 'error' | 'warning' = 'default'): void {
    this.messageToast?.show(text, { type, duration: 2000, position: 'top' });
  }

  /**
   * Setup HTML overlay components
   */
  private setupOverlays(): void {
    const canvas = this.engine.canvas;
    const container = canvas.parentElement;

    if (!container) {
      console.warn('InnScene: Could not find canvas container for overlays');
      return;
    }

    // Ensure container has relative positioning for absolute overlays
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    // Create message toast
    this.messageToast = new MessageToast(container);

    // Create rest confirmation dialog
    this.restDialog = new DialogOverlay(container, {
      title: 'Rest at the Inn',
      width: 300,
      maxHeight: 200,
      content: `<p style="margin: 0 0 8px;">Restore HP and MP for <span style="color: #fbbf24;">${REST_COST}G</span>?</p>`,
      buttons: [
        { id: 'rest', label: 'Rest', primary: true },
        { id: 'cancel', label: 'Cancel' },
      ],
      controlsHint: '<kbd>Enter</kbd> Rest &nbsp; <kbd>Esc</kbd> Cancel',
      onClose: () => {
        this.player?.unfreeze();
      },
      onButtonClick: (buttonId) => {
        if (buttonId === 'rest') {
          this.performRest();
        }
        this.restDialog?.close();
      },
    });
  }

  private showHealEffect(): void {
    const overlay = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      z: 500,
    });

    const rect = new ex.Rectangle({
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      color: ex.Color.fromRGB(100, 255, 100, 0),
    });
    overlay.graphics.use(rect);
    this.add(overlay);

    // Fade in
    overlay.actions
      .fade(0.3, 200)
      .delay(100)
      .fade(0, 300)
      .callMethod(() => overlay.kill());
  }

  private exitToTown(): void {
    if (this.onExitToTown) {
      this.onExitToTown();
    } else {
      // Fallback - this will be handled by the game coordinator
      console.log('Exit to town requested');
    }
  }
}
