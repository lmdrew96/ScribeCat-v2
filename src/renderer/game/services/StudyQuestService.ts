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
  // Dungeon progress fields for cloud save/continue
  currentDungeonId?: string | null;
  currentFloor?: number;
}

export interface InventorySlot {
  itemId: string;
  quantity: number;
}

// Use the Electron IPC API exposed via preload (exposed as 'scribeCat' in preload.ts)
const ipc = (window as Window & { scribeCat?: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } }).scribeCat;

// IPC timeout and retry configuration
const IPC_TIMEOUT_MS = 5000; // 5 second timeout
const IPC_MAX_RETRIES = 3;
const IPC_RETRY_DELAY_MS = 500;

/**
 * Wrap an IPC call with timeout and retry logic
 */
async function invokeWithRetry<T>(
  channel: string,
  ...args: unknown[]
): Promise<T | null> {
  if (!ipc?.invoke) return null;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= IPC_MAX_RETRIES; attempt++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('IPC timeout')), IPC_TIMEOUT_MS)
      );
      const ipcPromise = ipc.invoke(channel, ...args) as Promise<T>;
      return await Promise.race([ipcPromise, timeoutPromise]);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`IPC call ${channel} attempt ${attempt}/${IPC_MAX_RETRIES} failed:`, lastError.message);

      if (attempt < IPC_MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, IPC_RETRY_DELAY_MS));
      }
    }
  }

  console.error(`IPC call ${channel} failed after ${IPC_MAX_RETRIES} attempts:`, lastError);
  return null;
}

/**
 * Check if IPC is available (running in Electron)
 */
export function isIPCAvailable(): boolean {
  return !!ipc?.invoke;
}

/**
 * Get the current user ID from the auth system
 * Uses RendererSupabaseClient directly since auth state lives in renderer (localStorage)
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    // Dynamic import to avoid circular dependencies
    const { RendererSupabaseClient } = await import('../../services/RendererSupabaseClient.js');
    const client = RendererSupabaseClient.getInstance().getClient();
    const { data: { session } } = await client.auth.getSession();
    return session?.user?.id || null;
  } catch (err) {
    console.error('Error getting current user ID:', err);
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
    // Update HP if changed (use targetHp for absolute value)
    if (updates.hp !== undefined) {
      await ipc.invoke('studyquest:heal-direct', {
        characterId,
        targetHp: updates.hp,
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

/**
 * Save dungeon progress (for cloud save/continue)
 * Set dungeonId to null when exiting dungeon
 */
export async function saveDungeonProgress(
  characterId: string,
  dungeonId: string | null,
  floor: number
): Promise<boolean> {
  if (!ipc?.invoke) return false;

  try {
    const result = await ipc.invoke('studyquest:save-dungeon-progress', {
      characterId,
      dungeonId,
      floor,
    }) as { success: boolean };

    return result.success;
  } catch (err) {
    console.error('Error saving dungeon progress:', err);
    return false;
  }
}
