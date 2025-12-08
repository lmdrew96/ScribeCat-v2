# StudyQuest KAPLAY Architecture Refactor Plan

## Overview

This document outlines a phased refactor of the StudyQuest game from monolithic scene files to a proper component-based architecture. Each phase is designed to be completable in 1-2 Claude Code sessions while keeping the game functional.

**Current Problems:**
- 400+ line monolithic scene files
- Room transitions reload the entire scene (slow, loses state)
- No component reuse
- Everything inline, hard to test/modify
- State scattered everywhere

**Target Architecture:**
- Thin scene orchestrators
- Reusable component factories
- Centralized state management
- Event-driven communication
- Smooth room transitions without scene reload

---

## New File Structure

```
src/renderer/game/
├── index.ts                    # Game init (enhance existing)
├── config.ts                   # Constants (enhance existing)
│
├── state/                      # NEW: Centralized state
│   ├── index.ts
│   ├── GameState.ts            # Main state manager
│   ├── PlayerState.ts          # Player stats, inventory
│   └── DungeonState.ts         # Floor, room, progress
│
├── components/                 # NEW: Reusable components
│   ├── index.ts
│   ├── player.ts               # Player entity factory
│   ├── door.ts                 # Door with interaction
│   ├── roomContent.ts          # Enemy/chest/NPC entities
│   └── behaviors/              # Custom KAPLAY components
│       ├── playerController.ts
│       └── interactable.ts
│
├── systems/                    # ENHANCE existing
│   ├── index.ts
│   ├── movement.ts             # Player movement
│   ├── interaction.ts          # Proximity detection
│   ├── camera.ts               # Camera follow + effects
│   ├── roomManager.ts          # Room transitions (NEW!)
│   └── minimap.ts              # Already exists
│
├── ui/                         # NEW: UI components
│   ├── index.ts
│   ├── hud.ts                  # Health, XP display
│   ├── prompt.ts               # Interaction prompts
│   └── speechBubble.ts         # Dialog bubbles
│
├── events/                     # NEW: Event system
│   └── GameEvents.ts
│
├── sprites/                    # KEEP as-is
│   └── catSprites.ts
│
└── scenes/                     # REFACTOR to thin orchestrators
    ├── DungeonScene.ts
    ├── TownScene.ts
    └── StudyBuddyScene.ts
```

---

## Phase 1: Foundation (4-5 sessions)

### Step 1.1: Create State Management

**File:** `src/renderer/game/state/GameState.ts`

```typescript
/**
 * GameState - Central state manager for StudyQuest
 * 
 * Persists across scene changes. Scenes read from state,
 * modify through methods.
 */

import type { DungeonFloor, DungeonRoom } from '../../canvas/dungeon/DungeonGenerator.js';
import type { CatColor } from '../sprites/catSprites.js';

export interface PlayerData {
  catColor: CatColor;
  health: number;
  maxHealth: number;
  xp: number;
  level: number;
  gold: number;
}

export interface DungeonData {
  dungeonId: string;
  floorNumber: number;
  floor: DungeonFloor | null;
  currentRoomId: string;
}

class GameStateManager {
  // Player state
  player: PlayerData = {
    catColor: 'brown',
    health: 100,
    maxHealth: 100,
    xp: 0,
    level: 1,
    gold: 0,
  };

  // Dungeon state
  dungeon: DungeonData = {
    dungeonId: 'training',
    floorNumber: 1,
    floor: null,
    currentRoomId: '',
  };

  // Callbacks for external listeners (React views, etc.)
  private listeners: Map<string, Set<Function>> = new Map();

  // Player methods
  setCatColor(color: CatColor): void {
    this.player.catColor = color;
    this.emit('playerChanged', this.player);
  }

  takeDamage(amount: number): void {
    this.player.health = Math.max(0, this.player.health - amount);
    this.emit('healthChanged', this.player.health);
  }

  heal(amount: number): void {
    this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
    this.emit('healthChanged', this.player.health);
  }

  addXP(amount: number): void {
    this.player.xp += amount;
    this.emit('xpChanged', this.player.xp);
    // TODO: Level up logic
  }

  addGold(amount: number): void {
    this.player.gold += amount;
    this.emit('goldChanged', this.player.gold);
  }

  // Dungeon methods
  setFloor(floor: DungeonFloor): void {
    this.dungeon.floor = floor;
    this.dungeon.currentRoomId = floor.startRoomId;
    this.emit('floorChanged', floor);
  }

  setCurrentRoom(roomId: string): void {
    this.dungeon.currentRoomId = roomId;
    const room = this.getCurrentRoom();
    if (room) {
      room.visited = true;
      room.discovered = true;
      this.emit('roomChanged', room);
    }
  }

  getCurrentRoom(): DungeonRoom | null {
    if (!this.dungeon.floor) return null;
    return this.dungeon.floor.rooms.get(this.dungeon.currentRoomId) || null;
  }

  nextFloor(): void {
    this.dungeon.floorNumber++;
    this.dungeon.floor = null;
    this.emit('floorAdvanced', this.dungeon.floorNumber);
  }

  // Event system
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data?: any): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  // Reset for new game
  reset(): void {
    this.player = {
      catColor: this.player.catColor, // Keep color choice
      health: 100,
      maxHealth: 100,
      xp: 0,
      level: 1,
      gold: 0,
    };
    this.dungeon = {
      dungeonId: 'training',
      floorNumber: 1,
      floor: null,
      currentRoomId: '',
    };
    this.emit('reset');
  }
}

// Singleton export
export const GameState = new GameStateManager();
```

