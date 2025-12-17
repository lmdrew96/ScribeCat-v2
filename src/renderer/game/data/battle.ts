/**
 * Battle Data
 *
 * Constants and calculations for the battle system.
 * Engine-agnostic - works with any rendering system.
 */

// Battle phases
export type BattlePhase =
  | 'start'
  | 'player_turn'
  | 'player_action'
  | 'enemy_turn'
  | 'enemy_action'
  | 'victory'
  | 'defeat'
  | 'flee';

// Combat stats interface
export interface CombatStats {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  attack: number;
  defense: number;
  magic: number;
  speed: number;
}

// XP curve - exponential growth
const XP_BASE = 100;
const XP_MULTIPLIER = 1.5;

/**
 * Calculate XP required to reach a specific level
 */
export function getXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(XP_BASE * Math.pow(XP_MULTIPLIER, level - 2));
}

/**
 * Calculate total XP needed from level 1 to target level
 */
export function getTotalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += getXpForLevel(i);
  }
  return total;
}

/**
 * Get stat increases when leveling up
 */
export function getLevelUpStats(newLevel: number): {
  maxHealth: number;
  maxMana: number;
  attack: number;
  defense: number;
  magic: number;
} {
  // Base stat increases per level
  const baseHealth = 10;
  const baseMana = 5;
  const baseAttack = 2;
  const baseDefense = 1;
  const baseMagic = 2;

  // Every 5 levels, get bonus stats
  const bonusMultiplier = Math.floor(newLevel / 5);

  return {
    maxHealth: baseHealth + bonusMultiplier * 5,
    maxMana: baseMana + bonusMultiplier * 3,
    attack: baseAttack + (newLevel % 3 === 0 ? 1 : 0),
    defense: baseDefense + (newLevel % 4 === 0 ? 1 : 0),
    magic: baseMagic + (newLevel % 3 === 0 ? 1 : 0),
  };
}

/**
 * Calculate damage dealt in battle
 */
export function calculateDamage(
  attackerAttack: number,
  defenderDefense: number,
  isPhysical: boolean = true,
  variance: number = 0.2
): number {
  // Base damage formula
  let baseDamage = attackerAttack - defenderDefense / 2;
  baseDamage = Math.max(1, baseDamage); // Minimum 1 damage

  // Add variance
  const varianceAmount = baseDamage * variance;
  const finalDamage = baseDamage + (Math.random() * varianceAmount * 2 - varianceAmount);

  return Math.max(1, Math.floor(finalDamage));
}

/**
 * Calculate XP reward from defeating an enemy
 */
export function calculateXpReward(enemyLevel: number, playerLevel: number): number {
  const baseXp = 20 + enemyLevel * 10;

  // Level difference modifier
  const levelDiff = enemyLevel - playerLevel;
  let modifier = 1.0;

  if (levelDiff > 0) {
    // Enemy higher level = more XP
    modifier = 1 + levelDiff * 0.1;
  } else if (levelDiff < -3) {
    // Enemy much lower level = less XP
    modifier = Math.max(0.1, 1 + levelDiff * 0.15);
  }

  return Math.floor(baseXp * modifier);
}

/**
 * Calculate gold reward from defeating an enemy
 */
export function calculateGoldReward(enemyLevel: number, isBoss: boolean = false): number {
  const baseGold = 5 + enemyLevel * 3;
  const bossMultiplier = isBoss ? 5 : 1;
  const variance = 0.3;

  const varianceAmount = baseGold * variance;
  const finalGold = baseGold + (Math.random() * varianceAmount * 2 - varianceAmount);

  return Math.floor(finalGold * bossMultiplier);
}

/**
 * Apply damage to a combatant
 */
export function applyDamage(stats: CombatStats, damage: number): number {
  const actualDamage = Math.min(stats.health, damage);
  stats.health = Math.max(0, stats.health - damage);
  return actualDamage;
}

/**
 * Check if a combatant is defeated
 */
export function isDefeated(stats: CombatStats): boolean {
  return stats.health <= 0;
}

/**
 * Decide enemy action based on AI
 */
export function decideEnemyAction(
  enemyStats: CombatStats,
  playerStats: CombatStats,
  availableActions: string[] = ['attack']
): string {
  // Simple AI - mostly attack, sometimes heal if low
  const healthRatio = enemyStats.health / enemyStats.maxHealth;

  // If enemy has heal action and is low health, 40% chance to heal
  if (availableActions.includes('heal') && healthRatio < 0.3 && Math.random() < 0.4) {
    return 'heal';
  }

  // If enemy has magic and player defense is high, use magic
  if (availableActions.includes('magic') && playerStats.defense > enemyStats.attack * 0.8) {
    if (Math.random() < 0.5 && enemyStats.mana >= 10) {
      return 'magic';
    }
  }

  // If enemy has special attack, 20% chance to use it
  if (availableActions.includes('special') && Math.random() < 0.2) {
    return 'special';
  }

  // Default to basic attack
  return 'attack';
}

/**
 * Attempt to flee from battle
 */
export function attemptFlee(playerSpeed: number, enemySpeed: number): boolean {
  // Base 50% flee chance, modified by speed difference
  const speedRatio = playerSpeed / Math.max(1, enemySpeed);
  const fleeChance = 0.5 * speedRatio;

  // Clamp between 10% and 90%
  const clampedChance = Math.max(0.1, Math.min(0.9, fleeChance));

  return Math.random() < clampedChance;
}
