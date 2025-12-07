/**
 * UnlockManager
 *
 * Manages unlockable content for StudyQuest including:
 * - Cat colors/breeds (starter, breeds, themed, seasonal, secret)
 * - Town features (fishing, garden, weather, NPCs)
 * - Dungeon themes
 *
 * Tracks statistics and checks unlock conditions.
 */

import { createLogger } from '../../shared/logger.js';
import type { CatColor } from './CatSpriteManager.js';

const logger = createLogger('UnlockManager');

// ============================================================================
// Types
// ============================================================================

export type UnlockCategory = 'cat' | 'town_feature' | 'dungeon';

export type UnlockTier = 'starter' | 'breed' | 'themed' | 'seasonal' | 'secret';

export type ConditionType =
  | 'free' // Always unlocked
  | 'level' // Reach a certain level
  | 'battles_won' // Win X battles
  | 'gold_collected' // Collect X gold total
  | 'treasures_found' // Find X treasures in dungeons
  | 'dungeons_cleared' // Clear X different dungeons
  | 'quests_completed' // Complete X quests
  | 'study_buddy_days' // Use Study Buddy for X days
  | 'seasonal' // Play during a specific month
  | 'secret_name' // Name character a specific name
  | 'all_dungeons' // Clear all dungeons
  | 'custom'; // Custom logic

export interface UnlockCondition {
  type: ConditionType;
  value?: number | string;
  customCheck?: (stats: PlayerStats) => boolean;
}

export interface Unlockable {
  id: string;
  name: string;
  description: string;
  category: UnlockCategory;
  tier?: UnlockTier;
  condition: UnlockCondition;
  icon?: string;
  preview?: string; // Asset path for preview
}

export interface PlayerStats {
  level: number;
  battlesWon: number;
  totalGoldCollected: number;
  treasuresFound: number;
  dungeonsCleared: string[];
  questsCompleted: number;
  studyBuddyDaysUsed: number;
  characterName: string;
  currentMonth: number; // 1-12
}

export interface UnlockState {
  unlockedIds: Set<string>;
  newUnlocks: string[]; // IDs of newly unlocked items (for celebration)
}

// ============================================================================
// Unlock Definitions
// ============================================================================

export const CAT_UNLOCKS: Unlockable[] = [
  // Starter cats (always unlocked)
  {
    id: 'cat_brown',
    name: 'Brown Cat',
    description: 'A friendly brown tabby',
    category: 'cat',
    tier: 'starter',
    condition: { type: 'free' },
  },
  {
    id: 'cat_black',
    name: 'Black Cat',
    description: 'A sleek black cat',
    category: 'cat',
    tier: 'starter',
    condition: { type: 'free' },
  },
  {
    id: 'cat_white',
    name: 'White Cat',
    description: 'A pristine white cat',
    category: 'cat',
    tier: 'starter',
    condition: { type: 'free' },
  },
  {
    id: 'cat_orange',
    name: 'Orange Cat',
    description: 'A vibrant orange tabby',
    category: 'cat',
    tier: 'starter',
    condition: { type: 'free' },
  },
  {
    id: 'cat_grey',
    name: 'Grey Cat',
    description: 'A dignified grey cat',
    category: 'cat',
    tier: 'starter',
    condition: { type: 'free' },
  },

  // Breed cats (progression unlocks)
  {
    id: 'cat_siamese',
    name: 'Siamese Cat',
    description: 'An elegant Siamese with blue eyes',
    category: 'cat',
    tier: 'breed',
    condition: { type: 'battles_won', value: 10 },
  },
  {
    id: 'cat_tiger',
    name: 'Tiger Cat',
    description: 'A fierce tiger-striped warrior',
    category: 'cat',
    tier: 'breed',
    condition: { type: 'battles_won', value: 25 },
  },
  {
    id: 'cat_calico',
    name: 'Calico Cat',
    description: 'A beautiful tri-color cat',
    category: 'cat',
    tier: 'breed',
    condition: { type: 'gold_collected', value: 500 },
  },

  // Themed cats (special unlocks)
  {
    id: 'cat_pirate',
    name: 'Pirate Cat',
    description: 'Yarr! A swashbuckling sea cat',
    category: 'cat',
    tier: 'themed',
    condition: { type: 'treasures_found', value: 50 },
  },
  {
    id: 'cat_egypt',
    name: 'Egyptian Cat',
    description: 'A regal cat blessed by Bastet',
    category: 'cat',
    tier: 'themed',
    condition: { type: 'all_dungeons' },
  },
  {
    id: 'cat_batman',
    name: 'Batman Cat',
    description: 'The hero Gotham deserves',
    category: 'cat',
    tier: 'themed',
    condition: { type: 'battles_won', value: 100 },
  },
  {
    id: 'cat_demonic',
    name: 'Demonic Cat',
    description: 'A cat from the shadow realm',
    category: 'cat',
    tier: 'themed',
    condition: { type: 'level', value: 25 },
  },

  // Seasonal cats
  {
    id: 'cat_halloween',
    name: 'Halloween Cat',
    description: 'Spooky and adorable!',
    category: 'cat',
    tier: 'seasonal',
    condition: { type: 'seasonal', value: 10 }, // October
  },
  {
    id: 'cat_christmas',
    name: 'Christmas Cat',
    description: 'Festive and jolly!',
    category: 'cat',
    tier: 'seasonal',
    condition: { type: 'seasonal', value: 12 }, // December
  },

  // Secret cats
  {
    id: 'cat_pixel',
    name: 'Pixel Cat',
    description: 'A retro 8-bit companion',
    category: 'cat',
    tier: 'secret',
    condition: { type: 'study_buddy_days', value: 30 },
  },
  {
    id: 'cat_zombie',
    name: 'Zombie Cat',
    description: 'Back from the dead!',
    category: 'cat',
    tier: 'secret',
    condition: { type: 'secret_name', value: 'zombie' },
  },
];

