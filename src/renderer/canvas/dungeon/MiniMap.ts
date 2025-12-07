/**
 * MiniMap
 *
 * Renders a small map showing explored dungeon rooms.
 * Can be rendered to canvas or as a standalone DOM element.
 * Now uses Kenney Minimap Pack tiles.
 */

import { createLogger } from '../../../shared/logger.js';
import type { DungeonFloor, DungeonRoom, RoomType } from './DungeonGenerator.js';
import {
  MINIMAP_TILE_SIZE,
  MINIMAP_TILES,
  getMinimapTilesToPreload,
  getRoomTile,
} from './MiniMapLayout.js';
import { spriteRenderer } from '../../components/studyquest/StudyQuestSpriteRenderer.js';

const logger = createLogger('MiniMap');

// Colors for different room states
const ROOM_COLORS: Record<string, string> = {
  current: '#fbbf24',
  visited: '#4ade80',
  discovered: '#4a4a6a',
  start: '#60a5fa',
  boss: '#ef4444',
  exit: '#a855f7',
  treasure: '#fbbf24',
  rest: '#22c55e',
  merchant: '#60a5fa',
};

// Mini-map settings
const CELL_SIZE = 12;
const CELL_GAP = 4;
const CONNECTOR_WIDTH = 2;

export class MiniMap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private floor: DungeonFloor | null = null;
  private currentRoomId: string | null = null;
  private width: number = 150;
  private height: number = 100;

  // Tile rendering state
  private tilesLoaded: boolean = false;
  private useTileImages: boolean = true;
  private scale: number = 2; // Scale 8px tiles to 16px

  constructor(canvas?: HTMLCanvasElement) {
    if (canvas) {
      this.canvas = canvas;
    } else {
      this.canvas = document.createElement('canvas');
    }

    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.className = 'dungeon-minimap';

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    this.ctx = ctx;
    this.injectStyles();

    // Preload minimap tiles
    this.preloadTiles();
  }

  /**
   * Preload all minimap tile images
   */
  private async preloadTiles(): Promise<void> {
    try {
      const tiles = getMinimapTilesToPreload();
      await spriteRenderer.preloadTileSet(tiles);
      this.tilesLoaded = true;
      logger.info(`Loaded ${tiles.length} minimap tile images`);
    } catch (error) {
      logger.warn('Failed to load minimap tile images, using procedural fallback:', error);
      this.tilesLoaded = false;
    }
  }

  /**
   * Get the canvas element
   */
  getElement(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Set the dungeon floor to display
   */
  setFloor(floor: DungeonFloor): void {
    this.floor = floor;
    this.resize();
    this.render();
  }

  /**
   * Set the current room (highlighted)
   */
  setCurrentRoom(roomId: string): void {
    this.currentRoomId = roomId;
    this.render();
  }

  /**
   * Update and re-render
   */
  update(): void {
    this.render();
  }

  /**
   * Resize canvas based on floor dimensions
   */
  private resize(): void {
    if (!this.floor) return;

    const roomsArray = Array.from(this.floor.rooms.values());
    if (roomsArray.length === 0) return;

    // Calculate bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const room of roomsArray) {
      minX = Math.min(minX, room.gridX);
      maxX = Math.max(maxX, room.gridX);
      minY = Math.min(minY, room.gridY);
      maxY = Math.max(maxY, room.gridY);
    }

    const gridWidth = maxX - minX + 1;
    const gridHeight = maxY - minY + 1;

    // Use tile-based sizing if tiles are loaded
    const cellSize = this.useTileImages && this.tilesLoaded
      ? MINIMAP_TILE_SIZE * this.scale
      : CELL_SIZE;
    const cellGap = this.useTileImages && this.tilesLoaded
      ? MINIMAP_TILE_SIZE * this.scale / 2
      : CELL_GAP;

    this.width = gridWidth * (cellSize + cellGap) + cellGap * 2;
    this.height = gridHeight * (cellSize + cellGap) + cellGap * 2;

    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  /**
   * Render the mini-map
   */
  render(): void {
    if (!this.floor) {
      this.ctx.fillStyle = '#1a1a2e';
      this.ctx.fillRect(0, 0, this.width, this.height);
      return;
    }

    // Clear
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Border
    this.ctx.strokeStyle = '#4a4a6a';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(1, 1, this.width - 2, this.height - 2);

    // Calculate offset for centering
    const roomsArray = Array.from(this.floor.rooms.values());
    let minX = Infinity, minY = Infinity;
    for (const room of roomsArray) {
      minX = Math.min(minX, room.gridX);
      minY = Math.min(minY, room.gridY);
    }

    // Draw connections first (so rooms render on top)
    for (const room of this.floor.rooms.values()) {
      if (!room.discovered) continue;
      this.drawConnections(room, minX, minY);
    }

    // Draw rooms
    for (const room of this.floor.rooms.values()) {
      if (!room.discovered) continue;
      this.drawRoom(room, minX, minY);
    }

    // Draw legend
    this.drawLegend();
  }

  /**
   * Draw a single room
   */
  private drawRoom(room: DungeonRoom, offsetX: number, offsetY: number): void {
    const isCurrent = room.id === this.currentRoomId;

    // Use tile-based rendering if available
    if (this.useTileImages && this.tilesLoaded) {
      const tileSize = MINIMAP_TILE_SIZE * this.scale;
      const gap = tileSize / 2;
      const x = (room.gridX - offsetX) * (tileSize + gap) + gap;
      const y = (room.gridY - offsetY) * (tileSize + gap) + gap;

      // Get appropriate tile for this room
      const tilePath = getRoomTile(room.type, isCurrent, room.visited, room.discovered);
      const drawn = spriteRenderer.drawTileToCanvas(this.ctx, tilePath, x, y, this.scale);

      if (drawn) {
        // Add pulsing border for current room
        if (isCurrent) {
          const pulse = Math.sin(Date.now() / 200) * 0.5 + 0.5;
          this.ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(x - 1, y - 1, tileSize + 2, tileSize + 2);
        }
        return;
      }
    }

    // Fallback to procedural rendering
    const x = (room.gridX - offsetX) * (CELL_SIZE + CELL_GAP) + CELL_GAP;
    const y = (room.gridY - offsetY) * (CELL_SIZE + CELL_GAP) + CELL_GAP;

    // Determine color
    let color: string;

    if (isCurrent) {
      color = ROOM_COLORS.current;
    } else if (room.type === 'start') {
      color = ROOM_COLORS.start;
    } else if (room.type === 'boss') {
      color = ROOM_COLORS.boss;
    } else if (room.type === 'exit') {
      color = ROOM_COLORS.exit;
    } else if (room.visited) {
      color = ROOM_COLORS.visited;
    } else {
      color = ROOM_COLORS.discovered;
    }

    // Draw room
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

    // Special icons for room types (if visited)
    if (room.visited && !isCurrent) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '8px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const icons: Partial<Record<RoomType, string>> = {
        treasure: '◆',
        boss: '!',
        exit: '▼',
        rest: '+',
        merchant: '$',
      };

      if (icons[room.type]) {
        this.ctx.fillText(icons[room.type]!, x + CELL_SIZE / 2, y + CELL_SIZE / 2);
      }
    }

    // Current room pulsing border
    if (isCurrent) {
      const pulse = Math.sin(Date.now() / 200) * 0.5 + 0.5;
      this.ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x - 1, y - 1, CELL_SIZE + 2, CELL_SIZE + 2);
    }
  }

  /**
   * Draw connections between rooms
   */
  private drawConnections(room: DungeonRoom, offsetX: number, offsetY: number): void {
    // Use tile-based sizing if available
    const useTiles = this.useTileImages && this.tilesLoaded;
    const tileSize = useTiles ? MINIMAP_TILE_SIZE * this.scale : CELL_SIZE;
    const gap = useTiles ? tileSize / 2 : CELL_GAP;

    const x = (room.gridX - offsetX) * (tileSize + gap) + gap + tileSize / 2;
    const y = (room.gridY - offsetY) * (tileSize + gap) + gap + tileSize / 2;

    // Try to use connector tiles
    if (useTiles) {
      const connectorTile = room.visited ? MINIMAP_TILES.connectorHActive : MINIMAP_TILES.connectorH;
      const connectorTileV = room.visited ? MINIMAP_TILES.connectorVActive : MINIMAP_TILES.connectorV;

      // Only draw to south and east to avoid double-drawing
      if (room.connections.south && this.floor) {
        const southRoom = this.floor.rooms.get(room.connections.south);
        if (southRoom?.discovered) {
          spriteRenderer.drawTileToCanvas(
            this.ctx,
            connectorTileV,
            x - tileSize / 4,
            y + tileSize / 4,
            this.scale / 2
          );
        }
      }

      if (room.connections.east && this.floor) {
        const eastRoom = this.floor.rooms.get(room.connections.east);
        if (eastRoom?.discovered) {
          spriteRenderer.drawTileToCanvas(
            this.ctx,
            connectorTile,
            x + tileSize / 4,
            y - tileSize / 4,
            this.scale / 2
          );
        }
      }
    } else {
      // Fallback to line-based connectors
      this.ctx.strokeStyle = room.visited ? '#4ade80' : '#4a4a6a';
      this.ctx.lineWidth = CONNECTOR_WIDTH;

      // Only draw to south and east to avoid double-drawing
      if (room.connections.south && this.floor) {
        const southRoom = this.floor.rooms.get(room.connections.south);
        if (southRoom?.discovered) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, y + tileSize / 2);
          this.ctx.lineTo(x, y + tileSize / 2 + gap);
          this.ctx.stroke();
        }
      }

      if (room.connections.east && this.floor) {
        const eastRoom = this.floor.rooms.get(room.connections.east);
        if (eastRoom?.discovered) {
          this.ctx.beginPath();
          this.ctx.moveTo(x + tileSize / 2, y);
          this.ctx.lineTo(x + tileSize / 2 + gap, y);
          this.ctx.stroke();
        }
      }
    }
  }

  /**
   * Draw map legend
   */
  private drawLegend(): void {
    // Skip legend if map is too small
    if (this.width < 100 || this.height < 80) return;

    const legendY = this.height - 14;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, legendY - 4, this.width, 18);

    this.ctx.font = '8px "Courier New", monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';

    // Legend items
    const items = [
      { color: ROOM_COLORS.current, label: 'You' },
      { color: ROOM_COLORS.visited, label: 'Cleared' },
      { color: ROOM_COLORS.discovered, label: '?' },
    ];

    let x = 4;
    for (const item of items) {
      // Color square
      this.ctx.fillStyle = item.color;
      this.ctx.fillRect(x, legendY - 3, 6, 6);

      // Label
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(item.label, x + 8, legendY);

      x += this.ctx.measureText(item.label).width + 16;
    }
  }

  /**
   * Inject styles
   */
  private injectStyles(): void {
    if (document.getElementById('minimap-styles')) return;

    const style = document.createElement('style');
    style.id = 'minimap-styles';
    style.textContent = `
      .dungeon-minimap {
        position: absolute;
        top: 10px;
        right: 10px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      }

      .minimap-container {
        position: relative;
      }

      .minimap-toggle {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 24px;
        height: 24px;
        background: rgba(0, 0, 0, 0.6);
        border: 1px solid #4a4a6a;
        border-radius: 4px;
        color: #ffffff;
        font-size: 12px;
        cursor: pointer;
      }

      .minimap-toggle:hover {
        background: rgba(0, 0, 0, 0.8);
      }
    `;

    document.head.appendChild(style);
  }
}

/**
 * Create a mini-map container with toggle button
 */
export function createMiniMapContainer(): {
  container: HTMLElement;
  miniMap: MiniMap;
  toggle: HTMLButtonElement;
} {
  const container = document.createElement('div');
  container.className = 'minimap-container';

  const miniMap = new MiniMap();
  container.appendChild(miniMap.getElement());

  const toggle = document.createElement('button');
  toggle.className = 'minimap-toggle';
  toggle.textContent = 'M';
  toggle.title = 'Toggle map';

  let isVisible = true;
  toggle.addEventListener('click', () => {
    isVisible = !isVisible;
    miniMap.getElement().style.display = isVisible ? 'block' : 'none';
  });

  return { container, miniMap, toggle };
}
