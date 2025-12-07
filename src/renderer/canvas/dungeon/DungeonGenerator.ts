/**
 * DungeonGenerator
 *
 * Procedurally generates dungeon floors with connected rooms.
 * Creates room layouts, assigns room types, and populates content.
 */

import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('DungeonGenerator');

// ============================================================================
// Types
// ============================================================================

export type RoomType =
  | 'start'
  | 'empty'
  | 'enemy'
  | 'treasure'
  | 'trap'
  | 'rest'
  | 'merchant'
  | 'secret'
  | 'puzzle'
  | 'boss'
  | 'exit';

export type Direction = 'north' | 'south' | 'east' | 'west';

export type ContentType = 'enemy' | 'chest' | 'trap' | 'npc' | 'interactable' | 'exit';

export interface RoomContent {
  id: string;
  type: ContentType;
  x: number; // Position within room (0-1 normalized)
  y: number;
  data: any; // Enemy data, chest contents, etc.
  triggered: boolean;
}

export interface DungeonRoom {
  id: string;
  type: RoomType;
  gridX: number; // Position in floor grid
  gridY: number;
  connections: {
    north: string | null;
    south: string | null;
    east: string | null;
    west: string | null;
  };
  contents: RoomContent[];
  visited: boolean;
  cleared: boolean;
  discovered: boolean; // Shown on minimap
}

export interface DungeonFloor {
  floorNumber: number;
  rooms: Map<string, DungeonRoom>;
  startRoomId: string;
  exitRoomId: string;
  bossRoomId: string | null;
  width: number;
  height: number;
}

export interface DungeonConfig {
  id: string;
  name: string;
  baseRooms: number;
  roomsPerFloor: number;
  totalFloors: number;
  theme: string;
  roomWeights: Record<RoomType, number>;
  enemyPool: string[];
  treasurePool: string[];
}

// ============================================================================
// Default Configs
// ============================================================================

const DEFAULT_ROOM_WEIGHTS: Record<RoomType, number> = {
  start: 0,
  empty: 20,
  enemy: 35,
  treasure: 15,
  trap: 10,
  rest: 5,
  merchant: 5,
  secret: 5,
  puzzle: 5,
  boss: 0,
  exit: 0,
};

export const DUNGEON_CONFIGS: Record<string, DungeonConfig> = {
  training: {
    id: 'training',
    name: 'Training Grounds',
    baseRooms: 5,
    roomsPerFloor: 2,
    totalFloors: 3,
    theme: 'grass',
    roomWeights: { ...DEFAULT_ROOM_WEIGHTS, enemy: 40, trap: 5 },
    enemyPool: ['target_dummy', 'training_slime'],
    treasurePool: ['gold_small', 'potion_minor'],
  },
  forest: {
    id: 'forest',
    name: 'Dark Forest',
    baseRooms: 6,
    roomsPerFloor: 2,
    totalFloors: 5,
    theme: 'forest',
    roomWeights: { ...DEFAULT_ROOM_WEIGHTS },
    enemyPool: ['wolf', 'slime', 'bat'],
    treasurePool: ['gold_medium', 'potion_minor', 'herb'],
  },
  crystal: {
    id: 'crystal',
    name: 'Crystal Caves',
    baseRooms: 7,
    roomsPerFloor: 2,
    totalFloors: 5,
    theme: 'ice',
    roomWeights: { ...DEFAULT_ROOM_WEIGHTS, treasure: 20, trap: 15 },
    enemyPool: ['ice_slime', 'crystal_golem', 'bat'],
    treasurePool: ['gold_large', 'crystal', 'potion_medium'],
  },
  library: {
    id: 'library',
    name: 'Haunted Library',
    baseRooms: 8,
    roomsPerFloor: 3,
    totalFloors: 5,
    theme: 'gothic',
    roomWeights: { ...DEFAULT_ROOM_WEIGHTS, puzzle: 15, secret: 10 },
    enemyPool: ['ghost', 'skeleton', 'cursed_book'],
    treasurePool: ['gold_medium', 'scroll', 'potion_medium'],
  },
  volcano: {
    id: 'volcano',
    name: "Dragon's Peak",
    baseRooms: 8,
    roomsPerFloor: 3,
    totalFloors: 7,
    theme: 'fire',
    roomWeights: { ...DEFAULT_ROOM_WEIGHTS, enemy: 40, trap: 15 },
    enemyPool: ['fire_slime', 'salamander', 'fire_elemental'],
    treasurePool: ['gold_large', 'fire_crystal', 'potion_large'],
  },
  void: {
    id: 'void',
    name: 'Void Realm',
    baseRooms: 10,
    roomsPerFloor: 3,
    totalFloors: 10,
    theme: 'void',
    roomWeights: { ...DEFAULT_ROOM_WEIGHTS, enemy: 45, secret: 10 },
    enemyPool: ['void_walker', 'shadow', 'void_elemental'],
    treasurePool: ['gold_huge', 'void_crystal', 'potion_large', 'legendary_item'],
  },
};