**File:** `src/renderer/game/state/index.ts`
```typescript
export { GameState } from './GameState.js';
export type { PlayerData, DungeonData } from './GameState.js';
```

---

### Step 1.2: Create Event Types

**File:** `src/renderer/game/events/GameEvents.ts`

```typescript
/**
 * GameEvents - Type-safe event definitions for KAPLAY
 * 
 * Use with k.on() and k.trigger()
 */

import type { DungeonRoom, RoomContent } from '../../canvas/dungeon/DungeonGenerator.js';

// Event payload types
export interface RoomEnterEvent {
  room: DungeonRoom;
  fromDirection?: 'north' | 'south' | 'east' | 'west';
}

export interface ContentTriggerEvent {
  content: RoomContent;
  room: DungeonRoom;
}

export interface DoorActivateEvent {
  direction: 'north' | 'south' | 'east' | 'west';
  targetRoomId: string;
}

export interface DamageEvent {
  amount: number;
  source: string;
}

// Event name constants (prevents typos)
export const EVENTS = {
  ROOM_ENTER: 'roomEnter',
  ROOM_EXIT: 'roomExit',
  ROOM_CLEAR: 'roomClear',
  CONTENT_TRIGGER: 'contentTrigger',
  DOOR_ACTIVATE: 'doorActivate',
  PLAYER_DAMAGE: 'playerDamage',
  PLAYER_HEAL: 'playerHeal',
  XP_GAIN: 'xpGain',
  GOLD_GAIN: 'goldGain',
  TRANSITION_START: 'transitionStart',
  TRANSITION_END: 'transitionEnd',
} as const;
```

---

### Step 1.3: Create Player Component

**File:** `src/renderer/game/components/player.ts`

```typescript
/**
 * Player Component Factory
 * 
 * Creates the player entity with all necessary components.
 * Movement logic is handled by the movement system, not here.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { loadCatSprites, getCatSpriteName, type CatColor, type Direction } from '../sprites/catSprites.js';

export interface PlayerConfig {
  x: number;
  y: number;
  color: CatColor;
}

export interface PlayerComp {
  direction: Direction;
  isMoving: boolean;
  canMove: boolean;
  setMoving(moving: boolean): void;
  setDirection(dir: Direction): void;
  freeze(): void;
  unfreeze(): void;
}

/**
 * Custom player behavior component
 */
function playerBehavior(): PlayerComp {
  return {
    id: 'playerBehavior',
    direction: 'down' as Direction,
    isMoving: false,
    canMove: true,

    setMoving(moving: boolean) {
      this.isMoving = moving;
    },

    setDirection(dir: Direction) {
      this.direction = dir;
    },

    freeze() {
      this.canMove = false;
    },

    unfreeze() {
      this.canMove = true;
    },
  };
}

/**
 * Create a player entity
 */
export async function createPlayer(
  k: KAPLAYCtx,
  config: PlayerConfig
): Promise<GameObj> {
  // Ensure sprites are loaded
  await loadCatSprites(k, config.color);

  const player = k.add([
    k.sprite(getCatSpriteName(config.color, 'idle')),
    k.pos(config.x, config.y),
    k.anchor('center'),
    k.scale(2),
    k.area({ scale: 0.5 }),
    k.z(10),
    'player',
    playerBehavior(),
  ]);

  player.play('idle');

  return player;
}

/**
 * Update player animation based on state
 */
export function updatePlayerAnimation(
  k: KAPLAYCtx,
  player: GameObj,
  color: CatColor
): void {
  const behavior = player as GameObj & PlayerComp;
  
  if (behavior.isMoving) {
    const walkSprite = getCatSpriteName(color, 'walk');
    if (player.sprite !== walkSprite) {
      player.use(k.sprite(walkSprite));
      player.play('walk');
    }
  } else {
    const idleSprite = getCatSpriteName(color, 'idle');
    if (player.sprite !== idleSprite) {
      player.use(k.sprite(idleSprite));
      player.play('idle');
    }
  }
}
```

