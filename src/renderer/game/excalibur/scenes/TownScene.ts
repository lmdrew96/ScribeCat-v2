/**
 * ExcaliburTownScene
 *
 * The central hub of StudyQuest. Players access all activities from here:
 * - Home (decorate, view collection)
 * - Shop (buy items, gear, furniture)
 * - Inn (heal HP)
 * - Dungeon Gate (enter dungeons)
 *
 * Uses background images from assets/BACKGROUNDS.
 */

import * as ex from 'excalibur';
import { GameState } from '../../state/GameState.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_SPEED } from '../../config.js';
import { loadCatAnimation, type CatColor, type CatAnimationType } from '../adapters/SpriteAdapter.js';
import { InputManager } from '../adapters/InputAdapter.js';
import { saveDungeonProgress } from '../../services/StudyQuestService.js';
import { type DungeonInfo, getAllDungeonInfo, isDungeonUnlocked } from '../../data/dungeons.js';
import { loadBackground, createBackgroundActor, createFallbackBackground } from '../../loaders/BackgroundLoader.js';
import { AudioManager } from '../../audio/AudioManager.js';

// Map dimensions
const MAP_WIDTH = 640;
const MAP_HEIGHT = 480;

// Camera zoom
const CAMERA_ZOOM = 1.5;

// Building configurations
interface BuildingConfig {
  name: string;
  label: string;
  scene: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  doorX: number;
  doorY: number;
}

const BUILDINGS: BuildingConfig[] = [
  { name: 'home', label: 'Home', scene: 'home', x: 80, y: 100, width: 100, height: 80, color: '#8B4513', doorX: 130, doorY: 170 },
  { name: 'shop', label: 'Shop', scene: 'shop', x: 250, y: 80, width: 120, height: 100, color: '#4169E1', doorX: 310, doorY: 170 },
  { name: 'inn', label: 'Inn', scene: 'inn', x: 450, y: 100, width: 100, height: 80, color: '#228B22', doorX: 500, doorY: 170 },
  { name: 'dungeon', label: 'Dungeon', scene: 'dungeon', x: 280, y: 350, width: 80, height: 80, color: '#4B0082', doorX: 320, doorY: 420 },
];

export interface TownSceneData {
  catColor?: CatColor;
  fromScene?: string;
}

/**
 * Player Actor for the Town scene
 */
class PlayerActor extends ex.Actor {
  private catColor: CatColor;
  private animations: Map<CatAnimationType, ex.Animation> = new Map();
  private currentAnim: CatAnimationType = 'idle';
  private inputManager: InputManager | null = null;
  private frozen = false;

  constructor(config: { x: number; y: number; catColor: CatColor }) {
    super({
      pos: new ex.Vector(config.x, config.y),
      width: 32,
      height: 32,
      anchor: ex.Vector.Half,
      z: 10,
    });
    this.catColor = config.catColor;
  }

  async onInitialize(engine: ex.Engine): Promise<void> {
    this.inputManager = new InputManager(engine);

    try {
      const idleAnim = await loadCatAnimation(this.catColor, 'idle');
      const walkAnim = await loadCatAnimation(this.catColor, 'walk');
      this.animations.set('idle', idleAnim);
      this.animations.set('walk', walkAnim);
      this.graphics.use(idleAnim);
    } catch (err) {
      console.warn('Failed to load cat animations:', err);
      this.graphics.use(new ex.Rectangle({
        width: 32,
        height: 32,
        color: ex.Color.Gray,
      }));
    }
  }

