/**
 * GameState - Central state manager for StudyQuest
 */

import type { DungeonFloor, DungeonRoom } from '../../canvas/dungeon/DungeonGenerator.js';
import type { CatColor } from '../sprites/catSprites.js';

export interface PlayerData {
  catColor: CatColor;
  health: number;
  maxHealth: number;
  xp: number;
  level: number;
  gold: number;
}

export interface DungeonData {
  dungeonId: string;
  floorNumber: number;
  floor: DungeonFloor | null;
  currentRoomId: string;
}

class GameStateManager {
  player: PlayerData = {
    catColor: 'grey',
    health: 100,
    maxHealth: 100,
    xp: 0,
    level: 1,
    gold: 0,
  };

  dungeon: DungeonData = {
    dungeonId: 'training',
    floorNumber: 1,
    floor: null,
    currentRoomId: '',
  };

  // Simple event emitter
  private listeners: Map<string, Set<(data?: unknown) => void>> = new Map();

  setCatColor(color: CatColor): void {
    this.player.catColor = color;
    this.emit('playerChanged');
  }

  setFloor(floor: DungeonFloor): void {
    this.dungeon.floor = floor;
    this.dungeon.currentRoomId = floor.startRoomId;
    this.emit('floorChanged');
  }

  setCurrentRoom(roomId: string): void {
    this.dungeon.currentRoomId = roomId;
    const room = this.getCurrentRoom();
    if (room) {
      room.visited = true;
      room.discovered = true;
    }
    this.emit('roomChanged');
  }

  getCurrentRoom(): DungeonRoom | null {
    if (!this.dungeon.floor) return null;
    return this.dungeon.floor.rooms.get(this.dungeon.currentRoomId) || null;
  }

  on(event: string, callback: (data?: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data?: unknown) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data?: unknown): void {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }

  reset(): void {
    this.player = {
      catColor: this.player.catColor,
      health: 100,
      maxHealth: 100,
      xp: 0,
      level: 1,
      gold: 0,
    };
    this.dungeon = {
      dungeonId: 'training',
      floorNumber: 1,
      floor: null,
      currentRoomId: '',
    };
    this.emit('reset');
  }
}

export const GameState = new GameStateManager();
