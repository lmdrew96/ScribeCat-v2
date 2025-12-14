/**
 * StudyQuestManager
 *
 * Manages StudyQuest integration in the renderer process.
 * Handles:
 * - Character state coordination between game and backend
 * - Study session reward integration
 * - Achievement tracking for StudyQuest milestones
 * - Game lifecycle management (pause/resume)
 *
 * NOTE: Realtime subscriptions are handled directly in the renderer via
 * RendererSupabaseClient (WebSockets don't work in Electron's main process).
 */

import { createLogger } from '../../shared/logger.js';
import { RendererSupabaseClient } from '../services/RendererSupabaseClient.js';
import { notificationTicker } from './NotificationTicker.js';
import type { RealtimeChannel } from '@supabase/supabase-js';

const logger = createLogger('StudyQuestManager');

// Reward configuration for study activities
const REWARDS = {
  // Recording sessions
  SESSION_COMPLETE_MIN_MINUTES: 15,
  SESSION_XP: 50,
  SESSION_GOLD: 25,

  // AI feature usage
  POLISH_XP: 20,
  SUMMARY_XP: 30,
  EXPORT_XP: 15,

  // Study mode engagement
  STUDY_MODE_PER_10_MIN_XP: 10,
} as const;

export interface StudyQuestCharacterState {
  id: string;
  userId: string;
  name: string;
  level: number;
  xp: number;
  gold: number;
  hp: number;
  maxHp: number;
}

export type CharacterChangeListener = (character: StudyQuestCharacterState | null) => void;
export type RewardListener = (reward: { xp: number; gold: number; reason: string }) => void;
export type QuestCompleteListener = (quest: { questId: string; questName: string; rewardXp: number; rewardGold: number }) => void;

// Quest data for notifications
interface QuestData {
  id: string;
  name: string;
  description?: string;
  reward_xp: number;
  reward_gold: number;
  quest_type: string;
}

/**
 * StudyQuestManager - Manages StudyQuest integration in renderer
 */
export class StudyQuestManager {
  private currentUserId: string | null = null;
  private character: StudyQuestCharacterState | null = null;
  private realtimeChannel: RealtimeChannel | null = null;
  private questProgressChannel: RealtimeChannel | null = null;

  private characterListeners: Set<CharacterChangeListener> = new Set();
  private rewardListeners: Set<RewardListener> = new Set();
  private questCompleteListeners: Set<QuestCompleteListener> = new Set();

  // Cache quest data for notifications
  private questCache: Map<string, QuestData> = new Map();

  // Track session for rewards
  private sessionStartTime: number | null = null;
  private studyModeStartTime: number | null = null;

  // Prevent duplicate reward claims
  private pendingRewards: Set<string> = new Set();

  constructor() {
    logger.info('StudyQuestManager initialized');
  }

  /**
   * Initialize with current user
   */
  async initialize(userId: string): Promise<void> {
    this.currentUserId = userId;
    await this.loadCharacter();
    await this.loadQuestCache();
    await this.subscribeToCharacterUpdates();
    await this.subscribeToQuestProgress();
    logger.info('StudyQuestManager initialized for user', { userId });
  }

  /**
   * Clean up when user logs out
   */
  async cleanup(): Promise<void> {
    await this.unsubscribe();
    this.currentUserId = null;
    this.character = null;
    this.sessionStartTime = null;
    this.studyModeStartTime = null;
    this.pendingRewards.clear();
    this.questCache.clear();
    this.notifyCharacterListeners();
    logger.info('StudyQuestManager cleaned up');
  }

  // ============================================================================
  // Character Management
  // ============================================================================

  /**
   * Load character from backend
   */
  async loadCharacter(): Promise<StudyQuestCharacterState | null> {
    if (!this.currentUserId) return null;

    try {
      const ipc = window.electronAPI;
      if (!ipc?.invoke) return null;

      const result = await ipc.invoke('studyquest:get-character', this.currentUserId) as {
        success: boolean;
        character?: StudyQuestCharacterState;
        error?: string;
      };

      if (result.success && result.character) {
        this.character = result.character;
        this.notifyCharacterListeners();
        return this.character;
      }

      return null;
    } catch (err) {
      logger.error('Failed to load character', err);
      return null;
    }
  }

  /**
   * Get current character state
   */
  getCharacter(): StudyQuestCharacterState | null {
    return this.character;
  }

  /**
   * Check if user has a character
   */
  hasCharacter(): boolean {
    return this.character !== null;
  }

  /**
   * Load quest data into cache for notifications
   */
  private async loadQuestCache(): Promise<void> {
    try {
      const client = RendererSupabaseClient.getInstance().getClient();
      const { data, error } = await client
        .from('study_quest_quests')
        .select('id, name, description, reward_xp, reward_gold, quest_type');

      if (error) {
        logger.error('Failed to load quest cache', error);
        return;
      }

      this.questCache.clear();
      for (const quest of data || []) {
        this.questCache.set(quest.id, quest as QuestData);
      }
      logger.debug(`Loaded ${this.questCache.size} quests into cache`);
    } catch (err) {
      logger.error('Failed to load quest cache', err);
    }
  }

