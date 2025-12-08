/**
 * Cat Sprite Definitions for KAPLAY
 *
 * Handles loading and managing cat sprite animations.
 * Ported from CatSpriteManager.ts
 */

import type { KAPLAYCtx } from 'kaplay';

// Standard sprite frame dimensions
export const FRAME_WIDTH = 32;
export const FRAME_HEIGHT = 32;

// Animation types available for cats
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

// Direction for movement animations
export type Direction = 'up' | 'down' | 'left' | 'right';

// Cat colors - starter and unlockable
export type CatColor =
  // Starters
  | 'brown'
  | 'white'
  | 'black'
  | 'orange'
  | 'grey'
  // Unlockable breeds
  | 'siamese'
  | 'tiger'
  | 'calico'
  // Themed
  | 'pirate'
  | 'egypt'
  | 'batman'
  | 'demonic'
  | 'halloween'
  | 'christmas'
  | 'pixel'
  | 'zombie';

// Starter cats available immediately
export const STARTER_CATS: CatColor[] = ['brown', 'white', 'black', 'orange', 'grey'];

// Animation frame counts (varies by animation)
export const ANIMATION_FRAMES: Record<CatAnimationType, number> = {
  idle: 8,
  idle2: 8,
  walk: 6,
  run: 6,
  sit: 8,
  sleep: 8,
  attack: 10,
  hurt: 8,
  die: 8,
  die2: 8,
  jump: 10,
};

// Animation speeds (converted to KAPLAY's FPS format)
// Original was "frames to hold" - KAPLAY uses FPS
// 60fps / holdFrames = animFPS
export const ANIMATION_SPEEDS: Record<CatAnimationType, number> = {
  idle: 7, // was 8 hold frames
  idle2: 6, // was 10 hold frames
  walk: 10, // was 6 hold frames
  run: 15, // was 4 hold frames
  sit: 5, // was 12 hold frames
  sleep: 4, // was 16 hold frames
  attack: 15, // was 4 hold frames
  hurt: 10, // was 6 hold frames
  die: 7,
  die2: 7,
  jump: 12, // was 5 hold frames
};

// Animations that should NOT loop
const NON_LOOPING_ANIMS = ['die', 'die2', 'hurt', 'attack'];

// Base asset path for cat sprites
const CAT_ASSETS_BASE = 'assets/sprites/studyquest/cats';

// Starter cat color type
type StarterCatColor = 'brown' | 'white' | 'black' | 'orange' | 'grey';

// Exact sprite file names for each cat color and animation
const CAT_SPRITE_FILES: Record<StarterCatColor, Record<CatAnimationType, string>> = {
  brown: {
    idle: 'brown_IdleCattt',
    idle2: 'brown_Idle2Cattt',
    walk: 'brown_RunCattt',
    run: 'brown_RunCattt',
    sit: 'brown_Sittinggg',
    sleep: 'brown_SleepCattt',
    attack: 'brown_AttackCattt',
    hurt: 'brown_HurtCatttt',
    die: 'brown_DieCattt',
    die2: 'brown_Die2Cattt',
    jump: 'brown_JumpCatttt',
  },
  white: {
    idle: 'white_IdleCatttt',
    idle2: 'white_Idle2Catttt',
    walk: 'white_RunCatttt',
    run: 'white_RunCatttt',
    sit: 'white_Sittingggg',
    sleep: 'white_SleepCatttt',
    attack: 'white_AttackCattt',
    hurt: 'white_HurtCattttt',
    die: 'white_DieCattt',
    die2: 'white_Die2Cattttt',
    jump: 'white_JumpCattttt',
  },
  black: {
    idle: 'black_IdleCatb',
    idle2: 'black_Idle2Catb',
    walk: 'black_RunCatb',
    run: 'black_RunCatb',
    sit: 'black_Sittingb',
    sleep: 'black_SleepCatb',
    attack: 'black_AttackCatb',
    hurt: 'black_HurtCatb',
    die: 'black_DieCatb',
    die2: 'black_Die2Catb',
    jump: 'black_JumpCabt',
  },
  orange: {
    idle: 'orange_IdleCatt',
    idle2: 'orange_Idle2Catt',
    walk: 'orange_RunCatt',
    run: 'orange_RunCatt',
    sit: 'orange_Sittingg',
    sleep: 'orange_SleepCatt',
    attack: 'orange_AttackCatt',
    hurt: 'orange_HurtCattt',
    die: 'orange_DieCatt',
    die2: 'orange_Die2Catt',
    jump: 'orange_JumpCattt',
  },
  grey: {
    idle: 'grey_IdleCattt',
    idle2: 'grey_Idle2Cattt',
    walk: 'grey_RunCattt',
    run: 'grey_RunCattt',
    sit: 'grey_Sittinggg',
    sleep: 'grey_SleepCattt',
    attack: 'grey_AttackCattt',
    hurt: 'grey_HurtCatttt',
    die: 'grey_DieCattt',
    die2: 'grey_Die2',
    jump: 'grey_JumpCatttt',
  },
};

