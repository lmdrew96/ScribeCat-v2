/**
 * TilemapRoomLoader
 *
 * Loads pre-designed TMX tilemap rooms for special dungeon encounters.
 * Integrates with the procedural dungeon generation for a hybrid approach:
 * - Standard rooms use procedural colored rectangles
 * - Special rooms (treasure, boss, secret, puzzle) use handcrafted tilemaps
 *
 * Available rooms: dungeon_room1.tmx through dungeon_room15.tmx
 */

import * as ex from 'excalibur';
import { parseTMX, type MapData, type MapObject } from '../excalibur/loaders/TiledLoader.js';

// Asset paths
const MAPS_BASE = '../../assets/MAPS/Tile Maps';
const TILES_BASE = '../../assets/Tiles';

/**
 * Room template identifiers (1-15 available)
 */
export type DungeonRoomTemplateId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

/**
 * Loaded tilemap room data
 */
export interface TilemapRoom {
  templateId: DungeonRoomTemplateId;
  mapData: MapData;
  tileImages: Map<string, ex.ImageSource>;
  actors: ex.Actor[];
  spawnPoints: MapObject[];
  doors: MapObject[];
  colliders: MapObject[];
}

// Cache for loaded maps and tile images
const mapCache: Map<DungeonRoomTemplateId, MapData> = new Map();
const tileImageCache: Map<string, ex.ImageSource> = new Map();

/**
 * Room type to template ID mapping
 * Maps procedural room types to appropriate tilemap templates
 */
const ROOM_TYPE_TEMPLATES: Record<string, DungeonRoomTemplateId[]> = {
  start: [1, 2],
  treasure: [3, 4, 5],
  boss: [6, 7, 8],
  secret: [9, 10],
  puzzle: [11, 12],
  rest: [13, 14],
  merchant: [15],
  // Empty, enemy, trap rooms use procedural generation (no tilemap)
};

/**
 * Get the TMX file path for a room template
 */
export function getRoomTemplatePath(id: DungeonRoomTemplateId): string {
  return `${MAPS_BASE}/dungeon_room${id}.tmx`;
}

/**
 * Load a TMX file and parse it
 */
async function loadTMXFile(path: string): Promise<MapData | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      console.warn(`[TilemapRoomLoader] Failed to fetch TMX: ${path}`);
      return null;
    }
    const content = await response.text();
    return parseTMX(content);
  } catch (err) {
    console.warn(`[TilemapRoomLoader] Error loading TMX: ${path}`, err);
    return null;
  }
}

/**
 * Load a tile image
 */
async function loadTileImage(folder: string, filename: string): Promise<ex.ImageSource | null> {
  const key = `${folder}/${filename}`;
  if (tileImageCache.has(key)) {
    return tileImageCache.get(key)!;
  }

  try {
    const path = `${TILES_BASE}/${folder}/${filename}`;
    const image = new ex.ImageSource(path);
    await image.load();
    tileImageCache.set(key, image);
    return image;
  } catch (err) {
    // Silently fail for missing tiles
    return null;
  }
}

/**
 * Load a room template by ID
 */
export async function loadRoomTemplate(id: DungeonRoomTemplateId): Promise<MapData | null> {
  if (mapCache.has(id)) {
    return mapCache.get(id)!;
  }

  const path = getRoomTemplatePath(id);
  const mapData = await loadTMXFile(path);
  if (mapData) {
    mapCache.set(id, mapData);
  }
  return mapData;
}

/**
 * Get a random template ID for a room type
 */
