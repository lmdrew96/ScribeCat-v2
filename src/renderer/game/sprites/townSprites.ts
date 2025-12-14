/**
 * Town Sprites Module
 *
 * Loads and composes building sprites from the Tiny Town tileset.
 * Supports loading buildings from TMX tilemap files.
 * Each tile is 16x16 pixels, rendered at 2x scale (32x32) for the game.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';

const TILES_BASE = '../../assets/Tiles/Tiny Town';
const TILEMAPS_BASE = '../../assets/MAPS/Tile Maps';
const TSX_FILE = '../../assets/Tiles/Tiny Town/TinyTownTiles.tsx';
const TILE_SIZE = 16;
const TILE_SCALE = 2;
const SCALED_TILE = TILE_SIZE * TILE_SCALE; // 32px

// TMX file mappings for buildings
const BUILDING_TMX_FILES: Record<string, string> = {
  home: 'house1.tmx',
  shop: 'house3.tmx',     // Blue roof for shop
  inn: 'house2.tmx',       // Orange roof for inn
  dungeon: 'dungeon1.tmx',
};

// Decoration TMX files (optional - map to existing files)
const DECORATION_TMX_FILES: Record<string, string> = {
  tree_patch: 'tiny_tree_cluster_green.tmx',
  pond_big: 'its_grass.tmx', // Fallback - no pond TMX exists
  pond_small: 'its_grass.tmx', // Fallback - no pond TMX exists
};

// Cache for parsed TMX data
const tmxCache: Map<string, ParsedTMX> = new Map();

// Cache for tile ID to filename mapping (from TSX file)
const tileIdToFilename: Map<number, string> = new Map();
let tsxParsed = false;

interface ParsedTMX {
  width: number;
  height: number;
  tiles: number[][]; // 0-based tile IDs
  tileset: string;   // Tileset name (for determining which tiles to load)
}

/**
 * Tiny Town tile IDs mapped by category.
 * These IDs come from TinyTownTiles.tsx tileset file.
 */
