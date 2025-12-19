/**
 * DungeonRoomRenderer.ts
 * 
 * Handles room rendering: tilemaps, doors, content actors, and visual elements.
 */

import * as ex from 'excalibur';
import { GameState } from '../../../state/GameState.js';
import type { 
  DungeonRoom, 
  RoomContent,
  EnemyContentData,
  SecretContentData,
  ExitContentData,
  NPCContentData,
} from '../../../../canvas/dungeon/DungeonGenerator.js';
import { ENEMIES } from '../../../data/enemies.js';
import {
  loadStaticEnemySprite,
  loadSlimeAnimation,
  getSlimeColorFromFolder,
  getStaticEnemyIdFromFile,
} from '../../../loaders/EnemySpriteLoader.js';
import { loadNPCSprite } from '../../../loaders/NPCSpriteLoader.js';
import { getDungeonRoomLoader, type DungeonRoomData } from '../../../loaders/DungeonRoomLoader.js';
import { SceneFontCache } from '../../ui/FontCache.js';
import { 
  ROOM_CONFIG, 
  type Direction,
  CONTENT_COLORS,
  CONTENT_ICONS,
} from './DungeonConstants.js';

export interface RoomRendererConfig {
  scheduledTimeout: (callback: () => void, delay: number) => void;
}

/**
 * Manages rendering of dungeon rooms including tilemaps and content.
 */
export class DungeonRoomRenderer {
  private scene: ex.Scene;
  private fontCache: SceneFontCache;
  private config: RoomRendererConfig;
  
  // Room actors
  private roomActors: ex.Actor[] = [];
  private contentActors: Map<string, ex.Actor> = new Map();
  
  // Tilemap state
  private roomTilemapActors: ex.Actor[] = [];
  private roomTemplateMap: Map<string, number> = new Map();
  private currentTilemapScale: number = 1;
  private currentTilemapOffsetX: number = 0;
  private currentTilemapOffsetY: number = 0;
  private currentRoomData: DungeonRoomData | null = null;
  
  constructor(scene: ex.Scene, config: RoomRendererConfig) {
    this.scene = scene;
    this.config = config;
    this.fontCache = new SceneFontCache();
  }
  
  /**
   * Load dungeon room tilemaps asynchronously
   */
  async loadTilemaps(onRerender: () => void): Promise<void> {
    const loader = getDungeonRoomLoader();
    if (!loader.isLoaded) {
      await loader.loadAll();
      onRerender();
    }
  }
  
  /**
   * Render the current room from game state
   */
  renderCurrentRoom(): void {
    this.clearRoomActors();

    const room = GameState.getCurrentRoom();
    if (!room) return;

    // Try to render tilemap background, fallback to solid color
    const tilemapRendered = this.renderTilemapBackground(room.id);

    if (!tilemapRendered) {
      this.renderFallbackBackground();
    }

    // Draw doors
    this.drawDoors(room);

    // Draw content
    this.drawContents(room);
  }
  
  /**
   * Render tilemap background for a room
   */
  private renderTilemapBackground(roomId: string): boolean {
    const loader = getDungeonRoomLoader();
    if (!loader.isLoaded) {
      this.currentRoomData = null;
      return false;
    }

    const room = GameState.getCurrentRoom();
    if (!room) {
      this.currentRoomData = null;
      return false;
    }

    // Get or assign a template ID for this room
    let templateId = this.roomTemplateMap.get(roomId);
    if (templateId === undefined) {
      const hasNorth = !!room.connections.north;
      const hasSouth = !!room.connections.south;
      const hasEast = !!room.connections.east;
      const hasWest = !!room.connections.west;
      
      const matchingRoom = loader.getRoomForConnections(hasNorth, hasSouth, hasEast, hasWest);
      if (!matchingRoom) {
        this.currentRoomData = null;
        return false;
      }
      templateId = matchingRoom.id;
      this.roomTemplateMap.set(roomId, templateId);
      console.log(`[DungeonRoomRenderer] Assigned template ${templateId} for room ${roomId} (N:${hasNorth} S:${hasSouth} E:${hasEast} W:${hasWest})`);
    }

    const roomData = loader.getRoom(templateId);
    if (!roomData) {
      this.currentRoomData = null;
      return false;
    }

    // Calculate scale to fit the tilemap into ROOM_CONFIG dimensions
    const tilemapDims = loader.getRoomDimensions(1);
    const scaleX = ROOM_CONFIG.width / tilemapDims.width;
    const scaleY = ROOM_CONFIG.height / tilemapDims.height;
    const scale = Math.min(scaleX, scaleY);

    // Center the tilemap within the room area
    const scaledWidth = tilemapDims.width * scale;
    const scaledHeight = tilemapDims.height * scale;
    const offsetX = ROOM_CONFIG.offsetX + (ROOM_CONFIG.width - scaledWidth) / 2;
    const offsetY = ROOM_CONFIG.offsetY + (ROOM_CONFIG.height - scaledHeight) / 2;

    // Store current tilemap state
    this.currentTilemapScale = scale;
    this.currentTilemapOffsetX = offsetX;
    this.currentTilemapOffsetY = offsetY;
    this.currentRoomData = roomData;

    // Create tilemap actors
    const tilemapActors = loader.createRoomActors(roomData, offsetX, offsetY, scale, -10);

    for (const actor of tilemapActors) {
      this.scene.add(actor);
      this.roomActors.push(actor);
    }

    return tilemapActors.length > 0;
  }
  
