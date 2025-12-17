/**
 * UISpriteLoader
 *
 * Loads UI panel and button sprites from assets/UI/CAT.
 * Supports multiple color themes: BEIGE, BLUE, BROWN, PINK.
 *
 * UI elements available:
 * - CHARACTER - Character info panel
 * - MAINMENU - Main menu frame/panel
 * - OK - OK button
 * - YESNO - Yes/No dialog buttons
 */

import * as ex from 'excalibur';

// Asset path (relative from dist/renderer/)
const UI_BASE = '../../assets/UI/CAT';

/**
 * UI color themes
 */
export type UITheme = 'beige' | 'blue' | 'brown' | 'pink';

/**
 * UI element types
 */
export type UIElementType = 'character' | 'mainmenu' | 'ok' | 'yesno';

// Theme folder mappings
const THEME_FOLDERS: Record<UITheme, string> = {
  beige: 'BEIGE',
  blue: 'BLUE',
  brown: 'BROWN',
  pink: 'PINK',
};

// Element file patterns (theme suffix varies)
const UI_FILES: Record<UIElementType, (theme: UITheme) => string> = {
  character: (theme) => `CHARACTER_${THEME_FOLDERS[theme]}.png`,
  mainmenu: (theme) => `MAINMENU_${THEME_FOLDERS[theme]}.png`,
  ok: (theme) => `OK_${THEME_FOLDERS[theme]}.png`,
  yesno: () => 'YESNO_GREY.png', // YESNO is always grey
};

// Default theme for the game
let currentTheme: UITheme = 'beige';

// Cache for loaded sprites
const spriteCache: Map<string, ex.Sprite> = new Map();

/**
 * Get the current UI theme
 */
export function getCurrentTheme(): UITheme {
  return currentTheme;
}

/**
 * Set the current UI theme
 */
export function setCurrentTheme(theme: UITheme): void {
  currentTheme = theme;
}

/**
 * Get the file path for a UI element
 */
export function getUIElementPath(element: UIElementType, theme: UITheme = currentTheme): string {
  const folder = THEME_FOLDERS[theme];
  const filename = UI_FILES[element](theme);
  return `${UI_BASE}/${folder}/${filename}`;
}

/**
 * Generate cache key for UI element
 */
function getCacheKey(element: UIElementType, theme: UITheme): string {
  return `${element}-${theme}`;
}

/**
 * Load a UI element sprite
 */
export async function loadUISprite(
  element: UIElementType,
  theme: UITheme = currentTheme
): Promise<ex.Sprite | null> {
  const cacheKey = getCacheKey(element, theme);

  if (spriteCache.has(cacheKey)) {
    return spriteCache.get(cacheKey)!;
  }

  try {
    const path = getUIElementPath(element, theme);
    const image = new ex.ImageSource(path);
    await image.load();
    const sprite = image.toSprite();
    spriteCache.set(cacheKey, sprite);
    return sprite;
  } catch (err) {
    console.warn(`[UISpriteLoader] Failed to load UI sprite: ${element} (${theme})`, err);
    return null;
  }
}

/**
 * Create a UI panel actor with NineSlice-like behavior
 * The sprite is scaled to fit the target dimensions
 */
export async function createUIPanel(
  element: UIElementType,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: UITheme = currentTheme,
  z = 100
): Promise<ex.Actor> {
  const actor = new ex.Actor({
    pos: new ex.Vector(x, y),
    anchor: ex.Vector.Half,
    z,
  });

  const sprite = await loadUISprite(element, theme);
  if (sprite) {
    // Scale to target dimensions
    const scaleX = width / sprite.width;
    const scaleY = height / sprite.height;
    sprite.scale = new ex.Vector(scaleX, scaleY);
    actor.graphics.use(sprite);
  } else {
    // Fallback to colored rectangle
    const themeColors: Record<UITheme, string> = {
      beige: '#F5DEB3',
      blue: '#4682B4',
      brown: '#8B4513',
      pink: '#FFB6C1',
    };
    actor.graphics.use(new ex.Rectangle({
      width,
      height,
      color: ex.Color.fromHex(themeColors[theme]),
      strokeColor: ex.Color.Black,
      lineWidth: 3,
    }));
  }

  return actor;
}

/**
 * Create an OK button actor
 */
export async function createOKButton(
  x: number,
  y: number,
  scale = 1,
  theme: UITheme = currentTheme,
  z = 110
): Promise<ex.Actor> {
  const actor = new ex.Actor({
    pos: new ex.Vector(x, y),
    anchor: ex.Vector.Half,
    z,
  });

  const sprite = await loadUISprite('ok', theme);
  if (sprite) {
    sprite.scale = new ex.Vector(scale, scale);
    actor.graphics.use(sprite);
  } else {
    // Fallback
    actor.graphics.use(new ex.Rectangle({
      width: 60 * scale,
      height: 30 * scale,
      color: ex.Color.fromHex('#4CAF50'),
      strokeColor: ex.Color.Black,
      lineWidth: 2,
    }));
  }

  return actor;
}

/**
 * Create Yes/No button actors
 */
export async function createYesNoButtons(
  x: number,
  y: number,
  scale = 1,
  z = 110
): Promise<{ container: ex.Actor; yesButton: ex.Actor; noButton: ex.Actor }> {
  const container = new ex.Actor({
    pos: new ex.Vector(x, y),
    z,
  });

  const sprite = await loadUISprite('yesno');
  if (sprite) {
    sprite.scale = new ex.Vector(scale, scale);
    container.graphics.use(sprite);
  }

  // Create clickable regions for yes/no (approximate positions)
  const buttonWidth = 50 * scale;
  const yesButton = new ex.Actor({
    pos: new ex.Vector(x - buttonWidth, y),
    width: buttonWidth,
    height: 30 * scale,
    z: z + 1,
  });

  const noButton = new ex.Actor({
    pos: new ex.Vector(x + buttonWidth, y),
    width: buttonWidth,
    height: 30 * scale,
    z: z + 1,
  });

  return { container, yesButton, noButton };
}

/**
 * Preload all UI sprites for a theme
 */
export async function preloadUITheme(theme: UITheme = currentTheme): Promise<void> {
  const elements: UIElementType[] = ['character', 'mainmenu', 'ok', 'yesno'];
  const loadPromises = elements.map((element) => loadUISprite(element, theme));
  await Promise.all(loadPromises);
  console.log(`[UISpriteLoader] Preloaded UI theme: ${theme}`);
}

/**
 * Preload all UI sprites for all themes
 */
export async function preloadAllUISprites(): Promise<void> {
  const themes: UITheme[] = ['beige', 'blue', 'brown', 'pink'];
  await Promise.all(themes.map((theme) => preloadUITheme(theme)));
  console.log(`[UISpriteLoader] Preloaded all UI themes (${spriteCache.size} sprites)`);
}

/**
 * Clear sprite cache
 */
export function clearUISpriteCache(): void {
  spriteCache.clear();
}