  // ============================================================================
  // Realtime Subscriptions
  // ============================================================================

  /**
   * Subscribe to character updates via Supabase Realtime
   */
  private async subscribeToCharacterUpdates(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const client = RendererSupabaseClient.getInstance().getClient();

      this.realtimeChannel = client
        .channel(`studyquest-character-${this.currentUserId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'study_quest_characters',
            filter: `user_id=eq.${this.currentUserId}`,
          },
          (payload) => {
            logger.debug('Character update received', payload);
            // Update local state with new data
            if (payload.new) {
              this.character = this.mapDbToCharacter(payload.new);
              this.notifyCharacterListeners();
            }
          }
        )
        .subscribe((status) => {
          logger.info('Character subscription status', { status });
        });
    } catch (err) {
      logger.error('Failed to subscribe to character updates', err);
    }
  }

  /**
   * Subscribe to quest progress updates to show completion notifications
   */
  private async subscribeToQuestProgress(): Promise<void> {
    if (!this.character) return;

    try {
      const client = RendererSupabaseClient.getInstance().getClient();

      this.questProgressChannel = client
        .channel(`studyquest-quests-${this.character.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'study_quest_progress',
            filter: `character_id=eq.${this.character.id}`,
          },
          (payload) => {
            // Check if quest was just completed
            const oldCompleted = (payload.old as Record<string, unknown>)?.is_completed;
            const newCompleted = (payload.new as Record<string, unknown>)?.is_completed;
            const questId = (payload.new as Record<string, unknown>)?.quest_id as string;

            if (!oldCompleted && newCompleted && questId) {
              this.handleQuestCompletion(questId);
            }
          }
        )
        .subscribe((status) => {
          logger.info('Quest progress subscription status', { status });
        });
    } catch (err) {
      logger.error('Failed to subscribe to quest progress', err);
    }
  }

  /**
   * Handle quest completion - show notification and notify listeners
   */
  private handleQuestCompletion(questId: string): void {
    const quest = this.questCache.get(questId);
    if (!quest) {
      logger.warn('Quest not found in cache for notification', { questId });
      return;
    }

    // Show notification via NotificationTicker
    const rewardText = [];
    if (quest.reward_xp > 0) rewardText.push(`+${quest.reward_xp} XP`);
    if (quest.reward_gold > 0) rewardText.push(`+${quest.reward_gold} Gold`);
    const rewards = rewardText.length > 0 ? ` (${rewardText.join(', ')})` : '';

    notificationTicker.success(`Quest Complete: ${quest.name}${rewards}`, 6000);
    logger.info('Quest completed', { questId, questName: quest.name });

    // Notify listeners
    this.notifyQuestCompleteListeners({
      questId,
      questName: quest.name,
      rewardXp: quest.reward_xp,
      rewardGold: quest.reward_gold,
    });
  }

  /**
   * Unsubscribe from realtime updates
   */
  private async unsubscribe(): Promise<void> {
    if (this.realtimeChannel) {
      try {
        await this.realtimeChannel.unsubscribe();
        this.realtimeChannel = null;
      } catch (err) {
        logger.error('Failed to unsubscribe from character channel', err);
      }
    }

    if (this.questProgressChannel) {
      try {
        await this.questProgressChannel.unsubscribe();
        this.questProgressChannel = null;
      } catch (err) {
        logger.error('Failed to unsubscribe from quest progress channel', err);
      }
    }
  }

  /**
   * Map database row to character state
   */
  private mapDbToCharacter(row: Record<string, unknown>): StudyQuestCharacterState {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      level: row.level as number,
      xp: row.xp as number,
      gold: row.gold as number,
      hp: row.hp as number,
      maxHp: row.max_hp as number,
    };
  }

  // ============================================================================
  // Study Session Rewards
  // ============================================================================

  /**
   * Called when a recording session starts
   */
  onSessionStart(): void {
    this.sessionStartTime = Date.now();
    logger.debug('Session started for reward tracking');
  }

  /**
   * Called when a recording session ends
   * Awards XP and gold if session was long enough
   */
  async onSessionComplete(durationMinutes: number): Promise<void> {
    if (!this.character || !this.sessionStartTime) return;

    // Only award if session was long enough
    if (durationMinutes < REWARDS.SESSION_COMPLETE_MIN_MINUTES) {
      logger.debug('Session too short for rewards', { durationMinutes });
      this.sessionStartTime = null;
      return;
    }

    // Create unique key to prevent duplicate rewards
    const rewardKey = `session-${this.sessionStartTime}`;
    if (this.pendingRewards.has(rewardKey)) {
      logger.debug('Reward already claimed for this session');
      return;
    }
    this.pendingRewards.add(rewardKey);

    try {
      await this.awardReward(
        REWARDS.SESSION_XP,
        REWARDS.SESSION_GOLD,
        `Completed ${durationMinutes} minute recording session`
      );
    } finally {
      this.sessionStartTime = null;
      // Clean up old pending rewards after 1 hour
      setTimeout(() => this.pendingRewards.delete(rewardKey), 60 * 60 * 1000);
    }
  }

  /**
   * Called when AI polish feature is used
   */
  async onPolishUsed(): Promise<void> {
    if (!this.character) return;
    await this.awardReward(REWARDS.POLISH_XP, 0, 'Used AI polish feature');
  }

  /**
   * Called when AI summary is generated
   */
  async onSummaryGenerated(): Promise<void> {
    if (!this.character) return;
    await this.awardReward(REWARDS.SUMMARY_XP, 0, 'Generated AI summary');
  }

  /**
   * Called when notes are exported
   */
  async onExportComplete(): Promise<void> {
    if (!this.character) return;
    await this.awardReward(REWARDS.EXPORT_XP, 0, 'Exported notes');
  }

  /**
   * Called when study mode is entered
   */
  onStudyModeStart(): void {
    this.studyModeStartTime = Date.now();
    logger.debug('Study mode started for reward tracking');
  }

  /**
   * Called when study mode is exited
   */
  async onStudyModeEnd(): Promise<void> {
    if (!this.character || !this.studyModeStartTime) return;

    const durationMinutes = Math.floor((Date.now() - this.studyModeStartTime) / 60000);
    const rewardIntervals = Math.floor(durationMinutes / 10);

    if (rewardIntervals > 0) {
      const xpReward = rewardIntervals * REWARDS.STUDY_MODE_PER_10_MIN_XP;
      await this.awardReward(xpReward, 0, `Studied for ${durationMinutes} minutes`);
    }

    this.studyModeStartTime = null;
  }

  /**
   * Award XP and gold to character
   */
  private async awardReward(xp: number, gold: number, reason: string): Promise<void> {
    if (!this.character) return;

    try {
      const ipc = window.electronAPI;
      if (!ipc?.invoke) return;

      // Award XP
      if (xp > 0) {
        await ipc.invoke('studyquest:add-xp', {
          characterId: this.character.id,
          amount: xp,
        });
      }

      // Award gold
      if (gold > 0) {
        await ipc.invoke('studyquest:add-gold', {
          characterId: this.character.id,
          amount: gold,
        });
      }

      // Notify listeners
      this.notifyRewardListeners({ xp, gold, reason });
      logger.info('Awarded StudyQuest rewards', { xp, gold, reason });

      // Reload character to get updated state
      await this.loadCharacter();
    } catch (err) {
      logger.error('Failed to award reward', err);
    }
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================

  /**
   * Subscribe to character state changes
   */
  onCharacterChange(listener: CharacterChangeListener): () => void {
    this.characterListeners.add(listener);
    // Immediately notify with current state
    listener(this.character);
    return () => this.characterListeners.delete(listener);
  }

  /**
   * Subscribe to reward notifications
   */
  onReward(listener: RewardListener): () => void {
    this.rewardListeners.add(listener);
    return () => this.rewardListeners.delete(listener);
  }

  /**
   * Subscribe to quest completion notifications
   */
  onQuestComplete(listener: QuestCompleteListener): () => void {
    this.questCompleteListeners.add(listener);
    return () => this.questCompleteListeners.delete(listener);
  }

  private notifyCharacterListeners(): void {
    this.characterListeners.forEach((listener) => {
      try {
        listener(this.character);
      } catch (err) {
        logger.error('Error in character listener', err);
      }
    });
  }

  private notifyRewardListeners(reward: { xp: number; gold: number; reason: string }): void {
    this.rewardListeners.forEach((listener) => {
      try {
        listener(reward);
      } catch (err) {
        logger.error('Error in reward listener', err);
      }
    });
  }

  private notifyQuestCompleteListeners(quest: {
    questId: string;
    questName: string;
    rewardXp: number;
    rewardGold: number;
  }): void {
    this.questCompleteListeners.forEach((listener) => {
      try {
        listener(quest);
      } catch (err) {
        logger.error('Error in quest complete listener', err);
      }
    });
  }

  // ============================================================================
  // Achievement Integration
  // ============================================================================

  /**
   * Update StudyQuest-related achievements
   * Called from AchievementsManager
   */
  getAchievementProgress(): {
    level: number;
    battlesWon: number;
    dungeonsCompleted: number;
    questsCompleted: number;
    gold: number;
  } {
    if (!this.character) {
      return {
        level: 0,
        battlesWon: 0,
        dungeonsCompleted: 0,
        questsCompleted: 0,
        gold: 0,
      };
    }

    // Note: battlesWon, dungeonsCompleted, questsCompleted would need to be
    // fetched from GameState or backend. For now, return what we have.
    return {
      level: this.character.level,
      battlesWon: 0, // TODO: Track from GameState
      dungeonsCompleted: 0, // TODO: Track from backend
      questsCompleted: 0, // TODO: Track from backend
      gold: this.character.gold,
    };
  }
}
