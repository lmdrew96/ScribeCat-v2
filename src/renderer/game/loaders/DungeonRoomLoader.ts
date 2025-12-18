/**
 * DungeonRoomLoader - Loads dungeon room tilemaps from TMX files
 *
 * Parses TMX files and renders dungeon rooms using a spritesheet tileset.
 * Each room template (dungeon_room1.tmx - dungeon_room15.tmx) provides:
 * - Two tile layers (floor + decorations)
 * - Collider objects
 * - Door position points
 */

import * as ex from 'excalibur';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('DungeonRoomLoader');

// Paths relative to dist/renderer/
const ROOM_TILEMAP_PATH = '../../assets/MAPS/Tile Maps/';
const DUNGEON_TILESET_PATH = '../../assets/Tiles/Dungeon/Dungeon_Tileset.png';

// Dungeon tileset configuration
const TILESET_COLUMNS = 10;
const TILESET_TILE_SIZE = 16;

// Room dimensions
const ROOM_WIDTH_TILES = 20;
const ROOM_HEIGHT_TILES = 10;
const ROOM_TEMPLATE_COUNT = 15;

// Parsed layer data
interface LayerData {
  name: string;
  width: number;
  height: number;
  data: number[];
}

// Collider rectangle from TMX
export interface RoomCollider {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Door point from TMX
export interface RoomDoor {
  name: string;
  x: number;
  y: number;
}

// Parsed room data from TMX
export interface DungeonRoomData {
  id: number;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  layers: LayerData[];
  colliders: RoomCollider[];
  doors: RoomDoor[];
  loaded: boolean;
}

// Door positions extracted from the room (scaled)
export interface DoorPositions {
  north: ex.Vector | null;
  south: ex.Vector | null;
  east: ex.Vector | null;
  west: ex.Vector | null;
}

// Door configuration key (sorted string of directions)
export type DoorConfig = {
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
};

/**
 * DungeonRoomLoader - Manages loading and caching of dungeon room templates
 */
export class DungeonRoomLoader {
  private rooms: Map<number, DungeonRoomData> = new Map();
  private spriteSheet: ex.SpriteSheet | null = null;
  private tilesetImage: ex.ImageSource | null = null;
  private loadedPromise: Promise<void> | null = null;
  
  // Index of room templates by their door configuration
  private roomsByDoorConfig: Map<string, number[]> = new Map();

  /**
   * Load all dungeon room templates and the tileset
   */
  async loadAll(): Promise<void> {
    if (this.loadedPromise) {
      return this.loadedPromise;
    }

    this.loadedPromise = this.doLoadAll();
    return this.loadedPromise;
  }

  private async doLoadAll(): Promise<void> {
    // Load the tileset spritesheet first
    await this.loadTileset();

    // Load all room TMX files
    const loadPromises: Promise<void>[] = [];
    for (let i = 1; i <= ROOM_TEMPLATE_COUNT; i++) {
      loadPromises.push(this.loadRoom(i));
    }

    await Promise.all(loadPromises);
    
    // Index rooms by their door configuration
    this.indexRoomsByDoorConfig();
    
    logger.info(`Loaded ${this.rooms.size} dungeon room templates`);
  }

  /**
   * Index all loaded rooms by their door configuration for quick lookup
   */
  private indexRoomsByDoorConfig(): void {
    this.roomsByDoorConfig.clear();
    
    for (const [id, room] of this.rooms) {
      const configKey = this.getDoorConfigKey(room);
      
      if (!this.roomsByDoorConfig.has(configKey)) {
        this.roomsByDoorConfig.set(configKey, []);
      }
      this.roomsByDoorConfig.get(configKey)!.push(id);
      
      logger.debug(`Room ${id} indexed with door config: ${configKey}`);
    }
    
    logger.info(`Indexed rooms into ${this.roomsByDoorConfig.size} door configurations`);
  }

