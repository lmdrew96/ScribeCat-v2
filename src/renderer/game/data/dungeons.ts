/**
 * Dungeon unlock configuration
 *
 * Maps dungeon IDs to their unlock requirements.
 * Players can access dungeons once they reach the required level.
 */

import { DUNGEON_CONFIGS } from '../../canvas/dungeon/DungeonGenerator.js';

export interface DungeonInfo {
  id: string;
  name: string;
  totalFloors: number;
  requiredLevel: number;
  theme: string;
}

/**
 * Level requirements for each dungeon
 * Matches the database study_quest_dungeons table
 */
export const DUNGEON_UNLOCK_LEVELS: Record<string, number> = {
  training: 1,
  forest: 5,
  crystal: 10,
  library: 15,
  volcano: 25,
  void: 40,
};

/**
 * Order dungeons should appear in selection UI
 */
export const DUNGEON_ORDER: string[] = [
  'training',
  'forest',
  'crystal',
  'library',
  'volcano',
  'void',
];

/**
 * Get all dungeon info for selection UI
 */
export function getAllDungeonInfo(): DungeonInfo[] {
  return DUNGEON_ORDER.map(id => {
    const config = DUNGEON_CONFIGS[id];
    return {
      id: config.id,
      name: config.name,
      totalFloors: config.totalFloors,
      requiredLevel: DUNGEON_UNLOCK_LEVELS[id] || 1,
      theme: config.theme,
    };
  });
}

/**
 * Get dungeons unlocked for a player level
 */
export function getUnlockedDungeonIds(playerLevel: number): string[] {
  return DUNGEON_ORDER.filter(id => playerLevel >= (DUNGEON_UNLOCK_LEVELS[id] || 1));
}

/**
 * Check if a specific dungeon is unlocked
 */
export function isDungeonUnlocked(dungeonId: string, playerLevel: number): boolean {
  const requiredLevel = DUNGEON_UNLOCK_LEVELS[dungeonId];
  if (requiredLevel === undefined) return false;
  return playerLevel >= requiredLevel;
}

/**
 * Get dungeon info by ID
 */
export function getDungeonInfo(dungeonId: string): DungeonInfo | null {
  const config = DUNGEON_CONFIGS[dungeonId];
  if (!config) return null;

  return {
    id: config.id,
    name: config.name,
    totalFloors: config.totalFloors,
    requiredLevel: DUNGEON_UNLOCK_LEVELS[dungeonId] || 1,
    theme: config.theme,
  };
}
