/**
 * MiniMap System for KAPLAY
 *
 * Renders a small map showing explored dungeon rooms.
 * Designed to be drawn as a UI overlay in the dungeon scene.
 * Ported from canvas/dungeon/MiniMap.ts
 */

import type { KAPLAYCtx } from 'kaplay';
import type { DungeonFloor, DungeonRoom, RoomType } from '../../canvas/dungeon/DungeonGenerator.js';

// Colors for different room states
const ROOM_COLORS = {
  current: { r: 251, g: 191, b: 36 },   // #fbbf24
  visited: { r: 74, g: 222, b: 128 },   // #4ade80
  discovered: { r: 74, g: 74, b: 106 }, // #4a4a6a
  start: { r: 96, g: 165, b: 250 },     // #60a5fa
  boss: { r: 239, g: 68, b: 68 },       // #ef4444
  exit: { r: 168, g: 85, b: 247 },      // #a855f7
  treasure: { r: 251, g: 191, b: 36 },  // #fbbf24
  rest: { r: 34, g: 197, b: 94 },       // #22c55e
  merchant: { r: 96, g: 165, b: 250 },  // #60a5fa
};

// Mini-map settings
const CELL_SIZE = 12;
const CELL_GAP = 4;
const CONNECTOR_WIDTH = 2;
const PADDING = 10;

export interface MiniMapConfig {
  x: number;
  y: number;
  showLegend?: boolean;
}

/**
 * Draw the minimap as a UI overlay
 */
export function drawMiniMap(
  k: KAPLAYCtx,
  floor: DungeonFloor,
  currentRoomId: string,
  config: MiniMapConfig
): void {
  const { x, y, showLegend = true } = config;

  // Get room bounds
  const roomsArray = Array.from(floor.rooms.values());
  if (roomsArray.length === 0) return;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const room of roomsArray) {
    if (!room.discovered) continue;
    minX = Math.min(minX, room.gridX);
    maxX = Math.max(maxX, room.gridX);
    minY = Math.min(minY, room.gridY);
    maxY = Math.max(maxY, room.gridY);
  }

  if (minX === Infinity) return; // No discovered rooms

  const gridWidth = maxX - minX + 1;
  const gridHeight = maxY - minY + 1;

  const mapWidth = gridWidth * (CELL_SIZE + CELL_GAP) + CELL_GAP * 2 + PADDING * 2;
  const mapHeight = gridHeight * (CELL_SIZE + CELL_GAP) + CELL_GAP * 2 + PADDING * 2 + (showLegend ? 18 : 0);

  // Background
  k.drawRect({
    pos: k.vec2(x, y),
    width: mapWidth,
    height: mapHeight,
    color: k.rgb(0, 0, 0),
    opacity: 0.7,
    radius: 4,
    fixed: true,
  });

  // Border
  k.drawRect({
    pos: k.vec2(x + 1, y + 1),
    width: mapWidth - 2,
    height: mapHeight - 2,
    fill: false,
    outline: { color: k.rgb(74, 74, 106), width: 2 },
    radius: 4,
    fixed: true,
  });

  // Draw connections first
  for (const room of floor.rooms.values()) {
    if (!room.discovered) continue;
    drawConnections(k, room, floor, x + PADDING + CELL_GAP, y + PADDING + CELL_GAP, minX, minY);
  }

  // Draw rooms
  for (const room of floor.rooms.values()) {
    if (!room.discovered) continue;
    drawRoom(k, room, currentRoomId, x + PADDING + CELL_GAP, y + PADDING + CELL_GAP, minX, minY);
  }

  // Draw legend
  if (showLegend) {
    drawLegend(k, x, y + mapHeight - 16, mapWidth);
  }
}

