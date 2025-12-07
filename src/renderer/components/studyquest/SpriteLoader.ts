/**
 * SpriteLoader
 *
 * Handles loading and caching sprite sheets for StudyQuest.
 * Provides frame extraction from horizontal sprite sheets.
 */

import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('SpriteLoader');

// Sprite frame dimensions (all cat sprites use 32x32)
const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 32;

// Animation types and their frame counts
export type AnimationType = 'idle' | 'attack' | 'hurt' | 'die' | 'run' | 'jump';

// Animation frame counts (approximate, varies slightly between sprites)
const ANIMATION_FRAMES: Record<AnimationType, number> = {
  idle: 8,
  attack: 10,
  hurt: 8,
  die: 8,
  run: 6,
  jump: 10,
};

// Cat colors available
export type CatColor = 'brown' | 'white' | 'black' | 'orange' | 'grey';

// Enemy types (sprite sheet based)
export type EnemyType = 'slime' | 'ghost';

// Battler types (static HD images from asset packs)
// Note: slimes use animated sprite sheets, not static battlers
export type BattlerType =
  | 'yarn_elemental'
  | 'roomba'
  | 'rubber_ducky'
  | 'dog_warrior'
  | 'dog'
  | 'fishmonger'
  | 'nerf_ranger'
  | 'rat'
  | 'rat_fighter'
  | 'rat_mage'
  | 'rat_necromancer'
  | 'rat_ranger'
  | 'rat_warrior'
  | 'ruff_dog'
  | 'squirrel_warrior'
  | 'can_opener_boss'
  | 'tuna_can'
  | 'big_rubber_ducky';

// Background types
export type BackgroundType =
  | 'town'
  | 'shop'
  | 'alley'
  | 'inn'
  | 'battle_default'
  | 'fish_docks'
  | 'tuna_springs'
  | 'alley_night'
  | 'moonlake';

// Sprite file name mappings for cats (color prefix is added)
const CAT_SPRITE_FILES: Record<AnimationType, string> = {
  idle: 'IdleCat',
  attack: 'AttackCat',
  hurt: 'HurtCat',
  die: 'DieCat',
  run: 'RunCat',
  jump: 'JumpCat',
};

// Enemy sprite file mappings
const ENEMY_SPRITE_FILES: Record<EnemyType, Record<AnimationType, string>> = {
  slime: {
    idle: 'slime_CatSlimeIdle',
    attack: 'slime_CatSlimeAttack',
    hurt: 'slime_CatSlimeHurt',
    die: 'slime_CatSlimeDie',
    run: 'slime_CatSlimeWalk',
    jump: 'slime_CatSlimeJump',
  },
  ghost: {
    idle: 'ghost_GhostIdle',
    attack: 'ghost_GhostAttack',
    hurt: 'ghost_GhostHurt',
    die: 'ghost_GhostDieIdle',
    run: 'ghost_GhostFly',
    jump: 'ghost_GhostFly',
  },
};

// Static battler image files (HD images, not sprite sheets)
const BATTLER_FILES: Record<BattlerType, string> = {
  yarn_elemental: 'battlers/yarn_elemental.png',
  roomba: 'battlers/roomba.png',
  rubber_ducky: 'battlers/rubber_ducky.png',
  dog_warrior: 'battlers/dog_warrior.png',
  dog: 'battlers/dog.png',
  fishmonger: 'battlers/fishmonger.png',
  nerf_ranger: 'battlers/nerf_ranger.png',
  rat: 'battlers/rat.png',
  rat_fighter: 'battlers/rat_fighter.png',
  rat_mage: 'battlers/rat_mage.png',
  rat_necromancer: 'battlers/rat_necromancer.png',
  rat_ranger: 'battlers/rat_ranger.png',
  rat_warrior: 'battlers/rat_warrior.png',
  ruff_dog: 'battlers/ruff_dog.png',
  squirrel_warrior: 'battlers/squirrel_warrior.png',
  can_opener_boss: 'battlers/can_opener_boss.png',
  tuna_can: 'battlers/tuna_can.png',
  big_rubber_ducky: 'battlers/big_rubber_ducky.png',
};

// Background image files
const BACKGROUND_FILES: Record<BackgroundType, string> = {
  town: 'backgrounds/town.png',
  shop: 'backgrounds/shop.png',
  alley: 'backgrounds/alley.png',
  inn: 'backgrounds/inn.png',
  battle_default: 'backgrounds/alley.png', // Default battle background
  fish_docks: 'backgrounds/fish_docks.png',
  tuna_springs: 'backgrounds/tuna_springs.png',
  alley_night: 'backgrounds/alley_night.png',
  moonlake: 'backgrounds/moonlake.png',
};

