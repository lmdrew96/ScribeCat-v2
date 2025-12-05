/**
 * StudyQuestBattle Entity
 *
 * Represents combat encounters and battle state in the StudyQuest RPG.
 * Handles turn-based combat logic, damage calculation, and battle outcomes.
 */

import type { StudyQuestCharacterData } from './StudyQuestCharacter.js';
import type { StudyQuestEnemyData } from './StudyQuestDungeon.js';

export type BattleAction = 'attack' | 'defend' | 'item' | 'flee';
export type BattleResult = 'victory' | 'defeat' | 'fled' | 'in_progress';
export type BattleTurn = 'player' | 'enemy';

export interface BattleParticipant {
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  isDefending: boolean;
}

export interface BattleLogEntry {
  turn: number;
  actor: 'player' | 'enemy';
  action: BattleAction;
  damage?: number;
  healing?: number;
  message: string;
  isCritical?: boolean;
  timestamp: Date;
}

export interface BattleRewards {
  xp: number;
  gold: number;
  droppedItemId?: string;
}

export interface StudyQuestBattleData {
  readonly id: string;
  readonly characterId: string;
  readonly enemyId: string;
  readonly dungeonId?: string;
  readonly floorNumber: number;
  readonly player: BattleParticipant;
  readonly enemy: BattleParticipant;
  readonly currentTurn: BattleTurn;
  readonly turnNumber: number;
  readonly result: BattleResult;
  readonly log: BattleLogEntry[];
  readonly rewards?: BattleRewards;
  readonly startedAt: Date;
  readonly endedAt?: Date;
}

/**
 * StudyQuestBattle domain entity
 *
 * Manages the state and logic for a single combat encounter.
 */
export class StudyQuestBattle {
  private _data: StudyQuestBattleData;

  constructor(data: StudyQuestBattleData) {
    this._data = { ...data };
  }

  /**
   * Create a new battle from character and enemy data
   */
  static create(params: {
    id: string;
    character: StudyQuestCharacterData;
    enemy: StudyQuestEnemyData;
    scaledEnemyStats: { hp: number; attack: number; defense: number; speed: number };
    dungeonId?: string;
    floorNumber: number;
  }): StudyQuestBattle {
    const { id, character, enemy, scaledEnemyStats, dungeonId, floorNumber } = params;

    const playerParticipant: BattleParticipant = {
      name: character.name,
      hp: character.hp,
      maxHp: character.maxHp,
      attack: character.attack,
      defense: character.defense,
      speed: character.speed,
      isDefending: false,
    };

    const enemyParticipant: BattleParticipant = {
      name: enemy.name,
      hp: scaledEnemyStats.hp,
      maxHp: scaledEnemyStats.hp,
      attack: scaledEnemyStats.attack,
      defense: scaledEnemyStats.defense,
      speed: scaledEnemyStats.speed,
      isDefending: false,
    };

    // Determine who goes first based on speed
    const playerFirst = playerParticipant.speed >= enemyParticipant.speed;

    return new StudyQuestBattle({
      id,
      characterId: character.id,
      enemyId: enemy.id,
      dungeonId,
      floorNumber,
      player: playerParticipant,
      enemy: enemyParticipant,
      currentTurn: playerFirst ? 'player' : 'enemy',
      turnNumber: 1,
      result: 'in_progress',
      log: [],
      startedAt: new Date(),
    });
  }

  // Getters
  get id(): string {
    return this._data.id;
  }
  get characterId(): string {
    return this._data.characterId;
  }
  get enemyId(): string {
    return this._data.enemyId;
  }
  get dungeonId(): string | undefined {
    return this._data.dungeonId;
  }
  get floorNumber(): number {
    return this._data.floorNumber;
  }
  get player(): BattleParticipant {
    return { ...this._data.player };
  }
  get enemy(): BattleParticipant {
    return { ...this._data.enemy };
  }
  get currentTurn(): BattleTurn {
    return this._data.currentTurn;
  }
  get turnNumber(): number {
    return this._data.turnNumber;
  }
  get result(): BattleResult {
    return this._data.result;
  }
  get log(): BattleLogEntry[] {
    return [...this._data.log];
  }
  get rewards(): BattleRewards | undefined {
    return this._data.rewards ? { ...this._data.rewards } : undefined;
  }
  get startedAt(): Date {
    return this._data.startedAt;
  }
  get endedAt(): Date | undefined {
    return this._data.endedAt;
  }

