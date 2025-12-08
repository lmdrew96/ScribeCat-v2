/**
 * DungeonScene
 *
 * KAPLAY scene for dungeon room exploration.
 * Handles room rendering, player movement, content interactions, and door transitions.
 * Ported from DungeonCanvas.ts
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { loadCatSprites, getCatSpriteName, type CatColor, type Direction } from '../sprites/catSprites.js';
import { PLAYER_SPEED, COLORS } from '../config.js';

// Import dungeon types and generator from existing code
import {
  DungeonGenerator,
  type DungeonFloor,
  type DungeonRoom,
  type RoomContent,
  type ContentType,
  Direction as DungeonDirection,
} from '../../canvas/dungeon/DungeonGenerator.js';

// Canvas dimensions
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 320;

// Room dimensions
const ROOM_WIDTH = 400;
const ROOM_HEIGHT = 240;
const ROOM_OFFSET_X = (CANVAS_WIDTH - ROOM_WIDTH) / 2;
const ROOM_OFFSET_Y = 40;

// Door dimensions
const DOOR_SIZE = 48;
const TRIGGER_DISTANCE = 40;

// Content colors
const CONTENT_COLORS = {
  enemy: '#ef4444',
  chest: '#fbbf24',
  chestOpen: '#78350f',
  trap: '#dc2626',
  npc: '#60a5fa',
  exit: '#a855f7',
  campfire: '#22c55e',
};

export interface DungeonSceneData {
  catColor: CatColor;
  dungeonId?: string;
  floorNumber?: number;
  floor?: DungeonFloor;
  onContentTrigger?: (content: RoomContent, room: DungeonRoom) => void;
  onRoomEnter?: (room: DungeonRoom) => void;
  onRoomClear?: (room: DungeonRoom) => void;
  onFloorComplete?: (floorNumber: number) => void;
}

/**
 * Register the Dungeon scene with a KAPLAY instance
 */
