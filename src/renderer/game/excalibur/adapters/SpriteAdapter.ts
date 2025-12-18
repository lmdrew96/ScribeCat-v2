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
    die: 'DieCattt', die2: 'Die2', jump: 'JumpCatttt',
  },
  bengal: {
    idle: 'IdleCatt', idle2: 'Idle2Catt', walk: 'RunCatt', run: 'RunCatt',
    sit: 'Sittingg', sleep: 'SleepCatt', attack: 'AttackCatt', hurt: 'HurtCattt',
    die: 'DieCatt', die2: 'Die2Catt', jump: 'JumpCattt',
  },
  tricolor: {
    idle: 'IdleCatt', idle2: 'Idle2Catt', walk: 'RunCatt', run: 'RunCatt',
    sit: 'Sittingg', sleep: 'SleepCatt', attack: 'AttackCatt', hurt: 'HurtCattt',
    die: 'DieCatt', die2: 'Die', jump: 'JumpCattt',
  },
  egypt: {
    idle: 'IdleCatb', idle2: 'Idle2Catb', walk: 'RunCatb', run: 'RunCatb',
    sit: 'Sittingb', sleep: 'SleepCatb', attack: 'AttackCatb', hurt: 'HurtCatb',
    die: 'DieCatb', die2: 'Die2Catb', jump: 'JumpCabt',
  },
  batman: {
    idle: 'IdleCatt', idle2: 'IdleCatt', walk: 'RunCatt', run: 'RunCatt',
    sit: 'Sittingg', sleep: 'SleepCatt', attack: 'AttackCatt', hurt: 'HurtCattt',
    die: 'DieCatt', die2: 'Die2Catt', jump: 'JumpCattt',
  },
  demon: {
    idle: 'IdleCatd', idle2: 'Idle2Catd', walk: 'RunCatd', run: 'RunCatd',
    sit: 'Sittingd', sleep: 'SleepCatd', attack: 'AttackCatd', hurt: 'HurtCatd',
    die: 'DieCatd', die2: 'Die2Catd', jump: 'JumpCatd',
  },
  pumpkin: {
    idle: 'IdlePumpkingLightoff', idle2: 'Idle2PumpkingLightoff', walk: 'IdlePumpkingLighton', run: 'IdlePumpkingLighton',
    sit: 'IdlePumpkingLightoff', sleep: 'IdlePumpkingLightoff', attack: 'IdlePumpkingLighton', hurt: 'IdlePumpkingLightoff',
    die: 'DiePumpkin', die2: 'DiePumpkin', jump: 'JumpPumpkinLightOff',
  },
  vampire: {
    idle: 'IdleCatb', idle2: 'Idle2Catb', walk: 'RunCatb', run: 'RunCatb',
    sit: 'Sittingb', sleep: 'SleepCatb', attack: 'AttackCatb', hurt: 'HurtCatb',
    die: 'DieCatb', die2: 'Die2Catb', jump: 'JumpCabt',
  },
  wizard: {
    idle: 'IdleCatb', idle2: 'Idle2Catb', walk: 'RunCatb', run: 'RunCatb',
    sit: 'Sittingb', sleep: 'Sleeping', attack: 'Attack', hurt: 'HurtCatb',
    die: 'DieCatb', die2: 'Die2Catb', jump: 'Jump',
  },
  xmas: {
    idle: 'IdleCattt', idle2: 'Idle2Cattt', walk: 'RunCattt', run: 'RunCattt',
    sit: 'Sittinggg', sleep: 'SleepCattt', attack: 'AttackCattt', hurt: 'HurtCatttt',
    die: 'DieCattt', die2: 'Die2Cattt', jump: 'JumpCatttt',
  },
  superhero: {
    idle: 'SUPERHERO_CAT', idle2: 'SUPERHERO_CAT', walk: 'SUPERHERO_CAT', run: 'SUPERHERO_CAT',
    sit: 'SUPERHERO_CAT', sleep: 'SUPERHERO_CAT', attack: 'SUPERHERO_CAT', hurt: 'SUPERHERO_CAT',
    die: 'SUPERHERO_CAT', die2: 'SUPERHERO_CAT', jump: 'SUPERHERO_CAT',
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

  // Return cloned cached animation if available
  // Cloning prevents scale mutations from affecting the cached version
  if (animationCache.has(cacheKey)) {
    return animationCache.get(cacheKey)!.clone();
  }

  const spriteSheet = await loadCatSpriteSheet(color, animation);
  const anim = createCatAnimation(spriteSheet, animation);

  animationCache.set(cacheKey, anim);
  // Return a clone so the cached version stays pristine
  return anim.clone();
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
