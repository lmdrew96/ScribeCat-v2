/**
 * DungeonLayout
 *
 * Defines tile mappings for dungeon rendering using Kenney Tiny Dungeon assets.
 * Maps content types, room elements, and decorations to specific tile images.
 */

// Base path for Kenney dungeon tiles
const DUNGEON_TILE_BASE = '../../assets/sprites/studyquest/kenney/dungeon/';

// Tile size in pixels (before scaling)
export const DUNGEON_TILE_SIZE = 16;

// ============================================================================
// Floor and Wall Tiles
// ============================================================================

export const FLOOR_TILES = {
  // Main floor tiles (Row 0 - brown floor tiles)
  stone: `${DUNGEON_TILE_BASE}tile_0000.png`,      // Brown floor center
  stoneCracked: `${DUNGEON_TILE_BASE}tile_0001.png`, // Floor variation
  stoneAlt: `${DUNGEON_TILE_BASE}tile_0002.png`,   // Floor variation
  stoneDark: `${DUNGEON_TILE_BASE}tile_0003.png`,  // Floor variation

  // Floor decorations (Row 1)
  floorRug: `${DUNGEON_TILE_BASE}tile_0012.png`,
  floorMoss: `${DUNGEON_TILE_BASE}tile_0013.png`,
};

export const WALL_TILES = {
  // Solid walls (Row 2 - gray stone blocks)
  solid: `${DUNGEON_TILE_BASE}tile_0024.png`,      // Gray stone solid
  solidAlt: `${DUNGEON_TILE_BASE}tile_0025.png`,   // Stone variation
  brick: `${DUNGEON_TILE_BASE}tile_0026.png`,      // Brick pattern
  brickAlt: `${DUNGEON_TILE_BASE}tile_0027.png`,   // Brick variation

  // Wall with details
  wallTorch: `${DUNGEON_TILE_BASE}tile_0028.png`,
  wallBanner: `${DUNGEON_TILE_BASE}tile_0029.png`,
  wallWindow: `${DUNGEON_TILE_BASE}tile_0030.png`,
  wallCracked: `${DUNGEON_TILE_BASE}tile_0031.png`,

  // Corner pieces (from row 0 - floor has corners for edges)
  cornerTL: `${DUNGEON_TILE_BASE}tile_0004.png`,
  cornerTR: `${DUNGEON_TILE_BASE}tile_0005.png`,
  cornerBL: `${DUNGEON_TILE_BASE}tile_0006.png`,
  cornerBR: `${DUNGEON_TILE_BASE}tile_0007.png`,

  // Edge pieces (from row 0/1)
  edgeTop: `${DUNGEON_TILE_BASE}tile_0008.png`,
  edgeBottom: `${DUNGEON_TILE_BASE}tile_0009.png`,
  edgeLeft: `${DUNGEON_TILE_BASE}tile_0010.png`,
  edgeRight: `${DUNGEON_TILE_BASE}tile_0011.png`,
};

// ============================================================================
// Door Tiles
// ============================================================================

export const DOOR_TILES = {
  // Wooden doors
  woodClosed: `${DUNGEON_TILE_BASE}tile_0036.png`,
  woodOpen: `${DUNGEON_TILE_BASE}tile_0037.png`,
  woodFrame: `${DUNGEON_TILE_BASE}tile_0038.png`,

  // Barred/metal doors
  barsClosed: `${DUNGEON_TILE_BASE}tile_0039.png`,
  barsOpen: `${DUNGEON_TILE_BASE}tile_0040.png`,

  // Special doors
  locked: `${DUNGEON_TILE_BASE}tile_0041.png`,
  bossGate: `${DUNGEON_TILE_BASE}tile_0042.png`,
};

// ============================================================================
// Character Tiles (for enemies and NPCs)
// Row 6 (72-83): Heroes/NPCs, Row 7 (84-95): Enemies
// ============================================================================

export const CHARACTER_TILES = {
  // Heroes/NPCs (Row 6: tiles 72-83)
  knight: `${DUNGEON_TILE_BASE}tile_0072.png`,
  warrior: `${DUNGEON_TILE_BASE}tile_0073.png`,
  wizard: `${DUNGEON_TILE_BASE}tile_0074.png`,
  rogue: `${DUNGEON_TILE_BASE}tile_0075.png`,
  merchant: `${DUNGEON_TILE_BASE}tile_0076.png`,
  sage: `${DUNGEON_TILE_BASE}tile_0077.png`,
  villager: `${DUNGEON_TILE_BASE}tile_0078.png`,

  // Enemies (Row 7: tiles 84-95)
  skeleton: `${DUNGEON_TILE_BASE}tile_0084.png`,
  zombie: `${DUNGEON_TILE_BASE}tile_0085.png`,
  ghost: `${DUNGEON_TILE_BASE}tile_0086.png`,
  mummy: `${DUNGEON_TILE_BASE}tile_0087.png`,
  slime: `${DUNGEON_TILE_BASE}tile_0088.png`,
  bat: `${DUNGEON_TILE_BASE}tile_0089.png`,
  spider: `${DUNGEON_TILE_BASE}tile_0090.png`,
  rat: `${DUNGEON_TILE_BASE}tile_0091.png`,
  demon: `${DUNGEON_TILE_BASE}tile_0092.png`,
  imp: `${DUNGEON_TILE_BASE}tile_0093.png`,
  boss: `${DUNGEON_TILE_BASE}tile_0094.png`,
  dragon: `${DUNGEON_TILE_BASE}tile_0095.png`,
};

