/**
 * BackgroundLoader
 *
 * Loads and manages background images for scenes.
 * Handles scaling and cropping to fit the game viewport.
 *
 * Background images are displayed as full-screen actors behind other content.
 */

import * as ex from 'excalibur';

// Asset path (relative from dist/renderer/)
const BACKGROUNDS_BASE = '../../assets/BACKGROUNDS';

/**
 * Available background identifiers
 */
export type BackgroundId =
  | 'alley'
  | 'generalStore'
  | 'livingRoom'
  | 'fishDocks'
  | 'catnipFarm'
  | 'town'
  | 'tunaSprings'
  | 'catIndoors'
  | 'moonlake';

// Background file mappings
const BACKGROUND_FILES: Record<BackgroundId, string> = {
  alley: 'Alley.png',
  generalStore: 'Cat-Themed General Store Interior.png',
  livingRoom: 'Cozy Living Room by the Fire.png',
  fishDocks: 'FishDocks.png',
  catnipFarm: 'Outskirts-Catnip-Farm.png',
  town: 'Town_1.png',
  tunaSprings: 'Tuna Springs.png',
  catIndoors: 'cat_indoors_background.png',
  moonlake: 'moonlake 16-9.png',
};

// Scene to background mappings
const SCENE_BACKGROUNDS: Record<string, BackgroundId> = {
  town: 'town',
  shop: 'generalStore',
  inn: 'livingRoom',
  home: 'catIndoors',
  dungeon: 'moonlake', // Default for dungeon entrance
  title: 'moonlake',
};

// Cache for loaded images
const imageCache: Map<BackgroundId, ex.ImageSource> = new Map();

/**
 * Get the file path for a background
 */
export function getBackgroundPath(id: BackgroundId): string {
  return `${BACKGROUNDS_BASE}/${BACKGROUND_FILES[id]}`;
}

/**
 * Load a background image
 */
export async function loadBackground(id: BackgroundId): Promise<ex.ImageSource | null> {
  // Return cached if available
  if (imageCache.has(id)) {
    return imageCache.get(id)!;
  }

  try {
    const path = getBackgroundPath(id);
    const image = new ex.ImageSource(path);
    await image.load();
    imageCache.set(id, image);
    return image;
  } catch (err) {
    console.warn(`[BackgroundLoader] Failed to load background: ${id}`, err);
    return null;
  }
}

/**
 * Get the default background ID for a scene
 */
export function getSceneBackground(sceneName: string): BackgroundId | null {
  return SCENE_BACKGROUNDS[sceneName] || null;
}

/**
 * Create a background actor that fills the viewport with scale-and-crop behavior
 */
export function createBackgroundActor(
  image: ex.ImageSource,
  viewportWidth: number,
  viewportHeight: number,
  z = -100
): ex.Actor {
  const actor = new ex.Actor({
    pos: new ex.Vector(viewportWidth / 2, viewportHeight / 2),
    anchor: ex.Vector.Half,
    z,
  });

  const sprite = image.toSprite();

  // Calculate scale to cover entire viewport (scale-and-crop)
  const imageWidth = image.width;
  const imageHeight = image.height;

  const scaleX = viewportWidth / imageWidth;
  const scaleY = viewportHeight / imageHeight;

  // Use the larger scale to ensure full coverage (cover behavior)
  const scale = Math.max(scaleX, scaleY);

  sprite.scale = new ex.Vector(scale, scale);
  actor.graphics.use(sprite);

  return actor;
}

/**
 * Create a background actor for a scene by name
 * Convenience function that combines loading and actor creation
 */
export async function createSceneBackground(
  sceneName: string,
  viewportWidth: number,
  viewportHeight: number,
  z = -100
): Promise<ex.Actor | null> {
  const bgId = getSceneBackground(sceneName);
  if (!bgId) {
    console.warn(`[BackgroundLoader] No background defined for scene: ${sceneName}`);
    return null;
  }

  const image = await loadBackground(bgId);
  if (!image) {
    return null;
  }

  return createBackgroundActor(image, viewportWidth, viewportHeight, z);
}

/**
 * Create a solid color fallback background
 * Used when image loading fails or as a temporary placeholder
 */
export function createFallbackBackground(
  color: ex.Color,
  viewportWidth: number,
  viewportHeight: number,
  z = -100
): ex.Actor {
  const actor = new ex.Actor({
    pos: new ex.Vector(viewportWidth / 2, viewportHeight / 2),
    anchor: ex.Vector.Half,
    width: viewportWidth,
    height: viewportHeight,
    z,
  });

  actor.graphics.use(
    new ex.Rectangle({
      width: viewportWidth,
      height: viewportHeight,
      color,
    })
  );

  return actor;
}

/**
 * Preload all backgrounds for faster scene transitions
 */
export async function preloadAllBackgrounds(): Promise<void> {
  const loadPromises = Object.keys(BACKGROUND_FILES).map((id) =>
    loadBackground(id as BackgroundId)
  );

  await Promise.all(loadPromises);
  console.log(`[BackgroundLoader] Preloaded ${imageCache.size} backgrounds`);
}

/**
 * Clear the image cache (useful for memory management)
 */
export function clearBackgroundCache(): void {
  imageCache.clear();
}
