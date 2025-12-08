/**
 * TownScene
 *
 * KAPLAY scene for the Cat Village town hub.
 * Handles tile-based rendering, player movement, and building interactions.
 * Ported from TownCanvas.ts
 */

import type { KAPLAYCtx, GameObj, Vec2 } from 'kaplay';
import { loadCatSprites, getCatSpriteName, type CatColor, type CatAnimationType, type Direction } from '../sprites/catSprites.js';
import { TILE_SIZE, TILE_SCALE, PLAYER_SPEED, COLORS } from '../config.js';

// Import layout data from existing TownLayout
import {
  TOWN_WIDTH,
  TOWN_HEIGHT,
  TOWN_TILEMAP,
  TILE_COLORS,
  TileType,
  BUILDINGS,
  WALKABLE_TILES,
  getInteractionZone,
  getBuildingById,
  getSpawnPosition,
  type Building,
  type BuildingId,
} from '../../canvas/town/TownLayout.js';

// Canvas dimensions
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 320;

// Time of day phases
type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

// Weather types
type WeatherType = 'clear' | 'rain' | 'snow' | 'cloudy';

export interface TownSceneData {
  catColor: CatColor;
  onBuildingInteract?: (buildingId: BuildingId) => void;
  dayNightEnabled?: boolean;
  weatherEnabled?: boolean;
  initialWeather?: WeatherType;
}

/**
 * Register the Town scene with a KAPLAY instance
 */
