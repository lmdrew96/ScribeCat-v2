/**
 * SpriteAdapter
 *
 * Loads cat sprites for Excalibur.js using the same asset structure
 * as the KAPLAY implementation. Provides sprite sheets and animations.
 */

import * as ex from 'excalibur';
import {
  type CatColor,
  type CatAnimationType,
  FRAME_WIDTH,
  FRAME_HEIGHT,
  ANIMATION_FRAMES,
  ANIMATION_SPEEDS,
  ALL_CAT_COLORS,
  STARTER_CATS,
} from '../../data/catSprites.js';

// Re-export types for convenience
export { CatColor, CatAnimationType };

// Base asset path for cat sprites (relative from dist/renderer/)
const CAT_ASSETS_BASE = '../../assets/CATS';

// Non-looping animations
const NON_LOOPING_ANIMS: CatAnimationType[] = ['die', 'die2', 'hurt', 'attack', 'jump'];

// Cat folder names mapping
const CAT_FOLDER_NAMES: Record<CatColor, string> = {
  grey: 'GREY_CAT',
  white: 'WHITE_CAT',
  black: 'BLACK_CAT',
  siamese: 'SIAMESE_CAT',
  bengal: 'BENGAL_CAT',
  tricolor: 'TRICOLOR_CAT',
  egypt: 'EGYPT_CAT',
  batman: 'BATMAN_CAT',
  demon: 'DEMON_CAT',
  pumpkin: 'PUMPKIN_CAT',
  vampire: 'VAMPIRE_CAT',
  wizard: 'WIZARD_CAT',
  xmas: 'XMAS_CAT',
  superhero: 'SUPERHERO_CAT',
  zombie: 'ZOMBIE_CAT',
};

