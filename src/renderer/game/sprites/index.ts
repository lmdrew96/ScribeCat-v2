/**
 * Sprite Exports
 *
 * Barrel file for sprite-related utilities.
 */

export {
  // Types
  type CatAnimationType,
  type CatColor,
  type Direction,

  // Constants
  FRAME_WIDTH,
  FRAME_HEIGHT,
  ANIMATION_FRAMES,
  ANIMATION_SPEEDS,
  STARTER_CATS,

  // Functions
  getCatSpriteName,
  loadCatSprites,
  preloadStarterCats,
  getMovementAnimation,
  getIdleAnimation,
  cleanupSpriteTracking,
} from './catSprites.js';
