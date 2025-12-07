/**
 * StudyQuestManager
 *
 * Manages the StudyQuest RPG mini-game in the renderer process.
 * Handles character management, dungeon runs, battles, quests, and study XP rewards.
 *
 * This manager coordinates between:
 * - IPC calls to main process for database operations
 * - Local state for active battles and dungeon runs
 * - UI updates and notifications
 */

import { createLogger } from '../../shared/logger.js';
import type { AuthManager } from './AuthManager.js';
import type { NotificationTicker } from '../components/NotificationTicker.js';
import { StudyQuestSound } from '../components/studyquest/StudyQuestSound.js';
import { LevelUpOverlay } from '../components/studyquest/LevelUpOverlay.js';
import { AchievementsManager } from './AchievementsManager.js';
import type {
  StudyQuestCharacterData,
  CharacterClass,
  CharacterClassData,
} from '../../domain/entities/StudyQuestCharacter.js';
import type { StudyQuestItemData, InventorySlot } from '../../domain/entities/StudyQuestItem.js';
import type {
  StudyQuestDungeonData,
  StudyQuestEnemyData,
  DungeonRunState,
} from '../../domain/entities/StudyQuestDungeon.js';
import type { StudyQuestBattleData, BattleAction, BattleLogEntry } from '../../domain/entities/StudyQuestBattle.js';
import type { QuestWithProgress } from '../../domain/entities/StudyQuestQuest.js';
import type { AddXpResult, LeaderboardEntry } from '../../domain/repositories/IStudyQuestRepository.js';

const logger = createLogger('StudyQuestManager');

// Local storage key for caching
const STORAGE_KEY = 'scribecat-studyquest-cache';

// XP rewards for study activities
const XP_PER_MINUTE_STUDIED = 2;
const XP_PER_AI_TOOL = 5;
const XP_PER_AI_CHAT = 3;
const XP_SESSION_COMPLETE_BONUS = 50;
const GOLD_PER_MINUTE_STUDIED = 1;
const GOLD_PER_AI_TOOL = 2;
const GOLD_PER_AI_CHAT = 1;
const GOLD_SESSION_COMPLETE_BONUS = 25;

// Item 10: Consolidated state interface
export interface StudyQuestState {
  character: StudyQuestCharacterData | null;
  inventory: InventorySlot[];
  dungeons: StudyQuestDungeonData[];
  activeQuests: QuestWithProgress[];
  currentBattle: StudyQuestBattleData | null;
  dungeonState: DungeonRunState | null;
  isLoading: boolean;
  error: string | null;
  // UI preferences (persisted via localStorage)
  selectedCatColor: 'brown' | 'orange' | 'grey' | 'black' | 'white';
}

export interface StudyRewardResult {
  xpEarned: number;
  goldEarned: number;
  leveledUp: boolean;
  newLevel?: number;
  questsProgressed: string[];
}

export class StudyQuestManager {
  private authManager: AuthManager;
  private notificationTicker: NotificationTicker | null = null;
  private achievementsManager: AchievementsManager;
  private levelUpOverlay: LevelUpOverlay;

  private state: StudyQuestState = {
    character: null,
    inventory: [],
    dungeons: [],
    activeQuests: [],
    currentBattle: null,
    dungeonState: null,
    isLoading: false,
    error: null,
    // Load saved color from localStorage or default to brown
    selectedCatColor: (localStorage.getItem('studyquest-cat-color') as StudyQuestState['selectedCatColor']) || 'brown',
  };

