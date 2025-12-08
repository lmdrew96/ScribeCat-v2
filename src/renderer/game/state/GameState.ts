/**
 * GameState - Central state manager for StudyQuest
 *
 * Persists across scene changes. Scenes read from state,
 * modify through methods.
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
  // Player state
  player: PlayerData = {
    catColor: 'brown',
    health: 100,
    maxHealth: 100,
    xp: 0,
    level: 1,
    gold: 0,
  };

  // Dungeon state
  dungeon: DungeonData = {
    dungeonId: 'training',
    floorNumber: 1,
    floor: null,
    currentRoomId: '',
  };

  // Callbacks for external listeners (React views, etc.)
  private listeners: Map<string, Set<(data?: unknown) => void>> = new Map();

  // Player methods
  setCatColor(color: CatColor): void {
    this.player.catColor = color;
    this.emit('playerChanged', this.player);
  }

  takeDamage(amount: number): void {
    this.player.health = Math.max(0, this.player.health - amount);
    this.emit('healthChanged', this.player.health);
  }

  heal(amount: number): void {
    this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
    this.emit('healthChanged', this.player.health);
  }

  addXP(amount: number): void {
    this.player.xp += amount;
    this.emit('xpChanged', this.player.xp);
    // TODO: Level up logic
  }

  addGold(amount: number): void {
    this.player.gold += amount;
    this.emit('goldChanged', this.player.gold);
  }

  // Dungeon methods
  setFloor(floor: DungeonFloor): void {
    this.dungeon.floor = floor;
    this.dungeon.currentRoomId = floor.startRoomId;
    this.emit('floorChanged', floor);
  }

  setCurrentRoom(roomId: string): void {
    this.dungeon.currentRoomId = roomId;
    const room = this.getCurrentRoom();
    if (room) {
      room.visited = true;
      room.discovered = true;
      this.emit('roomChanged', room);
    }
  }

  getCurrentRoom(): DungeonRoom | null {
    if (!this.dungeon.floor) return null;
    return this.dungeon.floor.rooms.get(this.dungeon.currentRoomId) || null;
  }

  nextFloor(): void {
    this.dungeon.floorNumber++;
    this.dungeon.floor = null;
    this.emit('floorAdvanced', this.dungeon.floorNumber);
  }

  // Event system
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

  // Reset for new game
  reset(): void {
    this.player = {
      catColor: this.player.catColor, // Keep color choice
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

// Singleton export
export const GameState = new GameStateManager();
