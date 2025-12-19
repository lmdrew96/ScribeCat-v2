/**
 * DungeonScene for Excalibur.js
 *
 * Procedurally generated dungeon with room-based exploration.
 * Features: enemies, chests, puzzles, secrets, merchants, traps, boss fights.
 * 
 * This is the main scene orchestrator that delegates to specialized managers:
 * - DungeonPlayerController: Player movement and animations
 * - DungeonHUDManager: HUD display and updates
 * - DungeonRoomRenderer: Room rendering and tilemaps
 * - DungeonInteractionHandler: Content triggers and interactions
 */

import * as ex from 'excalibur';
import { GameState } from '../../state/GameState.js';
import {
  DungeonGenerator,
  type DungeonFloor,
} from '../../../canvas/dungeon/DungeonGenerator.js';
import type { CatColor } from '../../data/catSprites.js';
import { SceneFontCache } from '../ui/FontCache.js';

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  type DungeonSceneData,
  type DungeonSceneCallbacks,
} from './dungeon/DungeonConstants.js';
import { DungeonPlayerController } from './dungeon/DungeonPlayerController.js';
import { DungeonHUDManager } from './dungeon/DungeonHUDManager.js';
import { DungeonRoomRenderer } from './dungeon/DungeonRoomRenderer.js';
import { DungeonInteractionHandler } from './dungeon/DungeonInteractionHandler.js';

// Re-export types for external use
export type { DungeonSceneData, DungeonSceneCallbacks };

/**
 * DungeonScene - Excalibur implementation
 * 
 * Orchestrates dungeon gameplay by coordinating specialized managers.
 */
export class DungeonScene extends ex.Scene {
  private callbacks: DungeonSceneCallbacks;

  // Input cooldown to prevent key events carrying over from scene transitions
  private inputEnabled = false;

  // Pending timeout IDs for cleanup
  private pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

  // Dungeon state
  private dungeonId = 'training';
  private floorNumber = 1;
  private catColor: CatColor = 'gray';

  // Scene data for return from battle
  private sceneData: DungeonSceneData = {};

  // Font cache for floating messages
  private fontCache = new SceneFontCache();

  // Managers
  private playerController: DungeonPlayerController | null = null;
  private hudManager: DungeonHUDManager | null = null;
  private roomRenderer: DungeonRoomRenderer | null = null;
  private interactionHandler: DungeonInteractionHandler | null = null;

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
    
    // Clear pending timeouts from previous activation
    this.clearPendingTimeouts();
    
    // Schedule input enable with tracking
    this.scheduledTimeout(() => { this.inputEnabled = true; }, 200);

    GameState.setCatColor(this.catColor);
    GameState.dungeon.dungeonId = this.dungeonId;

    // Initialize floor
    this.initializeFloor();

    // Initialize managers
    this.initializeManagers();

