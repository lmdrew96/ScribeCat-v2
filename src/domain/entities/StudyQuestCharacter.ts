/**
 * StudyQuestCharacter Entity
 *
 * Represents a player's character in the StudyQuest RPG mini-game.
 * Characters earn XP and gold from studying, battle enemies, and progress through dungeons.
 */

export type CharacterClass = 'scholar' | 'knight' | 'rogue';

export interface CharacterClassData {
  readonly id: CharacterClass;
  readonly name: string;
  readonly description: string;
  readonly baseHp: number;
  readonly baseAttack: number;
  readonly baseDefense: number;
  readonly baseSpeed: number;
  readonly specialBonus: 'xp_gain' | 'gold_gain' | 'crit_chance';
  readonly specialBonusPercent: number;
  readonly spriteKey: string;
}

export interface StudyQuestCharacterData {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly classId: CharacterClass;
  readonly level: number;
  readonly currentXp: number;
  readonly totalXpEarned: number;
  readonly gold: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
  readonly equippedWeaponId?: string;
  readonly equippedArmorId?: string;
  readonly equippedAccessoryId?: string;
  readonly currentDungeonId?: string;
  readonly currentFloor: number;
  readonly battlesWon: number;
  readonly battlesLost: number;
  readonly dungeonsCompleted: number;
  readonly questsCompleted: number;
  readonly highestDungeonFloor: number;
  readonly lastDailyRewardAt?: Date;
  readonly lastActivityAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * StudyQuestCharacter domain entity
 */
export class StudyQuestCharacter {
  constructor(private readonly data: StudyQuestCharacterData) {}

