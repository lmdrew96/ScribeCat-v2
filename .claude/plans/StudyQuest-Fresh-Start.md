# StudyQuest Fresh Start - KAPLAY Rebuild

## Overview

We're nuking the current StudyQuest implementation and rebuilding from scratch. The architecture patterns are good, but the implementation is buggy and carries too much legacy baggage.

**Keep:**
- `src/renderer/game/state/GameState.ts` - good pattern, may need cleanup
- `src/renderer/game/events/GameEvents.ts` - good pattern
- `src/renderer/game/sprites/catSprites.ts` - works fine
- `src/renderer/game/config.ts` - keep constants
- `src/renderer/game/index.ts` - KAPLAY init is fine
- `src/renderer/canvas/dungeon/DungeonGenerator.ts` - procedural generation works
- `src/renderer/canvas/town/TownLayout.ts` - tilemap data is fine
- All assets (`assets/sprites/`, `assets/Tiles/`, etc.)

**Delete:**
- `src/renderer/game/ui/` - entire folder, it's fucked
- `src/renderer/game/systems/` - all files EXCEPT keep `minimap.ts` as reference
- `src/renderer/game/components/` - rebuild fresh
- `src/renderer/game/scenes/DungeonScene.ts` - rebuild
- `src/renderer/game/scenes/TownScene.ts` - rebuild  
- `src/renderer/game/scenes/StudyBuddyScene.ts` - rebuild
- `src/renderer/game/DungeonGame.ts` - rebuild
- `src/renderer/game/TownGame.ts` - rebuild
- `src/renderer/game/StudyBuddyGame.ts` - rebuild

---

## Phase 1: Clean Slate

### Step 1.1: Delete the Broken Stuff

```bash
# Delete broken UI
rm -rf src/renderer/game/ui/

# Delete broken systems (keep minimap as reference)
mv src/renderer/game/systems/minimap.ts src/renderer/game/minimap-reference.ts
rm -rf src/renderer/game/systems/
mkdir src/renderer/game/systems
mv src/renderer/game/minimap-reference.ts src/renderer/game/systems/minimap-reference.ts

# Delete broken components
rm -rf src/renderer/game/components/

# Delete broken scenes
rm src/renderer/game/scenes/DungeonScene.ts
rm src/renderer/game/scenes/TownScene.ts
rm src/renderer/game/scenes/StudyBuddyScene.ts

# Delete broken game wrappers
rm src/renderer/game/DungeonGame.ts
rm src/renderer/game/TownGame.ts
rm src/renderer/game/StudyBuddyGame.ts
```

### Step 1.2: Clean Up GameState

Simplify `src/renderer/game/state/GameState.ts` - remove anything that references deleted systems:

```typescript
/**
 * GameState - Central state manager for StudyQuest
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
  player: PlayerData = {
    catColor: 'brown',
    health: 100,
    maxHealth: 100,
    xp: 0,
    level: 1,
    gold: 0,
  };

  dungeon: DungeonData = {
    dungeonId: 'training',
    floorNumber: 1,
    floor: null,
    currentRoomId: '',
  };

  // Simple event emitter
  private listeners: Map<string, Set<(data?: unknown) => void>> = new Map();

  setCatColor(color: CatColor): void {
    this.player.catColor = color;
    this.emit('playerChanged');
  }

  setFloor(floor: DungeonFloor): void {
    this.dungeon.floor = floor;
    this.dungeon.currentRoomId = floor.startRoomId;
    this.emit('floorChanged');
  }

  setCurrentRoom(roomId: string): void {
    this.dungeon.currentRoomId = roomId;
    const room = this.getCurrentRoom();
    if (room) {
      room.visited = true;
      room.discovered = true;
    }
    this.emit('roomChanged');
  }

  getCurrentRoom(): DungeonRoom | null {
    if (!this.dungeon.floor) return null;
    return this.dungeon.floor.rooms.get(this.dungeon.currentRoomId) || null;
  }

  on(event: string, callback: (data?: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data?: unknown) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data?: unknown): void {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }

  reset(): void {
    this.player = {
      catColor: this.player.catColor,
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

export const GameState = new GameStateManager();
```

### Step 1.3: Simplify Events

Keep `src/renderer/game/events/GameEvents.ts` simple:

