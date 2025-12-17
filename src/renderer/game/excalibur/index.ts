/**
 * Excalibur.js Game Engine Module
 *
 * Exports for the Excalibur-based StudyQuest implementation.
 */

// Core game class
export { ExcaliburGame, type ExcaliburGameConfig } from './ExcaliburGame.js';

// Adapters
export {
  InputManager,
  type GameKey,
} from './adapters/InputAdapter.js';

export {
  loadCatSpriteSheet,
  loadCatAnimation,
  preloadCatAnimations,
  preloadStarterCats,
  createCatAnimation,
  getCatAssetPath,
  clearSpriteCache,
  type CatColor,
  type CatAnimationType,
} from './adapters/SpriteAdapter.js';

// Re-export excalibur for convenience
export * as ex from 'excalibur';
