/**
 * DungeonScene - REFACTORED
 *
 * Now a thin orchestrator that wires up systems and components.
 * All heavy logic lives in systems/ and components/.
 */

import type { KAPLAYCtx } from 'kaplay';
import { GameState } from '../state/index.js';
import { EVENTS, type DoorActivateEvent } from '../events/GameEvents.js';
import { createPlayer } from '../components/player.js';
import { setupMovementSystem } from '../systems/movement.js';
import { RoomManager } from '../systems/roomManager.js';
import { drawMiniMap } from '../systems/minimap.js';
import { drawHUD } from '../ui/hud.js';
import {
  DungeonGenerator,
  type DungeonFloor,
  type DungeonRoom,
  type RoomContent,
  type Direction as DungeonDirection,
} from '../../canvas/dungeon/DungeonGenerator.js';
import type { CatColor } from '../sprites/catSprites.js';

// Canvas dimensions
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 320;

// Room dimensions (for interaction calculations)
const ROOM_WIDTH = 400;
const ROOM_HEIGHT = 240;
const ROOM_OFFSET_X = (CANVAS_WIDTH - ROOM_WIDTH) / 2;
const ROOM_OFFSET_Y = 40;
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
    const player = await createPlayer(k, {
      x: ROOM_OFFSET_X + ROOM_WIDTH / 2, // Center of room
      y: ROOM_OFFSET_Y + ROOM_HEIGHT / 2,
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
    setupMovementSystem(k, {
      player,
      catColor,
      bounds: roomManager.getMovementBounds(),
    });

    // 5. Setup interaction system
    let highlightedDoor: DungeonDirection | null = null;
    let nearbyContent: RoomContent | null = null;

    k.onUpdate(() => {
      if (roomManager.transitioning) return;

      const room = GameState.getCurrentRoom();
      if (!room) return;

      // Check door proximity
      highlightedDoor = null;
      const doorPositions = roomManager.getDoorPositionsPublic();
      for (const [direction, pos] of Object.entries(doorPositions)) {
        const dir = direction as DungeonDirection;
        if (!room.connections[dir]) continue;

        const dist = player.pos.dist(k.vec2(pos.x, pos.y));
        if (dist < DOOR_SIZE) {
          highlightedDoor = dir;
          break;
        }
      }

      // Check content proximity
      nearbyContent = null;
      for (const content of room.contents) {
        if (content.triggered && content.type !== 'npc') continue;

        const contentX = ROOM_OFFSET_X + content.x * ROOM_WIDTH;
        const contentY = ROOM_OFFSET_Y + content.y * ROOM_HEIGHT;
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
            const enemies = room.contents.filter((c) => c.type === 'enemy' && !c.triggered);
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
        const targetRoomId = room.connections[highlightedDoor];
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
      const floor = GameState.dungeon.floor;
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

      // Draw HUD (health, XP, gold)
      drawHUD(k, { position: 'bottom-left' });

      // Draw minimap (top-right corner)
      if (floor) {
        drawMiniMap(k, floor, room.id, {
          x: CANVAS_WIDTH - 130,
          y: 10,
          showLegend: true,
        });
      }

      // Interaction prompts
      if (highlightedDoor && !roomManager.transitioning) {
        drawPrompt('Press ENTER to go through door', k.rgb(251, 191, 36));
      } else if (nearbyContent && !roomManager.transitioning) {
        drawPrompt('Press ENTER to interact', k.rgb(96, 165, 250));
      }

      // Highlight doors
      const doors = k.get('door');
      for (const door of doors) {
        const doorData = door as unknown as { direction: DungeonDirection };
        if (doorData.direction === highlightedDoor) {
          door.color = k.rgb(251, 191, 36);
        } else {
          door.color = k.rgb(74, 222, 128);
        }
      }
    });

    function drawPrompt(text: string, color: ReturnType<typeof k.rgb>) {
      k.drawRect({
        pos: k.vec2(CANVAS_WIDTH / 2 - 80, CANVAS_HEIGHT - 30),
        width: 160,
        height: 24,
        color: k.rgb(0, 0, 0),
        opacity: 0.7,
      });
      k.drawText({
        text,
        pos: k.vec2(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 14),
        size: 11,
        anchor: 'center',
        color,
      });
    }
  });
}
