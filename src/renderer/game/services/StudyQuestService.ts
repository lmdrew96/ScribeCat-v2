/**
 * StudyQuestService - Bridge between game and Supabase backend
 *
 * Handles saving/loading game state via IPC to the main process.
 */

import type { EquipmentSlot } from '../data/items.js';

export interface CharacterData {
  id: string;
  userId: string;
  name: string;
  classId: string;
  level: number;
  currentXp: number;
  gold: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  equippedWeaponId?: string | null;
  equippedArmorId?: string | null;
  equippedAccessoryId?: string | null;
  battlesWon: number;
  battlesLost: number;
  dungeonsCompleted: number;
}

export interface InventorySlot {
  itemId: string;
  quantity: number;
}

// Use the Electron IPC API exposed via preload
const ipc = (window as Window & { electronAPI?: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } }).electronAPI;

/**
 * Check if IPC is available (running in Electron)
 */
export function isIPCAvailable(): boolean {
  return !!ipc?.invoke;
}

/**
 * Get the current user ID from the auth system
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (!ipc?.invoke) return null;

  try {
    const result = await ipc.invoke('auth:getCurrentUser') as { success: boolean; user?: { id: string } };
    return result.success && result.user ? result.user.id : null;
  } catch {
    return null;
  }
}

/**
 * Get or create a character for the current user
 */
export async function getOrCreateCharacter(userId: string, catName = 'Cat Hero'): Promise<CharacterData | null> {
  if (!ipc?.invoke) return null;

  try {
    // Try to get existing character
    const getResult = await ipc.invoke('studyquest:get-character', userId) as {
      success: boolean;
      character?: CharacterData;
      error?: string;
    };

    if (getResult.success && getResult.character) {
      return getResult.character;
    }

    // Create new character
    const createResult = await ipc.invoke('studyquest:create-character', {
      userId,
      name: catName,
      classId: 'scholar', // Default class
    }) as {
      success: boolean;
      character?: CharacterData;
      error?: string;
    };

    if (createResult.success && createResult.character) {
      return createResult.character;
    }

    console.error('Failed to create character:', createResult.error);
    return null;
  } catch (err) {
    console.error('Error getting/creating character:', err);
    return null;
  }
}

/**
 * Save character state to backend
 */
export async function saveCharacter(characterId: string, updates: {
  hp?: number;
  gold?: number;
  xp?: number;
  level?: number;
}): Promise<boolean> {
  if (!ipc?.invoke) return false;

  try {
    // Update HP if changed
    if (updates.hp !== undefined) {
      await ipc.invoke('studyquest:heal-direct', {
        characterId,
        amount: updates.hp - 0, // We'll calculate the actual delta in a real implementation
      });
    }

    // Add XP if gained
    if (updates.xp !== undefined && updates.xp > 0) {
      await ipc.invoke('studyquest:add-xp', {
        characterId,
        amount: updates.xp,
      });
    }

    // Add gold if gained
    if (updates.gold !== undefined && updates.gold > 0) {
      await ipc.invoke('studyquest:add-gold', {
        characterId,
        amount: updates.gold,
      });
    }

    return true;
  } catch (err) {
    console.error('Error saving character:', err);
    return false;
  }
}

/**
 * Get character's inventory from backend
 */
export async function getInventory(characterId: string): Promise<InventorySlot[]> {
  if (!ipc?.invoke) return [];

  try {
    const result = await ipc.invoke('studyquest:get-inventory', characterId) as {
      success: boolean;
      inventory?: Array<{ item: { id: string }; quantity: number }>;
    };

    if (result.success && result.inventory) {
      return result.inventory.map(slot => ({
        itemId: slot.item.id,
        quantity: slot.quantity,
      }));
    }
    return [];
  } catch (err) {
    console.error('Error getting inventory:', err);
    return [];
  }
}

/**
 * Buy an item from the shop
 */
export async function buyItem(characterId: string, itemId: string): Promise<boolean> {
  if (!ipc?.invoke) return false;

  try {
    const result = await ipc.invoke('studyquest:buy-item', {
      characterId,
      itemId,
    }) as { success: boolean };

    return result.success;
  } catch (err) {
    console.error('Error buying item:', err);
    return false;
  }
}

/**
 * Equip an item
 */
export async function equipItem(characterId: string, itemId: string): Promise<boolean> {
  if (!ipc?.invoke) return false;

  try {
    const result = await ipc.invoke('studyquest:equip-item', {
      characterId,
      itemId,
    }) as { success: boolean };

    return result.success;
  } catch (err) {
    console.error('Error equipping item:', err);
    return false;
  }
}

/**
 * Unequip an item from a slot
 */
export async function unequipItem(characterId: string, slot: EquipmentSlot): Promise<boolean> {
  if (!ipc?.invoke) return false;

  try {
    const result = await ipc.invoke('studyquest:unequip-item', {
      characterId,
      slot,
    }) as { success: boolean };

    return result.success;
  } catch (err) {
    console.error('Error unequipping item:', err);
    return false;
  }
}

/**
 * Heal at the inn
 */
export async function healAtInn(characterId: string, cost: number): Promise<boolean> {
  if (!ipc?.invoke) return false;

  try {
    const result = await ipc.invoke('studyquest:heal-character', {
      characterId,
      cost,
    }) as { success: boolean };

    return result.success;
  } catch (err) {
    console.error('Error healing at inn:', err);
    return false;
  }
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(limit = 10): Promise<Array<{
  rank: number;
  characterName: string;
  level: number;
  xp: number;
}>> {
  if (!ipc?.invoke) return [];

  try {
    const result = await ipc.invoke('studyquest:get-leaderboard', limit) as {
      success: boolean;
      leaderboard?: Array<{
        rank: number;
        characterName: string;
        level: number;
        xp: number;
      }>;
    };

    return result.success && result.leaderboard ? result.leaderboard : [];
  } catch (err) {
    console.error('Error getting leaderboard:', err);
    return [];
  }
}
