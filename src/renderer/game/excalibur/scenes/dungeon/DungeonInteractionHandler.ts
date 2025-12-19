/**
 * DungeonInteractionHandler.ts
 * 
 * Handles all dungeon interactions: doors, enemies, chests, puzzles, secrets, etc.
 */

import * as ex from 'excalibur';
import { GameState } from '../../../state/GameState.js';
import { 
  DungeonGenerator, 
  DUNGEON_CONFIGS,
  type DungeonRoom, 
  type RoomContent 
} from '../../../../canvas/dungeon/DungeonGenerator.js';
import { getChestLootItem, getItem } from '../../../data/items.js';
import { 
  ROOM_CONFIG, 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT,
  DUNGEON_TIER_MAP, 
  RIDDLES, 
  SEQUENCES,
  OPPOSITE_DIRECTION,
  type Direction,
  type DungeonSceneData,
  type DungeonSceneCallbacks,
} from './DungeonConstants.js';
import type { DungeonRoomRenderer } from './DungeonRoomRenderer.js';
import type { DungeonPauseOverlay } from '../../components/DungeonPauseOverlay.js';
import type { DungeonMerchantOverlay } from '../../components/DungeonMerchantOverlay.js';
import type { DungeonPuzzleOverlay } from '../../components/DungeonPuzzleOverlay.js';
import type { CatColor } from '../../../data/catSprites.js';
import type { DungeonTier } from '../../../data/items.js';

export interface InteractionHandlerConfig {
  callbacks: DungeonSceneCallbacks;
  getPlayerPosition: () => ex.Vector;
  setPlayerPosition: (x: number, y: number) => void;
  setPlayerFrozen: (frozen: boolean) => void;
  getCatColor: () => CatColor;
  getDungeonId: () => string;
  getFloorNumber: () => number;
  setFloorNumber: (floor: number) => void;
  renderRoom: () => void;
  showFloatingMessage: (text: string, x: number, y: number, color: string) => void;
  scheduledTimeout: (callback: () => void, delay: number) => void;
  onPlayerDeath: () => void;
  updateFloorLabel: () => void;
}

/**
 * Handles all dungeon interactions and content triggers.
 */
export class DungeonInteractionHandler {
  private scene: ex.Scene;
  private config: InteractionHandlerConfig;
  private roomRenderer: DungeonRoomRenderer;
  
  // State
  private isTransitioning = false;
  private highlightedDoor: Direction | null = null;
  
  // Pause state
  private pauseMenuActive = false;
  private pauseOverlay: DungeonPauseOverlay | null = null;
  
  // Puzzle state
  private puzzleActive = false;
  private currentPuzzle: RoomContent | null = null;
  private puzzleOverlay: DungeonPuzzleOverlay | null = null;
  
  // Merchant state
  private merchantActive = false;
  private nearbyMerchant: RoomContent | null = null;
  private merchantOverlay: DungeonMerchantOverlay | null = null;
  
  // Secret state
  private nearbySecret: RoomContent | null = null;
  
  constructor(
    scene: ex.Scene, 
    config: InteractionHandlerConfig,
    roomRenderer: DungeonRoomRenderer
  ) {
    this.scene = scene;
    this.config = config;
    this.roomRenderer = roomRenderer;
  }
  
