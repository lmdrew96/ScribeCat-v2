/**
 * DungeonScene
 *
 * The dungeon exploration scene.
 *
 * FIXES:
 * - Puzzles now show actual mini-game UI (riddles, sequences)
 * - Secrets are hidden until player searches (press SPACE near them)
 * - Boss defeat triggers exit
 * - Proper room persistence
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { GameState } from '../state/GameState.js';
import { type DungeonDirection } from '../events/GameEvents.js';
import { createPlayer } from '../components/Player.js';
import { setupMovement } from '../systems/movement.js';
import { RoomRenderer } from '../systems/RoomRenderer.js';
import {
  DungeonGenerator,
  DUNGEON_CONFIGS,
  type DungeonFloor,
  type DungeonRoom,
  type RoomContent,
} from '../../canvas/dungeon/DungeonGenerator.js';
import type { CatColor } from '../sprites/catSprites.js';
import { PLAYER_SPEED } from '../config.js';
import { getRandomEnemy, ENEMIES } from '../data/enemies.js';
import { playSound } from '../systems/sound.js';
import type { BattleSceneData } from './BattleScene.js';

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 320;
const DOOR_SIZE = 48;
const TRIGGER_DISTANCE = 40;
const SEARCH_DISTANCE = 50;

// Riddles for puzzle rooms
const RIDDLES = [
  { question: "I have keys but no locks. What am I?", answer: 0, options: ["Keyboard", "Piano", "Map"] },
  { question: "What has hands but can't clap?", answer: 1, options: ["Gloves", "Clock", "Statue"] },
  { question: "I get wetter as I dry. What am I?", answer: 2, options: ["Sponge", "Rain", "Towel"] },
  { question: "What has a head and tail but no body?", answer: 0, options: ["Coin", "Snake", "Comet"] },
  { question: "What can you catch but not throw?", answer: 1, options: ["Ball", "Cold", "Fish"] },
];

// Sequences for puzzle rooms
const SEQUENCES = [
  { pattern: [0, 1, 2], display: "↑ → ↓" },
  { pattern: [1, 0, 1, 2], display: "→ ↑ → ↓" },
  { pattern: [2, 2, 0, 1], display: "↓ ↓ ↑ →" },
  { pattern: [0, 2, 1, 0], display: "↑ ↓ → ↑" },
];

export interface DungeonSceneData {
  catColor?: CatColor;
  dungeonId?: string;
  floorNumber?: number;
  floor?: DungeonFloor;
  currentRoomId?: string;
  onContentTrigger?: (content: RoomContent, room: DungeonRoom) => void;
  onRoomEnter?: (room: DungeonRoom) => void;
  onRoomClear?: (room: DungeonRoom) => void;
  returnFromBattle?: boolean;
  playerX?: number;
  playerY?: number;
}

export function registerDungeonScene(k: KAPLAYCtx): void {
  k.scene('dungeon', async (data: DungeonSceneData = {}) => {
    // --- SETUP ---
    const catColor = data?.catColor || GameState.player.catColor;
    const dungeonId = data?.dungeonId || GameState.dungeon.dungeonId || 'training';
    const dungeonConfig = DUNGEON_CONFIGS[dungeonId] || DUNGEON_CONFIGS.training;

    GameState.setCatColor(catColor);
    GameState.dungeon.dungeonId = dungeonId;

    // Floor management
    if (data?.floor) {
      GameState.dungeon.floor = data.floor;
      GameState.dungeon.floorNumber = data.floorNumber || 1;

      if (data.currentRoomId) {
        GameState.dungeon.currentRoomId = data.currentRoomId;
      } else if (!GameState.dungeon.currentRoomId) {
        GameState.dungeon.currentRoomId = data.floor.startRoomId;
      }
    } else if (!GameState.dungeon.floor) {
      const floorNum = data?.floorNumber || 1;
      GameState.dungeon.floorNumber = floorNum;
      const generator = new DungeonGenerator(dungeonId);
      const newFloor = generator.generate(floorNum);
      GameState.dungeon.floor = newFloor;
      GameState.dungeon.currentRoomId = newFloor.startRoomId;
    }

    const currentRoom = GameState.getCurrentRoom();
    if (currentRoom) {
      currentRoom.visited = true;
      currentRoom.discovered = true;
    }

    const renderer = new RoomRenderer(k);

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

    await renderer.render(GameState.getCurrentRoom()!);
    if (data.onRoomEnter) data.onRoomEnter(GameState.getCurrentRoom()!);

    setupMovement({
      k,
      player,
      speed: PLAYER_SPEED,
      bounds: renderer.getMovementBounds(),
    });

    // --- STATS HUD ---
    k.add([
      k.rect(130, 70),
      k.pos(CANVAS_WIDTH - 140, 10),
      k.color(0, 0, 0),
      k.opacity(0.7),
      k.z(50),
    ]);

    k.add([
      k.text('HP', { size: 10 }),
      k.pos(CANVAS_WIDTH - 130, 18),
      k.color(255, 255, 255),
      k.z(51),
    ]);

    k.add([
      k.rect(80, 12),
      k.pos(CANVAS_WIDTH - 100, 15),
      k.color(60, 20, 20),
      k.z(51),
    ]);

    const hpBar = k.add([
      k.rect(80, 12),
      k.pos(CANVAS_WIDTH - 100, 15),
      k.color(60, 220, 100),
      k.z(52),
    ]);

    const goldText = k.add([
      k.text(`Gold: ${GameState.player.gold}`, { size: 10 }),
      k.pos(CANVAS_WIDTH - 130, 38),
      k.color(251, 191, 36),
      k.z(51),
    ]);

    k.add([
      k.text(`Floor ${GameState.dungeon.floorNumber}/${dungeonConfig.totalFloors}`, { size: 10 }),
      k.pos(CANVAS_WIDTH - 130, 55),
      k.color(200, 200, 200),
      k.z(51),
    ]);

    k.onUpdate(() => {
      const ratio = GameState.player.health / GameState.player.maxHealth;
      hpBar.width = 80 * ratio;

      if (ratio > 0.5) {
        hpBar.color = k.rgb(60, 220, 100);
      } else if (ratio > 0.25) {
        hpBar.color = k.rgb(240, 200, 60);
      } else {
        hpBar.color = k.rgb(240, 60, 60);
      }

      goldText.text = `Gold: ${GameState.player.gold}`;
    });

    // --- STATE ---
    let isTransitioning = false;
    let highlightedDoor: DungeonDirection | null = null;
    let puzzleUIElements: GameObj[] = [];
    let puzzleActive = false;
    let currentPuzzle: RoomContent | null = null;
    let puzzleState: any = null;
    let nearbySecret: RoomContent | null = null;

    // --- HELPER: Show floating message ---
    function showFloatingMessage(
      text: string,
      x: number,
      y: number,
      color: [number, number, number] = [255, 255, 255]
    ): void {
      const msg = k.add([
        k.text(text, { size: 12 }),
        k.pos(x, y),
        k.anchor('center'),
        k.color(...color),
        k.opacity(1),
        k.z(200),
      ]);

      k.tween(y, y - 40, 1.0, (v) => { msg.pos.y = v; });
      k.tween(1, 0, 1.0, (v) => { msg.opacity = v; });
      k.wait(1.0, () => k.destroy(msg));
    }

    // --- PUZZLE UI ---
    function clearPuzzleUI(): void {
      for (const e of puzzleUIElements) {
        try { k.destroy(e); } catch {}
      }
      puzzleUIElements = [];
      puzzleActive = false;
      currentPuzzle = null;
      puzzleState = null;
      player.unfreeze();
    }

    function showRiddlePuzzle(content: RoomContent, x: number, y: number): void {
      puzzleActive = true;
      currentPuzzle = content;
      player.freeze();

      const riddle = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
      puzzleState = { type: 'riddle', riddle, selectedOption: 0 };

      // Background
      puzzleUIElements.push(k.add([
        k.rect(380, 180),
        k.pos(CANVAS_WIDTH / 2 - 190, 70),
        k.color(20, 20, 40),
        k.outline(3, k.rgb(100, 150, 255)),
        k.z(500),
      ]));

      // Title
      puzzleUIElements.push(k.add([
        k.text('Riddle Stone', { size: 14 }),
        k.pos(CANVAS_WIDTH / 2, 85),
        k.anchor('center'),
        k.color(100, 180, 255),
        k.z(501),
      ]));

      // Question
      puzzleUIElements.push(k.add([
        k.text(riddle.question, { size: 11, width: 350 }),
        k.pos(CANVAS_WIDTH / 2, 115),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.z(501),
      ]));

      // Options
      renderRiddleOptions();

      // Instructions
      puzzleUIElements.push(k.add([
        k.text('Up/Down: Select | ENTER: Answer | ESC: Leave', { size: 9 }),
        k.pos(CANVAS_WIDTH / 2, 240),
        k.anchor('center'),
        k.color(150, 150, 150),
        k.z(501),
      ]));
    }

    function renderRiddleOptions(): void {
      // Remove old option elements
      puzzleUIElements = puzzleUIElements.filter(e => {
        if ((e as any)._isOption) {
          try { k.destroy(e); } catch {}
          return false;
        }
        return true;
      });

      const riddle = puzzleState.riddle;
      riddle.options.forEach((opt: string, i: number) => {
        const isSelected = i === puzzleState.selectedOption;
        const optBg = k.add([
          k.rect(300, 28),
          k.pos(CANVAS_WIDTH / 2 - 150, 145 + i * 32),
          k.color(isSelected ? 60 : 30, isSelected ? 80 : 30, isSelected ? 120 : 50),
          k.outline(2, k.rgb(isSelected ? 100 : 60, isSelected ? 180 : 80, isSelected ? 255 : 120)),
          k.z(501),
        ]) as any;
        optBg._isOption = true;
        puzzleUIElements.push(optBg);

        const optText = k.add([
          k.text(`${i + 1}. ${opt}`, { size: 10 }),
          k.pos(CANVAS_WIDTH / 2, 159 + i * 32),
          k.anchor('center'),
          k.color(255, 255, 255),
          k.z(502),
        ]) as any;
        optText._isOption = true;
        puzzleUIElements.push(optText);
      });
    }

    function showSequencePuzzle(content: RoomContent, x: number, y: number): void {
      puzzleActive = true;
      currentPuzzle = content;
      player.freeze();

      const sequence = SEQUENCES[Math.floor(Math.random() * SEQUENCES.length)];
      puzzleState = { type: 'sequence', sequence, inputIndex: 0, inputs: [], showPattern: true };

      // Background
      puzzleUIElements.push(k.add([
        k.rect(380, 160),
        k.pos(CANVAS_WIDTH / 2 - 190, 80),
        k.color(20, 20, 40),
        k.outline(3, k.rgb(255, 180, 100)),
        k.z(500),
      ]));

      // Title
      puzzleUIElements.push(k.add([
        k.text('Sequence Lock', { size: 14 }),
        k.pos(CANVAS_WIDTH / 2, 95),
        k.anchor('center'),
        k.color(255, 180, 100),
        k.z(501),
      ]));

      // Pattern display
      puzzleUIElements.push(k.add([
        k.text(`Memorize: ${sequence.display}`, { size: 16 }),
        k.pos(CANVAS_WIDTH / 2, 130),
        k.anchor('center'),
        k.color(255, 255, 100),
        k.z(501),
      ]));

      puzzleUIElements.push(k.add([
        k.text('Pattern will hide in 3 seconds...', { size: 10 }),
        k.pos(CANVAS_WIDTH / 2, 160),
        k.anchor('center'),
        k.color(200, 200, 200),
        k.z(501),
      ]));

      // Hide pattern after 3 seconds
      k.wait(3, () => {
        if (puzzleActive && puzzleState?.type === 'sequence') {
          puzzleState.showPattern = false;
          renderSequenceInput();
        }
      });
    }

    function renderSequenceInput(): void {
      // Clear and rebuild UI
      clearPuzzleUI();
      puzzleActive = true;
      player.freeze();

      // Background
      puzzleUIElements.push(k.add([
        k.rect(380, 160),
        k.pos(CANVAS_WIDTH / 2 - 190, 80),
        k.color(20, 20, 40),
        k.outline(3, k.rgb(255, 180, 100)),
        k.z(500),
      ]));

      puzzleUIElements.push(k.add([
        k.text('Enter the Sequence!', { size: 14 }),
        k.pos(CANVAS_WIDTH / 2, 95),
        k.anchor('center'),
        k.color(255, 180, 100),
        k.z(501),
      ]));

      // Show current inputs
      const arrows = ['Up', 'Right', 'Down'];
      const inputStr = puzzleState.inputs.map((i: number) => arrows[i]).join(' ') || '...';
      puzzleUIElements.push(k.add([
        k.text(`Your input: ${inputStr}`, { size: 14 }),
        k.pos(CANVAS_WIDTH / 2, 130),
        k.anchor('center'),
        k.color(100, 255, 100),
        k.z(501),
      ]));

      puzzleUIElements.push(k.add([
        k.text(`${puzzleState.inputs.length}/${puzzleState.sequence.pattern.length}`, { size: 12 }),
        k.pos(CANVAS_WIDTH / 2, 155),
        k.anchor('center'),
        k.color(200, 200, 200),
        k.z(501),
      ]));

      puzzleUIElements.push(k.add([
        k.text('Arrow Keys: Input | ESC: Give up', { size: 9 }),
        k.pos(CANVAS_WIDTH / 2, 220),
        k.anchor('center'),
        k.color(150, 150, 150),
        k.z(501),
      ]));
    }

    function handlePuzzleInput(key: string): void {
      if (!puzzleActive || !puzzleState) return;

      if (key === 'escape') {
        clearPuzzleUI();
        showFloatingMessage('Puzzle abandoned...', CANVAS_WIDTH / 2, 150, [150, 150, 150]);
        return;
      }

      if (puzzleState.type === 'riddle') {
        if (key === 'up' && puzzleState.selectedOption > 0) {
          puzzleState.selectedOption--;
          renderRiddleOptions();
        } else if (key === 'down' && puzzleState.selectedOption < puzzleState.riddle.options.length - 1) {
          puzzleState.selectedOption++;
          renderRiddleOptions();
        } else if (key === 'enter') {
          const correct = puzzleState.selectedOption === puzzleState.riddle.answer;
          if (correct) {
            solvePuzzle();
          } else {
            failPuzzle();
          }
        }
      } else if (puzzleState.type === 'sequence' && !puzzleState.showPattern) {
        let input = -1;
        if (key === 'up') input = 0;
        else if (key === 'right') input = 1;
        else if (key === 'down') input = 2;

        if (input >= 0) {
          puzzleState.inputs.push(input);
          renderSequenceInput();

          if (puzzleState.inputs.length === puzzleState.sequence.pattern.length) {
            // Check if correct
            const correct = puzzleState.inputs.every(
              (v: number, i: number) => v === puzzleState.sequence.pattern[i]
            );
            if (correct) {
              solvePuzzle();
            } else {
              failPuzzle();
            }
          }
        }
      }
    }

    function solvePuzzle(): void {
      if (!currentPuzzle) return;

      currentPuzzle.triggered = true;
      const goldReward = currentPuzzle.data?.goldReward || 50;
      const xpReward = currentPuzzle.data?.xpReward || 20;

      GameState.addGold(goldReward);
      GameState.addXp(xpReward);

      clearPuzzleUI();
      playSound(k, 'victory');
      showFloatingMessage('Puzzle Solved!', CANVAS_WIDTH / 2, 120, [100, 255, 100]);
      showFloatingMessage(`+${goldReward} Gold!`, CANVAS_WIDTH / 2, 145, [251, 191, 36]);
      showFloatingMessage(`+${xpReward} XP!`, CANVAS_WIDTH / 2, 170, [150, 255, 150]);

      renderer.render(GameState.getCurrentRoom()!);
    }

    function failPuzzle(): void {
      clearPuzzleUI();
      showFloatingMessage('Wrong answer!', CANVAS_WIDTH / 2, 140, [255, 100, 100]);
      // Can retry by walking to puzzle again
    }

    // --- SECRET DISCOVERY ---
    function checkForNearbySecrets(): void {
      const room = GameState.getCurrentRoom();
      if (!room) return;

      nearbySecret = null;

      for (const content of room.contents) {
        if (content.type !== 'secret' || content.triggered) continue;
        if (content.data?.discovered) continue; // Already found

        const bounds = renderer.getMovementBounds();
        const roomWidth = bounds.maxX - bounds.minX + 32;
        const roomHeight = bounds.maxY - bounds.minY + 32;
        const x = bounds.minX - 16 + content.x * roomWidth;
        const y = bounds.minY - 16 + content.y * roomHeight;

        if (player.entity.pos.dist(k.vec2(x, y)) < SEARCH_DISTANCE) {
          nearbySecret = content;
          break;
        }
      }
    }

    function discoverSecret(): void {
      if (!nearbySecret) return;

      nearbySecret.data.discovered = true;
      playSound(k, 'discover');
      showFloatingMessage('You found something!', CANVAS_WIDTH / 2, 100, [255, 220, 100]);

      // Now the secret will render visibly
      renderer.render(GameState.getCurrentRoom()!);
    }

    function claimSecret(content: RoomContent, x: number, y: number): void {
      content.triggered = true;

      const secretName = content.data?.secretName || 'Secret';
      const rewardType = content.data?.rewardType || 'gold_large';

      if (rewardType === 'full_heal') {
        GameState.player.health = GameState.player.maxHealth;
        playSound(k, 'heal');
        showFloatingMessage(`${secretName}!`, x, y - 30, [255, 220, 100]);
        showFloatingMessage('Fully Healed!', x, y - 10, [100, 255, 100]);
      } else {
        const goldReward = content.data?.goldReward || 100;
        const xpReward = content.data?.xpReward || 30;

        GameState.addGold(goldReward);
        GameState.addXp(xpReward);

        playSound(k, 'goldCollect');
        showFloatingMessage(`${secretName}!`, x, y - 30, [255, 220, 100]);
        showFloatingMessage(`+${goldReward} Gold!`, x, y - 10, [251, 191, 36]);
        showFloatingMessage(`+${xpReward} XP!`, x, y + 10, [150, 255, 150]);
      }

      renderer.render(GameState.getCurrentRoom()!);
    }

    // --- INTERACTION DETECTION ---
    k.onUpdate(() => {
      if (isTransitioning || puzzleActive) return;

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

      // Check for nearby secrets
      checkForNearbySecrets();

      // Check content triggers
      for (const content of room.contents) {
        if (content.triggered) continue;

        // Skip undiscovered secrets
        if (content.type === 'secret' && !content.data?.discovered) continue;

        const bounds = renderer.getMovementBounds();
        const roomWidth = bounds.maxX - bounds.minX + 32;
        const roomHeight = bounds.maxY - bounds.minY + 32;
        const x = bounds.minX - 16 + content.x * roomWidth;
        const y = bounds.minY - 16 + content.y * roomHeight;

        if (player.entity.pos.dist(k.vec2(x, y)) < TRIGGER_DISTANCE) {
          handleContentTrigger(content, room, x, y);
          break;
        }
      }
    });

    // --- CONTENT TRIGGER HANDLER ---
    function handleContentTrigger(
      content: RoomContent,
      room: DungeonRoom,
      x: number,
      y: number
    ): void {

      // --- ENEMY ---
      if (content.type === 'enemy') {
        content.triggered = true;

        let enemyId: string;
        if (typeof content.data === 'string') {
          enemyId = content.data;
        } else if (content.data?.enemyType) {
          enemyId = content.data.enemyType;
        } else {
          enemyId = 'grey_slime';
        }
        const enemyDef = ENEMIES[enemyId] || getRandomEnemy();

        const battleData: BattleSceneData = {
          enemyDef,
          floorLevel: GameState.dungeon.floorNumber,
          returnScene: 'dungeon',
          returnData: {
            catColor,
            dungeonId,
            floorNumber: GameState.dungeon.floorNumber,
            floor: GameState.dungeon.floor,
            currentRoomId: GameState.dungeon.currentRoomId,
            returnFromBattle: true,
            playerX: player.entity.pos.x,
            playerY: player.entity.pos.y,
          } as DungeonSceneData,
        };

        k.go('battle', battleData);
        return;
      }

      // --- CHEST ---
      if (content.type === 'chest') {
        content.triggered = true;

        const goldAmount = content.data?.goldAmount ||
          (10 * GameState.dungeon.floorNumber + Math.floor(Math.random() * 20));

        GameState.addGold(goldAmount);
        playSound(k, 'goldCollect');
        showFloatingMessage(`+${goldAmount} Gold!`, x, y - 20, [251, 191, 36]);
        renderer.render(room);
        return;
      }

      // --- PUZZLE (Now interactive!) ---
      if (content.type === 'puzzle') {
        const puzzleType = content.data?.puzzleType || 'riddle';

        if (puzzleType === 'riddle' || puzzleType === 'memory') {
          showRiddlePuzzle(content, x, y);
        } else {
          showSequencePuzzle(content, x, y);
        }
        return;
      }

      // --- SECRET (Must be discovered first) ---
      if (content.type === 'secret') {
        if (!content.data?.discovered) {
          return;
        }
        claimSecret(content, x, y);
        return;
      }

      // --- EXIT ---
      if (content.type === 'exit') {
        if (content.data?.requiresBossDefeated) {
          const bossEnemies = room.contents.filter(c => c.type === 'enemy' && c.data?.isBoss);
          const allBossDefeated = bossEnemies.every(c => c.triggered);
          if (!allBossDefeated) {
            showFloatingMessage('Defeat the boss first!', x, y - 20, [255, 100, 100]);
            return;
          }
        }

        content.triggered = true;
        isTransitioning = true;

        const currentFloor = GameState.dungeon.floorNumber;
        const maxFloors = dungeonConfig.totalFloors;

        const overlay = k.add([
          k.rect(CANVAS_WIDTH, CANVAS_HEIGHT),
          k.pos(0, 0),
          k.color(0, 0, 0),
          k.opacity(0),
          k.z(1000),
        ]);

        if (currentFloor >= maxFloors) {
          const msg = k.add([
            k.text('Dungeon Complete!', { size: 20 }),
            k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20),
            k.anchor('center'),
            k.color(251, 191, 36),
            k.opacity(0),
            k.z(1001),
          ]);

          const subMsg = k.add([
            k.text(`Cleared all ${maxFloors} floors!`, { size: 12 }),
            k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10),
            k.anchor('center'),
            k.color(200, 200, 200),
            k.opacity(0),
            k.z(1001),
          ]);

          k.tween(0, 1, 0.3, (v) => {
            overlay.opacity = v * 0.8;
            msg.opacity = v;
            subMsg.opacity = v;
          });

          playSound(k, 'victory');

          k.wait(2.5, () => {
            GameState.dungeon.floor = null;
            GameState.dungeon.floorNumber = 1;
            GameState.dungeon.currentRoomId = '';
            k.go('town');
          });
        } else {
          const msg = k.add([
            k.text(`Floor ${currentFloor} Complete!`, { size: 20 }),
            k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10),
            k.anchor('center'),
            k.color(251, 191, 36),
            k.opacity(0),
            k.z(1001),
          ]);

          const subMsg = k.add([
            k.text('Descending deeper...', { size: 12 }),
            k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 15),
            k.anchor('center'),
            k.color(200, 200, 200),
            k.opacity(0),
            k.z(1001),
          ]);

          k.tween(0, 1, 0.3, (v) => {
            overlay.opacity = v * 0.8;
            msg.opacity = v;
            subMsg.opacity = v;
          });

          playSound(k, 'doorOpen');

          k.wait(1.5, () => {
            const nextFloor = currentFloor + 1;
            const generator = new DungeonGenerator(dungeonId);
            const newFloorData = generator.generate(nextFloor);

            GameState.dungeon.currentRoomId = '';

            k.go('dungeon', {
              catColor,
              dungeonId,
              floorNumber: nextFloor,
              floor: newFloorData,
            } as DungeonSceneData);
          });
        }
        return;
      }

      // --- TRAP ---
      if (content.type === 'trap') {
        content.triggered = true;

        const damage = content.data?.damage || 5;
        GameState.player.health = Math.max(1, GameState.player.health - damage);

        showFloatingMessage(`-${damage} HP!`, x, y - 20, [240, 60, 60]);

        const originalPos = k.camPos();
        k.tween(0, 1, 0.2, (t) => {
          const shake = Math.sin(t * Math.PI * 4) * 3 * (1 - t);
          k.camPos(originalPos.x + shake, originalPos.y);
        });

        renderer.render(room);
        return;
      }

      // --- REST/CAMPFIRE ---
      if (content.type === 'interactable' && content.data?.interactType === 'campfire') {
        content.triggered = true;

        const healPercent = content.data?.healPercent || 30;
        const healAmount = Math.floor(GameState.player.maxHealth * (healPercent / 100));
        GameState.player.health = Math.min(
          GameState.player.maxHealth,
          GameState.player.health + healAmount
        );

        playSound(k, 'heal');
        showFloatingMessage(`+${healAmount} HP!`, x, y - 20, [100, 255, 100]);
        renderer.render(room);
        return;
      }

      // --- OTHER CONTENT ---
      if (content.type !== 'npc') {
        content.triggered = true;
        if (data.onContentTrigger) data.onContentTrigger(content, room);

        if (
          !room.cleared &&
          room.contents.filter((c) => c.type === 'enemy' && !c.triggered).length === 0
        ) {
          room.cleared = true;
          if (data.onRoomClear) data.onRoomClear(room);
        }

        renderer.render(room);
      }
    }

    // --- INPUT ---
    const handleInteraction = () => {
      if (puzzleActive) return;
      if (isTransitioning || !highlightedDoor) return;

      const room = GameState.getCurrentRoom()!;
      const targetRoomId = room.connections[highlightedDoor];
      if (!targetRoomId) return;

      transitionToRoom(targetRoomId, highlightedDoor);
    };

    k.onKeyPress('enter', () => {
      if (puzzleActive) {
        handlePuzzleInput('enter');
      } else {
        handleInteraction();
      }
    });

    k.onKeyPress('space', () => {
      if (puzzleActive) return;

      // Search for secrets
      if (nearbySecret) {
        discoverSecret();
      } else {
        handleInteraction();
      }
    });

    k.onKeyPress('escape', () => {
      if (puzzleActive) {
        handlePuzzleInput('escape');
      }
    });

    k.onKeyPress('up', () => {
      if (puzzleActive) handlePuzzleInput('up');
    });

    k.onKeyPress('down', () => {
      if (puzzleActive) handlePuzzleInput('down');
    });

    k.onKeyPress('right', () => {
      if (puzzleActive) handlePuzzleInput('right');
    });

    // --- ROOM TRANSITION ---
    async function transitionToRoom(targetRoomId: string, fromDir: DungeonDirection) {
      isTransitioning = true;
      player.freeze();

      const overlay = k.add([
        k.rect(CANVAS_WIDTH, CANVAS_HEIGHT),
        k.pos(0, 0),
        k.color(0, 0, 0),
        k.opacity(0),
        k.z(1000),
      ]);

      await k.tween(0, 1, 0.2, (v) => (overlay.opacity = v), k.easings.easeInQuad);

      GameState.setCurrentRoom(targetRoomId);
      const newRoom = GameState.getCurrentRoom()!;
      await renderer.render(newRoom);

      const opposite: Record<DungeonDirection, DungeonDirection> = {
        north: 'south',
        south: 'north',
        east: 'west',
        west: 'east',
      };
      const entryPos = renderer.getEntryPosition(opposite[fromDir]);
      player.moveTo(entryPos.x, entryPos.y);

      if (data.onRoomEnter) data.onRoomEnter(newRoom);

      await k.tween(1, 0, 0.2, (v) => (overlay.opacity = v), k.easings.easeOutQuad);
      k.destroy(overlay);

      player.unfreeze();
      isTransitioning = false;
    }

    // --- UI ---
    k.onDraw(() => {
      if (puzzleActive) return;

      const room = GameState.getCurrentRoom();
      if (!room) return;

      // Room type label
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

        const doors = k.get('door');
        for (const door of doors) {
          const d = door as unknown as { direction: DungeonDirection };
          door.color = d.direction === highlightedDoor ? k.rgb(251, 191, 36) : k.rgb(74, 222, 128);
        }
      }

      // Secret search prompt
      if (nearbySecret && !highlightedDoor) {
        k.drawRect({
          pos: k.vec2(CANVAS_WIDTH / 2 - 80, CANVAS_HEIGHT - 28),
          width: 160,
          height: 22,
          color: k.rgb(0, 0, 0),
          opacity: 0.7,
        });
        k.drawText({
          text: 'SPACE to search area',
          pos: k.vec2(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 14),
          size: 10,
          anchor: 'center',
          color: k.rgb(255, 220, 100),
        });
      }
    });
  });
}
