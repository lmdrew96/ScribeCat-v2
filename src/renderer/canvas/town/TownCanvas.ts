/**
 * TownCanvas
 *
 * Canvas renderer for the Cat Village town hub.
 * Handles tile-based rendering, player movement, and building interactions.
 */

import { GameCanvas, type Point } from '../GameCanvas.js';
import { CatSpriteManager, type CatColor, type Direction, type CatAnimationType } from '../CatSpriteManager.js';
import {
  TILE_SIZE,
  TOWN_WIDTH,
  TOWN_HEIGHT,
  TOWN_TILEMAP,
  TILE_COLORS,
  TileType,
  BUILDINGS,
  isWalkable,
  getInteractionZone,
  getBuildingById,
  getSpawnPosition,
  type Building,
  type BuildingId,
} from './TownLayout.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('TownCanvas');

// Canvas dimensions
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 320;

// Movement settings
const MOVE_COOLDOWN_MS = 150; // Time between moves (grid-based)
const TILE_SCALE = 2; // Scale tiles for pixel art look

// Time of day phases
type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

// Weather types
type WeatherType = 'clear' | 'rain' | 'snow' | 'cloudy';

// Weather particle
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
}

// Ambient entity (birds, butterflies, leaves)
interface AmbientEntity {
  type: 'bird' | 'butterfly' | 'leaf';
  x: number;
  y: number;
  vx: number;
  vy: number;
  frame: number;
  targetX: number;
  targetY: number;
}

// Player state
interface PlayerState {
  tileX: number;
  tileY: number;
  pixelX: number; // For smooth movement animation
  pixelY: number;
  targetX: number;
  targetY: number;
  direction: Direction;
  isMoving: boolean;
  lastMoveTime: number;
}

// Interaction prompt
interface InteractionPrompt {
  building: Building;
  visible: boolean;
}

export class TownCanvas extends GameCanvas {
  private player: PlayerState;
  private catColor: CatColor = 'brown';
  private frameCounter: number = 0;

  // Interaction state
  private interactionPrompt: InteractionPrompt | null = null;
  private onBuildingInteract?: (buildingId: BuildingId) => void;

  // Movement queue for smooth input
  private pendingDirection: Direction | null = null;

  // Camera offset for centering player
  private cameraX: number = 0;
  private cameraY: number = 0;

  // Day/night cycle
  private timeOfDay: TimeOfDay = 'day';
  private dayNightEnabled: boolean = true;

  // Weather system
  private currentWeather: WeatherType = 'clear';
  private weatherParticles: Particle[] = [];
  private maxWeatherParticles: number = 100;
  private weatherEnabled: boolean = true;