  /**
   * Render fallback solid color background when tilemap isn't available
   */
  private renderFallbackBackground(): void {
    const roomBg = new ex.Actor({
      pos: ex.vec(ROOM_CONFIG.offsetX + ROOM_CONFIG.width / 2, ROOM_CONFIG.offsetY + ROOM_CONFIG.height / 2),
      width: ROOM_CONFIG.width,
      height: ROOM_CONFIG.height,
      z: -10,
    });
    roomBg.graphics.use(
      new ex.Rectangle({
        width: ROOM_CONFIG.width,
        height: ROOM_CONFIG.height,
        color: ex.Color.fromRGB(42, 42, 78),
      })
    );
    this.scene.add(roomBg);
    this.roomActors.push(roomBg);
  }
  
  /**
   * Draw doors for the current room
   */
  private drawDoors(room: DungeonRoom): void {
    const doorPositions = this.getDoorPositions();

    for (const [dir, pos] of Object.entries(doorPositions)) {
      const direction = dir as Direction;
      const targetRoomId = room.connections[direction];
      if (!targetRoomId) continue;

      // Create invisible door trigger zone
      const door = new ex.Actor({
        pos: ex.vec(pos.x, pos.y),
        width: ROOM_CONFIG.doorSize,
        height: ROOM_CONFIG.doorSize,
        z: 0,
      });
      
      // Only show green door indicators if tilemap is not loaded (fallback mode)
      if (!this.currentRoomData) {
        door.graphics.use(
          new ex.Rectangle({
            width: ROOM_CONFIG.doorSize,
            height: ROOM_CONFIG.doorSize,
            color: ex.Color.fromHex('#4ade80'),
          })
        );
        
        // Arrow indicator only in fallback mode
        const arrows: Record<Direction, string> = { north: '^', south: 'v', east: '>', west: '<' };
        const arrow = new ex.Actor({
          pos: ex.vec(pos.x, pos.y),
          z: 1,
        });
        arrow.graphics.use(
          new ex.Text({
            text: arrows[direction],
            font: this.fontCache.getFont(20, ex.Color.White),
          })
        );
        this.scene.add(arrow);
        this.roomActors.push(arrow);
      }
      
      (door as any).doorDirection = direction;
      (door as any).targetRoomId = targetRoomId;

      this.scene.add(door);
      this.roomActors.push(door);
    }
  }
  
  /**
   * Draw content actors for the current room
   */
  private drawContents(room: DungeonRoom): void {
    const { width, height, offsetX, offsetY } = ROOM_CONFIG;

    for (const content of room.contents) {
      // Skip triggered content (except NPCs)
      if (content.triggered && content.type !== 'npc') {
        if (content.type === 'exit') {
          const exitData = content.data as ExitContentData;
          if (exitData?.requiresBossDefeated && exitData?.bossDefeated) {
            // Continue to draw
          } else {
            continue;
          }
        } else {
          continue;
        }
      }

      // Secrets hidden until discovered
      if (content.type === 'secret') {
        const secretData = content.data as SecretContentData;
        if (!secretData?.discovered) continue;
      }

      // Traps invisible until triggered
      if (content.type === 'trap' && !content.triggered) continue;

      // Check boss defeat for exit
      if (content.type === 'exit') {
        const exitData = content.data as ExitContentData;
        if (exitData?.requiresBossDefeated && !exitData?.bossDefeated) {
          const bossEnemies = room.contents.filter((c) => {
            if (c.type !== 'enemy') return false;
            const enemyData = c.data as EnemyContentData;
            return enemyData?.isBoss;
          });
          const allBossDefeated = bossEnemies.every((c) => c.triggered);
          if (!allBossDefeated) continue;
          (exitData as ExitContentData).bossDefeated = true;
        }
      }

      const x = offsetX + content.x * width;
      const y = offsetY + content.y * height;

      this.createContentActor(content, x, y);
    }
  }
  
