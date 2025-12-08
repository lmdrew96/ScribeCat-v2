/**
 * KAPLAY Game Engine Initialization
 *
 * Central initialization for KAPLAY game instances.
 * Supports multiple independent game contexts for different UI components.
 */

import kaplay, { KAPLAYCtx } from 'kaplay';

// Store references to game instances by canvas ID
const gameInstances = new Map<string, KAPLAYCtx>();

export interface GameConfig {
  canvas: HTMLCanvasElement;
  width?: number;
  height?: number;
  scale?: number;
  background?: [number, number, number];
  debug?: boolean;
}

/**
 * Initialize a KAPLAY game instance on a canvas
 */
export function initGame(config: GameConfig): KAPLAYCtx {
  const {
    canvas,
    width = 480,
    height = 270,
    scale = 2,
    background = [26, 26, 46], // #1a1a2e
    debug = false,
  } = config;

  const k = kaplay({
    canvas,
    width,
    height,
    scale,
    crisp: true, // Pixel-perfect rendering
    background,
    debug,
    global: false, // Don't pollute global scope
  });

  // Store reference by canvas ID if available
  if (canvas.id) {
    gameInstances.set(canvas.id, k);
  }

  return k;
}

/**
 * Get a game instance by canvas ID
 */
export function getGameByCanvasId(canvasId: string): KAPLAYCtx | null {
  return gameInstances.get(canvasId) || null;
}

/**
 * Destroy a game instance
 */
export function destroyGame(canvasId: string): void {
  const k = gameInstances.get(canvasId);
  if (k) {
    k.quit();
    gameInstances.delete(canvasId);
  }
}

/**
 * Destroy all game instances
 */
export function destroyAllGames(): void {
  for (const [id, k] of gameInstances) {
    k.quit();
  }
  gameInstances.clear();
}

// Re-export types from kaplay for convenience
export type { KAPLAYCtx } from 'kaplay';
