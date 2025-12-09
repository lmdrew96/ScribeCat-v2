/**
 * Battle System for StudyQuest
 *
 * Handles damage calculation, turn order, and combat logic.
 */

import type { EnemyDefinition } from '../data/enemies.js';

export interface CombatStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  luck?: number;
}

export interface DamageResult {
  damage: number;
  isCrit: boolean;
  isMiss: boolean;
}

/**
 * Calculate damage dealt
 *
 * Formula:
 * baseDamage = attacker.attack - defender.defense / 2
 * randomized = baseDamage * random(0.8, 1.2)
 * final = max(1, floor(randomized))
 */
export function calculateDamage(
  attacker: CombatStats,
  defender: CombatStats,
  isDefending = false
): DamageResult {
  // Miss check (5% base miss chance)
  const missChance = 0.05;
  if (Math.random() < missChance) {
    return { damage: 0, isCrit: false, isMiss: true };
  }

  // Critical hit check (10% base, + luck)
  const critChance = 0.10 + (attacker.luck || 0) * 0.01;
  const isCrit = Math.random() < critChance;
  const critMultiplier = isCrit ? 1.5 : 1.0;

  // Base damage calculation
  const baseDamage = attacker.attack - defender.defense / 2;

  // Random variance (0.8 - 1.2)
  const variance = 0.8 + Math.random() * 0.4;

  // Calculate final damage
  let finalDamage = Math.floor(baseDamage * variance * critMultiplier);

  // Apply defending reduction (50%)
  if (isDefending) {
    finalDamage = Math.floor(finalDamage / 2);
  }

  // Minimum 1 damage
  finalDamage = Math.max(1, finalDamage);

  return { damage: finalDamage, isCrit, isMiss: false };
}

/**
 * Apply damage to a combatant
 */
export function applyDamage(target: CombatStats, damage: number): number {
  target.hp = Math.max(0, target.hp - damage);
  return target.hp;
}

/**
 * Apply healing to a combatant
 */
export function applyHealing(target: CombatStats, amount: number): number {
  const actualHeal = Math.min(amount, target.maxHp - target.hp);
  target.hp = Math.min(target.maxHp, target.hp + amount);
  return actualHeal;
}

/**
 * Check if combatant is defeated
 */
export function isDefeated(combatant: CombatStats): boolean {
  return combatant.hp <= 0;
}

/**
 * Enemy AI - decide action
 */
export type EnemyAction = 'attack' | 'defend' | 'special';

export function decideEnemyAction(
  enemy: EnemyDefinition,
  enemyStats: CombatStats,
  playerStats: CombatStats
): EnemyAction {
  const hpPercent = enemyStats.hp / enemyStats.maxHp;

  switch (enemy.aiType) {
    case 'aggressive':
      // Always attack
      return 'attack';

    case 'defensive':
      // Defend when low HP
      if (hpPercent < 0.3 && Math.random() < 0.5) {
        return 'defend';
      }
      return 'attack';

    case 'basic':
    default:
      // Random chance to defend
      if (Math.random() < 0.15) {
        return 'defend';
      }
      return 'attack';
  }
}

/**
 * Calculate flee success chance
 * Base 40% + speed difference
 */
export function calculateFleeChance(
  playerLevel: number,
  enemyBaseLevel: number
): number {
  const levelDiff = playerLevel - enemyBaseLevel;
  const baseChance = 0.4;
  const levelBonus = levelDiff * 0.05; // 5% per level difference
  return Math.min(0.9, Math.max(0.1, baseChance + levelBonus));
}

/**
 * Attempt to flee from battle
 */
export function attemptFlee(
  playerLevel: number,
  enemyBaseLevel: number
): boolean {
  const chance = calculateFleeChance(playerLevel, enemyBaseLevel);
  return Math.random() < chance;
}

/**
 * Battle state machine phases
 */
export type BattlePhase =
  | 'intro'
  | 'player_turn'
  | 'player_action'
  | 'enemy_turn'
  | 'enemy_action'
  | 'victory'
  | 'defeat'
  | 'flee';

/**
 * Player action types
 */
export type PlayerAction = 'attack' | 'defend' | 'item' | 'flee';

/**
 * Battle state container
 */
export interface BattleState {
  phase: BattlePhase;

  // Combatants
  playerStats: CombatStats;
  enemyStats: CombatStats;
  enemyDef: EnemyDefinition;

  // Turn state
  playerDefending: boolean;
  enemyDefending: boolean;
  turnCount: number;

  // Rewards (calculated on victory)
  xpReward: number;
  goldReward: number;

  // Return info
  returnScene: string;
  returnData?: unknown;
}

/**
 * Create initial battle state
 */
export function createBattleState(
  playerStats: CombatStats,
  enemyDef: EnemyDefinition,
  enemyStats: CombatStats,
  returnScene: string,
  returnData?: unknown
): BattleState {
  return {
    phase: 'intro',
    playerStats: { ...playerStats },
    enemyStats: { ...enemyStats },
    enemyDef,
    playerDefending: false,
    enemyDefending: false,
    turnCount: 0,
    xpReward: 0,
    goldReward: 0,
    returnScene,
    returnData,
  };
}

/**
 * Get XP required for next level
 */
export function getXpForLevel(level: number): number {
  // Exponential curve: 100, 250, 450, 700, 1000...
  return Math.floor(100 * level + 50 * level * (level - 1));
}

/**
 * Check if player can level up
 */
export function canLevelUp(xp: number, level: number): boolean {
  return xp >= getXpForLevel(level);
}

/**
 * Get stat increases for level up
 */
export function getLevelUpStats(newLevel: number): {
  maxHp: number;
  attack: number;
  defense: number;
} {
  return {
    maxHp: 10 + Math.floor(newLevel / 2) * 2,
    attack: 2 + Math.floor(newLevel / 3),
    defense: 1 + Math.floor(newLevel / 4),
  };
}
