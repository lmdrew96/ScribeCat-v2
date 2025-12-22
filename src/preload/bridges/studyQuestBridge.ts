/**
 * StudyQuest IPC Bridge
 *
 * IPC bindings for the StudyQuest RPG game system
 */

const { ipcRenderer } = require('electron');

import { StudyQuestChannels } from '../../shared/IpcChannels.js';
import type { StudyQuestEnemyData } from '../../domain/entities/StudyQuestDungeon.js';

export const studyQuestBridge = {
  // Character operations
  getClasses: () => ipcRenderer.invoke(StudyQuestChannels.GET_CLASSES),
  getCharacter: (userId: string) => ipcRenderer.invoke(StudyQuestChannels.GET_CHARACTER, userId),
  createCharacter: (params: { userId: string; name: string; classId: string }) =>
    ipcRenderer.invoke(StudyQuestChannels.CREATE_CHARACTER, params),
  deleteCharacterByUser: (userId: string) =>
    ipcRenderer.invoke(StudyQuestChannels.DELETE_CHARACTER_BY_USER, userId),
  addXp: (params: { userId: string; xp: number }) =>
    ipcRenderer.invoke(StudyQuestChannels.ADD_XP, params),
  addGold: (params: { userId: string; gold: number }) =>
    ipcRenderer.invoke(StudyQuestChannels.ADD_GOLD, params),
  healCharacter: (userId: string) =>
    ipcRenderer.invoke(StudyQuestChannels.HEAL_CHARACTER, userId),

  // Inventory operations
  getInventory: (userId: string) =>
    ipcRenderer.invoke(StudyQuestChannels.GET_INVENTORY, userId),
  getEquippedItems: (userId: string) =>
    ipcRenderer.invoke(StudyQuestChannels.GET_EQUIPPED_ITEMS, userId),
  equipItem: (params: { userId: string; itemId: string }) =>
    ipcRenderer.invoke(StudyQuestChannels.EQUIP_ITEM, params),
  unequipItem: (params: { userId: string; itemId: string }) =>
    ipcRenderer.invoke(StudyQuestChannels.UNEQUIP_ITEM, params),
  useItem: (params: { userId: string; itemId: string }) =>
    ipcRenderer.invoke(StudyQuestChannels.USE_ITEM, params),
  dropItem: (params: { characterId: string; itemId: string }) =>
    ipcRenderer.invoke(StudyQuestChannels.DROP_ITEM, params),

  // Shop operations
  getShopItems: () => ipcRenderer.invoke(StudyQuestChannels.GET_SHOP_ITEMS),
  buyItem: (params: { userId: string; itemId: string }) =>
    ipcRenderer.invoke(StudyQuestChannels.BUY_ITEM, params),

  // Dungeon operations
  getDungeons: () => ipcRenderer.invoke(StudyQuestChannels.GET_DUNGEONS),
  startDungeon: (params: { userId: string; dungeonId: string }) =>
    ipcRenderer.invoke(StudyQuestChannels.START_DUNGEON, params),
  getCurrentDungeonRun: (userId: string) =>
    ipcRenderer.invoke(StudyQuestChannels.GET_CURRENT_DUNGEON_RUN, userId),
  advanceDungeonFloor: (userId: string) =>
    ipcRenderer.invoke(StudyQuestChannels.ADVANCE_DUNGEON_FLOOR, userId),
  completeDungeon: (userId: string) =>
    ipcRenderer.invoke(StudyQuestChannels.COMPLETE_DUNGEON, userId),
  fleeDungeon: (userId: string) =>
    ipcRenderer.invoke(StudyQuestChannels.FLEE_DUNGEON, userId),

  // Battle operations
  startBattle: (params: { userId: string; enemy: StudyQuestEnemyData }) =>
    ipcRenderer.invoke(StudyQuestChannels.START_BATTLE, params),
  getCurrentBattle: (userId: string) =>
    ipcRenderer.invoke(StudyQuestChannels.GET_CURRENT_BATTLE, userId),
  battleAction: (params: { userId: string; action: string; itemId?: string }) =>
    ipcRenderer.invoke(StudyQuestChannels.BATTLE_ACTION, params),

  // Quest operations
  getActiveQuests: (userId: string) =>
    ipcRenderer.invoke(StudyQuestChannels.GET_ACTIVE_QUESTS, userId),
  completeQuest: (params: { userId: string; questId: string }) =>
    ipcRenderer.invoke(StudyQuestChannels.COMPLETE_QUEST, params),

  // Leaderboard
  getLeaderboard: (limit?: number) =>
    ipcRenderer.invoke(StudyQuestChannels.GET_LEADERBOARD, limit),

  // Study rewards
  awardStudyRewards: (params: {
    userId: string;
    studyTimeMinutes: number;
    aiToolsUsed: number;
    aiChatsUsed: number;
    sessionCompleted: boolean;
  }) => ipcRenderer.invoke(StudyQuestChannels.AWARD_STUDY_REWARDS, params),
};
