/**
 * PlayerActor
 *
 * Reusable player character actor for Excalibur.js scenes.
 * Handles movement, animation, input, and collision bounds.
 *
 * Usage:
 * ```ts
 * const player = new PlayerActor({
 *   x: 100,
 *   y: 200,
 *   catColor: 'grey',
 *   bounds: { minX: 30, maxX: 450, minY: 100, maxY: 280 },
 * });
 * scene.add(player);
 * ```
 */

import * as ex from 'excalibur';
import { loadCatAnimation, type CatColor, type CatAnimationType } from '../adapters/SpriteAdapter.js';
import { InputManager } from '../adapters/InputAdapter.js';
import { PLAYER_SPEED } from '../../config.js';

export interface PlayerActorConfig {
  x: number;
  y: number;
  catColor: CatColor;
  /**
   * Optional movement bounds. If not provided, player can move freely.
   */
  bounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  /**
   * Optional custom collision checker function.
   * Return false to block movement to that position.
   */
  isWalkable?: (x: number, y: number) => boolean;
  /**
   * Optional custom movement speed (default: PLAYER_SPEED from config)
   */
  speed?: number;
  /**
   * Z-index for rendering order (default: 10)
   */
  z?: number;
}

/**
 * Shared PlayerActor class for all game scenes
 */
export class PlayerActor extends ex.Actor {
  private catColor: CatColor;
  private animations: Map<CatAnimationType, ex.Animation> = new Map();
  private currentAnim: CatAnimationType = 'idle';
  private inputManager: InputManager | null = null;
  private movementBounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  private isWalkable?: (x: number, y: number) => boolean;
  private speed: number;
  private frozen = false;

  constructor(config: PlayerActorConfig) {
    super({
      pos: new ex.Vector(config.x, config.y),
      width: 32,
      height: 32,
      anchor: ex.Vector.Half,
      z: config.z ?? 10,
    });
    this.catColor = config.catColor;
    this.movementBounds = config.bounds;
    this.isWalkable = config.isWalkable;
    this.speed = config.speed ?? PLAYER_SPEED;
  }

  async onInitialize(engine: ex.Engine): Promise<void> {
    this.inputManager = new InputManager(engine);

    // Load animations
    try {
      const idleAnim = await loadCatAnimation(this.catColor, 'idle');
      const walkAnim = await loadCatAnimation(this.catColor, 'walk');
      this.animations.set('idle', idleAnim);
      this.animations.set('walk', walkAnim);
      this.graphics.use(idleAnim);
    } catch (err) {
      console.warn('Failed to load cat animations, using placeholder:', err);
      this.graphics.use(
        new ex.Rectangle({
          width: 32,
          height: 32,
          color: ex.Color.fromHex('#808080'),
        })
      );
    }
  }

  onPreUpdate(engine: ex.Engine, delta: number): void {
    if (!this.inputManager || this.frozen) {
      this.vel = ex.Vector.Zero;
      return;
    }

    // Get movement input
    const movement = this.inputManager.getMovementVector();

    // Apply velocity
    this.vel = movement.scale(this.speed);

    // Calculate next position
    const nextX = this.pos.x + this.vel.x * (delta / 1000);
    const nextY = this.pos.y + this.vel.y * (delta / 1000);

    // Check custom collision function
    if (this.isWalkable) {
      // Check X movement separately from Y for smoother sliding along walls
      if (this.vel.x !== 0 && !this.isWalkable(nextX, this.pos.y)) {
        this.vel.x = 0;
      }
      if (this.vel.y !== 0 && !this.isWalkable(this.pos.x, nextY)) {
        this.vel.y = 0;
      }
      // Also check diagonal movement
      if (this.vel.x !== 0 && this.vel.y !== 0) {
        const diagX = this.pos.x + this.vel.x * (delta / 1000);
        const diagY = this.pos.y + this.vel.y * (delta / 1000);
        if (!this.isWalkable(diagX, diagY)) {
          // Try to slide along walls
          if (this.isWalkable(diagX, this.pos.y)) {
            this.vel.y = 0;
          } else if (this.isWalkable(this.pos.x, diagY)) {
            this.vel.x = 0;
          } else {
            this.vel = ex.Vector.Zero;
          }
        }
      }
    }

    // Apply movement bounds
    if (this.movementBounds) {
      const finalNextX = this.pos.x + this.vel.x * (delta / 1000);
      const finalNextY = this.pos.y + this.vel.y * (delta / 1000);
      if (finalNextX < this.movementBounds.minX || finalNextX > this.movementBounds.maxX) {
        this.vel.x = 0;
      }
      if (finalNextY < this.movementBounds.minY || finalNextY > this.movementBounds.maxY) {
        this.vel.y = 0;
      }
    }

    // Update animation based on movement
    const isMoving = movement.x !== 0 || movement.y !== 0;
    const targetAnim = isMoving ? 'walk' : 'idle';

    if (targetAnim !== this.currentAnim && this.animations.has(targetAnim)) {
      this.currentAnim = targetAnim;
      this.graphics.use(this.animations.get(targetAnim)!);
    }

    // Flip sprite based on direction
    if (movement.x < 0) {
      this.graphics.flipHorizontal = true;
    } else if (movement.x > 0) {
      this.graphics.flipHorizontal = false;
    }
  }

  /**
   * Get the input manager for this player (for scene-level key bindings)
   */
  getInputManager(): InputManager | null {
    return this.inputManager;
  }

  /**
   * Freeze player movement (for menus, dialogs, etc.)
   */
  freeze(): void {
    this.frozen = true;
    this.vel = ex.Vector.Zero;
    // Switch to idle animation when frozen
    if (this.animations.has('idle')) {
      this.currentAnim = 'idle';
      this.graphics.use(this.animations.get('idle')!);
    }
  }

  /**
   * Unfreeze player movement
   */
  unfreeze(): void {
    this.frozen = false;
  }

  /**
   * Check if player is frozen
   */
  isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * Update movement bounds dynamically
   */
  setBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }): void {
    this.movementBounds = bounds;
  }

  /**
   * Update collision checker dynamically
   */
  setWalkableChecker(checker: (x: number, y: number) => boolean): void {
    this.isWalkable = checker;
  }

  /**
   * Get current cat color
   */
  getCatColor(): CatColor {
    return this.catColor;
  }

  onPreKill(): void {
    // Clean up input manager to remove engine-level event listeners
    this.inputManager?.destroy();
    this.inputManager = null;
  }
}
