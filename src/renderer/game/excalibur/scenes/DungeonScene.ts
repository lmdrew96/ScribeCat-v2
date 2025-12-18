/**
 * DungeonScene for Excalibur.js
 *
 * Procedurally generated dungeon with room-based exploration.
 * Features: enemies, chests, puzzles, secrets, merchants, traps, boss fights.
 */

import * as ex from 'excalibur';
import { GameState } from '../../state/GameState.js';
import { InputManager } from '../adapters/InputAdapter.js';
import { loadCatAnimation } from '../adapters/SpriteAdapter.js';
import {
  DungeonGenerator,
  DUNGEON_CONFIGS,
  type DungeonFloor,
  type DungeonRoom,
  type RoomContent,
} from '../../../canvas/dungeon/DungeonGenerator.js';
import type { CatColor } from '../../data/catSprites.js';
import { ENEMIES, getRandomEnemy } from '../../data/enemies.js';
import { getChestLootItem, getItem, type DungeonTier } from '../../data/items.js';
import {
  loadStaticEnemySprite,
  loadSlimeAnimation,
  getSlimeColorFromFolder,
  getStaticEnemyIdFromFile,
  type SlimeColor,
  type StaticEnemyId,
} from '../../loaders/EnemySpriteLoader.js';
import { SceneFontCache } from '../ui/FontCache.js';

// Scene data passed when entering dungeon
export interface DungeonSceneData {
  catColor?: CatColor;
  dungeonId?: string;
  floorNumber?: number;
  floor?: DungeonFloor;
  currentRoomId?: string;
  returnFromBattle?: boolean;
  playerX?: number;
  playerY?: number;
}

// Callback interface for scene transitions
export interface DungeonSceneCallbacks {
  onGoToBattle: (enemyId: string, returnData: DungeonSceneData) => void;
  onExitToTown: () => void;
  onOpenInventory: (returnData: DungeonSceneData) => void;
}

// Room rendering config
const ROOM_CONFIG = {
  width: 400,
  height: 240,
  offsetX: 40,
  offsetY: 40,
  doorSize: 48,
};

// Canvas dimensions
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 320;

// Dungeon tier mapping for loot
const DUNGEON_TIER_MAP: Record<string, DungeonTier> = {
  training: 1,
  forest: 2,
  crystal: 3,
  library: 4,
  volcano: 5,
  void: 6,
};

// Direction types
type Direction = 'north' | 'south' | 'east' | 'west';

// Riddles for puzzles
const RIDDLES = [
  { question: 'I have keys but no locks. What am I?', answer: 0, options: ['Keyboard', 'Piano', 'Map'] },
  { question: "What has hands but can't clap?", answer: 1, options: ['Gloves', 'Clock', 'Statue'] },
  { question: 'I get wetter as I dry. What am I?', answer: 2, options: ['Sponge', 'Rain', 'Towel'] },
  { question: 'What has a head and tail but no body?', answer: 0, options: ['Coin', 'Snake', 'Comet'] },
  { question: 'What can you catch but not throw?', answer: 1, options: ['Ball', 'Cold', 'Fish'] },
];

// Sequences for puzzles
const SEQUENCES = [
  { pattern: [0, 1, 2], display: '↑ → ↓' },
  { pattern: [1, 0, 1, 2], display: '→ ↑ → ↓' },
  { pattern: [2, 2, 0, 1], display: '↓ ↓ ↑ →' },
  { pattern: [0, 2, 1, 0], display: '↑ ↓ → ↑' },
];

// Puzzle state types for type safety
interface Riddle {
  question: string;
  answer: number;
  options: string[];
}

interface Sequence {
  pattern: number[];
  display: string;
}

interface RiddlePuzzleState {
  type: 'riddle';
  riddle: Riddle;
  selectedOption: number;
}

interface SequencePuzzleState {
  type: 'sequence';
  sequence: Sequence;
  inputIndex: number;
  inputs: number[];
  showPattern: boolean;
}

type PuzzleState = RiddlePuzzleState | SequencePuzzleState | null;

/**
 * DungeonScene - Excalibur implementation
 */
export class DungeonScene extends ex.Scene {
  private callbacks: DungeonSceneCallbacks;
  private inputManager: InputManager | null = null;

  // Input cooldown to prevent key events carrying over from scene transitions
  private inputEnabled = false;

  // Player
  private player!: ex.Actor;
  private catColor: CatColor = 'gray';
  private playerFrozen = false;

  // Dungeon state
  private dungeonId = 'training';
  private floorNumber = 1;

  // Room rendering
  private roomActors: ex.Actor[] = [];
  private contentActors: Map<string, ex.Actor> = new Map();

  // UI state
  private isTransitioning = false;
  private highlightedDoor: Direction | null = null;
  private pauseMenuActive = false;
  private pauseMenuSelection = 0;

  // Puzzle state
  private puzzleActive = false;
  private currentPuzzle: RoomContent | null = null;
  private puzzleState: PuzzleState = null;

  // Merchant state
  private merchantActive = false;
  private nearbyMerchant: RoomContent | null = null;
  private merchantSelection = 0;

  // Secret state
  private nearbySecret: RoomContent | null = null;

  // UI actors
  private uiActors: ex.Actor[] = [];
  private pauseMenuActors: ex.Actor[] = [];
  private puzzleUIActors: ex.Actor[] = [];
  private merchantUIActors: ex.Actor[] = [];

  // HUD actors
  private hpBar!: ex.Actor;
  private goldLabel!: ex.Actor;
  private floorLabel!: ex.Actor;

  // Font cache for performance optimization
  private fontCache = new SceneFontCache();

  // Scene data for return from battle
  private sceneData: DungeonSceneData = {};

  constructor(callbacks: DungeonSceneCallbacks) {
    super();
    this.callbacks = callbacks;
  }

  onActivate(ctx: ex.SceneActivationContext<DungeonSceneData>): void {
    this.sceneData = ctx.data || {};
    this.catColor = this.sceneData.catColor || GameState.player.catColor;
    this.dungeonId = this.sceneData.dungeonId || GameState.dungeon.dungeonId || 'training';

    // Disable input briefly to prevent key events from previous scene
    this.inputEnabled = false;
    setTimeout(() => { this.inputEnabled = true; }, 200);

    GameState.setCatColor(this.catColor);
    GameState.dungeon.dungeonId = this.dungeonId;

    // Initialize floor
    this.initializeFloor();

    // Setup scene
    this.setupPlayer();
    this.setupHUD();
    this.renderCurrentRoom();

    // Create input manager
    this.inputManager = new InputManager(this.engine!);
  }