// Animation file names per cat color
// Files follow pattern: <Animation><Suffix>.png
const CAT_ANIMATION_FILES: Record<CatColor, Record<CatAnimationType, string>> = {
  grey: {
    idle: 'IdleCattt', idle2: 'Idle2Cattt', walk: 'RunCattt', run: 'RunCattt',
    sit: 'Sittinggg', sleep: 'SleepCattt', attack: 'AttackCattt', hurt: 'HurtCatttt',
    die: 'DieCattt', die2: 'Die2Cattt', jump: 'JumpCatttt',
  },
  white: {
    idle: 'IdleCatttt', idle2: 'Idle2Catttt', walk: 'RunCatttt', run: 'RunCatttt',
    sit: 'Sittingggg', sleep: 'SleepCatttt', attack: 'AttackCattt', hurt: 'HurtCattttt',
    die: 'DieCattt', die2: 'Die2Cattttt', jump: 'JumpCattttt',
  },
  black: {
    idle: 'IdleCatb', idle2: 'Idle2Catb', walk: 'RunCatb', run: 'RunCatb',
    sit: 'Sittingb', sleep: 'SleepCatb', attack: 'AttackCatb', hurt: 'HurtCatb',
    die: 'DieCatb', die2: 'Die2Catb', jump: 'JumpCabt',
  },
  siamese: {
    idle: 'IdleCattt', idle2: 'Idle2Cattt', walk: 'RunCattt', run: 'RunCattt',
    sit: 'Sittinggg', sleep: 'SleepCattt', attack: 'AttackCattt', hurt: 'HurtCatttt',
    die: 'DieCattt', die2: 'Die2Cattt', jump: 'JumpCatttt',
  },
  bengal: {
    idle: 'IdleCattt', idle2: 'Idle2Cattt', walk: 'RunCattt', run: 'RunCattt',
    sit: 'Sittinggg', sleep: 'SleepCattt', attack: 'AttackCattt', hurt: 'HurtCatttt',
    die: 'DieCattt', die2: 'Die2Cattt', jump: 'JumpCatttt',
  },
  tricolor: {
    idle: 'IdleCattt', idle2: 'Idle2Cattt', walk: 'RunCattt', run: 'RunCattt',
    sit: 'Sittinggg', sleep: 'SleepCattt', attack: 'AttackCattt', hurt: 'HurtCatttt',
    die: 'DieCattt', die2: 'Die2Cattt', jump: 'JumpCatttt',
  },
  egypt: {
    idle: 'IdleCattt', idle2: 'Idle2Cattt', walk: 'RunCattt', run: 'RunCattt',
    sit: 'Sittinggg', sleep: 'SleepCattt', attack: 'AttackCattt', hurt: 'HurtCatttt',
    die: 'DieCattt', die2: 'Die2Cattt', jump: 'JumpCatttt',
  },
  batman: {
    idle: 'IdleCat', idle2: 'Idle2Cat', walk: 'RunCat', run: 'RunCat',
    sit: 'Sitting', sleep: 'SleepCat', attack: 'AttackCat', hurt: 'HurtCat',
    die: 'DieCat', die2: 'Die2Cat', jump: 'JumpCat',
  },
  demon: {
    idle: 'IdleCat', idle2: 'Idle2Cat', walk: 'RunCat', run: 'RunCat',
    sit: 'Sitting', sleep: 'SleepCat', attack: 'AttackCat', hurt: 'HurtCat',
    die: 'DieCat', die2: 'Die2Cat', jump: 'JumpCat',
  },
  pumpkin: {
    idle: 'IdleCat', idle2: 'Idle2Cat', walk: 'RunCat', run: 'RunCat',
    sit: 'Sitting', sleep: 'SleepCat', attack: 'AttackCat', hurt: 'HurtCat',
    die: 'DieCat', die2: 'Die2Cat', jump: 'JumpCat',
  },
  vampire: {
    idle: 'IdleCat', idle2: 'Idle2Cat', walk: 'RunCat', run: 'RunCat',
    sit: 'Sitting', sleep: 'SleepCat', attack: 'AttackCat', hurt: 'HurtCat',
    die: 'DieCat', die2: 'Die2Cat', jump: 'JumpCat',
  },
  wizard: {
    idle: 'IdleCat', idle2: 'Idle2Cat', walk: 'RunCat', run: 'RunCat',
    sit: 'Sitting', sleep: 'SleepCat', attack: 'AttackCat', hurt: 'HurtCat',
    die: 'DieCat', die2: 'Die2Cat', jump: 'JumpCat',
  },
  xmas: {
    idle: 'IdleCat', idle2: 'Idle2Cat', walk: 'RunCat', run: 'RunCat',
    sit: 'Sitting', sleep: 'SleepCat', attack: 'AttackCat', hurt: 'HurtCat',
    die: 'DieCat', die2: 'Die2Cat', jump: 'JumpCat',
  },
  superhero: {
    idle: 'IdleCat', idle2: 'Idle2Cat', walk: 'RunCat', run: 'RunCat',
    sit: 'Sitting', sleep: 'SleepCat', attack: 'AttackCat', hurt: 'HurtCat',
    die: 'DieCat', die2: 'Die2Cat', jump: 'JumpCat',
  },
  // Zombie cat uses a single combined sprite sheet - handled specially
  zombie: {
    idle: 'ZombieCatsSprites', idle2: 'ZombieCatsSprites', walk: 'ZombieCatsSprites', run: 'ZombieCatsSprites',
    sit: 'ZombieCatsSprites', sleep: 'ZombieCatsSprites', attack: 'ZombieCatsSprites', hurt: 'ZombieCatsSprites',
    die: 'ZombieCatsSprites', die2: 'ZombieCatsSprites', jump: 'ZombieCatsSprites',
  },
};

// Cache for loaded sprite sheets
const spriteSheetCache = new Map<string, ex.SpriteSheet>();
const animationCache = new Map<string, ex.Animation>();

/**
 * Get the asset path for a cat animation sprite sheet
 */