```typescript
/**
 * Game Events - Simple event constants
 */

export const EVENTS = {
  // Room events
  ROOM_ENTER: 'roomEnter',
  ROOM_CLEAR: 'roomClear',
  
  // Door events  
  DOOR_ACTIVATE: 'doorActivate',
  
  // Transition events
  TRANSITION_START: 'transitionStart',
  TRANSITION_END: 'transitionEnd',
  
  // Content events
  CONTENT_TRIGGER: 'contentTrigger',
} as const;

export type DungeonDirection = 'north' | 'south' | 'east' | 'west';

export interface DoorActivateEvent {
  direction: DungeonDirection;
  targetRoomId: string;
}
```

---

## Phase 2: Build the Foundation

### Step 2.1: Create Player Component

**File:** `src/renderer/game/components/Player.ts`

Keep it dead simple. One file, one job.

```typescript
/**
 * Player Component
 * 
 * Creates and manages the player cat entity.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { loadCatSprites, getCatSpriteName, type CatColor } from '../sprites/catSprites.js';

export interface PlayerConfig {
  k: KAPLAYCtx;
  x: number;
  y: number;
  color: CatColor;
}

export interface Player {
  entity: GameObj;
  color: CatColor;
  isMoving: boolean;
  canMove: boolean;
  
  freeze(): void;
  unfreeze(): void;
  moveTo(x: number, y: number): void;
  setAnimation(anim: 'idle' | 'walk'): void;
}

export async function createPlayer(config: PlayerConfig): Promise<Player> {
  const { k, x, y, color } = config;
  
  await loadCatSprites(k, color);
  
  const entity = k.add([
    k.sprite(getCatSpriteName(color, 'idle')),
    k.pos(x, y),
    k.anchor('center'),
    k.scale(2),
    k.area({ scale: 0.5 }),
    k.z(10),
    'player',
  ]);
  
  entity.play('idle');
  
  let isMoving = false;
  let canMove = true;
  let currentAnim: 'idle' | 'walk' = 'idle';
  
  const player: Player = {
    entity,
    color,
    
    get isMoving() { return isMoving; },
    set isMoving(val: boolean) { isMoving = val; },
    
    get canMove() { return canMove; },
    set canMove(val: boolean) { canMove = val; },
    
    freeze() {
      canMove = false;
    },
    
    unfreeze() {
      canMove = true;
    },
    
    moveTo(newX: number, newY: number) {
      entity.pos.x = newX;
      entity.pos.y = newY;
    },
    
    setAnimation(anim: 'idle' | 'walk') {
      if (currentAnim === anim) return;
      currentAnim = anim;
      entity.use(k.sprite(getCatSpriteName(color, anim)));
      entity.play(anim);
    },
  };
  
  return player;
}
```

### Step 2.2: Create Movement System

**File:** `src/renderer/game/systems/movement.ts`

```typescript
/**
 * Movement System
 * 
 * Handles player input and movement.
 */

import type { KAPLAYCtx } from 'kaplay';
import type { Player } from '../components/Player.js';

export interface MovementBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface MovementConfig {
  k: KAPLAYCtx;
  player: Player;
  speed: number;
  bounds: MovementBounds;
}

export function setupMovement(config: MovementConfig): () => void {
  const { k, player, speed, bounds } = config;
  
  const cancel = k.onUpdate(() => {
    if (!player.canMove) {
      if (player.isMoving) {
        player.isMoving = false;
        player.setAnimation('idle');
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
      // Normalize diagonal
      const len = Math.sqrt(dx * dx + dy * dy);
      const moveX = (dx / len) * speed * k.dt();
      const moveY = (dy / len) * speed * k.dt();
      
      // Apply with bounds
      const newX = Math.max(bounds.minX, Math.min(player.entity.pos.x + moveX, bounds.maxX));
      const newY = Math.max(bounds.minY, Math.min(player.entity.pos.y + moveY, bounds.maxY));
      player.moveTo(newX, newY);
      
      // Flip sprite
      player.entity.flipX = dx < 0;
      
      if (!player.isMoving) {
        player.isMoving = true;
        player.setAnimation('walk');
      }
    } else {
      if (player.isMoving) {
        player.isMoving = false;
        player.setAnimation('idle');
      }
    }
  });
  
  return cancel;
}
```

### Step 2.3: Create Room Renderer

**File:** `src/renderer/game/systems/RoomRenderer.ts`

This just draws rooms. No transitions, no logic. Pure rendering.

