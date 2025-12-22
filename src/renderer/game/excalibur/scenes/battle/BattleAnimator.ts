/**
 * BattleAnimator
 *
 * Handles all battle animation effects including movement, hit effects,
 * magic effects, and character animation playback.
 */

import * as ex from 'excalibur';

export interface BattleAnimatorConfig {
  playerSize: number;
  enemySize: number;
  shakeDuration: number;
  shakeIntensity: number;
}

/**
 * Utility class for battle animations
 */
export class BattleAnimator {
  private config: BattleAnimatorConfig;
  private playerAnimations: Map<string, ex.Animation> = new Map();
  private enemyAnimations: Map<string, ex.Animation> = new Map();
  private enemyIsAnimated = false;

  // Entity references
  private playerEntity: ex.Actor | null = null;
  private enemyEntity: ex.Actor | null = null;

  constructor(config: BattleAnimatorConfig) {
    this.config = config;
  }

  /**
   * Set the player entity and its animations
   */
  setPlayer(entity: ex.Actor, animations: Map<string, ex.Animation>): void {
    this.playerEntity = entity;
    this.playerAnimations = animations;
  }

  /**
   * Set the enemy entity and its animations
   */
  setEnemy(entity: ex.Actor, animations: Map<string, ex.Animation>, isAnimated: boolean): void {
    this.enemyEntity = entity;
    this.enemyAnimations = animations;
    this.enemyIsAnimated = isAnimated;
  }

  /**
   * Check if enemy has animations
   */
  get isEnemyAnimated(): boolean {
    return this.enemyIsAnimated;
  }

  /**
   * Clear all references
   */
  clear(): void {
    this.playerEntity = null;
    this.enemyEntity = null;
    this.playerAnimations.clear();
    this.enemyAnimations.clear();
    this.enemyIsAnimated = false;
  }

