/**
 * StudyQuest Repository Interface
 *
 * Defines operations for managing StudyQuest RPG game state:
 * characters, inventory, dungeons, battles, and quests.
 */

import {
  StudyQuestCharacter,
  CharacterClass,
  CharacterClassData,
} from '../entities/StudyQuestCharacter.js';
import { StudyQuestItem, InventorySlot } from '../entities/StudyQuestItem.js';
import {
  StudyQuestDungeon,
  StudyQuestEnemy,
  DungeonRunState,
} from '../entities/StudyQuestDungeon.js';
import { StudyQuestQuest, QuestProgress, QuestWithProgress } from '../entities/StudyQuestQuest.js';
import { CombatLogRecord } from '../entities/StudyQuestBattle.js';

// ============================================================================
// Parameter Interfaces
// ============================================================================

export interface CreateCharacterParams {
  userId: string;
  name: string;
  classId: CharacterClass;
}

export interface UpdateCharacterParams {
  characterId: string;
  hp?: number;
  gold?: number;
  equippedWeaponId?: string | null;
  equippedArmorId?: string | null;
  equippedAccessoryId?: string | null;
  currentDungeonId?: string | null;
  currentFloor?: number;
  battlesWon?: number;
  battlesLost?: number;
  dungeonsCompleted?: number;
  questsCompleted?: number;
  highestDungeonFloor?: number;
  lastDailyRewardAt?: Date;
  lastActivityAt?: Date;
}

export interface AddXpResult {
  newLevel: number;
  newXp: number;
  levelsGained: number;
  hpGained: number;
  attackGained: number;
  defenseGained: number;
  speedGained: number;
}

export interface InventoryOperationParams {
  characterId: string;
  itemId: string;
  quantity?: number;
}

export interface UpdateQuestProgressParams {
  characterId: string;
  questId: string;
  progressDelta: number;
}

export interface LeaderboardEntry {
  userId: string;
  characterName: string;
  classId: CharacterClass;
  level: number;
  totalXpEarned: number;
  dungeonsCompleted: number;
  battlesWon: number;
}

// ============================================================================
// Repository Interface
// ============================================================================

export interface IStudyQuestRepository {
  // ============================================================================
  // Character Operations
  // ============================================================================

  /**
   * Get all available character classes
   */
  getClasses(): Promise<CharacterClassData[]>;

  /**
   * Create a new character for a user
   */
  createCharacter(params: CreateCharacterParams): Promise<StudyQuestCharacter>;

  /**
   * Get a character by user ID
   */
  getCharacterByUserId(userId: string): Promise<StudyQuestCharacter | null>;

  /**
   * Get a character by ID
   */
  getCharacter(characterId: string): Promise<StudyQuestCharacter | null>;

  /**
   * Update character fields
   */
  updateCharacter(params: UpdateCharacterParams): Promise<StudyQuestCharacter>;

  /**
   * Add XP to a character (handles level ups)
   */
  addXp(characterId: string, amount: number): Promise<AddXpResult>;

  /**
   * Add gold to a character
   */
  addGold(characterId: string, amount: number): Promise<StudyQuestCharacter>;

  /**
   * Spend gold (returns false if insufficient funds)
   */
  spendGold(characterId: string, amount: number): Promise<boolean>;

  /**
   * Heal character to full HP
   */
  healCharacter(characterId: string): Promise<StudyQuestCharacter>;

  /**
   * Update character HP after battle
   */
  updateHp(characterId: string, newHp: number): Promise<StudyQuestCharacter>;

  /**
   * Delete a character
   */
  deleteCharacter(characterId: string): Promise<void>;

  // ============================================================================
  // Inventory Operations
  // ============================================================================

  /**
   * Get all items (for shop display)
   */
  getItems(): Promise<StudyQuestItem[]>;

  /**
   * Get purchasable items for shop
   */
  getShopItems(): Promise<StudyQuestItem[]>;

  /**
   * Get an item by ID
   */
  getItem(itemId: string): Promise<StudyQuestItem | null>;

  /**
   * Get an item by its item_key (e.g., 'wooden_sword')
   */
  getItemByKey(itemKey: string): Promise<StudyQuestItem | null>;

  /**
   * Get item keys for given item UUIDs
   * Used to convert stored UUIDs back to item keys for the game
   */
  getItemKeysByIds(itemIds: string[]): Promise<Map<string, string>>;

  /**
   * Get a character's inventory
   */
  getInventory(characterId: string): Promise<InventorySlot[]>;