export function registerDungeonScene(k: KAPLAYCtx): void {
  k.scene('dungeon', async (data: DungeonSceneData) => {
    const {
      catColor,
      dungeonId = 'training',
      floorNumber = 1,
      onContentTrigger,
      onRoomEnter,
      onRoomClear,
      onFloorComplete,
    } = data;

    // Load cat sprites
    await loadCatSprites(k, catColor);

    // Generate or use provided floor
    let floor = data.floor;
    if (!floor) {
      const generator = new DungeonGenerator(dungeonId);
      floor = generator.generate(floorNumber);
    }

    // Get start room
    let currentRoom = floor.rooms.get(floor.startRoomId)!;

    // State
    let highlightedDoor: DungeonDirection | null = null;
    let nearbyNpc: RoomContent | null = null;
    let isTransitioning = false;

    // Draw room background
    function drawRoom(): void {
      // Room floor
      k.add([
        k.rect(ROOM_WIDTH, ROOM_HEIGHT),
        k.pos(ROOM_OFFSET_X, ROOM_OFFSET_Y),
        k.color(42, 42, 78),
        k.z(-10),
      ]);

      // Room border
      k.add([
        k.rect(ROOM_WIDTH, 4),
        k.pos(ROOM_OFFSET_X, ROOM_OFFSET_Y),
        k.color(26, 26, 46),
        k.z(-5),
      ]);
      k.add([
        k.rect(ROOM_WIDTH, 4),
        k.pos(ROOM_OFFSET_X, ROOM_OFFSET_Y + ROOM_HEIGHT - 4),
        k.color(26, 26, 46),
        k.z(-5),
      ]);
      k.add([
        k.rect(4, ROOM_HEIGHT),
        k.pos(ROOM_OFFSET_X, ROOM_OFFSET_Y),
        k.color(26, 26, 46),
        k.z(-5),
      ]);
      k.add([
        k.rect(4, ROOM_HEIGHT),
        k.pos(ROOM_OFFSET_X + ROOM_WIDTH - 4, ROOM_OFFSET_Y),
        k.color(26, 26, 46),
        k.z(-5),
      ]);

      // Floor grid pattern
      for (let x = ROOM_OFFSET_X; x < ROOM_OFFSET_X + ROOM_WIDTH; x += 32) {
        k.add([
          k.rect(1, ROOM_HEIGHT),
          k.pos(x, ROOM_OFFSET_Y),
          k.color(255, 255, 255),
          k.opacity(0.05),
          k.z(-8),
        ]);
      }
      for (let y = ROOM_OFFSET_Y; y < ROOM_OFFSET_Y + ROOM_HEIGHT; y += 32) {
        k.add([
          k.rect(ROOM_WIDTH, 1),
          k.pos(ROOM_OFFSET_X, y),
          k.color(255, 255, 255),
          k.opacity(0.05),
          k.z(-8),
        ]);
      }
    }

    // Get door positions
    function getDoorPositions(): Record<DungeonDirection, { x: number; y: number }> {
      return {
        north: { x: ROOM_OFFSET_X + ROOM_WIDTH / 2, y: ROOM_OFFSET_Y + DOOR_SIZE / 2 },
        south: { x: ROOM_OFFSET_X + ROOM_WIDTH / 2, y: ROOM_OFFSET_Y + ROOM_HEIGHT - DOOR_SIZE / 2 },
        east: { x: ROOM_OFFSET_X + ROOM_WIDTH - DOOR_SIZE / 2, y: ROOM_OFFSET_Y + ROOM_HEIGHT / 2 },
        west: { x: ROOM_OFFSET_X + DOOR_SIZE / 2, y: ROOM_OFFSET_Y + ROOM_HEIGHT / 2 },
      };
    }

    // Door game objects
    const doors: Map<DungeonDirection, GameObj> = new Map();

    // Draw doors
    function drawDoors(): void {
      const positions = getDoorPositions();

      for (const [direction, pos] of Object.entries(positions)) {
        const dir = direction as DungeonDirection;
        const hasConnection = currentRoom.connections[dir] !== null;
        if (!hasConnection) continue;

        const door = k.add([
          k.rect(DOOR_SIZE, DOOR_SIZE),
          k.pos(pos.x - DOOR_SIZE / 2, pos.y - DOOR_SIZE / 2),
          k.color(74, 222, 128),
          k.area(),
          k.z(0),
          'door',
          { direction: dir },
        ]);

        doors.set(dir, door);

        // Arrow indicator
        const arrows: Record<DungeonDirection, string> = {
          north: '^',
          south: 'v',
          east: '>',
          west: '<',
        };

        k.add([
          k.text(arrows[dir], { size: 20 }),
          k.pos(pos.x, pos.y),
          k.anchor('center'),
          k.color(255, 255, 255),
          k.z(1),
        ]);
      }
    }

    // Content game objects
    const contentObjects: Map<string, GameObj> = new Map();

    // Draw contents
    function drawContents(): void {
      for (const content of currentRoom.contents) {
        const x = ROOM_OFFSET_X + content.x * ROOM_WIDTH;
        const y = ROOM_OFFSET_Y + content.y * ROOM_HEIGHT;

        // Skip defeated enemies
        if (content.type === 'enemy' && content.triggered) continue;

        let color: string;
        let size = 24;

        switch (content.type) {
          case 'enemy':
            color = CONTENT_COLORS.enemy;
            break;
          case 'chest':
            color = content.triggered ? CONTENT_COLORS.chestOpen : CONTENT_COLORS.chest;
            break;
          case 'trap':
            color = CONTENT_COLORS.trap;
            break;
          case 'npc':
            color = CONTENT_COLORS.npc;
            break;
          case 'exit':
            color = CONTENT_COLORS.exit;
            break;
          case 'interactable':
            color = CONTENT_COLORS.campfire;
            break;
          default:
            color = '#ffffff';
        }

        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        const obj = k.add([
          k.circle(size / 2),
          k.pos(x, y),
          k.anchor('center'),
          k.color(r, g, b),
          k.area({ shape: new k.Circle(k.vec2(0, 0), size / 2 + 10) }),
          k.z(5),
          'content',
          { contentId: content.id, contentType: content.type },
        ]);

        contentObjects.set(content.id, obj);

        // Icon overlay
        const icons: Partial<Record<ContentType, string>> = {
          enemy: '!',
          chest: '$',
          trap: 'X',
          npc: '?',
          exit: 'v',
        };

        if (icons[content.type]) {
          k.add([
            k.text(icons[content.type]!, { size: 14 }),
            k.pos(x, y),
            k.anchor('center'),
            k.color(255, 255, 255),
            k.z(6),
          ]);
        }
      }
    }

    // Position player at entry
    function getEntryPosition(fromDirection?: DungeonDirection): { x: number; y: number } {
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

    // Opposite direction helper
    function oppositeDirection(dir: DungeonDirection): DungeonDirection {
      const map: Record<DungeonDirection, DungeonDirection> = {
        north: 'south',
        south: 'north',
        east: 'west',
        west: 'east',
      };
      return map[dir];
    }

    // Enter a new room
    function enterRoom(room: DungeonRoom, fromDirection?: DungeonDirection): void {
      currentRoom = room;
      room.visited = true;
      room.discovered = true;

      // Discover connected rooms
      for (const [dir, roomId] of Object.entries(room.connections)) {
        if (roomId && floor) {
          const connectedRoom = floor.rooms.get(roomId);
          if (connectedRoom) {
            connectedRoom.discovered = true;
          }
        }
      }

      // Notify callback
      if (onRoomEnter) {
        onRoomEnter(room);
      }
    }

    // Initialize room
    drawRoom();
    drawDoors();
    drawContents();
    enterRoom(currentRoom);

    // Create player
    const startPos = getEntryPosition();
    const player = k.add([
      k.sprite(getCatSpriteName(catColor, 'idle')),
      k.pos(startPos.x, startPos.y),
      k.anchor('center'),
      k.scale(2),
      k.area({ scale: 0.5 }),
      k.z(10),
      'player',
      {
        direction: 'down' as Direction,
        isMoving: false,
      },
    ]);

    player.play('idle');

    // Player movement
    k.onUpdate(() => {
      if (isTransitioning) return;

      let dx = 0;
      let dy = 0;

      if (k.isKeyDown('left') || k.isKeyDown('a')) dx = -1;
      if (k.isKeyDown('right') || k.isKeyDown('d')) dx = 1;
      if (k.isKeyDown('up') || k.isKeyDown('w')) dy = -1;
      if (k.isKeyDown('down') || k.isKeyDown('s')) dy = 1;

      const moving = dx !== 0 || dy !== 0;

      if (moving) {
        const len = Math.sqrt(dx * dx + dy * dy);
        const moveX = (dx / len) * PLAYER_SPEED;
        const moveY = (dy / len) * PLAYER_SPEED;

        const newX = player.pos.x + moveX * k.dt();
        const newY = player.pos.y + moveY * k.dt();

        // Clamp to room bounds
        const margin = 16;
        player.pos.x = Math.max(ROOM_OFFSET_X + margin, Math.min(newX, ROOM_OFFSET_X + ROOM_WIDTH - margin));
        player.pos.y = Math.max(ROOM_OFFSET_Y + margin, Math.min(newY, ROOM_OFFSET_Y + ROOM_HEIGHT - margin));

        // Update direction
        if (dy < 0) player.direction = 'up';
        else if (dy > 0) player.direction = 'down';
        else if (dx < 0) player.direction = 'left';
        else if (dx > 0) player.direction = 'right';

        player.flipX = dx < 0;

        if (!player.isMoving) {
          player.isMoving = true;
          player.use(k.sprite(getCatSpriteName(catColor, 'walk')));
          player.play('walk');
        }
      } else {
        if (player.isMoving) {
          player.isMoving = false;
          player.use(k.sprite(getCatSpriteName(catColor, 'idle')));
          player.play('idle');
        }
      }

      // Check door proximity
      highlightedDoor = null;
      const doorPositions = getDoorPositions();
      for (const [direction, pos] of Object.entries(doorPositions)) {
        const dir = direction as DungeonDirection;
        if (!currentRoom.connections[dir]) continue;

        const dist = player.pos.dist(k.vec2(pos.x, pos.y));
        if (dist < DOOR_SIZE) {
          highlightedDoor = dir;
          break;
        }
      }

      // Check content proximity
      nearbyNpc = null;
      for (const content of currentRoom.contents) {
        if (content.triggered) continue;

        const contentX = ROOM_OFFSET_X + content.x * ROOM_WIDTH;
        const contentY = ROOM_OFFSET_Y + content.y * ROOM_HEIGHT;
        const dist = player.pos.dist(k.vec2(contentX, contentY));

        if (dist < TRIGGER_DISTANCE) {
          if (content.type === 'npc') {
            nearbyNpc = content;
          } else {
            // Auto-trigger non-NPC content
            if (onContentTrigger) {
              onContentTrigger(content, currentRoom);
            }
            content.triggered = true;

            // Remove content object
            const obj = contentObjects.get(content.id);
            if (obj) {
              k.destroy(obj);
              contentObjects.delete(content.id);
            }

            // Check if room is cleared
            const enemies = currentRoom.contents.filter(c => c.type === 'enemy' && !c.triggered);
            if (enemies.length === 0 && !currentRoom.cleared) {
              currentRoom.cleared = true;
              if (onRoomClear) {
                onRoomClear(currentRoom);
              }
            }
          }
          break;
        }
      }
    });

    // Door interaction
    k.onKeyPress('enter', () => {
      if (highlightedDoor && !isTransitioning) {
        const nextRoomId = currentRoom.connections[highlightedDoor];
        if (nextRoomId && floor) {
          const nextRoom = floor.rooms.get(nextRoomId);
          if (nextRoom) {
            isTransitioning = true;

            // Fade transition
            const overlay = k.add([
              k.rect(CANVAS_WIDTH, CANVAS_HEIGHT),
              k.pos(0, 0),
              k.color(0, 0, 0),
              k.opacity(0),
              k.z(100),
            ]);

            // Fade out
            k.tween(0, 1, 0.3, (val) => {
              overlay.opacity = val;
            }, k.easings.linear).then(() => {
              // Re-enter scene with new room
              k.go('dungeon', {
                ...data,
                floor,
                _currentRoomId: nextRoomId,
                _fromDirection: oppositeDirection(highlightedDoor!),
              });
            });
          }
        }
      }

      // NPC interaction
      if (nearbyNpc && !isTransitioning) {
        if (onContentTrigger) {
          onContentTrigger(nearbyNpc, currentRoom);
        }
      }
    });

    k.onKeyPress('space', () => {
      // Same as enter
      if (highlightedDoor && !isTransitioning) {
        k.trigger('enter');
      }
      if (nearbyNpc && !isTransitioning) {
        if (onContentTrigger) {
          onContentTrigger(nearbyNpc, currentRoom);
        }
      }
    });

    // Draw UI
    k.onDraw(() => {
      // Room type label
      const roomTypeName = currentRoom.type.charAt(0).toUpperCase() + currentRoom.type.slice(1);

      k.drawRect({
        pos: k.vec2(10, 10),
        width: 120,
        height: 24,
        color: k.rgb(0, 0, 0),
        opacity: 0.6,
      });

      k.drawText({
        text: `Room: ${roomTypeName}`,
        pos: k.vec2(16, 26),
        size: 11,
        color: k.rgb(255, 255, 255),
      });

      // Door interaction hint
      if (highlightedDoor) {
        k.drawRect({
          pos: k.vec2(CANVAS_WIDTH / 2 - 80, CANVAS_HEIGHT - 30),
          width: 160,
          height: 24,
          color: k.rgb(0, 0, 0),
          opacity: 0.7,
        });

        k.drawText({
          text: 'Press ENTER to go through door',
          pos: k.vec2(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 14),
          size: 11,
          anchor: 'center',
          color: k.rgb(251, 191, 36),
        });
      }

      // NPC interaction hint
      if (nearbyNpc && !highlightedDoor) {
        k.drawRect({
          pos: k.vec2(CANVAS_WIDTH / 2 - 80, CANVAS_HEIGHT - 30),
          width: 160,
          height: 24,
          color: k.rgb(0, 0, 0),
          opacity: 0.7,
        });

        k.drawText({
          text: 'Press ENTER to interact',
          pos: k.vec2(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 14),
          size: 11,
          anchor: 'center',
          color: k.rgb(96, 165, 250),
        });
      }

      // Highlight doors
      for (const [dir, door] of doors) {
        if (dir === highlightedDoor) {
          door.color = k.rgb(251, 191, 36);
        } else {
          door.color = k.rgb(74, 222, 128);
        }
      }
    });

    // Handle internal room transitions (from scene data)
    if ((data as any)._currentRoomId) {
      const targetRoom = floor.rooms.get((data as any)._currentRoomId);
      if (targetRoom) {
        enterRoom(targetRoom, (data as any)._fromDirection);
        const pos = getEntryPosition((data as any)._fromDirection);
        player.pos = k.vec2(pos.x, pos.y);
      }
    }
  });
}
