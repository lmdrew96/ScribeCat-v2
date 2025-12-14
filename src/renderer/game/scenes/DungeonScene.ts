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
  // Player position to restore after battle
  playerX?: number;
  playerY?: number;
}

export function registerDungeonScene(k: KAPLAYCtx): void {
  k.scene('dungeon', async (data: DungeonSceneData = {}) => {
    // --- SETUP ---
    const catColor = data?.catColor || GameState.player.catColor;
    GameState.setCatColor(catColor);

    // Floor
    if (data?.floor) {
      GameState.setFloor(data.floor);
    } else if (!GameState.dungeon.floor) {
      const generator = new DungeonGenerator(data?.dungeonId || 'training');
      GameState.setFloor(generator.generate(data?.floorNumber || 1));
    }

    // Renderer
    const renderer = new RoomRenderer(k);

    // Player - use saved position if returning from battle
    let startPos: { x: number; y: number };
    if (data.returnFromBattle && data.playerX !== undefined && data.playerY !== undefined) {
      startPos = { x: data.playerX, y: data.playerY };
    } else {
      startPos = renderer.getEntryPosition();
    }

    const player = await createPlayer({
      k,
      x: startPos.x,
      y: startPos.y,
      color: catColor,
    });

    // Render first room
    await renderer.render(GameState.getCurrentRoom()!);
    if (data.onRoomEnter) data.onRoomEnter(GameState.getCurrentRoom()!);

    // Movement
    setupMovement({
      k,
      player,
      speed: PLAYER_SPEED,
      bounds: renderer.getMovementBounds(),
    });

    // --- STATS HUD ---
    // Background
    k.add([
      k.rect(130, 70),
      k.pos(CANVAS_WIDTH - 140, 10),
      k.color(0, 0, 0),
      k.opacity(0.7),
      k.z(50),
    ]);

    // HP Label
    k.add([
      k.text('HP', { size: 10 }),
      k.pos(CANVAS_WIDTH - 130, 18),
      k.color(255, 255, 255),
      k.z(51),
    ]);

    // HP Bar background
    k.add([
      k.rect(80, 12),
      k.pos(CANVAS_WIDTH - 100, 15),
      k.color(60, 20, 20),
      k.z(51),
    ]);

    // HP Bar fill (updates each frame)
    const hpBar = k.add([
      k.rect(80, 12),
      k.pos(CANVAS_WIDTH - 100, 15),
      k.color(60, 220, 100),
      k.z(52),
    ]);

    // Gold display
    const goldText = k.add([
      k.text(`Gold: ${GameState.player.gold}`, { size: 10 }),
      k.pos(CANVAS_WIDTH - 130, 38),
      k.color(251, 191, 36),
      k.z(51),
    ]);

    // Floor display
    k.add([
      k.text(`Floor ${GameState.dungeon.floorNumber}`, { size: 10 }),
      k.pos(CANVAS_WIDTH - 130, 55),
      k.color(200, 200, 200),
      k.z(51),
    ]);

    // Update HP bar each frame
    k.onUpdate(() => {
      const ratio = GameState.player.health / GameState.player.maxHealth;
      hpBar.width = 80 * ratio;

      // Color based on HP
      if (ratio > 0.5) {
        hpBar.color = k.rgb(60, 220, 100);
      } else if (ratio > 0.25) {
        hpBar.color = k.rgb(240, 200, 60);
      } else {
        hpBar.color = k.rgb(240, 60, 60);
      }

      // Update gold (in case it changed)
      goldText.text = `Gold: ${GameState.player.gold}`;
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

            // Get enemy definition - content.data can be a string or an object
            let enemyId: string;
            if (typeof content.data === 'string') {
              enemyId = content.data;
            } else if (content.data?.enemyType) {
              enemyId = content.data.enemyType;
            } else {
              enemyId = 'grey_slime';
            }
            const enemyDef = ENEMIES[enemyId] || getRandomEnemy();

            // Save current player position
            const currentX = player.entity.pos.x;
            const currentY = player.entity.pos.y;

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
                playerX: currentX,
                playerY: currentY,
              } as DungeonSceneData,
            };

            k.go('battle', battleData);
            return;
          } else if (content.type === 'exit') {
            content.triggered = true;

            // Show completion message
            const overlay = k.add([
              k.rect(CANVAS_WIDTH, CANVAS_HEIGHT),
              k.pos(0, 0),
              k.color(0, 0, 0),
              k.opacity(0),
              k.z(1000),
            ]);

            const msg = k.add([
              k.text('Floor Complete!', { size: 20 }),
              k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
              k.anchor('center'),
              k.color(251, 191, 36),
              k.opacity(0),
              k.z(1001),
            ]);

            // Fade in, wait, then go to town
            k.tween(0, 1, 0.3, (v) => {
              overlay.opacity = v * 0.8;
              msg.opacity = v;
            });

            k.wait(1.5, () => {
              k.go('town');
            });

            return; // Stop processing
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
      await renderer.render(newRoom);

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
