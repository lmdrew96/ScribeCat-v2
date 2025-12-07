/**
 * MiniMapLayout
 *
 * Defines tile mappings for dungeon minimap using Kenney Minimap Pack.
 * Style A (simple 8x8 pixel tiles)
 */

// Base path for Kenney minimap tiles
// From src/renderer/canvas/dungeon/ to project root assets
const MINIMAP_TILE_BASE = '../../../../assets/sprites/studyquest/kenney/minimap/';

// Tile size in pixels (Kenney minimap tiles are 8x8)
export const MINIMAP_TILE_SIZE = 8;

// Room tiles - based on Kenney Minimap Pack Style A layout
export const MINIMAP_TILES = {
  // Room states
  roomEmpty: `${MINIMAP_TILE_BASE}tile_0000.png`,      // Empty/undiscovered
  roomVisited: `${MINIMAP_TILE_BASE}tile_0001.png`,   // Visited/cleared
  roomCurrent: `${MINIMAP_TILE_BASE}tile_0002.png`,   // Current position
  roomDiscovered: `${MINIMAP_TILE_BASE}tile_0003.png`, // Discovered but not visited

  // Special rooms
  roomStart: `${MINIMAP_TILE_BASE}tile_0004.png`,     // Starting room
  roomBoss: `${MINIMAP_TILE_BASE}tile_0005.png`,      // Boss room
  roomExit: `${MINIMAP_TILE_BASE}tile_0006.png`,      // Exit/stairs
  roomTreasure: `${MINIMAP_TILE_BASE}tile_0007.png`,  // Treasure room
  roomShop: `${MINIMAP_TILE_BASE}tile_0008.png`,      // Shop/merchant
  roomRest: `${MINIMAP_TILE_BASE}tile_0009.png`,      // Rest area

  // Connectors (horizontal and vertical)
  connectorH: `${MINIMAP_TILE_BASE}tile_0010.png`,    // Horizontal door/path
  connectorV: `${MINIMAP_TILE_BASE}tile_0011.png`,    // Vertical door/path
  connectorHActive: `${MINIMAP_TILE_BASE}tile_0012.png`, // Horizontal active
  connectorVActive: `${MINIMAP_TILE_BASE}tile_0013.png`, // Vertical active

  // Corners and edges (for border)
  cornerTL: `${MINIMAP_TILE_BASE}tile_0014.png`,
  cornerTR: `${MINIMAP_TILE_BASE}tile_0015.png`,
  cornerBL: `${MINIMAP_TILE_BASE}tile_0016.png`,
  cornerBR: `${MINIMAP_TILE_BASE}tile_0017.png`,
  edgeH: `${MINIMAP_TILE_BASE}tile_0018.png`,
  edgeV: `${MINIMAP_TILE_BASE}tile_0019.png`,

  // Background
  background: `${MINIMAP_TILE_BASE}tile_0020.png`,

  // Icons/markers
  iconPlayer: `${MINIMAP_TILE_BASE}tile_0021.png`,
  iconEnemy: `${MINIMAP_TILE_BASE}tile_0022.png`,
  iconChest: `${MINIMAP_TILE_BASE}tile_0023.png`,
  iconKey: `${MINIMAP_TILE_BASE}tile_0024.png`,
};

/**
 * Get all minimap tiles to preload
 */
export function getMinimapTilesToPreload(): string[] {
  return Object.values(MINIMAP_TILES);
}

import type { RoomType } from './DungeonGenerator.js';

/**
 * Get the appropriate tile for a room based on its type and state
 */
export function getRoomTile(
  roomType: RoomType,
  isCurrent: boolean,
  isVisited: boolean,
  isDiscovered: boolean
): string {
  // Current room always highlighted
  if (isCurrent) {
    return MINIMAP_TILES.roomCurrent;
  }

  // Special room types
  if (roomType === 'start') {
    return MINIMAP_TILES.roomStart;
  }
  if (roomType === 'boss') {
    return MINIMAP_TILES.roomBoss;
  }
  if (roomType === 'exit') {
    return MINIMAP_TILES.roomExit;
  }

  // Visited rooms show their type
  if (isVisited) {
    switch (roomType) {
      case 'treasure':
        return MINIMAP_TILES.roomTreasure;
      case 'merchant':
        return MINIMAP_TILES.roomShop;
      case 'rest':
        return MINIMAP_TILES.roomRest;
      default:
        return MINIMAP_TILES.roomVisited;
    }
  }

  // Discovered but not visited
  if (isDiscovered) {
    return MINIMAP_TILES.roomDiscovered;
  }

  // Unknown/empty
  return MINIMAP_TILES.roomEmpty;
}
