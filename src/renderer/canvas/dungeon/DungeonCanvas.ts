/**
 * DungeonCanvas
 *
 * Canvas renderer for dungeon room exploration.
 * Handles room rendering, player movement, content interactions, and door transitions.
 */

import { GameCanvas, type Point } from '../GameCanvas.js';
import { CatSpriteManager, type CatColor, type Direction, type CatAnimationType } from '../CatSpriteManager.js';
import {
  DungeonGenerator,
  type DungeonFloor,
  type DungeonRoom,
  type RoomContent,
  type ContentType,
  Direction as DungeonDirection,
} from './DungeonGenerator.js';
import {
  DUNGEON_TILE_SIZE,
  FLOOR_TILES,
  WALL_TILES,
  DOOR_TILES,
  PROP_TILES,
  DECORATION_TILES,
  getContentTile,
  getDungeonTilesToPreload,
} from './DungeonLayout.js';
import { spriteRenderer } from '../../components/studyquest/StudyQuestSpriteRenderer.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('DungeonCanvas');

// Canvas dimensions
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 320;

// Room dimensions
const ROOM_WIDTH = 400;
const ROOM_HEIGHT = 240;
const ROOM_OFFSET_X = (CANVAS_WIDTH - ROOM_WIDTH) / 2;
const ROOM_OFFSET_Y = 40;

// Door dimensions
const DOOR_WIDTH = 48;
const DOOR_HEIGHT = 48;

// Player settings
const PLAYER_SPEED = 0.15; // Pixels per ms
const PLAYER_SIZE = 32;
const TRIGGER_DISTANCE = 40;

// Colors
const COLORS = {
  roomFloor: '#2a2a4e',
  roomWall: '#1a1a2e',
  doorOpen: '#4ade80',
  doorLocked: '#ef4444',
  doorHighlight: '#fbbf24',
  chest: '#fbbf24',
  chestOpen: '#78350f',
  enemy: '#ef4444',
  trap: '#dc2626',
  trapTriggered: '#991b1b',
  npc: '#60a5fa',
  exit: '#a855f7',
  restPoint: '#22c55e',
};

// Player state
interface PlayerState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  direction: Direction;
  isMoving: boolean;
}

// Content callbacks
type ContentCallback = (content: RoomContent) => void;
type DoorCallback = (direction: DungeonDirection, nextRoomId: string) => void;

export class DungeonCanvas extends GameCanvas {
  private floor: DungeonFloor | null = null;
  private currentRoom: DungeonRoom | null = null;
  private player: PlayerState;
  private catColor: CatColor = 'brown';
  private frameCounter: number = 0;

  // Door interaction
  private highlightedDoor: DungeonDirection | null = null;
  private doorCooldown: number = 0;

  // Callbacks
  private onContentTrigger?: ContentCallback;
  private onDoorEnter?: DoorCallback;
  private onRoomEnter?: (room: DungeonRoom) => void;
  private onRoomClear?: (room: DungeonRoom) => void;

  // UI state
  private showRoomInfo: boolean = true;
  private transitionAlpha: number = 0;
  private isTransitioning: boolean = false;

  // NPC interaction (requires key press, not auto-trigger)
  private nearbyNpc: RoomContent | null = null;