  /**
   * Create an actor for room content
   */
  private async createContentActor(content: RoomContent, x: number, y: number): Promise<void> {
    const size = content.type === 'puzzle' || content.type === 'secret' ? 16 : 12;
    const color = CONTENT_COLORS[content.type] || '#ffffff';

    const actor = new ex.Actor({
      pos: ex.vec(x, y),
      width: size * 2,
      height: size * 2,
      z: 5,
    });

    // Try to load actual sprite
    let spriteLoaded = false;
    if (content.type === 'enemy') {
      spriteLoaded = await this.loadEnemySprite(actor, content);
    } else if (content.type === 'npc') {
      spriteLoaded = await this.loadNPCSprite(actor, content);
    }

    // Fallback to colored circle if sprite not loaded
    if (!spriteLoaded) {
      actor.graphics.use(new ex.Circle({ radius: size, color: ex.Color.fromHex(color) }));
    }

    (actor as any).contentId = content.id;
    (actor as any).contentType = content.type;

    // Add wandering behavior for enemies
    if (content.type === 'enemy') {
      this.addWanderBehavior(actor, x, y);
    }

    this.scene.add(actor);
    this.roomActors.push(actor);
    this.contentActors.set(content.id, actor);

    // Icon (only show if sprite wasn't loaded)
    const icon = CONTENT_ICONS[content.type];
    if (icon && !spriteLoaded) {
      const iconActor = new ex.Actor({
        pos: ex.vec(x, y),
        z: 6,
      });
      iconActor.graphics.use(
        new ex.Text({
          text: icon,
          font: this.fontCache.getFont(14, ex.Color.White),
        })
      );
      this.scene.add(iconActor);
      this.roomActors.push(iconActor);
    }
  }
  
  /**
   * Load enemy sprite for a content actor
   */
  private async loadEnemySprite(actor: ex.Actor, content: RoomContent): Promise<boolean> {
    let enemyId: string | undefined;
    if (typeof content.data === 'string') {
      enemyId = content.data;
    } else {
      const enemyData = content.data as EnemyContentData;
      enemyId = enemyData?.enemyType || enemyData?.enemyId;
    }
    const enemyDef = enemyId ? ENEMIES[enemyId] : null;

    if (!enemyDef) return false;

    const targetSize = 24;

    if (enemyDef.spriteFolder) {
      const slimeColor = getSlimeColorFromFolder(enemyDef.spriteFolder);
      if (slimeColor) {
        const idleAnim = await loadSlimeAnimation(slimeColor, 'idle');
        if (idleAnim) {
          const scale = targetSize / 32;
          idleAnim.scale = ex.vec(scale, scale);
          actor.graphics.use(idleAnim);
          return true;
        }
      }
    } else if (enemyDef.spriteFile) {
      const staticId = getStaticEnemyIdFromFile(enemyDef.spriteFile);
      if (staticId) {
        const sprite = await loadStaticEnemySprite(staticId);
        if (sprite) {
          const scale = targetSize / Math.max(sprite.width, sprite.height);
          sprite.scale = ex.vec(scale, scale);
          actor.graphics.use(sprite);
          return true;
        }
      }
    }

    return false;
  }
  
  /**
   * Load NPC sprite for a content actor
   */
  private async loadNPCSprite(actor: ex.Actor, content: RoomContent): Promise<boolean> {
    const npcData = content.data as NPCContentData;
    const npcType = npcData?.npcType;
    if (npcType === 'merchant') {
      const sprite = await loadNPCSprite('shopkeeper');
      if (sprite) {
        const targetSize = 32;
        const scale = targetSize / Math.max(sprite.width, sprite.height);
        sprite.scale = ex.vec(scale, scale);
        actor.graphics.use(sprite);
        return true;
      }
    }
    return false;
  }
  
