/**
 * DungeonPlayerController.ts
 * 
 * Handles player character in the dungeon: setup, animations, movement, and death.
 */

import * as ex from 'excalibur';
import { GameState } from '../../../state/GameState.js';
import { InputManager, type GameKey } from '../../adapters/InputAdapter.js';
import { loadCatAnimation } from '../../adapters/SpriteAdapter.js';
import type { CatColor } from '../../../data/catSprites.js';
import { ROOM_CONFIG, CANVAS_WIDTH, CANVAS_HEIGHT, type DungeonSceneData } from './DungeonConstants.js';

export interface MovementBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PlayerControllerConfig {
  catColor: CatColor;
  startX?: number;
  startY?: number;
  getMovementBounds: () => MovementBounds;
  showFloatingMessage: (text: string, x: number, y: number, color: string) => void;
  onDeath: () => void;
}

/**
 * Controls the player character in the dungeon scene.
 */
export class DungeonPlayerController {
  private scene: ex.Scene;
  private config: PlayerControllerConfig;
  private inputManager: InputManager | null = null;
  
  // Player state
  private player!: ex.Actor;
  private catColor: CatColor;
  private playerFrozen = false;
  private playerAnimations: Map<string, ex.Animation> = new Map();
  private currentPlayerAnim: 'idle' | 'walk' = 'idle';
  
  // Animation state tracking to prevent flickering
  private lastAnimSwitch = 0;
  private animSwitchCooldown = 100; // ms cooldown between animation switches
  
  constructor(scene: ex.Scene, config: PlayerControllerConfig) {
    this.scene = scene;
    this.config = config;
    this.catColor = config.catColor;
  }
  
  /**
   * Initialize input manager when engine is available
   */
  initInput(engine: ex.Engine): void {
    this.inputManager = new InputManager(engine);
  }
  
  /**
   * Setup the player actor with position and animations
   */
  async setup(returnFromBattle = false, savedX?: number, savedY?: number): Promise<void> {
    // Reset player state to ensure clean start
    this.playerFrozen = false;
    this.currentPlayerAnim = 'idle';
    this.lastAnimSwitch = 0;
    this.playerAnimations.clear();
    
    // Determine start position
    let startX = ROOM_CONFIG.offsetX + ROOM_CONFIG.width / 2;
    let startY = ROOM_CONFIG.offsetY + ROOM_CONFIG.height / 2;

    if (returnFromBattle && savedX !== undefined && savedY !== undefined) {
      startX = savedX;
      startY = savedY;
    }

    this.player = new ex.Actor({
      pos: ex.vec(startX, startY),
      width: 24,
      height: 24,
      z: 10,
    });

    // Load cat animations (idle + walk)
    try {
      const idleAnim = await loadCatAnimation(this.catColor, 'idle');
      const walkAnim = await loadCatAnimation(this.catColor, 'walk');
      if (idleAnim) {
        this.playerAnimations.set('idle', idleAnim);
        this.player.graphics.use(idleAnim);
      }
      if (walkAnim) {
        this.playerAnimations.set('walk', walkAnim);
      }
      this.currentPlayerAnim = 'idle';
    } catch {
      // Fallback to colored rectangle
      this.player.graphics.use(
        new ex.Rectangle({
          width: 24,
          height: 24,
          color: ex.Color.fromHex('#4ade80'),
        })
      );
    }

    this.scene.add(this.player);
  }
  