  /**
   * Setup HTML overlays
   */
  setupOverlays(container: HTMLElement): void {
    const { DungeonPauseOverlay } = require('../../components/DungeonPauseOverlay.js');
    const { DungeonMerchantOverlay } = require('../../components/DungeonMerchantOverlay.js');
    const { DungeonPuzzleOverlay } = require('../../components/DungeonPuzzleOverlay.js');
    
    this.pauseOverlay = new DungeonPauseOverlay(container, {
      onResume: () => {
        this.pauseMenuActive = false;
        this.config.setPlayerFrozen(false);
      },
      onLeaveDungeon: () => {
        this.pauseMenuActive = false;
        this.config.setPlayerFrozen(false);
        this.leaveDungeon();
      },
    });

    this.merchantOverlay = new DungeonMerchantOverlay(container, {
      onBuy: (itemId: string) => {
        const item = getItem(itemId);
        if (item && GameState.player.gold >= item.buyPrice) {
          GameState.addGold(-item.buyPrice);
          GameState.addItem(itemId, 1);
          this.config.showFloatingMessage(`Bought ${item.name}!`, CANVAS_WIDTH / 2, 100, '#64ff64');
          return true;
        } else {
          this.config.showFloatingMessage('Not enough gold!', CANVAS_WIDTH / 2, 100, '#ff6464');
          return false;
        }
      },
      onClose: () => {
        this.merchantActive = false;
        this.config.setPlayerFrozen(false);
      },
      getGold: () => GameState.player.gold,
    });

    this.puzzleOverlay = new DungeonPuzzleOverlay(container, {
      onSolve: () => {
        this.solvePuzzle();
      },
      onFail: () => {
        this.failPuzzle();
      },
      onClose: () => {
        this.puzzleActive = false;
        this.currentPuzzle = null;
        this.config.setPlayerFrozen(false);
      },
    });
  }
  
  /**
   * Check all interactions with the current room
   */
  checkInteractions(room: DungeonRoom): void {
    const playerPos = this.config.getPlayerPosition();
    
    // Check doors
    this.highlightedDoor = null;
    const doorPositions = this.roomRenderer.getDoorPositions();
    for (const [dir, pos] of Object.entries(doorPositions)) {
      const direction = dir as Direction;
      if (!room.connections[direction]) continue;

      const dist = playerPos.distance(ex.vec(pos.x, pos.y));
      if (dist < 32) {
        this.highlightedDoor = direction;
        break;
      }
    }

    // Check secrets
    this.checkNearbySecrets(room, playerPos);

    // Check merchants
    this.checkNearbyMerchants(room, playerPos);

    // Reveal nearby hidden traps/secrets
    this.roomRenderer.revealNearbyHiddenContent(room, playerPos);

    // Check content triggers
    this.checkContentTriggers(room, playerPos);
  }
  
  /**
   * Check for nearby secrets
   */
  private checkNearbySecrets(room: DungeonRoom, playerPos: ex.Vector): void {
    this.nearbySecret = null;
    const { width, height, offsetX, offsetY } = ROOM_CONFIG;

    for (const content of room.contents) {
      if (content.type !== 'secret' || content.triggered) continue;
      if (content.data?.discovered) continue;

      const x = offsetX + content.x * width;
      const y = offsetY + content.y * height;

      if (playerPos.distance(ex.vec(x, y)) < 25) {
        this.nearbySecret = content;
        break;
      }
    }
  }
  
  /**
   * Check for nearby merchants
   */
  private checkNearbyMerchants(room: DungeonRoom, playerPos: ex.Vector): void {
    this.nearbyMerchant = null;
    const { width, height, offsetX, offsetY } = ROOM_CONFIG;

    for (const content of room.contents) {
      if (content.type !== 'npc' || content.data?.npcType !== 'merchant') continue;

      const x = offsetX + content.x * width;
      const y = offsetY + content.y * height;

      if (playerPos.distance(ex.vec(x, y)) < 35) {
        this.nearbyMerchant = content;
        break;
      }
    }
  }
  
  /**
   * Check content triggers (enemy, chest, trap, etc.)
   */
  private checkContentTriggers(room: DungeonRoom, playerPos: ex.Vector): void {
    const { width, height, offsetX, offsetY } = ROOM_CONFIG;

    for (const content of room.contents) {
      if (content.triggered) continue;
      if (content.type === 'secret' && !content.data?.discovered) continue;

      const x = offsetX + content.x * width;
      const y = offsetY + content.y * height;

      if (playerPos.distance(ex.vec(x, y)) < 16) {
        this.handleContentTrigger(content, room, x, y);
        break;
      }
    }
  }
  
