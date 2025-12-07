/**
 * PlayerStatsService
 *
 * Tracks player statistics for StudyQuest unlock conditions.
 * Persists stats to localStorage and syncs with character data.
 */

import { createLogger } from '../../shared/logger.js';
import { UnlockManager, type PlayerStats } from './UnlockManager.js';

const logger = createLogger('PlayerStatsService');

const STORAGE_KEY = 'studyquest-player-stats';

interface StoredStats {
  totalGoldCollected: number;
  treasuresFound: number;
  dungeonsCleared: string[];
  studyBuddyDaysUsed: number;
  studyBuddyLastDate: string | null;
}

class PlayerStatsServiceClass {
  private storedStats: StoredStats = {
    totalGoldCollected: 0,
    treasuresFound: 0,
    dungeonsCleared: [],
    studyBuddyDaysUsed: 0,
    studyBuddyLastDate: null,
  };

  private listeners: Set<(stats: PlayerStats) => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Subscribe to stats changes
   */
  subscribe(listener: (stats: PlayerStats) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Build full PlayerStats object from stored stats + character data
   */
  getStats(characterData?: {
    level?: number;
    battlesWon?: number;
    questsCompleted?: number;
    name?: string;
  }): PlayerStats {
    return {
      level: characterData?.level ?? 1,
      battlesWon: characterData?.battlesWon ?? 0,
      totalGoldCollected: this.storedStats.totalGoldCollected,
      treasuresFound: this.storedStats.treasuresFound,
      dungeonsCleared: [...this.storedStats.dungeonsCleared],
      questsCompleted: characterData?.questsCompleted ?? 0,
      studyBuddyDaysUsed: this.storedStats.studyBuddyDaysUsed,
      characterName: characterData?.name ?? '',
      currentMonth: new Date().getMonth() + 1, // 1-12
    };
  }

  /**
   * Check unlocks with current stats
   */
  checkUnlocks(characterData?: {
    level?: number;
    battlesWon?: number;
    questsCompleted?: number;
    name?: string;
  }): string[] {
    const stats = this.getStats(characterData);
    return UnlockManager.checkUnlocks(stats);
  }

  /**
   * Add gold to total collected (for unlock tracking)
   */
  addGoldCollected(amount: number): void {
    if (amount <= 0) return;
    this.storedStats.totalGoldCollected += amount;
    this.saveAndNotify();
    logger.info(`Gold collected: +${amount} (total: ${this.storedStats.totalGoldCollected})`);
  }

  /**
   * Add treasures found (from dungeon exploration)
   */
  addTreasureFound(count: number = 1): void {
    this.storedStats.treasuresFound += count;
    this.saveAndNotify();
    logger.info(`Treasure found: +${count} (total: ${this.storedStats.treasuresFound})`);
  }

  /**
   * Record a dungeon as cleared
   */
  recordDungeonCleared(dungeonId: string): void {
    if (!this.storedStats.dungeonsCleared.includes(dungeonId)) {
      this.storedStats.dungeonsCleared.push(dungeonId);
      this.saveAndNotify();
      logger.info(`Dungeon cleared: ${dungeonId}`);
    }
  }

  /**
   * Record study buddy usage for today
   */
  recordStudyBuddyUsage(): void {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    if (this.storedStats.studyBuddyLastDate !== today) {
      this.storedStats.studyBuddyLastDate = today;
      this.storedStats.studyBuddyDaysUsed++;
      this.saveAndNotify();
      logger.info(`Study Buddy day recorded (total days: ${this.storedStats.studyBuddyDaysUsed})`);
    }
  }

  /**
   * Get specific stat values
   */
  getTotalGoldCollected(): number {
    return this.storedStats.totalGoldCollected;
  }

  getTreasuresFound(): number {
    return this.storedStats.treasuresFound;
  }

  getDungeonsCleared(): string[] {
    return [...this.storedStats.dungeonsCleared];
  }

  getStudyBuddyDaysUsed(): number {
    return this.storedStats.studyBuddyDaysUsed;
  }

  /**
   * Reset all stored stats (for testing)
   */
  reset(): void {
    this.storedStats = {
      totalGoldCollected: 0,
      treasuresFound: 0,
      dungeonsCleared: [],
      studyBuddyDaysUsed: 0,
      studyBuddyLastDate: null,
    };
    this.saveAndNotify();
    logger.info('Player stats reset');
  }

  /**
   * Update stats directly (for testing/debugging)
   */
  update(updates: Partial<StoredStats>): void {
    if (updates.totalGoldCollected !== undefined) {
      this.storedStats.totalGoldCollected = updates.totalGoldCollected;
    }
    if (updates.treasuresFound !== undefined) {
      this.storedStats.treasuresFound = updates.treasuresFound;
    }
    if (updates.dungeonsCleared !== undefined) {
      this.storedStats.dungeonsCleared = [...updates.dungeonsCleared];
    }
    if (updates.studyBuddyDaysUsed !== undefined) {
      this.storedStats.studyBuddyDaysUsed = updates.studyBuddyDaysUsed;
    }
    if (updates.studyBuddyLastDate !== undefined) {
      this.storedStats.studyBuddyLastDate = updates.studyBuddyLastDate;
    }
    this.saveAndNotify();
    logger.info('Player stats updated:', updates);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved) as Partial<StoredStats>;
        this.storedStats = {
          totalGoldCollected: data.totalGoldCollected ?? 0,
          treasuresFound: data.treasuresFound ?? 0,
          dungeonsCleared: data.dungeonsCleared ?? [],
          studyBuddyDaysUsed: data.studyBuddyDaysUsed ?? 0,
          studyBuddyLastDate: data.studyBuddyLastDate ?? null,
        };
        logger.info('Loaded player stats from storage');
      }
    } catch (error) {
      logger.warn('Failed to load player stats from storage:', error);
    }
  }

  private saveAndNotify(): void {
    this.saveToStorage();
    this.notifyListeners();
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.storedStats));
    } catch (error) {
      logger.warn('Failed to save player stats to storage:', error);
    }
  }

  private notifyListeners(): void {
    const stats = this.getStats();
    this.listeners.forEach((listener) => listener(stats));
  }
}

// Export singleton instance
export const PlayerStatsService = new PlayerStatsServiceClass();
