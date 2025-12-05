/**
 * StudyQuestQuest Entity
 *
 * Represents quests in the StudyQuest RPG.
 * Quests can be daily, weekly, story-based, or achievement-style.
 */

export type QuestType = 'daily' | 'weekly' | 'story' | 'achievement';
export type RequirementType =
  | 'study_time'
  | 'battles_won'
  | 'dungeon_complete'
  | 'level_reach'
  | 'gold_earn'
  | 'xp_earn'
  | 'items_collect'
  | 'ai_tools';

export interface StudyQuestQuestData {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly questType: QuestType;
  readonly requirementType: RequirementType;
  readonly requirementValue: number;
  readonly rewardXp: number;
  readonly rewardGold: number;
  readonly rewardItemId?: string;
  readonly isRepeatable: boolean;
  readonly unlockLevel: number;
  readonly createdAt: Date;
}

/**
 * StudyQuestQuest domain entity
 */
export class StudyQuestQuest {
  constructor(private readonly data: StudyQuestQuestData) {}

  /**
   * Create StudyQuestQuest from database row
   */
  static fromDatabase(row: {
    id: string;
    name: string;
    description?: string | null;
    quest_type: string;
    requirement_type: string;
    requirement_value: number;
    reward_xp: number;
    reward_gold: number;
    reward_item_id?: string | null;
    is_repeatable: boolean;
    unlock_level: number;
    created_at: string | Date;
  }): StudyQuestQuest {
    return new StudyQuestQuest({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      questType: row.quest_type as QuestType,
      requirementType: row.requirement_type as RequirementType,
      requirementValue: row.requirement_value,
      rewardXp: row.reward_xp,
      rewardGold: row.reward_gold,
      rewardItemId: row.reward_item_id ?? undefined,
      isRepeatable: row.is_repeatable,
      unlockLevel: row.unlock_level,
      createdAt: new Date(row.created_at),
    });
  }

  // Getters
  get id(): string {
    return this.data.id;
  }
  get name(): string {
    return this.data.name;
  }
  get description(): string | undefined {
    return this.data.description;
  }
  get questType(): QuestType {
    return this.data.questType;
  }
  get requirementType(): RequirementType {
    return this.data.requirementType;
  }
  get requirementValue(): number {
    return this.data.requirementValue;
  }
  get rewardXp(): number {
    return this.data.rewardXp;
  }
  get rewardGold(): number {
    return this.data.rewardGold;
  }
  get rewardItemId(): string | undefined {
    return this.data.rewardItemId;
  }
  get isRepeatable(): boolean {
    return this.data.isRepeatable;
  }
  get unlockLevel(): number {
    return this.data.unlockLevel;
  }
  get createdAt(): Date {
    return this.data.createdAt;
  }

  /**
   * Check if quest is unlocked for a given level
   */
  isUnlockedForLevel(level: number): boolean {
    return level >= this.unlockLevel;
  }

  /**
   * Get quest type color for UI
   */
  get typeColor(): string {
    const colors: Record<QuestType, string> = {
      daily: '#22c55e',
      weekly: '#3b82f6',
      story: '#f59e0b',
      achievement: '#a855f7',
    };
    return colors[this.questType];
  }

  /**
   * Get formatted requirement string for display
   */
  get requirementDisplay(): string {
    const formatters: Record<RequirementType, (value: number) => string> = {
      study_time: (v) => `Study for ${v} minutes`,
      battles_won: (v) => `Win ${v} battle${v > 1 ? 's' : ''}`,
      dungeon_complete: (v) => `Complete ${v} dungeon${v > 1 ? 's' : ''}`,
      level_reach: (v) => `Reach level ${v}`,
      gold_earn: (v) => `Earn ${v} gold`,
      xp_earn: (v) => `Earn ${v} XP`,
      items_collect: (v) => `Collect ${v} item${v > 1 ? 's' : ''}`,
      ai_tools: (v) => `Use ${v} AI tool${v > 1 ? 's' : ''}`,
    };
    return formatters[this.requirementType](this.requirementValue);
  }

  /**
   * Get formatted rewards string for display
   */
  get rewardsDisplay(): string {
    const rewards: string[] = [];
    if (this.rewardXp > 0) rewards.push(`${this.rewardXp} XP`);
    if (this.rewardGold > 0) rewards.push(`${this.rewardGold} Gold`);
    if (this.rewardItemId) rewards.push('+ Item');
    return rewards.join(', ') || 'No rewards';
  }

  /**
   * Convert to JSON for IPC transport
   */
  toJSON(): StudyQuestQuestData {
    return { ...this.data };
  }
}

/**
 * Quest progress tracking
 */
export interface QuestProgressData {
  readonly id: string;
  readonly characterId: string;
  readonly questId: string;
  readonly currentProgress: number;
  readonly isCompleted: boolean;
  readonly completedAt?: Date;
  readonly lastResetAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class QuestProgress {
  constructor(private readonly data: QuestProgressData) {}

  /**
   * Create QuestProgress from database row
   */
  static fromDatabase(row: {
    id: string;
    character_id: string;
    quest_id: string;
    current_progress: number;
    is_completed: boolean;
    completed_at?: string | Date | null;
    last_reset_at?: string | Date | null;
    created_at: string | Date;
    updated_at: string | Date;
  }): QuestProgress {
    return new QuestProgress({
      id: row.id,
      characterId: row.character_id,
      questId: row.quest_id,
      currentProgress: row.current_progress,
      isCompleted: row.is_completed,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      lastResetAt: row.last_reset_at ? new Date(row.last_reset_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  // Getters
  get id(): string {
    return this.data.id;
  }
  get characterId(): string {
    return this.data.characterId;
  }
  get questId(): string {
    return this.data.questId;
  }
  get currentProgress(): number {
    return this.data.currentProgress;
  }
  get isCompleted(): boolean {
    return this.data.isCompleted;
  }
  get completedAt(): Date | undefined {
    return this.data.completedAt;
  }
  get lastResetAt(): Date | undefined {
    return this.data.lastResetAt;
  }
  get createdAt(): Date {
    return this.data.createdAt;
  }
  get updatedAt(): Date {
    return this.data.updatedAt;
  }

  /**
   * Calculate progress percentage for a quest
   */
  getProgressPercent(quest: StudyQuestQuest): number {
    if (this.isCompleted) return 100;
    return Math.min(100, Math.round((this.currentProgress / quest.requirementValue) * 100));
  }

  /**
   * Check if daily reset is needed
   */
  needsDailyReset(): boolean {
    if (!this.lastResetAt) return true;
    const now = new Date();
    return (
      now.getDate() !== this.lastResetAt.getDate() ||
      now.getMonth() !== this.lastResetAt.getMonth() ||
      now.getFullYear() !== this.lastResetAt.getFullYear()
    );
  }

  /**
   * Check if weekly reset is needed
   */
  needsWeeklyReset(): boolean {
    if (!this.lastResetAt) return true;
    const now = new Date();
    const lastReset = this.lastResetAt;

    // Get Monday of current week
    const currentMonday = new Date(now);
    currentMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    currentMonday.setHours(0, 0, 0, 0);

    return lastReset < currentMonday;
  }

  /**
   * Convert to JSON for IPC transport
   */
  toJSON(): QuestProgressData {
    return { ...this.data };
  }
}

/**
 * Quest with progress for display
 */
export interface QuestWithProgress {
  quest: StudyQuestQuestData;
  progress: QuestProgressData | null;
  progressPercent: number;
  isAvailable: boolean;
}
