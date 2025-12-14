/**
 * Cat Sprite Definitions for KAPLAY
 *
 * Handles loading and managing cat sprite animations.
 * Assets are in: assets/CATS/<COLOR>_CAT/<Animation>.png
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
  | 'grey'
  | 'white'
  | 'black'
  // Unlockable breeds
  | 'siamese'
  | 'bengal'
  | 'tricolor'
  // Themed/Special
  | 'egypt'
  | 'batman'
  | 'demon'
  | 'pumpkin'
  | 'vampire'
  | 'wizard'
  | 'xmas'
  | 'superhero';

// All available cat colors
export const ALL_CAT_COLORS: CatColor[] = [
  'grey', 'white', 'black',
  'siamese', 'bengal', 'tricolor',
  'egypt', 'batman', 'demon', 'pumpkin',
  'vampire', 'wizard', 'xmas', 'superhero'
];

// Starter cats available immediately
export const STARTER_CATS: CatColor[] = ['grey', 'white', 'black'];

// Cat unlock requirements
export interface CatUnlockRequirement {
  type: 'level' | 'achievement' | 'battles' | 'gold' | 'starter';
  value?: number;
  achievementId?: string;
  description: string;
}

export const CAT_UNLOCK_REQUIREMENTS: Record<CatColor, CatUnlockRequirement> = {
  // Starters - always available
  grey: { type: 'starter', description: 'Available from the start!' },
  white: { type: 'starter', description: 'Available from the start!' },
  black: { type: 'starter', description: 'Available from the start!' },

  // Breed unlocks - level based
  siamese: { type: 'level', value: 3, description: 'Reach Level 3' },
  bengal: { type: 'level', value: 5, description: 'Reach Level 5' },
  tricolor: { type: 'level', value: 7, description: 'Reach Level 7' },

  // Themed unlocks - achievement based
  egypt: { type: 'battles', value: 10, description: 'Win 10 battles' },
  demon: { type: 'battles', value: 25, description: 'Win 25 battles' },
  vampire: { type: 'battles', value: 50, description: 'Win 50 battles' },

  // Special unlocks
  batman: { type: 'level', value: 10, description: 'Reach Level 10' },
  wizard: { type: 'gold', value: 1000, description: 'Collect 1,000 gold total' },
  pumpkin: { type: 'achievement', achievementId: 'halloween', description: 'Seasonal: Halloween' },
  xmas: { type: 'achievement', achievementId: 'christmas', description: 'Seasonal: Christmas' },
  superhero: { type: 'level', value: 15, description: 'Reach Level 15' },
};

// Cat display names
export const CAT_DISPLAY_NAMES: Record<CatColor, string> = {
  grey: 'Grey Cat',
  white: 'White Cat',
  black: 'Black Cat',
  siamese: 'Siamese Cat',
  bengal: 'Bengal Cat',
  tricolor: 'Tricolor Cat',
  egypt: 'Egyptian Cat',
  batman: 'Bat Cat',
  demon: 'Demon Cat',
  pumpkin: 'Pumpkin Cat',
  vampire: 'Vampire Cat',
  wizard: 'Wizard Cat',
  xmas: 'Festive Cat',
  superhero: 'Super Cat',
};

/**
 * Check if a cat is unlocked based on player stats
 */
export function isCatUnlocked(
  color: CatColor,
  stats: { level: number; battlesWon: number; goldEarned: number; achievements: string[] }
): boolean {
  const req = CAT_UNLOCK_REQUIREMENTS[color];

  switch (req.type) {
    case 'starter':
      return true;
    case 'level':
      return stats.level >= (req.value || 0);
    case 'battles':
      return stats.battlesWon >= (req.value || 0);
    case 'gold':
      return stats.goldEarned >= (req.value || 0);
    case 'achievement':
      return req.achievementId ? stats.achievements.includes(req.achievementId) : false;
    default:
      return false;
  }
}

/**
 * Get all cats that are currently unlocked
 */
export function getUnlockedCats(
  stats: { level: number; battlesWon: number; goldEarned: number; achievements: string[] }
): CatColor[] {
  return ALL_CAT_COLORS.filter(color => isCatUnlocked(color, stats));
}

// Frame counts based on actual sprite dimensions (width / 32)
// Audited from GREY_CAT sprites:
export const ANIMATION_FRAMES: Record<CatAnimationType, number> = {
  idle: 7, // 224px / 32 = 7 frames
  idle2: 14, // 448px / 32 = 14 frames
  walk: 7, // 224px / 32 = 7 frames (uses Run sprite)
  run: 7, // 224px / 32 = 7 frames
  sit: 3, // 96px / 32 = 3 frames
  sleep: 3, // 96px / 32 = 3 frames
  attack: 9, // 288px / 32 = 9 frames
  hurt: 7, // 224px / 32 = 7 frames
  die: 15, // 480px / 32 = 15 frames
  die2: 14, // 448px / 32 = 14 frames
  jump: 13, // 416px / 32 = 13 frames
};

