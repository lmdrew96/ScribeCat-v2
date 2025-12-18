/**
 * EnemySpriteLoader
 *
 * Loads enemy sprites for both:
 * - Static single-image enemies (OTHER_ENEMIES/*.png)
 * - Animated slime enemies with sprite sheets (GREY_CAT_SLIME, etc.)
 *
 * Provides sprites and animations for use in BattleScene.
 */

import * as ex from 'excalibur';

// Asset paths (relative from dist/renderer/)
const ENEMIES_BASE = '../../assets/ENEMIES';

/**
 * Slime enemy color variants
 */
export type SlimeColor = 'grey' | 'demonic' | 'babyBlue' | 'black' | 'brown' | 'rainbow';

/**
 * Slime animation types
 */
export type SlimeAnimationType = 'idle' | 'idle2' | 'attack' | 'hurt' | 'death1' | 'death2' | 'walk' | 'jump' | 'sleep' | 'born';

/**
 * Static enemy types (single PNG files)
 */
export type StaticEnemyId =
  | 'rat'
  | 'ratFighter'
  | 'ratWarrior'
  | 'ratRanger'
  | 'ratMage'
  | 'ratNecromancer'
  | 'ruffDog'
  | 'dogWithAxe'
  | 'squirrelWarrior'
  | 'yarnElemental'
  | 'roomba'
  | 'rubberDucky'
  | 'tunaCanBattler';

// Slime folder mappings
const SLIME_FOLDERS: Record<SlimeColor, string> = {
  grey: 'GREY_CAT_SLIME',
  demonic: 'DEMONIC_CAT_SLIME',
  babyBlue: 'BABY_BLUE_CAT_SLIME',
  black: 'BLACK_CAT_SLIME',
  brown: 'BROWN_CAT_SLIME',
  rainbow: 'RAINBOW_CAT_SLIME',
};

// Slime animation file names
const SLIME_ANIM_FILES: Record<SlimeAnimationType, string> = {
  idle: 'Idle.png',
  idle2: 'Idle2.png',
  attack: 'Attack.png',
  hurt: 'Hurt.png',
  death1: 'Death1.png',
  death2: 'Death2.png',
  walk: 'Walk.png',
  jump: 'Jump.png',
  sleep: 'Sleep.png',
  born: 'Born.png',
};

// Slime animation frame counts (approximate - may vary by color)
const SLIME_FRAME_COUNTS: Record<SlimeAnimationType, number> = {
  idle: 4,
  idle2: 4,
  attack: 5,
  hurt: 4,
  death1: 4,
  death2: 4,
  walk: 6,
  jump: 4,
  sleep: 4,
  born: 6,
};

// Static enemy file mappings
const STATIC_ENEMY_FILES: Record<StaticEnemyId, string> = {
  rat: 'Rat.png',
  ratFighter: 'RatFighter.png',
  ratWarrior: 'Rat Warrior.png',
  ratRanger: 'Rat Ranger.png',
  ratMage: 'Rat-Mage.png',
  ratNecromancer: 'Rat Necromancer.png',
  ruffDog: 'Ruff Dog.png',
  dogWithAxe: 'Dog With Axe.png',
  squirrelWarrior: 'Squirrel Warrior.png',
  yarnElemental: 'Yarn_Elemental.png',
  roomba: 'Roomba.png',
  rubberDucky: 'Big_Rubber_Duky.png',
  tunaCanBattler: 'TunaCan-Battler.png',
};

// Frame dimensions for slime sprite sheets
const SLIME_FRAME_WIDTH = 32;
const SLIME_FRAME_HEIGHT = 32;

// Caches
const staticSpriteCache: Map<StaticEnemyId, ex.Sprite> = new Map();
const slimeSpriteSheetCache: Map<string, ex.SpriteSheet> = new Map();
const slimeAnimationCache: Map<string, ex.Animation> = new Map();

/**
 * Get the file path for a static enemy sprite
 */
export function getStaticEnemyPath(id: StaticEnemyId): string {
  return `${ENEMIES_BASE}/OTHER_ENEMIES/${STATIC_ENEMY_FILES[id]}`;
}

/**
 * Get the file path for a slime animation sprite sheet
 */
export function getSlimeAnimPath(color: SlimeColor, anim: SlimeAnimationType): string {
  return `${ENEMIES_BASE}/${SLIME_FOLDERS[color]}/${SLIME_ANIM_FILES[anim]}`;
}

/**
 * Load a static enemy sprite
 */
