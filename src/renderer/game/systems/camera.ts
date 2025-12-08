/**
 * Camera System
 *
 * Camera effects and utilities for KAPLAY.
 */

import type { KAPLAYCtx } from 'kaplay';

/**
 * Shake the camera for impact effects
 * @param k - KAPLAY context
 * @param intensity - Maximum shake offset in pixels (default: 5)
 * @param duration - Duration in seconds (default: 0.2)
 */
export function shakeCamera(k: KAPLAYCtx, intensity = 5, duration = 0.2): void {
  const originalPos = k.camPos();
  let elapsed = 0;

  const cancel = k.onUpdate(() => {
    elapsed += k.dt();
    if (elapsed >= duration) {
      k.camPos(originalPos);
      cancel();
      return;
    }

    const decay = 1 - elapsed / duration;
    const offsetX = (Math.random() - 0.5) * intensity * decay * 2;
    const offsetY = (Math.random() - 0.5) * intensity * decay * 2;
    k.camPos(originalPos.add(k.vec2(offsetX, offsetY)));
  });
}

/**
 * Flash the screen with a color
 * @param k - KAPLAY context
 * @param color - RGB color (default: white)
 * @param duration - Duration in seconds (default: 0.1)
 */
export function flashScreen(k: KAPLAYCtx, color = k.rgb(255, 255, 255), duration = 0.1): void {
  const overlay = k.add([
    k.rect(k.width(), k.height()),
    k.pos(0, 0),
    k.color(color),
    k.opacity(0.5),
    k.z(999),
    k.fixed(),
  ]);

  k.tween(0.5, 0, duration, (val) => {
    overlay.opacity = val;
  }, k.easings.easeOutQuad).then(() => {
    k.destroy(overlay);
  });
}

/**
 * Zoom camera effect
 * @param k - KAPLAY context
 * @param targetScale - Target zoom scale
 * @param duration - Duration in seconds
 */
export async function zoomCamera(k: KAPLAYCtx, targetScale: number, duration = 0.3): Promise<void> {
  const startScale = k.camScale().x;

  await k.tween(startScale, targetScale, duration, (val) => {
    k.camScale(k.vec2(val, val));
  }, k.easings.easeOutQuad);
}