export function registerTownScene(k: KAPLAYCtx): void {
  k.scene('town', async (data: TownSceneData) => {
    const {
      catColor,
      onBuildingInteract,
      dayNightEnabled = true,
      weatherEnabled = true,
      initialWeather = 'clear',
    } = data;

    // Load cat sprites
    await loadCatSprites(k, catColor);

    // State
    let timeOfDay: TimeOfDay = getTimeOfDay();
    let currentWeather: WeatherType = initialWeather;
    let highlightedBuilding: Building | null = null;

    // Get spawn position
    const spawn = getSpawnPosition();

    // Create tilemap layer (simple colored rectangles for now)
    // In a full implementation, we'd load actual tile sprites
    const tileSize = TILE_SIZE * TILE_SCALE;

    // Draw tilemap as background
    for (let y = 0; y < TOWN_HEIGHT; y++) {
      for (let x = 0; x < TOWN_WIDTH; x++) {
        const tile = TOWN_TILEMAP[y][x];
        const color = TILE_COLORS[tile];

        // Parse hex color to RGB
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        // Add tile
        const tileObj = k.add([
          k.rect(tileSize, tileSize),
          k.pos(x * tileSize, y * tileSize),
          k.color(r, g, b),
          k.z(-10), // Behind everything
        ]);

        // Add collision for non-walkable tiles
        if (!WALKABLE_TILES.has(tile)) {
          k.add([
            k.rect(tileSize, tileSize),
            k.pos(x * tileSize, y * tileSize),
            k.area(),
            k.body({ isStatic: true }),
            k.opacity(0),
            'wall',
          ]);
        }
      }
    }

    // Draw buildings
    for (const building of BUILDINGS) {
      const screenX = building.x * tileSize;
      const screenY = building.y * tileSize;
      const width = building.width * tileSize;
      const height = building.height * tileSize;

      // Parse building color
      const r = parseInt(building.color.slice(1, 3), 16);
      const g = parseInt(building.color.slice(3, 5), 16);
      const b = parseInt(building.color.slice(5, 7), 16);

      // Building body
      k.add([
        k.rect(width, height),
        k.pos(screenX, screenY),
        k.color(r, g, b),
        k.z(-5),
      ]);

      // Building roof (darker)
      k.add([
        k.polygon([
          k.vec2(0, 0),
          k.vec2(width / 2, -20),
          k.vec2(width, 0),
        ]),
        k.pos(screenX, screenY),
        k.color(Math.max(0, r - 30), Math.max(0, g - 30), Math.max(0, b - 30)),
        k.z(-4),
      ]);

      // Building name label
      k.add([
        k.text(building.name, { size: 10 }),
        k.pos(screenX + width / 2, screenY - 12),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.z(5),
      ]);

      // Door collision area (for interaction)
      k.add([
        k.rect(tileSize * 3, tileSize * 2),
        k.pos((building.doorX - 1) * tileSize, building.doorY * tileSize),
        k.area(),
        k.opacity(0),
        'interactionZone',
        { buildingId: building.id },
      ]);
    }

    // Create player
    const player = k.add([
      k.sprite(getCatSpriteName(catColor, 'idle')),
      k.pos(spawn.x * tileSize + tileSize / 2, spawn.y * tileSize),
      k.anchor('bot'),
      k.scale(TILE_SCALE),
      k.area({ scale: 0.5 }),
      k.body(),
      k.z(10),
      'player',
      {
        direction: 'down' as Direction,
        isMoving: false,
      },
    ]);

    player.play('idle');

    // Camera setup
    k.setCamScale(1);

    // Player movement
    k.onUpdate(() => {
      let dx = 0;
      let dy = 0;

      if (k.isKeyDown('left') || k.isKeyDown('a')) dx = -1;
      if (k.isKeyDown('right') || k.isKeyDown('d')) dx = 1;
      if (k.isKeyDown('up') || k.isKeyDown('w')) dy = -1;
      if (k.isKeyDown('down') || k.isKeyDown('s')) dy = 1;

      const moving = dx !== 0 || dy !== 0;

      if (moving) {
        // Normalize diagonal movement
        const len = Math.sqrt(dx * dx + dy * dy);
        const moveX = (dx / len) * PLAYER_SPEED;
        const moveY = (dy / len) * PLAYER_SPEED;

        player.move(moveX, moveY);

        // Update direction
        if (dy < 0) player.direction = 'up';
        else if (dy > 0) player.direction = 'down';
        else if (dx < 0) player.direction = 'left';
        else if (dx > 0) player.direction = 'right';

        // Flip sprite based on horizontal direction
        player.flipX = dx < 0;

        // Switch to walk animation
        if (!player.isMoving) {
          player.isMoving = true;
          player.use(k.sprite(getCatSpriteName(catColor, 'walk')));
          player.play('walk');
        }
      } else {
        // Switch to idle
        if (player.isMoving) {
          player.isMoving = false;
          player.use(k.sprite(getCatSpriteName(catColor, 'idle')));
          player.play('idle');
        }
      }

      // Update camera to follow player
      const camX = Math.max(CANVAS_WIDTH / 2, Math.min(player.pos.x, TOWN_WIDTH * tileSize - CANVAS_WIDTH / 2));
      const camY = Math.max(CANVAS_HEIGHT / 2, Math.min(player.pos.y, TOWN_HEIGHT * tileSize - CANVAS_HEIGHT / 2));
      k.setCamPos(camX, camY);
    });

    // Check for building interactions
    player.onCollide('interactionZone', (zone: GameObj) => {
      highlightedBuilding = getBuildingById(zone.buildingId);
    });

    player.onCollideEnd('interactionZone', () => {
      highlightedBuilding = null;
    });

    // Interaction key handler
    k.onKeyPress('enter', () => {
      if (highlightedBuilding && onBuildingInteract) {
        onBuildingInteract(highlightedBuilding.id);
      }
    });

    k.onKeyPress('space', () => {
      if (highlightedBuilding && onBuildingInteract) {
        onBuildingInteract(highlightedBuilding.id);
      }
    });

    // Building shortcuts
    const shortcuts: Record<string, BuildingId> = {
      '1': 'shop',
      '2': 'inn',
      '3': 'dungeons',
      '4': 'quests',
      '5': 'home',
    };

    for (const [key, buildingId] of Object.entries(shortcuts)) {
      k.onKeyPress(key, () => {
        const building = getBuildingById(buildingId);
        if (building) {
          // Teleport to building door
          player.pos = k.vec2(building.doorX * tileSize + tileSize / 2, (building.doorY + 1) * tileSize);
        }
      });
    }

    // Draw interaction prompt
    k.onDraw(() => {
      if (highlightedBuilding) {
        // Draw prompt box at bottom of screen (screen space)
        const boxWidth = 200;
        const boxHeight = 40;
        const boxX = CANVAS_WIDTH / 2 - boxWidth / 2;
        const boxY = CANVAS_HEIGHT - boxHeight - 10;

        // Convert to world space for drawing
        const worldPos = k.toWorld(k.vec2(boxX, boxY));

        k.drawRect({
          pos: worldPos,
          width: boxWidth,
          height: boxHeight,
          color: k.rgb(0, 0, 0),
          opacity: 0.8,
          fixed: true,
        });

        k.drawText({
          text: `Press ENTER to enter ${highlightedBuilding.name}`,
          pos: k.toWorld(k.vec2(CANVAS_WIDTH / 2, boxY + boxHeight / 2 + 4)),
          size: 12,
          anchor: 'center',
          color: k.rgb(255, 255, 255),
          fixed: true,
        });
      }
    });

    // Draw UI overlay
    k.onDraw(() => {
      // Shortcuts hint (screen space)
      const hintPos = k.toWorld(k.vec2(10, 10));

      k.drawRect({
        pos: hintPos,
        width: 120,
        height: 80,
        color: k.rgb(0, 0, 0),
        opacity: 0.5,
        fixed: true,
      });

      const lines = ['Shortcuts:', '1 - Shop', '2 - Inn', '3 - Dungeons', '4 - Quests'];
      lines.forEach((line, i) => {
        k.drawText({
          text: line,
          pos: k.toWorld(k.vec2(15, 20 + i * 13)),
          size: 9,
          color: k.rgb(255, 255, 255),
          fixed: true,
        });
      });
    });

    // Day/night cycle overlay
    if (dayNightEnabled) {
      k.onDraw(() => {
        const overlay = getDayNightOverlay(timeOfDay);
        if (overlay) {
          k.drawRect({
            pos: k.toWorld(k.vec2(0, 0)),
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            color: k.rgb(overlay.r, overlay.g, overlay.b),
            opacity: overlay.alpha,
            fixed: true,
          });
        }
      });

      // Update time of day periodically
      k.loop(60, () => {
        timeOfDay = getTimeOfDay();
      });
    }

    // Weather particles
    if (weatherEnabled && currentWeather !== 'clear') {
      // Spawn weather particles
      k.loop(0.05, () => {
        const camPos = k.getCamPos();
        if (currentWeather === 'rain') {
          k.add([
            k.rect(1, 10),
            k.pos(camPos.x - CANVAS_WIDTH / 2 + Math.random() * CANVAS_WIDTH, camPos.y - CANVAS_HEIGHT / 2 - 10),
            k.color(155, 185, 255),
            k.opacity(0.6),
            k.move(k.vec2(-1, 1).unit(), 400),
            k.lifespan(2),
            k.z(100),
          ]);
        } else if (currentWeather === 'snow') {
          k.add([
            k.circle(2 + Math.random() * 2),
            k.pos(camPos.x - CANVAS_WIDTH / 2 + Math.random() * CANVAS_WIDTH, camPos.y - CANVAS_HEIGHT / 2 - 10),
            k.color(255, 255, 255),
            k.opacity(0.8),
            k.move(k.vec2(-0.2, 1).unit(), 50 + Math.random() * 50),
            k.lifespan(10),
            k.z(100),
          ]);
        }
      });
    }
  });
}

/**
 * Get current time of day based on real time
 */
function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 18) return 'day';
  if (hour >= 18 && hour < 21) return 'dusk';
  return 'night';
}

/**
 * Get day/night overlay color and alpha
 */
function getDayNightOverlay(timeOfDay: TimeOfDay): { r: number; g: number; b: number; alpha: number } | null {
  switch (timeOfDay) {
    case 'dawn':
      return { r: 255, g: 153, b: 102, alpha: 0.15 };
    case 'day':
      return null;
    case 'dusk':
      return { r: 255, g: 102, b: 51, alpha: 0.2 };
    case 'night':
      return { r: 0, g: 17, b: 51, alpha: 0.4 };
  }
}