  /**
   * Add an item to inventory
   */
  addToInventory(params: InventoryOperationParams): Promise<InventorySlot>;

  /**
   * Remove an item from inventory
   */
  removeFromInventory(params: InventoryOperationParams): Promise<boolean>;

  /**
   * Use a consumable item
   */
  useItem(characterId: string, itemId: string): Promise<{
    success: boolean;
    effect?: { type: string; value: number };
  }>;

  /**
   * Equip an item
   */
  equipItem(characterId: string, itemId: string): Promise<StudyQuestCharacter>;

  /**
   * Unequip an item
   */
  unequipItem(
    characterId: string,
    slot: 'weapon' | 'armor' | 'accessory'
  ): Promise<StudyQuestCharacter>;

  // ============================================================================
  // Dungeon Operations
  // ============================================================================

  /**
   * Get all dungeons
   */
  getDungeons(): Promise<StudyQuestDungeon[]>;

  /**
   * Get dungeons available for a character's level
   */
  getAvailableDungeons(characterLevel: number): Promise<StudyQuestDungeon[]>;

  /**
   * Get a dungeon by ID
   */
  getDungeon(dungeonId: string): Promise<StudyQuestDungeon | null>;

  /**
   * Get enemies for a dungeon
   */
  getEnemiesForDungeon(dungeonId: string): Promise<StudyQuestEnemy[]>;

  /**
   * Get a random enemy for encounter
   */
  getRandomEnemy(dungeonId: string, isBoss: boolean): Promise<StudyQuestEnemy | null>;

  /**
   * Start a dungeon run
   */
  startDungeonRun(characterId: string, dungeonId: string): Promise<DungeonRunState>;

  /**
   * Save dungeon run progress
   */
  saveDungeonProgress(characterId: string, state: DungeonRunState): Promise<void>;

  /**
   * Complete a dungeon run
   */
  completeDungeonRun(characterId: string): Promise<StudyQuestCharacter>;

  /**
   * Abandon a dungeon run
   */
  abandonDungeonRun(characterId: string): Promise<StudyQuestCharacter>;

  // ============================================================================
  // Combat Operations
  // ============================================================================

  /**
   * Log a completed battle
   */
  logCombat(record: CombatLogRecord): Promise<void>;

  /**
   * Get combat history for a character
   */
  getCombatHistory(characterId: string, limit?: number): Promise<CombatLogRecord[]>;

  /**
   * Get battle statistics for a character
   */
  getBattleStats(characterId: string): Promise<{
    totalBattles: number;
    wins: number;
    losses: number;
    fled: number;
    totalDamageDealt: number;
    totalDamageTaken: number;
    totalXpEarned: number;
    totalGoldEarned: number;
  }>;

  // ============================================================================
  // Quest Operations
  // ============================================================================

  /**
   * Get all quests
   */
  getQuests(): Promise<StudyQuestQuest[]>;

  /**
   * Get quests with progress for a character
   */
  getQuestsWithProgress(characterId: string): Promise<QuestWithProgress[]>;

  /**
   * Get active quests for a character (daily/weekly not completed)
   */
  getActiveQuests(characterId: string): Promise<QuestWithProgress[]>;

  /**
   * Initialize quest progress for a character
   */
  initializeQuestProgress(characterId: string, questId: string): Promise<QuestProgress>;

  /**
   * Update quest progress
   */
  updateQuestProgress(params: UpdateQuestProgressParams): Promise<QuestProgress>;

  /**
   * Complete a quest and claim rewards
   */
  completeQuest(
    characterId: string,
    questId: string
  ): Promise<{
    xpEarned: number;
    goldEarned: number;
    itemId?: string;
  }>;

  /**
   * Reset daily quests for a character
   */
  resetDailyQuests(characterId: string): Promise<void>;

  /**
   * Reset weekly quests for a character
   */
  resetWeeklyQuests(characterId: string): Promise<void>;

  // ============================================================================
  // Leaderboard Operations
  // ============================================================================

  /**
   * Get global leaderboard
   */
  getLeaderboard(limit?: number): Promise<LeaderboardEntry[]>;

  /**
   * Get a character's rank
   */
  getCharacterRank(characterId: string): Promise<number>;

  // NOTE: Realtime subscriptions are handled directly in the renderer process
  // via RendererSupabaseClient (WebSockets don't work in Electron's main process).
  // See StudyQuestManager for subscription implementation.
}
