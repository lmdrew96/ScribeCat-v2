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

// Map scaling - the tilemap is 640x480 (40x30 tiles at 16px), we scale to fit 640x400
// Using 0.833 scale: 480*0.833=400 (fits height exactly)
const MAP_SCALE = CANVAS_HEIGHT / 480; // ~0.833
const MAP_OFFSET_X = 0;
const MAP_OFFSET_Y = 0;

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

    // --- PLAYER ---
    const player = await createPlayer({
      k,
      x: spawnPos.x,
      y: spawnPos.y,
      color: catColor,
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
      // Also check canvas bounds
      if (x < halfWidth || x > CANVAS_WIDTH - halfWidth) return true;
      if (y < halfHeight || y > CANVAS_HEIGHT - halfHeight) return true;
      return false;
    };

    // Setup movement with collision callback
    setupMovement({
      k,
      player,
      speed: PLAYER_SPEED,
      bounds: {
        minX: 0,
        maxX: CANVAS_WIDTH,
        minY: 0,
        maxY: CANVAS_HEIGHT,
      },
      collisionCheck: isColliding,
    });

    // --- INTERACTIONS ---
    setupInteraction({
      k,
      player,
      interactables,
    });

    // --- UI OVERLAY ---
    // HUD background
    k.add([
      k.rect(120, 50),
      k.pos(10, 10),
      k.color(0, 0, 0),
      k.opacity(0.6),
      k.z(50),
    ]);

    // Player stats
    k.add([
      k.text(`Lv.${GameState.player.level}`, { size: 12 }),
      k.pos(20, 20),
      k.color(255, 255, 255),
      k.z(51),
    ]);

    k.add([
      k.text(`Gold: ${GameState.player.gold}`, { size: 10 }),
      k.pos(20, 38),
      k.color(251, 191, 36),
      k.z(51),
    ]);

    // Controls hint
    k.add([
      k.text('Arrow/WASD: Move | ENTER: Interact | ESC: Menu', { size: 8 }),
      k.pos(CANVAS_WIDTH / 2, 10),
      k.anchor('top'),
      k.color(100, 100, 120),
      k.z(50),
    ]);

    // --- MENU (ESC) ---
    k.onKeyPress('escape', () => {
      k.go('title');
    });

    // Debug
    console.log('=== StudyQuest Town ===');
    console.log(`Cat: ${catColor}, Level: ${GameState.player.level}, Gold: ${GameState.player.gold}`);
  });
}
