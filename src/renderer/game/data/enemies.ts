/**
 * Enemy Definitions for StudyQuest
 *
 * Each enemy has base stats, sprite info, and reward data.
 * Stats scale with dungeon floor level.
 *
 * FIXES:
 * - Added spriteSize to each enemy for proper scaling calculation
 * - Slimes have small sprites (32x32), other enemies are large (100-200px)
 */

export type EnemyTier = 'low' | 'mid' | 'high' | 'boss';

export interface EnemyDefinition {
  id: string;
  name: string;
  description: string;

  // Sprite assets
  // For animated enemies: folder name in assets/ENEMIES/<folder>/
  // For static enemies: filename in assets/ENEMIES/OTHER_ENEMIES/
  spriteFolder?: string;
  spriteFile?: string; // Single image file for non-animated enemies

  // FIXED: Approximate sprite dimensions for scaling calculation
  // This is the raw pixel size of the sprite
  spriteSize: number; // Assumes roughly square sprites

  // Base combat stats (scale with floor)
  baseHp: number;
  baseAttack: number;
  baseDefense: number;

  // Rewards
  xpReward: number;
  goldReward: [number, number]; // [min, max]

  // AI behavior
  aiType: 'basic' | 'defensive' | 'aggressive';

  // Enemy tier (determines which floors they appear on)
  tier: EnemyTier;

  // Visual color for placeholder (RGB)
  placeholderColor?: [number, number, number];

