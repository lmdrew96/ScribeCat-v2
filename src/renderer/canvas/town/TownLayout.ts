/**
 * TownLayout
 *
 * Defines the tile-based layout for the Cat Village town hub.
 * Includes tile types, building positions, collision data, and interaction zones.
 */

// Tile size in pixels (before scaling)
export const TILE_SIZE = 16;

// Town dimensions in tiles
export const TOWN_WIDTH = 20;
export const TOWN_HEIGHT = 15;

// Tile types
export enum TileType {
  EMPTY = 0,
  GRASS = 1,
  PATH = 2,
  WATER = 3,
  BRIDGE = 4,
  TREE = 5,
  ROCK = 6,
  FLOWER = 7,
  BUILDING_FLOOR = 8,
  WALL = 9,
  // Shore edge tiles for water
  WATER_SHORE_TL = 10,    // Top-left corner
  WATER_SHORE_T = 11,     // Top edge
  WATER_SHORE_TR = 12,    // Top-right corner
  WATER_SHORE_L = 13,     // Left edge
  WATER_SHORE_R = 14,     // Right edge
  WATER_SHORE_BL = 15,    // Bottom-left corner
  WATER_SHORE_B = 16,     // Bottom edge
  WATER_SHORE_BR = 17,    // Bottom-right corner
}

// Building IDs
export type BuildingId = 'shop' | 'inn' | 'dungeons' | 'quests' | 'home';

// Building data
export interface Building {
  id: BuildingId;
  name: string;
  x: number; // Tile X
  y: number; // Tile Y
  width: number; // Width in tiles
  height: number; // Height in tiles
  doorX: number; // Door position X
  doorY: number; // Door position Y
  icon: string;
  color: string;
}