  onPreUpdate(engine: ex.Engine, delta: number): void {
    if (!this.inputManager || this.frozen) {
      this.vel = ex.Vector.Zero;
      return;
    }

    const movement = this.inputManager.getMovementVector();
    this.vel = movement.scale(PLAYER_SPEED);

    // Constrain to map bounds
    const nextX = this.pos.x + this.vel.x * (delta / 1000);
    const nextY = this.pos.y + this.vel.y * (delta / 1000);

    if (nextX < 20 || nextX > MAP_WIDTH - 20) this.vel.x = 0;
    if (nextY < 200 || nextY > MAP_HEIGHT - 20) this.vel.y = 0;

    // Update animation
    const isMoving = movement.x !== 0 || movement.y !== 0;
    const targetAnim = isMoving ? 'walk' : 'idle';

    if (targetAnim !== this.currentAnim && this.animations.has(targetAnim)) {
      this.currentAnim = targetAnim;
      this.graphics.use(this.animations.get(targetAnim)!);
    }

    if (movement.x < 0) this.graphics.flipHorizontal = true;
    else if (movement.x > 0) this.graphics.flipHorizontal = false;
  }

  getInputManager(): InputManager | null {
    return this.inputManager;
  }

  freeze(): void {
    this.frozen = true;
    this.vel = ex.Vector.Zero;
  }

  unfreeze(): void {
    this.frozen = false;
  }

  onPreKill(): void {
    // Clean up input manager to remove engine-level event listeners
    this.inputManager?.destroy();
    this.inputManager = null;
  }
}

/**
 * Building Actor
 */
class BuildingActor extends ex.Actor {
  public config: BuildingConfig;

  constructor(config: BuildingConfig) {
    super({
      pos: new ex.Vector(config.x + config.width / 2, config.y + config.height / 2),
      width: config.width,
      height: config.height,
      z: 5,
    });
    this.config = config;
  }

  onInitialize(): void {
    // Building body
    this.graphics.use(new ex.Rectangle({
      width: this.width,
      height: this.height,
      color: ex.Color.fromHex(this.config.color),
      strokeColor: ex.Color.Black,
      lineWidth: 3,
    }));
  }
}

/**
 * Door Actor
 */
class DoorActor extends ex.Actor {
  public buildingConfig: BuildingConfig;

  constructor(config: BuildingConfig) {
    super({
      pos: new ex.Vector(config.doorX, config.doorY),
      width: 40,
      height: 30,
      anchor: ex.Vector.Half,
      z: 6,
    });
    this.buildingConfig = config;
  }

  onInitialize(): void {
    this.graphics.use(new ex.Rectangle({
      width: 40,
      height: 30,
      color: ex.Color.fromHex('#654321'),
      strokeColor: ex.Color.Black,
      lineWidth: 2,
    }));
  }
}

/**
 * Main Town Scene
 */
export class TownScene extends ex.Scene {
  private player: PlayerActor | null = null;
  private sceneData: TownSceneData = {};
  private buildings: BuildingActor[] = [];
  private doors: DoorActor[] = [];

  // Input cooldown to prevent key events carrying over from scene transitions
  private inputEnabled = false;

  // Dungeon selection state
  private dungeonUIActive = false;
  private dungeonUIElements: ex.Actor[] = [];
  private selectedDungeonIndex = 0;
  private dungeonList: DungeonInfo[] = [];

  // HUD elements
  private levelLabel: ex.Label | null = null;
  private goldLabel: ex.Label | null = null;
  private saveStatusLabel: ex.Label | null = null;

  // Callbacks for scene transitions
  public onGoToScene: ((scene: string, data?: unknown) => void) | null = null;

  onActivate(ctx: ex.SceneActivationContext<TownSceneData>): void {
    this.sceneData = ctx.data || {};
    const catColor = this.sceneData.catColor || GameState.player.catColor;

    // Disable input briefly to prevent key events from previous scene
    this.inputEnabled = false;
    setTimeout(() => { this.inputEnabled = true; }, 200);

    // Clear any active dungeon run when entering town
    if (GameState.hasActiveDungeonRun()) {
      console.log('Clearing abandoned dungeon run');
      GameState.dungeon.dungeonId = null;
      GameState.dungeon.floorNumber = 1;
      GameState.dungeon.floor = null;
      GameState.dungeon.currentRoomId = '';

      const characterId = GameState.getCharacterId();
      if (characterId && GameState.isCloudSyncEnabled()) {
        saveDungeonProgress(characterId, null, 0).catch(err =>
          console.warn('Failed to clear dungeon progress:', err)
        );
      }
    }

    // Reset state
    this.dungeonUIActive = false;
    this.selectedDungeonIndex = 0;
    this.buildings = [];
    this.doors = [];

    this.clear();

    // Setup scene
    this.setupBackground();
    this.setupBuildings();
    this.setupPlayer(catColor);
    this.setupHUD();
    this.setupCamera();
    this.setupInputHandlers();

    console.log('=== StudyQuest Town (Excalibur) ===');
    console.log(`Cat: ${catColor}, Level: ${GameState.player.level}, Gold: ${GameState.player.gold}`);
  }

