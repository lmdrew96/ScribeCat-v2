/**
 * Day/Night Cycle System
 *
 * Handles time-of-day based lighting overlays.
 */

import type { KAPLAYCtx } from 'kaplay';

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

export interface DayNightOverlay {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

const TIME_OVERLAYS: Record<TimeOfDay, DayNightOverlay | null> = {
  dawn: { r: 255, g: 153, b: 102, alpha: 0.15 },
  day: null,
  dusk: { r: 255, g: 102, b: 51, alpha: 0.2 },
  night: { r: 0, g: 17, b: 51, alpha: 0.4 },
};

/**
 * Get the current time of day based on real time
 */
export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 18) return 'day';
  if (hour >= 18 && hour < 21) return 'dusk';
  return 'night';
}

/**
 * Get overlay color for a time of day
 */
export function getTimeOverlay(timeOfDay: TimeOfDay): DayNightOverlay | null {
  return TIME_OVERLAYS[timeOfDay];
}

/**
 * Create a day/night cycle system
 */
export function createDayNightSystem(k: KAPLAYCtx, updateIntervalSeconds = 60) {
  let currentTime = getTimeOfDay();
  let cancelLoop: (() => void) | null = null;

  // Start update loop
  cancelLoop = k.loop(updateIntervalSeconds, () => {
    currentTime = getTimeOfDay();
  });

  return {
    get current() {
      return currentTime;
    },

    get overlay() {
      return getTimeOverlay(currentTime);
    },

    /**
     * Force a specific time (for testing/effects)
     */
    setTime(time: TimeOfDay) {
      currentTime = time;
    },

    /**
     * Draw the time overlay (call in onDraw)
     */
    draw() {
      const overlay = getTimeOverlay(currentTime);
      if (overlay) {
        k.drawRect({
          pos: k.vec2(0, 0),
          width: k.width(),
          height: k.height(),
          color: k.rgb(overlay.r, overlay.g, overlay.b),
          opacity: overlay.alpha,
          fixed: true,
        });
      }
    },

    destroy() {
      if (cancelLoop) {
        cancelLoop();
      }
    },
  };
}