export const TOWN_TILES = {
  // Paths and ground
  PATH_STONE: 76,      // stone_path.png
  PATH_DIRT: 47,       // mid_dirt.png

  // Trees - Green
  TREE_GREEN_TOP: 33,  // green_tree_top.png
  TREE_GREEN_BOTTOM: 32, // green_tree_bottom.png

  // Trees - Yellow/Autumn
  TREE_YELLOW_TOP: 128,  // yellow_tree_top.png
  TREE_YELLOW_BOTTOM: 127, // yellow_tree_bottom.png

  // Small decorative trees and bushes
  TREE_SMALL_GREEN: 41,  // lil_green_tree.png
  TREE_SMALL_YELLOW: 43, // lil_yellow_tree.png
  SPROUT: 42,            // lil_sprout.png
  SHRUB: 71,             // shrub.png

  // Wood roofs
  ROOF_WOOD_TOP_LEFT: 89,   // top_left_wood_roof.png
  ROOF_WOOD_TOP_MID: 93,    // top_mid_wood_roof.png
  ROOF_WOOD_TOP_RIGHT: 100, // top_right_wood_roof.png
  ROOF_WOOD_BOT_LEFT: 12,   // bottom_left_wood_roof.png
  ROOF_WOOD_BOT_MID: 16,    // bottom_mid_wood_roof.png
  ROOF_WOOD_BOT_RIGHT: 22,  // bottom_right_wood_roof.png
  ROOF_WOOD_CHIMNEY: 124,   // wood_roof_chimney.png
  ROOF_WOOD_POINT: 125,     // wood_roof_point.png

  // Stone roofs
  ROOF_STONE_TOP_LEFT: 88,  // top_left_stone_roof.png
  ROOF_STONE_TOP_MID: 92,   // top_mid_stone_roof.png
  ROOF_STONE_TOP_RIGHT: 1,  // top_right_stone_roof.png
  ROOF_STONE_BOT_LEFT: 11,  // bottom_left_stone_roof.png
  ROOF_STONE_BOT_MID: 15,   // bottom_mid_stone_roof.png
  ROOF_STONE_BOT_RIGHT: 21, // bottom_right_stone_roof.png
  ROOF_STONE_CHIMNEY: 77,   // stone_roof_chimney.png
  ROOF_STONE_POINT: 78,     // stone_roof_point.png

  // Wood walls
  WALL_WOOD_LEFT: 40,   // left_wood_wall.png
  WALL_WOOD_MID: 58,    // mid_wood_wall.png
  WALL_WOOD_RIGHT: 69,  // right_wood_wall.png
  WALL_WOOD_WINDOW: 126, // wood_window.png
  DOOR_WOOD: 122,       // wood_door.png
  DOOR_WOOD_FRAME: 123, // wood_doorway.png
  DOOR_WOOD_LEFT: 39,   // left_wood_door.png
  DOOR_WOOD_RIGHT: 68,  // right_wood_door.png

  // Stone walls
  WALL_STONE_LEFT: 0,   // left_stone_wall.png
  WALL_STONE_MID: 56,   // mid_stone_wall.png
  WALL_STONE_RIGHT: 67, // right_stone_wall.png
  WALL_STONE_WINDOW: 79, // stone_window.png
  DOOR_STONE: 74,       // stone_door.png
  DOOR_STONE_FRAME: 75, // stone_doorway.png
  DOOR_STONE_LEFT: 38,  // left_stone_door.png
  DOOR_STONE_RIGHT: 66, // right_stone_door.png

  // Castle
  CASTLE_ROOF_TOP_LEFT: 84,  // top_left_castle_roof.png
  CASTLE_ROOF_TOP_MID: 90,   // top_mid_castle_roof.png
  CASTLE_ROOF_TOP_RIGHT: 96, // top_right_castle_roof.png
  CASTLE_ROOF_MID_LEFT: 49,  // mid_left_castle_roof.png
  CASTLE_ROOF_MID_RIGHT: 53, // mid_right_castle_roof.png
  CASTLE_ROOF_BOT_LEFT: 7,   // bottom_left_castle_roof.png
  CASTLE_ROOF_BOT_MID: 13,   // bottom_mid_castle_roof.png
  CASTLE_ROOF_BOT_RIGHT: 17, // bottom_right_castle_roof.png
  CASTLE_SPIRE: 26,          // castle_spire.png
  CASTLE_BRICKS: 24,         // castle_bricks.png
  CASTLE_WINDOW: 27,         // castle_window.png
  CASTLE_LADDER: 25,         // castle_ladder.png
  CASTLE_DECK_LEFT: 35,      // left_castle_deck.png
  CASTLE_DECK_MID: 45,       // mid_castle_deck.png
  CASTLE_DECK_RIGHT: 63,     // right_castle_deck.png
  CASTLE_DOOR_LEFT: 36,      // left_castle_door_frame.png
  CASTLE_DOOR_RIGHT: 64,     // right_castle_door_frame.png
  CASTLE_GATE_TOP_LEFT: 83,  // top_left_castle_gate.png
  CASTLE_GATE_TOP_RIGHT: 95, // top_right_castle_gate.png

  // Fences
  FENCE_TOP: 81,             // top_fence.png
  FENCE_BOTTOM: 6,           // bottom_fence.png
  FENCE_MID: 48,             // mid_fence.png
  FENCE_MID_LEFT: 51,        // mid_left_fence.png
  FENCE_MID_RIGHT: 55,       // mid_right_fence.png
  FENCE_TOP_LEFT: 85,        // top_left_corner_fence.png
  FENCE_TOP_RIGHT: 98,       // top_right_fence.png
  FENCE_BOT_LEFT: 8,         // bottom_left_corner_fence.png
  FENCE_BOT_RIGHT: 18,       // bottom_right_corner_fence.png
  FENCE_JOIN: 30,            // fences_join.png
  FENCE_VERTICAL: 57,        // mid_vertical_fence.png

  // Rails
  RAIL_LEFT: 37,  // left_rail.png
  RAIL_MID: 52,   // mid_rail.png
  RAIL_RIGHT: 65, // right_rail.png

  // Decorations
  WELL_BASE: 120,   // well_base.png
  WELL_ROOF: 121,   // well_roof.png
  SIGN: 73,         // sign.png
  MUSHROOMS: 59,    // mushrooms.png
  LOG: 44,          // log.png
  POT: 62,          // pot.png
  WAGON: 119,       // wagon.png
  BUCKET_EMPTY: 29, // empty_bucket.png
  BUCKET_FULL: 31,  // full_bucket.png

  // Items/weapons
  COIN: 28,      // coin.png
  KEY: 34,       // key.png
  ARROW: 2,      // arrow.png
  BOW: 23,       // bow.png
  BATTLEAXE: 3,  // battleaxe.png
  PICKAXE: 60,   // pickaxe.png
  PITCHFORK: 61, // pitchfork.png
  SHOVEL: 70,    // shovel.png
  SICKLE: 72,    // sickle.png
  BOMB: 5,       // bomb.png
  BEE_HIVE: 4,   // bee_hive.png
  TARGET: 80,    // target.png
};

