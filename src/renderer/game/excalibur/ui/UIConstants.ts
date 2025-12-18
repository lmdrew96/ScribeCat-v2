/**
 * UI Constants - Shared constants for Excalibur UI components
 *
 * Centralizes common UI configuration values to ensure consistency
 * across different scenes.
 */

/**
 * Maximum number of items visible in scrollable lists
 * Used in ShopScene, InventoryScene, and other item menus
 */
export const MAX_VISIBLE_ITEMS = 6;

/**
 * Menu item height in pixels for list-based menus
 */
export const MENU_ITEM_HEIGHT = 24;

/**
 * Standard padding values
 */
export const UI_PADDING = {
  SMALL: 5,
  MEDIUM: 10,
  LARGE: 20,
} as const;

/**
 * Z-index layers for UI elements
 */
export const UI_LAYERS = {
  BACKGROUND: 0,
  GAME_OBJECTS: 10,
  HUD: 50,
  MENU: 100,
  OVERLAY: 200,
  MODAL: 500,
  PAUSE_MENU: 800,
  TOOLTIP: 900,
  SCREEN_FIXED: 1000,
} as const;

/**
 * Common animation durations in milliseconds
 */
export const ANIMATION_DURATION = {
  FAST: 100,
  NORMAL: 200,
  SLOW: 500,
  FADE: 300,
} as const;

/**
 * Input cooldown duration after scene transitions (in ms)
 */
export const INPUT_COOLDOWN_MS = 200;
