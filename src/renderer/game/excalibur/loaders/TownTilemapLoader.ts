/**
 * TownTilemapLoader
 *
 * Loads and renders the town tilemap for the TownScene.
 * Uses the cat_village.tmx Tiled map file.
 */

import * as ex from 'excalibur';
import {
  parseTMX,
  loadMapTiles,
  createAllLayerActors,
  getSpawnPosition,
  getDoorPositions,
  getColliders,
  type MapData,
} from './TiledLoader.js';

// Path to the cat_village TMX file (relative from dist/renderer/)
const TOWN_TMX_PATH = '../../assets/MAPS/Tile Maps/cat_village.tmx';

// Cached map data
let cachedMapData: MapData | null = null;
let tilemapLoaded = false;

// Map dimensions from cat_village.tmx
const TMX_WIDTH = 40;
const TMX_HEIGHT = 30;
const TMX_TILE_SIZE = 16;

/**
 * Preload the town tilemap from TMX file
 */
export async function preloadTownTiles(): Promise<void> {
  if (tilemapLoaded && cachedMapData) return;

  try {
    // Fetch and parse the TMX file
    const response = await fetch(TOWN_TMX_PATH);
    if (!response.ok) {
      throw new Error(`Failed to fetch TMX: ${response.statusText}`);
    }
    const tmxContent = await response.text();
    cachedMapData = parseTMX(tmxContent);

    // Load all tile images
    await loadMapTiles(cachedMapData);

    tilemapLoaded = true;
    console.log(`[TownTilemapLoader] Loaded cat_village.tmx (${cachedMapData.width}x${cachedMapData.height})`);
  } catch (err) {
    console.error('[TownTilemapLoader] Failed to load cat_village.tmx:', err);
    tilemapLoaded = false;
  }
}

/**
 * Create tile actors for all layers in the town tilemap
 */
export function createTownTilemapActors(
  offsetX = 0,
  offsetY = 0,
  scale = 2,
  baseZ = -10
): ex.Actor[] {
  if (!cachedMapData) {
    console.warn('[TownTilemapLoader] Map data not loaded, returning empty actors');
    return [];
  }

  const allActors: ex.Actor[] = [];

  // Create actors for each layer using the TiledLoader
  const layerActors = createAllLayerActors(cachedMapData, {
    scale,
    offsetX,
    offsetY,
    baseZIndex: baseZ,
  });

  // Combine all layer actors into a single array
  for (const [layerName, actors] of layerActors) {
    console.log(`[TownTilemapLoader] Layer "${layerName}": ${actors.length} actors`);
    allActors.push(...actors);
  }

  return allActors;
}

/**
 * Get the tilemap dimensions in pixels
 */
export function getTilemapDimensions(scale = 2): { width: number; height: number } {
  const width = cachedMapData?.width ?? TMX_WIDTH;
  const height = cachedMapData?.height ?? TMX_HEIGHT;
  const tileSize = cachedMapData?.tileWidth ?? TMX_TILE_SIZE;
  return {
    width: width * tileSize * scale,
    height: height * tileSize * scale,
  };
}

/**
 * Convert pixel position to tile coordinates
 */
export function pixelToTile(x: number, y: number, offsetX = 0, offsetY = 0, scale = 2): { tileX: number; tileY: number } {
  const tileSize = cachedMapData?.tileWidth ?? TMX_TILE_SIZE;
  const scaledTileSize = tileSize * scale;
  return {
    tileX: Math.floor((x - offsetX) / scaledTileSize),
    tileY: Math.floor((y - offsetY) / scaledTileSize),
  };
}

/**
 * Convert tile coordinates to pixel position (center of tile)
 */
export function tileToPixel(tileX: number, tileY: number, offsetX = 0, offsetY = 0, scale = 2): { x: number; y: number } {
  const tileSize = cachedMapData?.tileWidth ?? TMX_TILE_SIZE;
  const scaledTileSize = tileSize * scale;
  return {
    x: offsetX + (tileX + 0.5) * scaledTileSize,
    y: offsetY + (tileY + 0.5) * scaledTileSize,
  };
}

// Cache for collision rectangles
let cachedColliders: Array<{ x: number; y: number; width: number; height: number }> | null = null;

/**
 * Check if a pixel position is walkable on the tilemap
 * Uses the collision rectangles from the TMX file
 */
export function isPixelWalkable(x: number, y: number, offsetX = 0, offsetY = 0, scale = 2): boolean {
  if (!cachedMapData) return true;

  // Build collider cache if not already built
  if (!cachedColliders) {
    cachedColliders = getColliders(cachedMapData, scale, offsetX, offsetY);
  }

  const mapWidth = cachedMapData.width * cachedMapData.tileWidth * scale;
  const mapHeight = cachedMapData.height * cachedMapData.tileHeight * scale;

  // Out of bounds
  if (x < offsetX || x > offsetX + mapWidth || y < offsetY || y > offsetY + mapHeight) {
    return false;
  }

  // Check against collision rectangles
  for (const rect of cachedColliders) {
    if (x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height) {
      return false; // Colliding
    }
  }

  return true;
}

/**
 * Door positions from the TMX file
 */
export interface DoorPosition {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Get door positions from the map
 */
export function getTownDoorPositions(offsetX = 0, offsetY = 0, scale = 2): DoorPosition[] {
  if (!cachedMapData) return [];

  const doorsMap = getDoorPositions(cachedMapData, scale, offsetX, offsetY);
  const doors: DoorPosition[] = [];

  for (const [name, pos] of doorsMap) {
    doors.push({
      name,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
    });
  }

  return doors;
}

/**
 * Get the spawn position in pixels from the TMX file
 */
export function getSpawnPixelPosition(offsetX = 0, offsetY = 0, scale = 2): { x: number; y: number } {
  if (!cachedMapData) {
    // Fallback to center if map not loaded
    return { x: 320, y: 240 };
  }

  const spawn = getSpawnPosition(cachedMapData, scale, offsetX, offsetY);
  if (spawn) {
    return spawn;
  }

  // Fallback: center of map
  const dims = getTilemapDimensions(scale);
  return {
    x: offsetX + dims.width / 2,
    y: offsetY + dims.height / 2,
  };
}

/**
 * Clear the collider cache (call when scale or offset changes)
 */
export function clearColliderCache(): void {
  cachedColliders = null;
}

/**
 * Get the cached map data (for advanced usage)
 */
export function getCachedMapData(): MapData | null {
  return cachedMapData;
}
