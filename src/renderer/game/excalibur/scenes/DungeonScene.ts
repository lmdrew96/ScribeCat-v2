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
import { loadNPCSprite, type NPCId } from '../../loaders/NPCSpriteLoader.js';
import { DungeonPauseOverlay } from '../components/DungeonPauseOverlay.js';
import { DungeonMerchantOverlay } from '../components/DungeonMerchantOverlay.js';
import { DungeonPuzzleOverlay } from '../components/DungeonPuzzleOverlay.js';
import { getDungeonRoomLoader, type DungeonRoomData } from '../../loaders/DungeonRoomLoader.js';
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

// Room rendering config - larger for better visibility
const ROOM_CONFIG = {
  width: 520,
  height: 340,
  offsetX: 60,
  offsetY: 30,
  doorSize: 56,
};

// Canvas dimensions - larger dungeon canvas
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 400;

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

  // Puzzle state
  private puzzleActive = false;
  private currentPuzzle: RoomContent | null = null;

  // Merchant state
  private merchantActive = false;
  private nearbyMerchant: RoomContent | null = null;

  // Secret state
  private nearbySecret: RoomContent | null = null;

  // UI actors (canvas-based HUD)
  private uiActors: ex.Actor[] = [];

  // HTML Overlays (replaces canvas-based pause/merchant/puzzle UI)
  private pauseOverlay: DungeonPauseOverlay | null = null;
  private merchantOverlay: DungeonMerchantOverlay | null = null;
  private puzzleOverlay: DungeonPuzzleOverlay | null = null;

  // HUD actors
  private hpBar!: ex.Actor;
  private goldLabel!: ex.Actor;
  private floorLabel!: ex.Actor;

  // Font cache for performance optimization
  private fontCache = new SceneFontCache();

  // Tilemap room rendering
  private roomTilemapActors: ex.Actor[] = [];
  private roomTemplateMap: Map<string, number> = new Map(); // roomId -> templateId
  
  // Current tilemap state (updated each room render)
  private currentTilemapScale: number = 1;
  private currentTilemapOffsetX: number = 0;
  private currentTilemapOffsetY: number = 0;
  private currentRoomData: DungeonRoomData | null = null;

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
    this.setupHTMLOverlays();
    this.renderCurrentRoom();

    // Load dungeon room tilemaps in background (will re-render when ready)
    this.loadDungeonTilemaps();

    // Create input manager
    this.inputManager = new InputManager(this.engine!);
  }

  /**
   * Load dungeon room tilemaps asynchronously
   */
  private async loadDungeonTilemaps(): Promise<void> {
    const loader = getDungeonRoomLoader();
    if (!loader.isLoaded) {
      await loader.loadAll();
      // Re-render current room with tilemap background
      this.renderCurrentRoom();
    }
  }

  onDeactivate(): void {
    // Reset input state to prevent stale handlers from firing
    this.inputEnabled = false;

    // Clean up input manager to remove engine-level event listeners
    this.inputManager?.destroy();
    this.inputManager = null;
    
    // Destroy HTML overlays
    this.pauseOverlay?.destroy();
    this.pauseOverlay = null;
    this.merchantOverlay?.destroy();
    this.merchantOverlay = null;
    this.puzzleOverlay?.destroy();
    this.puzzleOverlay = null;
    
    this.clearAllActors();
  }

  /**
   * Setup HTML-based overlays for pause menu, merchant, and puzzles
   */
  private setupHTMLOverlays(): void {
    const canvas = this.engine?.canvas;
    if (!canvas?.parentElement) return;

    // Pause menu overlay
    this.pauseOverlay = new DungeonPauseOverlay(canvas.parentElement, {
      onResume: () => {
        this.pauseMenuActive = false;
        this.playerFrozen = false;
      },
      onLeaveDungeon: () => {
        this.pauseMenuActive = false;
        this.playerFrozen = false;
        this.leaveDungeon();
      },
    });

    // Merchant overlay
    this.merchantOverlay = new DungeonMerchantOverlay(canvas.parentElement, {
      onBuy: (itemId: string) => {
        const item = getItem(itemId);
        if (item && GameState.player.gold >= item.buyPrice) {
          GameState.addGold(-item.buyPrice);
          GameState.addItem(itemId, 1);
          this.showFloatingMessage(`Bought ${item.name}!`, CANVAS_WIDTH / 2, 100, '#64ff64');
          return true;
        } else {
          this.showFloatingMessage('Not enough gold!', CANVAS_WIDTH / 2, 100, '#ff6464');
          return false;
        }
      },
      onClose: () => {
        this.merchantActive = false;
        this.playerFrozen = false;
      },
      getGold: () => GameState.player.gold,
    });

    // Puzzle overlay
    this.puzzleOverlay = new DungeonPuzzleOverlay(canvas.parentElement, {
      onSolve: () => {
        this.solvePuzzle();
      },
      onFail: () => {
        this.failPuzzle();
      },
      onClose: () => {
        this.puzzleActive = false;
        this.currentPuzzle = null;
        this.playerFrozen = false;
      },
    });
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

    // HUD background (top-left for consistency with town)
    const hudBg = new ex.Actor({
      pos: ex.vec(70, 50),
      width: 140,
      height: 100,
      z: 50,
    });
    hudBg.graphics.use(
      new ex.Rectangle({ width: 140, height: 100, color: ex.Color.fromRGB(0, 0, 0, 0.7) })
    );
    this.add(hudBg);
    this.uiActors.push(hudBg);

    // HP Bar background (left-aligned)
    const hpBg = new ex.Actor({
      pos: ex.vec(10, 12),
      width: 120,
      height: 14,
      anchor: ex.vec(0, 0.5),
      z: 51,
    });
    hpBg.graphics.use(
      new ex.Rectangle({ width: 120, height: 14, color: ex.Color.fromRGB(60, 20, 20) })
    );
    this.add(hpBg);
    this.uiActors.push(hpBg);

    // HP Bar (left-aligned anchor so it grows from left)
    this.hpBar = new ex.Actor({
      pos: ex.vec(10, 12),
      width: 120,
      height: 14,
      anchor: ex.vec(0, 0.5),
      z: 52,
    });
    this.hpBar.graphics.use(
      new ex.Rectangle({ width: 120, height: 14, color: ex.Color.fromRGB(60, 220, 100) })
    );
    this.add(this.hpBar);
    this.uiActors.push(this.hpBar);

    // HP Text overlay
    const hpText = new ex.Actor({
      pos: ex.vec(70, 12),
      z: 53,
    });
    hpText.graphics.use(
      new ex.Text({
        text: `${GameState.player.health}/${GameState.getEffectiveMaxHealth()}`,
        font: this.fontCache.getFont(11, ex.Color.White),
      })
    );
    this.add(hpText);
    this.uiActors.push(hpText);

    // Level label
    const levelLabel = new ex.Actor({
      pos: ex.vec(10, 32),
      anchor: ex.vec(0, 0.5),
      z: 51,
    });
    levelLabel.graphics.use(
      new ex.Text({
        text: `Lv.${GameState.player.level}`,
        font: this.fontCache.getFont(12, ex.Color.White),
      })
    );
    this.add(levelLabel);
    this.uiActors.push(levelLabel);

    // XP label
    const xpLabel = new ex.Actor({
      pos: ex.vec(60, 32),
      anchor: ex.vec(0, 0.5),
      z: 51,
    });
    xpLabel.graphics.use(
      new ex.Text({
        text: `XP: ${GameState.player.xp}`,
        font: this.fontCache.getFontHex(11, '#a78bfa'),
      })
    );
    this.add(xpLabel);
    this.uiActors.push(xpLabel);

    // Gold label
    this.goldLabel = new ex.Actor({
      pos: ex.vec(10, 52),
      anchor: ex.vec(0, 0.5),
      z: 51,
    });
    this.goldLabel.graphics.use(
      new ex.Text({
        text: `Gold: ${GameState.player.gold}`,
        font: this.fontCache.getFontHex(12, '#fbbf24'),
      })
    );
    this.add(this.goldLabel);
    this.uiActors.push(this.goldLabel);

    // Floor label
    this.floorLabel = new ex.Actor({
      pos: ex.vec(10, 72),
      anchor: ex.vec(0, 0.5),
      z: 51,
    });
    this.floorLabel.graphics.use(
      new ex.Text({
        text: `Floor ${this.floorNumber}/${config.totalFloors}`,
        font: this.fontCache.getFontRGB(12, 200, 200, 200),
      })
    );
    this.add(this.floorLabel);
    this.uiActors.push(this.floorLabel);

    // Controls hint (bottom of HUD)
    const controlsHint = new ex.Actor({
      pos: ex.vec(10, 92),
      anchor: ex.vec(0, 0.5),
      z: 51,
    });
    controlsHint.graphics.use(
      new ex.Text({
        text: 'I:Inv ESC:Menu',
        font: this.fontCache.getFontRGB(10, 150, 150, 150),
      })
    );
    this.add(controlsHint);
    this.uiActors.push(controlsHint);
  }

  private renderCurrentRoom(): void {
    this.clearRoomActors();

    const room = GameState.getCurrentRoom();
    if (!room) return;

    // Try to render tilemap background, fallback to solid color
    const tilemapRendered = this.renderTilemapBackground(room.id);

    if (!tilemapRendered) {
      // Fallback: Draw solid color room background
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
    }

    // Draw doors
    this.drawDoors(room);

    // Draw content
    this.drawContents(room);
  }

  /**
   * Render tilemap background for a room
   * Returns true if tilemap was rendered, false if fallback needed
   */
  private renderTilemapBackground(roomId: string): boolean {
    const loader = getDungeonRoomLoader();
    if (!loader.isLoaded) {
      this.currentRoomData = null;
      return false;
    }

    // Get the current room's connections to determine which doors are needed
    const room = GameState.getCurrentRoom();
    if (!room) {
      this.currentRoomData = null;
      return false;
    }

    // Get or assign a template ID for this room
    let templateId = this.roomTemplateMap.get(roomId);
    if (templateId === undefined) {
      // Find a template that matches the room's door connections
      const hasNorth = !!room.connections.north;
      const hasSouth = !!room.connections.south;
      const hasEast = !!room.connections.east;
      const hasWest = !!room.connections.west;
      
      const matchingRoom = loader.getRoomForConnections(hasNorth, hasSouth, hasEast, hasWest);
      if (!matchingRoom) {
        this.currentRoomData = null;
        return false;
      }
      templateId = matchingRoom.id;
      this.roomTemplateMap.set(roomId, templateId);
      console.log(`[DungeonScene] Assigned room template ${templateId} for room ${roomId} (N:${hasNorth} S:${hasSouth} E:${hasEast} W:${hasWest})`);
    }

    const roomData = loader.getRoom(templateId);
    if (!roomData) {
      this.currentRoomData = null;
      return false;
    }

    // Calculate scale to fit the tilemap into ROOM_CONFIG dimensions
    // TMX rooms are 320x160, ROOM_CONFIG is 520x340
    const tilemapDims = loader.getRoomDimensions(1);
    const scaleX = ROOM_CONFIG.width / tilemapDims.width;
    const scaleY = ROOM_CONFIG.height / tilemapDims.height;
    const scale = Math.min(scaleX, scaleY); // Use uniform scale to maintain aspect ratio

    // Center the tilemap within the room area
    const scaledWidth = tilemapDims.width * scale;
    const scaledHeight = tilemapDims.height * scale;
    const offsetX = ROOM_CONFIG.offsetX + (ROOM_CONFIG.width - scaledWidth) / 2;
    const offsetY = ROOM_CONFIG.offsetY + (ROOM_CONFIG.height - scaledHeight) / 2;

    // Store current tilemap state for door/collider positioning
    this.currentTilemapScale = scale;
    this.currentTilemapOffsetX = offsetX;
    this.currentTilemapOffsetY = offsetY;
    this.currentRoomData = roomData;

    // Create tilemap actors
    const tilemapActors = loader.createRoomActors(roomData, offsetX, offsetY, scale, -10);

    // Add all tilemap actors to the scene
    for (const actor of tilemapActors) {
      this.add(actor);
      this.roomActors.push(actor);
    }

    return tilemapActors.length > 0;
  }

  private drawDoors(room: DungeonRoom): void {
    const doorPositions = this.getDoorPositions();

    for (const [dir, pos] of Object.entries(doorPositions)) {
      const direction = dir as Direction;
      const targetRoomId = room.connections[direction];
      if (!targetRoomId) continue;

      // Create invisible door trigger zone (the tilemap provides visual door art)
      const door = new ex.Actor({
        pos: ex.vec(pos.x, pos.y),
        width: ROOM_CONFIG.doorSize,
        height: ROOM_CONFIG.doorSize,
        z: 0,
      });
      
      // Only show green door indicators if tilemap is not loaded (fallback mode)
      if (!this.currentRoomData) {
        door.graphics.use(
          new ex.Rectangle({
            width: ROOM_CONFIG.doorSize,
            height: ROOM_CONFIG.doorSize,
            color: ex.Color.fromHex('#4ade80'),
          })
        );
        
        // Arrow indicator only in fallback mode
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
      
      (door as any).doorDirection = direction;
      (door as any).targetRoomId = targetRoomId;

      this.add(door);
      this.roomActors.push(door);
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
    } else if (content.type === 'npc') {
      // Load NPC sprite for merchants and other NPCs
      const npcType = content.data?.npcType;
      if (npcType === 'merchant') {
        const sprite = await loadNPCSprite('shopkeeper');
        if (sprite) {
          const targetSize = 32;
          const scale = targetSize / Math.max(sprite.width, sprite.height);
          sprite.scale = ex.vec(scale, scale);
          actor.graphics.use(sprite);
          spriteLoaded = true;
        }
      }
    }

    // Fallback to colored circle if sprite not loaded
    if (!spriteLoaded) {
      actor.graphics.use(new ex.Circle({ radius: size, color: ex.Color.fromHex(color) }));
    }

    (actor as any).contentId = content.id;
    (actor as any).contentType = content.type;

    // Add wandering behavior for enemies
    if (content.type === 'enemy') {
      this.addWanderBehavior(actor, x, y);
    }

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

  /**
   * Add wandering behavior to an enemy actor.
   * The enemy will randomly move within a small radius of its spawn point.
   */
  private addWanderBehavior(actor: ex.Actor, originX: number, originY: number): void {
    const wanderRadius = 30; // Max distance from origin
    const moveSpeed = 20; // Pixels per second
    const pauseMin = 1000; // Min pause between moves (ms)
    const pauseMax = 3000; // Max pause between moves (ms)

    // Track the original spawn position
    (actor as any).originX = originX;
    (actor as any).originY = originY;

    // Function to pick a new wander target
    const pickNewTarget = () => {
      // Pick random angle and distance
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * wanderRadius;

      // Calculate target position within bounds
      const bounds = this.getMovementBounds();
      let targetX = originX + Math.cos(angle) * distance;
      let targetY = originY + Math.sin(angle) * distance;

      // Clamp to room bounds
      targetX = Math.max(bounds.minX, Math.min(bounds.maxX, targetX));
      targetY = Math.max(bounds.minY, Math.min(bounds.maxY, targetY));

      // Calculate move duration based on distance
      const dx = targetX - actor.pos.x;
      const dy = targetY - actor.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const duration = (dist / moveSpeed) * 1000;

      // Move to target
      actor.actions.moveTo(ex.vec(targetX, targetY), moveSpeed).callMethod(() => {
        // Pause then pick new target
        const pauseDuration = pauseMin + Math.random() * (pauseMax - pauseMin);
        setTimeout(() => {
          if (!actor.isKilled()) {
            pickNewTarget();
          }
        }, pauseDuration);
      });
    };

    // Start wandering after a random initial delay
    const initialDelay = Math.random() * 2000;
    setTimeout(() => {
      if (!actor.isKilled()) {
        pickNewTarget();
      }
    }, initialDelay);
  }

  private getDoorPositions(): Record<Direction, { x: number; y: number }> {
    // Use tilemap door positions if available
    if (this.currentRoomData) {
      const loader = getDungeonRoomLoader();
      const tilemapDoors = loader.getScaledDoorPositions(
        this.currentRoomData,
        this.currentTilemapOffsetX,
        this.currentTilemapOffsetY,
        this.currentTilemapScale
      );

      return {
        north: tilemapDoors.north ? { x: tilemapDoors.north.x, y: tilemapDoors.north.y } : this.getDefaultDoorPosition('north'),
        south: tilemapDoors.south ? { x: tilemapDoors.south.x, y: tilemapDoors.south.y } : this.getDefaultDoorPosition('south'),
        east: tilemapDoors.east ? { x: tilemapDoors.east.x, y: tilemapDoors.east.y } : this.getDefaultDoorPosition('east'),
        west: tilemapDoors.west ? { x: tilemapDoors.west.x, y: tilemapDoors.west.y } : this.getDefaultDoorPosition('west'),
      };
    }

    // Fallback to default positions
    return {
      north: this.getDefaultDoorPosition('north'),
      south: this.getDefaultDoorPosition('south'),
      east: this.getDefaultDoorPosition('east'),
      west: this.getDefaultDoorPosition('west'),
    };
  }

  private getDefaultDoorPosition(direction: Direction): { x: number; y: number } {
    const { width, height, offsetX, offsetY, doorSize } = ROOM_CONFIG;
    switch (direction) {
      case 'north': return { x: offsetX + width / 2, y: offsetY + doorSize / 2 };
      case 'south': return { x: offsetX + width / 2, y: offsetY + height - doorSize / 2 };
      case 'east': return { x: offsetX + width - doorSize / 2, y: offsetY + height / 2 };
      case 'west': return { x: offsetX + doorSize / 2, y: offsetY + height / 2 };
    }
  }

  private getMovementBounds() {
    // Use tilemap colliders to determine movement bounds if available
    if (this.currentRoomData) {
      const loader = getDungeonRoomLoader();
      const colliders = loader.getScaledColliders(
        this.currentRoomData,
        this.currentTilemapOffsetX,
        this.currentTilemapOffsetY,
        this.currentTilemapScale
      );

      // Find the playable area by looking for the inner bounds
      // The colliders define walls, so we need the area inside them
      if (colliders.length > 0) {
        // Get the tilemap dimensions at current scale
        const tilemapDims = loader.getRoomDimensions(this.currentTilemapScale);
        const roomRight = this.currentTilemapOffsetX + tilemapDims.width;
        const roomBottom = this.currentTilemapOffsetY + tilemapDims.height;

        // Find wall thicknesses from colliders
        let leftWall = this.currentTilemapOffsetX;
        let rightWall = roomRight;
        let topWall = this.currentTilemapOffsetY;
        let bottomWall = roomBottom;

        for (const collider of colliders) {
          // Left wall collider (x near left edge, full height)
          if (collider.x <= this.currentTilemapOffsetX + 2 && collider.height > tilemapDims.height * 0.5) {
            leftWall = Math.max(leftWall, collider.x + collider.width);
          }
          // Right wall collider (x near right edge, full height)
          if (collider.x + collider.width >= roomRight - 2 && collider.height > tilemapDims.height * 0.5) {
            rightWall = Math.min(rightWall, collider.x);
          }
          // Top wall collider (y near top, full width)
          if (collider.y <= this.currentTilemapOffsetY + 2 && collider.width > tilemapDims.width * 0.5) {
            topWall = Math.max(topWall, collider.y + collider.height);
          }
          // Bottom wall collider (y near bottom, full width)
          if (collider.y + collider.height >= roomBottom - 2 && collider.width > tilemapDims.width * 0.5) {
            bottomWall = Math.min(bottomWall, collider.y);
          }
        }

        const margin = 8 * this.currentTilemapScale;
        return {
          minX: leftWall + margin,
          maxX: rightWall - margin,
          minY: topWall + margin,
          maxY: bottomWall - margin,
        };
      }
    }

    // Fallback to default bounds
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

    // Arrow keys
    if (this.inputManager?.isKeyHeld('left')) dx -= 1;
    if (this.inputManager?.isKeyHeld('right')) dx += 1;
    if (this.inputManager?.isKeyHeld('up')) dy -= 1;
    if (this.inputManager?.isKeyHeld('down')) dy += 1;
    
    // WASD keys (like town)
    if (this.inputManager?.isKeyHeld('a')) dx -= 1;
    if (this.inputManager?.isKeyHeld('d')) dx += 1;
    if (this.inputManager?.isKeyHeld('w')) dy -= 1;
    if (this.inputManager?.isKeyHeld('s')) dy += 1;

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
    const hpWidth = Math.max(0, 120 * ratio);

    let hpColor = ex.Color.fromRGB(60, 220, 100);
    if (ratio <= 0.25) {
      hpColor = ex.Color.fromRGB(240, 60, 60);
    } else if (ratio <= 0.5) {
      hpColor = ex.Color.fromRGB(240, 200, 60);
    }

    this.hpBar.graphics.use(new ex.Rectangle({ width: hpWidth, height: 14, color: hpColor }));

    // Update gold
    this.goldLabel.graphics.use(
      new ex.Text({
        text: `Gold: ${GameState.player.gold}`,
        font: this.fontCache.getFontHex(12, '#fbbf24'),
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
    GameState.player.health = Math.max(0, GameState.player.health - damage);
    this.showFloatingMessage(`-${damage} HP!`, x, y - 20, '#f43f3f');

    // Check for player death
    if (GameState.player.health <= 0) {
      this.handlePlayerDeath();
      return;
    }

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
  // Pause Menu (HTML Overlay)
  // ============================================================================

  private showPauseMenu(): void {
    this.pauseMenuActive = true;
    this.playerFrozen = true;
    this.pauseOverlay?.open();
  }

  private hidePauseMenu(): void {
    this.pauseMenuActive = false;
    this.playerFrozen = false;
    this.pauseOverlay?.close();
  }

  private handlePauseMenuInput(): void {
    // Input is handled by the HTML overlay
    // This method is now a no-op, kept for compatibility
  }

  private leaveDungeon(): void {
    // Clear dungeon state
    GameState.dungeon.floor = null;
    GameState.dungeon.currentRoomId = '';
    GameState.dungeon.floorNumber = 1;

    this.callbacks.onExitToTown();
  }

  /**
   * Handle player death - show message and exit to town
   */
  private handlePlayerDeath(): void {
    this.isTransitioning = true;
    this.playerFrozen = true;

    // Show death message
    this.showFloatingMessage('You were defeated!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20, '#ff6464');
    this.showFloatingMessage('Returning to town...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10, '#ffff64');

    // Clear dungeon state and return to town after delay
    setTimeout(() => {
      GameState.dungeon.floor = null;
      GameState.dungeon.currentRoomId = '';
      GameState.dungeon.floorNumber = 1;
      GameState.dungeon.dungeonId = null;

      // Restore some HP so player isn't stuck at 0
      GameState.player.health = Math.floor(GameState.getEffectiveMaxHealth() * 0.25);

      this.callbacks.onExitToTown();
    }, 2500);
  }

  // ============================================================================
  // Puzzle System (HTML Overlay)
  // ============================================================================

  private showPuzzle(content: RoomContent): void {
    this.puzzleActive = true;
    this.currentPuzzle = content;
    this.playerFrozen = true;

    const puzzleType = content.data?.puzzleType || 'riddle';
    if (puzzleType === 'riddle' || puzzleType === 'memory') {
      const riddle = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
      this.puzzleOverlay?.openRiddle(riddle);
    } else {
      const sequence = SEQUENCES[Math.floor(Math.random() * SEQUENCES.length)];
      this.puzzleOverlay?.openSequence(sequence);
    }
  }

  private handlePuzzleInput(): void {
    // Input is handled by the HTML overlay
    // This method is now a no-op, kept for compatibility
  }

  private solvePuzzle(): void {
    if (!this.currentPuzzle) return;

    this.currentPuzzle.triggered = true;
    const goldReward = this.currentPuzzle.data?.goldReward || 50;
    const xpReward = this.currentPuzzle.data?.xpReward || 20;

    GameState.addGold(goldReward);
    GameState.addXp(xpReward);

    this.puzzleActive = false;
    this.currentPuzzle = null;
    this.playerFrozen = false;

    this.showFloatingMessage('Puzzle Solved!', CANVAS_WIDTH / 2, 120, '#64ff64');
    this.showFloatingMessage(`+${goldReward} Gold!`, CANVAS_WIDTH / 2, 145, '#fbbf24');

    this.renderCurrentRoom();
  }

  private failPuzzle(): void {
    this.puzzleActive = false;
    this.currentPuzzle = null;
    this.playerFrozen = false;

    this.showFloatingMessage('Wrong answer!', CANVAS_WIDTH / 2, 140, '#ff6464');
  }

  // ============================================================================
  // Merchant System (HTML Overlay)
  // ============================================================================

  private showMerchant(): void {
    if (!this.nearbyMerchant) return;

    this.merchantActive = true;
    this.playerFrozen = true;
    
    const inventory = this.nearbyMerchant.data?.inventory || ['potion_minor', 'potion_medium'];
    this.merchantOverlay?.open(inventory);
  }

  private handleMerchantInput(): void {
    // Input is handled by the HTML overlay
    // This method is now a no-op, kept for compatibility
  }

  private hideMerchant(): void {
    this.merchantActive = false;
    this.playerFrozen = false;
    this.merchantOverlay?.close();
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
