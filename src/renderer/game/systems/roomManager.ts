/**
 * Room Manager System
 *
 * Handles room transitions WITHOUT reloading the scene!
 * This is the key architectural improvement.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { GameState } from '../state/index.js';
import { EVENTS, type DoorActivateEvent, type RoomEnterEvent } from '../events/GameEvents.js';
import type {
  DungeonRoom,
  RoomContent,
  Direction as DungeonDirection,
  ContentType,
} from '../../canvas/dungeon/DungeonGenerator.js';
import type { PlayerComp } from '../components/player.js';

// Room rendering constants
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 320;
const ROOM_WIDTH = 400;
const ROOM_HEIGHT = 240;
const ROOM_OFFSET_X = (CANVAS_WIDTH - ROOM_WIDTH) / 2;
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

    // Discover connected rooms
    for (const [, roomId] of Object.entries(room.connections)) {
      if (roomId && GameState.dungeon.floor) {
        const connectedRoom = GameState.dungeon.floor.rooms.get(roomId);
        if (connectedRoom) {
          connectedRoom.discovered = true;
        }
      }
    }

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
    const behavior = this.player as unknown as GameObj & PlayerComp;

    // Freeze player
    behavior.freeze?.();

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
    behavior.unfreeze?.();
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
    this.roomObjects.push(
      k.add([k.rect(ROOM_WIDTH, ROOM_HEIGHT), k.pos(ROOM_OFFSET_X, ROOM_OFFSET_Y), k.color(42, 42, 78), k.z(-10)])
    );

    // Borders
    const borderColor = k.rgb(26, 26, 46);
    this.roomObjects.push(
      k.add([k.rect(ROOM_WIDTH, 4), k.pos(ROOM_OFFSET_X, ROOM_OFFSET_Y), k.color(borderColor), k.z(-5)])
    );
    this.roomObjects.push(
      k.add([
        k.rect(ROOM_WIDTH, 4),
        k.pos(ROOM_OFFSET_X, ROOM_OFFSET_Y + ROOM_HEIGHT - 4),
        k.color(borderColor),
        k.z(-5),
      ])
    );
    this.roomObjects.push(
      k.add([k.rect(4, ROOM_HEIGHT), k.pos(ROOM_OFFSET_X, ROOM_OFFSET_Y), k.color(borderColor), k.z(-5)])
    );
    this.roomObjects.push(
      k.add([
        k.rect(4, ROOM_HEIGHT),
        k.pos(ROOM_OFFSET_X + ROOM_WIDTH - 4, ROOM_OFFSET_Y),
        k.color(borderColor),
        k.z(-5),
      ])
    );

    // Grid pattern
    for (let x = ROOM_OFFSET_X; x < ROOM_OFFSET_X + ROOM_WIDTH; x += 32) {
      this.roomObjects.push(
        k.add([k.rect(1, ROOM_HEIGHT), k.pos(x, ROOM_OFFSET_Y), k.color(255, 255, 255), k.opacity(0.05), k.z(-8)])
      );
    }
    for (let y = ROOM_OFFSET_Y; y < ROOM_OFFSET_Y + ROOM_HEIGHT; y += 32) {
      this.roomObjects.push(
        k.add([k.rect(ROOM_WIDTH, 1), k.pos(ROOM_OFFSET_X, y), k.color(255, 255, 255), k.opacity(0.05), k.z(-8)])
      );
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
      this.roomObjects.push(
        k.add([k.text(arrows[dir], { size: 20 }), k.pos(pos.x, pos.y), k.anchor('center'), k.color(255, 255, 255), k.z(1)])
      );
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

      const colorHex =
        content.type === 'chest' && content.triggered
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
      const icons: Partial<Record<ContentType, string>> = {
        enemy: '!',
        chest: '$',
        trap: 'X',
        npc: '?',
        exit: 'v',
      };
      if (icons[content.type]) {
        this.roomObjects.push(
          k.add([
            k.text(icons[content.type]!, { size: 14 }),
            k.pos(x, y),
            k.anchor('center'),
            k.color(255, 255, 255),
            k.z(6),
          ])
        );
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
      case 'north':
        return { x: centerX, y: ROOM_OFFSET_Y + margin };
      case 'south':
        return { x: centerX, y: ROOM_OFFSET_Y + ROOM_HEIGHT - margin };
      case 'east':
        return { x: ROOM_OFFSET_X + ROOM_WIDTH - margin, y: centerY };
      case 'west':
        return { x: ROOM_OFFSET_X + margin, y: centerY };
      default:
        return { x: centerX, y: centerY };
    }
  }

  /**
   * Get opposite direction
   */
  private oppositeDirection(dir: DungeonDirection): DungeonDirection {
    const map: Record<DungeonDirection, DungeonDirection> = {
      north: 'south',
      south: 'north',
      east: 'west',
      west: 'east',
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
   * Get door positions (public for interaction checking)
   */
  getDoorPositionsPublic(): Record<DungeonDirection, { x: number; y: number }> {
    return this.getDoorPositions();
  }

  /**
   * Check if transitioning (for input blocking)
   */
  get transitioning(): boolean {
    return this.isTransitioning;
  }
}
