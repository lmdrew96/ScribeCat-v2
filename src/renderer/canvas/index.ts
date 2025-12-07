/**
 * Canvas Module
 *
 * Exports all canvas-related classes and utilities for StudyQuest features.
 */

// Base class
export { GameCanvas, type Point, type Size, type Rect } from './GameCanvas.js';

// Sprite management
export {
  CatSpriteManager,
  STARTER_CATS,
  FRAME_WIDTH,
  FRAME_HEIGHT,
  ANIMATION_FRAMES,
  ANIMATION_SPEEDS,
  type CatColor,
  type CatAnimationType,
  type Direction,
  type LoadedSprite,
  type CatSpriteSet,
} from './CatSpriteManager.js';

// Unlock system
export {
  UnlockManager,
  ALL_UNLOCKS,
  CAT_UNLOCKS,
  TOWN_UNLOCKS,
  DUNGEON_UNLOCKS,
  type UnlockCategory,
  type UnlockTier,
  type ConditionType,
  type UnlockCondition,
  type Unlockable,
  type PlayerStats,
  type UnlockState,
} from './UnlockManager.js';

// Player stats
export { PlayerStatsService } from './PlayerStatsService.js';

// Study Buddy
export { StudyBuddyCanvas, type BuddyState } from './StudyBuddyCanvas.js';

// Town Hub
export {
  TownCanvas,
  TILE_SIZE,
  TOWN_WIDTH,
  TOWN_HEIGHT,
  TileType,
  BUILDINGS,
  type Building,
  type BuildingId,
} from './town/index.js';

// Dungeon Exploration
export {
  DungeonGenerator,
  DungeonCanvas,
  MiniMap,
  createMiniMapContainer,
  DUNGEON_CONFIGS,
  type RoomType,
  type ContentType,
  type RoomContent,
  type DungeonRoom,
  type DungeonFloor,
  type DungeonConfig,
} from './dungeon/index.js';
