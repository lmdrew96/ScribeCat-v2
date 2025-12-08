/**
 * TownScene - REFACTORED
 *
 * KAPLAY scene for the Cat Village town hub.
 * Now a thin orchestrator using shared systems and components.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { loadCatSprites, getCatSpriteName, type CatColor, type Direction } from '../sprites/catSprites.js';
import { TILE_SIZE, TILE_SCALE, PLAYER_SPEED } from '../config.js';
import { GameState } from '../state/index.js';
import { createWeatherSystem, type WeatherType } from '../systems/weather.js';
import { createDayNightSystem } from '../systems/dayNight.js';
import { drawInteractionPrompt } from '../systems/interaction.js';

// Import layout data from existing TownLayout
import {
  TOWN_WIDTH,
  TOWN_HEIGHT,
  TOWN_TILEMAP,
  TILE_COLORS,
  BUILDINGS,
  WALKABLE_TILES,
  getBuildingById,
  getSpawnPosition,
  type Building,
  type BuildingId,
} from '../../canvas/town/TownLayout.js';

// Canvas dimensions
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 320;

export interface TownSceneData {
  catColor?: CatColor;
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
      onBuildingInteract,
      dayNightEnabled = true,
      weatherEnabled = true,
      initialWeather = 'clear',
    } = data;

    // 1. Setup state
    const catColor = data.catColor || GameState.player.catColor;
    GameState.setCatColor(catColor);

    // Load cat sprites
    await loadCatSprites(k, catColor);

    // State
    let highlightedBuilding: Building | null = null;
    const tileSize = TILE_SIZE * TILE_SCALE;

    // 2. Draw tilemap
    drawTilemap(k, tileSize);

    // 3. Draw buildings
    drawBuildings(k, tileSize);

    // 4. Create player
    const spawn = getSpawnPosition();
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

    // 5. Setup movement
    k.setCamScale(1);

    k.onUpdate(() => {
      let dx = 0;
      let dy = 0;

      if (k.isKeyDown('left') || k.isKeyDown('a')) dx = -1;
      if (k.isKeyDown('right') || k.isKeyDown('d')) dx = 1;
      if (k.isKeyDown('up') || k.isKeyDown('w')) dy = -1;
      if (k.isKeyDown('down') || k.isKeyDown('s')) dy = 1;

      const moving = dx !== 0 || dy !== 0;

      if (moving) {
        const len = Math.sqrt(dx * dx + dy * dy);
        const moveX = (dx / len) * PLAYER_SPEED;
        const moveY = (dy / len) * PLAYER_SPEED;

        player.move(moveX, moveY);

        if (dy < 0) player.direction = 'up';
        else if (dy > 0) player.direction = 'down';
        else if (dx < 0) player.direction = 'left';
        else if (dx > 0) player.direction = 'right';

        player.flipX = dx < 0;

        if (!player.isMoving) {
          player.isMoving = true;
          player.use(k.sprite(getCatSpriteName(catColor, 'walk')));
          player.play('walk');
        }
      } else {
        if (player.isMoving) {
          player.isMoving = false;
          player.use(k.sprite(getCatSpriteName(catColor, 'idle')));
          player.play('idle');
        }
      }

      // Camera follow
      const camX = Math.max(CANVAS_WIDTH / 2, Math.min(player.pos.x, TOWN_WIDTH * tileSize - CANVAS_WIDTH / 2));
      const camY = Math.max(CANVAS_HEIGHT / 2, Math.min(player.pos.y, TOWN_HEIGHT * tileSize - CANVAS_HEIGHT / 2));
      k.setCamPos(camX, camY);
    });

    // 6. Setup building interactions
    player.onCollide('interactionZone', (zone: GameObj) => {
      highlightedBuilding = getBuildingById((zone as unknown as { buildingId: BuildingId }).buildingId);
    });

    player.onCollideEnd('interactionZone', () => {
      highlightedBuilding = null;
    });

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
          player.pos = k.vec2(building.doorX * tileSize + tileSize / 2, (building.doorY + 1) * tileSize);
        }
      });
    }

    // 7. Setup systems
    const dayNightSystem = dayNightEnabled ? createDayNightSystem(k, 60) : null;
    const weatherSystem = weatherEnabled ? createWeatherSystem(k, initialWeather, { canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT }) : null;

    // 8. Draw UI
    k.onDraw(() => {
      // Interaction prompt
      if (highlightedBuilding) {
        drawInteractionPrompt(k, `Press ENTER to enter ${highlightedBuilding.name}`, {
          y: CANVAS_HEIGHT - 40,
        });
      }

      // Shortcuts hint
      drawShortcutsHint(k);

      // Day/night overlay
      dayNightSystem?.draw();
    });
  });
}

/**
 * Draw the tilemap background
 */
function drawTilemap(k: KAPLAYCtx, tileSize: number): void {
  for (let y = 0; y < TOWN_HEIGHT; y++) {
    for (let x = 0; x < TOWN_WIDTH; x++) {
      const tile = TOWN_TILEMAP[y][x];
      const color = TILE_COLORS[tile];

      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      k.add([
        k.rect(tileSize, tileSize),
        k.pos(x * tileSize, y * tileSize),
        k.color(r, g, b),
        k.z(-10),
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
}

/**
 * Draw buildings with roofs and labels
 */
function drawBuildings(k: KAPLAYCtx, tileSize: number): void {
  for (const building of BUILDINGS) {
    const screenX = building.x * tileSize;
    const screenY = building.y * tileSize;
    const width = building.width * tileSize;
    const height = building.height * tileSize;

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

    // Building roof
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

    // Door interaction zone
    k.add([
      k.rect(tileSize * 3, tileSize * 2),
      k.pos((building.doorX - 1) * tileSize, building.doorY * tileSize),
      k.area(),
      k.opacity(0),
      'interactionZone',
      { buildingId: building.id },
    ]);
  }
}

/**
 * Draw shortcuts hint box
 */
function drawShortcutsHint(k: KAPLAYCtx): void {
  k.drawRect({
    pos: k.vec2(10, 10),
    width: 100,
    height: 75,
    color: k.rgb(0, 0, 0),
    opacity: 0.5,
    radius: 4,
    fixed: true,
  });

  const lines = ['Shortcuts:', '1-Shop 2-Inn', '3-Dungeons', '4-Quests 5-Home'];
  lines.forEach((line, i) => {
    k.drawText({
      text: line,
      pos: k.vec2(15, 18 + i * 15),
      size: 9,
      color: k.rgb(255, 255, 255),
      fixed: true,
    });
  });
}