---

### Step 1.4: Create Movement System

**File:** `src/renderer/game/systems/movement.ts`

```typescript
/**
 * Movement System
 * 
 * Handles player movement input and physics.
 * Extracted from DungeonScene for reuse.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { PLAYER_SPEED } from '../config.js';
import { updatePlayerAnimation, type PlayerComp } from '../components/player.js';
import type { CatColor } from '../sprites/catSprites.js';

export interface MovementBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface MovementSystemConfig {
  player: GameObj;
  catColor: CatColor;
  bounds: MovementBounds;
  speed?: number;
}

/**
 * Setup movement system for a player
 * Returns a cancel function to stop the system
 */
export function setupMovementSystem(
  k: KAPLAYCtx,
  config: MovementSystemConfig
): () => void {
  const { player, catColor, bounds, speed = PLAYER_SPEED } = config;
  const behavior = player as GameObj & PlayerComp;

  const cancel = k.onUpdate(() => {
    // Skip if player can't move (during transitions, dialogs, etc.)
    if (!behavior.canMove) {
      if (behavior.isMoving) {
        behavior.setMoving(false);
        updatePlayerAnimation(k, player, catColor);
      }
      return;
    }

    // Read input
    let dx = 0;
    let dy = 0;

    if (k.isKeyDown('left') || k.isKeyDown('a')) dx = -1;
    if (k.isKeyDown('right') || k.isKeyDown('d')) dx = 1;
    if (k.isKeyDown('up') || k.isKeyDown('w')) dy = -1;
    if (k.isKeyDown('down') || k.isKeyDown('s')) dy = 1;

    const moving = dx !== 0 || dy !== 0;

    if (moving) {
      // Normalize diagonal movement
      const len = Math.sqrt(dx * dx + dy * dy);
      const moveX = (dx / len) * speed * k.dt();
      const moveY = (dy / len) * speed * k.dt();

      // Apply movement with bounds clamping
      player.pos.x = Math.max(bounds.minX, Math.min(player.pos.x + moveX, bounds.maxX));
      player.pos.y = Math.max(bounds.minY, Math.min(player.pos.y + moveY, bounds.maxY));

      // Update direction
      if (dy < 0) behavior.setDirection('up');
      else if (dy > 0) behavior.setDirection('down');
      else if (dx < 0) behavior.setDirection('left');
      else if (dx > 0) behavior.setDirection('right');

      // Flip sprite for left movement
      player.flipX = dx < 0;
    }

    // Update animation if state changed
    if (moving !== behavior.isMoving) {
      behavior.setMoving(moving);
      updatePlayerAnimation(k, player, catColor);
    }
  });

  return cancel;
}
```

---

### Step 1.5: Create Room Manager (THE BIG FIX!)

**File:** `src/renderer/game/systems/roomManager.ts`

