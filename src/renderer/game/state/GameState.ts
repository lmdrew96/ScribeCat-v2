/**
 * GameState - Central state manager for StudyQuest
 */

import type { DungeonFloor, DungeonRoom } from '../../canvas/dungeon/DungeonGenerator.js';
import type { CatColor } from '../sprites/catSprites.js';

export interface InventoryItem {
  id: string;
  quantity: number;
}

export interface PlayerData {
  catColor: CatColor;
  health: number;
  maxHealth: number;
  xp: number;
  level: number;
  gold: number;

  // Combat stats
  attack: number;
  defense: number;
  luck: number;

  // Inventory
  items: InventoryItem[];
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
    gold: 50, // Start with some gold
    attack: 15,
    defense: 5,
    luck: 0,
    items: [
      { id: 'health_potion', quantity: 3 }, // Start with 3 potions
    ],
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

  // --- Inventory Management ---

  addItem(itemId: string, quantity = 1): void {
    const existing = this.player.items.find((i) => i.id === itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.player.items.push({ id: itemId, quantity });
    }
    this.emit('inventoryChanged');
  }

  removeItem(itemId: string, quantity = 1): boolean {
    const existing = this.player.items.find((i) => i.id === itemId);
    if (!existing || existing.quantity < quantity) {
      return false;
    }
    existing.quantity -= quantity;
    if (existing.quantity <= 0) {
      this.player.items = this.player.items.filter((i) => i.id !== itemId);
    }
    this.emit('inventoryChanged');
    return true;
  }

  hasItem(itemId: string, quantity = 1): boolean {
    const existing = this.player.items.find((i) => i.id === itemId);
    return existing ? existing.quantity >= quantity : false;
  }

  getItemCount(itemId: string): number {
    const existing = this.player.items.find((i) => i.id === itemId);
    return existing ? existing.quantity : 0;
  }

  // --- Gold Management ---

  addGold(amount: number): void {
    this.player.gold += amount;
    this.emit('goldChanged');
  }

  spendGold(amount: number): boolean {
    if (this.player.gold < amount) return false;
    this.player.gold -= amount;
    this.emit('goldChanged');
    return true;
  }

  // --- XP and Level ---

  addXp(amount: number): void {
    this.player.xp += amount;
    this.emit('xpChanged');
    // TODO: Check for level up
  }

  reset(): void {
    this.player = {
      catColor: this.player.catColor,
      health: 100,
      maxHealth: 100,
      xp: 0,
      level: 1,
      gold: 50,
      attack: 15,
      defense: 5,
      luck: 0,
      items: [
        { id: 'health_potion', quantity: 3 },
      ],
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