  onDeactivate(): void {
    // Reset input state to prevent stale handlers from firing
    this.inputEnabled = false;

    this.player = null;
    this.buildings = [];
    this.doors = [];
    this.dungeonUIElements = [];
    this.levelLabel = null;
    this.goldLabel = null;
    this.saveStatusLabel = null;
  }

  private async setupBackground(): Promise<void> {
    // Try to load the town background image
    const bgImage = await loadBackground('town');

    if (bgImage) {
      // Use the actual background image with scale-and-crop
      const bgActor = createBackgroundActor(bgImage, MAP_WIDTH, MAP_HEIGHT, 0);
      this.add(bgActor);
    } else {
      // Fallback to solid color if image fails to load
      const grass = new ex.Actor({
        pos: new ex.Vector(MAP_WIDTH / 2, MAP_HEIGHT / 2),
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        z: 0,
      });
      grass.graphics.use(new ex.Rectangle({
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        color: ex.Color.fromHex('#228B22'),
      }));
      this.add(grass);

      // Path/walkable area
      const path = new ex.Actor({
        pos: new ex.Vector(MAP_WIDTH / 2, MAP_HEIGHT - 100),
        width: MAP_WIDTH - 40,
        height: 200,
        z: 1,
      });
      path.graphics.use(new ex.Rectangle({
        width: MAP_WIDTH - 40,
        height: 200,
        color: ex.Color.fromHex('#D2B48C'),
      }));
      this.add(path);
    }

    // Start town music
    AudioManager.playSceneMusic('town');
  }

  private setupBuildings(): void {
    for (const config of BUILDINGS) {
      // Building
      const building = new BuildingActor(config);
      this.add(building);
      this.buildings.push(building);

      // Building label
      const label = new ex.Label({
        text: config.label,
        pos: new ex.Vector(config.x + config.width / 2, config.y - 10),
        font: new ex.Font({ size: 14, color: ex.Color.White }),
        z: 15,
      });
      label.graphics.anchor = ex.Vector.Half;
      this.add(label);

      // Door
      const door = new DoorActor(config);
      this.add(door);
      this.doors.push(door);

      // Roof decoration (triangle)
      const roofHeight = 30;
      const roof = new ex.Actor({
        pos: new ex.Vector(config.x + config.width / 2, config.y - roofHeight / 2),
        z: 7,
      });
      roof.graphics.use(new ex.Polygon({
        points: [
          new ex.Vector(-config.width / 2 - 10, roofHeight / 2),
          new ex.Vector(config.width / 2 + 10, roofHeight / 2),
          new ex.Vector(0, -roofHeight / 2),
        ],
        color: ex.Color.fromHex('#8B0000'),
        strokeColor: ex.Color.Black,
        lineWidth: 2,
      }));
      this.add(roof);
    }
  }

  private setupPlayer(catColor: CatColor): void {
    // Spawn in center of walkable area
    this.player = new PlayerActor({
      x: MAP_WIDTH / 2,
      y: MAP_HEIGHT - 100,
      catColor,
    });
    this.add(this.player);
  }

