/**
 * DungeonGame
 *
 * Wrapper class for the Dungeon KAPLAY game.
 * Provides a simple API for integrating with the rest of the application.
 */

import type { KAPLAYCtx } from 'kaplay';
import { initGame, destroyGame } from './index.js';
import { registerDungeonScene, type DungeonSceneData } from './scenes/DungeonScene.js';
import { DUNGEON_WIDTH, DUNGEON_HEIGHT } from './config.js';
import type { CatColor } from './sprites/catSprites.js';
import { DungeonGenerator, type DungeonFloor, type DungeonRoom, type RoomContent } from '../canvas/dungeon/DungeonGenerator.js';

export class DungeonGame {
  private k: KAPLAYCtx;
  private canvas: HTMLCanvasElement;
  private canvasId: string;
  private catColor: CatColor = 'brown';
  private dungeonId: string = 'training';
  private currentFloorNumber: number = 1;
  private floor: DungeonFloor | null = null;
  private currentRoomId: string = '';
  private isRunning: boolean = false;

  // Callbacks
  private onContentTrigger?: (content: RoomContent, room: DungeonRoom) => void;
  private onRoomEnter?: (room: DungeonRoom) => void;
  private onRoomClear?: (room: DungeonRoom) => void;
  private onFloorComplete?: (floorNumber: number) => void;
  private onRoomChange?: (roomId: string) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvasId = canvas.id || `dungeon-${Date.now()}`;
    canvas.id = this.canvasId;

    // Initialize KAPLAY
    this.k = initGame({
      canvas,
      width: DUNGEON_WIDTH,
      height: DUNGEON_HEIGHT,
      scale: 1,
      background: [10, 10, 30],
      debug: false,
    });

    // Register the scene
    registerDungeonScene(this.k);
  }

  /**
   * Set the cat color
   */
  setCatColor(color: CatColor): void {
    this.catColor = color;
  }

  /**
   * Set the dungeon ID (determines dungeon type/difficulty)
   */
  setDungeonId(dungeonId: string): void {
    this.dungeonId = dungeonId;
  }

  /**
   * Set callback for content interactions
   */
  setOnContentTrigger(callback: (content: RoomContent, room: DungeonRoom) => void): void {
    this.onContentTrigger = callback;
  }

  /**
   * Set callback for room entry
   */
  setOnRoomEnter(callback: (room: DungeonRoom) => void): void {
    this.onRoomEnter = callback;
  }

  /**
   * Set callback for room clear
   */
  setOnRoomClear(callback: (room: DungeonRoom) => void): void {
    this.onRoomClear = callback;
  }

  /**
   * Set callback for floor completion
   */
  setOnFloorComplete(callback: (floorNumber: number) => void): void {
    this.onFloorComplete = callback;
  }

  /**
   * Set callback for room changes (for minimap updates)
   */
  setOnRoomChange(callback: (roomId: string) => void): void {
    this.onRoomChange = callback;
  }

  /**
   * Set the floor data (called by DungeonExploreView)
   */
  setFloor(floor: DungeonFloor): void {
    this.floor = floor;
    this.currentRoomId = floor.startRoomId;
  }

  /**
   * Start the dungeon game (uses pre-set floor if available)
   */
  start(floorNumber?: number): void {
    if (floorNumber !== undefined) {
      this.currentFloorNumber = floorNumber;
    }

    // Generate floor if not pre-set
    if (!this.floor) {
      const generator = new DungeonGenerator(this.dungeonId);
      this.floor = generator.generate(this.currentFloorNumber);
      this.currentRoomId = this.floor.startRoomId;
    }

    this.isRunning = true;

    // Wrap callbacks to track room changes
    const wrappedOnRoomEnter = (room: DungeonRoom) => {
      this.currentRoomId = room.id;
      if (this.onRoomChange) {
        this.onRoomChange(room.id);
      }
      if (this.onRoomEnter) {
        this.onRoomEnter(room);
      }
    };

    this.k.go('dungeon', {
      catColor: this.catColor,
      dungeonId: this.dungeonId,
      floorNumber: this.currentFloorNumber,
      floor: this.floor,
      onContentTrigger: this.onContentTrigger,
      onRoomEnter: wrappedOnRoomEnter,
      onRoomClear: this.onRoomClear,
      onFloorComplete: this.onFloorComplete,
    } as DungeonSceneData);
  }

  /**
   * Stop the dungeon game
   */
  stop(): void {
    this.isRunning = false;
    // KAPLAY doesn't have a pause/stop for scenes, but we can track state
  }

  /**
   * Update the dungeon (trigger re-render if needed)
   */
  update(): void {
    // KAPLAY handles its own update loop, this is for API compatibility
  }

  /**
   * Reposition player to current room center
   */
  repositionPlayerToRoomCenter(): void {
    // This would need scene communication - for now, restart scene at same room
    // The scene should handle repositioning based on currentRoomId
    if (this.floor && this.isRunning) {
      this.start();
    }
  }

  /**
   * Get the current room
   */
  getCurrentRoom(): DungeonRoom | null {
    if (!this.floor || !this.currentRoomId) return null;
    return this.floor.rooms.get(this.currentRoomId) || null;
  }

  /**
   * Continue to next floor
   */
  nextFloor(): void {
    this.currentFloorNumber++;
    this.floor = null; // Clear floor so start() generates new one
    this.start(this.currentFloorNumber);
  }

  /**
   * Get current floor data
   */
  getFloor(): DungeonFloor | null {
    return this.floor;
  }

  /**
   * Get current floor number
   */
  getFloorNumber(): number {
    return this.currentFloorNumber;
  }

  /**
   * Get dungeon generator config
   */
  getDungeonConfig() {
    const generator = new DungeonGenerator(this.dungeonId);
    return generator.getConfig();
  }

  /**
   * Destroy the game instance
   */
  destroy(): void {
    destroyGame(this.canvasId);
  }
}