  // Ambient entities (birds, butterflies)
  private ambientEntities: AmbientEntity[] = [];
  private maxAmbientEntities: number = 5;
  private ambientEnabled: boolean = true;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SCALE);

    // Initialize player at spawn
    const spawn = getSpawnPosition();
    this.player = {
      tileX: spawn.x,
      tileY: spawn.y,
      pixelX: spawn.x * TILE_SIZE * TILE_SCALE,
      pixelY: spawn.y * TILE_SIZE * TILE_SCALE,
      targetX: spawn.x * TILE_SIZE * TILE_SCALE,
      targetY: spawn.y * TILE_SIZE * TILE_SCALE,
      direction: 'down',
      isMoving: false,
      lastMoveTime: 0,
    };

    this.updateCamera();

    // Initialize time of day based on real time
    this.updateTimeOfDay();

    // Initialize ambient entities
    this.initializeAmbientEntities();

    logger.info('TownCanvas initialized');
  }

  /**
   * Set the cat color/sprite
   */
  setCatColor(color: CatColor): void {
    this.catColor = color;
    CatSpriteManager.loadCat(color).catch((err) => {
      logger.warn(`Failed to load ${color} cat:`, err);
    });
  }

  /**
   * Set callback for building interactions
   */
  setOnBuildingInteract(callback: (buildingId: BuildingId) => void): void {
    this.onBuildingInteract = callback;
  }

  /**
   * Teleport player to a specific tile
   */
  teleportTo(tileX: number, tileY: number): void {
    if (!isWalkable(tileX, tileY)) {
      logger.warn(`Cannot teleport to non-walkable tile: ${tileX}, ${tileY}`);
      return;
    }

    this.player.tileX = tileX;
    this.player.tileY = tileY;
    this.player.pixelX = tileX * TILE_SIZE * TILE_SCALE;
    this.player.pixelY = tileY * TILE_SIZE * TILE_SCALE;
    this.player.targetX = this.player.pixelX;
    this.player.targetY = this.player.pixelY;
    this.player.isMoving = false;

    this.updateCamera();
  }

  /**
   * Get current player tile position
   */
  getPlayerPosition(): { x: number; y: number } {
    return { x: this.player.tileX, y: this.player.tileY };
  }

  /**
   * Enable/disable day-night cycle
   */
  setDayNightEnabled(enabled: boolean): void {
    this.dayNightEnabled = enabled;
  }

  /**
   * Enable/disable weather effects
   */
  setWeatherEnabled(enabled: boolean): void {
    this.weatherEnabled = enabled;
    if (!enabled) {
      this.weatherParticles = [];
    }
  }

  /**
   * Set the current weather
   */
  setWeather(weather: WeatherType): void {
    this.currentWeather = weather;
    this.weatherParticles = [];
  }

  /**
   * Enable/disable ambient animations
   */
  setAmbientEnabled(enabled: boolean): void {
    this.ambientEnabled = enabled;
    if (!enabled) {
      this.ambientEntities = [];
    }
  }

  /**
   * Get current time of day
   */
  getTimeOfDay(): TimeOfDay {
    return this.timeOfDay;
  }

  /**
   * Get current weather
   */
  getWeather(): WeatherType {
    return this.currentWeather;
  }

  // ============================================================================
  // GameCanvas Implementation
  // ============================================================================

  protected update(deltaTime: number): void {
    this.frameCounter++;

    // Handle input
    this.handleMovementInput();

    // Smooth pixel movement towards target
    this.updateMovement(deltaTime);

    // Check for building interactions
    this.checkInteractionZones();

    // Update camera to follow player
    this.updateCamera();

    // Update time of day (check every ~60 frames)
    if (this.dayNightEnabled && this.frameCounter % 60 === 0) {
      this.updateTimeOfDay();
    }

    // Update weather particles
    if (this.weatherEnabled && this.currentWeather !== 'clear') {
      this.updateWeather(deltaTime);
    }

    // Update ambient entities
    if (this.ambientEnabled) {
      this.updateAmbientEntities(deltaTime);
    }
  }

  protected render(): void {
    // Clear canvas with time-based sky color
    const skyColor = this.getSkyColor();
    this.clear(skyColor);

    // Draw tilemap
    this.drawTilemap();

    // Draw ambient entities (below buildings)
    if (this.ambientEnabled) {
      this.drawAmbientEntities();
    }

    // Draw buildings
    this.drawBuildings();

    // Draw player
    this.drawPlayer();

    // Draw weather particles (above everything)
    if (this.weatherEnabled && this.currentWeather !== 'clear') {
      this.drawWeather();
    }

    // Apply day/night overlay
    if (this.dayNightEnabled) {
      this.drawDayNightOverlay();
    }

    // Draw interaction prompt
    if (this.interactionPrompt?.visible) {
      this.drawInteractionPrompt();
    }

    // Draw UI overlay (building names, etc.)
    this.drawUI();
  }

  protected onKeyDown(key: string): void {
    // Handle interaction
    if ((key === 'enter' || key === ' ') && this.interactionPrompt?.visible) {
      this.interactWithBuilding(this.interactionPrompt.building);
    }

    // Quick building shortcuts
    const shortcuts: Record<string, BuildingId> = {
      '1': 'shop',
      '2': 'inn',
      '3': 'dungeons',
      '4': 'quests',
      '5': 'home',
    };

    if (shortcuts[key]) {
      const building = getBuildingById(shortcuts[key]);
      if (building) {
        // Teleport to building entrance
        this.teleportTo(building.doorX, building.doorY);
      }
    }
  }

  protected onClick(position: Point): void {
    // Convert screen position to tile position
    const tileX = Math.floor((position.x + this.cameraX) / (TILE_SIZE * TILE_SCALE));
    const tileY = Math.floor((position.y + this.cameraY) / (TILE_SIZE * TILE_SCALE));

    // Check if clicking on a building
    for (const building of BUILDINGS) {
      if (
        tileX >= building.x &&
        tileX < building.x + building.width &&
        tileY >= building.y &&
        tileY < building.y + building.height
      ) {
        // Teleport near building and interact
        if (isWalkable(building.doorX, building.doorY + 1)) {
          this.teleportTo(building.doorX, building.doorY + 1);
        }
        return;
      }
    }

    // Otherwise, try to pathfind/walk to clicked tile
    if (isWalkable(tileX, tileY)) {
      // Simple: just teleport for now (could implement pathfinding later)
      this.teleportTo(tileX, tileY);
    }
  }

  // ============================================================================
  // Private Methods - Movement
  // ============================================================================

  private handleMovementInput(): void {
    const now = performance.now();
    const canMove = now - this.player.lastMoveTime >= MOVE_COOLDOWN_MS;

    if (!canMove || this.player.isMoving) {
      // Queue the direction for next move
      const input = this.getDirectionalInput();
      if (input.x !== 0 || input.y !== 0) {
        this.pendingDirection = this.inputToDirection(input);
      }
      return;
    }

    // Get movement input
    let input = this.getDirectionalInput();

    // Use pending direction if no current input
    if (input.x === 0 && input.y === 0 && this.pendingDirection) {
      input = this.directionToInput(this.pendingDirection);
      this.pendingDirection = null;
    }

    if (input.x === 0 && input.y === 0) return;

    // Calculate target tile
    const targetTileX = this.player.tileX + input.x;
    const targetTileY = this.player.tileY + input.y;

    // Update direction
    this.player.direction = this.inputToDirection(input);

    // Check if walkable
    if (!isWalkable(targetTileX, targetTileY)) {
      return;
    }

    // Start movement
    this.player.tileX = targetTileX;
    this.player.tileY = targetTileY;
    this.player.targetX = targetTileX * TILE_SIZE * TILE_SCALE;
    this.player.targetY = targetTileY * TILE_SIZE * TILE_SCALE;
    this.player.isMoving = true;
    this.player.lastMoveTime = now;
  }

  private updateMovement(deltaTime: number): void {
    if (!this.player.isMoving) return;

    const speed = 0.3; // Pixels per ms
    const distance = speed * deltaTime;

    // Move towards target
    const dx = this.player.targetX - this.player.pixelX;
    const dy = this.player.targetY - this.player.pixelY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= distance) {
      // Arrived at target
      this.player.pixelX = this.player.targetX;
      this.player.pixelY = this.player.targetY;
      this.player.isMoving = false;
    } else {
      // Move towards target
      this.player.pixelX += (dx / dist) * distance;
      this.player.pixelY += (dy / dist) * distance;
    }
  }

  private inputToDirection(input: Point): Direction {
    if (input.y < 0) return 'up';
    if (input.y > 0) return 'down';
    if (input.x < 0) return 'left';
    return 'right';
  }

  private directionToInput(direction: Direction): Point {
    switch (direction) {
      case 'up': return { x: 0, y: -1 };
      case 'down': return { x: 0, y: 1 };
      case 'left': return { x: -1, y: 0 };
      case 'right': return { x: 1, y: 0 };
    }
  }

  private updateCamera(): void {
    // Center camera on player
    this.cameraX = this.player.pixelX - CANVAS_WIDTH / 2 + (TILE_SIZE * TILE_SCALE) / 2;
    this.cameraY = this.player.pixelY - CANVAS_HEIGHT / 2 + (TILE_SIZE * TILE_SCALE) / 2;

    // Clamp to tilemap bounds
    const maxCameraX = TOWN_WIDTH * TILE_SIZE * TILE_SCALE - CANVAS_WIDTH;
    const maxCameraY = TOWN_HEIGHT * TILE_SIZE * TILE_SCALE - CANVAS_HEIGHT;

    this.cameraX = Math.max(0, Math.min(this.cameraX, maxCameraX));
    this.cameraY = Math.max(0, Math.min(this.cameraY, maxCameraY));
  }

  // ============================================================================
  // Private Methods - Interaction
  // ============================================================================

  private checkInteractionZones(): void {
    const zone = getInteractionZone(this.player.tileX, this.player.tileY);

    if (zone) {
      const building = getBuildingById(zone.buildingId);
      if (building) {
        this.interactionPrompt = { building, visible: true };
        return;
      }
    }

    this.interactionPrompt = null;
  }

  private interactWithBuilding(building: Building): void {
    logger.info(`Interacting with: ${building.name}`);
    if (this.onBuildingInteract) {
      this.onBuildingInteract(building.id);
    }
  }

  // ============================================================================
  // Private Methods - Rendering
  // ============================================================================

  private drawTilemap(): void {
    // Calculate visible tile range
    const startTileX = Math.max(0, Math.floor(this.cameraX / (TILE_SIZE * TILE_SCALE)));
    const startTileY = Math.max(0, Math.floor(this.cameraY / (TILE_SIZE * TILE_SCALE)));
    const endTileX = Math.min(TOWN_WIDTH, startTileX + Math.ceil(CANVAS_WIDTH / (TILE_SIZE * TILE_SCALE)) + 1);
    const endTileY = Math.min(TOWN_HEIGHT, startTileY + Math.ceil(CANVAS_HEIGHT / (TILE_SIZE * TILE_SCALE)) + 1);

    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const tile = TOWN_TILEMAP[y][x];
        const screenX = x * TILE_SIZE * TILE_SCALE - this.cameraX;
        const screenY = y * TILE_SIZE * TILE_SCALE - this.cameraY;

        // Draw tile
        this.ctx.fillStyle = TILE_COLORS[tile];
        this.ctx.fillRect(screenX, screenY, TILE_SIZE * TILE_SCALE, TILE_SIZE * TILE_SCALE);

        // Add texture/variation
        this.drawTileDetails(tile, screenX, screenY);
      }
    }
  }

  private drawTileDetails(tile: TileType, x: number, y: number): void {
    const size = TILE_SIZE * TILE_SCALE;

    switch (tile) {
      case TileType.GRASS:
        // Random grass tufts
        if (Math.random() < 0.3) {
          this.ctx.fillStyle = '#3f6212';
          this.ctx.fillRect(x + 4, y + 4, 2, 4);
          this.ctx.fillRect(x + 12, y + 8, 2, 4);
        }
        break;

      case TileType.WATER:
        // Water ripples
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        const rippleOffset = (this.frameCounter / 20) % 4;
        this.ctx.fillRect(x + 4 + rippleOffset, y + 8, 8, 2);
        break;

      case TileType.TREE:
        // Tree trunk
        this.ctx.fillStyle = '#78350f';
        this.ctx.fillRect(x + 10, y + 20, 12, 12);
        // Tree canopy
        this.ctx.fillStyle = '#15803d';
        this.ctx.beginPath();
        this.ctx.arc(x + 16, y + 12, 14, 0, Math.PI * 2);
        this.ctx.fill();
        break;

      case TileType.ROCK:
        // Rock shape
        this.ctx.fillStyle = '#9ca3af';
        this.ctx.beginPath();
        this.ctx.ellipse(x + 16, y + 20, 12, 8, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#6b7280';
        this.ctx.fillRect(x + 6, y + 14, 8, 6);
        break;

      case TileType.FLOWER:
        // Flower
        this.ctx.fillStyle = '#fbbf24';
        this.ctx.beginPath();
        this.ctx.arc(x + 8, y + 12, 4, 0, Math.PI * 2);
        this.ctx.arc(x + 24, y + 20, 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#f472b6';
        this.ctx.beginPath();
        this.ctx.arc(x + 16, y + 8, 4, 0, Math.PI * 2);
        this.ctx.fill();
        break;

      case TileType.PATH:
        // Path texture
        this.ctx.fillStyle = '#a3815a';
        this.ctx.fillRect(x + 2, y + 2, 4, 4);
        this.ctx.fillRect(x + 20, y + 16, 4, 4);
        break;
    }
  }

  private drawBuildings(): void {
    for (const building of BUILDINGS) {
      const screenX = building.x * TILE_SIZE * TILE_SCALE - this.cameraX;
      const screenY = building.y * TILE_SIZE * TILE_SCALE - this.cameraY;
      const width = building.width * TILE_SIZE * TILE_SCALE;
      const height = building.height * TILE_SIZE * TILE_SCALE;

      // Skip if off-screen
      if (screenX + width < 0 || screenX > CANVAS_WIDTH ||
          screenY + height < 0 || screenY > CANVAS_HEIGHT) {
        continue;
      }

      // Building body
      this.ctx.fillStyle = building.color;
      this.ctx.fillRect(screenX, screenY, width, height);

      // Building roof
      this.ctx.fillStyle = this.darkenColor(building.color, 30);
      this.ctx.beginPath();
      this.ctx.moveTo(screenX, screenY);
      this.ctx.lineTo(screenX + width / 2, screenY - 20);
      this.ctx.lineTo(screenX + width, screenY);
      this.ctx.fill();

      // Door
      const doorScreenX = building.doorX * TILE_SIZE * TILE_SCALE - this.cameraX;
      const doorScreenY = (building.doorY - 1) * TILE_SIZE * TILE_SCALE - this.cameraY;
      this.ctx.fillStyle = '#78350f';
      this.ctx.fillRect(doorScreenX - 8, doorScreenY, 16, TILE_SIZE * TILE_SCALE);

      // Building icon
      this.ctx.font = '24px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(building.icon, screenX + width / 2, screenY + height / 2 + 8);

      // Building name
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 10px "Courier New", monospace';
      this.ctx.fillText(building.name, screenX + width / 2, screenY - 24);
    }
  }

  private drawPlayer(): void {
    const screenX = this.player.pixelX - this.cameraX;
    const screenY = this.player.pixelY - this.cameraY;

    // Determine animation type
    const animationType: CatAnimationType = this.player.isMoving ? 'walk' : 'idle';

    // Draw cat
    CatSpriteManager.drawAnimated(
      this.ctx,
      this.catColor,
      animationType,
      screenX + (TILE_SIZE * TILE_SCALE) / 2,
      screenY,
      this.frameCounter,
      TILE_SCALE,
      this.player.direction
    );
  }

  private drawInteractionPrompt(): void {
    if (!this.interactionPrompt) return;

    const building = this.interactionPrompt.building;

    // Draw prompt box at bottom of screen
    const boxWidth = 200;
    const boxHeight = 40;
    const boxX = (CANVAS_WIDTH - boxWidth) / 2;
    const boxY = CANVAS_HEIGHT - boxHeight - 10;

    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    // Border
    this.ctx.strokeStyle = building.color;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // Text
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 12px "Courier New", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Press ENTER to enter ${building.name}`, boxX + boxWidth / 2, boxY + 25);
  }

  private drawUI(): void {
    // Building shortcuts hint
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(10, 10, 120, 80);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '9px "Courier New", monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Shortcuts:', 15, 25);
    this.ctx.fillText('1 - Shop', 15, 38);
    this.ctx.fillText('2 - Inn', 15, 51);
    this.ctx.fillText('3 - Dungeons', 15, 64);
    this.ctx.fillText('4 - Quests', 15, 77);
  }

  private darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (num >> 16) - percent);
    const g = Math.max(0, ((num >> 8) & 0x00ff) - percent);
    const b = Math.max(0, (num & 0x0000ff) - percent);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  // ============================================================================
  // Day/Night Cycle
  // ============================================================================

  /**
   * Update time of day based on real-world time
   */
  private updateTimeOfDay(): void {
    const hour = new Date().getHours();

    // Dawn: 5-8, Day: 8-18, Dusk: 18-21, Night: 21-5
    if (hour >= 5 && hour < 8) {
      this.timeOfDay = 'dawn';
    } else if (hour >= 8 && hour < 18) {
      this.timeOfDay = 'day';
    } else if (hour >= 18 && hour < 21) {
      this.timeOfDay = 'dusk';
    } else {
      this.timeOfDay = 'night';
    }
  }

  /**
   * Get sky color based on time of day
   */
  private getSkyColor(): string {
    switch (this.timeOfDay) {
      case 'dawn':
        return '#4a3f6a'; // Purple/pink morning
      case 'day':
        return '#1a1a2e'; // Default blue
      case 'dusk':
        return '#4a2040'; // Orange/purple evening
      case 'night':
        return '#0a0a14'; // Dark blue night
    }
  }

  /**
   * Draw day/night overlay
   */
  private drawDayNightOverlay(): void {
    let overlayColor: string;
    let overlayAlpha: number;

    switch (this.timeOfDay) {
      case 'dawn':
        // Warm orange/pink tint
        overlayColor = '#ff9966';
        overlayAlpha = 0.15;
        break;
      case 'day':
        // No overlay during day
        return;
      case 'dusk':
        // Orange/red tint
        overlayColor = '#ff6633';
        overlayAlpha = 0.2;
        break;
      case 'night':
        // Dark blue tint
        overlayColor = '#001133';
        overlayAlpha = 0.4;
        break;
    }

    this.ctx.fillStyle = overlayColor;
    this.ctx.globalAlpha = overlayAlpha;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.ctx.globalAlpha = 1.0;

    // Draw stars at night
    if (this.timeOfDay === 'night') {
      this.drawStars();
    }
  }

  /**
   * Draw stars for night sky
   */
  private drawStars(): void {
    this.ctx.fillStyle = '#ffffff';
    // Fixed star positions based on frame for twinkling
    const starSeed = Math.floor(this.frameCounter / 30);
    for (let i = 0; i < 30; i++) {
      const x = ((starSeed * 13 + i * 37) % CANVAS_WIDTH);
      const y = ((starSeed * 17 + i * 41) % 60);
      const size = (i % 3 === 0) ? 2 : 1;
      const twinkle = (this.frameCounter + i * 10) % 60 < 30 ? 0.5 : 1.0;
      this.ctx.globalAlpha = twinkle * 0.8;
      this.ctx.fillRect(x, y, size, size);
    }
    this.ctx.globalAlpha = 1.0;
  }

  // ============================================================================
  // Weather System
  // ============================================================================

  /**
   * Update weather particles
   */
  private updateWeather(deltaTime: number): void {
    // Spawn new particles
    const spawnRate = this.currentWeather === 'rain' ? 3 : 1;
    while (this.weatherParticles.length < this.maxWeatherParticles) {
      for (let i = 0; i < spawnRate && this.weatherParticles.length < this.maxWeatherParticles; i++) {
        this.spawnWeatherParticle();
      }
    }

    // Update existing particles
    for (let i = this.weatherParticles.length - 1; i >= 0; i--) {
      const p = this.weatherParticles[i];

      // Move particle
      p.x += p.vx * (deltaTime / 16);
      p.y += p.vy * (deltaTime / 16);
      p.life -= deltaTime;

      // Remove dead particles
      if (p.life <= 0 || p.y > CANVAS_HEIGHT + 10) {
        this.weatherParticles.splice(i, 1);
      }
    }
  }

  /**
   * Spawn a weather particle
   */
  private spawnWeatherParticle(): void {
    const particle: Particle = {
      x: Math.random() * (CANVAS_WIDTH + 100) - 50,
      y: -10,
      vx: 0,
      vy: 0,
      size: 1,
      life: 0,
      maxLife: 0,
    };

    switch (this.currentWeather) {
      case 'rain':
        particle.vx = -1 + Math.random() * 0.5;
        particle.vy = 8 + Math.random() * 4;
        particle.size = 1;
        particle.life = 3000;
        particle.maxLife = 3000;
        break;
      case 'snow':
        particle.vx = -0.5 + Math.random() * 1;
        particle.vy = 1 + Math.random() * 1.5;
        particle.size = 2 + Math.floor(Math.random() * 3);
        particle.life = 10000;
        particle.maxLife = 10000;
        break;
      case 'cloudy':
        // Cloud particles - larger, slower
        particle.y = Math.random() * 40;
        particle.vx = 0.2 + Math.random() * 0.3;
        particle.vy = 0;
        particle.size = 20 + Math.random() * 30;
        particle.life = 30000;
        particle.maxLife = 30000;
        break;
    }

    this.weatherParticles.push(particle);
  }

  /**
   * Draw weather particles
   */
  private drawWeather(): void {
    for (const p of this.weatherParticles) {
      switch (this.currentWeather) {
        case 'rain':
          // Rain drops as lines
          this.ctx.strokeStyle = 'rgba(155, 185, 255, 0.6)';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 2);
          this.ctx.stroke();
          break;

        case 'snow':
          // Snowflakes as circles
          const alpha = p.life / p.maxLife;
          this.ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * alpha})`;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          this.ctx.fill();
          break;

        case 'cloudy':
          // Clouds as semi-transparent ellipses
          this.ctx.fillStyle = 'rgba(200, 200, 220, 0.3)';
          this.ctx.beginPath();
          this.ctx.ellipse(p.x, p.y, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
          this.ctx.fill();
          break;
      }
    }
  }

  // ============================================================================
  // Ambient Entities
  // ============================================================================

  /**
   * Initialize ambient entities
   */
  private initializeAmbientEntities(): void {
    for (let i = 0; i < this.maxAmbientEntities; i++) {
      this.spawnAmbientEntity();
    }
  }

  /**
   * Spawn an ambient entity
   */
  private spawnAmbientEntity(): void {
    // Only spawn during day/dawn
    if (this.timeOfDay === 'night') return;

    const types: AmbientEntity['type'][] = ['bird', 'butterfly', 'leaf'];
    const type = types[Math.floor(Math.random() * types.length)];

    const entity: AmbientEntity = {
      type,
      x: Math.random() * CANVAS_WIDTH,
      y: 20 + Math.random() * 100,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 0.5,
      frame: 0,
      targetX: Math.random() * CANVAS_WIDTH,
      targetY: 20 + Math.random() * 100,
    };

    // Leaves start from top and fall
    if (type === 'leaf') {
      entity.y = -10;
      entity.vy = 0.5 + Math.random() * 0.5;
      entity.vx = -0.5 + Math.random() * 1;
    }

    this.ambientEntities.push(entity);
  }

  /**
   * Update ambient entities
   */
  private updateAmbientEntities(deltaTime: number): void {
    // Respawn entities during day
    if (this.ambientEntities.length < this.maxAmbientEntities && this.timeOfDay !== 'night') {
      if (Math.random() < 0.01) {
        this.spawnAmbientEntity();
      }
    }

    // Update each entity
    for (let i = this.ambientEntities.length - 1; i >= 0; i--) {
      const e = this.ambientEntities[i];

      // Update frame for animation
      e.frame += deltaTime / 100;

      switch (e.type) {
        case 'bird':
          // Move towards target, occasionally change target
          if (Math.random() < 0.01) {
            e.targetX = Math.random() * (CANVAS_WIDTH + 100) - 50;
            e.targetY = 10 + Math.random() * 60;
          }
          const bdx = e.targetX - e.x;
          const bdy = e.targetY - e.y;
          e.vx += Math.sign(bdx) * 0.1;
          e.vy += Math.sign(bdy) * 0.05;
          e.vx = Math.max(-3, Math.min(3, e.vx));
          e.vy = Math.max(-1, Math.min(1, e.vy));
          break;

        case 'butterfly':
          // Erratic movement
          e.vx += (Math.random() - 0.5) * 0.3;
          e.vy += (Math.random() - 0.5) * 0.2;
          e.vx = Math.max(-1, Math.min(1, e.vx));
          e.vy = Math.max(-0.5, Math.min(0.5, e.vy));
          break;

        case 'leaf':
          // Swaying fall
          e.vx = Math.sin(e.frame * 0.1) * 0.5;
          e.vy = 0.5 + Math.sin(e.frame * 0.05) * 0.2;
          break;
      }

      e.x += e.vx * (deltaTime / 16);
      e.y += e.vy * (deltaTime / 16);

      // Remove if off-screen
      if (e.x < -50 || e.x > CANVAS_WIDTH + 50 || e.y > CANVAS_HEIGHT + 10) {
        this.ambientEntities.splice(i, 1);
      }
    }
  }

  /**
   * Draw ambient entities
   */
  private drawAmbientEntities(): void {
    for (const e of this.ambientEntities) {
      switch (e.type) {
        case 'bird':
          // Simple bird shape
          this.ctx.fillStyle = '#333333';
          const wingOffset = Math.sin(e.frame * 0.5) * 4;
          // Body
          this.ctx.beginPath();
          this.ctx.ellipse(e.x, e.y, 5, 3, 0, 0, Math.PI * 2);
          this.ctx.fill();
          // Wings
          this.ctx.beginPath();
          this.ctx.moveTo(e.x - 4, e.y);
          this.ctx.lineTo(e.x - 8, e.y - 4 + wingOffset);
          this.ctx.lineTo(e.x - 2, e.y - 2);
          this.ctx.fill();
          this.ctx.beginPath();
          this.ctx.moveTo(e.x + 4, e.y);
          this.ctx.lineTo(e.x + 8, e.y - 4 + wingOffset);
          this.ctx.lineTo(e.x + 2, e.y - 2);
          this.ctx.fill();
          break;

        case 'butterfly':
          // Colorful butterfly
          const wingFlap = Math.abs(Math.sin(e.frame * 0.3)) * 4;
          const color = ['#ff69b4', '#87ceeb', '#ffd700'][Math.floor(e.frame) % 3];
          this.ctx.fillStyle = color;
          // Left wing
          this.ctx.beginPath();
          this.ctx.ellipse(e.x - 3, e.y, 4, 3 + wingFlap, -0.3, 0, Math.PI * 2);
          this.ctx.fill();
          // Right wing
          this.ctx.beginPath();
          this.ctx.ellipse(e.x + 3, e.y, 4, 3 + wingFlap, 0.3, 0, Math.PI * 2);
          this.ctx.fill();
          // Body
          this.ctx.fillStyle = '#333';
          this.ctx.fillRect(e.x - 1, e.y - 4, 2, 8);
          break;

        case 'leaf':
          // Falling leaf
          const rotation = e.frame * 0.2;
          this.ctx.save();
          this.ctx.translate(e.x, e.y);
          this.ctx.rotate(rotation);
          this.ctx.fillStyle = '#8b4513';
          this.ctx.beginPath();
          this.ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.restore();
          break;
      }
    }
  }
}