export function getTemplateForRoomType(roomType: string): DungeonRoomTemplateId | null {
  const templates = ROOM_TYPE_TEMPLATES[roomType];
  if (!templates || templates.length === 0) {
    return null;
  }
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Check if a room type should use a tilemap
 */
export function shouldUseTilemap(roomType: string): boolean {
  return roomType in ROOM_TYPE_TEMPLATES;
}

/**
 * Create tile actors from map data
 */
export async function createTileActors(
  mapData: MapData,
  offsetX: number,
  offsetY: number,
  scale = 1,
  baseZ = -5
): Promise<ex.Actor[]> {
  const actors: ex.Actor[] = [];
  const { tileWidth, tileHeight, layers, tilesets } = mapData;

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    const layer = layers[layerIndex];
    const z = baseZ + layerIndex;

    for (let y = 0; y < layer.height; y++) {
      for (let x = 0; x < layer.width; x++) {
        const tileIndex = y * layer.width + x;
        const gid = layer.data[tileIndex];

        if (gid === 0) continue; // Empty tile

        // Find which tileset this gid belongs to
        let matchedTileset = null;
        for (const tileset of tilesets) {
          if (gid >= tileset.firstGid) {
            matchedTileset = tileset;
            break;
          }
        }

        if (!matchedTileset) continue;

        const localId = gid - matchedTileset.firstGid;
        const filename = matchedTileset.tileIdToFile.get(localId);
        if (!filename) continue;

        const image = await loadTileImage(matchedTileset.folder, filename);
        if (!image) continue;

        const worldX = offsetX + (x + 0.5) * tileWidth * scale;
        const worldY = offsetY + (y + 0.5) * tileHeight * scale;

        const actor = new ex.Actor({
          pos: new ex.Vector(worldX, worldY),
          anchor: ex.Vector.Half,
          z,
        });

        const sprite = image.toSprite();
        sprite.scale = new ex.Vector(scale, scale);
        actor.graphics.use(sprite);

        actors.push(actor);
      }
    }
  }

  return actors;
}

/**
 * Extract spawn points from map object groups
 */
export function extractSpawnPoints(mapData: MapData): MapObject[] {
  const spawns: MapObject[] = [];
  for (const group of mapData.objectGroups) {
    if (group.name.toLowerCase().includes('spawn') || group.name.toLowerCase().includes('player')) {
      spawns.push(...group.objects);
    }
  }
  return spawns;
}

/**
 * Extract door/exit objects from map
 */
export function extractDoors(mapData: MapData): MapObject[] {
  const doors: MapObject[] = [];
  for (const group of mapData.objectGroups) {
    if (group.name.toLowerCase().includes('door') || group.name.toLowerCase().includes('exit')) {
      doors.push(...group.objects);
    }
  }
  return doors;
}

/**
 * Extract collision objects from map
 */
export function extractColliders(mapData: MapData): MapObject[] {
  const colliders: MapObject[] = [];
  for (const group of mapData.objectGroups) {
    if (group.name.toLowerCase().includes('collision') || group.name.toLowerCase().includes('wall')) {
      colliders.push(...group.objects);
    }
  }
  return colliders;
}

/**
 * Load and create a complete tilemap room
 */
export async function createTilemapRoom(
  templateId: DungeonRoomTemplateId,
  offsetX: number,
  offsetY: number,
  targetWidth: number,
  targetHeight: number,
  baseZ = -5
): Promise<TilemapRoom | null> {
  const mapData = await loadRoomTemplate(templateId);
  if (!mapData) return null;

  // Calculate scale to fit room into target dimensions
  const mapPixelWidth = mapData.width * mapData.tileWidth;
  const mapPixelHeight = mapData.height * mapData.tileHeight;
  const scaleX = targetWidth / mapPixelWidth;
  const scaleY = targetHeight / mapPixelHeight;
  const scale = Math.min(scaleX, scaleY);

  const actors = await createTileActors(mapData, offsetX, offsetY, scale, baseZ);

  return {
    templateId,
    mapData,
    tileImages: tileImageCache,
    actors,
    spawnPoints: extractSpawnPoints(mapData),
    doors: extractDoors(mapData),
    colliders: extractColliders(mapData),
  };
}

/**
 * Preload all dungeon room templates
 */
export async function preloadDungeonRoomTemplates(): Promise<void> {
  const templateIds: DungeonRoomTemplateId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  await Promise.all(templateIds.map((id) => loadRoomTemplate(id)));
  console.log(`[TilemapRoomLoader] Preloaded ${mapCache.size} room templates`);
}

/**
 * Clear caches
 */
export function clearTilemapRoomCache(): void {
  mapCache.clear();
  tileImageCache.clear();
}
