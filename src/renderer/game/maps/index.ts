/**
 * Maps Module
 *
 * Exports tilemap loading and rendering utilities.
 */

export {
  parseTMX,
  loadMapTiles,
  renderMapLayer,
  renderAllLayers,
  loadTMXFromPath,
  getSpawnPosition,
  getDoorPositions,
  getColliders,
} from './TilemapLoader.js';

export type { MapData, MapObject, ObjectGroup } from './TilemapLoader.js';
