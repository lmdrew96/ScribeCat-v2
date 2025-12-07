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
};

// Base path for Kenney town tiles
// From src/renderer/canvas/town/ to project root assets
const TOWN_TILE_BASE = '../../../../assets/sprites/studyquest/kenney/town/';

// Kenney Tiny Town tile mapping (based on preview layout)
// Row 0: Grass, Row 1: Trees, Row 2: Roofs, Row 3: Fences
// Row 4-5: Walls, Row 6: Paths, Row 7: Water/Bridge, Row 8-9: Props
// Tiles are 16x16 pixels
export const TILE_IMAGES: Partial<Record<TileType, string>> = {
  [TileType.GRASS]: `${TOWN_TILE_BASE}tile_0000.png`,    // Grass center (Row 0)
  [TileType.PATH]: `${TOWN_TILE_BASE}tile_0072.png`,     // Path/road tile (Row 6)
  [TileType.WATER]: `${TOWN_TILE_BASE}tile_0084.png`,    // Water tile (Row 7)
  [TileType.BRIDGE]: `${TOWN_TILE_BASE}tile_0088.png`,   // Bridge/planks (Row 7)
  [TileType.TREE]: `${TOWN_TILE_BASE}tile_0012.png`,     // Tree (Row 1)
  [TileType.ROCK]: `${TOWN_TILE_BASE}tile_0108.png`,     // Rock/stone (Row 9)
  [TileType.FLOWER]: `${TOWN_TILE_BASE}tile_0018.png`,   // Flower/bush (Row 1)
  [TileType.BUILDING_FLOOR]: `${TOWN_TILE_BASE}tile_0073.png`, // Door mat (Row 6)
};

// Building sprites (using Kenney tiles for walls/roofs)
// Row 2 (24-35): Roofs, Row 4-5 (48-71): Walls with windows/doors
export const BUILDING_TILES = {
  // Wall tiles (Row 4-5: tiles 48-71)
  wallStone: `${TOWN_TILE_BASE}tile_0060.png`,
  wallWood: `${TOWN_TILE_BASE}tile_0048.png`,

  // Roof tiles (Row 2: tiles 24-35)
  roofBlue: `${TOWN_TILE_BASE}tile_0024.png`,
  roofBrown: `${TOWN_TILE_BASE}tile_0027.png`,
  roofOrange: `${TOWN_TILE_BASE}tile_0030.png`,

  // Door tiles (Row 4-5)
  doorWood: `${TOWN_TILE_BASE}tile_0049.png`,
  doorOpen: `${TOWN_TILE_BASE}tile_0050.png`,

  // Window tiles (Row 4-5)
  window: `${TOWN_TILE_BASE}tile_0051.png`,

  // Signs (Row 8: props)
  signShop: `${TOWN_TILE_BASE}tile_0096.png`,
  signInn: `${TOWN_TILE_BASE}tile_0097.png`,
};

// Props/decorations (Row 8-9: tiles 96-119)
export const PROP_TILES = {
  barrel: `${TOWN_TILE_BASE}tile_0098.png`,
  crate: `${TOWN_TILE_BASE}tile_0099.png`,
  fence: `${TOWN_TILE_BASE}tile_0036.png`,  // Row 3: fences
  lamp: `${TOWN_TILE_BASE}tile_0100.png`,
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

  // Add water/pond in the center
  for (let y = 5; y <= 7; y++) {
    for (let x = 8; x <= 11; x++) {
      tilemap[y][x] = TileType.WATER;
    }
  }

  // Add bridge over pond
  tilemap[6][8] = TileType.BRIDGE;
  tilemap[6][11] = TileType.BRIDGE;

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
