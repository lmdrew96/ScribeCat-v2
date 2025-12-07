/**
 * Town Module
 *
 * Exports town-related classes and types for the Cat Village hub.
 */

export { TownCanvas } from './TownCanvas.js';

export {
  TILE_SIZE,
  TOWN_WIDTH,
  TOWN_HEIGHT,
  TOWN_TILEMAP,
  TILE_COLORS,
  TileType,
  BUILDINGS,
  INTERACTION_ZONES,
  WALKABLE_TILES,
  generateTownTilemap,
  isWalkable,
  getBuildingAt,
  getInteractionZone,
  getBuildingById,
  getSpawnPosition,
  type Building,
  type BuildingId,
  type InteractionZone,
} from './TownLayout.js';
