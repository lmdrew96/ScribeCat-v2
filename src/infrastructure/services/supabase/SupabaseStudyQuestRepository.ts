/**
 * Supabase StudyQuest Repository
 *
 * Handles all StudyQuest RPG operations with Supabase:
 * characters, inventory, dungeons, battles, and quests.
 */

import { SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';
import { SupabaseClient } from './SupabaseClient.js';
import {
  IStudyQuestRepository,
  CreateCharacterParams,
  UpdateCharacterParams,
  AddXpResult,
  InventoryOperationParams,
  UpdateQuestProgressParams,
  LeaderboardEntry,
} from '../../../domain/repositories/IStudyQuestRepository.js';
import {
  StudyQuestCharacter,
  CharacterClassData,
  CHARACTER_CLASSES,
} from '../../../domain/entities/StudyQuestCharacter.js';
import {
  StudyQuestItem,
  InventorySlot,
  createInventorySlot,
} from '../../../domain/entities/StudyQuestItem.js';
import {
  StudyQuestDungeon,
  StudyQuestEnemy,
  DungeonRunState,
} from '../../../domain/entities/StudyQuestDungeon.js';
import {
  StudyQuestQuest,
  QuestProgress,
  QuestWithProgress,
} from '../../../domain/entities/StudyQuestQuest.js';
import { CombatLogRecord } from '../../../domain/entities/StudyQuestBattle.js';

/**
 * NOTE: Realtime subscriptions are handled directly in the renderer process
 * via RendererSupabaseClient (WebSockets don't work in Electron's main process).
 * See StudyQuestManager for subscription implementation.
 */
export class SupabaseStudyQuestRepository implements IStudyQuestRepository {
  /**
   * Get a fresh Supabase client with the current session
   */
  private getClient(): SupabaseClientType {
    return SupabaseClient.getInstance().getClient();
  }

  // ============================================================================
  // Character Operations
  // ============================================================================

  async getClasses(): Promise<CharacterClassData[]> {
    // Return static class data (classes are defined in code, not DB)
    return Object.values(CHARACTER_CLASSES);
  }

  async createCharacter(params: CreateCharacterParams): Promise<StudyQuestCharacter> {
    const classData = CHARACTER_CLASSES[params.classId];
    if (!classData) {
      throw new Error(`Invalid class ID: ${params.classId}`);
    }

    const { data, error } = await this.getClient()
      .from('study_quest_characters')
      .insert({
        user_id: params.userId,
        name: params.name,
        class_id: params.classId,
        level: 1,
        current_xp: 0,
        total_xp_earned: 0,
        gold: 100,
        hp: classData.baseHp,
        max_hp: classData.baseHp,
        attack: classData.baseAttack,
        defense: classData.baseDefense,
        speed: classData.baseSpeed,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create character:', error);
      throw new Error(`Failed to create character: ${error.message}`);
    }

    return StudyQuestCharacter.fromDatabase(data);
  }

  async getCharacterByUserId(userId: string): Promise<StudyQuestCharacter | null> {
    // Check for quest resets before loading character
    // This will reset daily/weekly quests if they've expired
    try {
      await this.getClient().rpc('study_quest_check_quest_resets', { p_user_id: userId });
    } catch (resetError) {
      // Non-critical - log and continue
      console.warn('Failed to check quest resets:', resetError);
    }

    const { data, error } = await this.getClient()
      .from('study_quest_characters')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Failed to get character:', error);
      throw new Error(`Failed to get character: ${error.message}`);
    }

    return StudyQuestCharacter.fromDatabase(data);
  }

  async getCharacter(characterId: string): Promise<StudyQuestCharacter | null> {
    const { data, error } = await this.getClient()
      .from('study_quest_characters')
      .select('*')
      .eq('id', characterId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Failed to get character:', error);
      throw new Error(`Failed to get character: ${error.message}`);
    }

    return StudyQuestCharacter.fromDatabase(data);
  }

  async updateCharacter(params: UpdateCharacterParams): Promise<StudyQuestCharacter> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (params.hp !== undefined) updates.hp = params.hp;
    if (params.gold !== undefined) updates.gold = params.gold;
    if (params.equippedWeaponId !== undefined) updates.equipped_weapon_id = params.equippedWeaponId;
    if (params.equippedArmorId !== undefined) updates.equipped_armor_id = params.equippedArmorId;
    if (params.equippedAccessoryId !== undefined) updates.equipped_accessory_id = params.equippedAccessoryId;
    if (params.currentDungeonId !== undefined) updates.current_dungeon_id = params.currentDungeonId;
    if (params.currentFloor !== undefined) updates.current_floor = params.currentFloor;
    if (params.battlesWon !== undefined) updates.battles_won = params.battlesWon;
    if (params.battlesLost !== undefined) updates.battles_lost = params.battlesLost;
    if (params.dungeonsCompleted !== undefined) updates.dungeons_completed = params.dungeonsCompleted;
    if (params.questsCompleted !== undefined) updates.quests_completed = params.questsCompleted;
    if (params.highestDungeonFloor !== undefined) updates.highest_dungeon_floor = params.highestDungeonFloor;
    if (params.lastDailyRewardAt !== undefined) updates.last_daily_reward_at = params.lastDailyRewardAt?.toISOString();
    if (params.lastActivityAt !== undefined) updates.last_activity_at = params.lastActivityAt?.toISOString();

    const { data, error } = await this.getClient()
      .from('study_quest_characters')
      .update(updates)
      .eq('id', params.characterId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update character:', error);
      throw new Error(`Failed to update character: ${error.message}`);
    }

    return StudyQuestCharacter.fromDatabase(data);
  }

  async addXp(characterId: string, amount: number): Promise<AddXpResult> {
    // Use the database function for atomic XP addition and level-up handling
    const { data, error } = await this.getClient().rpc('study_quest_add_xp', {
      p_character_id: characterId,
      p_xp_amount: amount,
    });

    if (error) {
      console.error('Failed to add XP:', error);
      throw new Error(`Failed to add XP: ${error.message}`);
    }

    const result = data[0];
    return {
      newLevel: result.new_level,
      newXp: result.new_xp,
      levelsGained: result.levels_gained,
      hpGained: result.hp_gained,
      attackGained: result.attack_gained,
      defenseGained: result.defense_gained,
      speedGained: result.speed_gained,
    };
  }

  async addGold(characterId: string, amount: number): Promise<StudyQuestCharacter> {
    // First get current gold
    const character = await this.getCharacter(characterId);
    if (!character) {
      throw new Error('Character not found');
    }

    return this.updateCharacter({
      characterId,
      gold: character.gold + amount,
      lastActivityAt: new Date(),
    });
  }

  async spendGold(characterId: string, amount: number): Promise<boolean> {
    const character = await this.getCharacter(characterId);
    if (!character) {
      throw new Error('Character not found');
    }

    if (character.gold < amount) {
      return false;
    }

    await this.updateCharacter({
      characterId,
      gold: character.gold - amount,
    });

    return true;
  }

  async healCharacter(characterId: string): Promise<StudyQuestCharacter> {
    const character = await this.getCharacter(characterId);
    if (!character) {
      throw new Error('Character not found');
    }

    return this.updateCharacter({
      characterId,
      hp: character.maxHp,
    });
  }

  async healCharacterWithCost(characterId: string, cost: number): Promise<StudyQuestCharacter> {
    const character = await this.getCharacter(characterId);
    if (!character) {
      throw new Error('Character not found');
    }

    if (cost > 0 && character.gold < cost) {
      throw new Error('Not enough gold');
    }

    // Heal to full HP and deduct gold
    const { data, error } = await this.getClient()
      .from('study_quest_characters')
      .update({
        hp: character.maxHp,
        gold: character.gold - cost,
        updated_at: new Date().toISOString(),
      })
      .eq('id', characterId)
      .select()
      .single();

    if (error) {
      console.error('Failed to heal character with cost:', error);
      throw new Error(`Failed to heal character: ${error.message}`);
    }

    return StudyQuestCharacter.fromDatabase(data);
  }

  async updateHp(characterId: string, newHp: number): Promise<StudyQuestCharacter> {
    return this.updateCharacter({
      characterId,
      hp: Math.max(0, newHp),
    });
  }

  async deleteCharacter(characterId: string): Promise<void> {
    const { error } = await this.getClient()
      .from('study_quest_characters')
      .delete()
      .eq('id', characterId);

    if (error) {
      console.error('Failed to delete character:', error);
      throw new Error(`Failed to delete character: ${error.message}`);
    }
  }

  async deleteCharacterByUserId(userId: string): Promise<void> {
    const { error } = await this.getClient()
      .from('study_quest_characters')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to delete character by user ID:', error);
      throw new Error(`Failed to delete character: ${error.message}`);
    }
  }

  // ============================================================================
  // Inventory Operations
  // ============================================================================

  async getItems(): Promise<StudyQuestItem[]> {
    const { data, error } = await this.getClient()
      .from('study_quest_items')
      .select('*')
      .order('tier', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to get items:', error);
      throw new Error(`Failed to get items: ${error.message}`);
    }

    return data.map((row) => StudyQuestItem.fromDatabase(row));
  }

  async getShopItems(): Promise<StudyQuestItem[]> {
    const { data, error } = await this.getClient()
      .from('study_quest_items')
      .select('*')
      .eq('is_purchasable', true)
      .order('tier', { ascending: true })
      .order('buy_price', { ascending: true });

    if (error) {
      console.error('Failed to get shop items:', error);
      throw new Error(`Failed to get shop items: ${error.message}`);
    }

    return data.map((row) => StudyQuestItem.fromDatabase(row));
  }

  async getItem(itemId: string): Promise<StudyQuestItem | null> {
    const { data, error } = await this.getClient()
      .from('study_quest_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Failed to get item:', error);
      throw new Error(`Failed to get item: ${error.message}`);
    }

    return StudyQuestItem.fromDatabase(data);
  }

  async getInventory(characterId: string): Promise<InventorySlot[]> {
    const { data, error } = await this.getClient()
      .from('study_quest_inventory')
      .select(`
        id,
        character_id,
        quantity,
        acquired_at,
        item:study_quest_items(*)
      `)
      .eq('character_id', characterId);

    if (error) {
      console.error('Failed to get inventory:', error);
      throw new Error(`Failed to get inventory: ${error.message}`);
    }

    return data.map((row) => createInventorySlot(row as never));
  }

  async addToInventory(params: InventoryOperationParams): Promise<InventorySlot> {
    const quantity = params.quantity ?? 1;

    // Try to update existing slot first
    const { data: existing } = await this.getClient()
      .from('study_quest_inventory')
      .select('id, quantity')
      .eq('character_id', params.characterId)
      .eq('item_id', params.itemId)
      .single();

    if (existing) {
      // Update quantity
      await this.getClient()
        .from('study_quest_inventory')
        .update({ quantity: existing.quantity + quantity })
        .eq('id', existing.id);
    } else {
      // Insert new slot
      await this.getClient()
        .from('study_quest_inventory')
        .insert({
          character_id: params.characterId,
          item_id: params.itemId,
          quantity,
        });
    }

    // Fetch the updated slot
    const { data, error } = await this.getClient()
      .from('study_quest_inventory')
      .select(`
        id,
        character_id,
        quantity,
        acquired_at,
        item:study_quest_items(*)
      `)
      .eq('character_id', params.characterId)
      .eq('item_id', params.itemId)
      .single();

    if (error) {
      console.error('Failed to add to inventory:', error);
      throw new Error(`Failed to add to inventory: ${error.message}`);
    }

    return createInventorySlot(data as never);
  }

  async removeFromInventory(params: InventoryOperationParams): Promise<boolean> {
    const quantity = params.quantity ?? 1;

    const { data: existing } = await this.getClient()
      .from('study_quest_inventory')
      .select('id, quantity')
      .eq('character_id', params.characterId)
      .eq('item_id', params.itemId)
      .single();

    if (!existing || existing.quantity < quantity) {
      return false;
    }

    if (existing.quantity === quantity) {
      // Remove the slot entirely
      await this.getClient()
        .from('study_quest_inventory')
        .delete()
        .eq('id', existing.id);
    } else {
      // Decrease quantity
      await this.getClient()
        .from('study_quest_inventory')
        .update({ quantity: existing.quantity - quantity })
        .eq('id', existing.id);
    }

    return true;
  }

  async useItem(
    characterId: string,
    itemId: string
  ): Promise<{ success: boolean; effect?: { type: string; value: number } }> {
    const item = await this.getItem(itemId);
    if (!item || !item.isConsumable) {
      return { success: false };
    }

    // Remove from inventory
    const removed = await this.removeFromInventory({ characterId, itemId, quantity: 1 });
    if (!removed) {
      return { success: false };
    }

    // Apply effect
    if (item.effectType === 'heal' && item.effectValue > 0) {
      const character = await this.getCharacter(characterId);
      if (character) {
        const newHp = Math.min(character.maxHp, character.hp + item.effectValue);
        await this.updateHp(characterId, newHp);
      }
    }

    return {
      success: true,
      effect: item.effectType ? { type: item.effectType, value: item.effectValue } : undefined,
    };
  }

  async equipItem(characterId: string, itemId: string): Promise<StudyQuestCharacter> {
    const item = await this.getItem(itemId);
    if (!item || !item.isEquippable) {
      throw new Error('Item cannot be equipped');
    }

    const updateParams: UpdateCharacterParams = { characterId };

    switch (item.itemType) {
      case 'weapon':
        updateParams.equippedWeaponId = itemId;
        break;
      case 'armor':
        updateParams.equippedArmorId = itemId;
        break;
      case 'accessory':
        updateParams.equippedAccessoryId = itemId;
        break;
    }

    return this.updateCharacter(updateParams);
  }

  async unequipItem(
    characterId: string,
    slot: 'weapon' | 'armor' | 'accessory'
  ): Promise<StudyQuestCharacter> {
    const updateParams: UpdateCharacterParams = { characterId };

    switch (slot) {
      case 'weapon':
        updateParams.equippedWeaponId = null;
        break;
      case 'armor':
        updateParams.equippedArmorId = null;
        break;
      case 'accessory':
        updateParams.equippedAccessoryId = null;
        break;
    }

    return this.updateCharacter(updateParams);
  }

  // ============================================================================
  // Dungeon Operations
  // ============================================================================

  async getDungeons(): Promise<StudyQuestDungeon[]> {
    const { data, error } = await this.getClient()
      .from('study_quest_dungeons')
      .select('*')
      .order('unlock_order', { ascending: true });

    if (error) {
      console.error('Failed to get dungeons:', error);
      throw new Error(`Failed to get dungeons: ${error.message}`);
    }

    return data.map((row) => StudyQuestDungeon.fromDatabase(row));
  }

  async getAvailableDungeons(characterLevel: number): Promise<StudyQuestDungeon[]> {
    const { data, error } = await this.getClient()
      .from('study_quest_dungeons')
      .select('*')
      .lte('required_level', characterLevel)
      .order('unlock_order', { ascending: true });

    if (error) {
      console.error('Failed to get available dungeons:', error);
      throw new Error(`Failed to get available dungeons: ${error.message}`);
    }

    return data.map((row) => StudyQuestDungeon.fromDatabase(row));
  }

  async getDungeon(dungeonId: string): Promise<StudyQuestDungeon | null> {
    const { data, error } = await this.getClient()
      .from('study_quest_dungeons')
      .select('*')
      .eq('id', dungeonId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Failed to get dungeon:', error);
      throw new Error(`Failed to get dungeon: ${error.message}`);
    }

    return StudyQuestDungeon.fromDatabase(data);
  }

  async getEnemiesForDungeon(dungeonId: string): Promise<StudyQuestEnemy[]> {
    const { data, error } = await this.getClient()
      .from('study_quest_enemies')
      .select('*')
      .eq('dungeon_id', dungeonId);

    if (error) {
      console.error('Failed to get enemies:', error);
      throw new Error(`Failed to get enemies: ${error.message}`);
    }

    return data.map((row) => StudyQuestEnemy.fromDatabase(row));
  }

  async getRandomEnemy(dungeonId: string, isBoss: boolean): Promise<StudyQuestEnemy | null> {
    const { data, error } = await this.getClient()
      .from('study_quest_enemies')
      .select('*')
      .eq('dungeon_id', dungeonId)
      .eq('is_boss', isBoss);

    if (error) {
      console.error('Failed to get random enemy:', error);
      throw new Error(`Failed to get random enemy: ${error.message}`);
    }

    if (data.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * data.length);
    return StudyQuestEnemy.fromDatabase(data[randomIndex]);
  }

  async startDungeonRun(characterId: string, dungeonId: string): Promise<DungeonRunState> {
    // Update character with current dungeon
    await this.updateCharacter({
      characterId,
      currentDungeonId: dungeonId,
      currentFloor: 1,
      lastActivityAt: new Date(),
    });

    return {
      dungeonId,
      currentFloor: 1,
      currentEncounter: 0,
      totalEncountersCleared: 0,
      startedAt: new Date(),
      enemiesDefeated: [],
      itemsFound: [],
      xpEarned: 0,
      goldEarned: 0,
    };
  }

  async saveDungeonProgress(characterId: string, state: DungeonRunState): Promise<void> {
    await this.updateCharacter({
      characterId,
      currentFloor: state.currentFloor,
      lastActivityAt: new Date(),
    });
  }

  async completeDungeonRun(characterId: string): Promise<StudyQuestCharacter> {
    const character = await this.getCharacter(characterId);
    if (!character) {
      throw new Error('Character not found');
    }

    return this.updateCharacter({
      characterId,
      currentDungeonId: null,
      currentFloor: 0,
      dungeonsCompleted: character.dungeonsCompleted + 1,
      highestDungeonFloor: Math.max(character.highestDungeonFloor, character.currentFloor),
      lastActivityAt: new Date(),
    });
  }

  async abandonDungeonRun(characterId: string): Promise<StudyQuestCharacter> {
    return this.updateCharacter({
      characterId,
      currentDungeonId: null,
      currentFloor: 0,
      lastActivityAt: new Date(),
    });
  }

  // ============================================================================
  // Combat Operations
  // ============================================================================

  async logCombat(record: CombatLogRecord): Promise<void> {
    const { error } = await this.getClient()
      .from('study_quest_combat_log')
      .insert({
        character_id: record.characterId,
        enemy_id: record.enemyId,
        dungeon_id: record.dungeonId,
        floor_number: record.floorNumber,
        result: record.result,
        damage_dealt: record.damageDealt,
        damage_taken: record.damageTaken,
        xp_earned: record.xpEarned,
        gold_earned: record.goldEarned,
        item_dropped_id: record.itemDroppedId,
        turns_taken: record.turnsTaken,
      });

    if (error) {
      console.error('Failed to log combat:', error);
      // Non-critical, don't throw
    }
  }

  async getCombatHistory(characterId: string, limit = 50): Promise<CombatLogRecord[]> {
    const { data, error } = await this.getClient()
      .from('study_quest_combat_log')
      .select('*')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to get combat history:', error);
      throw new Error(`Failed to get combat history: ${error.message}`);
    }

    return data.map((row) => ({
      characterId: row.character_id,
      enemyId: row.enemy_id,
      dungeonId: row.dungeon_id,
      floorNumber: row.floor_number,
      result: row.result,
      damageDealt: row.damage_dealt,
      damageTaken: row.damage_taken,
      xpEarned: row.xp_earned,
      goldEarned: row.gold_earned,
      itemDroppedId: row.item_dropped_id,
      turnsTaken: row.turns_taken,
    }));
  }

  async getBattleStats(characterId: string): Promise<{
    totalBattles: number;
    wins: number;
    losses: number;
    fled: number;
    totalDamageDealt: number;
    totalDamageTaken: number;
    totalXpEarned: number;
    totalGoldEarned: number;
  }> {
    const { data, error } = await this.getClient()
      .from('study_quest_combat_log')
      .select('result, damage_dealt, damage_taken, xp_earned, gold_earned')
      .eq('character_id', characterId);

    if (error) {
      console.error('Failed to get battle stats:', error);
      throw new Error(`Failed to get battle stats: ${error.message}`);
    }

    const stats = {
      totalBattles: data.length,
      wins: 0,
      losses: 0,
      fled: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      totalXpEarned: 0,
      totalGoldEarned: 0,
    };

    for (const row of data) {
      if (row.result === 'victory') stats.wins++;
      else if (row.result === 'defeat') stats.losses++;
      else if (row.result === 'fled') stats.fled++;

      stats.totalDamageDealt += row.damage_dealt || 0;
      stats.totalDamageTaken += row.damage_taken || 0;
      stats.totalXpEarned += row.xp_earned || 0;
      stats.totalGoldEarned += row.gold_earned || 0;
    }

    return stats;
  }

  // ============================================================================
  // Quest Operations
  // ============================================================================

  async getQuests(): Promise<StudyQuestQuest[]> {
    const { data, error } = await this.getClient()
      .from('study_quest_quests')
      .select('*')
      .order('quest_type', { ascending: true })
      .order('unlock_level', { ascending: true });

    if (error) {
      console.error('Failed to get quests:', error);
      throw new Error(`Failed to get quests: ${error.message}`);
    }

    return data.map((row) => StudyQuestQuest.fromDatabase(row));
  }

  async getQuestsWithProgress(characterId: string): Promise<QuestWithProgress[]> {
    const quests = await this.getQuests();
    const character = await this.getCharacter(characterId);

    if (!character) {
      throw new Error('Character not found');
    }

    // Get all progress for this character
    const { data: progressData, error } = await this.getClient()
      .from('study_quest_progress')
      .select('*')
      .eq('character_id', characterId);

    if (error) {
      console.error('Failed to get quest progress:', error);
      throw new Error(`Failed to get quest progress: ${error.message}`);
    }

    const progressMap = new Map(progressData.map((p) => [p.quest_id, p]));

    return quests.map((quest) => {
      const progressRow = progressMap.get(quest.id);
      const progress = progressRow ? QuestProgress.fromDatabase(progressRow) : null;

      return {
        quest: quest.toJSON(),
        progress: progress?.toJSON() ?? null,
        progressPercent: progress ? progress.getProgressPercent(quest) : 0,
        isAvailable: quest.isUnlockedForLevel(character.level),
      };
    });
  }

  async getActiveQuests(characterId: string): Promise<QuestWithProgress[]> {
    const allQuests = await this.getQuestsWithProgress(characterId);

    return allQuests.filter((q) => {
      // Daily/weekly that aren't completed yet
      if ((q.quest.questType === 'daily' || q.quest.questType === 'weekly') && !q.progress?.isCompleted) {
        return q.isAvailable;
      }
      // Story quests that aren't completed
      if (q.quest.questType === 'story' && !q.progress?.isCompleted) {
        return q.isAvailable;
      }
      return false;
    });
  }

  async initializeQuestProgress(characterId: string, questId: string): Promise<QuestProgress> {
    const { data, error } = await this.getClient()
      .from('study_quest_progress')
      .insert({
        character_id: characterId,
        quest_id: questId,
        current_progress: 0,
        is_completed: false,
        last_reset_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to initialize quest progress:', error);
      throw new Error(`Failed to initialize quest progress: ${error.message}`);
    }

    return QuestProgress.fromDatabase(data);
  }

  async updateQuestProgress(params: UpdateQuestProgressParams): Promise<QuestProgress> {
    // Get current progress
    let { data: current } = await this.getClient()
      .from('study_quest_progress')
      .select('*')
      .eq('character_id', params.characterId)
      .eq('quest_id', params.questId)
      .single();

    if (!current) {
      // Initialize if doesn't exist and use the result directly (no recursion)
      const initialProgress = await this.initializeQuestProgress(params.characterId, params.questId);
      // Re-fetch the created progress record to get the database row
      const { data: newCurrent } = await this.getClient()
        .from('study_quest_progress')
        .select('*')
        .eq('character_id', params.characterId)
        .eq('quest_id', params.questId)
        .single();

      if (!newCurrent) {
        throw new Error('Failed to initialize quest progress');
      }
      current = newCurrent;
    }

    const newProgress = current.current_progress + params.progressDelta;

    const { data, error } = await this.getClient()
      .from('study_quest_progress')
      .update({
        current_progress: newProgress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', current.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update quest progress:', error);
      throw new Error(`Failed to update quest progress: ${error.message}`);
    }

    return QuestProgress.fromDatabase(data);
  }

  async completeQuest(
    characterId: string,
    questId: string
  ): Promise<{ xpEarned: number; goldEarned: number; itemId?: string }> {
    // Get the quest
    const { data: questData, error: questError } = await this.getClient()
      .from('study_quest_quests')
      .select('*')
      .eq('id', questId)
      .single();

    if (questError || !questData) {
      throw new Error('Quest not found');
    }

    const quest = StudyQuestQuest.fromDatabase(questData);

    // Mark as completed
    await this.getClient()
      .from('study_quest_progress')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('character_id', characterId)
      .eq('quest_id', questId);

    // Add rewards
    if (quest.rewardXp > 0) {
      await this.addXp(characterId, quest.rewardXp);
    }

    if (quest.rewardGold > 0) {
      await this.addGold(characterId, quest.rewardGold);
    }

    if (quest.rewardItemId) {
      await this.addToInventory({
        characterId,
        itemId: quest.rewardItemId,
        quantity: 1,
      });
    }

    // Update quests completed count
    const character = await this.getCharacter(characterId);
    if (character) {
      await this.updateCharacter({
        characterId,
        questsCompleted: character.questsCompleted + 1,
      });
    }

    return {
      xpEarned: quest.rewardXp,
      goldEarned: quest.rewardGold,
      itemId: quest.rewardItemId,
    };
  }

  async resetDailyQuests(characterId: string): Promise<void> {
    // Get all daily quest IDs
    const { data: dailyQuests } = await this.getClient()
      .from('study_quest_quests')
      .select('id')
      .eq('quest_type', 'daily');

    if (!dailyQuests || dailyQuests.length === 0) return;

    const dailyQuestIds = dailyQuests.map((q) => q.id);

    // Reset progress for daily quests
    await this.getClient()
      .from('study_quest_progress')
      .update({
        current_progress: 0,
        is_completed: false,
        completed_at: null,
        last_reset_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('character_id', characterId)
      .in('quest_id', dailyQuestIds);
  }

  async resetWeeklyQuests(characterId: string): Promise<void> {
    // Get all weekly quest IDs
    const { data: weeklyQuests } = await this.getClient()
      .from('study_quest_quests')
      .select('id')
      .eq('quest_type', 'weekly');

    if (!weeklyQuests || weeklyQuests.length === 0) return;

    const weeklyQuestIds = weeklyQuests.map((q) => q.id);

    // Reset progress for weekly quests
    await this.getClient()
      .from('study_quest_progress')
      .update({
        current_progress: 0,
        is_completed: false,
        completed_at: null,
        last_reset_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('character_id', characterId)
      .in('quest_id', weeklyQuestIds);
  }

  // ============================================================================
  // Leaderboard Operations
  // ============================================================================

  async getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    const { data, error } = await this.getClient().rpc('study_quest_leaderboard', {
      p_limit: limit,
    });

    if (error) {
      console.error('Failed to get leaderboard:', error);
      throw new Error(`Failed to get leaderboard: ${error.message}`);
    }

    return data.map((row: {
      user_id: string;
      character_name: string;
      class_id: string;
      level: number;
      total_xp_earned: number;
      dungeons_completed: number;
      battles_won: number;
    }) => ({
      userId: row.user_id,
      characterName: row.character_name,
      classId: row.class_id as never,
      level: row.level,
      totalXpEarned: row.total_xp_earned,
      dungeonsCompleted: row.dungeons_completed,
      battlesWon: row.battles_won,
    }));
  }

  async getCharacterRank(characterId: string): Promise<number> {
    const character = await this.getCharacter(characterId);
    if (!character) {
      return -1;
    }

    // Count characters with higher level or same level but more XP
    const { count, error } = await this.getClient()
      .from('study_quest_characters')
      .select('*', { count: 'exact', head: true })
      .or(`level.gt.${character.level},and(level.eq.${character.level},total_xp_earned.gt.${character.totalXpEarned})`);

    if (error) {
      console.error('Failed to get character rank:', error);
      return -1;
    }

    return (count ?? 0) + 1;
  }
}
