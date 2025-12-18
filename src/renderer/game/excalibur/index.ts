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

// UI Components
export {
  UIBuilder,
  createUIBuilder,
  clearActors,
  type PanelOptions,
  type ButtonOptions,
  type LabelOptions,
  type ListItem,
  type ScrollableListOptions,
  type TabBarOptions,
  type ToastOptions,
  type ScrollableListResult,
} from './ui/UIBuilder.js';

export {
  MenuController,
  createListMenuController,
  createTabController,
  createGridMenuController,
  type MenuDirection,
  type MenuControllerEvents,
  type MenuControllerConfig,
} from './ui/MenuController.js';

export {
  UIOverlayManager,
  injectOverlayStyles,
  type UIOverlayEvents,
  type OverlayComponent,
  type UIOverlayManagerConfig,
} from './ui/UIOverlayManager.js';

export {
  SceneFontCache,
  CommonFonts,
} from './ui/FontCache.js';

export {
  MAX_VISIBLE_ITEMS,
  MENU_ITEM_HEIGHT,
  UI_PADDING,
  UI_LAYERS,
  ANIMATION_DURATION,
  INPUT_COOLDOWN_MS,
} from './ui/UIConstants.js';

// Reusable Scene Components
export {
  DungeonHUD,
  PauseMenuController,
  ShopOverlay,
  DialogOverlay,
  MessageToast,
  type DungeonHUDConfig,
  type PauseMenuConfig,
  type PauseMenuCallbacks,
  type PauseMenuOption,
  type ShopOverlayCallbacks,
  type DialogOverlayOptions,
  type DialogButton,
  type DialogItem,
  type ToastType,
  type ToastOptions,
} from './components/index.js';

// Re-export excalibur for convenience
export * as ex from 'excalibur';
