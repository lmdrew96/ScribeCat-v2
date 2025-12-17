/**
 * Game Asset Loaders
 *
 * Central export point for all asset loading utilities.
 */

// Background images
export {
  loadBackground,
  createBackgroundActor,
  createSceneBackground,
  createFallbackBackground,
  preloadAllBackgrounds,
  getSceneBackground,
  type BackgroundId,
} from './BackgroundLoader.js';

// Enemy sprites (static and animated)
export {
  loadStaticEnemySprite,
  loadSlimeSpriteSheet,
  loadSlimeAnimation,
  createSlimeAnimation,
  getSlimeColorFromFolder,
  getStaticEnemyIdFromFile,
  preloadAllEnemySprites,
  type SlimeColor,
  type SlimeAnimationType,
  type StaticEnemyId,
} from './EnemySpriteLoader.js';

// NPC sprites
export {
  loadNPCSprite,
  createNPCActor,
  preloadAllNPCSprites,
  type NPCId,
} from './NPCSpriteLoader.js';

// Item sprites
export {
  loadItemSprite,
  loadItemSpriteByItemId,
  createItemIconActor,
  hasItemSprite,
  getItemSpriteId,
  preloadAllItemSprites,
  type ItemSpriteId,
} from './ItemSpriteLoader.js';

// UI sprites
export {
  loadUISprite,
  createUIPanel,
  createOKButton,
  createYesNoButtons,
  getCurrentTheme,
  setCurrentTheme,
  preloadUITheme,
  preloadAllUISprites,
  type UITheme,
  type UIElementType,
} from './UISpriteLoader.js';

// Tilemap room templates
export {
  loadRoomTemplate,
  createTilemapRoom,
  createTileActors,
  shouldUseTilemap,
  getTemplateForRoomType,
  preloadDungeonRoomTemplates,
  type DungeonRoomTemplateId,
  type TilemapRoom,
} from './TilemapRoomLoader.js';

/**
 * Preload all game assets
 * Call this at game startup for faster scene transitions
 */
export async function preloadAllAssets(): Promise<void> {
  const { preloadAllBackgrounds } = await import('./BackgroundLoader.js');
  const { preloadAllEnemySprites } = await import('./EnemySpriteLoader.js');
  const { preloadAllNPCSprites } = await import('./NPCSpriteLoader.js');
  const { preloadAllItemSprites } = await import('./ItemSpriteLoader.js');
  const { preloadAllUISprites } = await import('./UISpriteLoader.js');
  const { preloadDungeonRoomTemplates } = await import('./TilemapRoomLoader.js');

  await Promise.all([
    preloadAllBackgrounds(),
    preloadAllEnemySprites(),
    preloadAllNPCSprites(),
    preloadAllItemSprites(),
    preloadAllUISprites(),
    preloadDungeonRoomTemplates(),
  ]);

  console.log('[Loaders] All game assets preloaded');
}
