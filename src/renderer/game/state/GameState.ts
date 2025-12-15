/**
 * GameState - Central state manager for StudyQuest
 */

import type { DungeonFloor, DungeonRoom } from '../../canvas/dungeon/DungeonGenerator.js';
import type { CatColor } from '../sprites/catSprites.js';
import { getItem, type EquipmentSlot } from '../data/items.js';
import { getXpForLevel, getLevelUpStats } from '../systems/battle.js';
import {
  isIPCAvailable,
  getCurrentUserId,
  getOrCreateCharacter,
  getInventory,
  type CharacterData,
} from '../services/StudyQuestService.js';

export interface InventoryItem {
  id: string;
  quantity: number;
}

export interface EquippedItems {
  weapon: string | null;
  armor: string | null;
  accessory: string | null;
}

export interface PlayerData {
  catColor: CatColor;
  health: number;
  maxHealth: number;
  xp: number;
  level: number;
  gold: number;

  // Base combat stats (before equipment)
  attack: number;
  defense: number;
  luck: number;

  // Inventory
  items: InventoryItem[];

  // Equipped items
  equipped: EquippedItems;

  // Stats for cat unlocks
  battlesWon: number;
  battlesLost: number;
  totalGoldEarned: number;
  achievements: string[];
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
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },
    battlesWon: 0,
    battlesLost: 0,
    totalGoldEarned: 0,
    achievements: [],
  };

  dungeon: DungeonData = {
    dungeonId: 'training',
    floorNumber: 1,
    floor: null,
    currentRoomId: '',
  };

  // Cloud sync properties
  private userId: string | null = null;
  private characterId: string | null = null;
  private cloudCharacter: CharacterData | null = null;
  private isCloudEnabled = false;

  /**
   * Check if cloud sync is available
   */
  isCloudAvailable(): boolean {
    return isIPCAvailable();
  }

  /**
   * Check if user has a saved cloud game
   */
  async hasSavedGame(): Promise<boolean> {
    if (!this.isCloudAvailable()) return false;

    try {
      const userId = await getCurrentUserId();
      if (!userId) return false;

      const character = await getOrCreateCharacter(userId);
      return character !== null && character.level > 0;
    } catch {
      return false;
    }
  }

  /**
   * Load game state from cloud
   */
  async loadFromCloud(): Promise<boolean> {
    if (!this.isCloudAvailable()) {
      console.log('Cloud sync not available');
      return false;
    }

    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        console.log('No user logged in');
        return false;
      }

      this.userId = userId;
      const character = await getOrCreateCharacter(userId);

      if (!character) {
        console.log('Failed to get/create character');
        return false;
      }

      this.characterId = character.id;
      this.cloudCharacter = character;
      this.isCloudEnabled = true;

      // Map cloud character to local state
      this.player = {
        ...this.player,
        health: character.hp,
        maxHealth: character.maxHp,
        xp: character.currentXp,
        level: character.level,
        gold: character.gold,
        attack: character.attack,
        defense: character.defense,
        luck: 0, // Not in cloud schema
        equipped: {
          weapon: character.equippedWeaponId || null,
          armor: character.equippedArmorId || null,
          accessory: character.equippedAccessoryId || null,
        },
      };

      // Load dungeon progress from cloud
      this.dungeon.dungeonId = character.currentDungeonId || 'training';
      this.dungeon.floorNumber = character.currentFloor || 1;
      // Clear floor data - will be regenerated when entering dungeon
      this.dungeon.floor = null;
      this.dungeon.currentRoomId = '';

      // Load inventory from cloud
      try {
        const inventory = await getInventory(character.id);
        if (inventory.length > 0) {
          this.player.items = inventory.map(slot => ({
            id: slot.itemId,
            quantity: slot.quantity,
          }));
        }
      } catch (invErr) {
        console.warn('Failed to load inventory from cloud:', invErr);
      }

      this.emit('cloudLoaded');
      this.emit('playerChanged');

      const dungeonInfo = character.currentDungeonId
        ? `, in dungeon: ${character.currentDungeonId} floor ${character.currentFloor}`
        : '';
      console.log(`Loaded cloud save: Level ${character.level}, ${character.gold} gold${dungeonInfo}`);
      return true;
    } catch (err) {
      console.error('Failed to load from cloud:', err);
      return false;
    }
  }

  /**
   * Get the cloud character ID (for IPC calls)
   */
  getCharacterId(): string | null {
    return this.characterId;
  }

  /**
   * Check if cloud sync is enabled for this session
   */
  isCloudSyncEnabled(): boolean {
    return this.isCloudEnabled;
  }

  /**
   * Check if player has an active dungeon run to resume
   */
  hasActiveDungeonRun(): boolean {
    // A valid dungeon run means we have a dungeon ID that isn't the default/training
    // and we have a floor number > 0
    return !!(
      this.dungeon.dungeonId &&
      this.dungeon.dungeonId !== '' &&
      this.dungeon.floorNumber > 0
    );
  }

  /**
   * Initialize cloud sync for a new game (doesn't load saved progress)
   * This sets up the cloud connection so progress can be saved
   */
  async initializeCloudForNewGame(): Promise<boolean> {
    if (!this.isCloudAvailable()) {
      console.log('Cloud sync not available for new game');
      return false;
    }

    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        console.log('No user logged in - playing offline');
        return false;
      }

      this.userId = userId;
      const character = await getOrCreateCharacter(userId);

      if (!character) {
        console.log('Failed to get/create character for new game');
        return false;
      }

      this.characterId = character.id;
      this.cloudCharacter = character;
      this.isCloudEnabled = true;

      console.log(`Cloud sync initialized for new game (character: ${character.id})`);
      return true;
    } catch (err) {
      console.error('Failed to initialize cloud for new game:', err);
      return false;
    }
  }

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

  /**
   * Remove all listeners for a specific event, or all listeners if no event specified.
   * Use this for cleanup when scenes are destroyed to prevent memory leaks.
   */
  offAll(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
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
    this.player.totalGoldEarned += amount;
    this.emit('goldChanged');
  }

  /**
   * Record a battle win
   */
  recordBattleWin(): void {
    this.player.battlesWon++;
    this.emit('statsChanged');
  }

  /**
   * Record a battle loss
   */
  recordBattleLoss(): void {
    this.player.battlesLost++;
    this.emit('statsChanged');
  }

  /**
   * Award an achievement
   */
  awardAchievement(achievementId: string): boolean {
    if (this.player.achievements.includes(achievementId)) {
      return false; // Already have it
    }
    this.player.achievements.push(achievementId);
    this.emit('achievementUnlocked', achievementId);
    return true;
  }

  /**
   * Check if player has an achievement
   */
  hasAchievement(achievementId: string): boolean {
    return this.player.achievements.includes(achievementId);
  }

  spendGold(amount: number): boolean {
    if (this.player.gold < amount) return false;
    this.player.gold -= amount;
    this.emit('goldChanged');
    return true;
  }

  // --- Equipment Management ---

  /**
   * Get stat bonus from a specific equipment slot
   */
  getEquipmentBonus(stat: 'attack' | 'defense' | 'luck' | 'maxHealth'): number {
    let bonus = 0;
    const slots: EquipmentSlot[] = ['weapon', 'armor', 'accessory'];

    for (const slot of slots) {
      const itemId = this.player.equipped[slot];
      if (itemId) {
        const item = getItem(itemId);
        if (item?.stats?.[stat]) {
          bonus += item.stats[stat]!;
        }
      }
    }

    return bonus;
  }

  /**
   * Get effective attack (base + equipment)
   */
  getEffectiveAttack(): number {
    return this.player.attack + this.getEquipmentBonus('attack');
  }

  /**
   * Get effective defense (base + equipment)
   */
  getEffectiveDefense(): number {
    return this.player.defense + this.getEquipmentBonus('defense');
  }

  /**
   * Get effective luck (base + equipment)
   */
  getEffectiveLuck(): number {
    return this.player.luck + this.getEquipmentBonus('luck');
  }

  /**
   * Get effective max health (base + equipment)
   */
  getEffectiveMaxHealth(): number {
    return this.player.maxHealth + this.getEquipmentBonus('maxHealth');
  }

  /**
   * Equip an item (must be in inventory)
   */
  equipItem(itemId: string): boolean {
    const item = getItem(itemId);
    if (!item || item.type !== 'equipment' || !item.slot) {
      return false;
    }

    // Check if we have it in inventory
    if (!this.hasItem(itemId)) {
      return false;
    }

    // Unequip current item in that slot first
    const currentEquipped = this.player.equipped[item.slot];
    if (currentEquipped) {
      this.unequipItem(item.slot);
    }

    // Equip the new item (remove from inventory)
    this.removeItem(itemId, 1);
    this.player.equipped[item.slot] = itemId;

    // If armor gives max health, update current health proportionally
    if (item.slot === 'armor' && item.stats?.maxHealth) {
      const oldMax = this.player.maxHealth;
      const newMax = this.getEffectiveMaxHealth();
      // Keep same health percentage
      this.player.health = Math.min(this.player.health, newMax);
    }

    this.emit('equipmentChanged');
    this.emit('playerChanged');
    return true;
  }

  /**
   * Unequip an item from a slot (returns to inventory)
   */
  unequipItem(slot: EquipmentSlot): boolean {
    const itemId = this.player.equipped[slot];
    if (!itemId) {
      return false;
    }

    // Add back to inventory
    this.addItem(itemId, 1);
    this.player.equipped[slot] = null;

    this.emit('equipmentChanged');
    this.emit('playerChanged');
    return true;
  }

  /**
   * Get equipped item in a slot
   */
  getEquippedItem(slot: EquipmentSlot): string | null {
    return this.player.equipped[slot];
  }

  // --- XP and Level ---

  /**
   * Get XP required for the next level
   */
  getXpForNextLevel(): number {
    return getXpForLevel(this.player.level);
  }

  /**
   * Check if player can level up and apply it
   */
  checkLevelUp(): boolean {
    const requiredXp = this.getXpForNextLevel();
    if (this.player.xp < requiredXp) {
      return false;
    }

    // Level up!
    this.player.level++;
    const statBoosts = getLevelUpStats(this.player.level);

    // Apply stat increases
    this.player.maxHealth += statBoosts.maxHp;
    this.player.health = Math.min(this.player.health + statBoosts.maxHp, this.getEffectiveMaxHealth());
    this.player.attack += statBoosts.attack;
    this.player.defense += statBoosts.defense;

    this.emit('levelUp', {
      newLevel: this.player.level,
      statBoosts,
    });
    this.emit('playerChanged');

    return true;
  }

  addXp(amount: number): { levelsGained: number; oldLevel: number } {
    const oldLevel = this.player.level;
    this.player.xp += amount;
    this.emit('xpChanged');

    // Check for multiple level ups
    let levelsGained = 0;
    while (this.checkLevelUp()) {
      levelsGained++;
    }

    return { levelsGained, oldLevel };
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
      equipped: {
        weapon: null,
        armor: null,
        accessory: null,
      },
      battlesWon: 0,
      battlesLost: 0,
      totalGoldEarned: 0,
      achievements: [],
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