interface LoadedSprite {
  image: HTMLImageElement;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
}

interface SpriteAnimation {
  sprites: Map<AnimationType, LoadedSprite>;
}

class SpriteLoaderClass {
  private catSprites: Map<CatColor, SpriteAnimation> = new Map();
  private enemySprites: Map<EnemyType, SpriteAnimation> = new Map();
  private battlerImages: Map<BattlerType, HTMLImageElement> = new Map();
  private backgroundImages: Map<BackgroundType, HTMLImageElement> = new Map();
  private loadPromises: Map<string, Promise<HTMLImageElement>> = new Map();

  /**
   * Preload all sprites for a cat color
   */
  async loadCatSprites(color: CatColor): Promise<void> {
    if (this.catSprites.has(color)) return;

    logger.info(`Loading ${color} cat sprites`);
    const sprites = new Map<AnimationType, LoadedSprite>();

    // Load each animation type
    for (const animType of Object.keys(CAT_SPRITE_FILES) as AnimationType[]) {
      try {
        const sprite = await this.loadCatSprite(color, animType);
        if (sprite) {
          sprites.set(animType, sprite);
        }
      } catch (error) {
        logger.warn(`Failed to load ${color} cat ${animType} sprite:`, error);
      }
    }

    this.catSprites.set(color, { sprites });
    logger.info(`Loaded ${sprites.size} animations for ${color} cat`);
  }

  /**
   * Preload all sprites for an enemy type
   */
  async loadEnemySprites(enemyType: EnemyType): Promise<void> {
    if (this.enemySprites.has(enemyType)) return;

    logger.info(`Loading ${enemyType} sprites`);
    const sprites = new Map<AnimationType, LoadedSprite>();

    const fileMap = ENEMY_SPRITE_FILES[enemyType];
    for (const animType of Object.keys(fileMap) as AnimationType[]) {
      try {
        const sprite = await this.loadEnemySprite(enemyType, animType);
        if (sprite) {
          sprites.set(animType, sprite);
        }
      } catch (error) {
        logger.warn(`Failed to load ${enemyType} ${animType} sprite:`, error);
      }
    }

    this.enemySprites.set(enemyType, { sprites });
    logger.info(`Loaded ${sprites.size} animations for ${enemyType}`);
  }

  /**
   * Get a cat sprite for drawing
   */
  getCatSprite(color: CatColor, animation: AnimationType): LoadedSprite | null {
    const catAnim = this.catSprites.get(color);
    return catAnim?.sprites.get(animation) || null;
  }

  /**
   * Get an enemy sprite for drawing
   */
  getEnemySprite(enemyType: EnemyType, animation: AnimationType): LoadedSprite | null {
    const enemyAnim = this.enemySprites.get(enemyType);
    return enemyAnim?.sprites.get(animation) || null;
  }

  /**
   * Load a static battler image (HD image, not sprite sheet)
   */
  async loadBattler(battlerType: BattlerType): Promise<void> {
    if (this.battlerImages.has(battlerType)) return;

    const fileName = BATTLER_FILES[battlerType];
    const path = `../../assets/sprites/studyquest/${fileName}`;

    try {
      const image = await this.loadImage(path);
      this.battlerImages.set(battlerType, image);
      logger.info(`Loaded battler: ${battlerType}`);
    } catch (error) {
      logger.warn(`Failed to load battler ${battlerType}:`, error);
    }
  }

  /**
   * Get a battler image for drawing
   */
  getBattler(battlerType: BattlerType): HTMLImageElement | null {
    return this.battlerImages.get(battlerType) || null;
  }

  /**
   * Load a background image
   */
  async loadBackground(bgType: BackgroundType): Promise<void> {
    if (this.backgroundImages.has(bgType)) return;

    const fileName = BACKGROUND_FILES[bgType];
    const path = `../../assets/sprites/studyquest/${fileName}`;

    try {
      const image = await this.loadImage(path);
      this.backgroundImages.set(bgType, image);
      logger.info(`Loaded background: ${bgType}`);
    } catch (error) {
      logger.warn(`Failed to load background ${bgType}:`, error);
    }
  }

  /**
   * Get a background image for drawing
   */
  getBackground(bgType: BackgroundType): HTMLImageElement | null {
    return this.backgroundImages.get(bgType) || null;
  }

