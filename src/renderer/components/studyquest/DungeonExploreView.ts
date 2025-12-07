/**
 * DungeonExploreView
 *
 * Wrapper component that manages the DungeonCanvas and MiniMap,
 * integrating them with the StudyQuestModal. Handles room exploration,
 * content triggers, and transitions.
 */

import { createLogger } from '../../../shared/logger.js';
import {
  DungeonCanvas,
  DungeonGenerator,
  MiniMap,
  type DungeonFloor,
  type DungeonRoom,
  type RoomContent,
} from '../../canvas/dungeon/index.js';
import type { CatColor } from '../../canvas/CatSpriteManager.js';

const logger = createLogger('DungeonExploreView');

// Content trigger callbacks
interface DungeonExploreCallbacks {
  onEnemyEncounter: (enemyData: any, isBoss: boolean) => void;
  onChestOpen: (lootData: any) => void;
  onTrapTriggered: (trapData: any) => void;
  onMerchantInteract: () => void;
  onRestPointUse: (healPercent: number) => void;
  onFloorExit: () => void;
  onDungeonComplete: () => void;
  onFlee: () => void;
}

export interface DungeonRunState {
  dungeonId: string;
  dungeonName: string;
  currentFloor: number;
  totalFloors: number;
  playerHp: number;
  playerMaxHp: number;
}

export class DungeonExploreView {
  private container: HTMLDivElement;
  private canvasWrapper: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private dungeonCanvas: DungeonCanvas | null = null;
  private miniMap: MiniMap | null = null;
  private generator: DungeonGenerator | null = null;
  private currentFloor: DungeonFloor | null = null;
  private callbacks: DungeonExploreCallbacks;
  private isActive: boolean = false;
  private catColor: CatColor = 'brown';
  private dungeonState: DungeonRunState | null = null;

  constructor(callbacks: DungeonExploreCallbacks) {
    this.callbacks = callbacks;

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'dungeon-explore-container';

    // Create canvas wrapper
    this.canvasWrapper = document.createElement('div');
    this.canvasWrapper.className = 'dungeon-canvas-wrapper';

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'dungeon-canvas';
    this.canvas.width = 480;
    this.canvas.height = 320;

    this.canvasWrapper.appendChild(this.canvas);
    this.container.appendChild(this.canvasWrapper);

    // Create UI overlay
    this.container.innerHTML += `
      <div class="dungeon-ui-overlay">
        <div class="dungeon-floor-info">
          <span class="dungeon-name" id="dungeon-explore-name">Dungeon</span>
          <span class="dungeon-floor" id="dungeon-explore-floor">Floor 1</span>
        </div>
        <div class="dungeon-minimap-container" id="dungeon-minimap"></div>
        <div class="dungeon-controls">
          <div class="dungeon-controls-hint">
            <span>WASD/Arrows to move</span>
            <span>Enter to interact</span>
          </div>
          <button class="pixel-btn dungeon-flee-btn" id="dungeon-flee-btn">Flee Dungeon</button>
        </div>
      </div>
    `;

    // Re-append canvas wrapper (it was replaced by innerHTML)
    this.container.insertBefore(this.canvasWrapper, this.container.firstChild);

    // Add event listener for flee button
    this.container.querySelector('#dungeon-flee-btn')?.addEventListener('click', () => {
      this.callbacks.onFlee();
    });

    this.injectStyles();
  }

  /**
   * Get the container element
   */
  getElement(): HTMLElement {
    return this.container;
  }

  /**
   * Initialize dungeon exploration for a specific dungeon
   */
  initialize(dungeonId: string, dungeonName: string, totalFloors: number): void {
    this.generator = new DungeonGenerator(dungeonId);
    this.dungeonState = {
      dungeonId,
      dungeonName,
      currentFloor: 1,
      totalFloors,
      playerHp: 100,
      playerMaxHp: 100,
    };

    // Update UI
    this.updateFloorInfo();

    // Generate first floor
    this.generateFloor(1);
  }