// Interaction zone (area in front of building door)
export interface InteractionZone {
  buildingId: BuildingId;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Town buildings configuration
export const BUILDINGS: Building[] = [
  {
    id: 'shop',
    name: 'Shop',
    x: 2,
    y: 2,
    width: 4,
    height: 3,
    doorX: 4,
    doorY: 5,
    icon: '🏪',
    color: '#4ade80',
  },
  {
    id: 'inn',
    name: 'Inn',
    x: 2,
    y: 8,
    width: 4,
    height: 3,
    doorX: 4,
    doorY: 11,
    icon: '🏨',
    color: '#f472b6',
  },
  {
    id: 'dungeons',
    name: 'Dungeons',
    x: 14,
    y: 2,
    width: 4,
    height: 3,
    doorX: 15,
    doorY: 5,
    icon: '⚔️',
    color: '#ef4444',
  },
  {
    id: 'quests',
    name: 'Quest Board',
    x: 14,
    y: 8,
    width: 4,
    height: 3,
    doorX: 15,
    doorY: 11,
    icon: '📋',
    color: '#fbbf24',
  },
  {
    id: 'home',
    name: 'Home',
    x: 8,
    y: 11,
    width: 4,
    height: 3,
    doorX: 10,
    doorY: 14,
    icon: '🏠',
    color: '#60a5fa',
  },
];

// Generate interaction zones from buildings
export const INTERACTION_ZONES: InteractionZone[] = BUILDINGS.map((b) => ({
  buildingId: b.id,
  x: b.doorX - 1,
  y: b.doorY,
  width: 3,
  height: 2,
}));

// Tile color mapping for rendering (fallback if images not loaded)
export const TILE_COLORS: Record<TileType, string> = {
  [TileType.EMPTY]: '#1a1a2e',
  [TileType.GRASS]: '#2d5016',
  [TileType.PATH]: '#8b7355',
  [TileType.WATER]: '#1e40af',
  [TileType.BRIDGE]: '#92400e',
  [TileType.TREE]: '#166534',
  [TileType.ROCK]: '#6b7280',
  [TileType.FLOWER]: '#4ade80',
  [TileType.BUILDING_FLOOR]: '#4a4a6a',
  [TileType.WALL]: '#374151',
  // Shore tiles (same blue as water for fallback)
  [TileType.WATER_SHORE_TL]: '#1e40af',
  [TileType.WATER_SHORE_T]: '#1e40af',
  [TileType.WATER_SHORE_TR]: '#1e40af',
  [TileType.WATER_SHORE_L]: '#1e40af',
  [TileType.WATER_SHORE_R]: '#1e40af',
  [TileType.WATER_SHORE_BL]: '#1e40af',
  [TileType.WATER_SHORE_B]: '#1e40af',
  [TileType.WATER_SHORE_BR]: '#1e40af',
};

// Base path for Kenney Tiny Town tiles (from dist/renderer/ to project root assets)
const TOWN_TILE_BASE = '../../assets/tiles/Tiny Town/';

// Base path for water/grass tiles
const WATER_TILE_BASE = '../../assets/tiles/GrassWaterTiles/';

// Kenney Tiny Town tile mapping using actual asset file names
// Tiles are 16x16 pixels
export const TILE_IMAGES: Partial<Record<TileType, string>> = {
  [TileType.GRASS]: `${WATER_TILE_BASE}grass_center.png`,              // Grass center
  [TileType.PATH]: `${TOWN_TILE_BASE}stone_path.png`,                  // Stone path/road
  [TileType.WATER]: `${WATER_TILE_BASE}water_mid.png`,                 // Solid water center
  [TileType.BRIDGE]: `${TOWN_TILE_BASE}mid_rail.png`,                  // Bridge/planks
  [TileType.TREE]: `${TOWN_TILE_BASE}green_tree_top.png`,              // Tree
  [TileType.ROCK]: `${TOWN_TILE_BASE}pot.png`,                         // Rock/stone (using pot as placeholder)
  [TileType.FLOWER]: `${WATER_TILE_BASE}flower_grass_center.png`,      // Flower/bush
  [TileType.BUILDING_FLOOR]: `${TOWN_TILE_BASE}stone_path.png`,        // Door mat (reuse stone path)
  // Shore edge tiles (GrassWaterTiles)
  [TileType.WATER_SHORE_TL]: `${WATER_TILE_BASE}water_top_left.png`,   // Top-left corner
  [TileType.WATER_SHORE_T]: `${WATER_TILE_BASE}water_top_mid.png`,     // Top edge
  [TileType.WATER_SHORE_TR]: `${WATER_TILE_BASE}water_top right.png`,  // Top-right corner (note space in filename)
  [TileType.WATER_SHORE_L]: `${WATER_TILE_BASE}water_mid_left.png`,    // Left edge
  [TileType.WATER_SHORE_R]: `${WATER_TILE_BASE}water_mid_right.png`,   // Right edge
  [TileType.WATER_SHORE_BL]: `${WATER_TILE_BASE}water_bottom_left.png`,  // Bottom-left corner
  [TileType.WATER_SHORE_B]: `${WATER_TILE_BASE}water_bottom_mid.png`,    // Bottom edge
  [TileType.WATER_SHORE_BR]: `${WATER_TILE_BASE}water_bottom_right.png`, // Bottom-right corner
};

// Building sprites using actual asset file names
export const BUILDING_TILES = {
  // Wall tiles
  wallStone: `${TOWN_TILE_BASE}mid_stone_wall.png`,
  wallWood: `${TOWN_TILE_BASE}mid_wood_wall.png`,

  // Roof tiles
  roofBlue: `${TOWN_TILE_BASE}mid_castle_roof.png`,
  roofBrown: `${TOWN_TILE_BASE}mid_wood_roof.png`,
  roofOrange: `${TOWN_TILE_BASE}mid_stone_roof.png`,

  // Door tiles
  doorWood: `${TOWN_TILE_BASE}wood_door.png`,
  doorOpen: `${TOWN_TILE_BASE}wood_doorway.png`,

  // Window tiles
  window: `${TOWN_TILE_BASE}wood_window.png`,

  // Signs
  signShop: `${TOWN_TILE_BASE}sign.png`,
  signInn: `${TOWN_TILE_BASE}sign.png`,
};

// Props/decorations using actual asset file names
export const PROP_TILES = {
  barrel: `${TOWN_TILE_BASE}pot.png`,
  crate: `${TOWN_TILE_BASE}log.png`,
  fence: `${TOWN_TILE_BASE}mid_fence.png`,
  lamp: `${TOWN_TILE_BASE}coin.png`,  // Using coin as placeholder (no lamp available)
};

// List of all tile images to preload
export function getTilesToPreload(): string[] {
  const tiles: string[] = [];

  // Add base tile images
  Object.values(TILE_IMAGES).forEach(path => {
    if (path) tiles.push(path);
  });

  // Add building tiles
  Object.values(BUILDING_TILES).forEach(path => {
    tiles.push(path);
  });

  // Add prop tiles
  Object.values(PROP_TILES).forEach(path => {
    tiles.push(path);
  });

  return tiles;
}

// Walkable tiles (not blocked)
export const WALKABLE_TILES = new Set([
  TileType.GRASS,
  TileType.PATH,
  TileType.BRIDGE,
  TileType.FLOWER,
  TileType.BUILDING_FLOOR,
]);

/**
 * Generate the town tilemap
 */
export function generateTownTilemap(): TileType[][] {
  // Initialize with grass
  const tilemap: TileType[][] = Array(TOWN_HEIGHT)
    .fill(null)
    .map(() => Array(TOWN_WIDTH).fill(TileType.GRASS));

  // Add water/pond in the center with proper shore tiles
  // Row 5 (top): shore edges
  tilemap[5][8] = TileType.WATER_SHORE_TL;
  tilemap[5][9] = TileType.WATER_SHORE_T;
  tilemap[5][10] = TileType.WATER_SHORE_T;
  tilemap[5][11] = TileType.WATER_SHORE_TR;

  // Row 6 (middle): left/right edges with center water (will be overwritten by bridge)
  tilemap[6][8] = TileType.WATER_SHORE_L;
  tilemap[6][9] = TileType.WATER;
  tilemap[6][10] = TileType.WATER;
  tilemap[6][11] = TileType.WATER_SHORE_R;

  // Row 7 (bottom): shore edges
  tilemap[7][8] = TileType.WATER_SHORE_BL;
  tilemap[7][9] = TileType.WATER_SHORE_B;
  tilemap[7][10] = TileType.WATER_SHORE_B;
  tilemap[7][11] = TileType.WATER_SHORE_BR;

  // Add main paths
  // Horizontal paths
  for (let x = 0; x < TOWN_WIDTH; x++) {
    tilemap[6][x] = tilemap[6][x] === TileType.WATER ? tilemap[6][x] : TileType.PATH;
  }
  // Fix bridge over water
  tilemap[6][8] = TileType.BRIDGE;
  tilemap[6][9] = TileType.BRIDGE;
  tilemap[6][10] = TileType.BRIDGE;
  tilemap[6][11] = TileType.BRIDGE;

  // Vertical paths to buildings
  for (let y = 0; y < 6; y++) {
    tilemap[y][4] = TileType.PATH; // Left buildings
    tilemap[y][15] = TileType.PATH; // Right buildings
  }
  for (let y = 7; y < TOWN_HEIGHT; y++) {
    tilemap[y][4] = TileType.PATH;
    tilemap[y][15] = TileType.PATH;
  }

  // Path to home
  for (let y = 7; y < TOWN_HEIGHT; y++) {
    tilemap[y][10] = TileType.PATH;
  }

  // Add trees around edges
  const treePositions = [
    [0, 0], [1, 0], [18, 0], [19, 0],
    [0, 1], [19, 1],
    [0, 4], [1, 4], [18, 4], [19, 4],
    [0, 9], [1, 9], [18, 9], [19, 9],
    [0, 14], [19, 14],
    [7, 4], [12, 4],
    [7, 9], [12, 9],
  ];
  for (const [x, y] of treePositions) {
    if (y < TOWN_HEIGHT && x < TOWN_WIDTH) {
      tilemap[y][x] = TileType.TREE;
    }
  }

  // Add rocks
  const rockPositions = [
    [6, 4], [13, 4],
    [6, 9], [13, 9],
  ];
  for (const [x, y] of rockPositions) {
    if (y < TOWN_HEIGHT && x < TOWN_WIDTH) {
      tilemap[y][x] = TileType.ROCK;
    }
  }

  // Add flowers (decorative)
  const flowerPositions = [
    [3, 7], [16, 7],
    [7, 12], [12, 12],
  ];
  for (const [x, y] of flowerPositions) {
    if (y < TOWN_HEIGHT && x < TOWN_WIDTH) {
      tilemap[y][x] = TileType.FLOWER;
    }
  }

  // Add building areas (walls)
  for (const building of BUILDINGS) {
    for (let by = building.y; by < building.y + building.height; by++) {
      for (let bx = building.x; bx < building.x + building.width; bx++) {
        if (by < TOWN_HEIGHT && bx < TOWN_WIDTH) {
          tilemap[by][bx] = TileType.WALL;
        }
      }
    }
    // Add floor at door
    tilemap[building.doorY][building.doorX] = TileType.BUILDING_FLOOR;
  }

  return tilemap;
}

// Pre-generate the tilemap
export const TOWN_TILEMAP = generateTownTilemap();

/**
 * Check if a tile position is walkable
 */
export function isWalkable(x: number, y: number): boolean {
  if (x < 0 || x >= TOWN_WIDTH || y < 0 || y >= TOWN_HEIGHT) {
    return false;
  }
  return WALKABLE_TILES.has(TOWN_TILEMAP[y][x]);
}

/**
 * Get building at a tile position (if any)
 */
export function getBuildingAt(x: number, y: number): Building | null {
  for (const building of BUILDINGS) {
    if (
      x >= building.x &&
      x < building.x + building.width &&
      y >= building.y &&
      y < building.y + building.height
    ) {
      return building;
    }
  }
  return null;
}

/**
 * Get interaction zone at position (if player can interact with building)
 */
export function getInteractionZone(x: number, y: number): InteractionZone | null {
  for (const zone of INTERACTION_ZONES) {
    if (
      x >= zone.x &&
      x < zone.x + zone.width &&
      y >= zone.y &&
      y < zone.y + zone.height
    ) {
      return zone;
    }
  }
  return null;
}

/**
 * Get building by ID
 */
export function getBuildingById(id: BuildingId): Building | null {
  return BUILDINGS.find((b) => b.id === id) || null;
}

/**
 * Get spawn position (center of town, on path)
 */
export function getSpawnPosition(): { x: number; y: number } {
  return { x: 10, y: 6 }; // Center of town on the main path
}