  /**
   * Draw a battler (static image) to canvas
   * Scales to fit within maxWidth/maxHeight while maintaining aspect ratio
   */
  drawBattler(
    ctx: CanvasRenderingContext2D,
    battlerType: BattlerType,
    x: number,
    y: number,
    maxWidth: number = 80,
    maxHeight: number = 80,
    flipX: boolean = false
  ): void {
    const image = this.battlerImages.get(battlerType);
    if (!image) return;

    // Calculate scale to fit within bounds
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    const dw = image.width * scale;
    const dh = image.height * scale;

    ctx.save();

    if (flipX) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.drawImage(image, x - dw / 2, y - dh / 2, dw, dh);
    }

    ctx.restore();
  }

  /**
   * Draw a background image to canvas (fills entire canvas)
   */
  drawBackground(
    ctx: CanvasRenderingContext2D,
    bgType: BackgroundType,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const image = this.backgroundImages.get(bgType);
    if (!image) return;

    // Draw background scaled to fill canvas
    ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);
  }

  /**
   * Draw a sprite frame to canvas
   */
  drawFrame(
    ctx: CanvasRenderingContext2D,
    sprite: LoadedSprite,
    frameIndex: number,
    x: number,
    y: number,
    scale: number = 2,
    flipX: boolean = false
  ): void {
    const frame = frameIndex % sprite.frameCount;
    const sx = frame * sprite.frameWidth;
    const sy = 0;
    const sw = sprite.frameWidth;
    const sh = sprite.frameHeight;
    const dw = sw * scale;
    const dh = sh * scale;

    ctx.save();

    if (flipX) {
      ctx.translate(x + dw / 2, y);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite.image, sx, sy, sw, sh, -dw / 2, 0, dw, dh);
    } else {
      ctx.drawImage(sprite.image, sx, sy, sw, sh, x - dw / 2, y, dw, dh);
    }

    ctx.restore();
  }

  // Private helpers

  private async loadCatSprite(color: CatColor, animation: AnimationType): Promise<LoadedSprite | null> {
    const baseName = CAT_SPRITE_FILES[animation];
    // File names have inconsistent suffixes, so we need to find the right one
    const possibleNames = this.getCatFileVariants(color, baseName);

    for (const fileName of possibleNames) {
      const path = `../../assets/sprites/studyquest/cats/${fileName}.png`;
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
        // Try next variant
      }
    }

    return null;
  }

  private async loadEnemySprite(enemyType: EnemyType, animation: AnimationType): Promise<LoadedSprite | null> {
    const fileName = ENEMY_SPRITE_FILES[enemyType][animation];
    const path = `../../assets/sprites/studyquest/enemies/${fileName}.png`;

    try {
      const image = await this.loadImage(path);
      if (image) {
        // Enemy sprites may have different frame sizes
        const frameWidth = enemyType === 'ghost' ? 64 : FRAME_WIDTH;
        const frameHeight = enemyType === 'ghost' ? 64 : FRAME_HEIGHT;
        const frameCount = Math.floor(image.width / frameWidth);
        return {
          image,
          frameCount,
          frameWidth,
          frameHeight,
        };
      }
    } catch (error) {
      logger.warn(`Failed to load enemy sprite ${path}:`, error);
    }

    return null;
  }

  private getCatFileVariants(color: CatColor, baseName: string): string[] {
    // Different cat colors have slightly different file naming conventions
    // This generates all possible variants to try - order matters, most common first
    const variants: string[] = [];

    // Our asset files use 'tt' suffix (baseName ends in 't', so tt gives us 3 t's total)
    // Try most common suffixes first based on actual file names
    const suffixes = ['tt', 'ttt', 't', 'tttt', 'ttttt', 'b', '', 'g', 'gg', 'ggg', 'gggg'];

    for (const suffix of suffixes) {
      variants.push(`${color}_${baseName}${suffix}`);
    }

    // Special cases for specific animations that have known variants
    if (baseName === 'HurtCat') {
      // Some files may have extra t's
      variants.unshift(`${color}_HurtCattt`, `${color}_HurtCatttt`);
    }
    if (baseName === 'JumpCat') {
      // Some files may have extra t's
      variants.unshift(`${color}_JumpCattt`, `${color}_JumpCatttt`);
    }

    return variants;
  }

  private async loadImage(path: string): Promise<HTMLImageElement> {
    // Check if already loading
    if (this.loadPromises.has(path)) {
      return this.loadPromises.get(path)!;
    }

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
      img.src = path;
    });

    this.loadPromises.set(path, promise);
    return promise;
  }
}

// Export singleton instance
export const SpriteLoader = new SpriteLoaderClass();

// Export animation frame info for external use
export { ANIMATION_FRAMES, FRAME_WIDTH, FRAME_HEIGHT };

// Export battler and background file mappings for reference
export { BATTLER_FILES, BACKGROUND_FILES };
