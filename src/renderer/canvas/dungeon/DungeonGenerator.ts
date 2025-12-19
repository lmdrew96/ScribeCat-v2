/**
 * DungeonGenerator
 *
 * Procedurally generates dungeon floors with connected rooms.
 * Creates room layouts, assigns room types, and populates content.
 *
 * FIXES:
 * - Added content for puzzle and secret room types
 * - Boss room now has exit content after boss is defeated
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

export type ContentType = 'enemy' | 'chest' | 'trap' | 'npc' | 'interactable' | 'exit' | 'puzzle' | 'secret';

/**
 * Union type for room content data based on content type.
 * Provides type safety for the different content payloads.
 */
export interface EnemyContentData {
  enemyId: string;
  enemyType?: string; // Alias for enemyId, used by some code paths
  level?: number;
  isBoss?: boolean;
}

export interface ChestContentData {
  itemId?: string;
  gold?: number;
  goldAmount?: number; // Alias for gold, used by some code paths
  opened?: boolean;
}

export interface TrapContentData {
  trapType: string;
  damage: number;
  disarmed?: boolean;
  discovered?: boolean; // Track if trap has been revealed
}

export interface NPCContentData {
  npcId: string;
  npcType?: string; // e.g., 'merchant', 'healer', etc.
  dialogueId?: string;
  items?: Array<{ itemId: string; price: number }>;
  inventory?: string[]; // Item keys for merchant inventory
}

export interface PuzzleContentData {
  puzzleType: 'riddle' | 'sequence' | 'memory';
  solved?: boolean;
  rewardItemId?: string;
  rewardGold?: number;
  goldReward?: number; // Alias for rewardGold
  xpReward?: number;
}

export interface SecretContentData {
  secretType: string;
  revealed?: boolean;
  discovered?: boolean; // Alias for revealed
  rewardItemId?: string;
  rewardGold?: number;
  rewardType?: string; // e.g., 'gold_large', 'full_heal'
  secretName?: string; // Display name for the secret
  goldReward?: number; // Alias for rewardGold
  xpReward?: number;
  healPercent?: number; // For healing secrets
}

export interface ExitContentData {
  targetFloor?: number;
  targetDungeon?: string;
  requiresBossDefeated?: boolean; // Exit blocked until boss is defeated
  bossDefeated?: boolean; // Track boss defeat state
}

export interface InteractableContentData {
  interactionType: string;
  interactType?: string; // Alias for interactionType (e.g., 'campfire')
  message?: string;
  healPercent?: number; // For campfire healing
}

export type RoomContentData =
  | EnemyContentData
  | ChestContentData
  | TrapContentData
  | NPCContentData
  | PuzzleContentData
  | SecretContentData
  | ExitContentData
  | InteractableContentData;

export interface RoomContent {
  id: string;
  type: ContentType;
  x: number; // Position within room (0-1 normalized)
  y: number;
  data: RoomContentData;
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
    enemyPool: ['grey_slime', 'rat', 'roomba'],
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
    enemyPool: ['grey_slime', 'rat', 'rat_fighter', 'squirrel_warrior', 'rubber_ducky'],
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
    enemyPool: ['demon_slime', 'rat_warrior', 'rat_ranger', 'tuna_can_battler'],
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
    enemyPool: ['rat_mage', 'rat_warrior', 'yarn_elemental', 'ruff_dog'],
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
    enemyPool: ['demon_slime', 'dog_with_axe', 'yarn_elemental', 'rat_necromancer'],
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
    enemyPool: ['rat_necromancer', 'dog_with_axe', 'yarn_elemental', 'demon_slime'],
    treasurePool: ['gold_huge', 'void_crystal', 'potion_large', 'legendary_item'],
  },
};

// Puzzle types
const PUZZLE_TYPES = [
  { type: 'riddle', name: 'Riddle Stone', reward: 'gold' },
  { type: 'switch', name: 'Ancient Switch', reward: 'chest' },
  { type: 'memory', name: 'Memory Tiles', reward: 'item' },
  { type: 'sequence', name: 'Sequence Lock', reward: 'gold' },
];

// Secret types
const SECRET_TYPES = [
  { type: 'hidden_chest', name: 'Hidden Treasure', reward: 'gold_large' },
  { type: 'ancient_tome', name: 'Ancient Tome', reward: 'xp_bonus' },
  { type: 'secret_merchant', name: 'Secret Merchant', reward: 'rare_items' },
  { type: 'healing_spring', name: 'Healing Spring', reward: 'full_heal' },
];

// ============================================================================
// Generator Class
// ============================================================================