  onDeactivate(): void {
    // Reset input state to prevent stale handlers from firing
    this.inputEnabled = false;

    // Clean up input manager to remove engine-level event listeners
    this.inputManager?.destroy();
    this.inputManager = null;
    this.clearAllActors();
  }

  private initializeFloor(): void {
    if (this.sceneData.floor) {
      GameState.dungeon.floor = this.sceneData.floor;
      GameState.dungeon.floorNumber = this.sceneData.floorNumber || 1;
      this.floorNumber = GameState.dungeon.floorNumber;

      if (this.sceneData.currentRoomId) {
        GameState.dungeon.currentRoomId = this.sceneData.currentRoomId;
      } else if (!GameState.dungeon.currentRoomId) {
        GameState.dungeon.currentRoomId = this.sceneData.floor.startRoomId;
      }
    } else if (!GameState.dungeon.floor) {
      const floorNum = this.sceneData.floorNumber || 1;
      GameState.dungeon.floorNumber = floorNum;
      this.floorNumber = floorNum;

      const generator = new DungeonGenerator(this.dungeonId);
      const newFloor = generator.generate(floorNum);
      GameState.dungeon.floor = newFloor;
      GameState.dungeon.currentRoomId = newFloor.startRoomId;
    }

    const currentRoom = GameState.getCurrentRoom();
    if (currentRoom) {
      currentRoom.visited = true;
      currentRoom.discovered = true;
    }
  }

  private async setupPlayer(): Promise<void> {
    // Determine start position
    let startX = ROOM_CONFIG.offsetX + ROOM_CONFIG.width / 2;
    let startY = ROOM_CONFIG.offsetY + ROOM_CONFIG.height / 2;

    if (this.sceneData.returnFromBattle && this.sceneData.playerX !== undefined) {
      startX = this.sceneData.playerX;
      startY = this.sceneData.playerY!;
    }

    this.player = new ex.Actor({
      pos: ex.vec(startX, startY),
      width: 24,
      height: 24,
      z: 10,
    });

    // Load cat animation
    try {
      const anim = await loadCatAnimation(this.catColor, 'idle');
      if (anim) {
        this.player.graphics.use(anim);
      }
    } catch {
      // Fallback to colored rectangle
      this.player.graphics.use(
        new ex.Rectangle({
          width: 24,
          height: 24,
          color: ex.Color.fromHex('#4ade80'),
        })
      );
    }

    this.add(this.player);
  }

  private setupHUD(): void {
    const config = DUNGEON_CONFIGS[this.dungeonId] || DUNGEON_CONFIGS.training;

    // HUD background
    const hudBg = new ex.Actor({
      pos: ex.vec(CANVAS_WIDTH - 75, 45),
      width: 130,
      height: 70,
      z: 50,
    });
    hudBg.graphics.use(
      new ex.Rectangle({ width: 130, height: 70, color: ex.Color.fromRGB(0, 0, 0, 0.7) })
    );
    this.add(hudBg);
    this.uiActors.push(hudBg);

    // HP Bar background
    const hpBg = new ex.Actor({
      pos: ex.vec(CANVAS_WIDTH - 60, 20),
      width: 80,
      height: 12,
      z: 51,
    });
    hpBg.graphics.use(
      new ex.Rectangle({ width: 80, height: 12, color: ex.Color.fromRGB(60, 20, 20) })
    );
    this.add(hpBg);
    this.uiActors.push(hpBg);

    // HP Bar
    this.hpBar = new ex.Actor({
      pos: ex.vec(CANVAS_WIDTH - 60, 20),
      width: 80,
      height: 12,
      z: 52,
    });
    this.hpBar.graphics.use(
      new ex.Rectangle({ width: 80, height: 12, color: ex.Color.fromRGB(60, 220, 100) })
    );
    this.add(this.hpBar);
    this.uiActors.push(this.hpBar);

    // Gold label
    this.goldLabel = new ex.Actor({
      pos: ex.vec(CANVAS_WIDTH - 130, 38),
      z: 51,
    });
    this.goldLabel.graphics.use(
      new ex.Text({
        text: `Gold: ${GameState.player.gold}`,
        font: this.fontCache.getFontHex(13, '#fbbf24'),
      })
    );
    this.add(this.goldLabel);
    this.uiActors.push(this.goldLabel);

    // Floor label
    this.floorLabel = new ex.Actor({
      pos: ex.vec(CANVAS_WIDTH - 130, 55),
      z: 51,
    });
    this.floorLabel.graphics.use(
      new ex.Text({
        text: `Floor ${this.floorNumber}/${config.totalFloors}`,
        font: this.fontCache.getFontRGB(13, 200, 200, 200),
      })
    );
    this.add(this.floorLabel);
    this.uiActors.push(this.floorLabel);
  }

  private renderCurrentRoom(): void {
    this.clearRoomActors();

    const room = GameState.getCurrentRoom();
    if (!room) return;

    // Draw room background
    const roomBg = new ex.Actor({
      pos: ex.vec(ROOM_CONFIG.offsetX + ROOM_CONFIG.width / 2, ROOM_CONFIG.offsetY + ROOM_CONFIG.height / 2),
      width: ROOM_CONFIG.width,
      height: ROOM_CONFIG.height,
      z: -10,
    });
    roomBg.graphics.use(
      new ex.Rectangle({
        width: ROOM_CONFIG.width,
        height: ROOM_CONFIG.height,
        color: ex.Color.fromRGB(42, 42, 78),
      })
    );
    this.add(roomBg);
    this.roomActors.push(roomBg);

    // Draw doors
    this.drawDoors(room);

    // Draw content
    this.drawContents(room);
  }

  private drawDoors(room: DungeonRoom): void {
    const doorPositions = this.getDoorPositions();

    for (const [dir, pos] of Object.entries(doorPositions)) {
      const direction = dir as Direction;
      const targetRoomId = room.connections[direction];
      if (!targetRoomId) continue;

      const door = new ex.Actor({
        pos: ex.vec(pos.x, pos.y),
        width: ROOM_CONFIG.doorSize,
        height: ROOM_CONFIG.doorSize,
        z: 0,
      });
      door.graphics.use(
        new ex.Rectangle({
          width: ROOM_CONFIG.doorSize,
          height: ROOM_CONFIG.doorSize,
          color: ex.Color.fromHex('#4ade80'),
        })
      );
      (door as any).doorDirection = direction;
      (door as any).targetRoomId = targetRoomId;

      this.add(door);
      this.roomActors.push(door);

      // Arrow indicator
      const arrows: Record<Direction, string> = { north: '^', south: 'v', east: '>', west: '<' };
      const arrow = new ex.Actor({
        pos: ex.vec(pos.x, pos.y),
        z: 1,
      });
      arrow.graphics.use(
        new ex.Text({
          text: arrows[direction],
          font: this.fontCache.getFont(20, ex.Color.White),
        })
      );
      this.add(arrow);
      this.roomActors.push(arrow);
    }
  }