  /**
   * Add wandering behavior to an enemy actor
   */
  private addWanderBehavior(actor: ex.Actor, originX: number, originY: number): void {
    const wanderRadius = 30;
    const moveSpeed = 20;
    const pauseMin = 1000;
    const pauseMax = 3000;

    (actor as any).originX = originX;
    (actor as any).originY = originY;

    const pickNewTarget = () => {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * wanderRadius;

      const bounds = this.getMovementBounds();
      let targetX = originX + Math.cos(angle) * distance;
      let targetY = originY + Math.sin(angle) * distance;

      targetX = Math.max(bounds.minX, Math.min(bounds.maxX, targetX));
      targetY = Math.max(bounds.minY, Math.min(bounds.maxY, targetY));

      actor.actions.moveTo(ex.vec(targetX, targetY), moveSpeed).callMethod(() => {
        const pauseDuration = pauseMin + Math.random() * (pauseMax - pauseMin);
        this.config.scheduledTimeout(() => {
          if (!actor.isKilled()) {
            pickNewTarget();
          }
        }, pauseDuration);
      });
    };

    const initialDelay = Math.random() * 2000;
    this.config.scheduledTimeout(() => {
      if (!actor.isKilled()) {
        pickNewTarget();
      }
    }, initialDelay);
  }
  
  /**
   * Get door positions based on tilemap or fallback
   */
  getDoorPositions(): Record<Direction, { x: number; y: number }> {
    if (this.currentRoomData) {
      const loader = getDungeonRoomLoader();
      const tilemapDoors = loader.getScaledDoorPositions(
        this.currentRoomData,
        this.currentTilemapOffsetX,
        this.currentTilemapOffsetY,
        this.currentTilemapScale
      );

      return {
        north: tilemapDoors.north ? { x: tilemapDoors.north.x, y: tilemapDoors.north.y } : this.getDefaultDoorPosition('north'),
        south: tilemapDoors.south ? { x: tilemapDoors.south.x, y: tilemapDoors.south.y } : this.getDefaultDoorPosition('south'),
        east: tilemapDoors.east ? { x: tilemapDoors.east.x, y: tilemapDoors.east.y } : this.getDefaultDoorPosition('east'),
        west: tilemapDoors.west ? { x: tilemapDoors.west.x, y: tilemapDoors.west.y } : this.getDefaultDoorPosition('west'),
      };
    }

    return {
      north: this.getDefaultDoorPosition('north'),
      south: this.getDefaultDoorPosition('south'),
      east: this.getDefaultDoorPosition('east'),
      west: this.getDefaultDoorPosition('west'),
    };
  }
  
  /**
   * Get default door position for a direction
   */
  private getDefaultDoorPosition(direction: Direction): { x: number; y: number } {
    const { width, height, offsetX, offsetY, doorSize } = ROOM_CONFIG;
    switch (direction) {
      case 'north': return { x: offsetX + width / 2, y: offsetY + doorSize / 2 };
      case 'south': return { x: offsetX + width / 2, y: offsetY + height - doorSize / 2 };
      case 'east': return { x: offsetX + width - doorSize / 2, y: offsetY + height / 2 };
      case 'west': return { x: offsetX + doorSize / 2, y: offsetY + height / 2 };
    }
  }
  
