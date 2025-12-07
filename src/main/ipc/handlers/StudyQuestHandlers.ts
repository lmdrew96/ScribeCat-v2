/**
 * StudyQuest IPC Handlers
 *
 * Handles IPC communication for the StudyQuest RPG mini-game.
 * Manages characters, inventory, dungeons, battles, and quests.
 */

import { ipcMain } from 'electron';
import { SupabaseStudyQuestRepository } from '../../../infrastructure/services/supabase/SupabaseStudyQuestRepository.js';
import type { CharacterClass } from '../../../domain/entities/StudyQuestCharacter.js';
import type { BattleAction } from '../../../domain/entities/StudyQuestBattle.js';
import {
  StudyQuestBattle,
  createCombatLogRecord,
} from '../../../domain/entities/StudyQuestBattle.js';

const studyQuestRepo = new SupabaseStudyQuestRepository();

// Store active battles in memory (they're short-lived)
const activeBattles = new Map<string, StudyQuestBattle>();

/**
 * Register all StudyQuest-related IPC handlers
 *
 * NOTE: Realtime subscriptions are handled directly in the renderer process
 * via RendererSupabaseClient (WebSockets don't work in Electron's main process).
 */
export function registerStudyQuestHandlers(): void {
  // ============================================================================
  // Character Handlers
  // ============================================================================

  ipcMain.handle('studyquest:get-classes', async () => {
    try {
      const classes = await studyQuestRepo.getClasses();
      return { success: true, classes };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get classes:', error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(
    'studyquest:create-character',
    async (
      _event,
      params: { userId: string; name: string; classId: CharacterClass }
    ) => {
      try {
        const character = await studyQuestRepo.createCharacter(params);
        return { success: true, character: character.toJSON() };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to create character:', error);
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle('studyquest:get-character', async (_event, userId: string) => {
    try {
      const character = await studyQuestRepo.getCharacterByUserId(userId);
      return { success: true, character: character?.toJSON() ?? null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get character:', error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(
    'studyquest:add-xp',
    async (_event, params: { characterId: string; amount: number }) => {
      try {
        const result = await studyQuestRepo.addXp(params.characterId, params.amount);
        return { success: true, result };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to add XP:', error);
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'studyquest:add-gold',
    async (_event, params: { characterId: string; amount: number }) => {
      try {
        const character = await studyQuestRepo.addGold(params.characterId, params.amount);
        return { success: true, character: character.toJSON() };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to add gold:', error);
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle('studyquest:heal-character', async (_event, params: { characterId: string; cost: number }) => {
    try {
      const character = await studyQuestRepo.healCharacterWithCost(params.characterId, params.cost);
      return { success: true, character: character.toJSON() };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to heal character:', error);
      return { success: false, error: message };
    }
  });

  // Take damage directly (from dungeon traps, etc.)
  ipcMain.handle('studyquest:take-damage', async (_event, params: { characterId: string; amount: number }) => {
    try {
      const character = await studyQuestRepo.getCharacter(params.characterId);
      if (!character) {
        return { success: false, error: 'Character not found' };
      }
      const newHp = Math.max(0, character.hp - params.amount);
      const updated = await studyQuestRepo.updateHp(params.characterId, newHp);
      return { success: true, character: updated.toJSON() };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to apply damage:', error);
      return { success: false, error: message };
    }
  });

  // Heal character directly by amount (from dungeon rest points, etc.)
  ipcMain.handle('studyquest:heal-direct', async (_event, params: { characterId: string; amount: number }) => {
    try {
      const character = await studyQuestRepo.getCharacter(params.characterId);
      if (!character) {
        return { success: false, error: 'Character not found' };
      }
      const newHp = Math.min(character.maxHp, character.hp + params.amount);
      const updated = await studyQuestRepo.updateHp(params.characterId, newHp);
      return { success: true, character: updated.toJSON() };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to heal character:', error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('studyquest:delete-character', async (_event, characterId: string) => {
    try {
      await studyQuestRepo.deleteCharacter(characterId);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to delete character:', error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('studyquest:delete-character-by-user', async (_event, userId: string) => {
    try {
      await studyQuestRepo.deleteCharacterByUserId(userId);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to delete character by user:', error);
      return { success: false, error: message };
    }
  });

  // ============================================================================
  // Inventory Handlers
  // ============================================================================

  ipcMain.handle('studyquest:get-inventory', async (_event, characterId: string) => {
    try {
      const inventory = await studyQuestRepo.getInventory(characterId);
      return {
        success: true,
        inventory: inventory.map((slot) => ({
          ...slot,
          item: slot.item.toJSON(),
        })),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get inventory:', error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('studyquest:get-shop-items', async () => {
    try {
      const items = await studyQuestRepo.getShopItems();
      return { success: true, items: items.map((item) => item.toJSON()) };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get shop items:', error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(
    'studyquest:buy-item',
    async (_event, params: { characterId: string; itemId: string }) => {
      try {
        const item = await studyQuestRepo.getItem(params.itemId);
        if (!item || !item.buyPrice) {
          return { success: false, error: 'Item not available for purchase' };
        }

        const spent = await studyQuestRepo.spendGold(params.characterId, item.buyPrice);
        if (!spent) {
          return { success: false, error: 'Not enough gold' };
        }

        const slot = await studyQuestRepo.addToInventory({
          characterId: params.characterId,
          itemId: params.itemId,
          quantity: 1,
        });

        const character = await studyQuestRepo.getCharacter(params.characterId);

        return {
          success: true,
          slot: { ...slot, item: slot.item.toJSON() },
          character: character?.toJSON(),
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to buy item:', error);
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'studyquest:use-item',
    async (_event, params: { characterId: string; itemId: string }) => {
      try {
        const result = await studyQuestRepo.useItem(params.characterId, params.itemId);
        if (!result.success) {
          return { success: false, error: 'Failed to use item' };
        }

        const character = await studyQuestRepo.getCharacter(params.characterId);
        return {
          success: true,
          effect: result.effect,
          character: character?.toJSON(),
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to use item:', error);
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'studyquest:equip-item',
    async (_event, params: { characterId: string; itemId: string }) => {
      try {
        const character = await studyQuestRepo.equipItem(params.characterId, params.itemId);
        return { success: true, character: character.toJSON() };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to equip item:', error);
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'studyquest:unequip-item',
    async (
      _event,
      params: { characterId: string; slot: 'weapon' | 'armor' | 'accessory' }
    ) => {
      try {
        const character = await studyQuestRepo.unequipItem(
          params.characterId,
          params.slot
        );
        return { success: true, character: character.toJSON() };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to unequip item:', error);
        return { success: false, error: message };
      }
    }
  );

  // Item 2: Drop item handler
  ipcMain.handle(
    'studyquest:drop-item',
    async (_event, params: { characterId: string; itemId: string }) => {
      try {
        const success = await studyQuestRepo.removeFromInventory({
          characterId: params.characterId,
          itemId: params.itemId,
          quantity: 1,
        });
        return { success };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to drop item:', error);
        return { success: false, error: message };
      }
    }
  );

  // ============================================================================
  // Dungeon Handlers
  // ============================================================================

  ipcMain.handle('studyquest:get-dungeons', async (_event, characterLevel?: number) => {
    try {
      const dungeons = characterLevel
        ? await studyQuestRepo.getAvailableDungeons(characterLevel)
        : await studyQuestRepo.getDungeons();
      return { success: true, dungeons: dungeons.map((d) => d.toJSON()) };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get dungeons:', error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(
    'studyquest:start-dungeon',
    async (_event, params: { characterId: string; dungeonId: string }) => {
      try {
        const state = await studyQuestRepo.startDungeonRun(
          params.characterId,
          params.dungeonId
        );
        const dungeon = await studyQuestRepo.getDungeon(params.dungeonId);
        return {
          success: true,
          dungeonState: state,
          dungeon: dungeon?.toJSON(),
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to start dungeon:', error);
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle('studyquest:abandon-dungeon', async (_event, characterId: string) => {
    try {
      const character = await studyQuestRepo.abandonDungeonRun(characterId);
      return { success: true, character: character.toJSON() };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to abandon dungeon:', error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('studyquest:complete-dungeon', async (_event, characterId: string) => {
    try {
      const character = await studyQuestRepo.completeDungeonRun(characterId);
      return { success: true, character: character.toJSON() };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to complete dungeon:', error);
      return { success: false, error: message };
    }
  });

  // ============================================================================
  // Battle Handlers
  // ============================================================================

  ipcMain.handle(
    'studyquest:start-battle',
    async (
      _event,
      params: {
        characterId: string;
        dungeonId: string;
        floorNumber: number;
        isBoss: boolean;
      }
    ) => {
      try {
        const character = await studyQuestRepo.getCharacter(params.characterId);
        if (!character) {
          return { success: false, error: 'Character not found' };
        }

        const enemy = await studyQuestRepo.getRandomEnemy(params.dungeonId, params.isBoss);
        if (!enemy) {
          return { success: false, error: 'No enemy found' };
        }

        const dungeon = await studyQuestRepo.getDungeon(params.dungeonId);
        const scaledStats = enemy.getScaledStats(params.floorNumber);

        const battleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const battle = StudyQuestBattle.create({
          id: battleId,
          character: character.toJSON(),
          enemy: enemy.toJSON(),
          scaledEnemyStats: scaledStats,
          dungeonId: params.dungeonId,
          floorNumber: params.floorNumber,
          enemySpriteKey: enemy.spriteKey,
          backgroundKey: dungeon?.spriteKey,
        });

        // Store in memory
        activeBattles.set(battleId, battle);

        return {
          success: true,
          battle: battle.toJSON(),
          enemy: enemy.toJSON(),
          dungeon: dungeon?.toJSON(),
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to start battle:', error);
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'studyquest:battle-action',
    async (
      _event,
      params: {
        battleId: string;
        action: BattleAction;
        itemEffect?: { healing: number };
      }
    ) => {
      try {
        const battle = activeBattles.get(params.battleId);
        if (!battle) {
          return { success: false, error: 'Battle not found' };
        }

        // Process player action
        const playerLog = battle.processPlayerAction(params.action, params.itemEffect);

        // If battle is still in progress and it's enemy's turn, process enemy response
        let enemyLog: BattleLogEntry | null = null;
        if (battle.isInProgress && !battle.isPlayerTurn) {
          enemyLog = battle.processEnemyTurn();
        }

        // If battle ended, process results
        if (!battle.isInProgress) {
          const character = await studyQuestRepo.getCharacter(battle.characterId);
          if (!character) {
            return { success: false, error: 'Character not found' };
          }

          if (battle.result === 'victory') {
            // Get enemy for rewards
            const enemy = await studyQuestRepo.getRandomEnemy(
              battle.dungeonId!,
              false
            );
            if (enemy) {
              const dungeon = await studyQuestRepo.getDungeon(battle.dungeonId!);
              const rewards = enemy.getScaledRewards(battle.floorNumber, {
                xp: dungeon?.xpMultiplier ?? 1,
                gold: dungeon?.goldMultiplier ?? 1,
              });

              // Check for item drop
              let droppedItemId: string | undefined;
              if (enemy.dropItemId && enemy.rollForDrop()) {
                droppedItemId = enemy.dropItemId;
                await studyQuestRepo.addToInventory({
                  characterId: character.id,
                  itemId: droppedItemId,
                  quantity: 1,
                });
              }

              battle.setRewards({
                xp: rewards.xp,
                gold: rewards.gold,
                droppedItemId,
              });

              // Apply rewards
              await studyQuestRepo.addXp(character.id, rewards.xp);
              await studyQuestRepo.addGold(character.id, rewards.gold);

              // Update battle stats
              await studyQuestRepo.updateCharacter({
                characterId: character.id,
                battlesWon: character.battlesWon + 1,
                hp: battle.getFinalPlayerHp(),
              });
            }
          } else if (battle.result === 'defeat') {
            // Lose 25% gold on defeat
            const goldLoss = Math.floor(character.gold * 0.25);
            await studyQuestRepo.spendGold(character.id, goldLoss);

            // Update battle stats and abandon dungeon
            await studyQuestRepo.updateCharacter({
              characterId: character.id,
              battlesLost: character.battlesLost + 1,
              currentDungeonId: null,
              currentFloor: 0,
              hp: 1, // Revive with 1 HP
            });
          } else if (battle.result === 'fled') {
            // Just update HP
            await studyQuestRepo.updateHp(character.id, battle.getFinalPlayerHp());
          }

          // Log combat
          await studyQuestRepo.logCombat(createCombatLogRecord(battle));

          // Clean up
          activeBattles.delete(params.battleId);
        }

        // Get updated character
        const updatedCharacter = await studyQuestRepo.getCharacter(battle.characterId);

        return {
          success: true,
          battle: battle.toJSON(),
          playerLog,
          enemyLog,
          character: updatedCharacter?.toJSON(),
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to process battle action:', error);
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle('studyquest:get-battle', async (_event, battleId: string) => {
    try {
      const battle = activeBattles.get(battleId);
      return { success: true, battle: battle?.toJSON() ?? null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get battle:', error);
      return { success: false, error: message };
    }
  });

  // ============================================================================
  // Quest Handlers
  // ============================================================================

  ipcMain.handle('studyquest:get-quests', async (_event, characterId: string) => {
    try {
      const quests = await studyQuestRepo.getQuestsWithProgress(characterId);
      return { success: true, quests };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get quests:', error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('studyquest:get-active-quests', async (_event, characterId: string) => {
    try {
      const quests = await studyQuestRepo.getActiveQuests(characterId);
      return { success: true, quests };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get active quests:', error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(
    'studyquest:update-quest-progress',
    async (
      _event,
      params: { characterId: string; questId: string; progressDelta: number }
    ) => {
      try {
        const progress = await studyQuestRepo.updateQuestProgress(params);
        return { success: true, progress: progress.toJSON() };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to update quest progress:', error);
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(
    'studyquest:complete-quest',
    async (_event, params: { characterId: string; questId: string }) => {
      try {
        const rewards = await studyQuestRepo.completeQuest(
          params.characterId,
          params.questId
        );
        const character = await studyQuestRepo.getCharacter(params.characterId);
        return {
          success: true,
          rewards,
          character: character?.toJSON(),
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to complete quest:', error);
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle('studyquest:reset-daily-quests', async (_event, characterId: string) => {
    try {
      await studyQuestRepo.resetDailyQuests(characterId);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to reset daily quests:', error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('studyquest:reset-weekly-quests', async (_event, characterId: string) => {
    try {
      await studyQuestRepo.resetWeeklyQuests(characterId);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to reset weekly quests:', error);
      return { success: false, error: message };
    }
  });

  // ============================================================================
  // Leaderboard Handlers
  // ============================================================================

  ipcMain.handle('studyquest:get-leaderboard', async (_event, limit?: number) => {
    try {
      const leaderboard = await studyQuestRepo.getLeaderboard(limit);
      return { success: true, leaderboard };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get leaderboard:', error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('studyquest:get-rank', async (_event, characterId: string) => {
    try {
      const rank = await studyQuestRepo.getCharacterRank(characterId);
      return { success: true, rank };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get rank:', error);
      return { success: false, error: message };
    }
  });

  // ============================================================================
  // Stats Handlers
  // ============================================================================

  ipcMain.handle('studyquest:get-battle-stats', async (_event, characterId: string) => {
    try {
      const stats = await studyQuestRepo.getBattleStats(characterId);
      return { success: true, stats };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get battle stats:', error);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(
    'studyquest:get-combat-history',
    async (_event, params: { characterId: string; limit?: number }) => {
      try {
        const history = await studyQuestRepo.getCombatHistory(
          params.characterId,
          params.limit
        );
        return { success: true, history };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to get combat history:', error);
        return { success: false, error: message };
      }
    }
  );

  console.log('[StudyQuestHandlers] Registered all StudyQuest IPC handlers');
}