  private drawContents(room: DungeonRoom): void {
    const { width, height, offsetX, offsetY } = ROOM_CONFIG;

    for (const content of room.contents) {
      // Skip triggered content (except NPCs)
      if (content.triggered && content.type !== 'npc') {
        // Special case: exit after boss defeat
        if (content.type === 'exit' && content.data?.requiresBossDefeated && content.data?.bossDefeated) {
          // Continue to draw
        } else {
          continue;
        }
      }

      // Secrets hidden until discovered
      if (content.type === 'secret' && !content.data?.discovered) continue;

      // Traps invisible until triggered
      if (content.type === 'trap' && !content.triggered) continue;

      // Check boss defeat for exit
      if (content.type === 'exit' && content.data?.requiresBossDefeated && !content.data?.bossDefeated) {
        const bossEnemies = room.contents.filter((c) => c.type === 'enemy' && c.data?.isBoss);
        const allBossDefeated = bossEnemies.every((c) => c.triggered);
        if (!allBossDefeated) continue;
        content.data.bossDefeated = true;
      }

      const x = offsetX + content.x * width;
      const y = offsetY + content.y * height;

      this.createContentActor(content, x, y);
    }
  }

  private async createContentActor(content: RoomContent, x: number, y: number): Promise<void> {
    const colors: Record<string, string> = {
      enemy: '#ef4444',
      chest: '#fbbf24',
      npc: '#60a5fa',
      exit: '#a855f7',
      puzzle: '#3b82f6',
      secret: '#eab308',
      interactable: '#22c55e',
    };

    const icons: Record<string, string> = {
      enemy: '!',
      chest: '$',
      npc: '?',
      exit: 'v',
      puzzle: '?',
      secret: '*',
    };

    const size = content.type === 'puzzle' || content.type === 'secret' ? 16 : 12;
    const color = colors[content.type] || '#ffffff';

    const actor = new ex.Actor({
      pos: ex.vec(x, y),
      width: size * 2,
      height: size * 2,
      z: 5,
    });

    // Try to load actual sprite for enemies
    let spriteLoaded = false;
    if (content.type === 'enemy') {
      const enemyId = typeof content.data === 'string' ? content.data : content.data?.enemyType;
      const enemyDef = enemyId ? ENEMIES[enemyId] : null;

      if (enemyDef) {
        const targetSize = 24; // Small preview size for dungeon map

        if (enemyDef.spriteFolder) {
          // Animated slime enemy
          const slimeColor = getSlimeColorFromFolder(enemyDef.spriteFolder);
          if (slimeColor) {
            const idleAnim = await loadSlimeAnimation(slimeColor, 'idle');
            if (idleAnim) {
              const scale = targetSize / 32; // Slimes are 32x32
              idleAnim.scale = ex.vec(scale, scale);
              actor.graphics.use(idleAnim);
              spriteLoaded = true;
            }
          }
        } else if (enemyDef.spriteFile) {
          // Static enemy
          const staticId = getStaticEnemyIdFromFile(enemyDef.spriteFile);
          if (staticId) {
            const sprite = await loadStaticEnemySprite(staticId);
            if (sprite) {
              const scale = targetSize / Math.max(sprite.width, sprite.height);
              sprite.scale = ex.vec(scale, scale);
              actor.graphics.use(sprite);
              spriteLoaded = true;
            }
          }
        }
      }
    }

    // Fallback to colored circle if sprite not loaded
    if (!spriteLoaded) {
      actor.graphics.use(new ex.Circle({ radius: size, color: ex.Color.fromHex(color) }));
    }

    (actor as any).contentId = content.id;
    (actor as any).contentType = content.type;

    this.add(actor);
    this.roomActors.push(actor);
    this.contentActors.set(content.id, actor);

    // Icon (only show if sprite wasn't loaded)
    const icon = icons[content.type];
    if (icon && !spriteLoaded) {
      const iconActor = new ex.Actor({
        pos: ex.vec(x, y),
        z: 6,
      });
      iconActor.graphics.use(
        new ex.Text({
          text: icon,
          font: this.fontCache.getFont(14, ex.Color.White),
        })
      );
      this.add(iconActor);
      this.roomActors.push(iconActor);
    }
  }

  private getDoorPositions(): Record<Direction, { x: number; y: number }> {
    const { width, height, offsetX, offsetY, doorSize } = ROOM_CONFIG;
    return {
      north: { x: offsetX + width / 2, y: offsetY + doorSize / 2 },
      south: { x: offsetX + width / 2, y: offsetY + height - doorSize / 2 },
      east: { x: offsetX + width - doorSize / 2, y: offsetY + height / 2 },
      west: { x: offsetX + doorSize / 2, y: offsetY + height / 2 },
    };
  }

  private getMovementBounds() {
    const { width, height, offsetX, offsetY } = ROOM_CONFIG;
    const margin = 16;
    return {
      minX: offsetX + margin,
      maxX: offsetX + width - margin,
      minY: offsetY + margin,
      maxY: offsetY + height - margin,
    };
  }

  onPreUpdate(engine: ex.Engine, delta: number): void {
    if (this.isTransitioning) return;

    // Handle different UI modes
    if (this.pauseMenuActive) {
      this.handlePauseMenuInput();
      return;
    }

    if (this.puzzleActive) {
      this.handlePuzzleInput();
      return;
    }

    if (this.merchantActive) {
      this.handleMerchantInput();
      return;
    }

    // Normal gameplay
    this.updatePlayer(delta);
    this.updateHUD();
    this.checkInteractions();
    this.handleGameplayInput();
  }