```typescript
/**
 * Room Manager System
 * 
 * Handles room transitions WITHOUT reloading the scene!
 * This is the key architectural improvement.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { GameState } from '../state/index.js';
import { EVENTS, type DoorActivateEvent, type RoomEnterEvent } from '../events/GameEvents.js';
import type { DungeonRoom, RoomContent, Direction as DungeonDirection } from '../../canvas/dungeon/DungeonGenerator.js';

// Room rendering constants (move to config later)
const ROOM_WIDTH = 400;
const ROOM_HEIGHT = 240;
const ROOM_OFFSET_X = 40;
const ROOM_OFFSET_Y = 40;
const DOOR_SIZE = 48;

export interface RoomManagerConfig {
  k: KAPLAYCtx;
  player: GameObj;
  onContentTrigger?: (content: RoomContent, room: DungeonRoom) => void;
  onRoomEnter?: (room: DungeonRoom) => void;
  onRoomClear?: (room: DungeonRoom) => void;
}

/**
 * Room Manager - handles rendering and transitions
 */
export class RoomManager {
  private k: KAPLAYCtx;
  private player: GameObj;
  private roomObjects: GameObj[] = [];
  private isTransitioning = false;

  // Callbacks
  private onContentTrigger?: (content: RoomContent, room: DungeonRoom) => void;
  private onRoomEnter?: (room: DungeonRoom) => void;
  private onRoomClear?: (room: DungeonRoom) => void;

  constructor(config: RoomManagerConfig) {
    this.k = config.k;
    this.player = config.player;
    this.onContentTrigger = config.onContentTrigger;
    this.onRoomEnter = config.onRoomEnter;
    this.onRoomClear = config.onRoomClear;

    // Listen for door activations
    this.k.on(EVENTS.DOOR_ACTIVATE, (e: DoorActivateEvent) => {
      this.transitionToRoom(e.targetRoomId, e.direction);
    });
  }

  /**
   * Render current room (call once on scene start)
   */
  renderCurrentRoom(): void {
    const room = GameState.getCurrentRoom();
    if (!room) return;

    this.clearRoomObjects();
    this.drawRoomBackground();
    this.drawDoors(room);
    this.drawContents(room);

    // Notify listeners
    if (this.onRoomEnter) {
      this.onRoomEnter(room);
    }
    this.k.trigger(EVENTS.ROOM_ENTER, { room } as RoomEnterEvent);
  }

  /**
   * Transition to a new room with fade effect
   */
  async transitionToRoom(targetRoomId: string, fromDirection: DungeonDirection): Promise<void> {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const k = this.k;

    // Freeze player
    (this.player as any).freeze?.();

    // Trigger transition start
    k.trigger(EVENTS.TRANSITION_START);

    // Create fade overlay
    const overlay = k.add([
      k.rect(k.width(), k.height()),
      k.pos(0, 0),
      k.color(0, 0, 0),
      k.opacity(0),
      k.z(1000),
      k.fixed(),
    ]);

    // Fade out
    await k.tween(0, 1, 0.25, (val) => {
      overlay.opacity = val;
    }, k.easings.easeInQuad);

    // Update state
    GameState.setCurrentRoom(targetRoomId);

    // Re-render room
    this.renderCurrentRoom();

    // Reposition player
    const entryPos = this.getEntryPosition(this.oppositeDirection(fromDirection));
    this.player.pos = k.vec2(entryPos.x, entryPos.y);

    // Fade in
    await k.tween(1, 0, 0.25, (val) => {
      overlay.opacity = val;
    }, k.easings.easeOutQuad);

    // Cleanup
    k.destroy(overlay);
    (this.player as any).unfreeze?.();
    this.isTransitioning = false;

    // Trigger transition end
    k.trigger(EVENTS.TRANSITION_END);
  }

  /**
   * Clear all room objects (for transitions)
   */
  private clearRoomObjects(): void {
    for (const obj of this.roomObjects) {
      this.k.destroy(obj);
    }
    this.roomObjects = [];
  }

  /**
   * Draw room background and borders
   */
  private drawRoomBackground(): void {
    const k = this.k;

    // Floor
    this.roomObjects.push(k.add([
      k.rect(ROOM_WIDTH, ROOM_HEIGHT),
      k.pos(ROOM_OFFSET_X, ROOM_OFFSET_Y),
      k.color(42, 42, 78),
      k.z(-10),
    ]));

    // Borders
    const borderColor = k.rgb(26, 26, 46);
    this.roomObjects.push(k.add([k.rect(ROOM_WIDTH, 4), k.pos(ROOM_OFFSET_X, ROOM_OFFSET_Y), k.color(borderColor), k.z(-5)]));
    this.roomObjects.push(k.add([k.rect(ROOM_WIDTH, 4), k.pos(ROOM_OFFSET_X, ROOM_OFFSET_Y + ROOM_HEIGHT - 4), k.color(borderColor), k.z(-5)]));
    this.roomObjects.push(k.add([k.rect(4, ROOM_HEIGHT), k.pos(ROOM_OFFSET_X, ROOM_OFFSET_Y), k.color(borderColor), k.z(-5)]));
    this.roomObjects.push(k.add([k.rect(4, ROOM_HEIGHT), k.pos(ROOM_OFFSET_X + ROOM_WIDTH - 4, ROOM_OFFSET_Y), k.color(borderColor), k.z(-5)]));

    // Grid pattern
    for (let x = ROOM_OFFSET_X; x < ROOM_OFFSET_X + ROOM_WIDTH; x += 32) {
      this.roomObjects.push(k.add([k.rect(1, ROOM_HEIGHT), k.pos(x, ROOM_OFFSET_Y), k.color(255, 255, 255), k.opacity(0.05), k.z(-8)]));
    }
    for (let y = ROOM_OFFSET_Y; y < ROOM_OFFSET_Y + ROOM_HEIGHT; y += 32) {
      this.roomObjects.push(k.add([k.rect(ROOM_WIDTH, 1), k.pos(ROOM_OFFSET_X, y), k.color(255, 255, 255), k.opacity(0.05), k.z(-8)]));
    }
  }

  /**
   * Draw doors for current room
   */
  private drawDoors(room: DungeonRoom): void {
    const k = this.k;
    const positions = this.getDoorPositions();

    for (const [direction, pos] of Object.entries(positions)) {
      const dir = direction as DungeonDirection;
      const targetRoomId = room.connections[dir];
      if (!targetRoomId) continue;

      // Door visual
      const door = k.add([
        k.rect(DOOR_SIZE, DOOR_SIZE),
        k.pos(pos.x - DOOR_SIZE / 2, pos.y - DOOR_SIZE / 2),
        k.color(74, 222, 128),
        k.area(),
        k.z(0),
        'door',
        { direction: dir, targetRoomId },
      ]);
      this.roomObjects.push(door);

      // Arrow
      const arrows: Record<DungeonDirection, string> = { north: '^', south: 'v', east: '>', west: '<' };
      this.roomObjects.push(k.add([
        k.text(arrows[dir], { size: 20 }),
        k.pos(pos.x, pos.y),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.z(1),
      ]));
    }
  }

  /**
   * Draw room contents (enemies, chests, etc.)
   */
  private drawContents(room: DungeonRoom): void {
    const k = this.k;

    const CONTENT_COLORS: Record<string, string> = {
      enemy: '#ef4444',
      chest: '#fbbf24',
      chestOpen: '#78350f',
      trap: '#dc2626',
      npc: '#60a5fa',
      exit: '#a855f7',
      interactable: '#22c55e',
    };

    for (const content of room.contents) {
      if (content.type === 'enemy' && content.triggered) continue;

      const x = ROOM_OFFSET_X + content.x * ROOM_WIDTH;
      const y = ROOM_OFFSET_Y + content.y * ROOM_HEIGHT;

      const colorHex = content.type === 'chest' && content.triggered
        ? CONTENT_COLORS.chestOpen
        : CONTENT_COLORS[content.type] || '#ffffff';

      const r = parseInt(colorHex.slice(1, 3), 16);
      const g = parseInt(colorHex.slice(3, 5), 16);
      const b = parseInt(colorHex.slice(5, 7), 16);

      const obj = k.add([
        k.circle(12),
        k.pos(x, y),
        k.anchor('center'),
        k.color(r, g, b),
        k.area({ shape: new k.Circle(k.vec2(0, 0), 22) }),
        k.z(5),
        'content',
        { contentData: content },
      ]);
      this.roomObjects.push(obj);

      // Icon
      const icons: Record<string, string> = { enemy: '!', chest: '$', trap: 'X', npc: '?', exit: 'v' };
      if (icons[content.type]) {
        this.roomObjects.push(k.add([
          k.text(icons[content.type], { size: 14 }),
          k.pos(x, y),
          k.anchor('center'),
          k.color(255, 255, 255),
          k.z(6),
        ]));
      }
    }
  }

  /**
   * Get door positions relative to room
   */
  private getDoorPositions(): Record<DungeonDirection, { x: number; y: number }> {
    return {
      north: { x: ROOM_OFFSET_X + ROOM_WIDTH / 2, y: ROOM_OFFSET_Y + DOOR_SIZE / 2 },
      south: { x: ROOM_OFFSET_X + ROOM_WIDTH / 2, y: ROOM_OFFSET_Y + ROOM_HEIGHT - DOOR_SIZE / 2 },
      east: { x: ROOM_OFFSET_X + ROOM_WIDTH - DOOR_SIZE / 2, y: ROOM_OFFSET_Y + ROOM_HEIGHT / 2 },
      west: { x: ROOM_OFFSET_X + DOOR_SIZE / 2, y: ROOM_OFFSET_Y + ROOM_HEIGHT / 2 },
    };
  }

  /**
   * Get player entry position based on which door they came from
   */
  private getEntryPosition(fromDirection?: DungeonDirection): { x: number; y: number } {
    const centerX = ROOM_OFFSET_X + ROOM_WIDTH / 2;
    const centerY = ROOM_OFFSET_Y + ROOM_HEIGHT / 2;
    const margin = 60;

    switch (fromDirection) {
      case 'north': return { x: centerX, y: ROOM_OFFSET_Y + margin };
      case 'south': return { x: centerX, y: ROOM_OFFSET_Y + ROOM_HEIGHT - margin };
      case 'east': return { x: ROOM_OFFSET_X + ROOM_WIDTH - margin, y: centerY };
      case 'west': return { x: ROOM_OFFSET_X + margin, y: centerY };
      default: return { x: centerX, y: centerY };
    }
  }

  /**
   * Get opposite direction
   */
  private oppositeDirection(dir: DungeonDirection): DungeonDirection {
    const map: Record<DungeonDirection, DungeonDirection> = {
      north: 'south', south: 'north', east: 'west', west: 'east'
    };
    return map[dir];
  }

  /**
   * Get movement bounds for current room
   */
  getMovementBounds() {
    const margin = 16;
    return {
      minX: ROOM_OFFSET_X + margin,
      maxX: ROOM_OFFSET_X + ROOM_WIDTH - margin,
      minY: ROOM_OFFSET_Y + margin,
      maxY: ROOM_OFFSET_Y + ROOM_HEIGHT - margin,
    };
  }

  /**
   * Check if transitioning (for input blocking)
   */
  get transitioning(): boolean {
    return this.isTransitioning;
  }
}
```