  /**
   * Check if battle is still in progress
   */
  get isInProgress(): boolean {
    return this._data.result === 'in_progress';
  }

  /**
   * Check if it's the player's turn
   */
  get isPlayerTurn(): boolean {
    return this._data.currentTurn === 'player';
  }

  /**
   * Calculate damage for an attack
   */
  private calculateDamage(
    attacker: BattleParticipant,
    defender: BattleParticipant
  ): { damage: number; isCritical: boolean } {
    // Base damage: (ATK * 2) - DEF
    let baseDamage = attacker.attack * 2 - defender.defense;

    // Apply defending bonus
    if (defender.isDefending) {
      baseDamage = Math.floor(baseDamage * 0.5);
    }

    // Add randomness (-3 to +3)
    const variance = Math.floor(Math.random() * 7) - 3;
    baseDamage += variance;

    // Critical hit (10% chance, 1.5x damage)
    const isCritical = Math.random() < 0.1;
    if (isCritical) {
      baseDamage = Math.floor(baseDamage * 1.5);
    }

    // Minimum 1 damage
    return {
      damage: Math.max(1, baseDamage),
      isCritical,
    };
  }

  /**
   * Process player action
   */
  processPlayerAction(action: BattleAction, itemEffect?: { healing: number }): BattleLogEntry {
    if (!this.isInProgress || !this.isPlayerTurn) {
      throw new Error('Cannot process player action at this time');
    }

    const entry: BattleLogEntry = {
      turn: this._data.turnNumber,
      actor: 'player',
      action,
      message: '',
      timestamp: new Date(),
    };

    // Reset defending status
    this._data.player.isDefending = false;

    switch (action) {
      case 'attack': {
        const { damage, isCritical } = this.calculateDamage(this._data.player, this._data.enemy);
        this._data.enemy.hp = Math.max(0, this._data.enemy.hp - damage);
        entry.damage = damage;
        entry.isCritical = isCritical;
        entry.message = isCritical
          ? `Critical hit! ${this._data.player.name} deals ${damage} damage!`
          : `${this._data.player.name} attacks for ${damage} damage!`;
        break;
      }

      case 'defend': {
        this._data.player.isDefending = true;
        // Small HP recovery when defending
        const healAmount = Math.floor(this._data.player.maxHp * 0.05);
        this._data.player.hp = Math.min(
          this._data.player.maxHp,
          this._data.player.hp + healAmount
        );
        entry.healing = healAmount;
        entry.message = `${this._data.player.name} defends and recovers ${healAmount} HP!`;
        break;
      }

      case 'item': {
        if (itemEffect?.healing) {
          this._data.player.hp = Math.min(
            this._data.player.maxHp,
            this._data.player.hp + itemEffect.healing
          );
          entry.healing = itemEffect.healing;
          entry.message = `${this._data.player.name} uses an item and recovers ${itemEffect.healing} HP!`;
        }
        break;
      }

      case 'flee': {
        // 50% base flee chance, modified by speed difference
        const speedDiff = this._data.player.speed - this._data.enemy.speed;
        const fleeChance = Math.min(0.9, Math.max(0.1, 0.5 + speedDiff * 0.05));
        const success = Math.random() < fleeChance;

        if (success) {
          this._data.result = 'fled';
          this._data.endedAt = new Date();
          entry.message = `${this._data.player.name} successfully fled from battle!`;
        } else {
          entry.message = `${this._data.player.name} failed to escape!`;
        }
        break;
      }
    }

    this._data.log.push(entry);

    // Check for victory
    if (this._data.enemy.hp <= 0) {
      this._data.result = 'victory';
      this._data.endedAt = new Date();
    } else if (this._data.result === 'in_progress') {
      // Switch to enemy turn
      this._data.currentTurn = 'enemy';
    }

    return entry;
  }