  /**
   * Generate a new floor
   */
  private generateFloor(floorNumber: number): void {
    if (!this.generator || !this.dungeonState) return;

    this.dungeonState.currentFloor = floorNumber;
    this.currentFloor = this.generator.generate(floorNumber);

    // Initialize canvas if not already
    if (!this.dungeonCanvas) {
      this.dungeonCanvas = new DungeonCanvas(this.canvas);
      this.dungeonCanvas.setCatColor(this.catColor);

      // Set up content trigger callback
      this.dungeonCanvas.setOnContentTrigger((content, room) => {
        this.handleContentTrigger(content, room);
      });

      // Set up door transition callback
      this.dungeonCanvas.setOnDoorTransition((direction) => {
        logger.info(`Door transition: ${direction}`);
      });
    }

    // Set the floor on canvas
    this.dungeonCanvas.setFloor(this.currentFloor);

    // Initialize minimap
    if (!this.miniMap) {
      this.miniMap = new MiniMap();
      const minimapContainer = this.container.querySelector('#dungeon-minimap');
      if (minimapContainer) {
        minimapContainer.appendChild(this.miniMap.getElement());
      }
    }
    this.miniMap.setFloor(this.currentFloor);
    this.miniMap.setCurrentRoom(this.currentFloor.startRoomId);

    this.updateFloorInfo();
    logger.info(`Generated floor ${floorNumber} with ${this.currentFloor.rooms.size} rooms`);
  }

  /**
   * Handle content trigger from dungeon canvas
   */
  private handleContentTrigger(content: RoomContent, room: DungeonRoom): void {
    logger.info(`Content triggered: ${content.type} in room ${room.id}`);

    switch (content.type) {
      case 'enemy':
        const isBoss = content.data?.isBoss || false;
        this.stop(); // Pause exploration during battle
        this.callbacks.onEnemyEncounter(content.data, isBoss);
        break;

      case 'chest':
        this.callbacks.onChestOpen(content.data);
        // Mark room as cleared after chest opened
        room.cleared = true;
        break;

      case 'trap':
        this.callbacks.onTrapTriggered(content.data);
        break;

      case 'npc':
        if (content.data?.npcType === 'merchant') {
          this.callbacks.onMerchantInteract();
        }
        break;

      case 'interactable':
        if (content.data?.interactType === 'campfire') {
          this.callbacks.onRestPointUse(content.data.healPercent || 30);
          content.triggered = true;
        }
        break;

      case 'exit':
        this.handleExit();
        break;
    }

    // Update minimap
    this.miniMap?.update();
  }

  /**
   * Handle exit/stairs interaction
   */
  private handleExit(): void {
    if (!this.dungeonState) return;

    const isFinalFloor = this.dungeonState.currentFloor >= this.dungeonState.totalFloors;

    if (isFinalFloor) {
      // Check if boss is defeated (room cleared)
      const currentRoom = this.getCurrentRoom();
      if (currentRoom?.type === 'boss' && currentRoom.cleared) {
        this.callbacks.onDungeonComplete();
      } else {
        // Boss not defeated yet
        logger.info('Cannot exit: Boss not defeated');
      }
    } else {
      // Go to next floor
      this.callbacks.onFloorExit();
    }
  }

  /**
   * Advance to next floor
   */
  advanceFloor(): void {
    if (!this.dungeonState) return;

    const nextFloor = this.dungeonState.currentFloor + 1;
    if (nextFloor <= this.dungeonState.totalFloors) {
      this.generateFloor(nextFloor);
    }
  }

  /**
   * Resume exploration after battle/event
   */
  resume(): void {
    this.start();

    // Mark current room as cleared if it was an enemy room
    const currentRoom = this.getCurrentRoom();
    if (currentRoom && currentRoom.type === 'enemy') {
      currentRoom.cleared = true;

      // Remove enemy content from room
      currentRoom.contents = currentRoom.contents.filter((c) => c.type !== 'enemy');
    }

    // Update displays
    this.dungeonCanvas?.update();
    this.miniMap?.update();
  }

