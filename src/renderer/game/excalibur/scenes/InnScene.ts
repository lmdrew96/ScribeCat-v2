/**
 * ExcaliburInnScene
 *
 * The Inn scene implemented in Excalibur.js.
 * Players can rest here to restore HP and MP for gold.
 *
 * This is the first scene migrated from KAPLAY to Excalibur,
 * serving as a template for other scene migrations.
 */

import * as ex from 'excalibur';
import { GameState } from '../../state/GameState.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_SPEED } from '../../config.js';
import { loadCatAnimation, type CatColor, type CatAnimationType } from '../adapters/SpriteAdapter.js';
import { InputManager } from '../adapters/InputAdapter.js';

const REST_COST = 10; // Gold cost to rest

export interface InnSceneData {
  catColor?: CatColor;
  fromScene?: string;
}

/**
 * Player Actor for the Inn scene
 */
class PlayerActor extends ex.Actor {
  private catColor: CatColor;
  private animations: Map<CatAnimationType, ex.Animation> = new Map();
  private currentAnim: CatAnimationType = 'idle';
  private inputManager: InputManager | null = null;
  private movementBounds: { minX: number; maxX: number; minY: number; maxY: number };

  constructor(config: {
    x: number;
    y: number;
    catColor: CatColor;
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
  }) {
    super({
      pos: new ex.Vector(config.x, config.y),
      width: 32,
      height: 32,
      anchor: ex.Vector.Half,
      z: 10,
    });
    this.catColor = config.catColor;
    this.movementBounds = config.bounds;
  }

  async onInitialize(engine: ex.Engine): Promise<void> {
    this.inputManager = new InputManager(engine);

    // Load animations
    try {
      const idleAnim = await loadCatAnimation(this.catColor, 'idle');
      const walkAnim = await loadCatAnimation(this.catColor, 'walk');
      this.animations.set('idle', idleAnim);
      this.animations.set('walk', walkAnim);
      this.graphics.use(idleAnim);
    } catch (err) {
      console.warn('Failed to load cat animations, using placeholder:', err);
      // Fallback to colored rectangle
      this.graphics.use(new ex.Rectangle({
        width: 32,
        height: 32,
        color: ex.Color.fromHex('#808080'),
      }));
    }
  }

  onPreUpdate(engine: ex.Engine, delta: number): void {
    if (!this.inputManager) return;

    // Get movement input
    const movement = this.inputManager.getMovementVector();
    const speed = PLAYER_SPEED;

    // Apply velocity
    this.vel = movement.scale(speed);

    // Constrain to bounds
    const nextX = this.pos.x + this.vel.x * (delta / 1000);
    const nextY = this.pos.y + this.vel.y * (delta / 1000);

    if (nextX < this.movementBounds.minX || nextX > this.movementBounds.maxX) {
      this.vel.x = 0;
    }
    if (nextY < this.movementBounds.minY || nextY > this.movementBounds.maxY) {
      this.vel.y = 0;
    }

    // Update animation based on movement
    const isMoving = movement.x !== 0 || movement.y !== 0;
    const targetAnim = isMoving ? 'walk' : 'idle';

    if (targetAnim !== this.currentAnim && this.animations.has(targetAnim)) {
      this.currentAnim = targetAnim;
      this.graphics.use(this.animations.get(targetAnim)!);
    }

    // Flip sprite based on direction
    if (movement.x < 0) {
      this.graphics.flipHorizontal = true;
    } else if (movement.x > 0) {
      this.graphics.flipHorizontal = false;
    }
  }

  getInputManager(): InputManager | null {
    return this.inputManager;
  }
}

/**
 * Innkeeper NPC Actor
 */
class InnkeeperActor extends ex.Actor {
  constructor(x: number, y: number) {
    super({
      pos: new ex.Vector(x, y),
      width: 40,
      height: 60,
      anchor: ex.Vector.Half,
      z: 6,
    });
  }

  onInitialize(): void {
    // Placeholder rectangle for innkeeper
    this.graphics.use(new ex.Rectangle({
      width: 40,
      height: 60,
      color: ex.Color.fromHex('#90EE90'), // Light green
      strokeColor: ex.Color.Black,
      lineWidth: 2,
    }));
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

  // UI elements
  private goldLabel: ex.Label | null = null;
  private hpLabel: ex.Label | null = null;
  private mpLabel: ex.Label | null = null;
  private messageLabel: ex.Label | null = null;
  private messageBg: ex.Actor | null = null;

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

    // Setup input handlers
    this.setupInputHandlers();

    console.log('=== StudyQuest Inn (Excalibur) ===');
  }