// ============================================================================
// Generator Class
// ============================================================================

export class DungeonGenerator {
  private config: DungeonConfig;
  private idCounter: number = 0;

  constructor(dungeonId: string) {
    this.config = DUNGEON_CONFIGS[dungeonId] || DUNGEON_CONFIGS.training;
  }

  /**
   * Generate a complete dungeon floor
   */
  generate(floorNumber: number): DungeonFloor {
    logger.info(`Generating floor ${floorNumber} for ${this.config.name}`);

    // Calculate room count based on floor
    const roomCount = this.config.baseRooms + (floorNumber - 1) * this.config.roomsPerFloor;
    const isFinalFloor = floorNumber === this.config.totalFloors;

    // Generate room layout (graph)
    const rooms = this.generateRoomLayout(roomCount);

    // Assign room types
    this.assignRoomTypes(rooms, floorNumber, isFinalFloor);

    // Populate rooms with content
    for (const room of rooms.values()) {
      this.populateRoom(room, floorNumber);
    }

    // Find start and exit rooms
    const startRoom = Array.from(rooms.values()).find((r) => r.type === 'start')!;
    const exitRoom = Array.from(rooms.values()).find((r) => r.type === 'exit' || r.type === 'boss');
    const bossRoom = isFinalFloor ? exitRoom : null;

    // Mark start room as discovered
    startRoom.discovered = true;
    startRoom.visited = true;

    const floor: DungeonFloor = {
      floorNumber,
      rooms,
      startRoomId: startRoom.id,
      exitRoomId: exitRoom?.id || startRoom.id,
      bossRoomId: bossRoom?.id || null,
      width: this.calculateGridWidth(rooms),
      height: this.calculateGridHeight(rooms),
    };

    logger.info(`Generated floor with ${rooms.size} rooms`);
    return floor;
  }