  /**
   * Handle a content trigger
   */
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
  
  /**
   * Trigger enemy encounter
   */
  private triggerEnemy(content: RoomContent): void {
    content.triggered = true;

    let enemyId = 'grey_slime';
    if (typeof content.data === 'string') {
      enemyId = content.data;
    } else if (content.data?.enemyType) {
      enemyId = content.data.enemyType;
    }

    const returnData: DungeonSceneData = {
      catColor: this.config.getCatColor(),
      dungeonId: this.config.getDungeonId(),
      floorNumber: this.config.getFloorNumber(),
      floor: GameState.dungeon.floor!,
      currentRoomId: GameState.dungeon.currentRoomId,
      returnFromBattle: true,
      playerX: this.config.getPlayerPosition().x,
      playerY: this.config.getPlayerPosition().y,
    };

    this.config.callbacks.onGoToBattle(enemyId, returnData);
  }
  
  /**
   * Trigger chest opening
   */
  private triggerChest(content: RoomContent, x: number, y: number): void {
    content.triggered = true;

    const floorNumber = this.config.getFloorNumber();
    const goldAmount = content.data?.goldAmount || 10 * floorNumber + Math.floor(Math.random() * 20);
    GameState.addGold(goldAmount);
    this.config.showFloatingMessage(`+${goldAmount} Gold!`, x, y - 20, '#fbbf24');

    // Check for item drop
    const tier = (DUNGEON_TIER_MAP[this.config.getDungeonId()] || 1) as DungeonTier;
    const lootItemId = getChestLootItem(tier);
    if (lootItemId) {
      const lootItem = getItem(lootItemId);
      if (lootItem) {
        GameState.addItem(lootItemId, 1);
        this.config.showFloatingMessage(`Found ${lootItem.name}!`, x, y, '#64f88c');
      }
    }

    this.config.renderRoom();
  }
  
  /**
   * Trigger trap damage
   */
  private triggerTrap(content: RoomContent, x: number, y: number): void {
    content.triggered = true;

    const damage = content.data?.damage || 5;
    GameState.player.health = Math.max(0, GameState.player.health - damage);
    this.config.showFloatingMessage(`-${damage} HP!`, x, y - 20, '#f43f3f');

    if (GameState.player.health <= 0) {
      this.config.onPlayerDeath();
      return;
    }

    this.config.renderRoom();
  }
  
  /**
   * Trigger campfire healing
   */
  private triggerCampfire(content: RoomContent, x: number, y: number): void {
    content.triggered = true;

    const effectiveMaxHp = GameState.getEffectiveMaxHealth();
    const healPercent = content.data?.healPercent || 30;
    const healAmount = Math.floor(effectiveMaxHp * (healPercent / 100));
    GameState.player.health = Math.min(effectiveMaxHp, GameState.player.health + healAmount);

    this.config.showFloatingMessage(`+${healAmount} HP!`, x, y - 20, '#64dc64');
    this.config.renderRoom();
  }
  
  /**
   * Claim a secret reward
   */
  private claimSecret(content: RoomContent, x: number, y: number): void {
    content.triggered = true;

    const rewardType = content.data?.rewardType || 'gold_large';
    const secretName = content.data?.secretName || 'Secret';

    if (rewardType === 'full_heal') {
      GameState.player.health = GameState.getEffectiveMaxHealth();
      this.config.showFloatingMessage(`${secretName}!`, x, y - 30, '#ffdc64');
      this.config.showFloatingMessage('Fully Healed!', x, y - 10, '#64dc64');
    } else {
      const goldReward = content.data?.goldReward || 100;
      const xpReward = content.data?.xpReward || 30;
      GameState.addGold(goldReward);
      GameState.addXp(xpReward);
      this.config.showFloatingMessage(`${secretName}!`, x, y - 30, '#ffdc64');
      this.config.showFloatingMessage(`+${goldReward} Gold!`, x, y - 10, '#fbbf24');
    }

    this.config.renderRoom();
  }
  
