/**
 * Room Renderer
 *
 * Draws dungeon rooms. That's it.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import type { DungeonRoom, ContentType } from '../../canvas/dungeon/DungeonGenerator.js';

export interface RoomConfig {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  doorSize: number;
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  width: 400,
  height: 240,
  offsetX: 40,
  offsetY: 40,
  doorSize: 48,
};

export type DungeonDirection = 'north' | 'south' | 'east' | 'west';

const CONTENT_COLORS: Record<string, [number, number, number]> = {
  enemy: [239, 68, 68],
  chest: [251, 191, 36],
  chestOpen: [120, 53, 15],
  trap: [220, 38, 38],
  npc: [96, 165, 250],
  exit: [168, 85, 247],
  interactable: [34, 197, 94],
};

const CONTENT_ICONS: Partial<Record<ContentType, string>> = {
  enemy: '!',
  chest: '$',
  trap: 'X',
  npc: '?',
  exit: 'v',
};

export class RoomRenderer {
  private k: KAPLAYCtx;
  private config: RoomConfig;
  private objects: GameObj[] = [];

  constructor(k: KAPLAYCtx, config: RoomConfig = DEFAULT_ROOM_CONFIG) {
    this.k = k;
    this.config = config;
  }

  /**
   * Clear all rendered objects
   */
  clear(): void {
    for (const obj of this.objects) {
      this.k.destroy(obj);
    }
    this.objects = [];
  }

  /**
   * Render a room
   */
  render(room: DungeonRoom): void {
    this.clear();
    this.drawBackground();
    this.drawDoors(room);
    this.drawContents(room);
  }

  /**
   * Get door positions
   */
  getDoorPositions(): Record<DungeonDirection, { x: number; y: number }> {
    const { width, height, offsetX, offsetY, doorSize } = this.config;
    return {
      north: { x: offsetX + width / 2, y: offsetY + doorSize / 2 },
      south: { x: offsetX + width / 2, y: offsetY + height - doorSize / 2 },
      east: { x: offsetX + width - doorSize / 2, y: offsetY + height / 2 },
      west: { x: offsetX + doorSize / 2, y: offsetY + height / 2 },
    };
  }

  /**
   * Get movement bounds
   */
  getMovementBounds() {
    const { width, height, offsetX, offsetY } = this.config;
    const margin = 16;
    return {
      minX: offsetX + margin,
      maxX: offsetX + width - margin,
      minY: offsetY + margin,
      maxY: offsetY + height - margin,
    };
  }

  /**
   * Get entry position for a direction
   */
  getEntryPosition(fromDirection?: DungeonDirection): { x: number; y: number } {
    const { width, height, offsetX, offsetY } = this.config;
    const centerX = offsetX + width / 2;
    const centerY = offsetY + height / 2;
    const margin = 60;

    switch (fromDirection) {
      case 'north':
        return { x: centerX, y: offsetY + margin };
      case 'south':
        return { x: centerX, y: offsetY + height - margin };
      case 'east':
        return { x: offsetX + width - margin, y: centerY };
      case 'west':
        return { x: offsetX + margin, y: centerY };
      default:
        return { x: centerX, y: centerY };
    }
  }

  private drawBackground(): void {
    const k = this.k;
    const { width, height, offsetX, offsetY } = this.config;

    // Floor
    this.objects.push(
      k.add([k.rect(width, height), k.pos(offsetX, offsetY), k.color(42, 42, 78), k.z(-10)])
    );

    // Border
    const border = k.rgb(26, 26, 46);
    this.objects.push(
      k.add([k.rect(width, 4), k.pos(offsetX, offsetY), k.color(border), k.z(-5)])
    );
    this.objects.push(
      k.add([k.rect(width, 4), k.pos(offsetX, offsetY + height - 4), k.color(border), k.z(-5)])
    );
    this.objects.push(
      k.add([k.rect(4, height), k.pos(offsetX, offsetY), k.color(border), k.z(-5)])
    );
    this.objects.push(
      k.add([k.rect(4, height), k.pos(offsetX + width - 4, offsetY), k.color(border), k.z(-5)])
    );

    // Grid
    for (let x = offsetX; x < offsetX + width; x += 32) {
      this.objects.push(
        k.add([
          k.rect(1, height),
          k.pos(x, offsetY),
          k.color(255, 255, 255),
          k.opacity(0.05),
          k.z(-8),
        ])
      );
    }
    for (let y = offsetY; y < offsetY + height; y += 32) {
      this.objects.push(
        k.add([
          k.rect(width, 1),
          k.pos(offsetX, y),
          k.color(255, 255, 255),
          k.opacity(0.05),
          k.z(-8),
        ])
      );
    }
  }

  private drawDoors(room: DungeonRoom): void {
    const k = this.k;
    const { doorSize } = this.config;
    const positions = this.getDoorPositions();
    const arrows: Record<DungeonDirection, string> = { north: '^', south: 'v', east: '>', west: '<' };

    for (const [dir, pos] of Object.entries(positions)) {
      const direction = dir as DungeonDirection;
      const targetRoomId = room.connections[direction];
      if (!targetRoomId) continue;

      // Door
      const door = k.add([
        k.rect(doorSize, doorSize),
        k.pos(pos.x - doorSize / 2, pos.y - doorSize / 2),
        k.color(74, 222, 128),
        k.area(),
        k.z(0),
        'door',
        { direction, targetRoomId },
      ]);
      this.objects.push(door);

      // Arrow
      this.objects.push(
        k.add([
          k.text(arrows[direction], { size: 20 }),
          k.pos(pos.x, pos.y),
          k.anchor('center'),
          k.color(255, 255, 255),
          k.z(1),
        ])
      );
    }
  }

  private drawContents(room: DungeonRoom): void {
    const k = this.k;
    const { width, height, offsetX, offsetY } = this.config;

    for (const content of room.contents) {
      if (content.type === 'enemy' && content.triggered) continue;

      const x = offsetX + content.x * width;
      const y = offsetY + content.y * height;

      const colorKey = content.type === 'chest' && content.triggered ? 'chestOpen' : content.type;
      const color = CONTENT_COLORS[colorKey] || [255, 255, 255];

      // Circle
      const obj = k.add([
        k.circle(12),
        k.pos(x, y),
        k.anchor('center'),
        k.color(color[0], color[1], color[2]),
        k.area({ shape: new k.Circle(k.vec2(0, 0), 22) }),
        k.z(5),
        'content',
        { contentData: content },
      ]);
      this.objects.push(obj);

      // Icon
      const icon = CONTENT_ICONS[content.type];
      if (icon) {
        this.objects.push(
          k.add([
            k.text(icon, { size: 14 }),
            k.pos(x, y),
            k.anchor('center'),
            k.color(255, 255, 255),
            k.z(6),
          ])
        );
      }
    }
  }
}
