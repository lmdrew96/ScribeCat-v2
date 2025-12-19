/**
 * DungeonConstants.ts
 * 
 * Shared constants, types, and configuration for the dungeon system.
 */

import type { DungeonFloor } from '../../../../canvas/dungeon/DungeonGenerator.js';
import type { CatColor } from '../../../data/catSprites.js';
import type { DungeonTier } from '../../../data/items.js';

// ============================================================================
// Room & Canvas Configuration
// ============================================================================

/** Room rendering config - larger for better visibility */
export const ROOM_CONFIG = {
  width: 520,
  height: 340,
  offsetX: 60,
  offsetY: 30,
  doorSize: 56,
} as const;

/** Canvas dimensions - larger dungeon canvas */
export const CANVAS_WIDTH = 640;
export const CANVAS_HEIGHT = 400;

// ============================================================================
// Direction Types
// ============================================================================

/** Cardinal directions for room connections */
export type Direction = 'north' | 'south' | 'east' | 'west';

/** Mapping of directions to their opposites */
export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
};

// ============================================================================
// Dungeon Tier Mapping
// ============================================================================

/** Dungeon tier mapping for loot calculation */
export const DUNGEON_TIER_MAP: Record<string, DungeonTier> = {
  training: 1,
  forest: 2,
  crystal: 3,
  library: 4,
  volcano: 5,
  void: 6,
};

// ============================================================================
// Puzzle Data
// ============================================================================

/** Riddle interface for puzzle system */
export interface Riddle {
  question: string;
  answer: number;
  options: string[];
}

/** Sequence interface for puzzle system */
export interface Sequence {
  pattern: number[];
  display: string;
}

/** Riddles for puzzles */
export const RIDDLES: Riddle[] = [
  { question: 'I have keys but no locks. What am I?', answer: 0, options: ['Keyboard', 'Piano', 'Map'] },
  { question: "What has hands but can't clap?", answer: 1, options: ['Gloves', 'Clock', 'Statue'] },
  { question: 'I get wetter as I dry. What am I?', answer: 2, options: ['Sponge', 'Rain', 'Towel'] },
  { question: 'What has a head and tail but no body?', answer: 0, options: ['Coin', 'Snake', 'Comet'] },
  { question: 'What can you catch but not throw?', answer: 1, options: ['Ball', 'Cold', 'Fish'] },
];

/** Sequences for puzzles */
export const SEQUENCES: Sequence[] = [
  { pattern: [0, 1, 2], display: '↑ → ↓' },
  { pattern: [1, 0, 1, 2], display: '→ ↑ → ↓' },
  { pattern: [2, 2, 0, 1], display: '↓ ↓ ↑ →' },
  { pattern: [0, 2, 1, 0], display: '↑ ↓ → ↑' },
];

// ============================================================================
// Puzzle State Types
// ============================================================================

export interface RiddlePuzzleState {
  type: 'riddle';
  riddle: Riddle;
  selectedOption: number;
}

export interface SequencePuzzleState {
  type: 'sequence';
  sequence: Sequence;
  inputIndex: number;
  inputs: number[];
  showPattern: boolean;
}

export type PuzzleState = RiddlePuzzleState | SequencePuzzleState | null;

// ============================================================================
// Scene Data Types
// ============================================================================

/** Scene data passed when entering dungeon */
export interface DungeonSceneData {
  catColor?: CatColor;
  dungeonId?: string;
  floorNumber?: number;
  floor?: DungeonFloor;
  currentRoomId?: string;
  returnFromBattle?: boolean;
  playerX?: number;
  playerY?: number;
}

/** Callback interface for scene transitions */
export interface DungeonSceneCallbacks {
  onGoToBattle: (enemyId: string, returnData: DungeonSceneData) => void;
  onExitToTown: () => void;
  onOpenInventory: (returnData: DungeonSceneData) => void;
}

// ============================================================================
// Content Colors & Icons
// ============================================================================

/** Colors for different content types */
export const CONTENT_COLORS: Record<string, string> = {
  enemy: '#ef4444',
  chest: '#fbbf24',
  npc: '#60a5fa',
  exit: '#a855f7',
  puzzle: '#3b82f6',
  secret: '#eab308',
  interactable: '#22c55e',
};

/** Icons for different content types (used in fallback mode) */
export const CONTENT_ICONS: Record<string, string> = {
  enemy: '!',
  chest: '$',
  npc: '?',
  exit: 'v',
  puzzle: '?',
  secret: '*',
};