// Building type definitions
export type BuildingType = 'home' | 'shop' | 'inn' | 'dungeon';

// Label colors for each building type (used for UI)
export const BUILDING_LABEL_COLORS: Record<BuildingType, [number, number, number]> = {
  home: [139, 90, 43],
  shop: [70, 130, 180],
  inn: [178, 34, 34],
  dungeon: [75, 0, 130],
};

// Track loaded tiles to avoid reloading
const loadedTiles = new Set<number>();

/**
 * Parse a simple single-layer TMX file content
 * TMX tile IDs are 1-based (0 means empty), we convert to 0-based
 */
function parseSimpleTMX(tmxContent: string): ParsedTMX {
  // Extract map dimensions
  const widthMatch = tmxContent.match(/width="(\d+)"/);
  const heightMatch = tmxContent.match(/height="(\d+)"/);
  const width = widthMatch ? parseInt(widthMatch[1]) : 0;
  const height = heightMatch ? parseInt(heightMatch[1]) : 0;

  // Extract tileset name
  const tilesetMatch = tmxContent.match(/source="[^"]*\/([^/"]+)\.tsx"/);
  const tileset = tilesetMatch ? tilesetMatch[1] : 'TinyTownTiles';

  // Extract CSV data
  const dataMatch = tmxContent.match(/<data encoding="csv">\s*([\s\S]*?)\s*<\/data>/);
  const csvData = dataMatch ? dataMatch[1].trim() : '';

  // Parse CSV to 2D array (convert 1-based to 0-based, 0 stays as -1 for empty)
  const tiles: number[][] = [];
  const rows = csvData.split('\n');
  for (const row of rows) {
    const tileRow: number[] = [];
    const cells = row.split(',').filter(c => c.trim() !== '');
    for (const cell of cells) {
      const tmxId = parseInt(cell.trim());
      // TMX uses 1-based IDs, 0 means empty tile
      tileRow.push(tmxId > 0 ? tmxId - 1 : -1);
    }
    if (tileRow.length > 0) {
      tiles.push(tileRow);
    }
  }

  return { width, height, tiles, tileset };
}

/**
 * Fetch and parse a TMX file
 */
async function loadTMXFile(filename: string): Promise<ParsedTMX | null> {
  // Check cache first
  if (tmxCache.has(filename)) {
    return tmxCache.get(filename)!;
  }

  try {
    const response = await fetch(`${TILEMAPS_BASE}/${filename}`);
    if (!response.ok) {
      console.warn(`Failed to load TMX file: ${filename}`);
      return null;
    }
    const content = await response.text();
    const parsed = parseSimpleTMX(content);
    tmxCache.set(filename, parsed);
    return parsed;
  } catch (err) {
    console.warn(`Error loading TMX file ${filename}:`, err);
    return null;
  }
}

/**
 * Parse the TSX tileset file to get tile ID → filename mapping
 */
async function parseTSXFile(): Promise<void> {
  if (tsxParsed) return;

  try {
    const response = await fetch(TSX_FILE);
    if (!response.ok) {
      console.warn('Failed to load TSX file, will use fallback tile names');
      return;
    }
    const content = await response.text();

    // Parse all tile definitions: <tile id="X"><image source="filename.png".../>
    const tileRegex = /<tile id="(\d+)">\s*<image source="([^"]+)"/g;
    let match;
    while ((match = tileRegex.exec(content)) !== null) {
      const tileId = parseInt(match[1]);
      const filename = match[2];
      tileIdToFilename.set(tileId, filename);
    }

    tsxParsed = true;
    console.log(`Parsed TSX file: ${tileIdToFilename.size} tiles mapped`);
  } catch (err) {
    console.warn('Error parsing TSX file:', err);
  }
}

/**
 * Get the sprite name for a tile ID
 */