export function getCatAssetPath(color: CatColor, animation: CatAnimationType): string {
  const folder = CAT_FOLDER_NAMES[color];
  const fileName = CAT_ANIMATION_FILES[color][animation];

  // Special handling for batman cat which uses a subfolder
  if (color === 'batman') {
    return `${CAT_ASSETS_BASE}/BATMAN_CAT/BlackMask/${fileName}.png`;
  }

  return `${CAT_ASSETS_BASE}/${folder}/${fileName}.png`;
}

/**
 * Load a cat sprite sheet for a specific animation
 */
export async function loadCatSpriteSheet(
  color: CatColor,
  animation: CatAnimationType
): Promise<ex.SpriteSheet> {
  const cacheKey = `${color}-${animation}`;

  // Return cached if available
  if (spriteSheetCache.has(cacheKey)) {
    return spriteSheetCache.get(cacheKey)!;
  }

  const path = getCatAssetPath(color, animation);
  const frameCount = ANIMATION_FRAMES[animation];

  // Load the image
  const image = new ex.ImageSource(path);
  await image.load();

  // Create sprite sheet
  const spriteSheet = ex.SpriteSheet.fromImageSource({
    image,
    grid: {
      rows: 1,
      columns: frameCount,
      spriteWidth: FRAME_WIDTH,
      spriteHeight: FRAME_HEIGHT,
    },
  });

  spriteSheetCache.set(cacheKey, spriteSheet);
  return spriteSheet;
}

/**
 * Create an animation from a sprite sheet
 */
export function createCatAnimation(
  spriteSheet: ex.SpriteSheet,
  animation: CatAnimationType
): ex.Animation {
  const frameCount = ANIMATION_FRAMES[animation];
  const fps = ANIMATION_SPEEDS[animation];
  const loop = !NON_LOOPING_ANIMS.includes(animation);

  const frames: ex.Frame[] = [];
  for (let i = 0; i < frameCount; i++) {
    frames.push({
      graphic: spriteSheet.getSprite(i, 0)!,
      duration: 1000 / fps, // Convert FPS to milliseconds per frame
    });
  }

  return new ex.Animation({
    frames,
    strategy: loop ? ex.AnimationStrategy.Loop : ex.AnimationStrategy.End,
  });
}

/**
 * Load and create a cat animation (convenience function)
 */
export async function loadCatAnimation(
  color: CatColor,
  animation: CatAnimationType
): Promise<ex.Animation> {
  const cacheKey = `${color}-${animation}-anim`;

  // Return cached if available
  if (animationCache.has(cacheKey)) {
    return animationCache.get(cacheKey)!;
  }

  const spriteSheet = await loadCatSpriteSheet(color, animation);
  const anim = createCatAnimation(spriteSheet, animation);

  animationCache.set(cacheKey, anim);
  return anim;
}

/**
 * Preload all animations for a cat color
 */
export async function preloadCatAnimations(color: CatColor): Promise<Map<CatAnimationType, ex.Animation>> {
  const animations = new Map<CatAnimationType, ex.Animation>();
  const animTypes: CatAnimationType[] = ['idle', 'idle2', 'walk', 'run', 'sit', 'sleep', 'attack', 'hurt', 'die', 'die2', 'jump'];

  await Promise.all(
    animTypes.map(async (animType) => {
      try {
        const anim = await loadCatAnimation(color, animType);
        animations.set(animType, anim);
      } catch (err) {
        console.warn(`Failed to load ${color} ${animType} animation:`, err);
      }
    })
  );

  return animations;
}

/**
 * Preload starter cat animations for faster initial load
 */
export async function preloadStarterCats(): Promise<void> {
  await Promise.all(STARTER_CATS.map(color => preloadCatAnimations(color)));
}

/**
 * Clear sprite caches (useful for memory management)
 */
export function clearSpriteCache(): void {
  spriteSheetCache.clear();
  animationCache.clear();
}