  /**
   * Animate an actor moving to a target position with easing
   */
  animateMove(actor: ex.Actor, target: ex.Vector, duration: number): Promise<void> {
    return new Promise(resolve => {
      const startPos = actor.pos.clone();
      const startTime = Date.now();

      const updatePos = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        // Ease out quad for smooth deceleration
        const eased = 1 - (1 - t) * (1 - t);

        actor.pos = new ex.Vector(
          startPos.x + (target.x - startPos.x) * eased,
          startPos.y + (target.y - startPos.y) * eased
        );

        if (t < 1) {
          requestAnimationFrame(updatePos);
        } else {
          actor.pos = target.clone();
          resolve();
        }
      };

      requestAnimationFrame(updatePos);
    });
  }

  /**
   * Play hit effect - flash and shake
   */
  async playHitEffect(actor: ex.Actor, type: 'player' | 'enemy'): Promise<void> {
    const origGraphic = actor.graphics.current;
    const origPos = actor.pos.clone();
    const size = type === 'player' ? this.config.playerSize : this.config.enemySize;
    const flashColor = type === 'player' ? ex.Color.Red : ex.Color.White;

    // For player, use hurt animation if available
    if (type === 'player' && this.playerAnimations.has('hurt')) {
      await this.playPlayerAnimation('hurt');
    } else if (type === 'enemy' && this.enemyIsAnimated && this.enemyAnimations.has('hurt')) {
      // Use enemy hurt animation if available
      await this.playEnemyAnimation('hurt');
    } else {
      // Flash for static enemies or fallback
      actor.graphics.use(new ex.Rectangle({ width: size, height: size, color: flashColor }));
    }

    // Shake
    await this.shakeActor(actor, origPos, this.config.shakeDuration, this.config.shakeIntensity);

    // Restore original graphic (return to idle for player/enemy)
    if (type === 'player') {
      this.playPlayerAnimation('idle', false);
    } else if (type === 'enemy' && this.enemyIsAnimated) {
      this.playEnemyAnimation('idle', false);
    } else if (origGraphic) {
      actor.graphics.use(origGraphic);
    }
  }

  /**
   * Shake an actor at a position
   */
  private shakeActor(
    actor: ex.Actor,
    origPos: ex.Vector,
    shakeDuration: number,
    intensity: number
  ): Promise<void> {
    const shakeStart = Date.now();

    return new Promise<void>(resolve => {
      const shake = () => {
        const elapsed = Date.now() - shakeStart;
        if (elapsed < shakeDuration) {
          const decay = 1 - elapsed / shakeDuration;
          const offsetX = (Math.random() - 0.5) * intensity * decay * 2;
          const offsetY = (Math.random() - 0.5) * intensity * decay * 2;
          actor.pos = new ex.Vector(origPos.x + offsetX, origPos.y + offsetY);
          requestAnimationFrame(shake);
        } else {
          actor.pos = origPos.clone();
          resolve();
        }
      };
      requestAnimationFrame(shake);
    });
  }

  /**
   * Play magic cast effect - scale pulse and flash
   */
  async playMagicCastEffect(actor: ex.Actor): Promise<void> {
    const origGraphic = actor.graphics.current;

    // Quick scale pulse
    const pulseStart = Date.now();
    const pulseDuration = 300;

    await new Promise<void>(resolve => {
      const pulse = () => {
        const elapsed = Date.now() - pulseStart;
        if (elapsed < pulseDuration) {
          const t = elapsed / pulseDuration;
          const scale = 1 + Math.sin(t * Math.PI) * 0.15;
          actor.scale = new ex.Vector(scale, scale);
          requestAnimationFrame(pulse);
        } else {
          actor.scale = new ex.Vector(1, 1);
          resolve();
        }
      };
      requestAnimationFrame(pulse);
    });

    // Flash blue/purple for magic
    actor.graphics.use(
      new ex.Rectangle({
        width: this.config.playerSize,
        height: this.config.playerSize,
        color: ex.Color.fromHex('#9966FF'),
      })
    );
    await this.delay(150);
    if (origGraphic) actor.graphics.use(origGraphic);
  }

  /**
   * Play magic hit effect on target - multi-flash with shake
   */
  async playMagicHitEffect(actor: ex.Actor): Promise<void> {
    const origGraphic = actor.graphics.current;
    const origPos = actor.pos.clone();

    // Multi-flash with purple/blue
    const colors = [
      ex.Color.fromHex('#9966FF'),
      ex.Color.fromHex('#6699FF'),
      ex.Color.fromHex('#9966FF'),
    ];

    for (const color of colors) {
      actor.graphics.use(
        new ex.Rectangle({
          width: this.config.enemySize,
          height: this.config.enemySize,
          color,
        })
      );
      await this.delay(80);
    }

    // Shake
    await this.shakeActor(actor, origPos, 200, 6);

    if (origGraphic) actor.graphics.use(origGraphic);
  }

  /**
   * Play defend effect - brief defensive glow
   */
  async playDefendEffect(actor: ex.Actor): Promise<void> {
    const origGraphic = actor.graphics.current;

    // Brief defensive color flash
    actor.graphics.use(
      new ex.Rectangle({
        width: this.config.playerSize,
        height: this.config.playerSize,
        color: ex.Color.fromHex('#66CCFF'),
      })
    );
    await this.delay(200);
    if (origGraphic) actor.graphics.use(origGraphic);
  }

  /**
   * Play a player animation by type
   * @param animType - Type of animation ('idle', 'attack', 'hurt', 'die')
   * @param wait - Whether to wait for the animation to complete (default: true)
   */
  async playPlayerAnimation(animType: string, wait = true): Promise<void> {
    if (!this.playerEntity) return;

    const anim = this.playerAnimations.get(animType);
    if (!anim) return;

    // Reset animation to start from beginning
    anim.reset();
    this.playerEntity.graphics.use(anim);

    if (wait) {
      // Wait for animation duration (estimate based on frames)
      // Non-looping animations like attack/hurt/die should complete
      const frameCount = anim.frames.length;
      const duration = frameCount * (1000 / 12); // Assuming ~12 FPS
      await this.delay(Math.min(duration, 500)); // Cap at 500ms
    }
  }

  /**
   * Play an enemy animation by type (for animated enemies like slimes)
   * @param animType - Type of animation ('idle', 'attack', 'hurt', 'death1')
   * @param wait - Whether to wait for the animation to complete (default: true)
   */
  async playEnemyAnimation(animType: string, wait = true): Promise<void> {
    if (!this.enemyEntity || !this.enemyIsAnimated) return;

    const anim = this.enemyAnimations.get(animType);
    if (!anim) return;

    // Reset animation to start from beginning
    anim.reset();
    this.enemyEntity.graphics.use(anim);

    if (wait) {
      // Wait for animation duration (estimate based on frames)
      const frameCount = anim.frames.length;
      const duration = frameCount * (1000 / 8); // Slimes use ~8 FPS
      await this.delay(Math.min(duration, 600)); // Cap at 600ms
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
