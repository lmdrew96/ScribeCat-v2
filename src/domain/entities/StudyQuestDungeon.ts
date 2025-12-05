/**
 * StudyQuestDungeon Entity
 *
 * Represents dungeons and enemies in the StudyQuest RPG.
 * Each dungeon has multiple floors with encounters, culminating in a boss battle.
 */

export type DungeonTheme = 'training' | 'forest' | 'cave' | 'library' | 'volcano' | 'void';

export interface StudyQuestDungeonData {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly requiredLevel: number;
  readonly floorCount: number;
  readonly encountersPerFloor: number;
  readonly bossName?: string;
  readonly bossSpriteKey?: string;
  readonly theme: DungeonTheme;
  readonly xpMultiplier: number;
  readonly goldMultiplier: number;
  readonly unlockOrder: number;
  readonly spriteKey?: string;
  readonly createdAt: Date;
}

/**
 * StudyQuestDungeon domain entity
 */
export class StudyQuestDungeon {
  constructor(private readonly data: StudyQuestDungeonData) {}

  /**
   * Create StudyQuestDungeon from database row
   */
  static fromDatabase(row: {
    id: string;
    name: string;
    description?: string | null;
    required_level: number;
    floor_count: number;
    encounters_per_floor: number;
    boss_name?: string | null;
    boss_sprite_key?: string | null;
    theme: string;
    xp_multiplier: number | string;
    gold_multiplier: number | string;
    unlock_order: number;
    sprite_key?: string | null;
    created_at: string | Date;
  }): StudyQuestDungeon {
    return new StudyQuestDungeon({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      requiredLevel: row.required_level,
      floorCount: row.floor_count,
      encountersPerFloor: row.encounters_per_floor,
      bossName: row.boss_name ?? undefined,
      bossSpriteKey: row.boss_sprite_key ?? undefined,
      theme: row.theme as DungeonTheme,
      xpMultiplier: typeof row.xp_multiplier === 'string'
        ? parseFloat(row.xp_multiplier)
        : row.xp_multiplier,
      goldMultiplier: typeof row.gold_multiplier === 'string'
        ? parseFloat(row.gold_multiplier)
        : row.gold_multiplier,
      unlockOrder: row.unlock_order,
      spriteKey: row.sprite_key ?? undefined,
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
  get requiredLevel(): number {
    return this.data.requiredLevel;
  }
  get floorCount(): number {
    return this.data.floorCount;
  }
  get encountersPerFloor(): number {
    return this.data.encountersPerFloor;
  }
  get bossName(): string | undefined {
    return this.data.bossName;
  }
  get bossSpriteKey(): string | undefined {
    return this.data.bossSpriteKey;
  }
  get theme(): DungeonTheme {
    return this.data.theme;
  }
  get xpMultiplier(): number {
    return this.data.xpMultiplier;
  }
  get goldMultiplier(): number {
    return this.data.goldMultiplier;
  }
  get unlockOrder(): number {
    return this.data.unlockOrder;
  }
  get spriteKey(): string | undefined {
    return this.data.spriteKey;
  }
  get createdAt(): Date {
    return this.data.createdAt;
  }

  /**
   * Get total encounters in this dungeon (excluding boss)
   */
  get totalEncounters(): number {
    return this.floorCount * this.encountersPerFloor;
  }

  /**
   * Get theme color for UI
   */
  get themeColor(): string {
    const colors: Record<DungeonTheme, string> = {
      training: '#6b7280',
      forest: '#22c55e',
      cave: '#8b5cf6',
      library: '#3b82f6',
      volcano: '#ef4444',
      void: '#1e1b4b',
    };
    return colors[this.theme];
  }

  /**
   * Get difficulty label based on level requirement
   */
  get difficultyLabel(): string {
    if (this.requiredLevel >= 40) return 'Legendary';
    if (this.requiredLevel >= 25) return 'Hard';
    if (this.requiredLevel >= 15) return 'Medium';
    if (this.requiredLevel >= 5) return 'Easy';
    return 'Tutorial';
  }

  /**
   * Check if dungeon is unlocked for a given level
   */
  isUnlockedForLevel(level: number): boolean {
    return level >= this.requiredLevel;
  }

  /**
   * Convert to JSON for IPC transport
   */
  toJSON(): StudyQuestDungeonData {
    return { ...this.data };
  }
}

/**
 * Enemy Entity
 */
export interface StudyQuestEnemyData {
  readonly id: string;
  readonly name: string;
  readonly dungeonId?: string;
  readonly isBoss: boolean;
  readonly baseHp: number;
  readonly baseAttack: number;
  readonly baseDefense: number;
  readonly baseSpeed: number;
  readonly xpReward: number;
  readonly goldReward: number;
  readonly levelScaling: number;
  readonly dropItemId?: string;
  readonly dropChance: number;
  readonly spriteKey?: string;
  readonly createdAt: Date;
}

export class StudyQuestEnemy {
  constructor(private readonly data: StudyQuestEnemyData) {}

  /**
   * Create StudyQuestEnemy from database row
   */
  static fromDatabase(row: {
    id: string;
    name: string;
    dungeon_id?: string | null;
    is_boss: boolean;
    base_hp: number;
    base_attack: number;
    base_defense: number;
    base_speed: number;
    xp_reward: number;
    gold_reward: number;
    level_scaling: number | string;
    drop_item_id?: string | null;
    drop_chance: number | string;
    sprite_key?: string | null;
    created_at: string | Date;
  }): StudyQuestEnemy {
    return new StudyQuestEnemy({
      id: row.id,
      name: row.name,
      dungeonId: row.dungeon_id ?? undefined,
      isBoss: row.is_boss,
      baseHp: row.base_hp,
      baseAttack: row.base_attack,
      baseDefense: row.base_defense,
      baseSpeed: row.base_speed,
      xpReward: row.xp_reward,
      goldReward: row.gold_reward,
      levelScaling: typeof row.level_scaling === 'string'
        ? parseFloat(row.level_scaling)
        : row.level_scaling,
      dropItemId: row.drop_item_id ?? undefined,
      dropChance: typeof row.drop_chance === 'string'
        ? parseFloat(row.drop_chance)
        : row.drop_chance,
      spriteKey: row.sprite_key ?? undefined,
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
  get dungeonId(): string | undefined {
    return this.data.dungeonId;
  }
  get isBoss(): boolean {
    return this.data.isBoss;
  }
  get baseHp(): number {
    return this.data.baseHp;
  }
  get baseAttack(): number {
    return this.data.baseAttack;
  }
  get baseDefense(): number {
    return this.data.baseDefense;
  }
  get baseSpeed(): number {
    return this.data.baseSpeed;
  }
  get xpReward(): number {
    return this.data.xpReward;
  }
  get goldReward(): number {
    return this.data.goldReward;
  }
  get levelScaling(): number {
    return this.data.levelScaling;
  }
  get dropItemId(): string | undefined {
    return this.data.dropItemId;
  }
  get dropChance(): number {
    return this.data.dropChance;
  }
  get spriteKey(): string | undefined {
    return this.data.spriteKey;
  }
  get createdAt(): Date {
    return this.data.createdAt;
  }

  /**
   * Get scaled stats based on floor number
   */
  getScaledStats(floorNumber: number): {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
  } {
    const scaleFactor = 1 + (floorNumber - 1) * this.levelScaling * 0.1;
    return {
      hp: Math.round(this.baseHp * scaleFactor),
      attack: Math.round(this.baseAttack * scaleFactor),
      defense: Math.round(this.baseDefense * scaleFactor),
      speed: Math.round(this.baseSpeed * scaleFactor),
    };
  }

  /**
   * Get scaled rewards based on floor number
   */
  getScaledRewards(floorNumber: number, multipliers?: { xp: number; gold: number }): {
    xp: number;
    gold: number;
  } {
    const scaleFactor = 1 + (floorNumber - 1) * 0.15;
    const xpMult = multipliers?.xp ?? 1;
    const goldMult = multipliers?.gold ?? 1;
    return {
      xp: Math.round(this.xpReward * scaleFactor * xpMult),
      gold: Math.round(this.goldReward * scaleFactor * goldMult),
    };
  }

  /**
   * Check if item drops based on chance
   */
  rollForDrop(): boolean {
    return Math.random() < this.dropChance;
  }

  /**
   * Convert to JSON for IPC transport
   */
  toJSON(): StudyQuestEnemyData {
    return { ...this.data };
  }
}

/**
 * Dungeon run state for tracking progress
 */
export interface DungeonRunState {
  dungeonId: string;
  currentFloor: number;
  currentEncounter: number;
  totalEncountersCleared: number;
  startedAt: Date;
  enemiesDefeated: string[];
  itemsFound: string[];
  xpEarned: number;
  goldEarned: number;
}