// Door exclusion zones (normalized coordinates 0-1)
// Content should not spawn within these zones to avoid blocking doors
const DOOR_EXCLUSION_ZONES = {
  north: { minX: 0.35, maxX: 0.65, minY: 0, maxY: 0.15 },
  south: { minX: 0.35, maxX: 0.65, minY: 0.85, maxY: 1 },
  east: { minX: 0.85, maxX: 1, minY: 0.35, maxY: 0.65 },
  west: { minX: 0, maxX: 0.15, minY: 0.35, maxY: 0.65 },
};

export class DungeonGenerator {
  private config: DungeonConfig;
  private idCounter: number = 0;

  constructor(dungeonId: string) {
    this.config = DUNGEON_CONFIGS[dungeonId] || DUNGEON_CONFIGS.training;
  }

  /**
   * Check if a position is too close to a door zone
   */
  private isNearDoor(x: number, y: number, room: DungeonRoom): boolean {
    // Check each door that exists in this room
    if (room.connections.north) {
      const zone = DOOR_EXCLUSION_ZONES.north;
      if (x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY) return true;
    }
    if (room.connections.south) {
      const zone = DOOR_EXCLUSION_ZONES.south;
      if (x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY) return true;
    }
    if (room.connections.east) {
      const zone = DOOR_EXCLUSION_ZONES.east;
      if (x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY) return true;
    }
    if (room.connections.west) {
      const zone = DOOR_EXCLUSION_ZONES.west;
      if (x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY) return true;
    }
    return false;
  }