export const TOWN_UNLOCKS: Unlockable[] = [
  {
    id: 'town_fishing',
    name: 'Fishing Spot',
    description: 'A peaceful pond for catching fish',
    category: 'town_feature',
    condition: { type: 'level', value: 5 },
  },
  {
    id: 'town_garden',
    name: 'Catnip Garden',
    description: 'Grow your own catnip!',
    category: 'town_feature',
    condition: { type: 'level', value: 10 },
  },
  {
    id: 'town_night',
    name: 'Night Mode',
    description: 'Town at night with stars',
    category: 'town_feature',
    condition: { type: 'level', value: 8 },
  },
  {
    id: 'town_weather',
    name: 'Weather Effects',
    description: 'Rain, snow, and more',
    category: 'town_feature',
    condition: { type: 'level', value: 12 },
  },
  {
    id: 'town_npcs',
    name: 'Village NPCs',
    description: 'Other cats to talk to',
    category: 'town_feature',
    condition: { type: 'level', value: 15 },
  },
];

export const DUNGEON_UNLOCKS: Unlockable[] = [
  {
    id: 'dungeon_training',
    name: 'Training Grounds',
    description: 'A safe place to practice',
    category: 'dungeon',
    condition: { type: 'free' },
  },
  {
    id: 'dungeon_forest',
    name: 'Dark Forest',
    description: 'A spooky woodland',
    category: 'dungeon',
    condition: { type: 'level', value: 3 },
  },
  {
    id: 'dungeon_crystal',
    name: 'Crystal Caves',
    description: 'Glittering ice caverns',
    category: 'dungeon',
    condition: { type: 'level', value: 6 },
  },
  {
    id: 'dungeon_library',
    name: 'Haunted Library',
    description: 'Knowledge comes at a price',
    category: 'dungeon',
    condition: { type: 'level', value: 10 },
  },
  {
    id: 'dungeon_volcano',
    name: "Dragon's Peak",
    description: 'A volcanic mountain',
    category: 'dungeon',
    condition: { type: 'level', value: 15 },
  },
  {
    id: 'dungeon_void',
    name: 'Void Realm',
    description: 'The ultimate challenge',
    category: 'dungeon',
    condition: { type: 'level', value: 20 },
  },
];

// All unlockables combined
export const ALL_UNLOCKS: Unlockable[] = [...CAT_UNLOCKS, ...TOWN_UNLOCKS, ...DUNGEON_UNLOCKS];

// ============================================================================
// Unlock Manager Class
// ============================================================================

class UnlockManagerClass {
  private state: UnlockState = {
    unlockedIds: new Set(),
    newUnlocks: [],
  };