  // Animation frame counts (for sprite loading) - only for animated enemies
  animations?: {
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
  // === ANIMATED SLIME ENEMIES (small 32x32 sprite sheets) ===
  grey_slime: {
    id: 'grey_slime',
    name: 'Grey Slime',
    description: 'A bouncy grey slime. Harmless but persistent.',
    spriteFolder: 'GREY_CAT_SLIME',
    spriteSize: 32, // Small sprite sheet frames
    baseHp: 30,
    baseAttack: 8,
    baseDefense: 2,
    xpReward: 15,
    goldReward: [5, 10],
    aiType: 'basic',
    tier: 'low',
    placeholderColor: [128, 128, 128],
    animations: {
      idle: 4,
      attack: 5,
      hurt: 4,
      death: 4,
    },
  },

  demon_slime: {
    id: 'demon_slime',
    name: 'Demon Slime',
    description: 'A fiery slime infused with dark energy.',
    spriteFolder: 'DEMONIC_CAT_SLIME',
    spriteSize: 32, // Small sprite sheet frames
    baseHp: 50,
    baseAttack: 12,
    baseDefense: 4,
    xpReward: 30,
    goldReward: [10, 20],
    aiType: 'aggressive',
    tier: 'mid',
    placeholderColor: [200, 50, 50],
    animations: {
      idle: 4,
      attack: 5,
      hurt: 4,
      death: 4,
    },
  },

  baby_blue_slime: {
    id: 'baby_blue_slime',
    name: 'Baby Blue Slime',
    description: 'A cute but deceptively quick azure slime.',
    spriteFolder: 'BABY_BLUE_CAT_SLIME',
    spriteSize: 32,
    baseHp: 25,
    baseAttack: 7,
    baseDefense: 2,
    xpReward: 12,
    goldReward: [4, 8],
    aiType: 'basic',
    tier: 'low',
    placeholderColor: [135, 206, 250],
    animations: {
      idle: 4,
      attack: 5,
      hurt: 4,
      death: 4,
    },
  },

  black_slime: {
    id: 'black_slime',
    name: 'Black Slime',
    description: 'A shadowy slime that lurks in dark corners.',
    spriteFolder: 'BLACK_CAT_SLIME',
    spriteSize: 32,
    baseHp: 40,
    baseAttack: 10,
    baseDefense: 3,
    xpReward: 22,
    goldReward: [7, 14],
    aiType: 'defensive',
    tier: 'low',
    placeholderColor: [30, 30, 30],
    animations: {
      idle: 4,
      attack: 5,
      hurt: 4,
      death: 4,
    },
  },

  brown_slime: {
    id: 'brown_slime',
    name: 'Brown Slime',
    description: 'An earthy slime that blends in with dungeon floors.',
    spriteFolder: 'BROWN_CAT_SLIME',
    spriteSize: 32,
    baseHp: 35,
    baseAttack: 9,
    baseDefense: 4,
    xpReward: 18,
    goldReward: [6, 12],
    aiType: 'basic',
    tier: 'low',
    placeholderColor: [139, 90, 43],
    animations: {
      idle: 4,
      attack: 5,
      hurt: 4,
      death: 4,
    },
  },

  rainbow_slime: {
    id: 'rainbow_slime',
    name: 'Rainbow Slime',
    description: 'A rare prismatic slime. Lucky cats get bonus drops!',
    spriteFolder: 'RAINBOW_CAT_SLIME',
    spriteSize: 32,
    baseHp: 60,
    baseAttack: 14,
    baseDefense: 5,
    xpReward: 45,
    goldReward: [20, 40],
    aiType: 'defensive',
    tier: 'mid',
    placeholderColor: [255, 100, 200],
    animations: {
      idle: 4,
      attack: 5,
      hurt: 4,
      death: 4,
    },
  },

  // === RAT ENEMIES (large ~150-200px sprites) ===
  rat: {
    id: 'rat',
    name: 'Rat',
    description: 'A common dungeon rat. Quick but weak.',
    spriteFile: 'Rat.png',
    spriteSize: 100, // Smaller rat sprite
    baseHp: 20,
    baseAttack: 6,
    baseDefense: 1,
    xpReward: 10,
    goldReward: [3, 7],
    aiType: 'basic',
    tier: 'low',
    placeholderColor: [100, 80, 60],
  },

  rat_fighter: {
    id: 'rat_fighter',
    name: 'Rat Fighter',
    description: 'A rat that has learned to fight back.',
    spriteFile: 'RatFighter.png',
    spriteSize: 150,
    baseHp: 35,
    baseAttack: 10,
    baseDefense: 3,
    xpReward: 20,
    goldReward: [8, 15],
    aiType: 'aggressive',
    tier: 'low',
    placeholderColor: [120, 90, 70],
  },

  rat_warrior: {
    id: 'rat_warrior',
    name: 'Rat Warrior',
    description: 'An armored rat with sword and shield.',
    spriteFile: 'Rat Warrior.png',
    spriteSize: 200, // Large detailed sprite
    baseHp: 55,
    baseAttack: 14,
    baseDefense: 6,
    xpReward: 35,
    goldReward: [12, 22],
    aiType: 'defensive',
    tier: 'mid',
    placeholderColor: [140, 100, 80],
  },

  rat_ranger: {
    id: 'rat_ranger',
    name: 'Rat Ranger',
    description: 'A swift rat archer. High damage, low defense.',
    spriteFile: 'Rat Ranger.png',
    spriteSize: 180,
    baseHp: 40,
    baseAttack: 16,
    baseDefense: 2,
    xpReward: 30,
    goldReward: [10, 18],
    aiType: 'aggressive',
    tier: 'mid',
    placeholderColor: [80, 120, 80],
  },

  rat_mage: {
    id: 'rat_mage',
    name: 'Rat Mage',
    description: 'A mystical rat wielding dark magic.',
    spriteFile: 'Rat-Mage.png',
    spriteSize: 180,
    baseHp: 45,
    baseAttack: 18,
    baseDefense: 3,
    xpReward: 40,
    goldReward: [15, 25],
    aiType: 'aggressive',
    tier: 'mid',
    placeholderColor: [100, 80, 140],
  },

  rat_necromancer: {
    id: 'rat_necromancer',
    name: 'Rat Necromancer',
    description: 'A powerful rat that commands the undead. Mini-boss.',
    spriteFile: 'Rat Necromancer.png',
    spriteSize: 200,
    baseHp: 80,
    baseAttack: 20,
    baseDefense: 5,
    xpReward: 60,
    goldReward: [25, 40],
    aiType: 'defensive',
    tier: 'high',
    placeholderColor: [60, 40, 80],
  },

  // === DOG ENEMIES (large sprites) ===
  ruff_dog: {
    id: 'ruff_dog',
    name: 'Ruff Dog',
    description: 'A tough street dog looking for trouble.',
    spriteFile: 'Ruff Dog.png',
    spriteSize: 180,
    baseHp: 50,
    baseAttack: 13,
    baseDefense: 4,
    xpReward: 28,
    goldReward: [10, 18],
    aiType: 'aggressive',
    tier: 'mid',
    placeholderColor: [139, 90, 43],
  },

  dog_with_axe: {
    id: 'dog_with_axe',
    name: 'Dog with Axe',
    description: 'A fearsome hound wielding a massive battle axe!',
    spriteFile: 'Dog With Axe.png',
    spriteSize: 220,
    baseHp: 75,
    baseAttack: 22,
    baseDefense: 6,
    xpReward: 55,
    goldReward: [20, 35],
    aiType: 'aggressive',
    tier: 'high',
    placeholderColor: [160, 100, 50],
  },

  // === OTHER ENEMIES ===
  squirrel_warrior: {
    id: 'squirrel_warrior',
    name: 'Squirrel Warrior',
    description: 'A nimble squirrel with tiny but deadly weapons.',
    spriteFile: 'Squirrel Warrior.png',
    spriteSize: 150,
    baseHp: 38,
    baseAttack: 11,
    baseDefense: 4,
    xpReward: 25,
    goldReward: [8, 14],
    aiType: 'defensive',
    tier: 'mid',
    placeholderColor: [180, 140, 100],
  },

  yarn_elemental: {
    id: 'yarn_elemental',
    name: 'Yarn Elemental',
    description: 'A magical ball of yarn come to life. Cats beware!',
    spriteFile: 'Yarn_Elemental.png',
    spriteSize: 160,
    baseHp: 70,
    baseAttack: 17,
    baseDefense: 8,
    xpReward: 50,
    goldReward: [18, 30],
    aiType: 'defensive',
    tier: 'high',
    placeholderColor: [255, 100, 150],
  },

  // === FUN/QUIRKY ENEMIES ===
  roomba: {
    id: 'roomba',
    name: 'Angry Roomba',
    description: 'A rogue vacuum cleaner with a grudge against cats!',
    spriteFile: 'Roomba.png',
    spriteSize: 120,
    baseHp: 25,
    baseAttack: 7,
    baseDefense: 5,
    xpReward: 12,
    goldReward: [5, 12],
    aiType: 'basic',
    tier: 'low',
    placeholderColor: [50, 50, 50],
  },

  rubber_ducky: {
    id: 'rubber_ducky',
    name: 'Big Rubber Ducky',
    description: 'An oversized bath toy with surprising combat skills.',
    spriteFile: 'Big_Rubber_Duky.png',
    spriteSize: 140,
    baseHp: 45,
    baseAttack: 9,
    baseDefense: 7,
    xpReward: 22,
    goldReward: [8, 16],
    aiType: 'defensive',
    tier: 'mid',
    placeholderColor: [255, 220, 0],
  },

  tuna_can_battler: {
    id: 'tuna_can_battler',
    name: 'Tuna Can Battler',
    description: 'An animated tuna can. Smells fishy...',
    spriteFile: 'TunaCan-Battler.png',
    spriteSize: 130,
    baseHp: 42,
    baseAttack: 10,
    baseDefense: 6,
    xpReward: 24,
    goldReward: [9, 17],
    aiType: 'basic',
    tier: 'mid',
    placeholderColor: [192, 192, 192],
  },

  // === BOSS ENEMY ===
  boss: {
    id: 'boss',
    name: 'Dungeon Guardian',
    description: 'The fearsome guardian of this dungeon floor.',
    spriteFile: 'Dog With Axe.png', // Use dog with axe as boss for now
    spriteSize: 220,
    baseHp: 150,
    baseAttack: 25,
    baseDefense: 10,
    xpReward: 100,
    goldReward: [50, 100],
    aiType: 'aggressive',
    tier: 'boss',
    placeholderColor: [180, 40, 40],
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

/**
 * Calculate the scale factor needed to display a sprite at a target size
 * This normalizes all enemies to roughly the same display size
 */
export function calculateEnemyScale(
  enemy: EnemyDefinition,
  targetSize: number
): number {
  return targetSize / enemy.spriteSize;
}
