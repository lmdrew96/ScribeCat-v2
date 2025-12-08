/**
 * Visual Effects
 *
 * Entity and UI visual effects for KAPLAY.
 */

import type { KAPLAYCtx, GameObj, Color } from 'kaplay';

/**
 * Flash an entity with a color (for damage, heal, etc.)
 * @param k - KAPLAY context
 * @param entity - The game object to flash
 * @param color - Flash color (default: red for damage)
 * @param duration - Flash duration in seconds (default: 0.1)
 */
export function flashEntity(k: KAPLAYCtx, entity: GameObj, color?: Color, duration = 0.1): void {
  const flashColor = color || k.rgb(255, 100, 100);
  const originalColor = entity.color;

  entity.color = flashColor;
  k.wait(duration, () => {
    if (entity.exists()) {
      entity.color = originalColor;
    }
  });
}

/**
 * Show floating damage/heal number
 * @param k - KAPLAY context
 * @param x - X position
 * @param y - Y position
 * @param amount - Number to display
 * @param type - 'damage' (red) or 'heal' (green) or 'xp' (yellow) or 'gold' (amber)
 */
export function showFloatingNumber(
  k: KAPLAYCtx,
  x: number,
  y: number,
  amount: number,
  type: 'damage' | 'heal' | 'xp' | 'gold' = 'damage'
): void {
  const colors = {
    damage: k.rgb(239, 68, 68),
    heal: k.rgb(74, 222, 128),
    xp: k.rgb(250, 204, 21),
    gold: k.rgb(251, 191, 36),
  };

  const prefixes = {
    damage: '-',
    heal: '+',
    xp: '+',
    gold: '+',
  };

  const text = k.add([
    k.text(`${prefixes[type]}${amount}`, { size: 14 }),
    k.pos(x, y),
    k.anchor('center'),
    k.color(colors[type]),
    k.opacity(1),
    k.z(100),
  ]);

  // Float up and fade out
  k.tween(y, y - 30, 0.8, (val) => {
    text.pos.y = val;
  }, k.easings.easeOutQuad);

  k.tween(1, 0, 0.8, (val) => {
    text.opacity = val;
  }, k.easings.easeInQuad).then(() => {
    k.destroy(text);
  });
}

/**
 * Pulse an entity (scale up then back)
 * @param k - KAPLAY context
 * @param entity - The game object to pulse
 * @param scale - Maximum scale (default: 1.2)
 * @param duration - Total duration in seconds (default: 0.2)
 */
export async function pulseEntity(k: KAPLAYCtx, entity: GameObj, scale = 1.2, duration = 0.2): Promise<void> {
  const originalScale = entity.scale.x;
  const halfDuration = duration / 2;

  // Scale up
  await k.tween(originalScale, scale, halfDuration, (val) => {
    entity.scale = k.vec2(val, val);
  }, k.easings.easeOutQuad);

  // Scale back
  await k.tween(scale, originalScale, halfDuration, (val) => {
    entity.scale = k.vec2(val, val);
  }, k.easings.easeInQuad);
}

/**
 * Spawn particles at a position
 * @param k - KAPLAY context
 * @param x - X position
 * @param y - Y position
 * @param count - Number of particles
 * @param color - Particle color
 */
export function spawnParticles(
  k: KAPLAYCtx,
  x: number,
  y: number,
  count = 5,
  color?: Color
): void {
  const particleColor = color || k.rgb(255, 255, 255);

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 50 + Math.random() * 50;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const particle = k.add([
      k.circle(3),
      k.pos(x, y),
      k.color(particleColor),
      k.opacity(1),
      k.z(50),
    ]);

    // Move and fade
    const duration = 0.3 + Math.random() * 0.2;

    k.tween(1, 0, duration, (val) => {
      particle.opacity = val;
      particle.pos.x += vx * k.dt();
      particle.pos.y += vy * k.dt();
    }).then(() => {
      k.destroy(particle);
    });
  }
}

/**
 * Screen shake wrapper that combines camera shake with visual feedback
 */
export function impactEffect(k: KAPLAYCtx, intensity: 'light' | 'medium' | 'heavy' = 'medium'): void {
  const settings = {
    light: { shake: 3, flash: 0.1 },
    medium: { shake: 5, flash: 0.15 },
    heavy: { shake: 8, flash: 0.2 },
  };

  const { shake, flash } = settings[intensity];

  // Import dynamically to avoid circular dependency
  import('../systems/camera.js').then(({ shakeCamera, flashScreen }) => {
    shakeCamera(k, shake, 0.15);
    flashScreen(k, k.rgb(255, 255, 255), flash);
  });
}
