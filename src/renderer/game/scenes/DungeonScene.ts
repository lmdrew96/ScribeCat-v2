/**
 * DungeonScene
 *
 * The dungeon exploration scene. Simple orchestrator.
 */

import type { KAPLAYCtx } from 'kaplay';
import { GameState } from '../state/GameState.js';
import { type DungeonDirection } from '../events/GameEvents.js';
import { createPlayer } from '../components/Player.js';
import { setupMovement } from '../systems/movement.js';
import { RoomRenderer } from '../systems/RoomRenderer.js';
import {
  DungeonGenerator,
  type DungeonFloor,
  type DungeonRoom,
  type RoomContent,
} from '../../canvas/dungeon/DungeonGenerator.js';
import type { CatColor } from '../sprites/catSprites.js';
import { PLAYER_SPEED } from '../config.js';
import { getRandomEnemy, ENEMIES } from '../data/enemies.js';
import type { BattleSceneData } from './BattleScene.js';

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
  // Set to true when returning from battle
  returnFromBattle?: boolean;
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
          if (content.type === 'enemy') {
            // Mark as triggered before battle
            content.triggered = true;

            // Get enemy definition
            const enemyId = content.data as string || 'grey_slime';
            const enemyDef = ENEMIES[enemyId] || getRandomEnemy();

            // Transition to battle
            const battleData: BattleSceneData = {
              enemyDef,
              floorLevel: GameState.dungeon.floorNumber,
              returnScene: 'dungeon',
              returnData: {
                catColor,
                dungeonId: GameState.dungeon.dungeonId,
                floorNumber: GameState.dungeon.floorNumber,
                floor: GameState.dungeon.floor,
                returnFromBattle: true,
              } as DungeonSceneData,
            };

            k.go('battle', battleData);
            return;
          } else if (content.type !== 'npc') {
            content.triggered = true;
            if (data.onContentTrigger) data.onContentTrigger(content, room);

            // Check room clear
            if (
              !room.cleared &&
              room.contents.filter((c) => c.type === 'enemy' && !c.triggered).length === 0
            ) {
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

      await k.tween(0, 1, 0.2, (v) => (overlay.opacity = v), k.easings.easeInQuad);

      // Switch room
      GameState.setCurrentRoom(targetRoomId);
      const newRoom = GameState.getCurrentRoom()!;
      renderer.render(newRoom);

      // Reposition player
      const opposite: Record<DungeonDirection, DungeonDirection> = {
        north: 'south',
        south: 'north',
        east: 'west',
        west: 'east',
      };
      const entryPos = renderer.getEntryPosition(opposite[fromDir]);
      player.moveTo(entryPos.x, entryPos.y);

      if (data.onRoomEnter) data.onRoomEnter(newRoom);

      // Fade in
      await k.tween(1, 0, 0.2, (v) => (overlay.opacity = v), k.easings.easeOutQuad);
      k.destroy(overlay);

      player.unfreeze();
      isTransitioning = false;
    }

    // --- UI ---
    k.onDraw(() => {
      const room = GameState.getCurrentRoom();
      if (!room) return;

      // Room label
      k.drawRect({
        pos: k.vec2(10, 10),
        width: 100,
        height: 22,
        color: k.rgb(0, 0, 0),
        opacity: 0.6,
      });
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
