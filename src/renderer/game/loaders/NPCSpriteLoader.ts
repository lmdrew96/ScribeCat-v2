/**
 * NPCSpriteLoader
 *
 * Loads NPC sprites from assets/NPCs.
 * Currently supports:
 * - INN_CLERK.png - Innkeeper sprite
 * - SHOP_CLERK.png - Shopkeeper sprite
 */

import * as ex from 'excalibur';

// Asset path (relative from dist/renderer/)
const NPC_BASE = '../../assets/NPCs';

/**
 * Available NPC identifiers
 */
export type NPCId = 'innkeeper' | 'shopkeeper';

// NPC file mappings
const NPC_FILES: Record<NPCId, string> = {
  innkeeper: 'INN_CLERK.png',
  shopkeeper: 'SHOP_CLERK.png',
};

// Cache for loaded sprites
const spriteCache: Map<NPCId, ex.Sprite> = new Map();

/**
 * Get the file path for an NPC sprite
 */
export function getNPCPath(id: NPCId): string {
  return `${NPC_BASE}/${NPC_FILES[id]}`;
}

/**
 * Load an NPC sprite
 */
export async function loadNPCSprite(id: NPCId): Promise<ex.Sprite | null> {
  if (spriteCache.has(id)) {
    // Clone the cached sprite to avoid scale mutations affecting the cache
    return spriteCache.get(id)!.clone();
  }

  try {
    const path = getNPCPath(id);
    const image = new ex.ImageSource(path);
    await image.load();
    const sprite = image.toSprite();
    spriteCache.set(id, sprite);
    // Return a clone so the cached version stays pristine
    return sprite.clone();
  } catch (err) {
    console.warn(`[NPCSpriteLoader] Failed to load NPC sprite: ${id}`, err);
    return null;
  }
}

/**
 * Create an NPC actor with sprite
 */
export async function createNPCActor(
  id: NPCId,
  x: number,
  y: number,
  targetSize = 60,
  z = 6
): Promise<ex.Actor> {
  const actor = new ex.Actor({
    pos: new ex.Vector(x, y),
    anchor: ex.Vector.Half,
    z,
  });

  const sprite = await loadNPCSprite(id);
  if (sprite) {
    // Scale sprite to target size
    const scale = targetSize / Math.max(sprite.width, sprite.height);
    sprite.scale = new ex.Vector(scale, scale);
    actor.graphics.use(sprite);
  } else {
    // Fallback to colored rectangle
    const colors: Record<NPCId, string> = {
      innkeeper: '#90EE90', // Light green
      shopkeeper: '#FFC896', // Peach
    };
    actor.graphics.use(new ex.Rectangle({
      width: 40,
      height: targetSize,
      color: ex.Color.fromHex(colors[id]),
      strokeColor: ex.Color.fromHex('#8B4513'),
      lineWidth: 3,
    }));
  }

  return actor;
}

/**
 * Preload all NPC sprites
 */
export async function preloadAllNPCSprites(): Promise<void> {
  const loadPromises = Object.keys(NPC_FILES).map((id) =>
    loadNPCSprite(id as NPCId)
  );

  await Promise.all(loadPromises);
  console.log(`[NPCSpriteLoader] Preloaded ${spriteCache.size} NPC sprites`);
}

/**
 * Clear sprite cache
 */
export function clearNPCSpriteCache(): void {
  spriteCache.clear();
}