    // Setup scene
    this.setupScene();
  }

  /**
   * Initialize all manager instances
   */
  private initializeManagers(): void {
    // Room renderer
    this.roomRenderer = new DungeonRoomRenderer(this, {
      scheduledTimeout: (cb, delay) => this.scheduledTimeout(cb, delay),
    });

    // Player controller
    this.playerController = new DungeonPlayerController(this, {
      catColor: this.catColor,
      getMovementBounds: () => this.roomRenderer!.getMovementBounds(),
      showFloatingMessage: (text, x, y, color) => this.showFloatingMessage(text, x, y, color),
      onDeath: () => this.callbacks.onExitToTown(),
    });

    // HUD manager
    this.hudManager = new DungeonHUDManager(this, {
      dungeonId: this.dungeonId,
      floorNumber: this.floorNumber,
    });

    // Interaction handler
    this.interactionHandler = new DungeonInteractionHandler(
      this,
      {
        callbacks: this.callbacks,
        getPlayerPosition: () => this.playerController!.getPosition(),
        setPlayerPosition: (x, y) => this.playerController!.setPosition(x, y),
        setPlayerFrozen: (frozen) => this.playerController!.setFrozen(frozen),
        getCatColor: () => this.catColor,
        getDungeonId: () => this.dungeonId,
        getFloorNumber: () => this.floorNumber,
        setFloorNumber: (floor) => {
          this.floorNumber = floor;
          this.hudManager?.setFloorNumber(floor);
        },
        renderRoom: () => this.roomRenderer!.renderCurrentRoom(),
        showFloatingMessage: (text, x, y, color) => this.showFloatingMessage(text, x, y, color),
        scheduledTimeout: (cb, delay) => this.scheduledTimeout(cb, delay),
        onPlayerDeath: () => this.handlePlayerDeath(),
        updateFloorLabel: () => this.hudManager?.setFloorNumber(this.floorNumber),
      },
      this.roomRenderer
    );
  }

  /**
   * Setup scene components
   */
  private async setupScene(): Promise<void> {
    // Setup player
    await this.playerController!.setup(
      this.sceneData.returnFromBattle,
      this.sceneData.playerX,
      this.sceneData.playerY
    );

    // Initialize input after player is ready
    this.playerController!.initInput(this.engine!);

    // Setup HUD
    this.hudManager!.setup();

    // Setup HTML overlays
    this.setupHTMLOverlays();

    // Render current room
    this.roomRenderer!.renderCurrentRoom();

    // Load dungeon room tilemaps in background
    this.roomRenderer!.loadTilemaps(() => this.roomRenderer!.renderCurrentRoom());
  }

  /**
   * Setup HTML-based overlays for pause menu, merchant, and puzzles
   */
  private setupHTMLOverlays(): void {
    const canvas = this.engine?.canvas;
    if (!canvas?.parentElement) return;

    this.interactionHandler!.setupOverlays(canvas.parentElement);
  }

  onDeactivate(): void {
    // Reset input state to prevent stale handlers from firing
    this.inputEnabled = false;

    // Cancel all pending timeouts to prevent callbacks after scene exit
    this.clearPendingTimeouts();

    // Cleanup managers
    this.playerController?.destroy();
    this.playerController = null;

    this.hudManager?.destroy();
    this.hudManager = null;

    this.roomRenderer?.destroy();
    this.roomRenderer = null;

    this.interactionHandler?.destroy();
    this.interactionHandler = null;
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

  onPreUpdate(engine: ex.Engine, delta: number): void {
    if (!this.interactionHandler || !this.playerController || !this.hudManager || !this.roomRenderer) {
      return;
    }

    if (this.interactionHandler.isInTransition()) return;

    // Handle different UI modes
    if (this.interactionHandler.isPauseMenuActive()) {
      return;
    }

    if (this.interactionHandler.isPuzzleActive()) {
      return;
    }

    if (this.interactionHandler.isMerchantActive()) {
      return;
    }

    // Normal gameplay
    this.playerController.update(delta);
    this.hudManager.update();
    
    const room = GameState.getCurrentRoom();
    if (room) {
      this.interactionHandler.checkInteractions(room);
    }
    
    this.handleGameplayInput();
  }

  private handleGameplayInput(): void {
    if (!this.inputEnabled || !this.playerController || !this.interactionHandler) return;

    // Enter/Space - interact
    if (this.playerController.wasKeyPressed('enter') || this.playerController.wasKeyPressed('space')) {
      this.interactionHandler.handleInteraction();
    }

    // Escape - pause menu
    if (this.playerController.wasKeyPressed('escape')) {
      this.interactionHandler.showPauseMenu();
    }

    // I - inventory
    if (this.playerController.wasKeyPressed('i')) {
      const returnData = this.playerController.buildSceneData(this.dungeonId, this.floorNumber);
      this.callbacks.onOpenInventory(returnData);
    }
  }

  /**
   * Handle player death - show message and exit to town
   */
  private handlePlayerDeath(): void {
    this.playerController?.setFrozen(true);
    this.playerController?.handleDeath((cb, delay) => this.scheduledTimeout(cb, delay));
  }

  /**
   * Show a floating message that animates upward and fades
   */
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

    this.scheduledTimeout(() => {
      msg.kill();
    }, 1000);
  }

  /**
   * Schedule a timeout and track it for cleanup
   */
  private scheduledTimeout(callback: () => void, delay: number): void {
    const id = setTimeout(callback, delay);
    this.pendingTimeouts.push(id);
  }

  /**
   * Clear all pending timeouts
   */
  private clearPendingTimeouts(): void {
    for (const id of this.pendingTimeouts) {
      clearTimeout(id);
    }
    this.pendingTimeouts = [];
  }
}