  /**
   * Get dungeon config
   */
  getConfig(): DungeonConfig {
    return this.config;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Generate room layout using random walk algorithm
   */
  private generateRoomLayout(roomCount: number): Map<string, DungeonRoom> {
    const rooms = new Map<string, DungeonRoom>();
    const grid = new Map<string, string>(); // "x,y" -> roomId

    // Start at center
    const startRoom = this.createRoom(0, 0, 'start');
    rooms.set(startRoom.id, startRoom);
    grid.set('0,0', startRoom.id);

    let currentX = 0;
    let currentY = 0;
    let lastDirection: Direction | null = null;

    // Random walk to create connected rooms
    while (rooms.size < roomCount) {
      // Choose random direction (avoid going back)
      const directions: Direction[] = ['north', 'south', 'east', 'west'];
      const availableDirections = directions.filter((d) => d !== this.oppositeDirection(lastDirection));
      const direction = availableDirections[Math.floor(Math.random() * availableDirections.length)];

      // Calculate new position
      const [dx, dy] = this.directionToOffset(direction);
      const newX = currentX + dx;
      const newY = currentY + dy;
      const gridKey = `${newX},${newY}`;

      // Check if room already exists
      if (grid.has(gridKey)) {
        // Connect to existing room
        const existingRoomId = grid.get(gridKey)!;
        const currentRoom = rooms.get(grid.get(`${currentX},${currentY}`)!)!;
        const existingRoom = rooms.get(existingRoomId)!;

        this.connectRooms(currentRoom, existingRoom, direction);
        currentX = newX;
        currentY = newY;
      } else {
        // Create new room
        const newRoom = this.createRoom(newX, newY, 'empty');
        rooms.set(newRoom.id, newRoom);
        grid.set(gridKey, newRoom.id);

        // Connect to previous room
        const currentRoom = rooms.get(grid.get(`${currentX},${currentY}`)!)!;
        this.connectRooms(currentRoom, newRoom, direction);

        currentX = newX;
        currentY = newY;
      }

      lastDirection = direction;
    }

    return rooms;
  }

  /**
   * Assign room types based on configuration
   */
  private assignRoomTypes(rooms: Map<string, DungeonRoom>, floor: number, isFinalFloor: boolean): void {
    const roomList = Array.from(rooms.values());

    // First room is always start (already set)
    // Last room is exit or boss
    const lastRoom = roomList[roomList.length - 1];
    lastRoom.type = isFinalFloor ? 'boss' : 'exit';

    // Assign types to remaining rooms
    for (let i = 1; i < roomList.length - 1; i++) {
      roomList[i].type = this.weightedRandomType();
    }
  }

  /**
   * Choose random room type based on weights
   */
  private weightedRandomType(): RoomType {
    const weights = this.config.roomWeights;
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (const [type, weight] of Object.entries(weights)) {
      random -= weight;
      if (random <= 0) {
        return type as RoomType;
      }
    }

    return 'empty';
  }

  /**
   * Populate room with content based on type
   */
  private populateRoom(room: DungeonRoom, floor: number): void {
    room.contents = [];

    switch (room.type) {
      case 'enemy':
        this.addEnemyContent(room, floor);
        break;
      case 'treasure':
        this.addTreasureContent(room, floor);
        break;
      case 'trap':
        this.addTrapContent(room, floor);
        break;
      case 'rest':
        this.addRestContent(room);
        break;
      case 'merchant':
        this.addMerchantContent(room);
        break;
      case 'boss':
        this.addBossContent(room, floor);
        break;
      case 'exit':
        this.addExitContent(room);
        break;
    }
  }

  private addEnemyContent(room: DungeonRoom, floor: number): void {
    const enemyCount = 1 + Math.floor(Math.random() * Math.min(3, floor));
    const pool = this.config.enemyPool;

    for (let i = 0; i < enemyCount; i++) {
      room.contents.push({
        id: this.generateId(),
        type: 'enemy',
        x: 0.3 + Math.random() * 0.4,
        y: 0.3 + Math.random() * 0.4,
        data: {
          enemyType: pool[Math.floor(Math.random() * pool.length)],
          level: floor,
        },
        triggered: false,
      });
    }
  }

  private addTreasureContent(room: DungeonRoom, floor: number): void {
    const pool = this.config.treasurePool;
    room.contents.push({
      id: this.generateId(),
      type: 'chest',
      x: 0.5,
      y: 0.5,
      data: {
        lootType: pool[Math.floor(Math.random() * pool.length)],
        goldAmount: 10 * floor + Math.floor(Math.random() * 20 * floor),
      },
      triggered: false,
    });
  }

  private addTrapContent(room: DungeonRoom, floor: number): void {
    room.contents.push({
      id: this.generateId(),
      type: 'trap',
      x: 0.5,
      y: 0.5,
      data: {
        trapType: 'spike',
        damage: 5 + floor * 2,
      },
      triggered: false,
    });
  }

  private addRestContent(room: DungeonRoom): void {
    room.contents.push({
      id: this.generateId(),
      type: 'interactable',
      x: 0.5,
      y: 0.5,
      data: {
        interactType: 'campfire',
        healPercent: 30,
      },
      triggered: false,
    });
  }

  private addMerchantContent(room: DungeonRoom): void {
    room.contents.push({
      id: this.generateId(),
      type: 'npc',
      x: 0.5,
      y: 0.3,
      data: {
        npcType: 'merchant',
        inventory: ['potion_minor', 'potion_medium'],
      },
      triggered: false,
    });
  }

  private addBossContent(room: DungeonRoom, floor: number): void {
    room.contents.push({
      id: this.generateId(),
      type: 'enemy',
      x: 0.5,
      y: 0.4,
      data: {
        enemyType: 'boss',
        level: floor,
        isBoss: true,
      },
      triggered: false,
    });
  }

  private addExitContent(room: DungeonRoom): void {
    room.contents.push({
      id: this.generateId(),
      type: 'exit',
      x: 0.5,
      y: 0.5,
      data: {},
      triggered: false,
    });
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private createRoom(x: number, y: number, type: RoomType): DungeonRoom {
    return {
      id: this.generateId(),
      type,
      gridX: x,
      gridY: y,
      connections: {
        north: null,
        south: null,
        east: null,
        west: null,
      },
      contents: [],
      visited: false,
      cleared: false,
      discovered: false,
    };
  }

  private connectRooms(room1: DungeonRoom, room2: DungeonRoom, direction: Direction): void {
    room1.connections[direction] = room2.id;
    room2.connections[this.oppositeDirection(direction)!] = room1.id;
  }

  private directionToOffset(direction: Direction): [number, number] {
    switch (direction) {
      case 'north': return [0, -1];
      case 'south': return [0, 1];
      case 'east': return [1, 0];
      case 'west': return [-1, 0];
    }
  }

  private oppositeDirection(direction: Direction | null): Direction | null {
    if (!direction) return null;
    switch (direction) {
      case 'north': return 'south';
      case 'south': return 'north';
      case 'east': return 'west';
      case 'west': return 'east';
    }
  }

  private generateId(): string {
    return `room_${++this.idCounter}_${Date.now().toString(36)}`;
  }

  private calculateGridWidth(rooms: Map<string, DungeonRoom>): number {
    let minX = 0, maxX = 0;
    for (const room of rooms.values()) {
      minX = Math.min(minX, room.gridX);
      maxX = Math.max(maxX, room.gridX);
    }
    return maxX - minX + 1;
  }

  private calculateGridHeight(rooms: Map<string, DungeonRoom>): number {
    let minY = 0, maxY = 0;
    for (const room of rooms.values()) {
      minY = Math.min(minY, room.gridY);
      maxY = Math.max(maxY, room.gridY);
    }
    return maxY - minY + 1;
  }
}
