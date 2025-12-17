/**
 * ItemSpriteLoader
 *
 * Loads item sprites from assets/ITEMS for inventory and shop displays.
 * Maps item IDs to their corresponding sprite files.
 */

import * as ex from 'excalibur';

// Asset path (relative from dist/renderer/)
const ITEMS_BASE = '../../assets/ITEMS';

/**
 * Item sprite identifiers matching available asset files
 */
export type ItemSpriteId =
  | 'amulet'
  | 'amulet_green'
  | 'blue_yarn'
  | 'crystal'
  | 'cutlass'
  | 'fish'
  | 'golden_fish'
  | 'laser_pointer'
  | 'leaf'
  | 'mouse'
  | 'potion_green'
  | 'potion_pink'
  | 'potion_purple'
  | 'potion_red'
  | 'potion_teal'
  | 'potion_yellow'
  | 'red_yarn'
  | 'sword1'
  | 'sword2'
  | 'tan_yarn'
  | 'treasure_chest'
  | 'tuna_can'
  | 'tuna_can2'
  | 'wand';

// Sprite file mappings
const ITEM_FILES: Record<ItemSpriteId, string> = {
  amulet: 'amulet.png',
  amulet_green: 'amulet_green.png',
  blue_yarn: 'blue_yarn.png',
  crystal: 'crystal.png',
  cutlass: 'cutlass.png',
  fish: 'fish.png',
  golden_fish: 'golden_fish.png',
  laser_pointer: 'laser_pointer.png',
  leaf: 'leaf.png',
  mouse: 'mouse.png',
  potion_green: 'potion_green.png',
  potion_pink: 'potion_pink.png',
  potion_purple: 'potion_purple.png',
  potion_red: 'potion_red.png',
  potion_teal: 'potion_teal.png',
  potion_yellow: 'potion_yellow.png',
  red_yarn: 'red_yarn.png',
  sword1: 'sword1.png',
  sword2: 'sword2.png',
  tan_yarn: 'tan_yarn.png',
  treasure_chest: 'treasure_chest.png',
  tuna_can: 'tuna_can.png',
  tuna_can2: 'tuna_can2.png',
  wand: 'wand.png',
};

/**
 * Map game item IDs to their sprite IDs
 * This allows the game's item system to use different IDs than the actual file names
 */
const ITEM_ID_TO_SPRITE: Record<string, ItemSpriteId> = {
  // Consumables - potions
  health_potion: 'potion_red',
  mana_vial: 'potion_teal',
  strength_tonic: 'potion_yellow',
  defense_elixir: 'potion_green',
  luck_potion: 'potion_purple',
  mega_potion: 'potion_pink',

  // Equipment - weapons
  training_sword: 'sword1',
  iron_sword: 'sword1',
  steel_blade: 'sword2',
  enchanted_blade: 'sword2',
  crystal_sword: 'sword2',
  pirate_cutlass: 'cutlass',
  mystic_wand: 'wand',
  arcane_staff: 'wand',
  ancient_wand: 'wand',

  // Equipment - accessories
  lucky_charm: 'amulet',
  power_amulet: 'amulet',
  guardian_amulet: 'amulet_green',
  crystal_pendant: 'crystal',
  ancient_amulet: 'amulet_green',

  // Special items
  catnip_leaf: 'leaf',
  golden_fish_trophy: 'golden_fish',
  ancient_tuna: 'tuna_can2',
  yarn_of_destiny: 'blue_yarn',
  laser_pointer_of_doom: 'laser_pointer',

  // Toys and misc
  yarn_ball: 'red_yarn',
  toy_mouse: 'mouse',
  fresh_fish: 'fish',
  tuna_snack: 'tuna_can',

  // Treasures
  treasure_chest: 'treasure_chest',
};

// Cache for loaded sprites
const spriteCache: Map<ItemSpriteId, ex.Sprite> = new Map();

/**
 * Get the file path for an item sprite
 */
export function getItemSpritePath(id: ItemSpriteId): string {
  return `${ITEMS_BASE}/${ITEM_FILES[id]}`;
}

/**
 * Load an item sprite by its sprite ID
 */
export async function loadItemSprite(id: ItemSpriteId): Promise<ex.Sprite | null> {
  if (spriteCache.has(id)) {
    return spriteCache.get(id)!;
  }

  try {
    const path = getItemSpritePath(id);
    const image = new ex.ImageSource(path);
    await image.load();
    const sprite = image.toSprite();
    spriteCache.set(id, sprite);
    return sprite;
  } catch (err) {
    console.warn(`[ItemSpriteLoader] Failed to load item sprite: ${id}`, err);
    return null;
  }
}

/**
 * Load an item sprite by game item ID
 */
export async function loadItemSpriteByItemId(itemId: string): Promise<ex.Sprite | null> {
  const spriteId = ITEM_ID_TO_SPRITE[itemId];
  if (!spriteId) {
    console.warn(`[ItemSpriteLoader] No sprite mapping for item: ${itemId}`);
    return null;
  }
  return loadItemSprite(spriteId);
}

/**
 * Get the sprite ID for a game item ID
 */
export function getItemSpriteId(itemId: string): ItemSpriteId | null {
  return ITEM_ID_TO_SPRITE[itemId] || null;
}

/**
 * Check if an item has a sprite available
 */
export function hasItemSprite(itemId: string): boolean {
  return itemId in ITEM_ID_TO_SPRITE;
}

/**
 * Create a scaled item icon actor
 */
export async function createItemIconActor(
  itemId: string,
  x: number,
  y: number,
  size = 32,
  z = 50
): Promise<ex.Actor> {
  const actor = new ex.Actor({
    pos: new ex.Vector(x, y),
    anchor: ex.Vector.Half,
    z,
  });

  const sprite = await loadItemSpriteByItemId(itemId);
  if (sprite) {
    // Scale to target size
    const scale = size / Math.max(sprite.width, sprite.height);
    sprite.scale = new ex.Vector(scale, scale);
    actor.graphics.use(sprite);
  } else {
    // Fallback to colored rectangle
    actor.graphics.use(new ex.Rectangle({
      width: size,
      height: size,
      color: ex.Color.fromHex('#808080'),
      strokeColor: ex.Color.Black,
      lineWidth: 1,
    }));
  }

  return actor;
}

/**
 * Preload all item sprites
 */
export async function preloadAllItemSprites(): Promise<void> {
  const loadPromises = Object.keys(ITEM_FILES).map((id) =>
    loadItemSprite(id as ItemSpriteId)
  );

  await Promise.all(loadPromises);
  console.log(`[ItemSpriteLoader] Preloaded ${spriteCache.size} item sprites`);
}

/**
 * Clear sprite cache
 */
export function clearItemSpriteCache(): void {
  spriteCache.clear();
}
