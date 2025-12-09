/**
 * Effects System for StudyQuest
 *
 * Visual feedback effects for combat and interactions.
 * - Entity flash (damage, heal)
 * - Floating numbers (damage, XP, gold)
 * - Screen shake
 * - Scale pulse
 */

import type { KAPLAYCtx, GameObj, Color } from 'kaplay';

// Effect colors
export const EFFECT_COLORS = {
  damage: [239, 68, 68] as [number, number, number],    // Red
  heal: [74, 222, 128] as [number, number, number],     // Green
  xp: [250, 204, 21] as [number, number, number],       // Yellow
  gold: [251, 191, 36] as [number, number, number],     // Amber
  miss: [148, 163, 184] as [number, number, number],    // Gray
  crit: [255, 0, 128] as [number, number, number],      // Pink
};

/**
 * Flash an entity with a color overlay
 */
export function flashEntity(
  k: KAPLAYCtx,
  entity: GameObj,
  color: Color | [number, number, number],
  duration = 0.15
): void {
  const rgb = Array.isArray(color) ? k.rgb(color[0], color[1], color[2]) : color;

  // Store original color if available
  const originalColor = entity.color ? { ...entity.color } : null;

  // Apply flash color
  if (entity.color) {
    entity.color = rgb;
  }

  // Create overlay effect
  const overlay = k.add([
    k.rect(entity.width || 32, entity.height || 32),
    k.pos(entity.pos.x, entity.pos.y),
    k.anchor(entity.anchor || 'center'),
    k.color(rgb),
    k.opacity(0.5),
    k.z((entity.z || 0) + 1),
  ]);

  // Fade out and cleanup
  k.tween(0.5, 0, duration, (v) => {
    overlay.opacity = v;
  });

  k.wait(duration, () => {
    k.destroy(overlay);
    if (originalColor && entity.color) {
      entity.color = originalColor as Color;
    }
  });
}

export type FloatingNumberType = 'damage' | 'heal' | 'xp' | 'gold' | 'miss' | 'crit';

/**
 * Show a floating number that rises and fades
 */
export function showFloatingNumber(
  k: KAPLAYCtx,
  x: number,
  y: number,
  value: number | string,
  type: FloatingNumberType = 'damage'
): void {
  const colorRGB = EFFECT_COLORS[type] || EFFECT_COLORS.damage;

  // Format text based on type
  let displayText = String(value);
  if (type === 'gold') displayText = `+${value}G`;
  if (type === 'xp') displayText = `+${value}XP`;
  if (type === 'heal') displayText = `+${value}`;
  if (type === 'miss') displayText = 'MISS';
  if (type === 'crit') displayText = `${value}!`;

  const text = k.add([
    k.text(displayText, { size: type === 'crit' ? 16 : 12 }),
    k.pos(x, y),
    k.anchor('center'),
    k.color(colorRGB[0], colorRGB[1], colorRGB[2]),
    k.opacity(1),
    k.z(500),
  ]);

  // Rise and fade animation
  const startY = y;
  const endY = y - 40;
  const duration = 0.8;

  k.tween(startY, endY, duration, (v) => {
    text.pos.y = v;
  }, k.easings.easeOutQuad);

  k.tween(1, 0, duration, (v) => {
    text.opacity = v;
  });

  k.wait(duration, () => {
    k.destroy(text);
  });
}

/**
 * Pulse an entity's scale (bounce effect)
 */
export async function pulseEntity(
  k: KAPLAYCtx,
  entity: GameObj,
  maxScale = 1.2,
  duration = 0.2
): Promise<void> {
  const halfDuration = duration / 2;

  // Scale up
  await k.tween(1, maxScale, halfDuration, (v) => {
    entity.scale.x = v;
    entity.scale.y = v;
  }, k.easings.easeOutQuad);

  // Scale back
  await k.tween(maxScale, 1, halfDuration, (v) => {
    entity.scale.x = v;
    entity.scale.y = v;
  }, k.easings.easeOutQuad);
}

/**
 * Shake the camera/screen
 */