```typescript
/**
 * Room Renderer
 * 
 * Draws dungeon rooms. That's it.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import type { DungeonRoom, RoomContent, ContentType } from '../../canvas/dungeon/DungeonGenerator.js';

export interface RoomConfig {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  doorSize: number;
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  width: 400,
  height: 240,
  offsetX: 40,
  offsetY: 40,
  doorSize: 48,
};

export type DungeonDirection = 'north' | 'south' | 'east' | 'west';

const CONTENT_COLORS: Record<string, [number, number, number]> = {
  enemy: [239, 68, 68],
  chest: [251, 191, 36],
  chestOpen: [120, 53, 15],
  trap: [220, 38, 38],
  npc: [96, 165, 250],
  exit: [168, 85, 247],
  interactable: [34, 197, 94],
};

const CONTENT_ICONS: Partial<Record<ContentType, string>> = {
  enemy: '!',
  chest: '$',
  trap: 'X',
  npc: '?',
  exit: '↓',
};

export class RoomRenderer {
  private k: KAPLAYCtx;
  private config: RoomConfig;
  private objects: GameObj[] = [];
  
  constructor(k: KAPLAYCtx, config: RoomConfig = DEFAULT_ROOM_CONFIG) {
    this.k = k;
    this.config = config;
  }
  
  /**
   * Clear all rendered objects
   */
  clear(): void {
    for (const obj of this.objects) {
      this.k.destroy(obj);
    }
    this.objects = [];
  }
  
  /**
   * Render a room
   */
  render(room: DungeonRoom): void {
    this.clear();
    this.drawBackground();
    this.drawDoors(room);
    this.drawContents(room);
  }
  
  /**
   * Get door positions
   */
  getDoorPositions(): Record<DungeonDirection, { x: number; y: number }> {
    const { width, height, offsetX, offsetY, doorSize } = this.config;
    return {
      north: { x: offsetX + width / 2, y: offsetY + doorSize / 2 },
      south: { x: offsetX + width / 2, y: offsetY + height - doorSize / 2 },
      east: { x: offsetX + width - doorSize / 2, y: offsetY + height / 2 },
      west: { x: offsetX + doorSize / 2, y: offsetY + height / 2 },
    };
  }
  
  /**
   * Get movement bounds
   */
  getMovementBounds() {
    const { width, height, offsetX, offsetY } = this.config;
    const margin = 16;
    return {
      minX: offsetX + margin,
      maxX: offsetX + width - margin,
      minY: offsetY + margin,
      maxY: offsetY + height - margin,
    };
  }
  
  /**
   * Get entry position for a direction
   */
  getEntryPosition(fromDirection?: DungeonDirection): { x: number; y: number } {
    const { width, height, offsetX, offsetY } = this.config;
    const centerX = offsetX + width / 2;
    const centerY = offsetY + height / 2;
    const margin = 60;
    
    switch (fromDirection) {
      case 'north': return { x: centerX, y: offsetY + margin };
      case 'south': return { x: centerX, y: offsetY + height - margin };
      case 'east': return { x: offsetX + width - margin, y: centerY };
      case 'west': return { x: offsetX + margin, y: centerY };
      default: return { x: centerX, y: centerY };
    }
  }
  
  private drawBackground(): void {
    const k = this.k;
    const { width, height, offsetX, offsetY } = this.config;
    
    // Floor
    this.objects.push(k.add([
      k.rect(width, height),
      k.pos(offsetX, offsetY),
      k.color(42, 42, 78),
      k.z(-10),
    ]));
    
    // Border
    const border = k.rgb(26, 26, 46);
    this.objects.push(k.add([k.rect(width, 4), k.pos(offsetX, offsetY), k.color(border), k.z(-5)]));
    this.objects.push(k.add([k.rect(width, 4), k.pos(offsetX, offsetY + height - 4), k.color(border), k.z(-5)]));
    this.objects.push(k.add([k.rect(4, height), k.pos(offsetX, offsetY), k.color(border), k.z(-5)]));
    this.objects.push(k.add([k.rect(4, height), k.pos(offsetX + width - 4, offsetY), k.color(border), k.z(-5)]));
    
    // Grid
    for (let x = offsetX; x < offsetX + width; x += 32) {
      this.objects.push(k.add([k.rect(1, height), k.pos(x, offsetY), k.color(255, 255, 255), k.opacity(0.05), k.z(-8)]));
    }
    for (let y = offsetY; y < offsetY + height; y += 32) {
      this.objects.push(k.add([k.rect(width, 1), k.pos(offsetX, y), k.color(255, 255, 255), k.opacity(0.05), k.z(-8)]));
    }
  }
  
  private drawDoors(room: DungeonRoom): void {
    const k = this.k;
    const { doorSize } = this.config;
    const positions = this.getDoorPositions();
    const arrows: Record<DungeonDirection, string> = { north: '^', south: 'v', east: '>', west: '<' };
    
    for (const [dir, pos] of Object.entries(positions)) {
      const direction = dir as DungeonDirection;
      const targetRoomId = room.connections[direction];
      if (!targetRoomId) continue;
      
      // Door
      const door = k.add([
        k.rect(doorSize, doorSize),
        k.pos(pos.x - doorSize / 2, pos.y - doorSize / 2),
        k.color(74, 222, 128),
        k.area(),
        k.z(0),
        'door',
        { direction, targetRoomId },
      ]);
      this.objects.push(door);
      
      // Arrow
      this.objects.push(k.add([
        k.text(arrows[direction], { size: 20 }),
        k.pos(pos.x, pos.y),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.z(1),
      ]));
    }
  }
  
  private drawContents(room: DungeonRoom): void {
    const k = this.k;
    const { width, height, offsetX, offsetY } = this.config;
    
    for (const content of room.contents) {
      if (content.type === 'enemy' && content.triggered) continue;
      
      const x = offsetX + content.x * width;
      const y = offsetY + content.y * height;
      
      const colorKey = content.type === 'chest' && content.triggered ? 'chestOpen' : content.type;
      const color = CONTENT_COLORS[colorKey] || [255, 255, 255];
      
      // Circle
      const obj = k.add([
        k.circle(12),
        k.pos(x, y),
        k.anchor('center'),
        k.color(color[0], color[1], color[2]),
        k.area({ shape: new k.Circle(k.vec2(0, 0), 22) }),
        k.z(5),
        'content',
        { contentData: content },
      ]);
      this.objects.push(obj);
      
      // Icon
      const icon = CONTENT_ICONS[content.type];
      if (icon) {
        this.objects.push(k.add([
          k.text(icon, { size: 14 }),
          k.pos(x, y),
          k.anchor('center'),
          k.color(255, 255, 255),
          k.z(6),
        ]));
      }
    }
  }
}
```