  /**
   * Create StudyQuestCharacter from database row
   */
  static fromDatabase(row: {
    id: string;
    user_id: string;
    name: string;
    class_id: string;
    level: number;
    current_xp: number;
    total_xp_earned: number;
    gold: number;
    hp: number;
    max_hp: number;
    attack: number;
    defense: number;
    speed: number;
    equipped_weapon_id?: string | null;
    equipped_armor_id?: string | null;
    equipped_accessory_id?: string | null;
    current_dungeon_id?: string | null;
    current_floor: number;
    battles_won: number;
    battles_lost: number;
    dungeons_completed: number;
    quests_completed: number;
    highest_dungeon_floor: number;
    last_daily_reward_at?: string | Date | null;
    last_activity_at?: string | Date | null;
    created_at: string | Date;
    updated_at: string | Date;
  }): StudyQuestCharacter {
    return new StudyQuestCharacter({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      classId: row.class_id as CharacterClass,
      level: row.level,
      currentXp: row.current_xp,
      totalXpEarned: row.total_xp_earned,
      gold: row.gold,
      hp: row.hp,
      maxHp: row.max_hp,
      attack: row.attack,
      defense: row.defense,
      speed: row.speed,
      equippedWeaponId: row.equipped_weapon_id ?? undefined,
      equippedArmorId: row.equipped_armor_id ?? undefined,
      equippedAccessoryId: row.equipped_accessory_id ?? undefined,
      currentDungeonId: row.current_dungeon_id ?? undefined,
      currentFloor: row.current_floor,
      battlesWon: row.battles_won,
      battlesLost: row.battles_lost,
      dungeonsCompleted: row.dungeons_completed,
      questsCompleted: row.quests_completed,
      highestDungeonFloor: row.highest_dungeon_floor,
      lastDailyRewardAt: row.last_daily_reward_at
        ? new Date(row.last_daily_reward_at)
        : undefined,
      lastActivityAt: row.last_activity_at
        ? new Date(row.last_activity_at)
        : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  // Getters
  get id(): string {
    return this.data.id;
  }
  get userId(): string {
    return this.data.userId;
  }
  get name(): string {
    return this.data.name;
  }
  get classId(): CharacterClass {
    return this.data.classId;
  }
  get level(): number {
    return this.data.level;
  }
  get currentXp(): number {
    return this.data.currentXp;
  }
  get totalXpEarned(): number {
    return this.data.totalXpEarned;
  }
  get gold(): number {
    return this.data.gold;
  }
  get hp(): number {
    return this.data.hp;
  }
  get maxHp(): number {
    return this.data.maxHp;
  }
  get attack(): number {
    return this.data.attack;
  }
  get defense(): number {
    return this.data.defense;
  }
  get speed(): number {
    return this.data.speed;
  }
  get equippedWeaponId(): string | undefined {
    return this.data.equippedWeaponId;
  }
  get equippedArmorId(): string | undefined {
    return this.data.equippedArmorId;
  }
  get equippedAccessoryId(): string | undefined {
    return this.data.equippedAccessoryId;
  }
  get currentDungeonId(): string | undefined {
    return this.data.currentDungeonId;
  }
  get currentFloor(): number {
    return this.data.currentFloor;
  }
  get battlesWon(): number {
    return this.data.battlesWon;
  }
  get battlesLost(): number {
    return this.data.battlesLost;
  }
  get dungeonsCompleted(): number {
    return this.data.dungeonsCompleted;
  }
  get questsCompleted(): number {
    return this.data.questsCompleted;
  }
  get highestDungeonFloor(): number {
    return this.data.highestDungeonFloor;
  }
  get lastDailyRewardAt(): Date | undefined {
    return this.data.lastDailyRewardAt;
  }
  get lastActivityAt(): Date | undefined {
    return this.data.lastActivityAt;
  }
  get createdAt(): Date {
    return this.data.createdAt;
  }
  get updatedAt(): Date {
    return this.data.updatedAt;
  }

  /**
   * Calculate XP needed to reach the next level
   * Formula: 100 + (level * 50)
   */
  get xpToNextLevel(): number {
    return 100 + this.level * 50;
  }

  /**
   * Calculate XP progress percentage to next level
   */
  get xpProgress(): number {
    return Math.min(100, Math.round((this.currentXp / this.xpToNextLevel) * 100));
  }

  /**
   * Check if character is at max level
   */
  get isMaxLevel(): boolean {
    return this.level >= 50;
  }

  /**
   * Check if character is currently in a dungeon
   */
  get isInDungeon(): boolean {
    return !!this.currentDungeonId;
  }

  /**
   * Check if character is alive
   */
  get isAlive(): boolean {
    return this.hp > 0;
  }

  /**
   * Get HP percentage
   */
  get hpPercent(): number {
    return Math.round((this.hp / this.maxHp) * 100);
  }

  /**
   * Check if daily reward is available
   */
  get canClaimDailyReward(): boolean {
    if (!this.lastDailyRewardAt) return true;
    const now = new Date();
    const lastReward = this.lastDailyRewardAt;
    return (
      now.getDate() !== lastReward.getDate() ||
      now.getMonth() !== lastReward.getMonth() ||
      now.getFullYear() !== lastReward.getFullYear()
    );
  }

  /**
   * Get win rate percentage
   */
  get winRate(): number {
    const total = this.battlesWon + this.battlesLost;
    if (total === 0) return 0;
    return Math.round((this.battlesWon / total) * 100);
  }

  /**
   * Convert to JSON for IPC transport
   */
  toJSON(): StudyQuestCharacterData {
    return { ...this.data };
  }

  /**
   * Convert to database format for updates
   */
  toDatabase(): Record<string, unknown> {
    return {
      id: this.data.id,
      user_id: this.data.userId,
      name: this.data.name,
      class_id: this.data.classId,
      level: this.data.level,
      current_xp: this.data.currentXp,
      total_xp_earned: this.data.totalXpEarned,
      gold: this.data.gold,
      hp: this.data.hp,
      max_hp: this.data.maxHp,
      attack: this.data.attack,
      defense: this.data.defense,
      speed: this.data.speed,
      equipped_weapon_id: this.data.equippedWeaponId ?? null,
      equipped_armor_id: this.data.equippedArmorId ?? null,
      equipped_accessory_id: this.data.equippedAccessoryId ?? null,
      current_dungeon_id: this.data.currentDungeonId ?? null,
      current_floor: this.data.currentFloor,
      battles_won: this.data.battlesWon,
      battles_lost: this.data.battlesLost,
      dungeons_completed: this.data.dungeonsCompleted,
      quests_completed: this.data.questsCompleted,
      highest_dungeon_floor: this.data.highestDungeonFloor,
      last_daily_reward_at: this.data.lastDailyRewardAt?.toISOString() ?? null,
      last_activity_at: this.data.lastActivityAt?.toISOString() ?? null,
    };
  }
}

/**
 * Default class definitions
 */
export const CHARACTER_CLASSES: Record<CharacterClass, CharacterClassData> = {
  scholar: {
    id: 'scholar',
    name: 'Scholar',
    description: 'A wise student who gains extra experience from their studies.',
    baseHp: 80,
    baseAttack: 8,
    baseDefense: 6,
    baseSpeed: 8,
    specialBonus: 'xp_gain',
    specialBonusPercent: 25,
    spriteKey: 'scholar',
  },
  knight: {
    id: 'knight',
    name: 'Knight',
    description: 'A stalwart warrior who earns more gold from their adventures.',
    baseHp: 120,
    baseAttack: 10,
    baseDefense: 8,
    baseSpeed: 4,
    specialBonus: 'gold_gain',
    specialBonusPercent: 25,
    spriteKey: 'knight',
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    description: 'A swift adventurer with a keen eye for critical strikes.',
    baseHp: 90,
    baseAttack: 12,
    baseDefense: 4,
    baseSpeed: 10,
    specialBonus: 'crit_chance',
    specialBonusPercent: 25,
    spriteKey: 'rogue',
  },
};

// ============================================================================
// Centralized XP Formula Utilities (Item 8)
// Use these instead of inline calculations like "100 + (level * 50)"
// ============================================================================

/**
 * Calculate XP required to reach the next level from a given level.
 * Formula: 100 + (level * 50)
 *
 * @param level - The current level
 * @returns XP needed to reach the next level
 */
export function getXpRequiredForLevel(level: number): number {
  return 100 + level * 50;
}

/**
 * Get XP progress information for a character.
 *
 * @param character - Character data with level and currentXp
 * @returns Object with current XP, required XP, and percentage progress
 */
export function getXpProgress(character: { level: number; currentXp: number }): {
  current: number;
  required: number;
  percent: number;
} {
  const required = getXpRequiredForLevel(character.level);
  const current = character.currentXp || 0;
  const percent = Math.min(100, Math.round((current / required) * 100));
  return { current, required, percent };
}

/**
 * Calculate how many levels would be gained from a given amount of XP.
 *
 * @param currentLevel - Starting level
 * @param currentXp - Current XP at that level
 * @param xpToAdd - Amount of XP being added
 * @returns Object with new level, remaining XP, and levels gained
 */
export function calculateLevelUp(
  currentLevel: number,
  currentXp: number,
  xpToAdd: number
): {
  newLevel: number;
  newXp: number;
  levelsGained: number;
} {
  let level = currentLevel;
  let xp = currentXp + xpToAdd;
  let levelsGained = 0;

  while (xp >= getXpRequiredForLevel(level) && level < 50) {
    xp -= getXpRequiredForLevel(level);
    level++;
    levelsGained++;
  }

  return { newLevel: level, newXp: xp, levelsGained };
}