  /**
   * Get movement bounds for the current room
   */
  getMovementBounds() {
    if (this.currentRoomData) {
      const loader = getDungeonRoomLoader();
      const colliders = loader.getScaledColliders(
        this.currentRoomData,
        this.currentTilemapOffsetX,
        this.currentTilemapOffsetY,
        this.currentTilemapScale
      );

      if (colliders.length > 0) {
        const tilemapDims = loader.getRoomDimensions(this.currentTilemapScale);
        const roomRight = this.currentTilemapOffsetX + tilemapDims.width;
        const roomBottom = this.currentTilemapOffsetY + tilemapDims.height;

        let leftWall = this.currentTilemapOffsetX;
        let rightWall = roomRight;
        let topWall = this.currentTilemapOffsetY;
        let bottomWall = roomBottom;

        for (const collider of colliders) {
          if (collider.x <= this.currentTilemapOffsetX + 2 && collider.height > tilemapDims.height * 0.5) {
            leftWall = Math.max(leftWall, collider.x + collider.width);
          }
          if (collider.x + collider.width >= roomRight - 2 && collider.height > tilemapDims.height * 0.5) {
            rightWall = Math.min(rightWall, collider.x);
          }
          if (collider.y <= this.currentTilemapOffsetY + 2 && collider.width > tilemapDims.width * 0.5) {
            topWall = Math.max(topWall, collider.y + collider.height);
          }
          if (collider.y + collider.height >= roomBottom - 2 && collider.width > tilemapDims.width * 0.5) {
            bottomWall = Math.min(bottomWall, collider.y);
          }
        }

        const margin = 8 * this.currentTilemapScale;
        return {
          minX: leftWall + margin,
          maxX: rightWall - margin,
          minY: topWall + margin,
          maxY: bottomWall - margin,
        };
      }
    }

    // Fallback to default bounds
    const { width, height, offsetX, offsetY } = ROOM_CONFIG;
    const margin = 16;
    return {
      minX: offsetX + margin,
      maxX: offsetX + width - margin,
      minY: offsetY + margin,
      maxY: offsetY + height - margin,
    };
  }
  
  /**
   * Reveal hidden traps and secrets when player gets close
   */
  revealNearbyHiddenContent(room: DungeonRoom, playerPos: ex.Vector): void {
    const { width, height, offsetX, offsetY } = ROOM_CONFIG;
    const revealDistance = 40;

    for (const content of room.contents) {
      if (content.triggered) continue;

      const x = offsetX + content.x * width;
      const y = offsetY + content.y * height;
      const dist = playerPos.distance(ex.vec(x, y));
      const contentId = `reveal_${content.id}`;

      if (content.type === 'trap' && dist < revealDistance) {
        if (!this.contentActors.has(contentId)) {
          const revealActor = new ex.Actor({
            pos: ex.vec(x, y),
            width: 16,
            height: 16,
            z: 4,
          });
          revealActor.graphics.use(
            new ex.Circle({
              radius: 8,
              color: ex.Color.fromRGB(255, 80, 80, 0.4),
              strokeColor: ex.Color.fromRGB(255, 60, 60, 0.6),
              lineWidth: 2,
            })
          );
          this.scene.add(revealActor);
          this.contentActors.set(contentId, revealActor);
        }
      } else if (content.type === 'secret') {
        const secretData = content.data as SecretContentData;
        if (!secretData?.discovered && dist < revealDistance) {
          if (!this.contentActors.has(contentId)) {
            const revealActor = new ex.Actor({
              pos: ex.vec(x, y),
              width: 16,
              height: 16,
              z: 4,
            });
            revealActor.graphics.use(
              new ex.Circle({
                radius: 10,
                color: ex.Color.fromRGB(255, 220, 100, 0.3),
                strokeColor: ex.Color.fromRGB(255, 200, 50, 0.5),
                lineWidth: 2,
              })
            );
            this.scene.add(revealActor);
            this.contentActors.set(contentId, revealActor);
          }
        }
      } else if (dist >= revealDistance && this.contentActors.has(contentId)) {
        const actor = this.contentActors.get(contentId);
        actor?.kill();
        this.contentActors.delete(contentId);
      }
    }
  }
  
  /**
   * Clear room actors
   */
  private clearRoomActors(): void {
    for (const actor of this.roomActors) {
      actor.kill();
    }
    this.roomActors = [];
    
    // Clear all content actors including reveal indicators
    for (const [, actor] of this.contentActors) {
      actor.kill();
    }
    this.contentActors.clear();
  }
  
  /**
   * Clear only reveal indicator actors (traps/secrets)
   * Called when changing rooms/floors to ensure indicators don't persist
   */
  clearRevealIndicators(): void {
    const toRemove: string[] = [];
    for (const [key, actor] of this.contentActors) {
      if (key.startsWith('reveal_')) {
        actor.kill();
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      this.contentActors.delete(key);
    }
  }
  
  /**
   * Get entry position from a direction
   */
  getEntryPosition(fromDirection?: Direction): { x: number; y: number } {
    const { width, height, offsetX, offsetY } = ROOM_CONFIG;
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
  
  /**
   * Check if tilemap is loaded
   */
  hasTilemap(): boolean {
    return this.currentRoomData !== null;
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    this.clearRoomActors();
  }
}