// ============================================================================
// Content/Prop Tiles
// Row 4 (48-59): Furniture, Row 5 (60-71): Containers/Props
// ============================================================================

export const PROP_TILES = {
  // Furniture (Row 4: tiles 48-59)
  table: `${DUNGEON_TILE_BASE}tile_0048.png`,
  chair: `${DUNGEON_TILE_BASE}tile_0049.png`,
  bed: `${DUNGEON_TILE_BASE}tile_0050.png`,
  bookshelf: `${DUNGEON_TILE_BASE}tile_0051.png`,
  throne: `${DUNGEON_TILE_BASE}tile_0052.png`,
  cabinet: `${DUNGEON_TILE_BASE}tile_0053.png`,

  // Containers (Row 5: tiles 60-71)
  barrel: `${DUNGEON_TILE_BASE}tile_0060.png`,
  crate: `${DUNGEON_TILE_BASE}tile_0061.png`,
  pot: `${DUNGEON_TILE_BASE}tile_0062.png`,
  bag: `${DUNGEON_TILE_BASE}tile_0063.png`,
  chestClosed: `${DUNGEON_TILE_BASE}tile_0064.png`,
  chestOpen: `${DUNGEON_TILE_BASE}tile_0065.png`,
  chestMimic: `${DUNGEON_TILE_BASE}tile_0066.png`,

  // Traps and special objects
  spikes: `${DUNGEON_TILE_BASE}tile_0067.png`,
  spikesTriggered: `${DUNGEON_TILE_BASE}tile_0068.png`,
  pit: `${DUNGEON_TILE_BASE}tile_0054.png`,
  pressurePlate: `${DUNGEON_TILE_BASE}tile_0055.png`,

  // Rest/Special
  campfire: `${DUNGEON_TILE_BASE}tile_0069.png`,
  fountain: `${DUNGEON_TILE_BASE}tile_0070.png`,
  altar: `${DUNGEON_TILE_BASE}tile_0056.png`,
  crystal: `${DUNGEON_TILE_BASE}tile_0057.png`,

  // Stairs/Exit
  stairsUp: `${DUNGEON_TILE_BASE}tile_0058.png`,
  stairsDown: `${DUNGEON_TILE_BASE}tile_0059.png`,
  portal: `${DUNGEON_TILE_BASE}tile_0071.png`,
  ladder: `${DUNGEON_TILE_BASE}tile_0047.png`,
};

// ============================================================================
// Item Tiles (for icons/pickups)
// Row 8 (96-107): Weapons/Armor, Row 9 (108-119): Consumables/Treasures
// ============================================================================

export const ITEM_TILES = {
  // Weapons (Row 8: tiles 96-107)
  sword: `${DUNGEON_TILE_BASE}tile_0096.png`,
  axe: `${DUNGEON_TILE_BASE}tile_0097.png`,
  bow: `${DUNGEON_TILE_BASE}tile_0098.png`,
  staff: `${DUNGEON_TILE_BASE}tile_0099.png`,
  dagger: `${DUNGEON_TILE_BASE}tile_0100.png`,

  // Armor (Row 8 continued)
  shield: `${DUNGEON_TILE_BASE}tile_0101.png`,
  helmet: `${DUNGEON_TILE_BASE}tile_0102.png`,
  armor: `${DUNGEON_TILE_BASE}tile_0103.png`,
  boots: `${DUNGEON_TILE_BASE}tile_0104.png`,

  // Consumables (Row 9: tiles 108-119)
  potionRed: `${DUNGEON_TILE_BASE}tile_0108.png`,
  potionBlue: `${DUNGEON_TILE_BASE}tile_0109.png`,
  potionGreen: `${DUNGEON_TILE_BASE}tile_0110.png`,
  scroll: `${DUNGEON_TILE_BASE}tile_0111.png`,

  // Keys and treasures (Row 9 continued)
  keyGold: `${DUNGEON_TILE_BASE}tile_0112.png`,
  keySilver: `${DUNGEON_TILE_BASE}tile_0113.png`,
  coin: `${DUNGEON_TILE_BASE}tile_0114.png`,
  gem: `${DUNGEON_TILE_BASE}tile_0115.png`,
  crown: `${DUNGEON_TILE_BASE}tile_0116.png`,

  // Accessories (Row 9 continued)
  ring: `${DUNGEON_TILE_BASE}tile_0117.png`,
  amulet: `${DUNGEON_TILE_BASE}tile_0118.png`,
};