  private setupHUD(): void {
    // HUD needs to be screen-space fixed, which Excalibur handles differently
    // We'll create HUD elements with high z-index and update position in onPreUpdate

    // HUD background
    const hudBg = new ex.Actor({
      pos: ex.Vector.Zero,
      width: 120,
      height: 50,
      anchor: ex.Vector.Zero,
      z: 1000,
    });
    hudBg.graphics.use(new ex.Rectangle({
      width: 120,
      height: 50,
      color: ex.Color.fromRGB(0, 0, 0, 0.6),
    }));
    this.add(hudBg);

    // Level
    this.levelLabel = new ex.Label({
      text: `Lv.${GameState.player.level}`,
      pos: new ex.Vector(10, 15),
      font: new ex.Font({ size: 12, color: ex.Color.White }),
      z: 1001,
    });
    this.add(this.levelLabel);

    // Gold
    this.goldLabel = new ex.Label({
      text: `Gold: ${GameState.player.gold}`,
      pos: new ex.Vector(10, 35),
      font: new ex.Font({ size: 13, color: ex.Color.fromHex('#FBBF24') }),
      z: 1001,
    });
    this.add(this.goldLabel);

    // Controls hint (centered at top)
    const controls = new ex.Label({
      text: 'Arrow/WASD: Move | ENTER: Interact | I: Inventory | S: Save',
      pos: new ex.Vector(MAP_WIDTH / 2, 10),
      font: new ex.Font({ size: 12, color: ex.Color.fromRGB(100, 100, 120) }),
      z: 1000,
    });
    controls.graphics.anchor = new ex.Vector(0.5, 0);
    this.add(controls);
  }

  private setupCamera(): void {
    // Set camera zoom
    this.camera.zoom = CAMERA_ZOOM;

    // Camera follow strategy
    this.camera.strategy.lockToActor(this.player!);

    // We'll clamp camera in onPreUpdate
  }

  onPreUpdate(engine: ex.Engine, delta: number): void {
    // Clamp camera to map bounds
    if (this.player) {
      const visibleWidth = CANVAS_WIDTH / CAMERA_ZOOM;
      const visibleHeight = CANVAS_HEIGHT / CAMERA_ZOOM;
      const halfW = visibleWidth / 2;
      const halfH = visibleHeight / 2;

      let camX = this.player.pos.x;
      let camY = this.player.pos.y;

      camX = Math.max(halfW, Math.min(camX, MAP_WIDTH - halfW));
      camY = Math.max(halfH, Math.min(camY, MAP_HEIGHT - halfH));

      this.camera.pos = new ex.Vector(camX, camY);
    }

    // Update HUD positions to follow camera (screen-space simulation)
    // Note: In a full implementation, we'd use Excalibur's ScreenElement
  }

  private setupInputHandlers(): void {
    const checkPlayer = () => {
      if (this.player?.getInputManager()) {
        const input = this.player.getInputManager()!;

        // ENTER to interact
        input.onKeyPress('enter', () => {
          if (!this.inputEnabled) return;
          if (this.dungeonUIActive) {
            this.handleDungeonSelect();
          } else {
            this.checkDoorInteraction();
          }
        });

        input.onKeyPress('space', () => {
          if (!this.inputEnabled) return;
          if (!this.dungeonUIActive) {
            this.checkDoorInteraction();
          }
        });

        // ESC to cancel/menu
        input.onKeyPress('escape', () => {
          if (!this.inputEnabled) return;
          if (this.dungeonUIActive) {
            this.closeDungeonUI();
          } else {
            this.goToScene('title');
          }
        });

        // I for inventory
        input.onKeyPress('i', () => {
          if (!this.inputEnabled) return;
          if (!this.dungeonUIActive) {
            this.goToScene('inventory', { fromScene: 'town' });
          }
        });

        // S for manual save - we'll handle this with 's' key
        // Note: InputAdapter doesn't have 's' yet, but we can check directly

        // Dungeon selection navigation
        input.onKeyPress('up', () => {
          if (!this.inputEnabled) return;
          if (this.dungeonUIActive) {
            this.selectPreviousDungeon();
          }
        });

        input.onKeyPress('down', () => {
          if (!this.inputEnabled) return;
          if (this.dungeonUIActive) {
            this.selectNextDungeon();
          }
        });
      } else {
        setTimeout(checkPlayer, 100);
      }
    };
    checkPlayer();
  }