  // Tile rendering state
  private tilesLoaded: boolean = false;
  private useTileImages: boolean = true;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, CANVAS_WIDTH, CANVAS_HEIGHT, 2);

    // Initialize player at center
    this.player = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      targetX: CANVAS_WIDTH / 2,
      targetY: CANVAS_HEIGHT / 2,
      direction: 'down',
      isMoving: false,
    };

    // Preload dungeon tiles
    this.preloadTiles();

    logger.info('DungeonCanvas initialized');
  }

  /**
   * Preload all dungeon tile images
   */
  private async preloadTiles(): Promise<void> {
    try {
      const tiles = getDungeonTilesToPreload();
      await spriteRenderer.preloadTileSet(tiles);
      this.tilesLoaded = true;
      logger.info(`Loaded ${tiles.length} dungeon tile images`);
    } catch (error) {
      logger.warn('Failed to load dungeon tile images, using procedural fallback:', error);
      this.tilesLoaded = false;
    }
  }

  /**
   * Set the dungeon floor
   */
  setFloor(floor: DungeonFloor): void {
    this.floor = floor;
    const startRoom = floor.rooms.get(floor.startRoomId);
    if (startRoom) {
      this.enterRoom(startRoom);
    }
  }

  /**
   * Enter a specific room
   */
  enterRoom(room: DungeonRoom, fromDirection?: DungeonDirection): void {
    this.currentRoom = room;
    room.visited = true;
    room.discovered = true;

    // Discover connected rooms
    for (const [dir, roomId] of Object.entries(room.connections)) {
      if (roomId && this.floor) {
        const connectedRoom = this.floor.rooms.get(roomId);
        if (connectedRoom) {
          connectedRoom.discovered = true;
        }
      }
    }

    // Position player based on entry direction
    this.positionPlayerAtEntry(fromDirection);

    // Notify callback
    if (this.onRoomEnter) {
      this.onRoomEnter(room);
    }

    logger.info(`Entered room: ${room.id} (${room.type})`);
  }

  /**
   * Get current room
   */
  getCurrentRoom(): DungeonRoom | null {
    return this.currentRoom;
  }

  /**
   * Set cat color
   */
  setCatColor(color: CatColor): void {
    this.catColor = color;
    CatSpriteManager.loadCat(color);
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks: {
    onContentTrigger?: ContentCallback;
    onDoorEnter?: DoorCallback;
    onRoomEnter?: (room: DungeonRoom) => void;
    onRoomClear?: (room: DungeonRoom) => void;
  }): void {
    this.onContentTrigger = callbacks.onContentTrigger;
    this.onDoorEnter = callbacks.onDoorEnter;
    this.onRoomEnter = callbacks.onRoomEnter;
    this.onRoomClear = callbacks.onRoomClear;
  }

  /**
   * Set content trigger callback (convenience method)
   */
  setOnContentTrigger(callback: (content: RoomContent, room: DungeonRoom) => void): void {
    this.onContentTrigger = (content: RoomContent) => {
      if (this.currentRoom) {
        callback(content, this.currentRoom);
      }
    };
  }

  /**
   * Set door transition callback (convenience method)
   */
  setOnDoorTransition(callback: (direction: DungeonDirection) => void): void {
    this.onDoorEnter = (direction: DungeonDirection) => {
      callback(direction);
    };
  }

  /**
   * Mark a content item as triggered
   */
  triggerContent(contentId: string): void {
    if (!this.currentRoom) return;

    const content = this.currentRoom.contents.find((c) => c.id === contentId);
    if (content) {
      content.triggered = true;
      this.checkRoomCleared();
    }
  }

  /**
   * Check if room is cleared (all enemies defeated)
   */
  private checkRoomCleared(): void {
    if (!this.currentRoom) return;

    const enemies = this.currentRoom.contents.filter((c) => c.type === 'enemy' && !c.triggered);
    if (enemies.length === 0 && !this.currentRoom.cleared) {
      this.currentRoom.cleared = true;
      if (this.onRoomClear) {
        this.onRoomClear(this.currentRoom);
      }
    }
  }

  // ============================================================================
  // GameCanvas Implementation
  // ============================================================================

  protected update(deltaTime: number): void {
    this.frameCounter++;

    if (this.isTransitioning) {
      return;
    }

    // Handle movement
    this.handleMovement(deltaTime);

    // Check door proximity
    this.checkDoorProximity();

    // Check content proximity
    this.checkContentProximity();

    // Update door cooldown
    if (this.doorCooldown > 0) {
      this.doorCooldown -= deltaTime;
    }
  }

  protected render(): void {
    // Clear canvas
    this.clear('#0a0a1e');

    if (!this.currentRoom) {
      this.drawText('No room loaded', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '#ffffff', 14, 'center');
      return;
    }

    // Draw room
    this.drawRoom();

    // Draw doors
    this.drawDoors();

    // Draw contents
    this.drawContents();

    // Draw player
    this.drawPlayer();

    // Draw UI
    this.drawUI();

    // Draw transition overlay
    if (this.isTransitioning) {
      this.ctx.fillStyle = `rgba(0, 0, 0, ${this.transitionAlpha})`;
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }

  protected onKeyDown(key: string): void {
    // Interact with highlighted door
    if ((key === 'enter' || key === ' ') && this.highlightedDoor && this.doorCooldown <= 0) {
      this.enterDoor(this.highlightedDoor);
      return;
    }

    // Interact with nearby NPC (requires explicit key press)
    if ((key === 'enter' || key === ' ') && this.nearbyNpc) {
      if (this.onContentTrigger) {
        this.onContentTrigger(this.nearbyNpc);
      }
      this.nearbyNpc = null;
    }
  }

  protected onClick(position: Point): void {
    // Click to move
    const roomX = position.x - ROOM_OFFSET_X;
    const roomY = position.y - ROOM_OFFSET_Y;

    // Clamp to room bounds
    const margin = PLAYER_SIZE / 2;
    this.player.targetX = Math.max(
      ROOM_OFFSET_X + margin,
      Math.min(position.x, ROOM_OFFSET_X + ROOM_WIDTH - margin)
    );
    this.player.targetY = Math.max(
      ROOM_OFFSET_Y + margin,
      Math.min(position.y, ROOM_OFFSET_Y + ROOM_HEIGHT - margin)
    );
  }

  // ============================================================================
  // Private Methods - Movement
  // ============================================================================

  private handleMovement(deltaTime: number): void {
    const input = this.getDirectionalInput();

    // Keyboard movement
    if (input.x !== 0 || input.y !== 0) {
      const speed = PLAYER_SPEED * deltaTime;
      const newX = this.player.x + input.x * speed;
      const newY = this.player.y + input.y * speed;

      // Update direction
      if (input.y < 0) this.player.direction = 'up';
      else if (input.y > 0) this.player.direction = 'down';
      else if (input.x < 0) this.player.direction = 'left';
      else if (input.x > 0) this.player.direction = 'right';

      // Clamp to room bounds
      const margin = PLAYER_SIZE / 2;
      this.player.x = Math.max(
        ROOM_OFFSET_X + margin,
        Math.min(newX, ROOM_OFFSET_X + ROOM_WIDTH - margin)
      );
      this.player.y = Math.max(
        ROOM_OFFSET_Y + margin,
        Math.min(newY, ROOM_OFFSET_Y + ROOM_HEIGHT - margin)
      );

      this.player.isMoving = true;
      this.player.targetX = this.player.x;
      this.player.targetY = this.player.y;
    } else {
      // Click-to-move (move towards target)
      const dx = this.player.targetX - this.player.x;
      const dy = this.player.targetY - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 2) {
        const speed = PLAYER_SPEED * deltaTime;
        this.player.x += (dx / dist) * Math.min(speed, dist);
        this.player.y += (dy / dist) * Math.min(speed, dist);
        this.player.isMoving = true;

        // Update direction
        if (Math.abs(dx) > Math.abs(dy)) {
          this.player.direction = dx > 0 ? 'right' : 'left';
        } else {
          this.player.direction = dy > 0 ? 'down' : 'up';
        }
      } else {
        this.player.isMoving = false;
      }
    }
  }

  private positionPlayerAtEntry(fromDirection?: DungeonDirection): void {
    const centerX = ROOM_OFFSET_X + ROOM_WIDTH / 2;
    const centerY = ROOM_OFFSET_Y + ROOM_HEIGHT / 2;
    const margin = 60;

    switch (fromDirection) {
      case 'north':
        this.player.x = centerX;
        this.player.y = ROOM_OFFSET_Y + margin;
        this.player.direction = 'down';
        break;
      case 'south':
        this.player.x = centerX;
        this.player.y = ROOM_OFFSET_Y + ROOM_HEIGHT - margin;
        this.player.direction = 'up';
        break;
      case 'east':
        this.player.x = ROOM_OFFSET_X + ROOM_WIDTH - margin;
        this.player.y = centerY;
        this.player.direction = 'left';
        break;
      case 'west':
        this.player.x = ROOM_OFFSET_X + margin;
        this.player.y = centerY;
        this.player.direction = 'right';
        break;
      default:
        this.player.x = centerX;
        this.player.y = centerY;
    }

    this.player.targetX = this.player.x;
    this.player.targetY = this.player.y;
  }

  /**
   * Reposition player to the center of the current room
   * Used when resuming after battle to ensure valid position
   */
  repositionPlayerToRoomCenter(): void {
    const centerX = ROOM_OFFSET_X + ROOM_WIDTH / 2;
    const centerY = ROOM_OFFSET_Y + ROOM_HEIGHT / 2;

    this.player.x = centerX;
    this.player.y = centerY;
    this.player.targetX = centerX;
    this.player.targetY = centerY;
    this.player.isMoving = false;
  }

  // ============================================================================
  // Private Methods - Interactions
  // ============================================================================

  private checkDoorProximity(): void {
    if (!this.currentRoom) return;

    this.highlightedDoor = null;
    const doorPositions = this.getDoorPositions();

    for (const [direction, pos] of Object.entries(doorPositions)) {
      if (!this.currentRoom.connections[direction as DungeonDirection]) continue;

      const dx = this.player.x - pos.x;
      const dy = this.player.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < DOOR_WIDTH) {
        this.highlightedDoor = direction as DungeonDirection;
        break;
      }
    }
  }

  private checkContentProximity(): void {
    if (!this.currentRoom) return;

    // Reset nearby NPC each frame
    this.nearbyNpc = null;

    for (const content of this.currentRoom.contents) {
      if (content.triggered) continue;

      const contentX = ROOM_OFFSET_X + content.x * ROOM_WIDTH;
      const contentY = ROOM_OFFSET_Y + content.y * ROOM_HEIGHT;

      const dx = this.player.x - contentX;
      const dy = this.player.y - contentY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < TRIGGER_DISTANCE) {
        // NPCs require explicit interaction (Enter key) - don't auto-trigger
        if (content.type === 'npc') {
          this.nearbyNpc = content;
        } else {
          // Auto-trigger other content types (enemies, chests, traps, etc.)
          if (this.onContentTrigger) {
            this.onContentTrigger(content);
          }
        }
        break;
      }
    }
  }

  private enterDoor(direction: DungeonDirection): void {
    if (!this.currentRoom || !this.floor) return;

    const nextRoomId = this.currentRoom.connections[direction];
    if (!nextRoomId) return;

    const nextRoom = this.floor.rooms.get(nextRoomId);
    if (!nextRoom) return;

    // Trigger callback
    if (this.onDoorEnter) {
      this.onDoorEnter(direction, nextRoomId);
    }

    // Start transition
    this.isTransitioning = true;
    this.transitionAlpha = 0;
    this.doorCooldown = 500;

    // Fade out
    const fadeOut = setInterval(() => {
      this.transitionAlpha += 0.1;
      if (this.transitionAlpha >= 1) {
        clearInterval(fadeOut);

        // Switch room
        const oppositeDir = this.oppositeDirection(direction);
        this.enterRoom(nextRoom, oppositeDir);

        // Fade in
        const fadeIn = setInterval(() => {
          this.transitionAlpha -= 0.1;
          if (this.transitionAlpha <= 0) {
            clearInterval(fadeIn);
            this.isTransitioning = false;
          }
        }, 30);
      }
    }, 30);
  }

  private getDoorPositions(): Record<DungeonDirection, Point> {
    return {
      north: { x: ROOM_OFFSET_X + ROOM_WIDTH / 2, y: ROOM_OFFSET_Y + DOOR_HEIGHT / 2 },
      south: { x: ROOM_OFFSET_X + ROOM_WIDTH / 2, y: ROOM_OFFSET_Y + ROOM_HEIGHT - DOOR_HEIGHT / 2 },
      east: { x: ROOM_OFFSET_X + ROOM_WIDTH - DOOR_WIDTH / 2, y: ROOM_OFFSET_Y + ROOM_HEIGHT / 2 },
      west: { x: ROOM_OFFSET_X + DOOR_WIDTH / 2, y: ROOM_OFFSET_Y + ROOM_HEIGHT / 2 },
    };
  }

  private oppositeDirection(direction: DungeonDirection): DungeonDirection {
    switch (direction) {
      case 'north': return 'south';
      case 'south': return 'north';
      case 'east': return 'west';
      case 'west': return 'east';
    }
  }

  // ============================================================================
  // Private Methods - Rendering
  // ============================================================================

  private drawRoom(): void {
    const scale = 2; // Scale 16px tiles to 32px
    const tileSize = DUNGEON_TILE_SIZE * scale;
    const tilesWide = Math.ceil(ROOM_WIDTH / tileSize);
    const tilesHigh = Math.ceil(ROOM_HEIGHT / tileSize);

    // Try to use tile images
    if (this.useTileImages && this.tilesLoaded) {
      // Draw floor tiles
      for (let ty = 0; ty < tilesHigh; ty++) {
        for (let tx = 0; tx < tilesWide; tx++) {
          const x = ROOM_OFFSET_X + tx * tileSize;
          const y = ROOM_OFFSET_Y + ty * tileSize;

          // Vary floor tiles for visual interest
          const tileIndex = (tx + ty) % 4;
          let floorTile = FLOOR_TILES.stone;
          if (tileIndex === 1) floorTile = FLOOR_TILES.stoneCracked;
          else if (tileIndex === 2) floorTile = FLOOR_TILES.stoneAlt;
          else if (tileIndex === 3) floorTile = FLOOR_TILES.stoneDark;

          if (!spriteRenderer.drawTileToCanvas(this.ctx, floorTile, x, y, scale)) {
            // Fallback to procedural
            this.drawProceduralRoom();
            return;
          }
        }
      }

      // Draw wall border (top and bottom edges)
      for (let tx = 0; tx < tilesWide; tx++) {
        const x = ROOM_OFFSET_X + tx * tileSize;
        // Top wall
        spriteRenderer.drawTileToCanvas(this.ctx, WALL_TILES.edgeTop, x, ROOM_OFFSET_Y - tileSize / 2, scale);
        // Bottom wall
        spriteRenderer.drawTileToCanvas(this.ctx, WALL_TILES.edgeBottom, x, ROOM_OFFSET_Y + ROOM_HEIGHT - tileSize / 2, scale);
      }

      // Draw wall border (left and right edges)
      for (let ty = 0; ty < tilesHigh; ty++) {
        const y = ROOM_OFFSET_Y + ty * tileSize;
        // Left wall
        spriteRenderer.drawTileToCanvas(this.ctx, WALL_TILES.edgeLeft, ROOM_OFFSET_X - tileSize / 2, y, scale);
        // Right wall
        spriteRenderer.drawTileToCanvas(this.ctx, WALL_TILES.edgeRight, ROOM_OFFSET_X + ROOM_WIDTH - tileSize / 2, y, scale);
      }

      // Draw corner pieces
      spriteRenderer.drawTileToCanvas(this.ctx, WALL_TILES.cornerTL, ROOM_OFFSET_X - tileSize / 2, ROOM_OFFSET_Y - tileSize / 2, scale);
      spriteRenderer.drawTileToCanvas(this.ctx, WALL_TILES.cornerTR, ROOM_OFFSET_X + ROOM_WIDTH - tileSize / 2, ROOM_OFFSET_Y - tileSize / 2, scale);
      spriteRenderer.drawTileToCanvas(this.ctx, WALL_TILES.cornerBL, ROOM_OFFSET_X - tileSize / 2, ROOM_OFFSET_Y + ROOM_HEIGHT - tileSize / 2, scale);
      spriteRenderer.drawTileToCanvas(this.ctx, WALL_TILES.cornerBR, ROOM_OFFSET_X + ROOM_WIDTH - tileSize / 2, ROOM_OFFSET_Y + ROOM_HEIGHT - tileSize / 2, scale);
    } else {
      this.drawProceduralRoom();
    }
  }

  /**
   * Fallback procedural room rendering
   */
  private drawProceduralRoom(): void {
    // Room floor
    this.ctx.fillStyle = COLORS.roomFloor;
    this.ctx.fillRect(ROOM_OFFSET_X, ROOM_OFFSET_Y, ROOM_WIDTH, ROOM_HEIGHT);

    // Room border
    this.ctx.strokeStyle = COLORS.roomWall;
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(ROOM_OFFSET_X, ROOM_OFFSET_Y, ROOM_WIDTH, ROOM_HEIGHT);

    // Floor pattern
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;
    for (let x = ROOM_OFFSET_X; x < ROOM_OFFSET_X + ROOM_WIDTH; x += 32) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, ROOM_OFFSET_Y);
      this.ctx.lineTo(x, ROOM_OFFSET_Y + ROOM_HEIGHT);
      this.ctx.stroke();
    }
    for (let y = ROOM_OFFSET_Y; y < ROOM_OFFSET_Y + ROOM_HEIGHT; y += 32) {
      this.ctx.beginPath();
      this.ctx.moveTo(ROOM_OFFSET_X, y);
      this.ctx.lineTo(ROOM_OFFSET_X + ROOM_WIDTH, y);
      this.ctx.stroke();
    }
  }

  private drawDoors(): void {
    if (!this.currentRoom) return;

    const doorPositions = this.getDoorPositions();
    const scale = 2;
    const tileSize = DUNGEON_TILE_SIZE * scale;

    for (const [direction, pos] of Object.entries(doorPositions)) {
      const hasConnection = this.currentRoom.connections[direction as DungeonDirection] !== null;
      if (!hasConnection) continue;

      const isHighlighted = this.highlightedDoor === direction;

      // Try to use tile images
      if (this.useTileImages && this.tilesLoaded) {
        // Draw door tile
        const doorTile = isHighlighted ? DOOR_TILES.woodOpen : DOOR_TILES.woodClosed;
        spriteRenderer.drawTileToCanvas(
          this.ctx,
          doorTile,
          pos.x - tileSize / 2,
          pos.y - tileSize / 2,
          scale
        );

        // Draw highlight glow if highlighted
        if (isHighlighted) {
          this.ctx.strokeStyle = COLORS.doorHighlight;
          this.ctx.lineWidth = 3;
          this.ctx.strokeRect(pos.x - tileSize / 2 - 2, pos.y - tileSize / 2 - 2, tileSize + 4, tileSize + 4);
        }
      } else {
        // Fallback to procedural drawing
        const color = isHighlighted ? COLORS.doorHighlight : COLORS.doorOpen;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(pos.x - DOOR_WIDTH / 2, pos.y - DOOR_HEIGHT / 2, DOOR_WIDTH, DOOR_HEIGHT);

        // Door frame
        this.ctx.strokeStyle = '#1a1a2e';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(pos.x - DOOR_WIDTH / 2, pos.y - DOOR_HEIGHT / 2, DOOR_WIDTH, DOOR_HEIGHT);

        // Arrow indicator
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '20px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        const arrows: Record<string, string> = {
          north: '▲',
          south: '▼',
          east: '▶',
          west: '◀',
        };
        this.ctx.fillText(arrows[direction], pos.x, pos.y);
      }
    }
  }

  private drawContents(): void {
    if (!this.currentRoom) return;

    for (const content of this.currentRoom.contents) {
      const x = ROOM_OFFSET_X + content.x * ROOM_WIDTH;
      const y = ROOM_OFFSET_Y + content.y * ROOM_HEIGHT;

      this.drawContent(content, x, y);
    }
  }

  private drawContent(content: RoomContent, x: number, y: number): void {
    const size = 24;
    const scale = 2;
    const tileSize = DUNGEON_TILE_SIZE * scale;

    // Try to use tile images
    if (this.useTileImages && this.tilesLoaded) {
      // Skip triggered enemies (defeated)
      if (content.type === 'enemy' && content.triggered) {
        return;
      }

      const tilePath = getContentTile(content.type, content.triggered, content.data);
      const drawn = spriteRenderer.drawTileToCanvas(
        this.ctx,
        tilePath,
        x - tileSize / 2,
        y - tileSize / 2,
        scale
      );

      if (drawn) {
        // Add visual effects on top of tiles
        if (content.type === 'exit') {
          // Portal glow effect
          const glowSize = 4 + Math.sin(this.frameCounter / 10) * 3;
          this.ctx.strokeStyle = COLORS.exit;
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.arc(x, y, tileSize / 2 + glowSize, 0, Math.PI * 2);
          this.ctx.stroke();
        } else if (content.type === 'interactable' && content.data?.interactType === 'campfire' && !content.triggered) {
          // Fire flicker effect
          const flicker = Math.sin(this.frameCounter / 5) * 2;
          this.ctx.fillStyle = `rgba(255, 200, 50, ${0.3 + Math.sin(this.frameCounter / 3) * 0.2})`;
          this.ctx.beginPath();
          this.ctx.arc(x, y - 4 + flicker, 12, 0, Math.PI * 2);
          this.ctx.fill();
        }
        return;
      }
    }

    // Fallback to procedural drawing
    switch (content.type) {
      case 'enemy':
        if (!content.triggered) {
          this.ctx.fillStyle = COLORS.enemy;
          this.ctx.beginPath();
          this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = '16px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('!', x, y + 6);
        }
        break;

      case 'chest':
        const chestColor = content.triggered ? COLORS.chestOpen : COLORS.chest;
        this.ctx.fillStyle = chestColor;
        this.ctx.fillRect(x - size / 2, y - size / 2, size, size * 0.7);
        // Chest lid
        this.ctx.fillRect(x - size / 2 - 2, y - size / 2 - 4, size + 4, 6);
        if (!content.triggered) {
          // Lock
          this.ctx.fillStyle = '#78350f';
          this.ctx.fillRect(x - 4, y - 2, 8, 8);
        }
        break;

      case 'trap':
        const trapColor = content.triggered ? COLORS.trapTriggered : COLORS.trap;
        this.ctx.fillStyle = trapColor;
        // Spikes
        for (let i = 0; i < 3; i++) {
          this.ctx.beginPath();
          this.ctx.moveTo(x - 12 + i * 12, y + 8);
          this.ctx.lineTo(x - 6 + i * 12, y - 12);
          this.ctx.lineTo(x + i * 12, y + 8);
          this.ctx.fill();
        }
        break;

      case 'npc':
        this.ctx.fillStyle = COLORS.npc;
        this.ctx.beginPath();
        this.ctx.arc(x, y - 8, 12, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillRect(x - 8, y, 16, 20);
        break;

      case 'interactable':
        if (content.data?.interactType === 'campfire') {
          // Fire
          this.ctx.fillStyle = COLORS.restPoint;
          this.ctx.beginPath();
          this.ctx.moveTo(x, y - 16);
          this.ctx.lineTo(x + 12, y + 8);
          this.ctx.lineTo(x - 12, y + 8);
          this.ctx.fill();
          // Flicker
          const flicker = Math.sin(this.frameCounter / 5) * 4;
          this.ctx.fillStyle = '#fbbf24';
          this.ctx.beginPath();
          this.ctx.moveTo(x, y - 10 + flicker);
          this.ctx.lineTo(x + 6, y + 4);
          this.ctx.lineTo(x - 6, y + 4);
          this.ctx.fill();
        }
        break;

      case 'exit':
        this.ctx.fillStyle = COLORS.exit;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        this.ctx.fill();
        // Spiral effect
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size / 3 + Math.sin(this.frameCounter / 10) * 4, 0, Math.PI * 2);
        this.ctx.stroke();
        break;
    }
  }

  private drawPlayer(): void {
    const animationType: CatAnimationType = this.player.isMoving ? 'walk' : 'idle';

    CatSpriteManager.drawAnimated(
      this.ctx,
      this.catColor,
      animationType,
      this.player.x,
      this.player.y - PLAYER_SIZE / 2,
      this.frameCounter,
      2,
      this.player.direction
    );
  }

  private drawUI(): void {
    if (!this.currentRoom || !this.showRoomInfo) return;

    // Room type indicator
    const roomTypeName = this.currentRoom.type.charAt(0).toUpperCase() + this.currentRoom.type.slice(1);

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.fillRect(10, 10, 120, 24);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 11px "Courier New", monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Room: ${roomTypeName}`, 16, 26);

    // Door interaction hint
    if (this.highlightedDoor) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(CANVAS_WIDTH / 2 - 80, CANVAS_HEIGHT - 30, 160, 24);

      this.ctx.fillStyle = '#fbbf24';
      this.ctx.font = 'bold 11px "Courier New", monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Press ENTER to go through door', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 14);
    }

    // NPC interaction hint
    if (this.nearbyNpc && !this.highlightedDoor) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(CANVAS_WIDTH / 2 - 80, CANVAS_HEIGHT - 30, 160, 24);

      this.ctx.fillStyle = '#60a5fa'; // Blue for NPC
      this.ctx.font = 'bold 11px "Courier New", monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Press ENTER to interact', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 14);
    }
  }
}