  /**
   * Generate a safe position that avoids door areas
   */
  private getSafePosition(room: DungeonRoom, baseX: number, baseY: number, rangeX: number, rangeY: number): { x: number; y: number } {
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      const x = baseX + Math.random() * rangeX;
      const y = baseY + Math.random() * rangeY;
      if (!this.isNearDoor(x, y, room)) {
        return { x, y };
      }
    }
    // Fallback to center if can't find safe spot
    return { x: 0.5, y: 0.5 };
  }

  /**
   * Generate a complete dungeon floor
   */
  generate(floorNumber: number): DungeonFloor {
    logger.info(`Generating floor ${floorNumber} for ${this.config.name}`);

    const roomCount = this.config.baseRooms + (floorNumber - 1) * this.config.roomsPerFloor;
    const isFinalFloor = floorNumber === this.config.totalFloors;

    const rooms = this.generateRoomLayout(roomCount);
    this.assignRoomTypes(rooms, floorNumber, isFinalFloor);

    for (const room of rooms.values()) {
      this.populateRoom(room, floorNumber);
    }

    const startRoom = Array.from(rooms.values()).find((r) => r.type === 'start')!;
    const exitRoom = Array.from(rooms.values()).find((r) => r.type === 'exit' || r.type === 'boss');
    const bossRoom = isFinalFloor ? exitRoom : null;

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

  getConfig(): DungeonConfig {
    return this.config;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private generateRoomLayout(roomCount: number): Map<string, DungeonRoom> {
    const rooms = new Map<string, DungeonRoom>();
    const grid = new Map<string, string>();

    const startRoom = this.createRoom(0, 0, 'start');
    rooms.set(startRoom.id, startRoom);
    grid.set('0,0', startRoom.id);

    let currentX = 0;
    let currentY = 0;
    let lastDirection: Direction | null = null;

    while (rooms.size < roomCount) {
      const directions: Direction[] = ['north', 'south', 'east', 'west'];
      const availableDirections = directions.filter((d) => d !== this.oppositeDirection(lastDirection));
      const direction = availableDirections[Math.floor(Math.random() * availableDirections.length)];

      const [dx, dy] = this.directionToOffset(direction);
      const newX = currentX + dx;
      const newY = currentY + dy;
      const gridKey = `${newX},${newY}`;

      if (grid.has(gridKey)) {
        const existingRoomId = grid.get(gridKey)!;
        const currentRoom = rooms.get(grid.get(`${currentX},${currentY}`)!)!;
        const existingRoom = rooms.get(existingRoomId)!;

        this.connectRooms(currentRoom, existingRoom, direction);
        currentX = newX;
        currentY = newY;
      } else {
        const newRoom = this.createRoom(newX, newY, 'empty');
        rooms.set(newRoom.id, newRoom);
        grid.set(gridKey, newRoom.id);

        const currentRoom = rooms.get(grid.get(`${currentX},${currentY}`)!)!;
        this.connectRooms(currentRoom, newRoom, direction);

        currentX = newX;
        currentY = newY;
      }

      lastDirection = direction;
    }

    return rooms;
  }

  private assignRoomTypes(rooms: Map<string, DungeonRoom>, floor: number, isFinalFloor: boolean): void {
    const roomList = Array.from(rooms.values());

    const lastRoom = roomList[roomList.length - 1];
    lastRoom.type = isFinalFloor ? 'boss' : 'exit';

    for (let i = 1; i < roomList.length - 1; i++) {
      roomList[i].type = this.weightedRandomType();
    }
  }

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
   * Rooms now have mixed content - primary type plus bonus spawns!
   */
  private populateRoom(room: DungeonRoom, floor: number): void {
    room.contents = [];

    // Add primary content based on room type
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
      case 'puzzle':
        this.addPuzzleContent(room, floor);
        break;
      case 'secret':
        this.addSecretContent(room, floor);
        break;
      case 'boss':
        this.addBossContent(room, floor);
        break;
      case 'exit':
        this.addExitContent(room);
        break;
    }

    // Add bonus content to make exploration worthwhile!
    // Skip safe rooms (start, rest, merchant, exit) and boss rooms
    if (!['start', 'rest', 'merchant', 'exit', 'boss'].includes(room.type)) {
      this.addBonusContent(room, floor);
    }
  }

  /**
   * Add bonus content to rooms - treasure, traps, and enemies can appear anywhere!
   * This makes exploration rewarding even in "trap" rooms.
   */
  private addBonusContent(room: DungeonRoom, floor: number): void {
    // 40% chance for bonus treasure (if not already a treasure room)
    if (room.type !== 'treasure' && Math.random() < 0.4) {
      const pool = this.config.treasurePool;
      const pos = this.getSafePosition(room, 0.15, 0.2, 0.2, 0.6);
      room.contents.push({
        id: this.generateId(),
        type: 'chest',
        x: pos.x,
        y: pos.y,
        data: {
          lootType: pool[Math.floor(Math.random() * pool.length)],
          goldAmount: Math.floor((5 + Math.random() * 10) * floor), // Smaller bonus chest
        },
        triggered: false,
      });
    }

    // 30% chance for bonus traps (if not already a trap room)
    if (room.type !== 'trap' && Math.random() < 0.3) {
      const numTraps = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < numTraps; i++) {
        const pos = this.getSafePosition(room, 0.2, 0.2, 0.6, 0.6);
        room.contents.push({
          id: this.generateId(),
          type: 'trap',
          x: pos.x,
          y: pos.y,
          data: {
            trapType: 'spike',
            damage: 3 + floor, // Slightly weaker bonus traps
          },
          triggered: false,
        });
      }
    }

    // 25% chance for bonus enemy (if not already an enemy room)
    if (room.type !== 'enemy' && Math.random() < 0.25) {
      const pool = this.config.enemyPool;
      const pos = this.getSafePosition(room, 0.55, 0.3, 0.2, 0.4);
      room.contents.push({
        id: this.generateId(),
        type: 'enemy',
        x: pos.x,
        y: pos.y,
        data: {
          enemyType: pool[Math.floor(Math.random() * pool.length)],
          level: floor,
        },
        triggered: false,
      });
    }
  }

  private addEnemyContent(room: DungeonRoom, floor: number): void {
    const enemyCount = 1 + Math.floor(Math.random() * Math.min(3, floor));
    const pool = this.config.enemyPool;

    for (let i = 0; i < enemyCount; i++) {
      const pos = this.getSafePosition(room, 0.3, 0.3, 0.4, 0.4);
      room.contents.push({
        id: this.generateId(),
        type: 'enemy',
        x: pos.x,
        y: pos.y,
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
    // Add 1-3 traps at random positions throughout the room
    const numTraps = 1 + Math.floor(Math.random() * 3);
    const usedPositions: { x: number; y: number }[] = [];

    for (let i = 0; i < numTraps; i++) {
      // Generate random position that avoids doors and other traps
      let pos: { x: number; y: number };
      let attempts = 0;
      do {
        pos = this.getSafePosition(room, 0.2, 0.2, 0.6, 0.6);
        attempts++;
      } while (
        attempts < 10 &&
        usedPositions.some(p => Math.abs(p.x - pos.x) < 0.15 && Math.abs(p.y - pos.y) < 0.15)
      );

      usedPositions.push(pos);

      room.contents.push({
        id: this.generateId(),
        type: 'trap',
        x: pos.x,
        y: pos.y,
        data: {
          trapType: 'spike',
          damage: 5 + floor * 2,
        },
        triggered: false,
      });
    }
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
    // Get tier-appropriate items for the merchant
    const merchantItems = this.getMerchantInventory();
    
    room.contents.push({
      id: this.generateId(),
      type: 'npc',
      x: 0.5,
      y: 0.3,
      data: {
        npcType: 'merchant',
        inventory: merchantItems,
      },
      triggered: false,
    });
  }

  /**
   * Get merchant inventory based on dungeon tier
   * Now includes more variety with consumables, equipment, and special items
   */
  private getMerchantInventory(): string[] {
    const dungeonId = this.config.id;
    
    // Dungeon tier mapping
    const tierMap: Record<string, number> = {
      training: 1,
      forest: 2,
      crystal: 3,
      library: 4,
      volcano: 5,
      void: 6,
    };
    const tier = tierMap[dungeonId] || 1;
    
    // Base consumables per tier
    const consumables: Record<number, string[]> = {
      1: ['health_potion', 'mana_vial', 'strength_tonic'],
      2: ['health_potion', 'greater_potion', 'mana_flask', 'forest_brew', 'yarn_ball_bomb'],
      3: ['greater_potion', 'super_potion', 'mana_crystal', 'crystal_elixir', 'catnip_potion'],
      4: ['super_potion', 'mana_crystal', 'catnip_potion'],
      5: ['super_potion', 'max_potion', 'mana_crystal', 'phoenix_feather'],
      6: ['max_potion', 'void_shield_potion', 'phoenix_feather'],
    };
    
    // Equipment available per tier
    const equipment: Record<number, string[]> = {
      1: ['wooden_sword', 'fishbone_dagger', 'leather_armor', 'lucky_charm'],
      2: ['iron_sword', 'thorn_whip', 'iron_armor', 'tuna_can_shield', 'forest_amulet'],
      3: ['crystal_sword', 'ice_blade', 'crystal_armor', 'frost_ring'],
      4: ['arcane_staff', 'shadow_blade', 'wizard_robe', 'mystic_pendant'],
      5: ['dragon_sword', 'flame_axe', 'dragon_mail', 'fire_heart'],
      6: ['void_blade', 'cosmic_staff', 'void_armor', 'void_amulet'],
    };
    
    // Special items per tier
    const specials: Record<number, string[]> = {
      1: ['training_manual'],
      2: ['catnip_bundle'],
      3: ['escape_rope'],
      4: ['page_of_wisdom'],
      5: ['phoenix_feather'],
      6: ['void_essence'],
    };
    
    // Build inventory: 3-5 consumables + 2-3 equipment + 0-1 special
    const inventory: string[] = [];
    
    // Add consumables (random 3-4 from tier)
    const tierConsumables = consumables[tier] || consumables[1];
    const shuffledConsumables = [...tierConsumables].sort(() => Math.random() - 0.5);
    inventory.push(...shuffledConsumables.slice(0, 3 + Math.floor(Math.random() * 2)));
    
    // Add equipment (random 2-3 from tier)
    const tierEquipment = equipment[tier] || equipment[1];
    const shuffledEquipment = [...tierEquipment].sort(() => Math.random() - 0.5);
    inventory.push(...shuffledEquipment.slice(0, 2 + Math.floor(Math.random() * 2)));
    
    // 50% chance to add a special item
    if (Math.random() < 0.5) {
      const tierSpecials = specials[tier] || specials[1];
      inventory.push(tierSpecials[Math.floor(Math.random() * tierSpecials.length)]);
    }
    
    // Also add lower tier consumables for cheaper options (30% chance)
    if (tier > 1 && Math.random() < 0.3) {
      const lowerTierConsumables = consumables[tier - 1] || [];
      if (lowerTierConsumables.length > 0) {
        inventory.push(lowerTierConsumables[Math.floor(Math.random() * lowerTierConsumables.length)]);
      }
    }
    
    return inventory;
  }

  /**
   * FIXED: Add puzzle content to puzzle rooms
   */
  private addPuzzleContent(room: DungeonRoom, floor: number): void {
    const puzzleType = PUZZLE_TYPES[Math.floor(Math.random() * PUZZLE_TYPES.length)];

    room.contents.push({
      id: this.generateId(),
      type: 'puzzle',
      x: 0.5,
      y: 0.4,
      data: {
        puzzleType: puzzleType.type,
        puzzleName: puzzleType.name,
        rewardType: puzzleType.reward,
        goldReward: 20 * floor + Math.floor(Math.random() * 30 * floor),
        xpReward: 10 * floor,
        solved: false,
      },
      triggered: false,
    });
  }

  /**
   * FIXED: Add secret content to secret rooms
   */
  private addSecretContent(room: DungeonRoom, floor: number): void {
    const secretType = SECRET_TYPES[Math.floor(Math.random() * SECRET_TYPES.length)];

    room.contents.push({
      id: this.generateId(),
      type: 'secret',
      x: 0.5,
      y: 0.5,
      data: {
        secretType: secretType.type,
        secretName: secretType.name,
        rewardType: secretType.reward,
        goldReward: 30 * floor + Math.floor(Math.random() * 50 * floor),
        xpReward: 20 * floor,
        healAmount: secretType.reward === 'full_heal' ? 999 : 0,
        discovered: false,
      },
      triggered: false,
    });
  }

  private addBossContent(room: DungeonRoom, floor: number): void {
    // Add boss enemy
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

    // FIXED: Add exit that appears after boss is defeated
    room.contents.push({
      id: this.generateId(),
      type: 'exit',
      x: 0.5,
      y: 0.7,
      data: {
        requiresBossDefeated: true,
        bossDefeated: false,
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