  private checkDoorInteraction(): void {
    if (!this.player) return;

    for (const door of this.doors) {
      const dist = this.player.pos.distance(door.pos);
      if (dist < 50) {
        const config = door.buildingConfig;

        if (config.name === 'dungeon') {
          this.showDungeonUI();
        } else {
          this.goToScene(config.scene);
        }
        return;
      }
    }
  }

  private goToScene(scene: string, data?: unknown): void {
    if (this.onGoToScene) {
      this.onGoToScene(scene, data);
    }
  }

  // --- Dungeon Selection UI ---

  private showDungeonUI(): void {
    this.dungeonUIActive = true;
    this.player?.freeze();
    this.dungeonList = getAllDungeonInfo();

    // Find first unlocked dungeon
    this.selectedDungeonIndex = 0;
    for (let i = 0; i < this.dungeonList.length; i++) {
      if (isDungeonUnlocked(this.dungeonList[i].id, GameState.player.level)) {
        this.selectedDungeonIndex = i;
        break;
      }
    }

    this.renderDungeonUI();
  }

  private closeDungeonUI(): void {
    this.dungeonUIActive = false;
    this.player?.unfreeze();

    for (const e of this.dungeonUIElements) {
      e.kill();
    }
    this.dungeonUIElements = [];
  }

