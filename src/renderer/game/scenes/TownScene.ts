/**
 * TownScene
 *
 * The central hub of StudyQuest. Players access all activities from here:
 * - Home (decorate, view collection)
 * - Shop (buy items, gear, furniture)
 * - Inn (heal HP)
 * - Dungeon Gate (enter dungeons)
 *
 * Uses CatVillage tilemap for the environment.
 */

import type { KAPLAYCtx } from 'kaplay';
import { GameState } from '../state/GameState.js';
import { createPlayer } from '../components/Player.js';
import { setupMovement } from '../systems/movement.js';
import { setupInteraction, type Interactable } from '../systems/interaction.js';
// Building visuals now come from tilemap, but keeping import for future use
// import { createBuilding } from '../components/Door.js';
import { PLAYER_SPEED, CANVAS_WIDTH, CANVAS_HEIGHT } from '../config.js';
import type { CatColor } from '../sprites/catSprites.js';
import {
  parseTMX,
  loadMapTiles,
  renderAllLayers,
  loadTMXFromPath,
  getSpawnPosition,
  getDoorPositions,
  getColliders,
} from '../maps/index.js';
import { loadTownTiles, type BuildingType } from '../sprites/townSprites.js';
import { saveDungeonProgress } from '../services/StudyQuestService.js';
import { createDungeonSelectionUI } from '../ui/index.js';

// Map dimensions (40x30 tiles at 16px)
const MAP_WIDTH = 640;
const MAP_HEIGHT = 480;

// Render map at full size (no scaling down)
const MAP_SCALE = 1.0;
const MAP_OFFSET_X = 0;
const MAP_OFFSET_Y = 0;

// Camera zoom - higher = more zoomed in (shows less map at once)
const CAMERA_ZOOM = 1.5;

// Door name to scene mapping
const DOOR_SCENE_MAP: Record<string, { label: string; scene: string; buildingType: BuildingType }> = {
  home_door: { label: 'Home', scene: 'home', buildingType: 'home' },
  shop_door: { label: 'Shop', scene: 'shop', buildingType: 'shop' },
  inn_door: { label: 'Inn', scene: 'inn', buildingType: 'inn' },
  dungeon_door: { label: 'Dungeon', scene: 'dungeon', buildingType: 'dungeon' },
  // barn_door: skip for now
};

export interface TownSceneData {
  catColor?: CatColor;
  fromScene?: string;
}

// TMX file path
const CAT_VILLAGE_TMX_PATH = '../../assets/MAPS/Tile Maps/cat_village.tmx';