---

## Phase 3: Build the Dungeon Scene

### Step 3.1: Create DungeonScene

**File:** `src/renderer/game/scenes/DungeonScene.ts`

Simple. Clean. Works.

```typescript
/**
 * DungeonScene
 * 
 * The dungeon exploration scene. Simple orchestrator.
 */

import type { KAPLAYCtx } from 'kaplay';
import { GameState } from '../state/GameState.js';
import { EVENTS, type DoorActivateEvent, type DungeonDirection } from '../events/GameEvents.js';
import { createPlayer, type Player } from '../components/Player.js';
import { setupMovement } from '../systems/movement.js';
import { RoomRenderer } from '../systems/RoomRenderer.js';
import { DungeonGenerator, type DungeonFloor, type DungeonRoom, type RoomContent } from '../../canvas/dungeon/DungeonGenerator.js';
import type { CatColor } from '../sprites/catSprites.js';
import { PLAYER_SPEED } from '../config.js';

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 320;
const DOOR_SIZE = 48;
const TRIGGER_DISTANCE = 40;

export interface DungeonSceneData {
  catColor?: CatColor;
  dungeonId?: string;
  floorNumber?: number;
  floor?: DungeonFloor;
  onContentTrigger?: (content: RoomContent, room: DungeonRoom) => void;
  onRoomEnter?: (room: DungeonRoom) => void;
  onRoomClear?: (room: DungeonRoom) => void;
}

export function registerDungeonScene(k: KAPLAYCtx): void {
  k.scene('dungeon', async (data: DungeonSceneData) => {
    // --- SETUP ---
    const catColor = data.catColor || GameState.player.catColor;
    GameState.setCatColor(catColor);
    
    // Floor
    if (data.floor) {
      GameState.setFloor(data.floor);
    } else if (!GameState.dungeon.floor) {
      const generator = new DungeonGenerator(data.dungeonId || 'training');
      GameState.setFloor(generator.generate(data.floorNumber || 1));
    }
    
    // Renderer
    const renderer = new RoomRenderer(k);
    
    // Player
    const startPos = renderer.getEntryPosition();
    const player = await createPlayer({
      k,
      x: startPos.x,
      y: startPos.y,
      color: catColor,
    });
    
    // Render first room
    renderer.render(GameState.getCurrentRoom()!);
    if (data.onRoomEnter) data.onRoomEnter(GameState.getCurrentRoom()!);
    
    // Movement
    setupMovement({
      k,
      player,
      speed: PLAYER_SPEED,
      bounds: renderer.getMovementBounds(),
    });
    
    // --- STATE ---
    let isTransitioning = false;
    let highlightedDoor: DungeonDirection | null = null;
    
    // --- INTERACTION DETECTION ---
    k.onUpdate(() => {
      if (isTransitioning) return;
      
      const room = GameState.getCurrentRoom();
      if (!room) return;
      
      // Check doors
      highlightedDoor = null;
      const doorPositions = renderer.getDoorPositions();
      for (const [dir, pos] of Object.entries(doorPositions)) {
        if (!room.connections[dir as DungeonDirection]) continue;
        if (player.entity.pos.dist(k.vec2(pos.x, pos.y)) < DOOR_SIZE) {
          highlightedDoor = dir as DungeonDirection;
          break;
        }
      }
      
      // Check content
      for (const content of room.contents) {
        if (content.triggered) continue;
        
        const bounds = renderer.getMovementBounds();
        const roomWidth = bounds.maxX - bounds.minX + 32;
        const roomHeight = bounds.maxY - bounds.minY + 32;
        const x = bounds.minX - 16 + content.x * roomWidth;
        const y = bounds.minY - 16 + content.y * roomHeight;
        
        if (player.entity.pos.dist(k.vec2(x, y)) < TRIGGER_DISTANCE) {
          if (content.type !== 'npc') {
            content.triggered = true;
            if (data.onContentTrigger) data.onContentTrigger(content, room);
            
            // Check room clear
            if (!room.cleared && room.contents.filter(c => c.type === 'enemy' && !c.triggered).length === 0) {
              room.cleared = true;
              if (data.onRoomClear) data.onRoomClear(room);
            }
            
            // Re-render to remove triggered content
            renderer.render(room);
          }
          break;
        }
      }
    });
    
    // --- INPUT ---
    const handleInteraction = () => {
      if (isTransitioning || !highlightedDoor) return;
      
      const room = GameState.getCurrentRoom()!;
      const targetRoomId = room.connections[highlightedDoor];
      if (!targetRoomId) return;
      
      transitionToRoom(targetRoomId, highlightedDoor);
    };
    
    k.onKeyPress('enter', handleInteraction);
    k.onKeyPress('space', handleInteraction);
    
    // --- ROOM TRANSITION ---
    async function transitionToRoom(targetRoomId: string, fromDir: DungeonDirection) {
      isTransitioning = true;
      player.freeze();
      
      // Fade out
      const overlay = k.add([
        k.rect(CANVAS_WIDTH, CANVAS_HEIGHT),
        k.pos(0, 0),
        k.color(0, 0, 0),
        k.opacity(0),
        k.z(1000),
      ]);
      
      await k.tween(0, 1, 0.2, v => overlay.opacity = v, k.easings.easeInQuad);
      
      // Switch room
      GameState.setCurrentRoom(targetRoomId);
      const newRoom = GameState.getCurrentRoom()!;
      renderer.render(newRoom);
      
      // Reposition player
      const opposite: Record<DungeonDirection, DungeonDirection> = {
        north: 'south', south: 'north', east: 'west', west: 'east'
      };
      const entryPos = renderer.getEntryPosition(opposite[fromDir]);
      player.moveTo(entryPos.x, entryPos.y);
      
      if (data.onRoomEnter) data.onRoomEnter(newRoom);
      
      // Fade in
      await k.tween(1, 0, 0.2, v => overlay.opacity = v, k.easings.easeOutQuad);
      k.destroy(overlay);
      
      player.unfreeze();
      isTransitioning = false;
    }
    
    // --- UI ---
    k.onDraw(() => {
      const room = GameState.getCurrentRoom();
      if (!room) return;
      
      // Room label
      k.drawRect({ pos: k.vec2(10, 10), width: 100, height: 22, color: k.rgb(0, 0, 0), opacity: 0.6 });
      k.drawText({
        text: room.type.charAt(0).toUpperCase() + room.type.slice(1),
        pos: k.vec2(14, 24),
        size: 11,
        color: k.rgb(255, 255, 255),
      });
      
      // Door prompt
      if (highlightedDoor && !isTransitioning) {
        k.drawRect({
          pos: k.vec2(CANVAS_WIDTH / 2 - 70, CANVAS_HEIGHT - 28),
          width: 140,
          height: 22,
          color: k.rgb(0, 0, 0),
          opacity: 0.7,
        });
        k.drawText({
          text: 'ENTER to go through',
          pos: k.vec2(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 14),
          size: 10,
          anchor: 'center',
          color: k.rgb(251, 191, 36),
        });
        
        // Highlight door
        const doors = k.get('door');
        for (const door of doors) {
          const d = door as unknown as { direction: DungeonDirection };
          door.color = d.direction === highlightedDoor ? k.rgb(251, 191, 36) : k.rgb(74, 222, 128);
        }
      }
    });
  });
}
```

