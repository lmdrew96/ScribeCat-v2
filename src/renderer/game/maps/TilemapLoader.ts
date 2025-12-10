/**
 * TilemapLoader
 *
 * Loads and renders TMX tilemaps for KAPLAY.
 * Supports individual tile images (collection of images) tilesets.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';

// Asset base path for tiles
const TILES_BASE = '../../assets/Tiles';

// Tileset configuration
interface TilesetConfig {
  name: string;
  firstGid: number;
  folder: string;
  tileIdToFile: Map<number, string>; // Maps local tile ID to filename
}

// Parsed layer data
interface LayerData {
  name: string;
  width: number;
  height: number;
  data: number[];
}

// Parsed map data
interface MapData {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  tilesets: TilesetConfig[];
  layers: LayerData[];
}

// Tileset definitions based on TSX files (actual filenames from .tsx files)
const TILESET_CONFIGS: Record<string, { folder: string; tiles: Record<number, string> }> = {
  WaterGrassTiles: {
    folder: 'GrassWaterTiles',
    tiles: {
      0: 'flower_grass_center.png',
      1: 'grass_center.png',
      2: 'land_bottom_left_corner.png',
      3: 'land_bottom_right_corner.png',
      4: 'land_top_left_corner.png',
      5: 'land_top_right_corner.png',
      6: 'northern_watershed.png',
      7: 'river_land_top_left_corner.png',
      8: 'river_land_top_right_corner.png',
      9: 'river_land_top.png',
      10: 'river_left_and_up.png',
      11: 'river_right_and_down.png',
      12: 'river_right_and_up.png',
      13: 'river_up_and_right.png',
      14: 'river_up_down.png',
      15: 'southern_watershed.png',
      16: 'water_bottom_left.png',
      17: 'water_bottom_mid.png',
      18: 'water_bottom_right.png',
      19: 'water_mid_left.png',
      20: 'water_mid_right.png',
      21: 'water_mid.png',
      22: 'water_top right.png',
      23: 'water_top_left.png',
      24: 'water_top_mid.png',
      25: 'wild_grass_center.png',
    },
  },
  TinyTownTiles: {
    folder: 'Tiny Town',
    tiles: {
      0: 'left_stone_wall.png',
      1: 'top_right_stone_roof.png',
      2: 'arrow.png',
      3: 'battleaxe.png',
      4: 'bee_hive.png',
      5: 'bomb.png',
      6: 'bottom_fence.png',
      7: 'bottom_left_castle_roof.png',
      8: 'bottom_left_corner_fence.png',
      9: 'bottom_left_dirt.png',
      10: 'bottom_left_grass_patch.png',
      11: 'bottom_left_stone_roof.png',
      12: 'bottom_left_wood_roof.png',
      13: 'bottom_mid_castle_roof.png',
      14: 'bottom_mid_dirt.png',
      15: 'bottom_mid_stone_roof.png',
      16: 'bottom_mid_wood_roof.png',
      17: 'bottom_right_castle_roof.png',
      18: 'bottom_right_corner_fence.png',
      19: 'bottom_right_dirt.png',
      20: 'bottom_right_grass_patch.png',
      21: 'bottom_right_stone_roof.png',
      22: 'bottom_right_wood_roof.png',
      23: 'bow.png',
      24: 'castle_bricks.png',
      25: 'castle_ladder.png',
      26: 'castle_spire.png',
      27: 'castle_window.png',
      28: 'coin.png',
      29: 'empty_bucket.png',
      30: 'fences_join.png',
      31: 'full_bucket.png',
      32: 'green_tree_bottom.png',
      33: 'green_tree_top.png',
      34: 'key.png',
      35: 'left_castle_deck.png',
      36: 'left_castle_door_frame.png',
      37: 'left_rail.png',
      38: 'left_stone_door.png',
      39: 'left_wood_door.png',
      40: 'left_wood_wall.png',
      41: 'lil_green_tree.png',
      42: 'lil_sprout.png',
      43: 'lil_yellow_tree.png',
      44: 'log.png',
      45: 'mid_castle_deck.png',
      46: 'mid_castle_roof.png',
      47: 'mid_dirt.png',
      48: 'mid_fence.png',
      49: 'mid_left_castle_roof.png',
      50: 'mid_left_dirt.png',
      51: 'mid_left_fence.png',
      52: 'mid_rail.png',
      53: 'mid_right_castle_roof.png',
      54: 'mid_right_dirt.png',
      55: 'mid_right_fence.png',
      56: 'mid_stone_wall.png',
      57: 'mid_vertical_fence.png',
      58: 'mid_wood_wall.png',
      59: 'mushrooms.png',
      60: 'pickaxe.png',
      61: 'pitchfork.png',
      62: 'pot.png',
      63: 'right_castle_deck.png',
      64: 'right_castle_door_frame.png',
      65: 'right_rail.png',
      66: 'right_stone_door.png',
      67: 'right_stone_wall.png',
      68: 'right_wood_door.png',
      69: 'right_wood_wall.png',
      70: 'shovel.png',
      71: 'shrub.png',
      72: 'sickle.png',
      73: 'sign.png',
      74: 'stone_door.png',
      75: 'stone_doorway.png',
      76: 'stone_path.png',
      77: 'stone_roof_chimney.png',
      78: 'stone_roof_point.png',
      79: 'stone_window.png',
      80: 'target.png',
      81: 'top_fence.png',
      82: 'top_left_castle_gate_open.png',
      83: 'top_left_castle_gate.png',
      84: 'top_left_castle_roof.png',
      85: 'top_left_corner_fence.png',
      86: 'top_left_dirt.png',
      87: 'top_left_grass_patch.png',
      88: 'top_left_stone_roof.png',
      89: 'top_left_wood_roof.png',
      90: 'top_mid_castle_roof.png',
      91: 'top_mid_dirt.png',
      92: 'top_mid_stone_roof.png',
      93: 'top_mid_wood_roof.png',
      94: 'top_right_castle_gate_open.png',
      95: 'top_right_castle_gate.png',
      96: 'top_right_castle_roof.png',
      97: 'top_right_dirt.png',
      98: 'top_right_fence.png',
      99: 'top_right_grass_patch.png',
      100: 'top_right_wood_roof.png',
      101: 'tree_cluster_bottom_left_yellow.png',
      102: 'tree_cluster_bottom_left.png',
      103: 'tree_cluster_bottom_right_yellow.png',
      104: 'tree_cluster_bottom_right.png',
      105: 'tree_cluster_top_left_yellow.png',
      106: 'tree_cluster_top_left.png',
      107: 'tree_cluster_top_right_yellow.png',
      108: 'tree_cluster_top_right.png',
      109: 'tree_group_bottom_mid_yellow.png',
      110: 'tree_group_bottom_mid.png',
      111: 'tree_group_mid_left_yellow.png',
      112: 'tree_group_mid_left.png',
      113: 'tree_group_mid_right_yellow.png',
      114: 'tree_group_mid_right.png',
      115: 'tree_group_mid_yellow.png',
      116: 'tree_group_mid.png',
      117: 'tree_group_top_mid_yellow.png',
      118: 'tree_group_top_mid.png',
      119: 'wagon.png',
      120: 'well_base.png',
      121: 'well_roof.png',
      122: 'wood_door.png',
      123: 'wood_doorway.png',
      124: 'wood_roof_chimney.png',
      125: 'wood_roof_point.png',
      126: 'wood_window.png',
      127: 'yellow_tree_bottom.png',
      128: 'yellow_tree_top.png',
    },
  },
};

/**
 * Parse TMX CSV data into array of tile IDs
 */
