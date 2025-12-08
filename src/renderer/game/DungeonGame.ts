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
  private canvasId: string;
  private catColor: CatColor = 'brown';
  private dungeonId: string = 'training';
  private currentFloor: number = 1;
  private floor: DungeonFloor | null = null;

  // Callbacks
  private onContentTrigger?: (content: RoomContent, room: DungeonRoom) => void;
  private onRoomEnter?: (room: DungeonRoom) => void;
  private onRoomClear?: (room: DungeonRoom) => void;
  private onFloorComplete?: (floorNumber: number) => void;

  constructor(canvas: HTMLCanvasElement) {
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
   * Start a new dungeon run
   */
  start(floorNumber: number = 1): void {
    this.currentFloor = floorNumber;

    // Generate floor
    const generator = new DungeonGenerator(this.dungeonId);
    this.floor = generator.generate(floorNumber);

    this.k.go('dungeon', {
      catColor: this.catColor,
      dungeonId: this.dungeonId,
      floorNumber: this.currentFloor,
      floor: this.floor,
      onContentTrigger: this.onContentTrigger,
      onRoomEnter: this.onRoomEnter,
      onRoomClear: this.onRoomClear,
      onFloorComplete: this.onFloorComplete,
    } as DungeonSceneData);
  }

  /**
   * Continue to next floor
   */
  nextFloor(): void {
    this.currentFloor++;
    this.start(this.currentFloor);
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
    return this.currentFloor;
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
