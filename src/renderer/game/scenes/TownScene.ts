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
import { createBuilding } from '../components/Door.js';
import { PLAYER_SPEED } from '../config.js';
import type { CatColor } from '../sprites/catSprites.js';
import { parseTMX, loadMapTiles, renderAllLayers } from '../maps/index.js';
import {
  loadTownTiles,
  createDecoration,
  createTiledPath,
  createTMXDecoration,
  type BuildingType,
} from '../sprites/townSprites.js';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 400;

// Map scaling - the tilemap is 480x320, we scale to fit 640x400
// Using 1.25 scale: 480*1.25=600, 320*1.25=400
const MAP_SCALE = 1.25;
const MAP_OFFSET_X = (CANVAS_WIDTH - 480 * MAP_SCALE) / 2; // Center horizontally (20px)
const MAP_OFFSET_Y = 0;

// Walkable area bounds (in canvas coordinates, accounting for scale)
const WALKABLE_BOUNDS = {
  minX: MAP_OFFSET_X + 30,
  maxX: MAP_OFFSET_X + 480 * MAP_SCALE - 30,
  minY: 180, // Keep below buildings
  maxY: CANVAS_HEIGHT - 40,
};

// Player spawn position
const SPAWN_X = CANVAS_WIDTH / 2;
const SPAWN_Y = CANVAS_HEIGHT - 80;

// Building positions (y is ground level for each building)
const BUILDING_Y = 200;
const BUILDINGS_CONFIG: Array<{
  x: number;
  label: string;
  scene: string;
  color: readonly [number, number, number];
  buildingType: BuildingType;
}> = [
  { x: 100, label: 'Home', scene: 'home', color: [139, 90, 43] as const, buildingType: 'home' },
  { x: 250, label: 'Shop', scene: 'shop', color: [70, 130, 180] as const, buildingType: 'shop' },
  { x: 400, label: 'Inn', scene: 'inn', color: [178, 34, 34] as const, buildingType: 'inn' },
  { x: 550, label: 'Dungeon', scene: 'dungeon', color: [75, 0, 130] as const, buildingType: 'dungeon' },
];

export interface TownSceneData {
  catColor?: CatColor;
  fromScene?: string;
}

// Cat Village TMX content (embedded to avoid file loading issues)
const CAT_VILLAGE_TMX = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.11.2" orientation="orthogonal" renderorder="right-down" width="30" height="20" tilewidth="16" tileheight="16" infinite="0" nextlayerid="6" nextobjectid="1">
 <tileset firstgid="1" source="../Tiles/GrassWaterTiles/WaterGrassTiles.tsx"/>
 <tileset firstgid="28" source="../Tiles/PixelAdventure/InterfaceTiles.tsx"/>
 <tileset firstgid="119" source="../Tiles/Tiny Town/TinyTownTiles.tsx"/>
 <layer id="1" name="Grass" width="30" height="20">
  <data encoding="csv">
1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,1,1,1,1,1,1,1,1,1,2,2,2,3,
3,1,1,2,1,1,1,1,1,1,1,2,2,3,1,2,2,1,1,1,2,1,1,1,1,1,1,2,3,2,
1,1,2,3,1,1,1,3,1,1,1,1,3,3,1,1,1,1,1,2,3,2,2,1,3,1,1,2,2,2,
1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,1,1,1,1,1,1,2,2,
1,1,1,2,3,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,1,1,
1,1,1,1,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,1,1,1,
1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,1,2,2,1,1,1,1,
1,1,1,1,1,1,1,1,3,1,1,1,1,2,3,2,2,1,1,1,1,1,1,1,3,1,1,1,1,1,
1,1,2,1,1,1,1,1,1,1,1,1,2,2,2,2,1,1,1,1,1,1,1,3,2,1,1,1,1,1,
1,1,2,2,1,1,1,1,1,1,1,2,3,2,2,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,
1,1,1,2,3,1,1,1,1,1,1,2,2,2,2,1,1,1,1,3,1,1,1,1,1,1,1,1,3,1,
3,1,1,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,3,1,1,1,1,2,2,1,1,
1,1,1,1,2,2,1,1,1,3,1,1,1,1,1,1,1,1,1,1,3,2,2,1,1,3,2,2,1,1,
1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,2,2,2,2,2,2,2,1,
1,1,1,1,1,1,1,1,1,1,1,1,1,3,2,2,2,1,1,1,1,1,1,2,2,2,2,2,1,1,
3,2,2,1,1,1,1,1,1,1,1,1,1,2,2,3,2,1,1,1,1,1,1,1,1,1,1,1,1,2,
2,2,3,2,1,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,
2,2,2,2,1,1,1,1,3,1,1,1,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,2,2,2,
3,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,3,2,2,1,1,1,1,1,3,1
</data>
 </layer>
 <layer id="2" name="Water" width="30" height="20">
  <data encoding="csv">
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
6,7,7,8,0,0,0,0,0,0,0,0,0,0,0,0,0,6,7,7,7,7,8,0,0,0,0,0,0,0,
11,12,12,13,0,0,0,0,0,0,0,0,0,0,0,0,0,11,12,12,12,12,13,0,0,0,0,0,0,0,
15,16,16,17,0,0,0,0,0,0,0,0,0,0,0,0,0,11,12,12,12,12,13,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,12,12,12,12,13,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,15,16,16,16,16,17,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
</data>
 </layer>
