/**
 * Shared types and interfaces for StudyQuest handlers
 */

import type { StudyQuestManager } from '../../../managers/StudyQuestManager.js';
import type { DungeonExploreView } from '../DungeonExploreView.js';
import type { BattleCanvas } from '../BattleCanvas.js';
import type { CatColor } from '../SpriteLoader.js';
import {
  ITEM_TILES,
  CHARACTER_TILES,
  PROP_TILES,
  DECORATION_TILES,
} from '../../../canvas/dungeon/DungeonLayout.js';

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
  setBattleBossFlag: (isBoss: boolean) => void;
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

// Helper to generate Kenney tile icon img tags
export const kenneyIcon = (tilePath: string, size: number = 16): string => {
  return `<img src="${tilePath}" width="${size}" height="${size}" style="image-rendering: pixelated; vertical-align: middle;" alt="icon" />`;
};

// Backward compatibility alias - now uses Kenney dungeon tiles instead of custom icons
export const pixelIcon = (name: string, size: number = 16): string => {
  // Map old icon names to Kenney tiles
  const iconMap: Record<string, string> = {
    // Characters
    ducky: CHARACTER_TILES.knight,
    // Weapons
    sword: ITEM_TILES.sword,
    shield: ITEM_TILES.shield,
    bow: ITEM_TILES.bow,
    staff: ITEM_TILES.staff,
    hammer: ITEM_TILES.axe,
    // Items
    potion: ITEM_TILES.potionRed,
    gem: ITEM_TILES.gem,
    gem_1: ITEM_TILES.gem,
    gem_2: ITEM_TILES.gem,
    gem_3: ITEM_TILES.keySilver,
    gem_4: ITEM_TILES.gem,
    heart: ITEM_TILES.potionRed,
    heart_1: ITEM_TILES.potionRed,
    heart_2: ITEM_TILES.boots,
    magic: CHARACTER_TILES.wizard,
    catnip: DECORATION_TILES.grass,
    // Coins
    coin: ITEM_TILES.coin,
    tuna_coin: ITEM_TILES.coin,
    // Decorations
    fire: DECORATION_TILES.torch,
    snowflake: CHARACTER_TILES.ghost,
    stars: ITEM_TILES.gem,
    stars2: ITEM_TILES.crown,
    water: PROP_TILES.fountain,
    yarn: ITEM_TILES.ring,
    scratching_post: ITEM_TILES.scroll,
    laser_pointer: ITEM_TILES.staff,
  };
  const tilePath = iconMap[name] || ITEM_TILES.gem;
  return kenneyIcon(tilePath, size);
};

// All icons now use Kenney Tiny Dungeon assets
export const SQ_ICONS = {
  // Header icons
  gamepad: kenneyIcon(CHARACTER_TILES.knight, 24),
  heart: kenneyIcon(ITEM_TILES.potionRed, 14),
  star: kenneyIcon(ITEM_TILES.gem, 14),
  coin: kenneyIcon(ITEM_TILES.coin, 14),

  // Character class icons (24px for cards)
  scholar: kenneyIcon(CHARACTER_TILES.wizard, 24),
  knight: kenneyIcon(CHARACTER_TILES.knight, 24),
  rogue: kenneyIcon(CHARACTER_TILES.rogue, 24),
  cat: kenneyIcon(CHARACTER_TILES.warrior, 24),

  // Building icons (32px for town)
  castle: kenneyIcon(ITEM_TILES.sword, 32),
  shop: kenneyIcon(ITEM_TILES.gem, 32),
  inn: kenneyIcon(ITEM_TILES.potionRed, 32),
  questBoard: kenneyIcon(ITEM_TILES.scroll, 32),

  // Item type icons
  weapon: kenneyIcon(ITEM_TILES.sword, 20),
  armor: kenneyIcon(ITEM_TILES.shield, 20),
  potion: kenneyIcon(ITEM_TILES.potionRed, 20),
  keyItem: kenneyIcon(ITEM_TILES.keyGold, 20),
  item: kenneyIcon(ITEM_TILES.gem, 20),

  // Battle action icons
  attack: kenneyIcon(ITEM_TILES.sword, 16),
  defend: kenneyIcon(ITEM_TILES.shield, 16),
  itemUse: kenneyIcon(ITEM_TILES.potionRed, 16),
  flee: kenneyIcon(ITEM_TILES.boots, 16),
  arrowLeft: kenneyIcon(ITEM_TILES.dagger, 16),

  // Dungeon icons (32px)
  training: kenneyIcon(ITEM_TILES.sword, 32),
  forest: kenneyIcon(DECORATION_TILES.grass, 32),
  crystal: kenneyIcon(ITEM_TILES.gem, 32),
  library: kenneyIcon(ITEM_TILES.scroll, 32),
  volcano: kenneyIcon(DECORATION_TILES.torch, 32),
  void: kenneyIcon(CHARACTER_TILES.ghost, 32),
  lock: kenneyIcon(ITEM_TILES.keySilver, 16),

  // Stat icons
  hp: kenneyIcon(ITEM_TILES.potionRed, 14),
  atk: kenneyIcon(ITEM_TILES.sword, 14),
  def: kenneyIcon(ITEM_TILES.shield, 14),
  spd: kenneyIcon(ITEM_TILES.boots, 14),
  gold: kenneyIcon(ITEM_TILES.coin, 14),
  trophy: kenneyIcon(ITEM_TILES.crown, 14),
  quest: kenneyIcon(ITEM_TILES.scroll, 14),

  // Quest type icons
  daily: kenneyIcon(ITEM_TILES.coin, 14),
  weekly: kenneyIcon(ITEM_TILES.gem, 14),
  story: kenneyIcon(ITEM_TILES.scroll, 14),

  // Large portrait icons (48px)
  scholarLarge: kenneyIcon(CHARACTER_TILES.wizard, 48),
  knightLarge: kenneyIcon(CHARACTER_TILES.knight, 48),
  rogueLarge: kenneyIcon(CHARACTER_TILES.rogue, 48),
  catLarge: kenneyIcon(CHARACTER_TILES.warrior, 48),
};

