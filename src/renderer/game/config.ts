/**
 * Game Configuration
 *
 * Constants and configuration for StudyQuest game features.
 * KAPLAY is now the only game engine.
 */

// Canvas dimensions
export const STUDY_BUDDY_WIDTH = 100;
export const STUDY_BUDDY_HEIGHT = 120;

export const TOWN_WIDTH = 480;
export const TOWN_HEIGHT = 320;

export const DUNGEON_WIDTH = 480;
export const DUNGEON_HEIGHT = 320;

// Colors
export const COLORS = {
  background: [26, 26, 46] as [number, number, number], // #1a1a2e
  roomFloor: '#2a2a4e',
  roomWall: '#1a1a2e',
  doorOpen: '#4ade80',
  doorLocked: '#ef4444',
  doorHighlight: '#fbbf24',
  chest: '#fbbf24',
  chestOpen: '#78350f',
  enemy: '#ef4444',
  trap: '#dc2626',
  npc: '#60a5fa',
  exit: '#a855f7',
  restPoint: '#22c55e',
};

// Player settings
export const PLAYER_SPEED = 120; // Pixels per second
export const PLAYER_SIZE = 32;
export const TRIGGER_DISTANCE = 40;

// Tile settings
export const TILE_SIZE = 16;
export const TILE_SCALE = 2;
