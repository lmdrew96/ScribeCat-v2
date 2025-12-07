/**
 * CatSpriteManager
 *
 * Comprehensive sprite manager for cat animations across all StudyQuest features.
 * Handles loading, caching, and drawing of cat sprites with support for:
 * - All animation types (idle, walk, run, sit, sleep, attack, hurt, die, jump)
 * - Multiple cat colors (brown, white, black, orange, grey + unlockables)
 * - Direction-based rendering (for town/dungeon movement)
 *
 * Used by: TownCanvas, DungeonCanvas, StudyBuddyCanvas, BattleCanvas
 */

import { createLogger } from '../../shared/logger.js';

const logger = createLogger('CatSpriteManager');

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
  // Themed (from asset packs)
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

// Animation speeds (frames to hold each sprite frame)
export const ANIMATION_SPEEDS: Record<CatAnimationType, number> = {
  idle: 8,
  idle2: 10,
  walk: 6,
  run: 4,
  sit: 12,
  sleep: 16,
  attack: 4,
  hurt: 6,
  die: 8,
  die2: 8,
  jump: 5,
};

// Base asset path for cat sprites (relative to renderer HTML)
const CAT_ASSETS_BASE = 'assets/sprites/studyquest/cats';

// Exact sprite file names for each cat color and animation
// Based on actual files in src/renderer/assets/sprites/studyquest/cats/
type StarterCatColor = 'brown' | 'white' | 'black' | 'orange' | 'grey';
const CAT_SPRITE_EXACT_FILES: Record<StarterCatColor, Record<CatAnimationType, string>> = {
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

export interface LoadedSprite {
  image: HTMLImageElement;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
}

export interface CatSpriteSet {
  color: CatColor;
  animations: Map<CatAnimationType, LoadedSprite>;
  loaded: boolean;
}

class CatSpriteManagerClass {
  private loadedCats: Map<CatColor, CatSpriteSet> = new Map();
  private loadPromises: Map<string, Promise<HTMLImageElement>> = new Map();

  /**
   * Load all sprites for a cat color
   */
  async loadCat(color: CatColor): Promise<CatSpriteSet> {
    // Return cached if already loaded
    const existing = this.loadedCats.get(color);
    if (existing?.loaded) {
      return existing;
    }

    logger.info(`Loading sprites for ${color} cat`);

    const spriteSet: CatSpriteSet = {
      color,
      animations: new Map(),
      loaded: false,
    };

    // Load each animation type
    const animTypes = Object.keys(ANIMATION_FRAMES) as CatAnimationType[];
    const loadPromises = animTypes.map(async (animType) => {
      const sprite = await this.loadCatAnimation(color, animType);
      if (sprite) {
        spriteSet.animations.set(animType, sprite);
      }
    });

    await Promise.all(loadPromises);
    spriteSet.loaded = true;

    this.loadedCats.set(color, spriteSet);
    logger.info(`Loaded ${spriteSet.animations.size} animations for ${color} cat`);

    return spriteSet;
  }

  /**
   * Preload starter cats
   */
  async preloadStarters(): Promise<void> {
    logger.info('Preloading starter cat sprites');
    await Promise.all(STARTER_CATS.map((color) => this.loadCat(color)));
    logger.info('Starter cats loaded');
  }

  /**
   * Get a loaded cat sprite set
   */
  getCat(color: CatColor): CatSpriteSet | null {
    return this.loadedCats.get(color) || null;
  }

  /**
   * Check if a cat is loaded
   */
  isLoaded(color: CatColor): boolean {
    return this.loadedCats.get(color)?.loaded ?? false;
  }

  /**
   * Get a specific animation sprite
   */
  getAnimation(color: CatColor, animation: CatAnimationType): LoadedSprite | null {
    const cat = this.loadedCats.get(color);
    return cat?.animations.get(animation) || null;
  }

  /**
   * Draw a cat sprite frame to canvas
   */
  drawFrame(
    ctx: CanvasRenderingContext2D,
    color: CatColor,
    animation: CatAnimationType,
    frameIndex: number,
    x: number,
    y: number,
    scale: number = 2,
    flipX: boolean = false
  ): void {
    const sprite = this.getAnimation(color, animation);
    if (!sprite) return;

    const frame = frameIndex % sprite.frameCount;
    const sx = frame * sprite.frameWidth;
    const sy = 0;
    const sw = sprite.frameWidth;
    const sh = sprite.frameHeight;
    const dw = sw * scale;
    const dh = sh * scale;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (flipX) {
      ctx.translate(x + dw / 2, y);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite.image, sx, sy, sw, sh, -dw / 2, 0, dw, dh);
    } else {
      ctx.drawImage(sprite.image, sx, sy, sw, sh, x - dw / 2, y, dw, dh);
    }

    ctx.restore();
  }

  /**
   * Draw a cat with automatic frame calculation based on time
   */
  drawAnimated(
    ctx: CanvasRenderingContext2D,
    color: CatColor,
    animation: CatAnimationType,
    x: number,
    y: number,
    frameCounter: number,
    scale: number = 2,
    direction: Direction = 'right'
  ): void {
    const sprite = this.getAnimation(color, animation);
    if (!sprite) return;

    const speed = ANIMATION_SPEEDS[animation];
    const frameIndex = Math.floor(frameCounter / speed) % sprite.frameCount;
    const flipX = direction === 'left';

    this.drawFrame(ctx, color, animation, frameIndex, x, y, scale, flipX);
  }

  /**
   * Get the animation to use based on movement state
   */
  getMovementAnimation(isMoving: boolean, speed: 'walk' | 'run' = 'walk'): CatAnimationType {
    if (!isMoving) {
      return 'idle';
    }
    return speed === 'run' ? 'run' : 'walk';
  }

  /**
   * Get the animation to use based on idle state (for Study Buddy)
   */
  getIdleAnimation(
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
   * Clear all loaded sprites (for memory management)
   */
  clearCache(): void {
    this.loadedCats.clear();
    this.loadPromises.clear();
    logger.info('Sprite cache cleared');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async loadCatAnimation(
    color: CatColor,
    animation: CatAnimationType
  ): Promise<LoadedSprite | null> {
    // Check if this is a starter cat with exact file mapping
    const starterColors: StarterCatColor[] = ['brown', 'white', 'black', 'orange', 'grey'];
    if (starterColors.includes(color as StarterCatColor)) {
      const exactFileName = CAT_SPRITE_EXACT_FILES[color as StarterCatColor][animation];
      const path = `${CAT_ASSETS_BASE}/${exactFileName}.png`;

      try {
        const image = await this.loadImage(path);
        if (image) {
          const frameCount = Math.floor(image.width / FRAME_WIDTH);
          return {
            image,
            frameCount,
            frameWidth: FRAME_WIDTH,
            frameHeight: FRAME_HEIGHT,
          };
        }
      } catch {
        logger.warn(`Could not load ${color} cat ${animation} animation from ${path}`);
      }

      return null;
    }

    // For non-starter cats (unlockable breeds), try standardized path structure
    const standardPath = `${CAT_ASSETS_BASE}/${color}/${animation}.png`;
    try {
      const image = await this.loadImage(standardPath);
      if (image) {
        const frameCount = Math.floor(image.width / FRAME_WIDTH);
        return {
          image,
          frameCount,
          frameWidth: FRAME_WIDTH,
          frameHeight: FRAME_HEIGHT,
        };
      }
    } catch {
      logger.warn(`Could not load ${color} cat ${animation} animation`);
    }

    return null;
  }

  private async loadImage(path: string): Promise<HTMLImageElement> {
    // Check if already loading
    if (this.loadPromises.has(path)) {
      return this.loadPromises.get(path)!;
    }

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load: ${path}`));
      img.src = path;
    });

    this.loadPromises.set(path, promise);
    return promise;
  }
}

// Export singleton instance
export const CatSpriteManager = new CatSpriteManagerClass();