export function registerTownScene(k: KAPLAYCtx): void {
  k.scene('town', async (data: TownSceneData = {}) => {
    const catColor = data.catColor || GameState.player.catColor;

    // Clear any active dungeon run when entering town (player abandoned dungeon)
    if (GameState.hasActiveDungeonRun()) {
      console.log('Clearing abandoned dungeon run');
      GameState.dungeon.dungeonId = null;
      GameState.dungeon.floorNumber = 1;
      GameState.dungeon.floor = null;
      GameState.dungeon.currentRoomId = '';

      // Also clear in cloud
      const characterId = GameState.getCharacterId();
      if (characterId && GameState.isCloudSyncEnabled()) {
        saveDungeonProgress(characterId, null, 0)
          .catch(err => console.warn('Failed to clear dungeon progress:', err));
      }
    }

    // --- BACKGROUND (fallback color) ---
    k.add([
      k.rect(CANVAS_WIDTH, CANVAS_HEIGHT),
      k.pos(0, 0),
      k.color(34, 139, 34), // Forest green fallback
      k.z(0),
    ]);

    // --- LOAD AND RENDER TILEMAP ---
    let mapData;
    let colliders: Array<{ x: number; y: number; width: number; height: number }> = [];
    let spawnPos = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 80 }; // Default spawn
    let doorPositions = new Map<string, { x: number; y: number; width: number; height: number }>();

    try {
      const tmxContent = await loadTMXFromPath(CAT_VILLAGE_TMX_PATH);
      mapData = parseTMX(tmxContent);
      await loadMapTiles(k, mapData);

      // Render all layers (grass, water, greenery, buildings, items, items2)
      renderAllLayers(k, mapData, {
        scale: MAP_SCALE,
        offsetX: MAP_OFFSET_X,
        offsetY: MAP_OFFSET_Y,
        baseZIndex: 1,
      });

      // Get spawn position from TMX
      const tmxSpawn = getSpawnPosition(mapData, MAP_SCALE, MAP_OFFSET_X, MAP_OFFSET_Y);
      if (tmxSpawn) {
        spawnPos = tmxSpawn;
      }

      // Get door positions from TMX
      doorPositions = getDoorPositions(mapData, MAP_SCALE, MAP_OFFSET_X, MAP_OFFSET_Y);

      // Get colliders from TMX
      colliders = getColliders(mapData, MAP_SCALE, MAP_OFFSET_X, MAP_OFFSET_Y);

      console.log('Tilemap loaded successfully');
      console.log(`Spawn: (${spawnPos.x.toFixed(0)}, ${spawnPos.y.toFixed(0)})`);
      console.log(`Doors: ${doorPositions.size}, Colliders: ${colliders.length}`);
    } catch (err) {
      console.error('Failed to load tilemap:', err);
    }

    // --- LOAD TOWN TILES (for door sprites) ---
    try {
      await loadTownTiles(k);
    } catch (err) {
      console.error('Failed to load town tiles:', err);
    }

    // --- CREATE DOOR ZONES ---
    const interactables: Interactable[] = [];

    // Track if dungeon selection UI is active (created later after player)
    let dungeonSelectionUI: ReturnType<typeof createDungeonSelectionUI> | null = null;

    for (const [doorName, doorPos] of doorPositions) {
      const doorConfig = DOOR_SCENE_MAP[doorName];
      if (!doorConfig) continue; // Skip unknown doors (like barn_door)

      // Create invisible door entity for interaction
      const doorEntity = k.add([
        k.rect(doorPos.width || 16, doorPos.height || 16),
        k.pos(doorPos.x, doorPos.y),
        k.anchor('topleft'),
        k.opacity(0), // Invisible
        k.area(),
        k.z(20),
        `door_${doorName}`,
      ]);

      // Special handling for dungeon door - show selection UI
      if (doorName === 'dungeon_door') {
        interactables.push({
          entity: doorEntity,
          type: 'door',
          promptText: 'Enter Dungeon',
          onInteract: () => {
            if (dungeonSelectionUI) {
              dungeonSelectionUI.show(GameState.player.level);
            }
          },
          range: 30,
        });
      } else {
        interactables.push({
          entity: doorEntity,
          type: 'door',
          promptText: `Enter ${doorConfig.label}`,
          onInteract: () => {
            k.go(doorConfig.scene);
          },
          range: 30,
        });
      }
    }

    // --- PLAYER ---
    const player = await createPlayer({
      k,
      x: spawnPos.x,
      y: spawnPos.y,
      color: catColor,
    });

    // --- DUNGEON SELECTION UI ---
    dungeonSelectionUI = createDungeonSelectionUI(
      k,
      { canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT },
      {
        freezePlayer: () => { player.freeze(); },
        unfreezePlayer: () => { player.unfreeze(); },
        onSelect: (dungeonId: string) => {
          k.go('dungeon', {
            catColor: GameState.player.catColor,
            dungeonId,
          });
        },
      }
    );

    // Handle keyboard input for dungeon selection modal
    k.onKeyPress('up', () => {
      if (dungeonSelectionUI?.isActive) {
        dungeonSelectionUI.handleInput('up');
      }
    });
    k.onKeyPress('down', () => {
      if (dungeonSelectionUI?.isActive) {
        dungeonSelectionUI.handleInput('down');
      }
    });
    k.onKeyPress('enter', () => {
      if (dungeonSelectionUI?.isActive) {
        dungeonSelectionUI.handleInput('enter');
      }
    });

    // --- MOVEMENT WITH COLLIDERS ---
    // Create a collision check function using TMX colliders
    const isColliding = (x: number, y: number, halfWidth: number, halfHeight: number): boolean => {
      for (const col of colliders) {
        // Check if player bounds overlap with collider
        if (
          x + halfWidth > col.x &&
          x - halfWidth < col.x + col.width &&
          y + halfHeight > col.y &&
          y - halfHeight < col.y + col.height
        ) {
          return true;
        }
      }
      // Also check map bounds
      if (x < halfWidth || x > MAP_WIDTH - halfWidth) return true;
      if (y < halfHeight || y > MAP_HEIGHT - halfHeight) return true;
      return false;
    };

    // Setup movement with collision callback (bounds = full map size)
    setupMovement({
      k,
      player,
      speed: PLAYER_SPEED,
      bounds: {
        minX: 16,
        maxX: MAP_WIDTH - 16,
        minY: 16,
        maxY: MAP_HEIGHT - 16,
      },
      collisionCheck: isColliding,
    });

    // --- INTERACTIONS ---
    setupInteraction({
      k,
      player,
      interactables,
    });

    // --- CAMERA ZOOM & FOLLOW ---
    k.camScale(CAMERA_ZOOM);

    // Calculate visible area dimensions
    const visibleWidth = CANVAS_WIDTH / CAMERA_ZOOM;
    const visibleHeight = CANVAS_HEIGHT / CAMERA_ZOOM;
    const halfVisibleW = visibleWidth / 2;
    const halfVisibleH = visibleHeight / 2;

    // Camera follow with bounds clamping
    k.onUpdate(() => {
      // Center camera on player
      let camX = player.entity.pos.x;
      let camY = player.entity.pos.y;

      // Clamp camera to map bounds (prevent showing outside map)
      camX = Math.max(halfVisibleW, Math.min(camX, MAP_WIDTH - halfVisibleW));
      camY = Math.max(halfVisibleH, Math.min(camY, MAP_HEIGHT - halfVisibleH));

      k.setCamPos(camX, camY);
    });

    // --- UI OVERLAY (fixed to screen, not affected by camera) ---
    // HUD background
    k.add([
      k.rect(120, 50),
      k.pos(10, 10),
      k.color(0, 0, 0),
      k.opacity(0.6),
      k.fixed(),
      k.z(50),
    ]);

    // Player stats
    k.add([
      k.text(`Lv.${GameState.player.level}`, { size: 12 }),
      k.pos(20, 20),
      k.color(255, 255, 255),
      k.fixed(),
      k.z(51),
    ]);

    k.add([
      k.text(`Gold: ${GameState.player.gold}`, { size: 13 }),
      k.pos(20, 38),
      k.color(251, 191, 36),
      k.fixed(),
      k.z(51),
    ]);

    // Controls hint
    k.add([
      k.text('Arrow/WASD: Move | ENTER: Interact | I: Inventory | ESC: Menu', { size: 12 }),
      k.pos(CANVAS_WIDTH / 2, 10),
      k.anchor('top'),
      k.color(100, 100, 120),
      k.fixed(),
      k.z(50),
    ]);

    // --- MENU (ESC) ---
    k.onKeyPress('escape', () => {
      // Close dungeon selection if active
      if (dungeonSelectionUI?.isActive) {
        dungeonSelectionUI.handleInput('escape');
        return;
      }
      k.go('title');
    });

    // --- INVENTORY (I) ---
    k.onKeyPress('i', () => {
      // Don't open if dungeon selection is active
      if (dungeonSelectionUI?.isActive) return;
      k.go('inventory', { fromScene: 'town' });
    });

    // Debug
    console.log('=== StudyQuest Town ===');
    console.log(`Cat: ${catColor}, Level: ${GameState.player.level}, Gold: ${GameState.player.gold}`);
  });
}