---

### Step 1.6: Refactor DungeonScene (Thin Orchestrator)

**File:** `src/renderer/game/scenes/DungeonScene.ts` (REPLACE)

```typescript
/**
 * DungeonScene - REFACTORED
 * 
 * Now a thin orchestrator that wires up systems and components.
 * All heavy logic lives in systems/ and components/.
 */

import type { KAPLAYCtx } from 'kaplay';
import { GameState } from '../state/index.js';
import { EVENTS, type DoorActivateEvent } from '../events/GameEvents.js';
import { createPlayer, type PlayerComp } from '../components/player.js';
import { setupMovementSystem } from '../systems/movement.js';
import { RoomManager } from '../systems/roomManager.js';
import { DungeonGenerator, type DungeonFloor, type DungeonRoom, type RoomContent } from '../../canvas/dungeon/DungeonGenerator.js';
import type { CatColor } from '../sprites/catSprites.js';

const TRIGGER_DISTANCE = 40;
const DOOR_SIZE = 48;

export interface DungeonSceneData {
  catColor?: CatColor;
  dungeonId?: string;
  floorNumber?: number;
  floor?: DungeonFloor;
  onContentTrigger?: (content: RoomContent, room: DungeonRoom) => void;
  onRoomEnter?: (room: DungeonRoom) => void;
  onRoomClear?: (room: DungeonRoom) => void;
  onFloorComplete?: (floorNumber: number) => void;
}

export function registerDungeonScene(k: KAPLAYCtx): void {
  k.scene('dungeon', async (data: DungeonSceneData) => {
    // 1. Setup state
    const catColor = data.catColor || GameState.player.catColor;
    GameState.setCatColor(catColor);

    if (data.dungeonId) GameState.dungeon.dungeonId = data.dungeonId;
    if (data.floorNumber) GameState.dungeon.floorNumber = data.floorNumber;

    // Generate or use provided floor
    if (data.floor) {
      GameState.setFloor(data.floor);
    } else if (!GameState.dungeon.floor) {
      const generator = new DungeonGenerator(GameState.dungeon.dungeonId);
      const floor = generator.generate(GameState.dungeon.floorNumber);
      GameState.setFloor(floor);
    }

    // 2. Create player
    const startRoom = GameState.getCurrentRoom()!;
    const player = await createPlayer(k, {
      x: 240, // Center of room
      y: 160,
      color: catColor,
    });

    // 3. Setup room manager
    const roomManager = new RoomManager({
      k,
      player,
      onContentTrigger: data.onContentTrigger,
      onRoomEnter: data.onRoomEnter,
      onRoomClear: data.onRoomClear,
    });

    // Render initial room
    roomManager.renderCurrentRoom();

    // 4. Setup movement system
    const cancelMovement = setupMovementSystem(k, {
      player,
      catColor,
      bounds: roomManager.getMovementBounds(),
    });

    // 5. Setup interaction system
    let highlightedDoor: string | null = null;
    let nearbyContent: RoomContent | null = null;

    k.onUpdate(() => {
      if (roomManager.transitioning) return;

      const room = GameState.getCurrentRoom();
      if (!room) return;

      // Check door proximity
      highlightedDoor = null;
      const doors = k.get('door');
      for (const door of doors) {
        const dist = player.pos.dist(door.pos.add(k.vec2(DOOR_SIZE / 2, DOOR_SIZE / 2)));
        if (dist < DOOR_SIZE) {
          highlightedDoor = (door as any).direction;
          break;
        }
      }

      // Check content proximity
      nearbyContent = null;
      for (const content of room.contents) {
        if (content.triggered && content.type !== 'npc') continue;

        const contentX = 40 + content.x * 400;
        const contentY = 40 + content.y * 240;
        const dist = player.pos.dist(k.vec2(contentX, contentY));

        if (dist < TRIGGER_DISTANCE) {
          if (content.type === 'npc') {
            nearbyContent = content;
          } else {
            // Auto-trigger non-NPC content
            if (data.onContentTrigger) {
              data.onContentTrigger(content, room);
            }
            content.triggered = true;

            // Check room clear
            const enemies = room.contents.filter(c => c.type === 'enemy' && !c.triggered);
            if (enemies.length === 0 && !room.cleared) {
              room.cleared = true;
              if (data.onRoomClear) data.onRoomClear(room);
            }
          }
          break;
        }
      }
    });

    // 6. Setup input handlers
    k.onKeyPress('enter', () => handleInteraction());
    k.onKeyPress('space', () => handleInteraction());

    function handleInteraction() {
      if (roomManager.transitioning) return;

      if (highlightedDoor) {
        const room = GameState.getCurrentRoom()!;
        const targetRoomId = room.connections[highlightedDoor as keyof typeof room.connections];
        if (targetRoomId) {
          k.trigger(EVENTS.DOOR_ACTIVATE, {
            direction: highlightedDoor,
            targetRoomId,
          } as DoorActivateEvent);
        }
      } else if (nearbyContent) {
        if (data.onContentTrigger) {
          data.onContentTrigger(nearbyContent, GameState.getCurrentRoom()!);
        }
      }
    }

    // 7. Setup UI drawing
    k.onDraw(() => {
      const room = GameState.getCurrentRoom();
      if (!room) return;

      // Room type label
      k.drawRect({
        pos: k.vec2(10, 10),
        width: 120,
        height: 24,
        color: k.rgb(0, 0, 0),
        opacity: 0.6,
      });
      k.drawText({
        text: `Room: ${room.type.charAt(0).toUpperCase() + room.type.slice(1)}`,
        pos: k.vec2(16, 26),
        size: 11,
        color: k.rgb(255, 255, 255),
      });

      // Interaction prompts
      if (highlightedDoor && !roomManager.transitioning) {
        drawPrompt(k, 'Press ENTER to go through door', k.rgb(251, 191, 36));
      } else if (nearbyContent && !roomManager.transitioning) {
        drawPrompt(k, 'Press ENTER to interact', k.rgb(96, 165, 250));
      }
    });

    function drawPrompt(k: KAPLAYCtx, text: string, color: any) {
      k.drawRect({
        pos: k.vec2(k.width() / 2 - 80, k.height() - 30),
        width: 160,
        height: 24,
        color: k.rgb(0, 0, 0),
        opacity: 0.7,
      });
      k.drawText({
        text,
        pos: k.vec2(k.width() / 2, k.height() - 14),
        size: 11,
        anchor: 'center',
        color,
      });
    }
  });
}
```

