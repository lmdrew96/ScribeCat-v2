/**
 * StudyQuest IPC Bridge
 *
 * IPC bindings for the StudyQuest RPG game system
 */

const { ipcRenderer } = require('electron');

export const studyQuestBridge = {
  // Character operations
  getClasses: () => ipcRenderer.invoke('studyquest:get-classes'),
  getCharacter: (userId: string) => ipcRenderer.invoke('studyquest:get-character', userId),
  createCharacter: (params: { userId: string; name: string; classId: string }) =>
    ipcRenderer.invoke('studyquest:create-character', params),
  deleteCharacterByUser: (userId: string) =>
    ipcRenderer.invoke('studyquest:delete-character-by-user', userId),
  addXp: (params: { userId: string; xp: number }) =>
    ipcRenderer.invoke('studyquest:add-xp', params),
  addGold: (params: { userId: string; gold: number }) =>
    ipcRenderer.invoke('studyquest:add-gold', params),
  healCharacter: (userId: string) =>
    ipcRenderer.invoke('studyquest:heal-character', userId),

  // Inventory operations
  getInventory: (userId: string) =>
    ipcRenderer.invoke('studyquest:get-inventory', userId),
  getEquippedItems: (userId: string) =>
    ipcRenderer.invoke('studyquest:get-equipped-items', userId),
  equipItem: (params: { userId: string; itemId: string }) =>
    ipcRenderer.invoke('studyquest:equip-item', params),
  unequipItem: (params: { userId: string; itemId: string }) =>
    ipcRenderer.invoke('studyquest:unequip-item', params),
  useItem: (params: { userId: string; itemId: string }) =>
    ipcRenderer.invoke('studyquest:use-item', params),
  dropItem: (params: { characterId: string; itemId: string }) =>
    ipcRenderer.invoke('studyquest:drop-item', params),

  // Shop operations
  getShopItems: () => ipcRenderer.invoke('studyquest:get-shop-items'),
  buyItem: (params: { userId: string; itemId: string }) =>
    ipcRenderer.invoke('studyquest:buy-item', params),

  // Dungeon operations
  getDungeons: () => ipcRenderer.invoke('studyquest:get-dungeons'),
  startDungeon: (params: { userId: string; dungeonId: string }) =>
    ipcRenderer.invoke('studyquest:start-dungeon', params),
  getCurrentDungeonRun: (userId: string) =>
    ipcRenderer.invoke('studyquest:get-current-dungeon-run', userId),
  advanceDungeonFloor: (userId: string) =>
    ipcRenderer.invoke('studyquest:advance-dungeon-floor', userId),
  completeDungeon: (userId: string) =>
    ipcRenderer.invoke('studyquest:complete-dungeon', userId),
  fleeDungeon: (userId: string) =>
    ipcRenderer.invoke('studyquest:flee-dungeon', userId),

  // Battle operations
  startBattle: (params: { userId: string; enemy: any }) =>
    ipcRenderer.invoke('studyquest:start-battle', params),
  getCurrentBattle: (userId: string) =>
    ipcRenderer.invoke('studyquest:get-current-battle', userId),
  battleAction: (params: { userId: string; action: string; itemId?: string }) =>
    ipcRenderer.invoke('studyquest:battle-action', params),

  // Quest operations
  getActiveQuests: (userId: string) =>
    ipcRenderer.invoke('studyquest:get-active-quests', userId),
  completeQuest: (params: { userId: string; questId: string }) =>
    ipcRenderer.invoke('studyquest:complete-quest', params),

  // Leaderboard
  getLeaderboard: (limit?: number) =>
    ipcRenderer.invoke('studyquest:get-leaderboard', limit),

  // Study rewards
  awardStudyRewards: (params: {
    userId: string;
    studyTimeMinutes: number;
    aiToolsUsed: number;
    aiChatsUsed: number;
    sessionCompleted: boolean;
  }) => ipcRenderer.invoke('studyquest:award-study-rewards', params),
};