  /**
   * Process enemy turn (AI)
   */
  processEnemyTurn(): BattleLogEntry {
    if (!this.isInProgress || this.isPlayerTurn) {
      throw new Error('Cannot process enemy turn at this time');
    }

    // Reset enemy defending status
    this._data.enemy.isDefending = false;

    // Simple AI: Attack most of the time, occasionally defend when low HP
    const enemyHpPercent = this._data.enemy.hp / this._data.enemy.maxHp;
    const shouldDefend = enemyHpPercent < 0.3 && Math.random() < 0.3;

    const entry: BattleLogEntry = {
      turn: this._data.turnNumber,
      actor: 'enemy',
      action: shouldDefend ? 'defend' : 'attack',
      message: '',
      timestamp: new Date(),
    };

    if (shouldDefend) {
      this._data.enemy.isDefending = true;
      const healAmount = Math.floor(this._data.enemy.maxHp * 0.03);
      this._data.enemy.hp = Math.min(this._data.enemy.maxHp, this._data.enemy.hp + healAmount);
      entry.healing = healAmount;
      entry.message = `${this._data.enemy.name} takes a defensive stance!`;
    } else {
      const { damage, isCritical } = this.calculateDamage(this._data.enemy, this._data.player);
      this._data.player.hp = Math.max(0, this._data.player.hp - damage);
      entry.damage = damage;
      entry.isCritical = isCritical;
      entry.message = isCritical
        ? `Critical hit! ${this._data.enemy.name} deals ${damage} damage!`
        : `${this._data.enemy.name} attacks for ${damage} damage!`;
    }

    this._data.log.push(entry);

    // Check for defeat
    if (this._data.player.hp <= 0) {
      this._data.result = 'defeat';
      this._data.endedAt = new Date();
    } else {
      // Increment turn and switch to player
      this._data.turnNumber++;
      this._data.currentTurn = 'player';
    }

    return entry;
  }

  /**
   * Set battle rewards (called on victory)
   */
  setRewards(rewards: BattleRewards): void {
    this._data = {
      ...this._data,
      rewards,
    };
  }

  /**
   * Get the final player HP (for updating character after battle)
   */
  getFinalPlayerHp(): number {
    return this._data.player.hp;
  }

  /**
   * Convert to JSON for IPC transport
   */
  toJSON(): StudyQuestBattleData {
    return {
      ...this._data,
      player: { ...this._data.player },
      enemy: { ...this._data.enemy },
      log: this._data.log.map((entry) => ({ ...entry })),
      rewards: this._data.rewards ? { ...this._data.rewards } : undefined,
    };
  }
}

/**
 * Combat log entry for database storage
 */
export interface CombatLogRecord {
  characterId: string;
  enemyId: string;
  dungeonId?: string;
  floorNumber?: number;
  result: 'victory' | 'defeat' | 'fled';
  damageDealt: number;
  damageTaken: number;
  xpEarned: number;
  goldEarned: number;
  itemDroppedId?: string;
  turnsTaken: number;
}

/**
 * Create a combat log record from a completed battle
 */
export function createCombatLogRecord(battle: StudyQuestBattle): CombatLogRecord {
  const log = battle.log;

  // Calculate totals from log
  const damageDealt = log
    .filter((e) => e.actor === 'player' && e.damage)
    .reduce((sum, e) => sum + (e.damage ?? 0), 0);

  const damageTaken = log
    .filter((e) => e.actor === 'enemy' && e.damage)
    .reduce((sum, e) => sum + (e.damage ?? 0), 0);

  return {
    characterId: battle.characterId,
    enemyId: battle.enemyId,
    dungeonId: battle.dungeonId,
    floorNumber: battle.floorNumber,
    result: battle.result as 'victory' | 'defeat' | 'fled',
    damageDealt,
    damageTaken,
    xpEarned: battle.rewards?.xp ?? 0,
    goldEarned: battle.rewards?.gold ?? 0,
    itemDroppedId: battle.rewards?.droppedItemId,
    turnsTaken: battle.turnNumber,
  };
}