export function shakeCamera(
  k: KAPLAYCtx,
  intensity = 5,
  duration = 0.3
): void {
  const originalCamPos = k.camPos();
  const startTime = k.time();

  const shakeHandler = k.onUpdate(() => {
    const elapsed = k.time() - startTime;
    if (elapsed >= duration) {
      k.camPos(originalCamPos);
      shakeHandler.cancel();
      return;
    }

    // Decay intensity over time
    const decay = 1 - elapsed / duration;
    const currentIntensity = intensity * decay;

    // Random offset
    const offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
    const offsetY = (Math.random() - 0.5) * 2 * currentIntensity;

    k.camPos(originalCamPos.x + offsetX, originalCamPos.y + offsetY);
  });
}

/**
 * Flash the screen with a color overlay
 */
export function flashScreen(
  k: KAPLAYCtx,
  color: Color | [number, number, number] = [255, 255, 255],
  duration = 0.2
): void {
  const rgb = Array.isArray(color) ? k.rgb(color[0], color[1], color[2]) : color;

  const overlay = k.add([
    k.rect(k.width(), k.height()),
    k.pos(0, 0),
    k.color(rgb),
    k.opacity(0.5),
    k.fixed(), // Stay in screen space
    k.z(1000),
  ]);

  k.tween(0.5, 0, duration, (v) => {
    overlay.opacity = v;
  });

  k.wait(duration, () => {
    k.destroy(overlay);
  });
}

/**
 * Create hit spark particles
 */
export function spawnHitSparks(
  k: KAPLAYCtx,
  x: number,
  y: number,
  count = 5,
  color: [number, number, number] = [255, 255, 255]
): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = 50 + Math.random() * 50;
    const size = 3 + Math.random() * 3;

    const particle = k.add([
      k.rect(size, size),
      k.pos(x, y),
      k.anchor('center'),
      k.color(color[0], color[1], color[2]),
      k.opacity(1),
      k.z(400),
    ]);

    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const lifetime = 0.3 + Math.random() * 0.2;

    const startTime = k.time();
    const handler = k.onUpdate(() => {
      const elapsed = k.time() - startTime;
      if (elapsed >= lifetime) {
        k.destroy(particle);
        handler.cancel();
        return;
      }

      // Move and fade
      particle.pos.x += vx * k.dt();
      particle.pos.y += vy * k.dt();
      particle.opacity = 1 - elapsed / lifetime;
    });
  }
}

/**
 * Play attack animation - lunge forward and back
 */
export async function playAttackLunge(
  k: KAPLAYCtx,
  entity: GameObj,
  targetX: number,
  lungeDistance = 30,
  duration = 0.15
): Promise<void> {
  const startX = entity.pos.x;
  const direction = targetX > startX ? 1 : -1;
  const lungeX = startX + direction * lungeDistance;

  // Lunge forward
  await k.tween(startX, lungeX, duration, (v) => {
    entity.pos.x = v;
  }, k.easings.easeOutQuad);

  // Return
  await k.tween(lungeX, startX, duration, (v) => {
    entity.pos.x = v;
  }, k.easings.easeInQuad);
}

/**
 * Play hurt animation - shake and flash red
 */
export async function playHurtEffect(
  k: KAPLAYCtx,
  entity: GameObj
): Promise<void> {
  // Flash red
  flashEntity(k, entity, EFFECT_COLORS.damage, 0.2);

  // Quick shake
  const startX = entity.pos.x;
  const shake = 3;

  for (let i = 0; i < 3; i++) {
    entity.pos.x = startX + (i % 2 === 0 ? shake : -shake);
    await k.wait(0.05);
  }
  entity.pos.x = startX;
}

/**
 * Play victory celebration
 */
export function playVictoryEffect(
  k: KAPLAYCtx,
  x: number,
  y: number
): void {
  // Spawn golden particles
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10;
    const speed = 80 + Math.random() * 40;

    const particle = k.add([
      k.rect(4, 4),
      k.pos(x, y),
      k.anchor('center'),
      k.color(251, 191, 36), // Gold
      k.opacity(1),
      k.z(400),
    ]);

    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 50; // Initial upward velocity
    const gravity = 200;
    const lifetime = 1.0;

    const startTime = k.time();
    let velocityY = vy;

    const handler = k.onUpdate(() => {
      const elapsed = k.time() - startTime;
      if (elapsed >= lifetime) {
        k.destroy(particle);
        handler.cancel();
        return;
      }

      // Physics
      velocityY += gravity * k.dt();
      particle.pos.x += vx * k.dt();
      particle.pos.y += velocityY * k.dt();
      particle.opacity = 1 - elapsed / lifetime;
    });
  }
}