  private stateListeners: Set<(state: StudyQuestState) => void> = new Set();

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
    this.achievementsManager = new AchievementsManager();
    this.levelUpOverlay = new LevelUpOverlay();
    logger.info('StudyQuestManager initialized');
  }

  /**
   * Set notification ticker for showing rewards
   */
  setNotificationTicker(ticker: NotificationTicker): void {
    this.notificationTicker = ticker;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: StudyQuestState) => void): () => void {
    this.stateListeners.add(listener);
    // Immediately call with current state
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.stateListeners.forEach((listener) => listener(this.state));
  }

  /**
   * Update state and notify listeners
   */
  private setState(updates: Partial<StudyQuestState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  /**
   * Get current state
   */
  getState(): StudyQuestState {
    return { ...this.state };
  }

  // ============================================================================
  // Item 10: Consolidated Preferences
  // ============================================================================

  /**
   * Get selected cat color
   */
  getSelectedCatColor(): StudyQuestState['selectedCatColor'] {
    return this.state.selectedCatColor;
  }

  /**
   * Set selected cat color (persists to localStorage)
   */
  setSelectedCatColor(color: StudyQuestState['selectedCatColor']): void {
    this.state.selectedCatColor = color;
    localStorage.setItem('studyquest-cat-color', color);
    this.notifyListeners();
  }

  // ============================================================================
  // Character Management
  // ============================================================================

  /**
   * Load character for current user
   */
  async loadCharacter(): Promise<StudyQuestCharacterData | null> {
    const userId = this.authManager.getCurrentUser()?.id;
    logger.debug('loadCharacter called, userId:', userId);
    if (!userId) {
      logger.warn('Cannot load character: no user logged in');
      return null;
    }

    this.setState({ isLoading: true, error: null });

    try {
      logger.debug('Invoking studyquest:get-character for userId:', userId);
      const result = await window.scribeCat.invoke('studyquest:get-character', userId);
      logger.debug('studyquest:get-character result:', result);

      if (result.success) {
        this.setState({
          character: result.character,
          isLoading: false,
        });
        logger.info('Character loaded:', result.character?.name ?? 'none');
        return result.character;
      } else {
        logger.warn('loadCharacter failed:', result.error);
        this.setState({ isLoading: false, error: result.error });
        return null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to load character:', error);
      this.setState({ isLoading: false, error: message });
      return null;
    }
  }

  /**
   * Check if user has a character
   */
  hasCharacter(): boolean {
    return this.state.character !== null;
  }

  /**
   * Get available character classes
   */
  async getClasses(): Promise<CharacterClassData[]> {
    try {
      const result = await window.scribeCat.invoke('studyquest:get-classes');
      return result.success ? result.classes : [];
    } catch (error) {
      logger.error('Failed to get classes:', error);
      return [];
    }
  }

  /**
   * Create a new character
   * @param forceReplace If true, delete existing character first
   */
  async createCharacter(name: string, classId: CharacterClass, forceReplace = false): Promise<boolean> {
    const userId = this.authManager.getCurrentUser()?.id;
    if (!userId) {
      logger.warn('Cannot create character: no user logged in');
      this.showNotification('Please sign in to create a character', 'x');
      return false;
    }

    // If forceReplace, delete existing character first
    if (forceReplace) {
      logger.info('Force replacing character - deleting existing first');
      const deleted = await this.deleteCharacterByUser(userId);
      if (!deleted) {
        this.showNotification('Failed to delete existing character', 'x');
        return false;
      }
    }

    this.setState({ isLoading: true, error: null });

    try {
      const result = await window.scribeCat.invoke('studyquest:create-character', {
        userId,
        name,
        classId,
      });

      if (result.success) {
        this.setState({
          character: result.character,
          isLoading: false,
        });
        logger.info('Character created:', name);

        // Update achievements for character creation
        this.achievementsManager.updateStudyQuestProgress({ hasCharacter: true });

        this.showNotification(`Welcome, ${name}! Your adventure begins!`, 'sword');
        return true;
      } else {
        // Check if this is a duplicate character error
        const isDuplicate = result.error?.includes('duplicate key') ||
                           result.error?.includes('unique constraint');

        if (isDuplicate) {
          this.setState({ isLoading: false, error: 'character_exists' });
          // Return special value to indicate character exists
          return false;
        }

        this.setState({ isLoading: false, error: result.error });
        this.showNotification(result.error || 'Failed to create character', 'x');
        return false;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create character:', error);
      this.setState({ isLoading: false, error: message });
      this.showNotification(message, 'x');
      return false;
    }
  }

  /**
   * Delete character by user ID (used when character can't be loaded)
   */
  async deleteCharacterByUser(userId: string): Promise<boolean> {
    try {
      const result = await window.scribeCat.invoke('studyquest:delete-character-by-user', userId);
      if (result.success) {
        this.setState({
          character: null,
          inventory: [],
          activeQuests: [],
          currentBattle: null,
          dungeonState: null,
        });
        logger.info('Character deleted by user ID');
        return true;
      }
      logger.error('Failed to delete character:', result.error);
      return false;
    } catch (error) {
      logger.error('Failed to delete character by user:', error);
      return false;
    }
  }

  /**
   * Check if the last error was a duplicate character error
   */
  hasExistingCharacterError(): boolean {
    return this.state.error === 'character_exists';
  }

  /**
   * Delete character (reset progress)
   */
  async deleteCharacter(): Promise<boolean> {
    if (!this.state.character) return false;

    try {
      const result = await window.scribeCat.invoke(
        'studyquest:delete-character',
        this.state.character.id
      );

      if (result.success) {
        this.setState({
          character: null,
          inventory: [],
          activeQuests: [],
          currentBattle: null,
          dungeonState: null,
        });
        logger.info('Character deleted');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to delete character:', error);
      return false;
    }
  }

  // ============================================================================
  // Study Rewards Integration
  // ============================================================================

  /**
   * Award XP and gold for study activity
   * Called when study session ends or study milestones are reached
   */
  async awardStudyRewards(params: {
    studyTimeMinutes: number;
    aiToolsUsed: number;
    aiChatsUsed: number;
    sessionCompleted: boolean;
  }): Promise<StudyRewardResult | null> {
    if (!this.state.character) {
      logger.warn('Cannot award rewards: no character');
      return null;
    }

    // Calculate rewards
    let xpEarned = 0;
    let goldEarned = 0;

    xpEarned += params.studyTimeMinutes * XP_PER_MINUTE_STUDIED;
    xpEarned += params.aiToolsUsed * XP_PER_AI_TOOL;
    xpEarned += params.aiChatsUsed * XP_PER_AI_CHAT;

    goldEarned += params.studyTimeMinutes * GOLD_PER_MINUTE_STUDIED;
    goldEarned += params.aiToolsUsed * GOLD_PER_AI_TOOL;
    goldEarned += params.aiChatsUsed * GOLD_PER_AI_CHAT;

    if (params.sessionCompleted) {
      xpEarned += XP_SESSION_COMPLETE_BONUS;
      goldEarned += GOLD_SESSION_COMPLETE_BONUS;
    }

    // Apply class bonus
    if (this.state.character.classId === 'scholar') {
      xpEarned = Math.floor(xpEarned * 1.25);
    } else if (this.state.character.classId === 'knight') {
      goldEarned = Math.floor(goldEarned * 1.25);
    }

    // Round to integers
    xpEarned = Math.floor(xpEarned);
    goldEarned = Math.floor(goldEarned);

    if (xpEarned <= 0 && goldEarned <= 0) {
      return null;
    }

    try {
      // Add XP
      const xpResult = await window.scribeCat.invoke('studyquest:add-xp', {
        characterId: this.state.character.id,
        amount: xpEarned,
      });

      // Add gold
      const goldResult = await window.scribeCat.invoke('studyquest:add-gold', {
        characterId: this.state.character.id,
        amount: goldEarned,
      });

      if (xpResult.success && goldResult.success) {
        // Update local state
        this.setState({ character: goldResult.character });

        const result: StudyRewardResult = {
          xpEarned,
          goldEarned,
          leveledUp: xpResult.result.levelsGained > 0,
          newLevel: xpResult.result.levelsGained > 0 ? xpResult.result.newLevel : undefined,
          questsProgressed: [],
        };

        // Show notification or level-up overlay
        if (result.leveledUp && result.newLevel) {
          // Show full level-up overlay with GSAP animation
          const statIncreases = {
            hp: xpResult.result.hpGained || 10,
            attack: xpResult.result.attackGained || 2,
            defense: xpResult.result.defenseGained || 1,
            speed: xpResult.result.speedGained || 1,
          };
          const oldLevel = result.newLevel - xpResult.result.levelsGained;
          this.levelUpOverlay.show(oldLevel, result.newLevel, statIncreases);
        } else {
          StudyQuestSound.play('item-pickup');
          this.showNotification(
            `+${xpEarned} XP, +${goldEarned} Gold from studying!`,
            'sword'
          );
        }

        // Update quest progress for study-related quests
        await this.updateQuestProgress('study_time', params.studyTimeMinutes);
        await this.updateQuestProgress('ai_tools', params.aiToolsUsed);

        logger.info(`Study rewards: +${xpEarned} XP, +${goldEarned} Gold`);
        return result;
      }

      return null;
    } catch (error) {
      logger.error('Failed to award study rewards:', error);
      return null;
    }
  }

  // ============================================================================
  // Inventory & Shop
  // ============================================================================

  /**
   * Load inventory for current character
   */
  async loadInventory(): Promise<InventorySlot[]> {
    if (!this.state.character) return [];

    try {
      const result = await window.scribeCat.invoke(
        'studyquest:get-inventory',
        this.state.character.id
      );

      if (result.success) {
        this.setState({ inventory: result.inventory });
        return result.inventory;
      }
      return [];
    } catch (error) {
      logger.error('Failed to load inventory:', error);
      return [];
    }
  }

  /**
   * Get shop items
   */
  async getShopItems(): Promise<StudyQuestItemData[]> {
    try {
      const result = await window.scribeCat.invoke('studyquest:get-shop-items');
      return result.success ? result.items : [];
    } catch (error) {
      logger.error('Failed to get shop items:', error);
      return [];
    }
  }

  /**
   * Buy an item from the shop
   */
  async buyItem(itemId: string): Promise<boolean> {
    if (!this.state.character) return false;

    try {
      const result = await window.scribeCat.invoke('studyquest:buy-item', {
        characterId: this.state.character.id,
        itemId,
      });

      if (result.success) {
        this.setState({ character: result.character });
        await this.loadInventory();
        this.showNotification('Item purchased!', 'check');
        return true;
      } else {
        this.showNotification(result.error || 'Failed to buy item', 'x');
        return false;
      }
    } catch (error) {
      logger.error('Failed to buy item:', error);
      return false;
    }
  }

  /**
   * Equip an item
   */
  async equipItem(itemId: string): Promise<boolean> {
    if (!this.state.character) return false;

    try {
      const result = await window.scribeCat.invoke('studyquest:equip-item', {
        characterId: this.state.character.id,
        itemId,
      });

      if (result.success) {
        this.setState({ character: result.character });
        await this.loadInventory();
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to equip item:', error);
      return false;
    }
  }

  /**
   * Unequip an item (Item 2: Equipment System)
   */
  async unequipItem(itemId: string): Promise<boolean> {
    if (!this.state.character) return false;

    try {
      const result = await window.scribeCat.invoke('studyquest:unequip-item', {
        characterId: this.state.character.id,
        itemId,
      });

      if (result.success) {
        this.setState({ character: result.character });
        await this.loadInventory();
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to unequip item:', error);
      return false;
    }
  }

  /**
   * Drop an item from inventory (Item 2: Equipment System)
   */
  async dropItem(itemId: string): Promise<boolean> {
    if (!this.state.character) return false;

    try {
      const result = await window.scribeCat.invoke('studyquest:drop-item', {
        characterId: this.state.character.id,
        itemId,
      });

      if (result.success) {
        await this.loadInventory();
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to drop item:', error);
      return false;
    }
  }

  /**
   * Use a consumable item
   */
  async useItem(itemId: string): Promise<{ type: string; value: number } | null> {
    if (!this.state.character) return null;

    try {
      const result = await window.scribeCat.invoke('studyquest:use-item', {
        characterId: this.state.character.id,
        itemId,
      });

      if (result.success) {
        this.setState({ character: result.character });
        await this.loadInventory();
        return result.effect || null;
      }
      return null;
    } catch (error) {
      logger.error('Failed to use item:', error);
      return null;
    }
  }

  /**
   * Use an item during battle
   * Applies the item effect and performs the battle action
   */
  async useItemInBattle(itemId: string): Promise<boolean> {
    if (!this.state.character || !this.state.currentBattle) {
      logger.warn('Cannot use item in battle: no character or battle');
      return false;
    }

    // Find the item in inventory
    const slot = this.state.inventory.find((s) => s.item.id === itemId);
    if (!slot || slot.item.itemType !== 'consumable') {
      logger.warn('Item not found or not consumable:', itemId);
      return false;
    }

    // Get healing effect from item
    const healing = slot.item.healAmount || 0;
    if (healing <= 0) {
      logger.warn('Item has no healing effect:', itemId);
      return false;
    }

    // Execute battle action with item effect
    const result = await this.battleAction('item', { healing });
    if (!result) {
      return false;
    }

    // Decrement item quantity (use the item)
    await this.useItem(itemId);

    return true;
  }

  /**
   * Get consumable items available for battle
   */
  getConsumableItems(): InventorySlot[] {
    return this.state.inventory.filter(
      (slot) => slot.item.itemType === 'consumable' && slot.quantity > 0
    );
  }

  // ============================================================================
  // Dungeons
  // ============================================================================

  /**
   * Load available dungeons
   */
  async loadDungeons(): Promise<StudyQuestDungeonData[]> {
    const level = this.state.character?.level ?? 1;

    try {
      const result = await window.scribeCat.invoke('studyquest:get-dungeons', level);
      if (result.success) {
        this.setState({ dungeons: result.dungeons });
        return result.dungeons;
      }
      return [];
    } catch (error) {
      logger.error('Failed to load dungeons:', error);
      return [];
    }
  }

  /**
   * Start a dungeon run
   */
  async startDungeon(dungeonId: string): Promise<boolean> {
    if (!this.state.character) return false;

    try {
      const result = await window.scribeCat.invoke('studyquest:start-dungeon', {
        characterId: this.state.character.id,
        dungeonId,
      });

      if (result.success) {
        this.setState({ dungeonState: result.dungeonState });
        this.showNotification(`Entering ${result.dungeon.name}...`, 'sword');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to start dungeon:', error);
      return false;
    }
  }

  /**
   * Abandon current dungeon run
   */
  async abandonDungeon(): Promise<boolean> {
    if (!this.state.character) return false;

    try {
      const result = await window.scribeCat.invoke(
        'studyquest:abandon-dungeon',
        this.state.character.id
      );

      if (result.success) {
        this.setState({
          character: result.character,
          dungeonState: null,
          currentBattle: null,
        });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to abandon dungeon:', error);
      return false;
    }
  }

  /**
   * Complete current dungeon run (after defeating boss on final floor)
   * Returns dungeon completion rewards
   */
  async completeDungeon(): Promise<{
    success: boolean;
    xpBonus: number;
    goldBonus: number;
    dungeonName: string;
  } | null> {
    if (!this.state.character || !this.state.dungeonState) return null;

    const dungeonState = this.state.dungeonState;
    const dungeon = this.state.dungeons.find((d) => d.id === dungeonState.dungeonId);
    const dungeonName = dungeon?.name || 'Unknown Dungeon';

    try {
      const result = await window.scribeCat.invoke(
        'studyquest:complete-dungeon',
        this.state.character.id
      );

      if (result.success) {
        // Calculate completion bonuses based on dungeon difficulty
        const baseXpBonus = 100;
        const baseGoldBonus = 50;
        const floorMultiplier = dungeonState.currentFloor;
        const xpBonus = baseXpBonus * floorMultiplier;
        const goldBonus = baseGoldBonus * floorMultiplier;

        // Add XP bonus for dungeon completion
        const xpResult = await window.scribeCat.invoke('studyquest:add-xp', {
          characterId: this.state.character.id,
          amount: xpBonus,
        });

        // Add gold bonus for dungeon completion
        const goldResult = await window.scribeCat.invoke('studyquest:add-gold', {
          characterId: this.state.character.id,
          amount: goldBonus,
        });

        // Update quest progress for dungeon completion
        await this.updateQuestProgress('dungeon_complete', 1);

        // Use the latest character data
        const updatedCharacter = goldResult.success ? goldResult.character : result.character;

        this.setState({
          character: updatedCharacter,
          dungeonState: null,
          currentBattle: null,
        });

        // Check for level up
        if (xpResult.success && xpResult.result?.levelsGained > 0) {
          const statIncreases = {
            hp: xpResult.result.hpGained || 10,
            attack: xpResult.result.attackGained || 2,
            defense: xpResult.result.defenseGained || 1,
            speed: xpResult.result.speedGained || 1,
          };
          const oldLevel = xpResult.result.newLevel - xpResult.result.levelsGained;
          this.levelUpOverlay.show(oldLevel, xpResult.result.newLevel, statIncreases);
        } else {
          this.showNotification(`${dungeonName} Complete! +${xpBonus} XP, +${goldBonus} Gold`, 'crown');
        }

        StudyQuestSound.play('level-up');

        logger.info(`Dungeon completed: ${dungeonName}`);
        return { success: true, xpBonus, goldBonus, dungeonName };
      }
      return null;
    } catch (error) {
      logger.error('Failed to complete dungeon:', error);
      return null;
    }
  }

  /**
   * Check if current dungeon run is on the final floor
   */
  isOnFinalFloor(): boolean {
    if (!this.state.dungeonState) return false;
    const dungeon = this.state.dungeons.find((d) => d.id === this.state.dungeonState?.dungeonId);
    if (!dungeon) return false;
    return this.state.dungeonState.currentFloor >= dungeon.floorCount;
  }

  /**
   * Get current dungeon data
   */
  getCurrentDungeon(): StudyQuestDungeonData | null {
    if (!this.state.dungeonState) return null;
    return this.state.dungeons.find((d) => d.id === this.state.dungeonState?.dungeonId) || null;
  }

  // ============================================================================
  // Battles
  // ============================================================================

  /**
   * Start a battle encounter
   */
  async startBattle(isBoss: boolean = false): Promise<StudyQuestBattleData | null> {
    if (!this.state.character || !this.state.dungeonState) return null;

    try {
      const result = await window.scribeCat.invoke('studyquest:start-battle', {
        characterId: this.state.character.id,
        dungeonId: this.state.dungeonState.dungeonId,
        floorNumber: this.state.dungeonState.currentFloor,
        isBoss,
      });

      if (result.success) {
        this.setState({ currentBattle: result.battle });
        return result.battle;
      }
      return null;
    } catch (error) {
      logger.error('Failed to start battle:', error);
      return null;
    }
  }

  /**
   * Execute a battle action
   */
  async battleAction(
    action: BattleAction,
    itemEffect?: { healing: number }
  ): Promise<{
    battle: StudyQuestBattleData;
    playerLog: BattleLogEntry;
    enemyLog: BattleLogEntry | null;
  } | null> {
    if (!this.state.currentBattle) return null;

    try {
      const result = await window.scribeCat.invoke('studyquest:battle-action', {
        battleId: this.state.currentBattle.id,
        action,
        itemEffect,
      });

      if (result.success) {
        this.setState({
          currentBattle: result.battle,
          character: result.character,
        });

        // Handle battle end
        if (result.battle.result !== 'in_progress') {
          if (result.battle.result === 'victory') {
            const rewards = result.battle.rewards;
            if (rewards) {
              this.showNotification(
                `Victory! +${rewards.xp} XP, +${rewards.gold} Gold`,
                'star'
              );
            }
            // Update quest progress
            await this.updateQuestProgress('battles_won', 1);

            // Update achievements with current character stats
            if (result.character) {
              this.achievementsManager.updateStudyQuestProgress({
                level: result.character.level,
                totalGold: result.character.gold,
                battlesWon: result.character.battlesWon,
              });
            }
          } else if (result.battle.result === 'defeat') {
            this.showNotification('Defeated! Lost 25% gold...', 'x');
          }

          // Clear battle state after a delay
          setTimeout(() => {
            this.setState({ currentBattle: null });
          }, 2000);
        }

        return {
          battle: result.battle,
          playerLog: result.playerLog,
          enemyLog: result.enemyLog,
        };
      }
      return null;
    } catch (error) {
      logger.error('Failed to execute battle action:', error);
      return null;
    }
  }

  // ============================================================================
  // Quests
  // ============================================================================

  /**
   * Load active quests
   */
  async loadActiveQuests(): Promise<QuestWithProgress[]> {
    if (!this.state.character) return [];

    try {
      const result = await window.scribeCat.invoke(
        'studyquest:get-active-quests',
        this.state.character.id
      );

      if (result.success) {
        this.setState({ activeQuests: result.quests });
        return result.quests;
      }
      return [];
    } catch (error) {
      logger.error('Failed to load quests:', error);
      return [];
    }
  }

  /**
   * Update quest progress
   */
  private async updateQuestProgress(
    requirementType: string,
    progressDelta: number
  ): Promise<void> {
    if (!this.state.character) return;

    // Find quests that match this requirement type
    const matchingQuests = this.state.activeQuests.filter(
      (q) => q.quest.requirementType === requirementType && !q.progress?.isCompleted
    );

    for (const quest of matchingQuests) {
      try {
        await window.scribeCat.invoke('studyquest:update-quest-progress', {
          characterId: this.state.character.id,
          questId: quest.quest.id,
          progressDelta,
        });
      } catch (error) {
        logger.error('Failed to update quest progress:', error);
      }
    }

    // Reload quests to check for completions
    await this.loadActiveQuests();
  }

  /**
   * Complete a quest and claim rewards
   */
  async completeQuest(questId: string): Promise<boolean> {
    if (!this.state.character) return false;

    try {
      const result = await window.scribeCat.invoke('studyquest:complete-quest', {
        characterId: this.state.character.id,
        questId,
      });

      if (result.success) {
        this.setState({ character: result.character });
        await this.loadActiveQuests();

        // Update achievements with quest completion
        if (result.character) {
          this.achievementsManager.updateStudyQuestProgress({
            questsCompleted: result.character.questsCompleted || 0,
            level: result.character.level,
            totalGold: result.character.gold,
          });
        }

        this.showNotification(
          `Quest Complete! +${result.rewards.xpEarned} XP, +${result.rewards.goldEarned} Gold`,
          'check'
        );
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to complete quest:', error);
      return false;
    }
  }

  // ============================================================================
  // Leaderboard
  // ============================================================================

  /**
   * Get global leaderboard
   */
  async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    try {
      const result = await window.scribeCat.invoke('studyquest:get-leaderboard', limit);
      return result.success ? result.leaderboard : [];
    } catch (error) {
      logger.error('Failed to get leaderboard:', error);
      return [];
    }
  }

  /**
   * Get current character's rank
   */
  async getRank(): Promise<number> {
    if (!this.state.character) return -1;

    try {
      const result = await window.scribeCat.invoke(
        'studyquest:get-rank',
        this.state.character.id
      );
      return result.success ? result.rank : -1;
    } catch (error) {
      logger.error('Failed to get rank:', error);
      return -1;
    }
  }

  // ============================================================================
  // Stats
  // ============================================================================

  /**
   * Get battle statistics
   */
  async getBattleStats(): Promise<{
    totalBattles: number;
    wins: number;
    losses: number;
    fled: number;
    totalDamageDealt: number;
    totalDamageTaken: number;
    totalXpEarned: number;
    totalGoldEarned: number;
  } | null> {
    if (!this.state.character) return null;

    try {
      const result = await window.scribeCat.invoke(
        'studyquest:get-battle-stats',
        this.state.character.id
      );
      return result.success ? result.stats : null;
    } catch (error) {
      logger.error('Failed to get battle stats:', error);
      return null;
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Show a notification
   */
  private showNotification(message: string, icon: string): void {
    if (this.notificationTicker) {
      // Map StudyQuest icons to notification types
      const iconToType: Record<string, 'success' | 'error' | 'warning' | 'info'> = {
        sword: 'info',
        check: 'success',
        heart: 'success',
        gold: 'warning',
        x: 'error',
      };
      const type = iconToType[icon] || 'info';

      this.notificationTicker.show({
        message,
        type,
        duration: 3000,
      });
    }
    logger.info(`[Notification] ${message}`);
  }

  /**
   * Heal character at inn (costs gold based on HP missing)
   * @param cost - Gold cost for healing (0.5 gold per HP)
   */
  async healCharacter(cost: number = 0): Promise<boolean> {
    if (!this.state.character) return false;

    // Check if enough gold
    if (cost > 0 && this.state.character.gold < cost) {
      this.showNotification('Not enough gold!', 'gold');
      return false;
    }

    try {
      const result = await window.scribeCat.invoke(
        'studyquest:heal-character',
        {
          characterId: this.state.character.id,
          cost,
        }
      );

      if (result.success) {
        this.setState({ character: result.character });
        StudyQuestSound.play('heal');
        this.showNotification('Fully healed!', 'heart');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to heal character:', error);
      return false;
    }
  }

  /**
   * Calculate inn healing cost (0.5 gold per HP missing)
   */
  getInnHealingCost(): { missingHp: number; cost: number } | null {
    if (!this.state.character) return null;

    const missingHp = this.state.character.maxHp - this.state.character.hp;
    const cost = Math.ceil(missingHp * 0.5);

    return { missingHp, cost };
  }

  /**
   * Award gold directly (e.g., from dungeon chests)
   */
  async awardGold(amount: number): Promise<boolean> {
    if (!this.state.character || amount <= 0) return false;

    try {
      const result = await window.scribeCat.invoke(
        'studyquest:award-gold',
        {
          characterId: this.state.character.id,
          amount,
        }
      );

      if (result.success) {
        this.setState({ character: result.character });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to award gold:', error);
      // Fallback: update local state
      this.state.character.gold += amount;
      this.state.character.totalGoldEarned = (this.state.character.totalGoldEarned || 0) + amount;
      this.notifyListeners();
      return true;
    }
  }

  /**
   * Take damage directly (e.g., from dungeon traps)
   */
  async takeDamage(amount: number): Promise<boolean> {
    if (!this.state.character || amount <= 0) return false;

    try {
      const result = await window.scribeCat.invoke(
        'studyquest:take-damage',
        {
          characterId: this.state.character.id,
          amount,
        }
      );

      if (result.success) {
        this.setState({ character: result.character });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to apply damage:', error);
      // Fallback: update local state
      this.state.character.hp = Math.max(0, this.state.character.hp - amount);
      this.notifyListeners();
      return true;
    }
  }

  /**
   * Heal character directly by a specific amount (e.g., from dungeon rest points)
   */
  async healCharacterDirect(amount: number): Promise<boolean> {
    if (!this.state.character || amount <= 0) return false;

    try {
      const result = await window.scribeCat.invoke(
        'studyquest:heal-direct',
        {
          characterId: this.state.character.id,
          amount,
        }
      );

      if (result.success) {
        this.setState({ character: result.character });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to heal character:', error);
      // Fallback: update local state
      this.state.character.hp = Math.min(this.state.character.maxHp, this.state.character.hp + amount);
      this.notifyListeners();
      return true;
    }
  }

  /**
   * Full initialization - load all data
   */
  async initialize(): Promise<void> {
    logger.info('Initializing StudyQuestManager...');

    const character = await this.loadCharacter();
    if (character) {
      await Promise.all([
        this.loadInventory(),
        this.loadDungeons(),
        this.loadActiveQuests(),
      ]);
    }

    logger.info('StudyQuestManager initialization complete');
  }

  /**
   * Cleanup on logout
   */
  cleanup(): void {
    this.setState({
      character: null,
      inventory: [],
      dungeons: [],
      activeQuests: [],
      currentBattle: null,
      dungeonState: null,
      isLoading: false,
      error: null,
    });
    logger.info('StudyQuestManager cleaned up');
  }
}