// Extended Kenney icons for specific content
export const KENNEY_ICONS = {
  // Weapons (from ITEM_TILES)
  sword: kenneyIcon(ITEM_TILES.sword, 24),
  axe: kenneyIcon(ITEM_TILES.axe, 24),
  bow: kenneyIcon(ITEM_TILES.bow, 24),
  staff: kenneyIcon(ITEM_TILES.staff, 24),
  dagger: kenneyIcon(ITEM_TILES.dagger, 24),

  // Armor
  shield: kenneyIcon(ITEM_TILES.shield, 24),
  helmet: kenneyIcon(ITEM_TILES.helmet, 24),
  armor: kenneyIcon(ITEM_TILES.armor, 24),
  boots: kenneyIcon(ITEM_TILES.boots, 24),

  // Consumables
  potionRed: kenneyIcon(ITEM_TILES.potionRed, 24),
  potionBlue: kenneyIcon(ITEM_TILES.potionBlue, 24),
  potionGreen: kenneyIcon(ITEM_TILES.potionGreen, 24),
  scroll: kenneyIcon(ITEM_TILES.scroll, 24),

  // Treasures
  keyGold: kenneyIcon(ITEM_TILES.keyGold, 24),
  keySilver: kenneyIcon(ITEM_TILES.keySilver, 24),
  coin: kenneyIcon(ITEM_TILES.coin, 24),
  gem: kenneyIcon(ITEM_TILES.gem, 24),
  crown: kenneyIcon(ITEM_TILES.crown, 24),

  // Accessories
  ring: kenneyIcon(ITEM_TILES.ring, 24),
  amulet: kenneyIcon(ITEM_TILES.amulet, 24),

  // Characters
  knight: kenneyIcon(CHARACTER_TILES.knight, 24),
  warrior: kenneyIcon(CHARACTER_TILES.warrior, 24),
  wizard: kenneyIcon(CHARACTER_TILES.wizard, 24),
  rogue: kenneyIcon(CHARACTER_TILES.rogue, 24),
  skeleton: kenneyIcon(CHARACTER_TILES.skeleton, 24),
  ghost: kenneyIcon(CHARACTER_TILES.ghost, 24),
  demon: kenneyIcon(CHARACTER_TILES.demon, 24),
  boss: kenneyIcon(CHARACTER_TILES.boss, 24),
  merchant: kenneyIcon(CHARACTER_TILES.merchant, 24),

  // Props
  chestClosed: kenneyIcon(PROP_TILES.chestClosed, 24),
  chestOpen: kenneyIcon(PROP_TILES.chestOpen, 24),
  campfire: kenneyIcon(PROP_TILES.campfire, 24),
  stairsDown: kenneyIcon(PROP_TILES.stairsDown, 24),
  portal: kenneyIcon(PROP_TILES.portal, 24),

  // Decorations
  torch: kenneyIcon(DECORATION_TILES.torch, 24),
  skull: kenneyIcon(DECORATION_TILES.skull, 24),
};

// Item type to Kenney icon mapping (for inventory/shop display)
export const getKenneyItemIcon = (itemType: string, size: number = 24): string => {
  const iconMap: Record<string, string> = {
    // Weapons
    weapon: ITEM_TILES.sword,
    sword: ITEM_TILES.sword,
    axe: ITEM_TILES.axe,
    bow: ITEM_TILES.bow,
    staff: ITEM_TILES.staff,
    dagger: ITEM_TILES.dagger,

    // Armor
    armor: ITEM_TILES.armor,
    shield: ITEM_TILES.shield,
    helmet: ITEM_TILES.helmet,
    boots: ITEM_TILES.boots,

    // Consumables
    potion: ITEM_TILES.potionRed,
    potion_minor: ITEM_TILES.potionRed,
    potion_medium: ITEM_TILES.potionBlue,
    potion_large: ITEM_TILES.potionGreen,
    scroll: ITEM_TILES.scroll,
    herb: ITEM_TILES.potionGreen,

    // Keys and treasures
    key: ITEM_TILES.keyGold,
    keyItem: ITEM_TILES.keyGold,
    gold: ITEM_TILES.coin,
    gold_small: ITEM_TILES.coin,
    gold_medium: ITEM_TILES.coin,
    gold_large: ITEM_TILES.coin,
    gold_huge: ITEM_TILES.crown,
    gem: ITEM_TILES.gem,
    crystal: ITEM_TILES.gem,
    fire_crystal: ITEM_TILES.gem,
    void_crystal: ITEM_TILES.gem,

    // Accessories
    ring: ITEM_TILES.ring,
    amulet: ITEM_TILES.amulet,
    accessory: ITEM_TILES.ring,
    legendary_item: ITEM_TILES.crown,
  };

  const tilePath = iconMap[itemType.toLowerCase()] || ITEM_TILES.gem;
  return kenneyIcon(tilePath, size);
};