function getTileSpriteName(tileId: number): string {
  return `town_tile_${tileId}`;
}

/**
 * Get the file path for a tile ID using the TSX mapping
 */
function getTileFilePath(tileId: number): string {
  const filename = tileIdToFilename.get(tileId);
  if (filename) {
    return `${TILES_BASE}/${filename}`;
  }
  // Fallback to numbered format (shouldn't happen if TSX is parsed)
  return `${TILES_BASE}/tile_${tileId.toString().padStart(4, '0')}.png`;
}

/**
 * Load a single tile sprite
 */
async function loadTile(k: KAPLAYCtx, tileId: number): Promise<void> {
  if (loadedTiles.has(tileId) || tileId < 0) return;

  const spriteName = getTileSpriteName(tileId);
  const filePath = getTileFilePath(tileId);

  try {
    await k.loadSprite(spriteName, filePath);
    loadedTiles.add(tileId);
  } catch (err) {
    console.warn(`Failed to load tile ${tileId} from ${filePath}:`, err);
  }
}

/**
 * Load all tiles needed for town buildings and decorations
 */
export async function loadTownTiles(k: KAPLAYCtx): Promise<void> {
  // First, parse the TSX file to get tile ID → filename mapping
  await parseTSXFile();

  const tilesToLoad = new Set<number>();

  // Load TMX files and collect their tile IDs
  const tmxPromises = Object.values(BUILDING_TMX_FILES).map(async (filename) => {
    const tmx = await loadTMXFile(filename);
    if (tmx) {
      for (const row of tmx.tiles) {
        for (const tileId of row) {
          if (tileId >= 0) tilesToLoad.add(tileId);
        }
      }
    }
  });

  // Also load decoration TMX files
  const decorTmxPromises = Object.values(DECORATION_TMX_FILES).map(async (filename) => {
    const tmx = await loadTMXFile(filename);
    if (tmx) {
      for (const row of tmx.tiles) {
        for (const tileId of row) {
          if (tileId >= 0) tilesToLoad.add(tileId);
        }
      }
    }
  });

  await Promise.all([...tmxPromises, ...decorTmxPromises]);

  // Add decoration tiles (for non-TMX decorations)
  const decorationTiles = [
    TOWN_TILES.TREE_GREEN_TOP,
    TOWN_TILES.TREE_GREEN_BOTTOM,
    TOWN_TILES.TREE_YELLOW_TOP,
    TOWN_TILES.TREE_YELLOW_BOTTOM,
    TOWN_TILES.TREE_SMALL_GREEN,
    TOWN_TILES.TREE_SMALL_YELLOW,
    TOWN_TILES.SHRUB,
    TOWN_TILES.SPROUT,
    TOWN_TILES.FENCE_TOP,
    TOWN_TILES.FENCE_MID,
    TOWN_TILES.FENCE_BOTTOM,
    TOWN_TILES.PATH_STONE,
    TOWN_TILES.PATH_DIRT,
    TOWN_TILES.MUSHROOMS,
    TOWN_TILES.WELL_BASE,
    TOWN_TILES.WELL_ROOF,
    TOWN_TILES.SIGN,
  ];

  for (const tileId of decorationTiles) {
    tilesToLoad.add(tileId);
  }

  // Load all tiles in parallel
  await Promise.all(Array.from(tilesToLoad).map((tileId) => loadTile(k, tileId)));

  console.log(`Loaded ${tilesToLoad.size} town tiles`);
}

export interface TiledBuildingResult {
  tileEntities: GameObj[];
  shadowEntity: GameObj;
  width: number;
  height: number;
  doorX: number;
  doorY: number;
  destroy: () => void;
}

/**
 * Create a building composed of tiles from TMX tilemap data
 *
 * @param k - KAPLAY context
 * @param type - Building type
 * @param x - Center X position
 * @param y - Ground Y position (bottom of building)
 * @param baseZ - Base Z index
 */