---

## Phase 2: Quick Wins (2-3 sessions)

After Phase 1 is complete, these improvements become easy:

### 2.1: Add Camera Shake

**In `src/renderer/game/systems/camera.ts`:**
```typescript
export function shakeCamera(k: KAPLAYCtx, intensity = 5, duration = 0.2) {
  const originalPos = k.getCamPos();
  let elapsed = 0;
  
  const cancel = k.onUpdate(() => {
    elapsed += k.dt();
    if (elapsed >= duration) {
      k.setCamPos(originalPos);
      cancel();
      return;
    }
    
    const decay = 1 - (elapsed / duration);
    const offsetX = (Math.random() - 0.5) * intensity * decay;
    const offsetY = (Math.random() - 0.5) * intensity * decay;
    k.setCamPos(originalPos.add(k.vec2(offsetX, offsetY)));
  });
}
```

### 2.2: Add Simple HUD

**In `src/renderer/game/ui/hud.ts`:**
```typescript
export function drawHUD(k: KAPLAYCtx) {
  const { health, maxHealth, xp, gold } = GameState.player;
  
  // Health bar
  k.drawRect({ pos: k.vec2(10, k.height() - 30), width: 100, height: 10, color: k.rgb(50, 50, 50) });
  k.drawRect({ pos: k.vec2(10, k.height() - 30), width: (health / maxHealth) * 100, height: 10, color: k.rgb(239, 68, 68) });
  
  // XP and Gold
  k.drawText({ text: `XP: ${xp}`, pos: k.vec2(120, k.height() - 25), size: 10, color: k.rgb(250, 204, 21) });
  k.drawText({ text: `Gold: ${gold}`, pos: k.vec2(180, k.height() - 25), size: 10, color: k.rgb(251, 191, 36) });
}
```

