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

// Tileset definitions based on TSX files
const TILESET_CONFIGS: Record<string, { folder: string; tiles: Record<number, string> }> = {
  WaterGrassTiles: {
    folder: 'GrassWaterTiles',
    tiles: {
      0: 'tile_0000.png', 1: 'tile_0001.png', 2: 'tile_0002.png', 3: 'tile_0003.png',
      4: 'tile_0004.png', 5: 'tile_0018.png', 6: 'tile_0019.png', 7: 'tile_0020.png',
      8: 'tile_0021.png', 9: 'tile_0022.png', 10: 'tile_0036.png', 11: 'tile_0037.png',
      12: 'tile_0038.png', 13: 'tile_0039.png', 14: 'tile_0054.png', 15: 'tile_0055.png',
      16: 'tile_0056.png', 17: 'tile_0057.png', 18: 'tile_0072.png', 19: 'tile_0073.png',
      20: 'tile_0074.png', 21: 'tile_0075.png', 22: 'tile_0090.png', 23: 'tile_0091.png',
      24: 'tile_0092.png', 25: 'tile_0093.png', 26: 'tile_0148.png',
    },
  },
  TinyTownTiles: {
    folder: 'Tiny Town',
    tiles: Object.fromEntries(
      Array.from({ length: 132 }, (_, i) => [i, `tile_${i.toString().padStart(4, '0')}.png`])
    ),
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