// ============================================================================
// Decoration Tiles
// Row 10 (120-131): Wall and floor decorations
// ============================================================================

export const DECORATION_TILES = {
  // Wall decorations (Row 10: tiles 120-131)
  torch: `${DUNGEON_TILE_BASE}tile_0120.png`,
  banner: `${DUNGEON_TILE_BASE}tile_0121.png`,
  painting: `${DUNGEON_TILE_BASE}tile_0122.png`,
  chains: `${DUNGEON_TILE_BASE}tile_0123.png`,

  // Floor decorations
  skull: `${DUNGEON_TILE_BASE}tile_0124.png`,
  bones: `${DUNGEON_TILE_BASE}tile_0125.png`,
  cobweb: `${DUNGEON_TILE_BASE}tile_0126.png`,
  rubble: `${DUNGEON_TILE_BASE}tile_0127.png`,

  // Environment
  puddle: `${DUNGEON_TILE_BASE}tile_0128.png`,
  grass: `${DUNGEON_TILE_BASE}tile_0129.png`,
  mushroom: `${DUNGEON_TILE_BASE}tile_0130.png`,
  vines: `${DUNGEON_TILE_BASE}tile_0131.png`,
};

// ============================================================================
// Enemy Type Mapping
// ============================================================================

export const ENEMY_TYPE_TO_TILE: Record<string, string> = {
  // Standard enemies
  target_dummy: CHARACTER_TILES.skeleton,
  training_slime: CHARACTER_TILES.slime,
  wolf: CHARACTER_TILES.rat,
  slime: CHARACTER_TILES.slime,
  bat: CHARACTER_TILES.bat,
  ice_slime: CHARACTER_TILES.slime,
  crystal_golem: CHARACTER_TILES.demon,
  ghost: CHARACTER_TILES.ghost,
  skeleton: CHARACTER_TILES.skeleton,
  cursed_book: CHARACTER_TILES.ghost,
  fire_slime: CHARACTER_TILES.slime,
  salamander: CHARACTER_TILES.demon,
  fire_elemental: CHARACTER_TILES.demon,
  void_walker: CHARACTER_TILES.zombie,
  shadow: CHARACTER_TILES.ghost,
  void_elemental: CHARACTER_TILES.demon,

  // Boss fallback
  boss: CHARACTER_TILES.boss,
};

// ============================================================================
// Content Type to Tile Mapping
// ============================================================================

import type { ContentType } from './DungeonGenerator.js';

export function getContentTile(
  contentType: ContentType,
  triggered: boolean,
  data?: { enemyType?: string; interactType?: string; isBoss?: boolean }
): string {
  switch (contentType) {
    case 'enemy':
      if (data?.isBoss) {
        return CHARACTER_TILES.boss;
      }
      const enemyType = data?.enemyType || 'skeleton';
      return ENEMY_TYPE_TO_TILE[enemyType] || CHARACTER_TILES.skeleton;

    case 'chest':
      return triggered ? PROP_TILES.chestOpen : PROP_TILES.chestClosed;

    case 'trap':
      return triggered ? PROP_TILES.spikesTriggered : PROP_TILES.spikes;

    case 'npc':
      return CHARACTER_TILES.merchant;

    case 'interactable':
      if (data?.interactType === 'campfire') {
        return PROP_TILES.campfire;
      }
      return PROP_TILES.fountain;

    case 'exit':
      return PROP_TILES.stairsDown;

    default:
      return PROP_TILES.barrel;
  }
}

// ============================================================================
// Preload Helper
// ============================================================================

/**
 * Get all dungeon tiles to preload for efficient rendering
 */
export function getDungeonTilesToPreload(): string[] {
  const tiles: string[] = [];

  // Add floor tiles
  Object.values(FLOOR_TILES).forEach(path => tiles.push(path));

  // Add wall tiles
  Object.values(WALL_TILES).forEach(path => tiles.push(path));

  // Add door tiles
  Object.values(DOOR_TILES).forEach(path => tiles.push(path));

  // Add character tiles
  Object.values(CHARACTER_TILES).forEach(path => tiles.push(path));

  // Add prop tiles
  Object.values(PROP_TILES).forEach(path => tiles.push(path));

  // Add item tiles
  Object.values(ITEM_TILES).forEach(path => tiles.push(path));

  // Add decoration tiles
  Object.values(DECORATION_TILES).forEach(path => tiles.push(path));

  // Remove duplicates
  return [...new Set(tiles)];
}