function drawRoom(
  k: KAPLAYCtx,
  room: DungeonRoom,
  currentRoomId: string,
  baseX: number,
  baseY: number,
  offsetX: number,
  offsetY: number
): void {
  const isCurrent = room.id === currentRoomId;
  const rx = baseX + (room.gridX - offsetX) * (CELL_SIZE + CELL_GAP);
  const ry = baseY + (room.gridY - offsetY) * (CELL_SIZE + CELL_GAP);

  // Determine color
  let color: { r: number; g: number; b: number };

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

  // Draw room cell
  k.drawRect({
    pos: k.vec2(rx, ry),
    width: CELL_SIZE,
    height: CELL_SIZE,
    color: k.rgb(color.r, color.g, color.b),
    fixed: true,
  });

  // Special icons for room types (if visited and not current)
  if (room.visited && !isCurrent) {
    const icons: Partial<Record<RoomType, string>> = {
      treasure: '*',
      boss: '!',
      exit: 'v',
      rest: '+',
      merchant: '$',
    };

    if (icons[room.type]) {
      k.drawText({
        text: icons[room.type]!,
        pos: k.vec2(rx + CELL_SIZE / 2, ry + CELL_SIZE / 2),
        size: 8,
        anchor: 'center',
        color: k.rgb(255, 255, 255),
        fixed: true,
      });
    }
  }

  // Current room pulsing border
  if (isCurrent) {
    const pulse = Math.sin(k.time() * 5) * 0.5 + 0.5;
    k.drawRect({
      pos: k.vec2(rx - 1, ry - 1),
      width: CELL_SIZE + 2,
      height: CELL_SIZE + 2,
      fill: false,
      outline: { color: k.rgb(255, 255, 255), width: 2 },
      opacity: pulse,
      fixed: true,
    });
  }
}

function drawConnections(
  k: KAPLAYCtx,
  room: DungeonRoom,
  floor: DungeonFloor,
  baseX: number,
  baseY: number,
  offsetX: number,
  offsetY: number
): void {
  const rx = baseX + (room.gridX - offsetX) * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
  const ry = baseY + (room.gridY - offsetY) * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;

  const connectorColor = room.visited ? k.rgb(74, 222, 128) : k.rgb(74, 74, 106);

  // Only draw south and east to avoid double-drawing
  if (room.connections.south) {
    const southRoom = floor.rooms.get(room.connections.south);
    if (southRoom?.discovered) {
      k.drawRect({
        pos: k.vec2(rx - CONNECTOR_WIDTH / 2, ry + CELL_SIZE / 2),
        width: CONNECTOR_WIDTH,
        height: CELL_GAP,
        color: connectorColor,
        fixed: true,
      });
    }
  }

  if (room.connections.east) {
    const eastRoom = floor.rooms.get(room.connections.east);
    if (eastRoom?.discovered) {
      k.drawRect({
        pos: k.vec2(rx + CELL_SIZE / 2, ry - CONNECTOR_WIDTH / 2),
        width: CELL_GAP,
        height: CONNECTOR_WIDTH,
        color: connectorColor,
        fixed: true,
      });
    }
  }
}

function drawLegend(k: KAPLAYCtx, x: number, y: number, width: number): void {
  // Legend background
  k.drawRect({
    pos: k.vec2(x, y),
    width: width,
    height: 16,
    color: k.rgb(0, 0, 0),
    opacity: 0.5,
    fixed: true,
  });

  const items = [
    { color: ROOM_COLORS.current, label: 'You' },
    { color: ROOM_COLORS.visited, label: 'Clear' },
    { color: ROOM_COLORS.discovered, label: '?' },
  ];

  let lx = x + 4;
  for (const item of items) {
    // Color square
    k.drawRect({
      pos: k.vec2(lx, y + 5),
      width: 6,
      height: 6,
      color: k.rgb(item.color.r, item.color.g, item.color.b),
      fixed: true,
    });

    // Label
    k.drawText({
      text: item.label,
      pos: k.vec2(lx + 8, y + 8),
      size: 8,
      color: k.rgb(255, 255, 255),
      fixed: true,
    });

    lx += 40;
  }
}

/**
 * Create a minimap component that can be added to a scene
 */
export function createMiniMapComponent(k: KAPLAYCtx) {
  return {
    floor: null as DungeonFloor | null,
    currentRoomId: '' as string,
    x: 10,
    y: 10,
    visible: true,

    setFloor(floor: DungeonFloor) {
      this.floor = floor;
    },

    setCurrentRoom(roomId: string) {
      this.currentRoomId = roomId;
    },

    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
    },

    toggle() {
      this.visible = !this.visible;
    },

    draw() {
      if (!this.visible || !this.floor) return;
      drawMiniMap(k, this.floor, this.currentRoomId, {
        x: this.x,
        y: this.y,
        showLegend: true,
      });
    },
  };
}