### 2.3: Flash Effect on Damage

```typescript
export function flashDamage(k: KAPLAYCtx, entity: GameObj, color = k.rgb(255, 0, 0)) {
  const originalColor = entity.color;
  entity.color = color;
  k.wait(0.1, () => { entity.color = originalColor; });
}
```

### 2.4: Integrate Minimap

The minimap system already exists at `src/renderer/game/systems/minimap.ts` - just need to call it in the scene's onDraw.

---

## Implementation Order

1. **Create state/GameState.ts** - Foundation for everything
2. **Create events/GameEvents.ts** - Event definitions
3. **Create components/player.ts** - Extract player component
4. **Create systems/movement.ts** - Extract movement logic
5. **Create systems/roomManager.ts** - THE BIG WIN (smooth transitions)
6. **Refactor DungeonScene.ts** - Wire it all together
7. **Test dungeon thoroughly**
8. **Apply same pattern to TownScene**
9. **Add quick wins (HUD, camera shake, etc.)**

---

## Testing Checklist

After each step, verify:
- [ ] Game still launches
- [ ] Player can move with WASD/arrows
- [ ] Player animation switches between idle/walk
- [ ] Doors are visible and interactable
- [ ] Room transitions work (smooth fade now!)
- [ ] Content (enemies, chests) triggers on proximity
- [ ] No console errors

---

## Notes for Claude Code

- Each file should be created one at a time
- Test after each major file creation
- If something breaks, the old DungeonScene.ts is in git history
- The state/ and events/ files have no dependencies, create those first
- The components/ and systems/ files depend on state/ and events/
- The scene refactor depends on everything else

**Start with:** "Create the GameState.ts file in src/renderer/game/state/"