### Step 3.2: Create Scene Index

**File:** `src/renderer/game/scenes/index.ts`

```typescript
export { registerDungeonScene, type DungeonSceneData } from './DungeonScene.js';
```

### Step 3.3: Create Systems Index

**File:** `src/renderer/game/systems/index.ts`

```typescript
export { setupMovement, type MovementConfig, type MovementBounds } from './movement.js';
export { RoomRenderer, type RoomConfig, DEFAULT_ROOM_CONFIG, type DungeonDirection } from './RoomRenderer.js';
```

### Step 3.4: Create Components Index

**File:** `src/renderer/game/components/index.ts`

```typescript
export { createPlayer, type Player, type PlayerConfig } from './Player.js';
```

---

## Phase 4: Create Simple Game Wrapper

### Step 4.1: DungeonGame

**File:** `src/renderer/game/DungeonGame.ts`

Simple wrapper for external use.

```typescript
/**
 * DungeonGame
 * 
 * Simple wrapper for the dungeon KAPLAY game.
 */

import type { KAPLAYCtx } from 'kaplay';
import { initGame, destroyGame } from './index.js';
import { registerDungeonScene, type DungeonSceneData } from './scenes/index.js';
import { GameState } from './state/GameState.js';
import type { CatColor } from './sprites/catSprites.js';

export class DungeonGame {
  private k: KAPLAYCtx;
  private canvasId: string;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvasId = canvas.id || `dungeon-${Date.now()}`;
    canvas.id = this.canvasId;
    
    this.k = initGame({
      canvas,
      width: 480,
      height: 320,
      scale: 1,
      background: [10, 10, 30],
      debug: false,
    });
    
    registerDungeonScene(this.k);
  }
  
  setCatColor(color: CatColor): void {
    GameState.setCatColor(color);
  }
  
  start(data: Partial<DungeonSceneData> = {}): void {
    this.k.go('dungeon', data);
  }
  
  destroy(): void {
    destroyGame(this.canvasId);
  }
}
```