export function createTiledBuilding(
  k: KAPLAYCtx,
  type: BuildingType,
  x: number,
  y: number,
  baseZ = 3
): TiledBuildingResult {
  // Get TMX data for this building type
  const tmxFilename = BUILDING_TMX_FILES[type];
  const tmxData = tmxFilename ? tmxCache.get(tmxFilename) : null;

  if (!tmxData || tmxData.tiles.length === 0) {
    console.warn(`No TMX data for ${type} building, creating placeholder`);
    // Create a simple placeholder building
    const placeholderEntity = k.add([
      k.rect(96, 128),
      k.pos(x - 48, y - 128),
      k.color(...BUILDING_LABEL_COLORS[type]),
      k.outline(2, k.rgb(0, 0, 0)),
      k.z(baseZ),
      'building-placeholder',
    ]);
    const shadowEntity = k.add([
      k.rect(104, 40),
      k.pos(x - 52, y - 40),
      k.color(0, 0, 0),
      k.opacity(0.3),
      k.z(baseZ - 1),
      'building-shadow',
    ]);
    return {
      tileEntities: [placeholderEntity],
      shadowEntity,
      width: 96,
      height: 128,
      doorX: x,
      doorY: y - 16,
      destroy(): void {
        if (placeholderEntity.exists()) k.destroy(placeholderEntity);
        if (shadowEntity.exists()) k.destroy(shadowEntity);
      },
    };
  }

  const tiles = tmxData.tiles;
  // For TMX buildings, door is typically at bottom center
  const tmxCols = tmxData.tiles[0]?.length || 1;
  const doorOffset = { x: Math.floor(tmxCols / 2), y: tmxData.tiles.length - 1 };
  console.log(`Using TMX data for ${type} building (${tmxData.width}x${tmxData.height})`);

  const rows = tiles.length;
  const cols = tiles[0].length;

  const buildingWidth = cols * SCALED_TILE;
  const buildingHeight = rows * SCALED_TILE;

  // Calculate top-left corner from center X and ground Y
  const startX = x - buildingWidth / 2;
  const startY = y - buildingHeight;

  const tileEntities: GameObj[] = [];

  // Create shadow first (underneath building)
  const shadowEntity = k.add([
    k.rect(buildingWidth + 8, buildingHeight / 3),
    k.pos(startX - 4, y - buildingHeight / 6),
    k.color(0, 0, 0),
    k.opacity(0.3),
    k.z(baseZ - 1),
    'building-shadow',
  ]);

  // Create tile entities
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tileId = tiles[row][col];

      // Skip empty tiles (TMX uses -1 for empty after our conversion)
      if (tileId < 0) continue;

      const spriteName = getTileSpriteName(tileId);

      const tileX = startX + col * SCALED_TILE;
      const tileY = startY + row * SCALED_TILE;

      const entity = k.add([
        k.sprite(spriteName),
        k.pos(tileX, tileY),
        k.scale(TILE_SCALE),
        k.z(baseZ + row), // Higher rows have higher Z for depth
        'building-tile',
      ]);

      tileEntities.push(entity);
    }
  }

  // Calculate door position (center of door tile)
  const doorX = startX + doorOffset.x * SCALED_TILE + SCALED_TILE / 2;
  const doorY = startY + doorOffset.y * SCALED_TILE + SCALED_TILE / 2;

  return {
    tileEntities,
    shadowEntity,
    width: buildingWidth,
    height: buildingHeight,
    doorX,
    doorY,
    destroy(): void {
      for (const entity of tileEntities) {
        if (entity.exists()) k.destroy(entity);
      }
      if (shadowEntity.exists()) k.destroy(shadowEntity);
    },
  };
}

export type DecorationType = 'tree_green' | 'tree_yellow' | 'tree_small' | 'bush' | 'fence_h' | 'mushroom' | 'well' | 'sign';

interface DecorationDef {
  tiles: number[][]; // Can be single tile or multi-tile
}

const DECORATION_DEFS: Record<DecorationType, DecorationDef> = {
  tree_green: {
    tiles: [
      [TOWN_TILES.TREE_GREEN_TOP],
      [TOWN_TILES.TREE_GREEN_BOTTOM],
    ],
  },
  tree_yellow: {
    tiles: [
      [TOWN_TILES.TREE_YELLOW_TOP],
      [TOWN_TILES.TREE_YELLOW_BOTTOM],
    ],
  },
  tree_small: {
    tiles: [[TOWN_TILES.TREE_SMALL_GREEN]],
  },
  bush: {
    tiles: [[TOWN_TILES.SHRUB]],
  },
  fence_h: {
    tiles: [[TOWN_TILES.FENCE_MID_LEFT, TOWN_TILES.FENCE_MID, TOWN_TILES.FENCE_MID_RIGHT]],
  },
  mushroom: {
    tiles: [[TOWN_TILES.MUSHROOMS]],
  },
  well: {
    tiles: [
      [TOWN_TILES.WELL_ROOF],
      [TOWN_TILES.WELL_BASE],
    ],
  },
  sign: {
    tiles: [[TOWN_TILES.SIGN]],
  },
};