  private renderDungeonUI(): void {
    // Clear existing elements
    for (const e of this.dungeonUIElements) {
      e.kill();
    }
    this.dungeonUIElements = [];

    const modalWidth = 280;
    const modalHeight = 240;
    const modalX = MAP_WIDTH / 2;
    const modalY = MAP_HEIGHT / 2;

    // Dark overlay
    const overlay = new ex.Actor({
      pos: new ex.Vector(MAP_WIDTH / 2, MAP_HEIGHT / 2),
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      z: 400,
    });
    overlay.graphics.use(new ex.Rectangle({
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      color: ex.Color.fromRGB(0, 0, 0, 0.5),
    }));
    this.add(overlay);
    this.dungeonUIElements.push(overlay);

    // Modal background
    const modal = new ex.Actor({
      pos: new ex.Vector(modalX, modalY),
      width: modalWidth,
      height: modalHeight,
      z: 500,
    });
    modal.graphics.use(new ex.Rectangle({
      width: modalWidth,
      height: modalHeight,
      color: ex.Color.fromHex('#141928'),
      strokeColor: ex.Color.fromHex('#6496FF'),
      lineWidth: 3,
    }));
    this.add(modal);
    this.dungeonUIElements.push(modal);

    // Title
    const title = new ex.Label({
      text: 'SELECT DUNGEON',
      pos: new ex.Vector(modalX, modalY - modalHeight / 2 + 20),
      font: new ex.Font({ size: 14, color: ex.Color.fromHex('#64B4FF') }),
      z: 501,
    });
    title.graphics.anchor = ex.Vector.Half;
    this.add(title);
    this.dungeonUIElements.push(title);

    // Player level
    const levelText = new ex.Label({
      text: `Your Level: ${GameState.player.level}`,
      pos: new ex.Vector(modalX, modalY - modalHeight / 2 + 40),
      font: new ex.Font({ size: 13, color: ex.Color.fromRGB(200, 200, 200) }),
      z: 501,
    });
    levelText.graphics.anchor = ex.Vector.Half;
    this.add(levelText);
    this.dungeonUIElements.push(levelText);

    // Dungeon list
    const itemHeight = 26;
    const listStartY = modalY - modalHeight / 2 + 60;

    this.dungeonList.forEach((dungeon, i) => {
      const isSelected = i === this.selectedDungeonIndex;
      const isUnlocked = isDungeonUnlocked(dungeon.id, GameState.player.level);
      const itemY = listStartY + i * itemHeight;

      // Selection highlight
      if (isSelected) {
        const highlight = new ex.Actor({
          pos: new ex.Vector(modalX, itemY + itemHeight / 2),
          width: modalWidth - 20,
          height: itemHeight - 4,
          z: 501,
        });
        highlight.graphics.use(new ex.Rectangle({
          width: modalWidth - 20,
          height: itemHeight - 4,
          color: ex.Color.fromHex('#283C64'),
          strokeColor: ex.Color.fromHex('#6496FF'),
          lineWidth: 1,
        }));
        this.add(highlight);
        this.dungeonUIElements.push(highlight);

        // Arrow
        const arrow = new ex.Label({
          text: '>',
          pos: new ex.Vector(modalX - modalWidth / 2 + 20, itemY + itemHeight / 2),
          font: new ex.Font({ size: 12, color: ex.Color.fromHex('#FFFF64') }),
          z: 502,
        });
        arrow.graphics.anchor = new ex.Vector(0, 0.5);
        this.add(arrow);
        this.dungeonUIElements.push(arrow);
      }

      // Dungeon name
      const nameColor = isUnlocked
        ? (isSelected ? ex.Color.White : ex.Color.fromRGB(200, 200, 200))
        : ex.Color.fromRGB(100, 100, 100);

      const name = new ex.Label({
        text: dungeon.name,
        pos: new ex.Vector(modalX - modalWidth / 2 + 35, itemY + itemHeight / 2),
        font: new ex.Font({ size: 14, color: nameColor }),
        z: 502,
      });
      name.graphics.anchor = new ex.Vector(0, 0.5);
      this.add(name);
      this.dungeonUIElements.push(name);

      // Right side info
      const rightText = isUnlocked ? `${dungeon.totalFloors} floors` : `Lv.${dungeon.requiredLevel}`;
      const rightColor = isUnlocked
        ? ex.Color.fromRGB(150, 200, 150)
        : ex.Color.fromRGB(180, 100, 100);

      const rightLabel = new ex.Label({
        text: rightText,
        pos: new ex.Vector(modalX + modalWidth / 2 - 20, itemY + itemHeight / 2),
        font: new ex.Font({ size: 12, color: rightColor }),
        z: 502,
      });
      rightLabel.graphics.anchor = new ex.Vector(1, 0.5);
      this.add(rightLabel);
      this.dungeonUIElements.push(rightLabel);

      // Lock text for locked dungeons
      if (!isUnlocked) {
        const lockLabel = new ex.Label({
          text: 'LOCKED',
          pos: new ex.Vector(modalX + modalWidth / 2 - 70, itemY + itemHeight / 2),
          font: new ex.Font({ size: 12, color: ex.Color.fromRGB(150, 80, 80) }),
          z: 502,
        });
        lockLabel.graphics.anchor = new ex.Vector(1, 0.5);
        this.add(lockLabel);
        this.dungeonUIElements.push(lockLabel);
      }
    });

    // Instructions
    const instructions = new ex.Label({
      text: 'Up/Down: Select | ENTER: Enter | ESC: Cancel',
      pos: new ex.Vector(modalX, modalY + modalHeight / 2 - 15),
      font: new ex.Font({ size: 12, color: ex.Color.fromRGB(120, 120, 140) }),
      z: 501,
    });
    instructions.graphics.anchor = ex.Vector.Half;
    this.add(instructions);
    this.dungeonUIElements.push(instructions);
  }

  private selectPreviousDungeon(): void {
    let newIndex = this.selectedDungeonIndex - 1;
    while (newIndex >= 0) {
      if (isDungeonUnlocked(this.dungeonList[newIndex].id, GameState.player.level)) {
        this.selectedDungeonIndex = newIndex;
        this.renderDungeonUI();
        return;
      }
      newIndex--;
    }
  }

  private selectNextDungeon(): void {
    let newIndex = this.selectedDungeonIndex + 1;
    while (newIndex < this.dungeonList.length) {
      if (isDungeonUnlocked(this.dungeonList[newIndex].id, GameState.player.level)) {
        this.selectedDungeonIndex = newIndex;
        this.renderDungeonUI();
        return;
      }
      newIndex++;
    }
  }

  private handleDungeonSelect(): void {
    const dungeon = this.dungeonList[this.selectedDungeonIndex];
    if (dungeon && isDungeonUnlocked(dungeon.id, GameState.player.level)) {
      this.closeDungeonUI();
      this.goToScene('dungeon', {
        catColor: GameState.player.catColor,
        dungeonId: dungeon.id,
      });
    }
  }
}
