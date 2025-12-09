/**
 * Enemy Definitions for StudyQuest
 *
 * Each enemy has base stats, sprite info, and reward data.
 * Stats scale with dungeon floor level.
 */

export interface EnemyDefinition {
  id: string;
  name: string;
  description: string;

  // Sprite assets (in assets/ENEMIES/<folder>/)
  spriteFolder: string;

  // Base combat stats (scale with floor)
  baseHp: number;
  baseAttack: number;
  baseDefense: number;

  // Rewards
  xpReward: number;
  goldReward: [number, number]; // [min, max]

  // AI behavior
  aiType: 'basic' | 'defensive' | 'aggressive';

  // Animation frame counts (for sprite loading)
  animations: {
    idle: number;
    attack: number;
    hurt: number;
    death: number;
  };
}

/**
 * All enemy definitions
 */
export const ENEMIES: Record<string, EnemyDefinition> = {
  grey_slime: {
    id: 'grey_slime',
    name: 'Grey Slime',
    description: 'A bouncy grey slime. Harmless but persistent.',
    spriteFolder: 'GREY_CAT_SLIME',
    baseHp: 30,
    baseAttack: 8,
    baseDefense: 2,
    xpReward: 15,
    goldReward: [5, 10],
    aiType: 'basic',
    animations: {
      idle: 1,
      attack: 1,
      hurt: 1,
      death: 1,
    },
  },

  demon_slime: {
    id: 'demon_slime',
    name: 'Demon Slime',
    description: 'A fiery slime infused with dark energy.',
    spriteFolder: 'DEMONIC_CAT_SLIME',
    baseHp: 50,
    baseAttack: 12,
    baseDefense: 4,
    xpReward: 30,
    goldReward: [10, 20],
    aiType: 'aggressive',
    animations: {
      idle: 1,
      attack: 1,
      hurt: 1,
      death: 1,
    },
  },
};

/**
 * Get enemy definition by ID
 */
export function getEnemy(id: string): EnemyDefinition | undefined {
  return ENEMIES[id];
}

/**
 * Get a random enemy from the pool
 */
export function getRandomEnemy(
  pool?: string[]
): EnemyDefinition {
  const ids = pool || Object.keys(ENEMIES);
  const randomId = ids[Math.floor(Math.random() * ids.length)];
  return ENEMIES[randomId] || ENEMIES['grey_slime'];
}

/**
 * Scale enemy stats based on floor level
 */
export function scaleEnemyStats(
  enemy: EnemyDefinition,
  floorLevel: number
): { hp: number; attack: number; defense: number } {
  const scaleFactor = 1 + (floorLevel - 1) * 0.15; // 15% increase per floor
  return {
    hp: Math.floor(enemy.baseHp * scaleFactor),
    attack: Math.floor(enemy.baseAttack * scaleFactor),
    defense: Math.floor(enemy.baseDefense * scaleFactor),
  };
}

/**
 * Calculate gold reward (random within range, scaled by floor)
 */
export function calculateGoldReward(
  enemy: EnemyDefinition,
  floorLevel: number
): number {
  const [min, max] = enemy.goldReward;
  const base = Math.floor(Math.random() * (max - min + 1)) + min;
  const scaleFactor = 1 + (floorLevel - 1) * 0.1; // 10% bonus per floor
  return Math.floor(base * scaleFactor);
}

/**
 * Calculate XP reward (scaled by floor)
 */
export function calculateXpReward(
  enemy: EnemyDefinition,
  floorLevel: number
): number {
  const scaleFactor = 1 + (floorLevel - 1) * 0.1;
  return Math.floor(enemy.xpReward * scaleFactor);
}