  /**
   * Handle floor exit
   */
  private handleExit(content: RoomContent, room: DungeonRoom): void {
    // Check if boss needs to be defeated
    if (content.data?.requiresBossDefeated) {
      const bossEnemies = room.contents.filter((c) => c.type === 'enemy' && c.data?.isBoss);
      const allBossDefeated = bossEnemies.every((c) => c.triggered);
      if (!allBossDefeated) {
        const playerPos = this.config.getPlayerPosition();
        this.config.showFloatingMessage('Defeat the boss first!', playerPos.x, playerPos.y - 20, '#ff6464');
        return;
      }
    }

    content.triggered = true;
    this.isTransitioning = true;
    this.config.setPlayerFrozen(true);

    const dungeonId = this.config.getDungeonId();
    const dungeonConfig = DUNGEON_CONFIGS[dungeonId] || DUNGEON_CONFIGS.training;
    const currentFloor = this.config.getFloorNumber();
    const maxFloors = dungeonConfig.totalFloors;

    if (currentFloor >= maxFloors) {
      // Dungeon complete
      this.config.showFloatingMessage('Dungeon Complete!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '#fbbf24');

      GameState.dungeon.dungeonId = null;
      GameState.dungeon.floor = null;
      GameState.dungeon.floorNumber = 1;
      GameState.dungeon.currentRoomId = '';

      this.config.scheduledTimeout(() => {
        this.config.callbacks.onExitToTown();
      }, 2000);
    } else {
      // Next floor
      this.config.showFloatingMessage(`Floor ${currentFloor} Complete!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '#fbbf24');

      this.config.scheduledTimeout(() => {
        const nextFloor = currentFloor + 1;
        const generator = new DungeonGenerator(dungeonId);
        const newFloorData = generator.generate(nextFloor);

        GameState.dungeon.floor = newFloorData;
        GameState.dungeon.floorNumber = nextFloor;
        GameState.dungeon.currentRoomId = newFloorData.startRoomId;
        this.config.setFloorNumber(nextFloor);

        const currentRoom = GameState.getCurrentRoom();
        if (currentRoom) {
          currentRoom.visited = true;
          currentRoom.discovered = true;
        }

        // Reset player position
        this.config.setPlayerPosition(
          ROOM_CONFIG.offsetX + ROOM_CONFIG.width / 2,
          ROOM_CONFIG.offsetY + ROOM_CONFIG.height / 2
        );

        this.config.renderRoom();
        this.config.updateFloorLabel();
        this.isTransitioning = false;
        this.config.setPlayerFrozen(false);
      }, 1500);
    }
  }
  
  /**
   * Handle interaction input (Enter/Space)
   */
  handleInteraction(): void {
    if (this.nearbySecret) {
      this.discoverSecret();
    } else if (this.nearbyMerchant) {
      this.showMerchant();
    } else if (this.highlightedDoor) {
      this.transitionToRoom(this.highlightedDoor);
    }
  }
  
  /**
   * Discover a nearby secret
   */
  private discoverSecret(): void {
    if (!this.nearbySecret) return;

    this.nearbySecret.data.discovered = true;
    const playerPos = this.config.getPlayerPosition();
    this.config.showFloatingMessage('You found something!', playerPos.x, playerPos.y - 20, '#ffdc64');
    this.config.renderRoom();
    this.nearbySecret = null;
  }
  
  // ============================================================================
  // Room Transitions
  // ============================================================================
  
  /**
   * Transition to an adjacent room
   */
  async transitionToRoom(direction: Direction): Promise<void> {
    if (this.isTransitioning) return;

    const room = GameState.getCurrentRoom();
    if (!room) return;

    const targetRoomId = room.connections[direction];
    if (!targetRoomId) return;

    this.isTransitioning = true;
    this.config.setPlayerFrozen(true);

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
    this.scene.add(overlay);

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

    this.config.renderRoom();

    // Position player at opposite door
    const entryPos = this.roomRenderer.getEntryPosition(OPPOSITE_DIRECTION[direction]);
    this.config.setPlayerPosition(entryPos.x, entryPos.y);

    // Fade out
    for (let i = 10; i >= 0; i--) {
      overlay.graphics.opacity = i / 10;
      await this.delay(20);
    }

    overlay.kill();
    this.isTransitioning = false;
    this.config.setPlayerFrozen(false);
  }
  
  // ============================================================================
  // Pause Menu
  // ============================================================================
  
  showPauseMenu(): void {
    this.pauseMenuActive = true;
    this.config.setPlayerFrozen(true);
    this.pauseOverlay?.open();
  }
  
  hidePauseMenu(): void {
    this.pauseMenuActive = false;
    this.config.setPlayerFrozen(false);
    this.pauseOverlay?.close();
  }
  
  private leaveDungeon(): void {
    GameState.dungeon.floor = null;
    GameState.dungeon.currentRoomId = '';
    GameState.dungeon.floorNumber = 1;
    this.config.callbacks.onExitToTown();
  }
  
  // ============================================================================
  // Puzzle System
  // ============================================================================
  
  private showPuzzle(content: RoomContent): void {
    this.puzzleActive = true;
    this.currentPuzzle = content;
    this.config.setPlayerFrozen(true);

    const puzzleType = content.data?.puzzleType || 'riddle';
    if (puzzleType === 'riddle' || puzzleType === 'memory') {
      const riddle = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
      this.puzzleOverlay?.openRiddle(riddle);
    } else {
      const sequence = SEQUENCES[Math.floor(Math.random() * SEQUENCES.length)];
      this.puzzleOverlay?.openSequence(sequence);
    }
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
    this.config.setPlayerFrozen(false);

    this.config.showFloatingMessage('Puzzle Solved!', CANVAS_WIDTH / 2, 120, '#64ff64');
    this.config.showFloatingMessage(`+${goldReward} Gold!`, CANVAS_WIDTH / 2, 145, '#fbbf24');

    this.config.renderRoom();
  }
  
  private failPuzzle(): void {
    this.puzzleActive = false;
    this.currentPuzzle = null;
    this.config.setPlayerFrozen(false);

    this.config.showFloatingMessage('Wrong answer!', CANVAS_WIDTH / 2, 140, '#ff6464');
  }
  
  // ============================================================================
  // Merchant System
  // ============================================================================
  
  private showMerchant(): void {
    if (!this.nearbyMerchant) return;

    this.merchantActive = true;
    this.config.setPlayerFrozen(true);
    
    const inventory = this.nearbyMerchant.data?.inventory || ['potion_minor', 'potion_medium'];
    this.merchantOverlay?.open(inventory);
  }
  
  hideMerchant(): void {
    this.merchantActive = false;
    this.config.setPlayerFrozen(false);
    this.merchantOverlay?.close();
  }
  
  // ============================================================================
  // State Getters
  // ============================================================================
  
  isInTransition(): boolean {
    return this.isTransitioning;
  }
  
  isPauseMenuActive(): boolean {
    return this.pauseMenuActive;
  }
  
  isPuzzleActive(): boolean {
    return this.puzzleActive;
  }
  
  isMerchantActive(): boolean {
    return this.merchantActive;
  }
  
  // ============================================================================
  // Utility
  // ============================================================================
  
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    this.pauseOverlay?.destroy();
    this.pauseOverlay = null;
    this.merchantOverlay?.destroy();
    this.merchantOverlay = null;
    this.puzzleOverlay?.destroy();
    this.puzzleOverlay = null;
  }
}