export async function loadStaticEnemySprite(id: StaticEnemyId): Promise<ex.Sprite | null> {
  if (staticSpriteCache.has(id)) {
    // Clone the cached sprite to avoid scale mutations affecting the cache
    return staticSpriteCache.get(id)!.clone();
  }

  try {
    const path = getStaticEnemyPath(id);
    const image = new ex.ImageSource(path);
    await image.load();
    const sprite = image.toSprite();
    staticSpriteCache.set(id, sprite);
    // Return a clone so the cached version stays pristine
    return sprite.clone();
  } catch (err) {
    console.warn(`[EnemySpriteLoader] Failed to load static enemy: ${id}`, err);
    return null;
  }
}

/**
 * Load a slime sprite sheet for a specific animation
 */
export async function loadSlimeSpriteSheet(
  color: SlimeColor,
  anim: SlimeAnimationType
): Promise<ex.SpriteSheet | null> {
  const cacheKey = `${color}-${anim}`;

  if (slimeSpriteSheetCache.has(cacheKey)) {
    return slimeSpriteSheetCache.get(cacheKey)!;
  }

  try {
    const path = getSlimeAnimPath(color, anim);
    const image = new ex.ImageSource(path);
    await image.load();

    // Detect frame count from image width
    const frameCount = Math.floor(image.width / SLIME_FRAME_WIDTH);

    const spriteSheet = ex.SpriteSheet.fromImageSource({
      image,
      grid: {
        rows: 1,
        columns: frameCount,
        spriteWidth: SLIME_FRAME_WIDTH,
        spriteHeight: SLIME_FRAME_HEIGHT,
      },
    });

    slimeSpriteSheetCache.set(cacheKey, spriteSheet);
    return spriteSheet;
  } catch (err) {
    console.warn(`[EnemySpriteLoader] Failed to load slime sprite sheet: ${color}/${anim}`, err);
    return null;
  }
}

/**
 * Create an animation from a slime sprite sheet
 */
export function createSlimeAnimation(
  spriteSheet: ex.SpriteSheet,
  anim: SlimeAnimationType,
  fps = 8
): ex.Animation {
  const frameCount = spriteSheet.columns;
  const frames: ex.Frame[] = [];

  for (let i = 0; i < frameCount; i++) {
    const sprite = spriteSheet.getSprite(i, 0);
    if (sprite) {
      frames.push({
        graphic: sprite,
        duration: 1000 / fps,
      });
    }
  }

  // Non-looping animations
  const nonLooping: SlimeAnimationType[] = ['death1', 'death2', 'hurt', 'attack', 'born'];
  const strategy = nonLooping.includes(anim)
    ? ex.AnimationStrategy.End
    : ex.AnimationStrategy.Loop;

  return new ex.Animation({ frames, strategy });
}

/**
 * Load a slime animation (convenience function)
 */
export async function loadSlimeAnimation(
  color: SlimeColor,
  anim: SlimeAnimationType,
  fps = 8
): Promise<ex.Animation | null> {
  const cacheKey = `${color}-${anim}`;

  if (slimeAnimationCache.has(cacheKey)) {
    return slimeAnimationCache.get(cacheKey)!.clone();
  }

  const spriteSheet = await loadSlimeSpriteSheet(color, anim);
  if (!spriteSheet) return null;

  const animation = createSlimeAnimation(spriteSheet, anim, fps);
  slimeAnimationCache.set(cacheKey, animation);
  return animation.clone();
}

/**
 * Get the slime color from an enemy sprite folder name
 */
export function getSlimeColorFromFolder(folder: string): SlimeColor | null {
  for (const [color, folderName] of Object.entries(SLIME_FOLDERS)) {
    if (folderName === folder) {
      return color as SlimeColor;
    }
  }
  return null;
}

/**
 * Get the static enemy ID from a sprite file name
 */
export function getStaticEnemyIdFromFile(file: string): StaticEnemyId | null {
  for (const [id, fileName] of Object.entries(STATIC_ENEMY_FILES)) {
    if (fileName === file) {
      return id as StaticEnemyId;
    }
  }
  return null;
}

/**
 * Preload all enemy sprites for faster combat loading
 */
export async function preloadAllEnemySprites(): Promise<void> {
  // Preload all static enemies
  const staticPromises = Object.keys(STATIC_ENEMY_FILES).map((id) =>
    loadStaticEnemySprite(id as StaticEnemyId)
  );

  // Preload idle animations for all slimes
  const slimePromises = Object.keys(SLIME_FOLDERS).map((color) =>
    loadSlimeAnimation(color as SlimeColor, 'idle')
  );

  await Promise.all([...staticPromises, ...slimePromises]);
  console.log(`[EnemySpriteLoader] Preloaded ${staticSpriteCache.size} static enemies and ${slimeAnimationCache.size} slime animations`);
}

/**
 * Clear sprite caches
 */
export function clearEnemySpriteCache(): void {
  staticSpriteCache.clear();
  slimeSpriteSheetCache.clear();
  slimeAnimationCache.clear();
}