  /**
   * Update player movement based on input
   */
  update(delta: number): void {
    if (this.playerFrozen) return;

    const speed = 150;
    let dx = 0;
    let dy = 0;

    // Arrow keys
    if (this.inputManager?.isKeyHeld('left')) dx -= 1;
    if (this.inputManager?.isKeyHeld('right')) dx += 1;
    if (this.inputManager?.isKeyHeld('up')) dy -= 1;
    if (this.inputManager?.isKeyHeld('down')) dy += 1;
    
    // WASD keys (like town)
    if (this.inputManager?.isKeyHeld('a')) dx -= 1;
    if (this.inputManager?.isKeyHeld('d')) dx += 1;
    if (this.inputManager?.isKeyHeld('w')) dy -= 1;
    if (this.inputManager?.isKeyHeld('s')) dy += 1;

    const isMoving = dx !== 0 || dy !== 0;

    if (isMoving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;

      const newX = this.player.pos.x + dx * speed * (delta / 1000);
      const newY = this.player.pos.y + dy * speed * (delta / 1000);

      const bounds = this.config.getMovementBounds();
      this.player.pos.x = Math.max(bounds.minX, Math.min(bounds.maxX, newX));
      this.player.pos.y = Math.max(bounds.minY, Math.min(bounds.maxY, newY));

      // Flip sprite based on horizontal direction
      if (dx < 0) {
        this.player.graphics.flipHorizontal = true;
      } else if (dx > 0) {
        this.player.graphics.flipHorizontal = false;
      }
    }

    // Switch animation based on movement state (with debounce to prevent flickering)
    const targetAnim = isMoving ? 'walk' : 'idle';
    const now = Date.now();
    if (targetAnim !== this.currentPlayerAnim && 
        this.playerAnimations.has(targetAnim) &&
        now - this.lastAnimSwitch > this.animSwitchCooldown) {
      this.currentPlayerAnim = targetAnim;
      this.lastAnimSwitch = now;
      const anim = this.playerAnimations.get(targetAnim)!;
      // Reset animation to first frame before switching to prevent flicker
      anim.reset();
      this.player.graphics.use(anim);
    }
  }
  
  /**
   * Handle player death - show message and trigger callback
   */
  handleDeath(scheduledTimeout: (cb: () => void, delay: number) => void): void {
    this.playerFrozen = true;

    // Show death message
    this.config.showFloatingMessage(
      'You were defeated!', 
      CANVAS_WIDTH / 2, 
      CANVAS_HEIGHT / 2 - 20, 
      '#ff6464'
    );
    this.config.showFloatingMessage(
      'Returning to town...', 
      CANVAS_WIDTH / 2, 
      CANVAS_HEIGHT / 2 + 10, 
      '#ffff64'
    );

    // Clear dungeon state and return to town after delay
    scheduledTimeout(() => {
      GameState.dungeon.floor = null;
      GameState.dungeon.currentRoomId = '';
      GameState.dungeon.floorNumber = 1;
      GameState.dungeon.dungeonId = null;

      // Restore some HP so player isn't stuck at 0
      GameState.player.health = Math.floor(GameState.getEffectiveMaxHealth() * 0.25);

      this.config.onDeath();
    }, 2500);
  }
  
  /**
   * Get the player actor
   */
  getActor(): ex.Actor {
    return this.player;
  }
  
  /**
   * Get current player position
   */
  getPosition(): ex.Vector {
    return this.player.pos.clone();
  }
  
  /**
   * Set player position
   */
  setPosition(x: number, y: number): void {
    this.player.pos = ex.vec(x, y);
  }
  
  /**
   * Check if player is frozen
   */
  isFrozen(): boolean {
    return this.playerFrozen;
  }
  
  /**
   * Freeze or unfreeze the player
   */
  setFrozen(frozen: boolean): void {
    this.playerFrozen = frozen;
  }
  
  /**
   * Get current cat color
   */
  getCatColor(): CatColor {
    return this.catColor;
  }
  
  /**
   * Check if a key was just pressed (for interactions)
   */
  wasKeyPressed(key: GameKey): boolean {
    return this.inputManager?.wasKeyPressed(key) ?? false;
  }
  
  /**
   * Build scene data for scene transitions
   */
  buildSceneData(dungeonId: string, floorNumber: number): DungeonSceneData {
    return {
      catColor: this.catColor,
      dungeonId,
      floorNumber,
      floor: GameState.dungeon.floor!,
      currentRoomId: GameState.dungeon.currentRoomId,
      returnFromBattle: true,
      playerX: this.player.pos.x,
      playerY: this.player.pos.y,
    };
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    this.inputManager?.destroy();
    this.inputManager = null;
    
    if (this.player) {
      this.player.kill();
    }
  }
}