// Animation speeds (KAPLAY FPS format)
export const ANIMATION_SPEEDS: Record<CatAnimationType, number> = {
  idle: 8,
  idle2: 6,
  walk: 10,
  run: 12,
  sit: 4,
  sleep: 3,
  attack: 12,
  hurt: 10,
  die: 8,
  die2: 8,
  jump: 10,
};

// Animations that should NOT loop
const NON_LOOPING_ANIMS = ['die', 'die2', 'hurt', 'attack', 'jump'];

// Base asset path for cat sprites (relative from dist/renderer/)
const CAT_ASSETS_BASE = '../../assets/CATS';

// Map cat color to folder name
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
};

// Sprite file names for each animation type
// Files follow pattern: <Animation><Suffix>.png where suffix varies by cat
interface CatSpriteConfig {
  folder: string;
  files: Record<CatAnimationType, string>;
}

// Configuration for each cat color
const CAT_CONFIGS: Record<CatColor, CatSpriteConfig> = {
  grey: {
    folder: 'GREY_CAT',
    files: {
      idle: 'IdleCattt',
      idle2: 'Idle2Cattt',
      walk: 'RunCattt',
      run: 'RunCattt',
      sit: 'Sittinggg',
      sleep: 'SleepCattt',
      attack: 'AttackCattt',
      hurt: 'HurtCatttt',
      die: 'DieCattt',
      die2: 'Die2Cattt',
      jump: 'JumpCatttt',
    },
  },
  white: {
    folder: 'WHITE_CAT',
    files: {
      idle: 'IdleCatttt',
      idle2: 'Idle2Catttt',
      walk: 'RunCatttt',
      run: 'RunCatttt',
      sit: 'Sittingggg',
      sleep: 'SleepCatttt',
      attack: 'AttackCattt',
      hurt: 'HurtCattttt',
      die: 'DieCattt',
      die2: 'Die2Cattttt',
      jump: 'JumpCattttt',
    },
  },
  black: {
    folder: 'BLACK_CAT',
    files: {
      idle: 'IdleCatb',
      idle2: 'Idle2Catb',
      walk: 'RunCatb',
      run: 'RunCatb',
      sit: 'Sittingb',
      sleep: 'SleepCatb',
      attack: 'AttackCatb',
      hurt: 'HurtCatb',
      die: 'DieCatb',
      die2: 'Die2Catb',
      jump: 'JumpCabt',
    },
  },
  siamese: {
    folder: 'SIAMESE_CAT',
    files: {
      idle: 'IdleCattt',
      idle2: 'Idle2Cattt',
      walk: 'RunCattt',
      run: 'RunCattt',
      sit: 'Sittinggg',
      sleep: 'SleepCattt',
      attack: 'AttackCattt',
      hurt: 'HurtCatttt',
      die: 'DieCattt',
      die2: 'Die2Cattt',
      jump: 'JumpCatttt',
    },
  },
  bengal: {
    folder: 'BENGAL_CAT',
    files: {
      idle: 'IdleCattt',
      idle2: 'Idle2Cattt',
      walk: 'RunCattt',
      run: 'RunCattt',
      sit: 'Sittinggg',
      sleep: 'SleepCattt',
      attack: 'AttackCattt',
      hurt: 'HurtCatttt',
      die: 'DieCattt',
      die2: 'Die2Cattt',
      jump: 'JumpCatttt',
    },
  },
  tricolor: {
    folder: 'TRICOLOR_CAT',
    files: {
      idle: 'IdleCattt',
      idle2: 'Idle2Cattt',
      walk: 'RunCattt',
      run: 'RunCattt',
      sit: 'Sittinggg',
      sleep: 'SleepCattt',
      attack: 'AttackCattt',
      hurt: 'HurtCatttt',
      die: 'DieCattt',
      die2: 'Die2Cattt',
      jump: 'JumpCatttt',
    },
  },
  egypt: {
    folder: 'EGYPT_CAT',
    files: {
      idle: 'IdleCattt',
      idle2: 'Idle2Cattt',
      walk: 'RunCattt',
      run: 'RunCattt',
      sit: 'Sittinggg',
      sleep: 'SleepCattt',
      attack: 'AttackCattt',
      hurt: 'HurtCatttt',
      die: 'DieCattt',
      die2: 'Die2Cattt',
      jump: 'JumpCatttt',
    },
  },
  batman: {
    folder: 'BATMAN_CAT/BlackMask', // Uses subfolder
    files: {
      idle: 'IdleCatt',
      idle2: 'IdleCatt', // No idle2 for batman, reuse idle
      walk: 'RunCatt',
      run: 'RunCatt',
      sit: 'Sittingg',
      sleep: 'SleepCatt',
      attack: 'AttackCatt',
      hurt: 'HurtCattt',
      die: 'DieCatt',
      die2: 'Die2Catt',
      jump: 'JumpCattt',
    },
  },
  demon: {
    folder: 'DEMON_CAT',
    files: {
      idle: 'IdleCatd',
      idle2: 'Idle2Catd',
      walk: 'RunCatd',
      run: 'RunCatd',
      sit: 'Sittingd',
      sleep: 'SleepCatd',
      attack: 'AttackCatd',
      hurt: 'HurtCatd',
      die: 'DieCatd',
      die2: 'Die2Catd',
      jump: 'JumpCatd',
    },
  },
  pumpkin: {
    folder: 'PUMPKIN_CAT',
    files: {
      idle: 'IdlePumpkingLighton',
      idle2: 'Idle2PumpkingLighton',
      walk: 'IdlePumpkingLighton', // No run, use idle
      run: 'IdlePumpkingLighton',
      sit: 'IdlePumpkingLightoff',
      sleep: 'IdlePumpkingLightoff',
      attack: 'LightsOpening',
      hurt: 'LightsClosing',
      die: 'DiePumpkin',
      die2: 'DiePumpkin',
      jump: 'JumpPumpkinLightOn',
    },
  },
  vampire: {
    folder: 'VAMPIRE_CAT',
    files: {
      idle: 'IdleCatb',
      idle2: 'Idle2Catb',
      walk: 'RunCatb',
      run: 'RunCatb',
      sit: 'Sittingb',
      sleep: 'SleepCatb',
      attack: 'AttackCatb',
      hurt: 'HurtCatb',
      die: 'DieCatb',
      die2: 'Die2Catb',
      jump: 'JumpCabt',
    },
  },
  wizard: {
    folder: 'WIZARD_CAT',
    files: {
      idle: 'IdleCatb',
      idle2: 'Idle2Catb',
      walk: 'RunCatb',
      run: 'RunCatb',
      sit: 'Sittingb',
      sleep: 'Sleeping',
      attack: 'WizardAttack', // Special wizard attack
      hurt: 'HurtCatb',
      die: 'DieCatb',
      die2: 'Die2Catb',
      jump: 'Jump',
    },
  },
  xmas: {
    folder: 'XMAS_CAT',
    files: {
      idle: 'IdleCattt',
      idle2: 'Idle2Cattt',
      walk: 'RunCattt',
      run: 'RunCattt',
      sit: 'Sittinggg',
      sleep: 'SleepCattt',
      attack: 'AttackCattt',
      hurt: 'HurtCatttt',
      die: 'DieCattt',
      die2: 'Die2Cattt',
      jump: 'JumpCatttt',
    },
  },
  superhero: {
    folder: 'SUPERHERO_CAT',
    files: {
      // Superhero only has a static image, use grey cat animations as fallback
      idle: 'SUPERHERO_CAT',
      idle2: 'SUPERHERO_CAT',
      walk: 'SUPERHERO_CAT',
      run: 'SUPERHERO_CAT',
      sit: 'SUPERHERO_CAT',
      sleep: 'SUPERHERO_CAT',
      attack: 'SUPERHERO_CAT',
      hurt: 'SUPERHERO_CAT',
      die: 'SUPERHERO_CAT',
      die2: 'SUPERHERO_CAT',
      jump: 'SUPERHERO_CAT',
    },
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
 * Check if a cat color has sprite configuration
 */
function hasSpriteConfig(color: CatColor): boolean {
  return color in CAT_CONFIGS;
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

  // Check if we have config for this cat
  if (!hasSpriteConfig(color)) {
    console.warn(`Cat color ${color} not yet configured in sprite system`);
    return;
  }

  const config = CAT_CONFIGS[color];

  // Load each animation as a separate sprite
  const loadPromises = Object.entries(config.files).map(async ([anim, filename]) => {
    const animType = anim as CatAnimationType;
    const frameCount = ANIMATION_FRAMES[animType];
    const spriteName = getCatSpriteName(color, animType);
    const spritePath = `${CAT_ASSETS_BASE}/${config.folder}/${filename}.png`;

    try {
      await k.loadSprite(spriteName, spritePath, {
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
      console.warn(`Failed to load ${spriteName} from ${spritePath}:`, error);
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