</map>`;

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

    // --- TILEMAP (grass layer only for background) ---
    try {
      const mapData = parseTMX(CAT_VILLAGE_TMX);
      await loadMapTiles(k, mapData);

      // Render grass and water layers only (buildings rendered separately)
      renderAllLayers(k, mapData, {
        scale: MAP_SCALE,
        offsetX: MAP_OFFSET_X,
        offsetY: MAP_OFFSET_Y,
        baseZIndex: 1,
      });

      console.log('Tilemap loaded successfully');
    } catch (err) {
      console.error('Failed to load tilemap:', err);
    }

    // --- LOAD TOWN TILES ---
    try {
      await loadTownTiles(k);
      console.log('Town tiles loaded successfully');
    } catch (err) {
      console.error('Failed to load town tiles:', err);
    }

    // --- PATH ---
    // Draw a tiled path connecting buildings
    createTiledPath(k, 30, BUILDING_Y + 10, CANVAS_WIDTH - 60, 5);

    // --- BUILDINGS (using tiled sprites) ---
    const buildings = BUILDINGS_CONFIG.map((cfg) =>
      createBuilding({
        k,
        x: cfg.x,
        y: BUILDING_Y,
        label: cfg.label,
        targetScene: cfg.scene,
        buildingColor: k.rgb(cfg.color[0], cfg.color[1], cfg.color[2]),
        useTiles: true,
        buildingType: cfg.buildingType,
      })
    );

    // --- DECORATIONS ---
    // Trees between buildings
    createDecoration(k, 'tree_green', 175, BUILDING_Y + 20, 4);
    createDecoration(k, 'tree_yellow', 325, BUILDING_Y + 15, 4);
    createDecoration(k, 'tree_green', 475, BUILDING_Y + 20, 4);

    // Small bushes/trees at edges
    createDecoration(k, 'bush', 40, BUILDING_Y + 30, 4);
    createDecoration(k, 'tree_small', 600, BUILDING_Y + 25, 4);

    // Decorative elements near buildings
    createDecoration(k, 'mushroom', 130, BUILDING_Y + 35, 4);
    createDecoration(k, 'mushroom', 370, BUILDING_Y + 38, 4);
    createDecoration(k, 'sign', 220, BUILDING_Y + 10, 6);

    // TMX-based decorations (tree patches and ponds from user's tilemaps)
    createTMXDecoration(k, 'tree_patch', 50, CANVAS_HEIGHT - 60, 2);
    createTMXDecoration(k, 'pond_small', CANVAS_WIDTH - 80, CANVAS_HEIGHT - 40, 2);

    // --- PLAYER ---
    const player = await createPlayer({
      k,
      x: SPAWN_X,
      y: SPAWN_Y,
      color: catColor,
    });

    // --- MOVEMENT ---
    setupMovement({
      k,
      player,
      speed: PLAYER_SPEED,
      bounds: WALKABLE_BOUNDS,
    });

    // --- INTERACTIONS ---
    const interactables: Interactable[] = buildings.map((building) => ({
      entity: building.door.entity,
      type: 'door',
      promptText: building.door.getPromptText(),
      onInteract: () => {
        building.door.enter();
      },
      range: 60,
    }));

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