  /**
   * Get current room
   */
  private getCurrentRoom(): DungeonRoom | null {
    return this.dungeonCanvas?.getCurrentRoom() || null;
  }

  /**
   * Start the dungeon canvas
   */
  start(): void {
    if (this.isActive) return;

    this.dungeonCanvas?.start();
    this.isActive = true;
    logger.info('Dungeon exploration started');
  }

  /**
   * Stop the dungeon canvas
   */
  stop(): void {
    if (!this.isActive) return;

    this.dungeonCanvas?.stop();
    this.isActive = false;
    logger.info('Dungeon exploration stopped');
  }

  /**
   * Set the cat color
   */
  setCatColor(color: CatColor): void {
    this.catColor = color;
    this.dungeonCanvas?.setCatColor(color);
  }

  /**
   * Update player HP display
   */
  updatePlayerHp(hp: number, maxHp: number): void {
    if (this.dungeonState) {
      this.dungeonState.playerHp = hp;
      this.dungeonState.playerMaxHp = maxHp;
    }
  }

  /**
   * Update floor info display
   */
  private updateFloorInfo(): void {
    if (!this.dungeonState) return;

    const nameEl = this.container.querySelector('#dungeon-explore-name');
    const floorEl = this.container.querySelector('#dungeon-explore-floor');

    if (nameEl) nameEl.textContent = this.dungeonState.dungeonName;
    if (floorEl) floorEl.textContent = `Floor ${this.dungeonState.currentFloor} / ${this.dungeonState.totalFloors}`;
  }

  /**
   * Check if exploration is active
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Get current dungeon state
   */
  getState(): DungeonRunState | null {
    return this.dungeonState;
  }

  /**
   * Inject styles
   */
  private injectStyles(): void {
    if (document.getElementById('dungeon-explore-styles')) return;

    const style = document.createElement('style');
    style.id = 'dungeon-explore-styles';
    style.textContent = `
      .dungeon-explore-container {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 16px;
      }

      .dungeon-canvas-wrapper {
        position: relative;
        border: 4px solid var(--sq-border, #4a4a6a);
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        background: #1a1a2e;
      }

      .dungeon-canvas {
        display: block;
        image-rendering: pixelated;
        width: 480px;
        height: 320px;
      }

      .dungeon-ui-overlay {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .dungeon-floor-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: var(--sq-surface, #2a2a4e);
        border: 2px solid var(--sq-border, #4a4a6a);
        border-radius: 8px;
      }

      .dungeon-name {
        font-size: 16px;
        font-weight: bold;
        color: var(--sq-text, #ffffff);
      }

      .dungeon-floor {
        font-size: 14px;
        color: var(--sq-primary, #6366f1);
        font-family: 'Courier New', monospace;
      }

      .dungeon-minimap-container {
        position: absolute;
        top: 24px;
        right: 24px;
        z-index: 10;
      }

      .dungeon-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .dungeon-controls-hint {
        display: flex;
        gap: 16px;
        font-size: 11px;
        color: var(--sq-text-muted, #9ca3af);
        font-family: 'Courier New', monospace;
      }

      .dungeon-controls-hint span {
        background: rgba(0, 0, 0, 0.3);
        padding: 4px 8px;
        border-radius: 4px;
      }

      .dungeon-flee-btn {
        font-size: 12px;
        padding: 6px 12px;
        background: var(--sq-danger, #ef4444) !important;
        border-color: var(--sq-danger, #ef4444) !important;
      }

      .dungeon-flee-btn:hover {
        filter: brightness(1.1);
      }

      /* Room transition overlay */
      .dungeon-transition-overlay {
        position: absolute;
        inset: 0;
        background: #000000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }

      .dungeon-transition-overlay.active {
        opacity: 1;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stop();
    this.dungeonCanvas = null;
    this.miniMap = null;
    this.generator = null;
    this.currentFloor = null;
    this.dungeonState = null;
  }
}