export interface DecorationResult {
  entities: GameObj[];
  destroy: () => void;
}

/**
 * Create a decorative element
 */
export function createDecoration(
  k: KAPLAYCtx,
  type: DecorationType,
  x: number,
  y: number,
  baseZ = 4
): DecorationResult {
  const def = DECORATION_DEFS[type];
  const entities: GameObj[] = [];

  const rows = def.tiles.length;
  const cols = def.tiles[0].length;

  // Position from bottom-center
  const startX = x - (cols * SCALED_TILE) / 2;
  const startY = y - rows * SCALED_TILE;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tileId = def.tiles[row][col];
      const spriteName = getTileSpriteName(tileId);

      const tileX = startX + col * SCALED_TILE;
      const tileY = startY + row * SCALED_TILE;

      const entity = k.add([
        k.sprite(spriteName),
        k.pos(tileX, tileY),
        k.scale(TILE_SCALE),
        k.z(baseZ + row),
        'decoration',
      ]);

      entities.push(entity);
    }
  }

  return {
    entities,
    destroy(): void {
      for (const entity of entities) {
        if (entity.exists()) k.destroy(entity);
      }
    },
  };
}

/**
 * Create a tiled path
 */
export function createTiledPath(
  k: KAPLAYCtx,
  startX: number,
  y: number,
  width: number,
  baseZ = 5
): GameObj[] {
  const entities: GameObj[] = [];
  const tilesNeeded = Math.ceil(width / SCALED_TILE);

  for (let i = 0; i < tilesNeeded; i++) {
    // Alternate between path tiles for variety
    const tileId = i % 2 === 0 ? TOWN_TILES.PATH_STONE : TOWN_TILES.PATH_DIRT;
    const spriteName = getTileSpriteName(tileId);

    const entity = k.add([
      k.sprite(spriteName),
      k.pos(startX + i * SCALED_TILE, y),
      k.scale(TILE_SCALE),
      k.z(baseZ),
      'path-tile',
    ]);

    entities.push(entity);
  }

  return entities;
}

export type TMXDecorationType = 'tree_patch' | 'pond_big' | 'pond_small';

/**
 * Create a decoration from a TMX tilemap file
 * Used for multi-tile decorations like tree clusters and ponds
 */
export function createTMXDecoration(
  k: KAPLAYCtx,
  type: TMXDecorationType,
  x: number,
  y: number,
  baseZ = 4
): DecorationResult {
  const tmxFilename = DECORATION_TMX_FILES[type];
  const tmxData = tmxFilename ? tmxCache.get(tmxFilename) : null;
  const entities: GameObj[] = [];

  if (!tmxData || tmxData.tiles.length === 0) {
    console.warn(`TMX decoration ${type} not loaded, skipping`);
    return {
      entities,
      destroy(): void {},
    };
  }

  const rows = tmxData.tiles.length;
  const cols = tmxData.tiles[0]?.length || 0;

  // Position from bottom-center
  const startX = x - (cols * SCALED_TILE) / 2;
  const startY = y - rows * SCALED_TILE;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tileId = tmxData.tiles[row][col];

      // Skip empty tiles
      if (tileId < 0) continue;

      const spriteName = getTileSpriteName(tileId);

      const tileX = startX + col * SCALED_TILE;
      const tileY = startY + row * SCALED_TILE;

      const entity = k.add([
        k.sprite(spriteName),
        k.pos(tileX, tileY),
        k.scale(TILE_SCALE),
        k.z(baseZ + row),
        'tmx-decoration',
      ]);

      entities.push(entity);
    }
  }

  console.log(`Created TMX decoration ${type} (${cols}x${rows} tiles)`);

  return {
    entities,
    destroy(): void {
      for (const entity of entities) {
        if (entity.exists()) k.destroy(entity);
      }
    },
  };
}

export { TILE_SIZE, TILE_SCALE, SCALED_TILE };