// Track loaded sprites per game instance
const loadedSprites = new Map<KAPLAYCtx, Set<string>>();

/**
 * Get the sprite name for a cat animation
 */
export function getCatSpriteName(color: CatColor, anim: CatAnimationType): string {
  return `cat_${color}_${anim}`;
}

/**
 * Check if a cat color is a starter cat
 */
function isStarterCat(color: CatColor): color is StarterCatColor {
  return (STARTER_CATS as CatColor[]).includes(color);
}

/**
 * Load all sprites for a cat color
 */
export async function loadCatSprites(k: KAPLAYCtx, color: CatColor): Promise<void> {
  // Track loaded sprites for this game instance
  if (!loadedSprites.has(k)) {
    loadedSprites.set(k, new Set());
  }
  const loaded = loadedSprites.get(k)!;

  // Skip if already loaded for this color
  if (loaded.has(color)) {
    return;
  }

  // Only starter cats have exact file mappings
  if (!isStarterCat(color)) {
    console.warn(`Cat color ${color} not yet supported in KAPLAY sprite system`);
    return;
  }

  const files = CAT_SPRITE_FILES[color];

  // Load each animation as a separate sprite
  const loadPromises = Object.entries(files).map(async ([anim, filename]) => {
    const animType = anim as CatAnimationType;
    const frameCount = ANIMATION_FRAMES[animType];
    const spriteName = getCatSpriteName(color, animType);

    try {
      await k.loadSprite(spriteName, `${CAT_ASSETS_BASE}/${filename}.png`, {
        sliceX: frameCount,
        sliceY: 1,
        anims: {
          [anim]: {
            from: 0,
            to: frameCount - 1,
            speed: ANIMATION_SPEEDS[animType],
            loop: !NON_LOOPING_ANIMS.includes(anim),
          },
        },
      });
    } catch (error) {
      console.warn(`Failed to load ${spriteName}:`, error);
    }
  });

  await Promise.all(loadPromises);
  loaded.add(color);
}

/**
 * Preload all starter cat sprites
 */
export async function preloadStarterCats(k: KAPLAYCtx): Promise<void> {
  await Promise.all(STARTER_CATS.map((color) => loadCatSprites(k, color)));
}

/**
 * Get the animation to use based on movement state
 */
export function getMovementAnimation(isMoving: boolean, speed: 'walk' | 'run' = 'walk'): CatAnimationType {
  if (!isMoving) {
    return 'idle';
  }
  return speed === 'run' ? 'run' : 'walk';
}

/**
 * Get the animation to use based on idle state
 */
export function getIdleAnimation(
  isActive: boolean,
  isSleeping: boolean,
  specialState?: 'sit' | 'play'
): CatAnimationType {
  if (isSleeping) return 'sleep';
  if (specialState === 'sit') return 'sit';
  if (specialState === 'play') return 'jump';
  return isActive ? 'idle' : 'idle2';
}

/**
 * Clean up loaded sprites tracking for a game instance
 */
export function cleanupSpriteTracking(k: KAPLAYCtx): void {
  loadedSprites.delete(k);
}
