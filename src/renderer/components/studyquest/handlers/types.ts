/**
 * Shared types and interfaces for StudyQuest handlers
 */

import type { StudyQuestManager } from '../../../managers/StudyQuestManager.js';
import type { DungeonExploreView } from '../DungeonExploreView.js';
import type { BattleCanvas } from '../BattleCanvas.js';
import type { CatColor } from '../SpriteLoader.js';

export type ViewType =
  | 'title'
  | 'character-create'
  | 'town'
  | 'character-sheet'
  | 'inventory'
  | 'shop'
  | 'dungeon-select'
  | 'dungeon-run'
  | 'dungeon-complete'
  | 'battle'
  | 'quests'
  | 'leaderboard'
  | 'collection';

export interface HandlerCallbacks {
  showView: (view: ViewType) => void;
  showToast: (message: string) => void;
  showConfirmDialog: (title: string, message: string) => Promise<boolean>;
  updatePlayerInfo: () => void;
}

export interface BattleHandlerCallbacks extends HandlerCallbacks {
  resumeDungeonExploration: () => void;
  getDungeonExploreView: () => DungeonExploreView | null;
  setDungeonCompletionRewards: (rewards: DungeonCompletionRewards | null) => void;
}

export interface DungeonHandlerCallbacks extends HandlerCallbacks {
  getDungeonExploreView: () => DungeonExploreView | null;
  setDungeonExploreView: (view: DungeonExploreView | null) => void;
  getBattleCanvas: () => BattleCanvas | null;
  getSelectedColor: () => CatColor;
}

export interface CharacterHandlerCallbacks extends HandlerCallbacks {
  getSelectedColor: () => CatColor;
  setSelectedColor: (color: CatColor) => void;
}

export interface InventoryHandlerCallbacks extends HandlerCallbacks {
  refreshInventory: () => Promise<void>;
}

export interface DungeonCompletionRewards {
  success: boolean;
  xpBonus: number;
  goldBonus: number;
  dungeonName: string;
}

// Helper to generate pixel art icon img tags
export const pixelIcon = (name: string, size: number = 16): string => {
  return `<img src="../../assets/sprites/studyquest/icons/${name}.png" width="${size}" height="${size}" style="image-rendering: pixelated; vertical-align: middle;" alt="${name}" />`;
};

// Pixel art icon constants for StudyQuest (16-bit retro style)
export const SQ_ICONS = {
  // Header icons
  gamepad: pixelIcon('ducky', 24),
  heart: pixelIcon('heart', 14),
  star: pixelIcon('stars', 14),
  coin: pixelIcon('tuna_coin', 14),

  // Character class icons (24px for cards)
  scholar: pixelIcon('magic', 24),
  knight: pixelIcon('shield', 24),
  rogue: pixelIcon('sword', 24),
  cat: pixelIcon('catnip', 24),

  // Building icons (32px for town)
  castle: pixelIcon('sword', 32),
  shop: pixelIcon('gem', 32),
  inn: pixelIcon('potion', 32),
  questBoard: pixelIcon('scratching_post', 32),

  // Item type icons
  weapon: pixelIcon('sword', 20),
  armor: pixelIcon('shield', 20),
  potion: pixelIcon('potion', 20),
  keyItem: pixelIcon('gem_1', 20),
  item: pixelIcon('gem', 20),

  // Battle action icons
  attack: pixelIcon('sword', 16),
  defend: pixelIcon('shield', 16),
  itemUse: pixelIcon('potion', 16),
  flee: pixelIcon('heart_2', 16),
  arrowLeft: pixelIcon('heart_1', 16),

  // Dungeon icons (32px)
  training: pixelIcon('sword', 32),
  forest: pixelIcon('catnip', 32),
  crystal: pixelIcon('gem_2', 32),
  library: pixelIcon('magic', 32),
  volcano: pixelIcon('fire', 32),
  void: pixelIcon('snowflake', 32),
  lock: pixelIcon('gem_3', 16),

  // Stat icons
  hp: pixelIcon('heart', 14),
  atk: pixelIcon('sword', 14),
  def: pixelIcon('shield', 14),
  spd: pixelIcon('stars', 14),
  gold: pixelIcon('tuna_coin', 14),
  trophy: pixelIcon('stars2', 14),
  quest: pixelIcon('scratching_post', 14),

  // Quest type icons
  daily: pixelIcon('yarn', 14),
  weekly: pixelIcon('ducky', 14),
  story: pixelIcon('magic', 14),

  // Large portrait icons (48px)
  scholarLarge: pixelIcon('magic', 48),
  knightLarge: pixelIcon('shield', 48),
  rogueLarge: pixelIcon('sword', 48),
  catLarge: pixelIcon('catnip', 48),
};
