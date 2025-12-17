/**
 * Cat Sprite Data
 *
 * Constants and types for cat sprites used throughout the game.
 * Engine-agnostic - works with any rendering system.
 */

import { GameState } from '../state/GameState.js';

// Cat color types
export type CatColor =
  | 'grey'
  | 'white'
  | 'black'
  | 'siamese'
  | 'bengal'
  | 'tricolor'
  | 'egypt'
  | 'batman'
  | 'demon'
  | 'pumpkin'
  | 'vampire'
  | 'wizard'
  | 'xmas'
  | 'superhero'
  | 'zombie';

export type CatAnimationType =
  | 'idle'
  | 'idle2'
  | 'walk'
  | 'run'
  | 'sit'
  | 'sleep'
  | 'attack'
  | 'hurt'
  | 'die'
  | 'die2'
  | 'jump';

// Sprite frame dimensions
export const FRAME_WIDTH = 32;
export const FRAME_HEIGHT = 32;

// Animation frame counts
export const ANIMATION_FRAMES: Record<CatAnimationType, number> = {
  idle: 4,
  idle2: 4,
  walk: 8,
  run: 8,
  sit: 4,
  sleep: 4,
  attack: 4,
  hurt: 2,
  die: 4,
  die2: 4,
  jump: 8,
};

// Animation speeds (FPS)
export const ANIMATION_SPEEDS: Record<CatAnimationType, number> = {
  idle: 6,
  idle2: 6,
  walk: 10,
  run: 12,
  sit: 4,
  sleep: 3,
  attack: 12,
  hurt: 8,
  die: 6,
  die2: 6,
  jump: 10,
};

// All available cat colors
export const ALL_CAT_COLORS: CatColor[] = [
  'grey',
  'white',
  'black',
  'siamese',
  'bengal',
  'tricolor',
  'egypt',
  'batman',
  'demon',
  'pumpkin',
  'vampire',
  'wizard',
  'xmas',
  'superhero',
  'zombie',
];

// Starter cats available at game start
export const STARTER_CATS: CatColor[] = ['grey', 'white', 'black', 'siamese'];

// Display names for cats
export const CAT_DISPLAY_NAMES: Record<CatColor, string> = {
  grey: 'Grey Cat',
  white: 'White Cat',
  black: 'Black Cat',
  siamese: 'Siamese Cat',
  bengal: 'Bengal Cat',
  tricolor: 'Tricolor Cat',
  egypt: 'Egyptian Cat',
  batman: 'Batman Cat',
  demon: 'Demon Cat',
  pumpkin: 'Pumpkin Cat',
  vampire: 'Vampire Cat',
  wizard: 'Wizard Cat',
  xmas: 'Xmas Cat',
  superhero: 'Superhero Cat',
  zombie: 'Zombie Cat',
};

// Unlock requirements for special cats
export const CAT_UNLOCK_REQUIREMENTS: Record<CatColor, { type: string; value: number; description: string }> = {
  grey: { type: 'default', value: 0, description: 'Available from start' },
  white: { type: 'default', value: 0, description: 'Available from start' },
  black: { type: 'default', value: 0, description: 'Available from start' },
  siamese: { type: 'default', value: 0, description: 'Available from start' },
  bengal: { type: 'level', value: 5, description: 'Reach level 5' },
  tricolor: { type: 'level', value: 10, description: 'Reach level 10' },
  egypt: { type: 'gold', value: 1000, description: 'Earn 1000 gold total' },
  batman: { type: 'dungeons', value: 5, description: 'Complete 5 dungeons' },
  demon: { type: 'level', value: 20, description: 'Reach level 20' },
  pumpkin: { type: 'special', value: 0, description: 'Halloween special' },
  vampire: { type: 'special', value: 0, description: 'Halloween special' },
  wizard: { type: 'level', value: 15, description: 'Reach level 15' },
  xmas: { type: 'special', value: 0, description: 'Christmas special' },
  superhero: { type: 'dungeons', value: 10, description: 'Complete 10 dungeons' },
  zombie: { type: 'special', value: 0, description: 'Halloween special' },
};

/**
 * Check if a cat color is unlocked based on player progress
 */
export function isCatUnlocked(color: CatColor): boolean {
  // Starter cats are always unlocked
  if (STARTER_CATS.includes(color)) {
    return true;
  }

  const req = CAT_UNLOCK_REQUIREMENTS[color];
  if (!req) return false;

  const player = GameState.player;

  switch (req.type) {
    case 'default':
      return true;
    case 'level':
      return player.level >= req.value;
    case 'gold':
      return (player.totalGoldEarned || 0) >= req.value;
    case 'dungeons':
      // Use battlesWon as proxy for dungeon progress (dungeons typically have multiple battles)
      return (player.battlesWon || 0) >= req.value * 3;
    case 'special':
      // Special cats could be unlocked via achievements or events
      return player.achievements?.includes(`unlock_${color}`) ?? false;
    default:
      return false;
  }
}