function parseCSVData(csvString: string): number[] {
  return csvString
    .trim()
    .split(/[\n,]/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

/**
 * Parse TMX XML string into MapData
 */
export function parseTMX(tmxContent: string): MapData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(tmxContent, 'text/xml');
  const mapEl = doc.querySelector('map');

  if (!mapEl) throw new Error('Invalid TMX: no map element');

  const width = parseInt(mapEl.getAttribute('width') || '0', 10);
  const height = parseInt(mapEl.getAttribute('height') || '0', 10);
  const tileWidth = parseInt(mapEl.getAttribute('tilewidth') || '16', 10);
  const tileHeight = parseInt(mapEl.getAttribute('tileheight') || '16', 10);

  // Parse tilesets
  const tilesets: TilesetConfig[] = [];
  doc.querySelectorAll('tileset').forEach((tilesetEl) => {
    const firstGid = parseInt(tilesetEl.getAttribute('firstgid') || '1', 10);
    const source = tilesetEl.getAttribute('source') || '';

    // Extract tileset name from source path
    let tilesetName = '';
    if (source.includes('WaterGrassTiles')) {
      tilesetName = 'WaterGrassTiles';
    } else if (source.includes('TinyTownTiles') || source.includes('Tiny Town')) {
      tilesetName = 'TinyTownTiles';
    }

    if (tilesetName && TILESET_CONFIGS[tilesetName]) {
      const config = TILESET_CONFIGS[tilesetName];
      const tileIdToFile = new Map<number, string>();
      Object.entries(config.tiles).forEach(([id, file]) => {
        tileIdToFile.set(parseInt(id, 10), file);
      });

      tilesets.push({
        name: tilesetName,
        firstGid,
        folder: config.folder,
        tileIdToFile,
      });
    }
  });

  // Sort tilesets by firstGid descending for lookup
  tilesets.sort((a, b) => b.firstGid - a.firstGid);

  // Parse layers
  const layers: LayerData[] = [];
  doc.querySelectorAll('layer').forEach((layerEl) => {
    const name = layerEl.getAttribute('name') || 'unnamed';
    const layerWidth = parseInt(layerEl.getAttribute('width') || String(width), 10);
    const layerHeight = parseInt(layerEl.getAttribute('height') || String(height), 10);
    const dataEl = layerEl.querySelector('data');

    if (dataEl && dataEl.getAttribute('encoding') === 'csv') {
      const data = parseCSVData(dataEl.textContent || '');
      layers.push({ name, width: layerWidth, height: layerHeight, data });
    }
  });

  return { width, height, tileWidth, tileHeight, tilesets, layers };
}

/**
 * Get tileset and local tile ID for a global tile ID
 */
function getTileInfo(
  gid: number,
  tilesets: TilesetConfig[]
): { tileset: TilesetConfig; localId: number } | null {
  if (gid === 0) return null; // Empty tile

  for (const tileset of tilesets) {
    if (gid >= tileset.firstGid) {
      return {
        tileset,
        localId: gid - tileset.firstGid,
      };
    }
  }
  return null;
}

/**
 * Load all tile sprites needed for the map
 */
export async function loadMapTiles(k: KAPLAYCtx, mapData: MapData): Promise<Set<string>> {
  const loadedSprites = new Set<string>();
  const tilesToLoad = new Set<string>();

  // Collect all unique tiles used in the map
  for (const layer of mapData.layers) {
    for (const gid of layer.data) {
      const tileInfo = getTileInfo(gid, mapData.tilesets);
      if (tileInfo) {
        const { tileset, localId } = tileInfo;
        const filename = tileset.tileIdToFile.get(localId);
        if (filename) {
          const spriteName = `tile_${tileset.name}_${localId}`;
          const spritePath = `${TILES_BASE}/${tileset.folder}/${filename}`;
          tilesToLoad.add(`${spriteName}|${spritePath}`);
        }
      }
    }
  }

  // Load all tiles
  for (const entry of tilesToLoad) {
    const [spriteName, spritePath] = entry.split('|');
    try {
      // Check if already loaded
      if (!loadedSprites.has(spriteName)) {
        await k.loadSprite(spriteName, spritePath);
        loadedSprites.add(spriteName);
      }
    } catch (err) {
      console.warn(`Failed to load tile: ${spritePath}`, err);
    }
  }

  console.log(`Loaded ${loadedSprites.size} tile sprites`);
  return loadedSprites;
}

/**
 * Render a tilemap layer
 */
export function renderMapLayer(
  k: KAPLAYCtx,
  mapData: MapData,
  layerName: string,
  options: {
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    zIndex?: number;
  } = {}
): GameObj[] {
  const { scale = 1, offsetX = 0, offsetY = 0, zIndex = 0 } = options;

  const layer = mapData.layers.find((l) => l.name === layerName);
  if (!layer) {
    console.warn(`Layer "${layerName}" not found`);
    return [];
  }

  const tiles: GameObj[] = [];
  const scaledTileWidth = mapData.tileWidth * scale;
  const scaledTileHeight = mapData.tileHeight * scale;

  for (let y = 0; y < layer.height; y++) {
    for (let x = 0; x < layer.width; x++) {
      const index = y * layer.width + x;
      const gid = layer.data[index];

      if (gid === 0) continue; // Skip empty tiles

      const tileInfo = getTileInfo(gid, mapData.tilesets);
      if (!tileInfo) continue;

      const { tileset, localId } = tileInfo;
      const spriteName = `tile_${tileset.name}_${localId}`;

      try {
        const tile = k.add([
          k.sprite(spriteName),
          k.pos(offsetX + x * scaledTileWidth, offsetY + y * scaledTileHeight),
          k.scale(scale),
          k.z(zIndex),
        ]);
        tiles.push(tile);
      } catch {
        // Sprite not loaded, skip
      }
    }
  }

  return tiles;
}

/**
 * Render all layers of a tilemap
 */
export function renderAllLayers(
  k: KAPLAYCtx,
  mapData: MapData,
  options: {
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    baseZIndex?: number;
  } = {}
): Map<string, GameObj[]> {
  const { scale = 1, offsetX = 0, offsetY = 0, baseZIndex = 0 } = options;

  const layerMap = new Map<string, GameObj[]>();

  mapData.layers.forEach((layer, index) => {
    const tiles = renderMapLayer(k, mapData, layer.name, {
      scale,
      offsetX,
      offsetY,
      zIndex: baseZIndex + index,
    });
    layerMap.set(layer.name, tiles);
  });

  return layerMap;
}

/**
 * Load TMX from file path (for use in Electron)
 */
export async function loadTMXFromPath(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load TMX: ${response.statusText}`);
  }
  return response.text();
}