  private updatePlayer(delta: number): void {
    if (this.playerFrozen) return;

    const speed = 150;
    let dx = 0;
    let dy = 0;

    if (this.inputManager?.isKeyHeld('left')) dx -= 1;
    if (this.inputManager?.isKeyHeld('right')) dx += 1;
    if (this.inputManager?.isKeyHeld('up')) dy -= 1;
    if (this.inputManager?.isKeyHeld('down')) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;

      const newX = this.player.pos.x + dx * speed * (delta / 1000);
      const newY = this.player.pos.y + dy * speed * (delta / 1000);

      const bounds = this.getMovementBounds();
      this.player.pos.x = Math.max(bounds.minX, Math.min(bounds.maxX, newX));
      this.player.pos.y = Math.max(bounds.minY, Math.min(bounds.maxY, newY));
    }
  }

  private updateHUD(): void {
    // Update HP bar (use effective max health to include equipment bonuses)
    const effectiveMaxHp = GameState.getEffectiveMaxHealth();
    const ratio = GameState.player.health / effectiveMaxHp;
    const hpWidth = Math.max(0, 80 * ratio);

    let hpColor = ex.Color.fromRGB(60, 220, 100);
    if (ratio <= 0.25) {
      hpColor = ex.Color.fromRGB(240, 60, 60);
    } else if (ratio <= 0.5) {
      hpColor = ex.Color.fromRGB(240, 200, 60);
    }

    this.hpBar.graphics.use(new ex.Rectangle({ width: hpWidth, height: 12, color: hpColor }));

    // Update gold
    this.goldLabel.graphics.use(
      new ex.Text({
        text: `Gold: ${GameState.player.gold}`,
        font: this.fontCache.getFontHex(13, '#fbbf24'),
      })
    );
  }

  private checkInteractions(): void {
    const room = GameState.getCurrentRoom();
    if (!room) return;

    // Check doors
    this.highlightedDoor = null;
    const doorPositions = this.getDoorPositions();
    for (const [dir, pos] of Object.entries(doorPositions)) {
      const direction = dir as Direction;
      if (!room.connections[direction]) continue;

      const dist = this.player.pos.distance(ex.vec(pos.x, pos.y));
      if (dist < ROOM_CONFIG.doorSize) {
        this.highlightedDoor = direction;
        break;
      }
    }

    // Check secrets
    this.checkNearbySecrets(room);

    // Check merchants
    this.checkNearbyMerchants(room);

    // Check content triggers
    this.checkContentTriggers(room);
  }

  private checkNearbySecrets(room: DungeonRoom): void {
    this.nearbySecret = null;
    const { width, height, offsetX, offsetY } = ROOM_CONFIG;

    for (const content of room.contents) {
      if (content.type !== 'secret' || content.triggered) continue;
      if (content.data?.discovered) continue;

      const x = offsetX + content.x * width;
      const y = offsetY + content.y * height;

      if (this.player.pos.distance(ex.vec(x, y)) < 50) {
        this.nearbySecret = content;
        break;
      }
    }
  }

  private checkNearbyMerchants(room: DungeonRoom): void {
    this.nearbyMerchant = null;
    const { width, height, offsetX, offsetY } = ROOM_CONFIG;

    for (const content of room.contents) {
      if (content.type !== 'npc' || content.data?.npcType !== 'merchant') continue;

      const x = offsetX + content.x * width;
      const y = offsetY + content.y * height;

      if (this.player.pos.distance(ex.vec(x, y)) < 50) {
        this.nearbyMerchant = content;
        break;
      }
    }
  }

  private checkContentTriggers(room: DungeonRoom): void {
    const { width, height, offsetX, offsetY } = ROOM_CONFIG;

    for (const content of room.contents) {
      if (content.triggered) continue;
      if (content.type === 'secret' && !content.data?.discovered) continue;

      const x = offsetX + content.x * width;
      const y = offsetY + content.y * height;

      if (this.player.pos.distance(ex.vec(x, y)) < 40) {
        this.handleContentTrigger(content, room, x, y);
        break;
      }
    }
  }

  private handleContentTrigger(content: RoomContent, room: DungeonRoom, x: number, y: number): void {
    switch (content.type) {
      case 'enemy':
        this.triggerEnemy(content);
        break;
      case 'chest':
        this.triggerChest(content, x, y);
        break;
      case 'puzzle':
        this.showPuzzle(content);
        break;
      case 'secret':
        this.claimSecret(content, x, y);
        break;
      case 'exit':
        this.handleExit(content, room);
        break;
      case 'trap':
        this.triggerTrap(content, x, y);
        break;
      case 'interactable':
        if (content.data?.interactType === 'campfire') {
          this.triggerCampfire(content, x, y);
        }
        break;
    }
  }

  private triggerEnemy(content: RoomContent): void {
    content.triggered = true;

    let enemyId = 'grey_slime';
    if (typeof content.data === 'string') {
      enemyId = content.data;
    } else if (content.data?.enemyType) {
      enemyId = content.data.enemyType;
    }

    const returnData: DungeonSceneData = {
      catColor: this.catColor,
      dungeonId: this.dungeonId,
      floorNumber: this.floorNumber,
      floor: GameState.dungeon.floor!,
      currentRoomId: GameState.dungeon.currentRoomId,
      returnFromBattle: true,
      playerX: this.player.pos.x,
      playerY: this.player.pos.y,
    };

    this.callbacks.onGoToBattle(enemyId, returnData);
  }

  private triggerChest(content: RoomContent, x: number, y: number): void {
    content.triggered = true;

    const goldAmount =
      content.data?.goldAmount || 10 * this.floorNumber + Math.floor(Math.random() * 20);
    GameState.addGold(goldAmount);
    this.showFloatingMessage(`+${goldAmount} Gold!`, x, y - 20, '#fbbf24');

    // Check for item drop
    const tier = (DUNGEON_TIER_MAP[this.dungeonId] || 1) as DungeonTier;
    const lootItemId = getChestLootItem(tier);
    if (lootItemId) {
      const lootItem = getItem(lootItemId);
      if (lootItem) {
        GameState.addItem(lootItemId, 1);
        this.showFloatingMessage(`Found ${lootItem.name}!`, x, y, '#64f88c');
      }
    }

    this.renderCurrentRoom();
  }

  private triggerTrap(content: RoomContent, x: number, y: number): void {
    content.triggered = true;

    const damage = content.data?.damage || 5;
    GameState.player.health = Math.max(1, GameState.player.health - damage);
    this.showFloatingMessage(`-${damage} HP!`, x, y - 20, '#f43f3f');

    this.renderCurrentRoom();
  }

  private triggerCampfire(content: RoomContent, x: number, y: number): void {
    content.triggered = true;

    const effectiveMaxHp = GameState.getEffectiveMaxHealth();
    const healPercent = content.data?.healPercent || 30;
    const healAmount = Math.floor(effectiveMaxHp * (healPercent / 100));
    GameState.player.health = Math.min(
      effectiveMaxHp,
      GameState.player.health + healAmount
    );

    this.showFloatingMessage(`+${healAmount} HP!`, x, y - 20, '#64dc64');
    this.renderCurrentRoom();
  }

  private claimSecret(content: RoomContent, x: number, y: number): void {
    content.triggered = true;

    const rewardType = content.data?.rewardType || 'gold_large';
    const secretName = content.data?.secretName || 'Secret';

    if (rewardType === 'full_heal') {
      GameState.player.health = GameState.getEffectiveMaxHealth();
      this.showFloatingMessage(`${secretName}!`, x, y - 30, '#ffdc64');
      this.showFloatingMessage('Fully Healed!', x, y - 10, '#64dc64');
    } else {
      const goldReward = content.data?.goldReward || 100;
      const xpReward = content.data?.xpReward || 30;
      GameState.addGold(goldReward);
      GameState.addXp(xpReward);
      this.showFloatingMessage(`${secretName}!`, x, y - 30, '#ffdc64');
      this.showFloatingMessage(`+${goldReward} Gold!`, x, y - 10, '#fbbf24');
    }

    this.renderCurrentRoom();
  }

  private handleExit(content: RoomContent, room: DungeonRoom): void {
    // Check if boss needs to be defeated
    if (content.data?.requiresBossDefeated) {
      const bossEnemies = room.contents.filter((c) => c.type === 'enemy' && c.data?.isBoss);
      const allBossDefeated = bossEnemies.every((c) => c.triggered);
      if (!allBossDefeated) {
        this.showFloatingMessage('Defeat the boss first!', this.player.pos.x, this.player.pos.y - 20, '#ff6464');
        return;
      }
    }

    content.triggered = true;
    this.isTransitioning = true;
    this.playerFrozen = true;

    const config = DUNGEON_CONFIGS[this.dungeonId] || DUNGEON_CONFIGS.training;
    const currentFloor = this.floorNumber;
    const maxFloors = config.totalFloors;

    if (currentFloor >= maxFloors) {
      // Dungeon complete - return to town
      this.showFloatingMessage('Dungeon Complete!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '#fbbf24');

      // Clear dungeon state
      GameState.dungeon.dungeonId = null;
      GameState.dungeon.floor = null;
      GameState.dungeon.floorNumber = 1;
      GameState.dungeon.currentRoomId = '';

      setTimeout(() => {
        this.callbacks.onExitToTown();
      }, 2000);
    } else {
      // Next floor
      this.showFloatingMessage(`Floor ${currentFloor} Complete!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '#fbbf24');

      setTimeout(() => {
        const nextFloor = currentFloor + 1;
        const generator = new DungeonGenerator(this.dungeonId);
        const newFloorData = generator.generate(nextFloor);

        GameState.dungeon.floor = newFloorData;
        GameState.dungeon.floorNumber = nextFloor;
        GameState.dungeon.currentRoomId = newFloorData.startRoomId;
        this.floorNumber = nextFloor;

        const currentRoom = GameState.getCurrentRoom();
        if (currentRoom) {
          currentRoom.visited = true;
          currentRoom.discovered = true;
        }

        // Reset player position
        this.player.pos = ex.vec(
          ROOM_CONFIG.offsetX + ROOM_CONFIG.width / 2,
          ROOM_CONFIG.offsetY + ROOM_CONFIG.height / 2
        );

        this.renderCurrentRoom();
        this.updateFloorLabel();
        this.isTransitioning = false;
        this.playerFrozen = false;
      }, 1500);
    }
  }

  private updateFloorLabel(): void {
    const config = DUNGEON_CONFIGS[this.dungeonId] || DUNGEON_CONFIGS.training;
    this.floorLabel.graphics.use(
      new ex.Text({
        text: `Floor ${this.floorNumber}/${config.totalFloors}`,
        font: this.fontCache.getFontRGB(13, 200, 200, 200),
      })
    );
  }

  private handleGameplayInput(): void {
    // Skip input handling during cooldown
    if (!this.inputEnabled) return;

    // Enter/Space - interact
    if (this.inputManager?.wasKeyPressed('enter') || this.inputManager?.wasKeyPressed('space')) {
      if (this.nearbySecret) {
        this.discoverSecret();
      } else if (this.nearbyMerchant) {
        this.showMerchant();
      } else if (this.highlightedDoor) {
        this.transitionToRoom(this.highlightedDoor);
      }
    }

    // Escape - pause menu
    if (this.inputManager?.wasKeyPressed('escape')) {
      this.showPauseMenu();
    }

    // I - inventory
    if (this.inputManager?.wasKeyPressed('i')) {
      const returnData: DungeonSceneData = {
        catColor: this.catColor,
        dungeonId: this.dungeonId,
        floorNumber: this.floorNumber,
        floor: GameState.dungeon.floor!,
        currentRoomId: GameState.dungeon.currentRoomId,
        playerX: this.player.pos.x,
        playerY: this.player.pos.y,
      };
      this.callbacks.onOpenInventory(returnData);
    }
  }

  private discoverSecret(): void {
    if (!this.nearbySecret) return;

    this.nearbySecret.data.discovered = true;
    this.showFloatingMessage('You found something!', this.player.pos.x, this.player.pos.y - 20, '#ffdc64');
    this.renderCurrentRoom();
    this.nearbySecret = null;
  }

  // ============================================================================
  // Room Transitions
  // ============================================================================

  private async transitionToRoom(direction: Direction): Promise<void> {
    if (this.isTransitioning) return;

    const room = GameState.getCurrentRoom();
    if (!room) return;

    const targetRoomId = room.connections[direction];
    if (!targetRoomId) return;

    this.isTransitioning = true;
    this.playerFrozen = true;

    // Fade effect
    const overlay = new ex.Actor({
      pos: ex.vec(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      z: 1000,
    });
    overlay.graphics.use(
      new ex.Rectangle({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, color: ex.Color.Black })
    );
    overlay.graphics.opacity = 0;
    this.add(overlay);

    // Fade in
    for (let i = 0; i <= 10; i++) {
      overlay.graphics.opacity = i / 10;
      await this.delay(20);
    }

    // Change room
    GameState.setCurrentRoom(targetRoomId);
    const newRoom = GameState.getCurrentRoom();
    if (newRoom) {
      newRoom.visited = true;
      newRoom.discovered = true;
    }

    this.renderCurrentRoom();

    // Position player at opposite door
    const opposite: Record<Direction, Direction> = {
      north: 'south',
      south: 'north',
      east: 'west',
      west: 'east',
    };
    const entryPos = this.getEntryPosition(opposite[direction]);
    this.player.pos = ex.vec(entryPos.x, entryPos.y);

    // Fade out
    for (let i = 10; i >= 0; i--) {
      overlay.graphics.opacity = i / 10;
      await this.delay(20);
    }

    overlay.kill();
    this.isTransitioning = false;
    this.playerFrozen = false;
  }

  private getEntryPosition(fromDirection?: Direction): { x: number; y: number } {
    const { width, height, offsetX, offsetY } = ROOM_CONFIG;
    const centerX = offsetX + width / 2;
    const centerY = offsetY + height / 2;
    const margin = 60;

    switch (fromDirection) {
      case 'north':
        return { x: centerX, y: offsetY + margin };
      case 'south':
        return { x: centerX, y: offsetY + height - margin };
      case 'east':
        return { x: offsetX + width - margin, y: centerY };
      case 'west':
        return { x: offsetX + margin, y: centerY };
      default:
        return { x: centerX, y: centerY };
    }
  }

  // ============================================================================
  // Pause Menu
  // ============================================================================

  private showPauseMenu(): void {
    this.pauseMenuActive = true;
    this.pauseMenuSelection = 0;
    this.playerFrozen = true;
    this.renderPauseMenu();
  }

  private renderPauseMenu(): void {
    this.clearPauseMenu();

    // Backdrop
    const backdrop = new ex.Actor({
      pos: ex.vec(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      z: 800,
    });
    backdrop.graphics.use(
      new ex.Rectangle({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, color: ex.Color.fromRGB(0, 0, 0, 0.7) })
    );
    this.add(backdrop);
    this.pauseMenuActors.push(backdrop);

    // Menu box
    const menuWidth = 200;
    const menuHeight = 120;
    const menuBox = new ex.Actor({
      pos: ex.vec(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
      width: menuWidth,
      height: menuHeight,
      z: 801,
    });
    menuBox.graphics.use(
      new ex.Rectangle({ width: menuWidth, height: menuHeight, color: ex.Color.fromRGB(30, 30, 50) })
    );
    this.add(menuBox);
    this.pauseMenuActors.push(menuBox);

    // Title
    const title = new ex.Actor({
      pos: ex.vec(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40),
      z: 802,
    });
    title.graphics.use(
      new ex.Text({
        text: 'PAUSED',
        font: this.fontCache.getFont(16, ex.Color.White),
      })
    );
    this.add(title);
    this.pauseMenuActors.push(title);

    // Options
    const options = ['Resume', 'Leave Dungeon'];
    options.forEach((opt, i) => {
      const isSelected = i === this.pauseMenuSelection;
      const optActor = new ex.Actor({
        pos: ex.vec(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10 + i * 28),
        z: 802,
      });
      optActor.graphics.use(
        new ex.Text({
          text: `${isSelected ? '> ' : '  '}${opt}`,
          font: this.fontCache.getFontHex(
            14,
            isSelected ? '#ffff64' : '#b4b4b4'
          ),
        })
      );
      this.add(optActor);
      this.pauseMenuActors.push(optActor);
    });
  }

  private handlePauseMenuInput(): void {
    if (!this.inputEnabled) return;

    if (this.inputManager?.wasKeyPressed('up') || this.inputManager?.wasKeyPressed('w')) {
      this.pauseMenuSelection = Math.max(0, this.pauseMenuSelection - 1);
      this.renderPauseMenu();
    } else if (this.inputManager?.wasKeyPressed('down') || this.inputManager?.wasKeyPressed('s')) {
      this.pauseMenuSelection = Math.min(1, this.pauseMenuSelection + 1);
      this.renderPauseMenu();
    } else if (this.inputManager?.wasKeyPressed('enter') || this.inputManager?.wasKeyPressed('space')) {
      if (this.pauseMenuSelection === 0) {
        // Resume
        this.hidePauseMenu();
      } else {
        // Leave dungeon
        this.hidePauseMenu();
        this.leaveDungeon();
      }
    } else if (this.inputManager?.wasKeyPressed('escape')) {
      this.hidePauseMenu();
    }
  }

  private hidePauseMenu(): void {
    this.clearPauseMenu();
    this.pauseMenuActive = false;
    this.playerFrozen = false;
  }

  private clearPauseMenu(): void {
    for (const actor of this.pauseMenuActors) {
      actor.kill();
    }
    this.pauseMenuActors = [];
  }

  private leaveDungeon(): void {
    // Clear dungeon state
    GameState.dungeon.floor = null;
    GameState.dungeon.currentRoomId = '';
    GameState.dungeon.floorNumber = 1;

    this.callbacks.onExitToTown();
  }

  // ============================================================================
  // Puzzle System
  // ============================================================================

  private showPuzzle(content: RoomContent): void {
    this.puzzleActive = true;
    this.currentPuzzle = content;
    this.playerFrozen = true;

    const puzzleType = content.data?.puzzleType || 'riddle';
    if (puzzleType === 'riddle' || puzzleType === 'memory') {
      this.showRiddlePuzzle();
    } else {
      this.showSequencePuzzle();
    }
  }

  private showRiddlePuzzle(): void {
    this.clearPuzzleUI();

    const riddle = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
    this.puzzleState = { type: 'riddle', riddle, selectedOption: 0 } as RiddlePuzzleState;

    // Background
    const bg = new ex.Actor({
      pos: ex.vec(CANVAS_WIDTH / 2, 160),
      width: 380,
      height: 180,
      z: 500,
    });
    bg.graphics.use(
      new ex.Rectangle({ width: 380, height: 180, color: ex.Color.fromRGB(20, 20, 40) })
    );
    this.add(bg);
    this.puzzleUIActors.push(bg);

    // Title
    const title = new ex.Actor({ pos: ex.vec(CANVAS_WIDTH / 2, 85), z: 501 });
    title.graphics.use(
      new ex.Text({
        text: 'Riddle Stone',
        font: this.fontCache.getFontHex(14, '#64b4ff'),
      })
    );
    this.add(title);
    this.puzzleUIActors.push(title);

    // Question
    const question = new ex.Actor({ pos: ex.vec(CANVAS_WIDTH / 2, 115), z: 501 });
    question.graphics.use(
      new ex.Text({
        text: riddle.question,
        font: this.fontCache.getFont(14, ex.Color.White),
      })
    );
    this.add(question);
    this.puzzleUIActors.push(question);

    this.renderRiddleOptions();

    // Instructions
    const instr = new ex.Actor({ pos: ex.vec(CANVAS_WIDTH / 2, 240), z: 501 });
    instr.graphics.use(
      new ex.Text({
        text: 'W/S or Up/Down: Select | ENTER/SPACE: Answer | ESC: Leave',
        font: this.fontCache.getFontRGB(12, 150, 150, 150),
      })
    );
    this.add(instr);
    this.puzzleUIActors.push(instr);
  }

  private renderRiddleOptions(): void {
    // Remove old options (keep first 3 elements: bg, title, question)
    while (this.puzzleUIActors.length > 3) {
      const actor = this.puzzleUIActors.pop();
      actor?.kill();
    }

    if (!this.puzzleState || this.puzzleState.type !== 'riddle') return;

    const riddle = this.puzzleState.riddle;
    riddle.options.forEach((opt: string, i: number) => {
      const isSelected = i === this.puzzleState!.selectedOption;
      const optActor = new ex.Actor({ pos: ex.vec(CANVAS_WIDTH / 2, 155 + i * 28), z: 502 });
      optActor.graphics.use(
        new ex.Text({
          text: `${i + 1}. ${opt}`,
          font: this.fontCache.getFontHex(
            13,
            isSelected ? '#64ff64' : '#FFFFFF'
          ),
        })
      );
      this.add(optActor);
      this.puzzleUIActors.push(optActor);
    });
  }

  private showSequencePuzzle(): void {
    this.clearPuzzleUI();

    const sequence = SEQUENCES[Math.floor(Math.random() * SEQUENCES.length)];
    this.puzzleState = { type: 'sequence', sequence, inputIndex: 0, inputs: [], showPattern: true } as SequencePuzzleState;

    // Background
    const bg = new ex.Actor({
      pos: ex.vec(CANVAS_WIDTH / 2, 160),
      width: 380,
      height: 160,
      z: 500,
    });
    bg.graphics.use(
      new ex.Rectangle({ width: 380, height: 160, color: ex.Color.fromRGB(20, 20, 40) })
    );
    this.add(bg);
    this.puzzleUIActors.push(bg);

    // Title
    const title = new ex.Actor({ pos: ex.vec(CANVAS_WIDTH / 2, 95), z: 501 });
    title.graphics.use(
      new ex.Text({
        text: 'Sequence Lock',
        font: this.fontCache.getFontHex(14, '#ffb464'),
      })
    );
    this.add(title);
    this.puzzleUIActors.push(title);

    // Pattern
    const pattern = new ex.Actor({ pos: ex.vec(CANVAS_WIDTH / 2, 130), z: 501 });
    pattern.graphics.use(
      new ex.Text({
        text: `Memorize: ${sequence.display}`,
        font: this.fontCache.getFontHex(16, '#ffff64'),
      })
    );
    this.add(pattern);
    this.puzzleUIActors.push(pattern);

    // Hide pattern after 3 seconds
    setTimeout(() => {
      if (this.puzzleActive && this.puzzleState?.type === 'sequence') {
        this.puzzleState.showPattern = false;
        this.renderSequenceInput();
      }
    }, 3000);
  }

  private renderSequenceInput(): void {
    this.clearPuzzleUI();

    if (!this.puzzleState || this.puzzleState.type !== 'sequence') return;
    const seqState = this.puzzleState;

    // Background
    const bg = new ex.Actor({
      pos: ex.vec(CANVAS_WIDTH / 2, 160),
      width: 380,
      height: 160,
      z: 500,
    });
    bg.graphics.use(
      new ex.Rectangle({ width: 380, height: 160, color: ex.Color.fromRGB(20, 20, 40) })
    );
    this.add(bg);
    this.puzzleUIActors.push(bg);

    // Title
    const title = new ex.Actor({ pos: ex.vec(CANVAS_WIDTH / 2, 95), z: 501 });
    title.graphics.use(
      new ex.Text({
        text: 'Enter the Sequence!',
        font: this.fontCache.getFontHex(14, '#ffb464'),
      })
    );
    this.add(title);
    this.puzzleUIActors.push(title);

    // Show inputs
    const arrows = ['Up', 'Right', 'Down'];
    const inputStr = seqState.inputs.map((i: number) => arrows[i]).join(' ') || '...';
    const inputs = new ex.Actor({ pos: ex.vec(CANVAS_WIDTH / 2, 130), z: 501 });
    inputs.graphics.use(
      new ex.Text({
        text: `Your input: ${inputStr}`,
        font: this.fontCache.getFontHex(14, '#64ff64'),
      })
    );
    this.add(inputs);
    this.puzzleUIActors.push(inputs);

    // Progress
    const progress = new ex.Actor({ pos: ex.vec(CANVAS_WIDTH / 2, 155), z: 501 });
    progress.graphics.use(
      new ex.Text({
        text: `${seqState.inputs.length}/${seqState.sequence.pattern.length}`,
        font: this.fontCache.getFontRGB(12, 200, 200, 200),
      })
    );
    this.add(progress);
    this.puzzleUIActors.push(progress);

    // Instructions
    const instr = new ex.Actor({ pos: ex.vec(CANVAS_WIDTH / 2, 220), z: 501 });
    instr.graphics.use(
      new ex.Text({
        text: 'Arrow Keys: Input | ESC: Give up',
        font: this.fontCache.getFontRGB(12, 150, 150, 150),
      })
    );
    this.add(instr);
    this.puzzleUIActors.push(instr);
  }

  private handlePuzzleInput(): void {
    if (!this.inputEnabled) return;
    if (!this.puzzleActive || !this.puzzleState) return;

    if (this.inputManager?.wasKeyPressed('escape')) {
      this.clearPuzzleUI();
      this.puzzleActive = false;
      this.currentPuzzle = null;
      this.puzzleState = null;
      this.playerFrozen = false;
      return;
    }

    if (this.puzzleState.type === 'riddle') {
      const riddleState = this.puzzleState;
      if ((this.inputManager?.wasKeyPressed('up') || this.inputManager?.wasKeyPressed('w')) && riddleState.selectedOption > 0) {
        riddleState.selectedOption--;
        this.renderRiddleOptions();
      } else if (
        (this.inputManager?.wasKeyPressed('down') || this.inputManager?.wasKeyPressed('s')) &&
        riddleState.selectedOption < riddleState.riddle.options.length - 1
      ) {
        riddleState.selectedOption++;
        this.renderRiddleOptions();
      } else if (this.inputManager?.wasKeyPressed('enter') || this.inputManager?.wasKeyPressed('space')) {
        const correct = riddleState.selectedOption === riddleState.riddle.answer;
        if (correct) {
          this.solvePuzzle();
        } else {
          this.failPuzzle();
        }
      }
    } else if (this.puzzleState.type === 'sequence' && !this.puzzleState.showPattern) {
      const seqState = this.puzzleState;
      let input = -1;
      if (this.inputManager?.wasKeyPressed('up')) input = 0;
      else if (this.inputManager?.wasKeyPressed('right')) input = 1;
      else if (this.inputManager?.wasKeyPressed('down')) input = 2;

      if (input >= 0) {
        seqState.inputs.push(input);
        this.renderSequenceInput();

        if (seqState.inputs.length === seqState.sequence.pattern.length) {
          const correct = seqState.inputs.every(
            (v: number, i: number) => v === seqState.sequence.pattern[i]
          );
          if (correct) {
            this.solvePuzzle();
          } else {
            this.failPuzzle();
          }
        }
      }
    }
  }

  private solvePuzzle(): void {
    if (!this.currentPuzzle) return;

    this.currentPuzzle.triggered = true;
    const goldReward = this.currentPuzzle.data?.goldReward || 50;
    const xpReward = this.currentPuzzle.data?.xpReward || 20;

    GameState.addGold(goldReward);
    GameState.addXp(xpReward);

    this.clearPuzzleUI();
    this.puzzleActive = false;
    this.currentPuzzle = null;
    this.puzzleState = null;
    this.playerFrozen = false;

    this.showFloatingMessage('Puzzle Solved!', CANVAS_WIDTH / 2, 120, '#64ff64');
    this.showFloatingMessage(`+${goldReward} Gold!`, CANVAS_WIDTH / 2, 145, '#fbbf24');

    this.renderCurrentRoom();
  }

  private failPuzzle(): void {
    this.clearPuzzleUI();
    this.puzzleActive = false;
    this.currentPuzzle = null;
    this.puzzleState = null;
    this.playerFrozen = false;

    this.showFloatingMessage('Wrong answer!', CANVAS_WIDTH / 2, 140, '#ff6464');
  }

  private clearPuzzleUI(): void {
    for (const actor of this.puzzleUIActors) {
      actor.kill();
    }
    this.puzzleUIActors = [];
  }

  // ============================================================================
  // Merchant System
  // ============================================================================

  private showMerchant(): void {
    if (!this.nearbyMerchant) return;

    this.merchantActive = true;
    this.merchantSelection = 0;
    this.playerFrozen = true;
    this.renderMerchantUI();
  }

  private renderMerchantUI(): void {
    this.clearMerchantUI();

    const items = this.nearbyMerchant?.data?.inventory || ['potion_minor', 'potion_medium'];

    // Background
    const bg = new ex.Actor({
      pos: ex.vec(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
      width: 280,
      height: 200,
      z: 500,
    });
    bg.graphics.use(
      new ex.Rectangle({ width: 280, height: 200, color: ex.Color.fromRGB(30, 25, 40) })
    );
    this.add(bg);
    this.merchantUIActors.push(bg);

    // Title
    const title = new ex.Actor({ pos: ex.vec(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80), z: 501 });
    title.graphics.use(
      new ex.Text({
        text: 'Merchant',
        font: this.fontCache.getFontHex(16, '#ffc864'),
      })
    );
    this.add(title);
    this.merchantUIActors.push(title);

    // Gold display
    const gold = new ex.Actor({ pos: ex.vec(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60), z: 501 });
    gold.graphics.use(
      new ex.Text({
        text: `Your Gold: ${GameState.player.gold}`,
        font: this.fontCache.getFontHex(13, '#fbbf24'),
      })
    );
    this.add(gold);
    this.merchantUIActors.push(gold);

    // Items
    items.forEach((itemId: string, i: number) => {
      const item = getItem(itemId);
      if (!item) return;

      const isSelected = i === this.merchantSelection;
      const itemActor = new ex.Actor({
        pos: ex.vec(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30 + i * 25),
        z: 501,
      });
      itemActor.graphics.use(
        new ex.Text({
          text: `${isSelected ? '> ' : '  '}${item.name} - ${item.buyPrice}g`,
          font: this.fontCache.getFontHex(
            13,
            isSelected ? '#FFFFFF' : '#b4b4b4'
          ),
        })
      );
      this.add(itemActor);
      this.merchantUIActors.push(itemActor);
    });

    // Instructions
    const instr = new ex.Actor({ pos: ex.vec(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80), z: 501 });
    instr.graphics.use(
      new ex.Text({
        text: 'W/S or Up/Down: Select | ENTER: Buy | ESC: Leave',
        font: this.fontCache.getFontRGB(12, 150, 150, 150),
      })
    );
    this.add(instr);
    this.merchantUIActors.push(instr);
  }

  private handleMerchantInput(): void {
    if (!this.inputEnabled) return;

    const items = this.nearbyMerchant?.data?.inventory || ['potion_minor', 'potion_medium'];

    if (this.inputManager?.wasKeyPressed('escape')) {
      this.hideMerchant();
    } else if (this.inputManager?.wasKeyPressed('up') || this.inputManager?.wasKeyPressed('w')) {
      this.merchantSelection = Math.max(0, this.merchantSelection - 1);
      this.renderMerchantUI();
    } else if (this.inputManager?.wasKeyPressed('down') || this.inputManager?.wasKeyPressed('s')) {
      this.merchantSelection = Math.min(items.length - 1, this.merchantSelection + 1);
      this.renderMerchantUI();
    } else if (this.inputManager?.wasKeyPressed('enter') || this.inputManager?.wasKeyPressed('space')) {
      const itemId = items[this.merchantSelection];
      const item = getItem(itemId);
      if (item && GameState.player.gold >= item.buyPrice) {
        GameState.addGold(-item.buyPrice);
        GameState.addItem(itemId, 1);
        this.showFloatingMessage(`Bought ${item.name}!`, CANVAS_WIDTH / 2, 100, '#64ff64');
        this.renderMerchantUI();
      } else {
        this.showFloatingMessage('Not enough gold!', CANVAS_WIDTH / 2, 100, '#ff6464');
      }
    }
  }

  private hideMerchant(): void {
    this.clearMerchantUI();
    this.merchantActive = false;
    this.playerFrozen = false;
  }

  private clearMerchantUI(): void {
    for (const actor of this.merchantUIActors) {
      actor.kill();
    }
    this.merchantUIActors = [];
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private showFloatingMessage(text: string, x: number, y: number, color: string): void {
    const msg = new ex.Actor({
      pos: ex.vec(x, y),
      z: 200,
    });
    msg.graphics.use(
      new ex.Text({
        text,
        font: this.fontCache.getFontHex(14, color),
      })
    );
    this.add(msg);

    // Animate up and fade
    msg.actions.moveBy(ex.vec(0, -40), 1000);

    setTimeout(() => {
      msg.kill();
    }, 1000);
  }

  private clearRoomActors(): void {
    for (const actor of this.roomActors) {
      actor.kill();
    }
    this.roomActors = [];
    this.contentActors.clear();
  }

  private clearAllActors(): void {
    this.clearRoomActors();
    this.clearPauseMenu();
    this.clearPuzzleUI();
    this.clearMerchantUI();

    for (const actor of this.uiActors) {
      actor.kill();
    }
    this.uiActors = [];

    if (this.player) {
      this.player.kill();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