  /**
   * Get a string key representing the door configuration of a room
   */
  private getDoorConfigKey(room: DungeonRoomData): string {
    const hasNorth = room.doors.some(d => d.name === 'top_door' || d.name === 'north_door');
    const hasSouth = room.doors.some(d => d.name === 'bottom_door' || d.name === 'south_door');
    const hasEast = room.doors.some(d => d.name === 'right_door' || d.name === 'east_door');
    const hasWest = room.doors.some(d => d.name === 'left_door' || d.name === 'west_door');
    
    const parts: string[] = [];
    if (hasNorth) parts.push('N');
    if (hasSouth) parts.push('S');
    if (hasEast) parts.push('E');
    if (hasWest) parts.push('W');
    
    return parts.join('') || 'NONE';
  }

  /**
   * Create a door config key from required directions
   */
  private createDoorConfigKey(north: boolean, south: boolean, east: boolean, west: boolean): string {
    const parts: string[] = [];
    if (north) parts.push('N');
    if (south) parts.push('S');
    if (east) parts.push('E');
    if (west) parts.push('W');
    return parts.join('') || 'NONE';
  }

  /**
   * Load the dungeon tileset spritesheet
   */
  private async loadTileset(): Promise<void> {
    try {
      this.tilesetImage = new ex.ImageSource(DUNGEON_TILESET_PATH);
      await this.tilesetImage.load();

      this.spriteSheet = ex.SpriteSheet.fromImageSource({
        image: this.tilesetImage,
        grid: {
          rows: 10,
          columns: TILESET_COLUMNS,
          spriteWidth: TILESET_TILE_SIZE,
          spriteHeight: TILESET_TILE_SIZE,
        },
      });

      logger.info('Loaded dungeon tileset spritesheet');
    } catch (error) {
      logger.error(`Failed to load dungeon tileset: ${error}`);
    }
  }

  /**
   * Load and parse a single room TMX file
   */
  private async loadRoom(id: number): Promise<void> {
    const path = `${ROOM_TILEMAP_PATH}dungeon_room${id}.tmx`;

    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const tmxContent = await response.text();
      const roomData = this.parseTMX(id, tmxContent);
      this.rooms.set(id, roomData);
      logger.debug(`Loaded dungeon room ${id}`);
    } catch (error) {
      logger.warn(`Failed to load dungeon room ${id}: ${error}`);
    }
  }

  /**
   * Parse TMX XML content into room data
   */
  private parseTMX(id: number, tmxContent: string): DungeonRoomData {
    const parser = new DOMParser();
    const doc = parser.parseFromString(tmxContent, 'text/xml');
    const mapEl = doc.querySelector('map');

    if (!mapEl) throw new Error('Invalid TMX: no map element');

    const width = parseInt(mapEl.getAttribute('width') || String(ROOM_WIDTH_TILES), 10);
    const height = parseInt(mapEl.getAttribute('height') || String(ROOM_HEIGHT_TILES), 10);
    const tileWidth = parseInt(mapEl.getAttribute('tilewidth') || '16', 10);
    const tileHeight = parseInt(mapEl.getAttribute('tileheight') || '16', 10);

    // Parse tile layers
    const layers: LayerData[] = [];
    doc.querySelectorAll('layer').forEach((layerEl) => {
      const name = layerEl.getAttribute('name') || 'unnamed';
      const layerWidth = parseInt(layerEl.getAttribute('width') || String(width), 10);
      const layerHeight = parseInt(layerEl.getAttribute('height') || String(height), 10);
      const dataEl = layerEl.querySelector('data');

      if (dataEl && dataEl.getAttribute('encoding') === 'csv') {
        const data = this.parseCSVData(dataEl.textContent || '');
        layers.push({ name, width: layerWidth, height: layerHeight, data });
      }
    });

    // Parse colliders from object group
    const colliders: RoomCollider[] = [];
    const collidersGroup = doc.querySelector('objectgroup[name="colliders"]');
    if (collidersGroup) {
      collidersGroup.querySelectorAll('object').forEach((objEl) => {
        const x = parseFloat(objEl.getAttribute('x') || '0');
        const y = parseFloat(objEl.getAttribute('y') || '0');
        const objWidth = parseFloat(objEl.getAttribute('width') || '0');
        const objHeight = parseFloat(objEl.getAttribute('height') || '0');
        
        // Only add if it has width/height (rectangular collider)
        if (objWidth > 0 && objHeight > 0) {
          colliders.push({ x, y, width: objWidth, height: objHeight });
        }
      });
    }

    // Parse doors from object group
    const doors: RoomDoor[] = [];
    const doorsGroup = doc.querySelector('objectgroup[name="doors"]');
    if (doorsGroup) {
      doorsGroup.querySelectorAll('object').forEach((objEl) => {
        const name = objEl.getAttribute('name') || '';
        const x = parseFloat(objEl.getAttribute('x') || '0');
        const y = parseFloat(objEl.getAttribute('y') || '0');
        
        // Only add if it has a name (door identifier)
        if (name) {
          doors.push({ name, x, y });
        }
      });
    }

    return {
      id,
      width,
      height,
      tileWidth,
      tileHeight,
      layers,
      colliders,
      doors,
      loaded: true,
    };
  }

