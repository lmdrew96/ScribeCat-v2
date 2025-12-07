/**
 * Dungeon Exploration Module
 *
 * Exports all dungeon-related components for procedural
 * dungeon generation and room-based exploration.
 */

export {
  DungeonGenerator,
  DUNGEON_CONFIGS,
  type RoomType,
  type Direction,
  type ContentType,
  type RoomContent,
  type DungeonRoom,
  type DungeonFloor,
  type DungeonConfig,
} from './DungeonGenerator.js';

export { DungeonCanvas } from './DungeonCanvas.js';

export { MiniMap, createMiniMapContainer } from './MiniMap.js';

export {
  DUNGEON_TILE_SIZE,
  FLOOR_TILES,
  WALL_TILES,
  DOOR_TILES,
  CHARACTER_TILES,
  PROP_TILES,
  ITEM_TILES,
  DECORATION_TILES,
  ENEMY_TYPE_TO_TILE,
  getContentTile,
  getDungeonTilesToPreload,
} from './DungeonLayout.js';

export {
  MINIMAP_TILE_SIZE,
  MINIMAP_TILES,
  getMinimapTilesToPreload,
  getRoomTile,
} from './MiniMapLayout.js';
