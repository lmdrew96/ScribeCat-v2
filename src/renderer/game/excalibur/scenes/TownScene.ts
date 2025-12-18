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
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../config.js';
import type { CatColor } from '../adapters/SpriteAdapter.js';
import { saveDungeonProgress } from '../../services/StudyQuestService.js';
import { type DungeonInfo, getAllDungeonInfo, isDungeonUnlocked } from '../../data/dungeons.js';
import { loadBackground, createBackgroundActor, createFallbackBackground } from '../../loaders/BackgroundLoader.js';
import { AudioManager } from '../../audio/AudioManager.js';
import {
  preloadTownTiles,
  createTownTilemapActors,
  getTilemapDimensions,
  isPixelWalkable,
  getSpawnPixelPosition,
  getTownDoorPositions,
  clearColliderCache,
} from '../loaders/TownTilemapLoader.js';
import { PlayerActor } from '../actors/PlayerActor.js';
import { DialogOverlay, type DialogItem } from '../components/DialogOverlay.js';

// Map dimensions - will be updated from TMX when using tilemap
let MAP_WIDTH = 640;
let MAP_HEIGHT = 480;

// Camera zoom - reduced for wider view of cat_village
const CAMERA_ZOOM = 1.0;

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
 * Door Actor - invisible interaction zone for TMX doors
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
    // Don't render any graphics - the door is already rendered in the TMX tilemap
    // This actor is just for interaction detection
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

  // Tilemap state
  private tileActors: ex.Actor[] = [];
  private useTilemap = true; // Set to false to use background image instead
  private tilemapScale = 2;
  private tilemapOffsetX = 0;
  private tilemapOffsetY = 0;

  // Input cooldown to prevent key events carrying over from scene transitions
  private inputEnabled = false;

  // Dungeon selection state
  private dungeonUIActive = false;
  private dungeonDialog: DialogOverlay | null = null;
  private dungeonList: DungeonInfo[] = [];

  // HUD elements (using ScreenElement for screen-space positioning)
  private hudContainer: ex.ScreenElement | null = null;
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
    this.buildings = [];
    this.doors = [];

    this.clear();

    // Setup scene - use async initialization
    this.initializeScene(catColor);

    console.log('=== StudyQuest Town (Excalibur) ===');
    console.log(`Cat: ${catColor}, Level: ${GameState.player.level}, Gold: ${GameState.player.gold}`);
  }

  /**
   * Async scene initialization - ensures tilemap is loaded before setting up doors
   */
  private async initializeScene(catColor: CatColor): Promise<void> {
    // Setup background first (loads TMX file)
    await this.setupBackground();
    
    // Now that TMX is loaded, setup buildings/doors
    this.setupBuildings();
    this.setupPlayer(catColor);
    this.setupHUD();
    this.setupCamera();
    this.setupInputHandlers();
    this.setupDungeonDialog();
  }

  onDeactivate(): void {
    // Reset input state to prevent stale handlers from firing
    this.inputEnabled = false;

    // Cleanup HTML overlays
    this.dungeonDialog?.destroy();
    this.dungeonDialog = null;

    this.player = null;
    this.buildings = [];
    this.doors = [];
    this.tileActors = [];
    this.hudContainer = null;
    this.levelLabel = null;
    this.goldLabel = null;
    this.saveStatusLabel = null;
  }

  private async setupBackground(): Promise<void> {
    if (this.useTilemap) {
      // Use tile-based map
      await this.setupTilemap();
    } else {
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
    }

    // Start town music
    AudioManager.playSceneMusic('town');
  }

  /**
   * Setup tile-based background using cat_village.tmx
   */
  private async setupTilemap(): Promise<void> {
    // Preload tile images
    await preloadTownTiles();

    // Get tilemap dimensions and update map size
    const dims = getTilemapDimensions(this.tilemapScale);
    MAP_WIDTH = dims.width;
    MAP_HEIGHT = dims.height;

    // No offset needed - tilemap fills the map area
    this.tilemapOffsetX = 0;
    this.tilemapOffsetY = 0;

    // Clear collider cache (in case scale changed)
    clearColliderCache();

    // Create tile actors
    this.tileActors = createTownTilemapActors(
      this.tilemapOffsetX,
      this.tilemapOffsetY,
      this.tilemapScale,
      -10 // Base z-index for tiles
    );

    // Add all tile actors to the scene
    for (const actor of this.tileActors) {
      this.add(actor);
    }

    console.log(`[TownScene] Created ${this.tileActors.length} tile actors, map size: ${MAP_WIDTH}x${MAP_HEIGHT}`);
  }

  private setupBuildings(): void {
    // When using tilemap, buildings are rendered in the TMX file
    // Only create doors from the TMX door positions
    if (this.useTilemap) {
      this.setupTilemapDoors();
      return;
    }

    // Fallback: Use hardcoded buildings for non-tilemap mode
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

  /**
   * Setup doors from the TMX file positions
   */
  private setupTilemapDoors(): void {
    const doorPositions = getTownDoorPositions(this.tilemapOffsetX, this.tilemapOffsetY, this.tilemapScale);
    
    console.log(`[TownScene] Found ${doorPositions.length} door positions from TMX`);

    // Map TMX door names to building configs
    const doorNameToScene: Record<string, { scene: string; label: string }> = {
      'home_door': { scene: 'home', label: 'Home' },
      'shop_door': { scene: 'shop', label: 'Shop' },
      'inn_door': { scene: 'inn', label: 'Inn' },
      'dungeon_door': { scene: 'dungeon', label: 'Dungeon' },
      'barn_door': { scene: 'barn', label: 'Barn' },
    };

    for (const door of doorPositions) {
      const mapping = doorNameToScene[door.name];
      if (!mapping) {
        console.log(`[TownScene] Skipping unknown door: ${door.name}`);
        continue;
      }

      console.log(`[TownScene] Creating door: ${door.name} at (${door.x}, ${door.y}) size ${door.width}x${door.height}`);

      // Create a pseudo BuildingConfig for the door
      const config: BuildingConfig = {
        name: door.name.replace('_door', ''),
        label: mapping.label,
        scene: mapping.scene,
        x: door.x,
        y: door.y,
        width: door.width,
        height: door.height,
        color: '#8B4513',
        doorX: door.x + door.width / 2,
        doorY: door.y + door.height / 2,
      };

      // Create door actor at the door position
      const doorActor = new DoorActor(config);
      this.add(doorActor);
      this.doors.push(doorActor);

      // Labels removed - building names are shown on signs in the TMX
    }

    console.log(`[TownScene] Created ${this.doors.length} doors from TMX`);
  }

  private setupPlayer(catColor: CatColor): void {
    // Determine spawn position
    let spawnX = MAP_WIDTH / 2;
    let spawnY = MAP_HEIGHT - 100;

    if (this.useTilemap) {
      // Use tilemap spawn position
      const spawn = getSpawnPixelPosition(this.tilemapOffsetX, this.tilemapOffsetY, this.tilemapScale);
      spawnX = spawn.x;
      spawnY = spawn.y;
    }

    this.player = new PlayerActor({
      x: spawnX,
      y: spawnY,
      catColor,
      // Use tilemap collision checker for town navigation
      isWalkable: isPixelWalkable,
      // Fallback bounds (tilemap handles most collision)
      bounds: {
        minX: 16,
        maxX: MAP_WIDTH - 16,
        minY: 16,
        maxY: MAP_HEIGHT - 16,
      },
    });
    this.add(this.player);
  }

  private setupHUD(): void {
    // HUD background (top-left corner)
    const hudBg = new ex.ScreenElement({
      pos: ex.vec(0, 0),
      z: 1000,
    });
    hudBg.graphics.use(new ex.Rectangle({
      width: 140,
      height: 80,
      color: ex.Color.fromRGB(0, 0, 0, 0.6),
    }));
    this.add(hudBg);
    this.hudContainer = hudBg;

    // HP Bar background
    const hpBg = new ex.ScreenElement({
      pos: ex.vec(10, 10),
      z: 1001,
    });
    hpBg.graphics.use(new ex.Rectangle({
      width: 120,
      height: 12,
      color: ex.Color.fromRGB(60, 20, 20),
    }));
    this.add(hpBg);

    // HP Bar (calculate current ratio)
    const effectiveMaxHp = GameState.getEffectiveMaxHealth();
    const hpRatio = GameState.player.health / effectiveMaxHp;
    const hpBar = new ex.ScreenElement({
      pos: ex.vec(10, 10),
      z: 1002,
    });
    hpBar.graphics.use(new ex.Rectangle({
      width: 120 * hpRatio,
      height: 12,
      color: hpRatio > 0.5 ? ex.Color.fromRGB(60, 220, 100) : 
             hpRatio > 0.25 ? ex.Color.fromRGB(240, 200, 60) : ex.Color.fromRGB(240, 60, 60),
    }));
    this.add(hpBar);

    // Level label
    const levelElement = new ex.ScreenElement({
      pos: ex.vec(10, 28),
      z: 1001,
    });
    levelElement.graphics.use(new ex.Text({
      text: `Lv.${GameState.player.level}`,
      font: new ex.Font({ size: 12, color: ex.Color.White }),
    }));
    this.add(levelElement);
    this.levelLabel = levelElement as unknown as ex.Label;

    // XP label  
    const xpElement = new ex.ScreenElement({
      pos: ex.vec(60, 28),
      z: 1001,
    });
    xpElement.graphics.use(new ex.Text({
      text: `XP: ${GameState.player.xp}`,
      font: new ex.Font({ size: 11, color: ex.Color.fromHex('#a78bfa') }),
    }));
    this.add(xpElement);

    // Gold label
    const goldElement = new ex.ScreenElement({
      pos: ex.vec(10, 46),
      z: 1001,
    });
    goldElement.graphics.use(new ex.Text({
      text: `Gold: ${GameState.player.gold}`,
      font: new ex.Font({ size: 12, color: ex.Color.fromHex('#FBBF24') }),
    }));
    this.add(goldElement);
    this.goldLabel = goldElement as unknown as ex.Label;

    // HP text overlay
    const hpText = new ex.ScreenElement({
      pos: ex.vec(70, 8),
      z: 1003,
    });
    hpText.graphics.use(new ex.Text({
      text: `${GameState.player.health}/${effectiveMaxHp}`,
      font: new ex.Font({ size: 10, color: ex.Color.White }),
    }));
    this.add(hpText);

    // Controls hint (bottom of HUD)
    const controlsHint = new ex.ScreenElement({
      pos: ex.vec(10, 64),
      z: 1001,
    });
    controlsHint.graphics.use(new ex.Text({
      text: 'WASD:Move ENTER:Interact',
      font: new ex.Font({ size: 9, color: ex.Color.fromRGB(150, 150, 150) }),
    }));
    this.add(controlsHint);
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

    // HUD elements use ScreenElement so they automatically stay fixed to screen
  }

  private setupInputHandlers(): void {
    const checkPlayer = () => {
      if (this.player?.getInputManager()) {
        const input = this.player.getInputManager()!;

        // ENTER to interact (DialogOverlay handles its own keyboard input when open)
        input.onKeyPress('enter', () => {
          if (!this.inputEnabled || this.dungeonUIActive) return;
          this.checkDoorInteraction();
        });

        input.onKeyPress('space', () => {
          if (!this.inputEnabled || this.dungeonUIActive) return;
          this.checkDoorInteraction();
        });

        // ESC to cancel/menu (DialogOverlay handles its own ESC when open)
        input.onKeyPress('escape', () => {
          if (!this.inputEnabled) return;
          if (!this.dungeonUIActive) {
            this.goToScene('title');
          }
        });

        // I for inventory
        input.onKeyPress('i', () => {
          if (!this.inputEnabled || this.dungeonUIActive) return;
          this.goToScene('inventory', { fromScene: 'town' });
        });
      } else {
        setTimeout(checkPlayer, 100);
      }
    };
    checkPlayer();
  }

  private checkDoorInteraction(): void {
    if (!this.player) return;

    // Increased interaction distance for scaled tilemap (scale=2, doors are larger)
    const interactionDistance = 80;

    for (const door of this.doors) {
      const dist = this.player.pos.distance(door.pos);
      if (dist < interactionDistance) {
        const config = door.buildingConfig;
        console.log(`[TownScene] Entering ${config.name} (distance: ${dist.toFixed(1)})`);

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

  /**
   * Setup the dungeon selection dialog overlay
   */
  private setupDungeonDialog(): void {
    const canvas = this.engine.canvas;
    const container = canvas.parentElement;

    if (!container) {
      console.warn('TownScene: Could not find canvas container for overlays');
      return;
    }

    // Ensure container has relative positioning for absolute overlays
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    this.dungeonDialog = new DialogOverlay(container, {
      title: 'Select Dungeon',
      width: 320,
      maxHeight: 300,
      content: `<p style="margin: 0 0 8px; font-size: 12px; color: #888;">Your Level: <span style="color: #64b4ff;">${GameState.player.level}</span></p>`,
      controlsHint: '<kbd>↑↓</kbd> Select &nbsp; <kbd>Enter</kbd> Enter &nbsp; <kbd>Esc</kbd> Cancel',
      onClose: () => {
        this.dungeonUIActive = false;
        this.player?.unfreeze();
      },
      onItemSelect: (item) => {
        this.handleDungeonSelect(item.id);
      },
    });
  }

  private showDungeonUI(): void {
    this.dungeonUIActive = true;
    this.player?.freeze();
    this.dungeonList = getAllDungeonInfo();

    // Build dialog items from dungeon list
    const items: DialogItem[] = this.dungeonList.map(dungeon => {
      const isUnlocked = isDungeonUnlocked(dungeon.id, GameState.player.level);
      return {
        id: dungeon.id,
        label: dungeon.name,
        sublabel: isUnlocked ? `${dungeon.totalFloors} floors` : `Lv.${dungeon.requiredLevel} (LOCKED)`,
        disabled: !isUnlocked,
        data: dungeon,
      };
    });

    // Update content with current level
    this.dungeonDialog?.setContent(
      `<p style="margin: 0 0 8px; font-size: 12px; color: #888;">Your Level: <span style="color: #64b4ff;">${GameState.player.level}</span></p>`
    );

    this.dungeonDialog?.open(items);
  }

  private closeDungeonUI(): void {
    this.dungeonUIActive = false;
    this.dungeonDialog?.close();
  }

  private handleDungeonSelect(dungeonId: string): void {
    const dungeon = this.dungeonList.find(d => d.id === dungeonId);
    if (dungeon && isDungeonUnlocked(dungeon.id, GameState.player.level)) {
      this.closeDungeonUI();
      this.goToScene('dungeon', {
        catColor: GameState.player.catColor,
        dungeonId: dungeon.id,
      });
    }
  }
}