---

## Testing Checklist

After each phase, verify:

**Phase 1 (Clean Slate):**
- [ ] No TypeScript errors
- [ ] Game folder structure is clean

**Phase 2 (Foundation):**
- [ ] Player component creates a visible sprite
- [ ] Movement system moves the player
- [ ] RoomRenderer draws a room

**Phase 3 (Dungeon Scene):**
- [ ] Scene loads without errors
- [ ] Player appears in room
- [ ] WASD/arrows move player
- [ ] Doors are visible
- [ ] Walking to door highlights it
- [ ] ENTER transitions to next room (with fade!)
- [ ] Content (enemies, chests) visible
- [ ] Walking into content triggers it

**Phase 4 (Wrapper):**
- [ ] DungeonGame can be instantiated from external code
- [ ] `start()` launches the game

---

## Implementation Order

1. **Delete broken stuff** (Step 1.1)
2. **Clean GameState** (Step 1.2)
3. **Simplify Events** (Step 1.3)
4. **Create Player component** (Step 2.1)
5. **Create Movement system** (Step 2.2)
6. **Create RoomRenderer** (Step 2.3)
7. **Create DungeonScene** (Step 3.1)
8. **Create index files** (Steps 3.2-3.4)
9. **Create DungeonGame wrapper** (Step 4.1)
10. **Test everything**

---

## Notes for Claude Code

- This is a FRESH START - don't try to preserve old code
- Each file should be created exactly as shown
- Test after each phase before moving on
- The UI will be added LATER once the core works
- Keep it simple - no premature optimization
- If something doesn't work, delete and rewrite rather than patch