  /**
   * Parse CSV tile data
   */
  private parseCSVData(csvString: string): number[] {
    return csvString
      .trim()
      .split(/[\n,]/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
  }

  /**
   * Get a random room template
   */
  getRandomRoom(): DungeonRoomData | null {
    const roomIds = Array.from(this.rooms.keys());
    if (roomIds.length === 0) return null;

    const randomId = roomIds[Math.floor(Math.random() * roomIds.length)];
    return this.rooms.get(randomId) || null;
  }

  /**
   * Get a room template that matches the required door connections
   * Returns a random matching template, or falls back to best match
   */
  getRoomForConnections(
    hasNorth: boolean,
    hasSouth: boolean,
    hasEast: boolean,
    hasWest: boolean
  ): DungeonRoomData | null {
    const requiredKey = this.createDoorConfigKey(hasNorth, hasSouth, hasEast, hasWest);
    
    // Try exact match first
    const exactMatches = this.roomsByDoorConfig.get(requiredKey);
    if (exactMatches && exactMatches.length > 0) {
      const randomId = exactMatches[Math.floor(Math.random() * exactMatches.length)];
      logger.debug(`Found exact match for ${requiredKey}: room ${randomId}`);
      return this.rooms.get(randomId) || null;
    }
    
    // No exact match - find rooms that have AT LEAST the required doors
    // (rooms with extra doors are acceptable, but doors in walls are weird)
    const compatibleRooms: number[] = [];
    
    for (const [id, room] of this.rooms) {
      const roomHasNorth = room.doors.some(d => d.name === 'top_door' || d.name === 'north_door');
      const roomHasSouth = room.doors.some(d => d.name === 'bottom_door' || d.name === 'south_door');
      const roomHasEast = room.doors.some(d => d.name === 'right_door' || d.name === 'east_door');
      const roomHasWest = room.doors.some(d => d.name === 'left_door' || d.name === 'west_door');
      
      // Room must have all required doors (can have extras)
      if ((!hasNorth || roomHasNorth) &&
          (!hasSouth || roomHasSouth) &&
          (!hasEast || roomHasEast) &&
          (!hasWest || roomHasWest)) {
        compatibleRooms.push(id);
      }
    }
    
    if (compatibleRooms.length > 0) {
      const randomId = compatibleRooms[Math.floor(Math.random() * compatibleRooms.length)];
      logger.debug(`Found compatible room for ${requiredKey}: room ${randomId}`);
      return this.rooms.get(randomId) || null;
    }
    
    // Last resort: return room 1 (has all 4 doors)
    logger.warn(`No matching room for ${requiredKey}, falling back to room 1`);
    return this.rooms.get(1) || this.getRandomRoom();
  }

  /**
   * Get a specific room by ID
   */
  getRoom(id: number): DungeonRoomData | null {
    return this.rooms.get(id) || null;
  }

  /**
   * Create actors for a dungeon room at a specific position with scaling
   */
  createRoomActors(
    roomData: DungeonRoomData,
    offsetX: number,
    offsetY: number,
    scale: number = 1,
    baseZ: number = -10
  ): ex.Actor[] {
    if (!this.spriteSheet) {
      logger.warn('Spritesheet not loaded');
      return [];
    }

    const actors: ex.Actor[] = [];
    const scaledTileSize = roomData.tileWidth * scale;

    // Create actors for each layer
    roomData.layers.forEach((layer, layerIndex) => {
      const zIndex = baseZ + layerIndex;

      for (let y = 0; y < layer.height; y++) {
        for (let x = 0; x < layer.width; x++) {
          const tileIndex = y * layer.width + x;
          const gid = layer.data[tileIndex];

          // Skip empty tiles (gid 0)
          if (gid === 0) continue;

          // Handle flipped tiles (clear flip bits for now)
          const FLIPPED_H = 0x80000000;
          const FLIPPED_V = 0x40000000;
          const FLIPPED_D = 0x20000000;
          const localId = (gid & ~(FLIPPED_H | FLIPPED_V | FLIPPED_D)) - 1; // -1 because firstgid is 1

          if (localId < 0 || localId >= 100) continue; // Invalid tile

          const sprite = this.spriteSheet.getSprite(
            localId % TILESET_COLUMNS,
            Math.floor(localId / TILESET_COLUMNS)
          );

          if (!sprite) continue;

          // Scale the sprite
          const scaledSprite = sprite.clone();
          scaledSprite.scale = ex.vec(scale, scale);

          const actor = new ex.Actor({
            pos: ex.vec(
              offsetX + x * scaledTileSize + scaledTileSize / 2,
              offsetY + y * scaledTileSize + scaledTileSize / 2
            ),
            width: scaledTileSize,
            height: scaledTileSize,
            z: zIndex,
          });

          actor.graphics.use(scaledSprite);
          actors.push(actor);
        }
      }
    });

    return actors;
  }

  /**
   * Get the pixel dimensions of a room at a given scale
   */
  getRoomDimensions(scale: number = 1): { width: number; height: number } {
    return {
      width: ROOM_WIDTH_TILES * TILESET_TILE_SIZE * scale,
      height: ROOM_HEIGHT_TILES * TILESET_TILE_SIZE * scale,
    };
  }

  /**
   * Get scaled door positions for a room
   * Maps TMX door names to cardinal directions
   */
  getScaledDoorPositions(
    roomData: DungeonRoomData,
    offsetX: number,
    offsetY: number,
    scale: number = 1
  ): DoorPositions {
    const doors: DoorPositions = {
      north: null,
      south: null,
      east: null,
      west: null,
    };

    for (const door of roomData.doors) {
      const scaledX = offsetX + door.x * scale;
      const scaledY = offsetY + door.y * scale;
      const pos = ex.vec(scaledX, scaledY);

      // Map door names to directions
      if (door.name === 'top_door' || door.name === 'north_door') {
        doors.north = pos;
      } else if (door.name === 'bottom_door' || door.name === 'south_door') {
        doors.south = pos;
      } else if (door.name === 'right_door' || door.name === 'east_door') {
        doors.east = pos;
      } else if (door.name === 'left_door' || door.name === 'west_door') {
        doors.west = pos;
      }
    }

    return doors;
  }

  /**
   * Get scaled colliders for a room
   */
  getScaledColliders(
    roomData: DungeonRoomData,
    offsetX: number,
    offsetY: number,
    scale: number = 1
  ): RoomCollider[] {
    return roomData.colliders.map((collider) => ({
      x: offsetX + collider.x * scale,
      y: offsetY + collider.y * scale,
      width: collider.width * scale,
      height: collider.height * scale,
    }));
  }

  /**
   * Get the number of loaded rooms
   */
  get roomCount(): number {
    return this.rooms.size;
  }

  /**
   * Check if rooms are loaded
   */
  get isLoaded(): boolean {
    return this.rooms.size > 0 && this.spriteSheet !== null;
  }
}

// Singleton instance
let loaderInstance: DungeonRoomLoader | null = null;

/**
 * Get the dungeon room loader singleton
 */
export function getDungeonRoomLoader(): DungeonRoomLoader {
  if (!loaderInstance) {
    loaderInstance = new DungeonRoomLoader();
  }
  return loaderInstance;
}