  private listeners: Set<(state: UnlockState) => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Subscribe to unlock state changes
   */
  subscribe(listener: (state: UnlockState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /**
   * Check all unlock conditions and update state
   * Returns newly unlocked item IDs
   */
  checkUnlocks(stats: PlayerStats): string[] {
    const newUnlocks: string[] = [];

    for (const unlock of ALL_UNLOCKS) {
      if (!this.state.unlockedIds.has(unlock.id)) {
        if (this.checkCondition(unlock.condition, stats)) {
          this.state.unlockedIds.add(unlock.id);
          newUnlocks.push(unlock.id);
          logger.info(`Unlocked: ${unlock.name}`);
        }
      }
    }

    if (newUnlocks.length > 0) {
      this.state.newUnlocks = newUnlocks;
      this.saveToStorage();
      this.notifyListeners();
    }

    return newUnlocks;
  }

  /**
   * Check if a specific item is unlocked
   */
  isUnlocked(id: string): boolean {
    return this.state.unlockedIds.has(id);
  }

  /**
   * Get all unlocked items of a category
   */
  getUnlockedByCategory(category: UnlockCategory): Unlockable[] {
    return ALL_UNLOCKS.filter(
      (u) => u.category === category && this.state.unlockedIds.has(u.id)
    );
  }

  /**
   * Get all unlocked cat colors
   */
  getUnlockedCats(): CatColor[] {
    return CAT_UNLOCKS.filter((u) => this.state.unlockedIds.has(u.id)).map(
      (u) => u.id.replace('cat_', '') as CatColor
    );
  }

  /**
   * Get unlock progress for a specific item
   */
  getProgress(id: string, stats: PlayerStats): { current: number; required: number; percent: number } | null {
    const unlock = ALL_UNLOCKS.find((u) => u.id === id);
    if (!unlock) return null;

    const condition = unlock.condition;
    let current = 0;
    let required = 0;

    switch (condition.type) {
      case 'level':
        current = stats.level;
        required = condition.value as number;
        break;
      case 'battles_won':
        current = stats.battlesWon;
        required = condition.value as number;
        break;
      case 'gold_collected':
        current = stats.totalGoldCollected;
        required = condition.value as number;
        break;
      case 'treasures_found':
        current = stats.treasuresFound;
        required = condition.value as number;
        break;
      case 'quests_completed':
        current = stats.questsCompleted;
        required = condition.value as number;
        break;
      case 'study_buddy_days':
        current = stats.studyBuddyDaysUsed;
        required = condition.value as number;
        break;
      case 'dungeons_cleared':
        current = stats.dungeonsCleared.length;
        required = condition.value as number;
        break;
      case 'free':
        current = 1;
        required = 1;
        break;
      default:
        return null;
    }

    return {
      current,
      required,
      percent: Math.min(100, (current / required) * 100),
    };
  }

  /**
   * Get all unlockables with their locked/unlocked status
   */
  getAllWithStatus(): Array<Unlockable & { unlocked: boolean }> {
    return ALL_UNLOCKS.map((u) => ({
      ...u,
      unlocked: this.state.unlockedIds.has(u.id),
    }));
  }

  /**
   * Clear new unlock notifications
   */
  clearNewUnlocks(): void {
    this.state.newUnlocks = [];
    this.notifyListeners();
  }

  /**
   * Get new unlocks (for celebration UI)
   */
  getNewUnlocks(): Unlockable[] {
    return this.state.newUnlocks
      .map((id) => ALL_UNLOCKS.find((u) => u.id === id))
      .filter((u): u is Unlockable => u !== undefined);
  }

  /**
   * Manually unlock an item (for testing or special events)
   */
  forceUnlock(id: string): void {
    if (!this.state.unlockedIds.has(id)) {
      this.state.unlockedIds.add(id);
      this.saveToStorage();
      this.notifyListeners();
      logger.info(`Force unlocked: ${id}`);
    }
  }

  /**
   * Reset all unlocks (for testing)
   */
  reset(): void {
    this.state.unlockedIds.clear();
    this.state.newUnlocks = [];
    // Re-add free unlocks
    for (const unlock of ALL_UNLOCKS) {
      if (unlock.condition.type === 'free') {
        this.state.unlockedIds.add(unlock.id);
      }
    }
    this.saveToStorage();
    this.notifyListeners();
    logger.info('Unlock manager reset');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private checkCondition(condition: UnlockCondition, stats: PlayerStats): boolean {
    switch (condition.type) {
      case 'free':
        return true;

      case 'level':
        return stats.level >= (condition.value as number);

      case 'battles_won':
        return stats.battlesWon >= (condition.value as number);

      case 'gold_collected':
        return stats.totalGoldCollected >= (condition.value as number);

      case 'treasures_found':
        return stats.treasuresFound >= (condition.value as number);

      case 'quests_completed':
        return stats.questsCompleted >= (condition.value as number);

      case 'study_buddy_days':
        return stats.studyBuddyDaysUsed >= (condition.value as number);

      case 'dungeons_cleared':
        return stats.dungeonsCleared.length >= (condition.value as number);

      case 'all_dungeons':
        // Check if all dungeon unlocks that are currently unlocked have been cleared
        const allDungeonIds = DUNGEON_UNLOCKS.filter(
          (d) => d.id !== 'dungeon_void' // Exclude final dungeon from requirement
        ).map((d) => d.id.replace('dungeon_', ''));
        return allDungeonIds.every((id) => stats.dungeonsCleared.includes(id));

      case 'seasonal':
        return stats.currentMonth === (condition.value as number);

      case 'secret_name':
        return stats.characterName.toLowerCase().includes(
          (condition.value as string).toLowerCase()
        );

      case 'custom':
        return condition.customCheck ? condition.customCheck(stats) : false;

      default:
        return false;
    }
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem('studyquest-unlocks');
      if (saved) {
        const data = JSON.parse(saved);
        this.state.unlockedIds = new Set(data.unlockedIds || []);
      }
    } catch (error) {
      logger.warn('Failed to load unlock state from storage:', error);
    }

    // Ensure free unlocks are always available
    for (const unlock of ALL_UNLOCKS) {
      if (unlock.condition.type === 'free') {
        this.state.unlockedIds.add(unlock.id);
      }
    }
  }

  private saveToStorage(): void {
    try {
      const data = {
        unlockedIds: Array.from(this.state.unlockedIds),
      };
      localStorage.setItem('studyquest-unlocks', JSON.stringify(data));
    } catch (error) {
      logger.warn('Failed to save unlock state to storage:', error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }
}

// Export singleton instance
export const UnlockManager = new UnlockManagerClass();