  onDeactivate(): void {
    // Excalibur handles cleanup automatically!
    // This is a major improvement over KAPLAY's manual cleanup
    this.player = null;
    this.innkeeper = null;
    this.door = null;
    this.goldLabel = null;
    this.hpLabel = null;
    this.mpLabel = null;
    this.messageLabel = null;
    this.messageBg = null;
  }

  private setupBackground(): void {
    // Floor
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
      font: new ex.Font({ size: 13, color: ex.Color.White }),
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
      font: new ex.Font({ size: 13, color: ex.Color.White }),
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
      font: new ex.Font({ size: 14, color: ex.Color.fromHex('#FBBF24') }),
      z: 51,
    });
    this.add(this.goldLabel);

    // HP display
    this.hpLabel = new ex.Label({
      text: '',
      pos: new ex.Vector(CANVAS_WIDTH - 100, 45),
      font: new ex.Font({ size: 14, color: ex.Color.Green }),
      z: 51,
    });
    this.add(this.hpLabel);

    // MP display
    this.mpLabel = new ex.Label({
      text: '',
      pos: new ex.Vector(CANVAS_WIDTH - 100, 60),
      font: new ex.Font({ size: 14, color: ex.Color.fromHex('#6496FF') }),
      z: 51,
    });
    this.add(this.mpLabel);

    this.updateStatsDisplay();

    // Scene label
    const sceneLabel = new ex.Label({
      text: 'The Cozy Inn',
      pos: new ex.Vector(20, 20),
      font: new ex.Font({ size: 16, color: ex.Color.White }),
      z: 50,
    });
    this.add(sceneLabel);

    // Status text
    const statusLabel = new ex.Label({
      text: 'Rest here to recover HP and MP',
      pos: new ex.Vector(20, 45),
      font: new ex.Font({ size: 13, color: ex.Color.fromRGB(200, 200, 200) }),
      z: 50,
    });
    this.add(statusLabel);

    // Controls hint
    const controlsLabel = new ex.Label({
      text: 'Arrow/WASD: Move | ENTER: Interact | ESC: Back',
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 15),
      font: new ex.Font({ size: 12, color: ex.Color.fromRGB(200, 200, 200) }),
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
      this.hpLabel.font = new ex.Font({
        size: 14,
        color: hp < maxHp ? ex.Color.fromHex('#FF6464') : ex.Color.fromHex('#64FF64'),
      });
    }

    if (this.mpLabel) {
      this.mpLabel.text = `MP: ${mp}/${maxMp}`;
      this.mpLabel.font = new ex.Font({
        size: 14,
        color: mp < maxMp ? ex.Color.fromHex('#6496FF') : ex.Color.fromHex('#64C8FF'),
      });
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
      this.showMessage("You're already feeling great!");
      return;
    }

    // Not enough gold
    if (gold < REST_COST) {
      this.showMessage(`Not enough gold! (Need ${REST_COST})`);
      return;
    }

    // Rest - restore HP and MP
    GameState.player.gold -= REST_COST;
    GameState.player.health = maxHp;
    GameState.fullRestoreMana();

    // Update displays
    this.updateStatsDisplay();

    // Show success message
    this.showMessage('You feel refreshed! HP and MP restored.');

    // Visual effect - green flash
    this.showHealEffect();

    // Autosave after resting
    if (GameState.isCloudSyncEnabled()) {
      console.log('Autosaving after inn rest...');
      GameState.saveToCloud().catch(err => console.warn('Failed to autosave:', err));
    }

    console.log(`Rested! HP: ${maxHp}, MP: ${maxMp}, Gold remaining: ${GameState.player.gold}`);
  }

  private showMessage(text: string): void {
    // Remove existing message
    if (this.messageBg) {
      this.messageBg.kill();
      this.messageBg = null;
    }
    if (this.messageLabel) {
      this.messageLabel.kill();
      this.messageLabel = null;
    }

    // Create message background
    this.messageBg = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, 120),
      width: 300,
      height: 40,
      z: 200,
    });
    this.messageBg.graphics.use(new ex.Rectangle({
      width: 300,
      height: 40,
      color: ex.Color.fromRGB(0, 0, 0, 0.8),
    }));
    this.add(this.messageBg);

    // Create message text
    this.messageLabel = new ex.Label({
      text,
      pos: new ex.Vector(CANVAS_WIDTH / 2, 120),
      font: new ex.Font({ size: 12, color: ex.Color.White }),
      z: 201,
    });
    this.messageLabel.graphics.anchor = ex.Vector.Half;
    this.add(this.messageLabel);

    // Auto-hide after 2 seconds
    const bg = this.messageBg;
    const label = this.messageLabel;
    setTimeout(() => {
      bg?.kill();
      label?.kill();
      if (this.messageBg === bg) this.messageBg = null;
      if (this.messageLabel === label) this.messageLabel = null;
    }, 2000);
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
