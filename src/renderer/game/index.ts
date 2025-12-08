/**
 * KAPLAY Game Engine Initialization
 *
 * Central initialization for KAPLAY game instances.
 * Uses singleton pattern - only one KAPLAY instance per canvas.
 */

import kaplay, { KAPLAYCtx } from 'kaplay';

// Store references to game instances by canvas element (WeakMap for automatic cleanup)
const gameInstancesByCanvas = new WeakMap<HTMLCanvasElement, KAPLAYCtx>();
// Also store by ID for lookup convenience
const gameInstancesById = new Map<string, KAPLAYCtx>();

export interface GameConfig {
  canvas: HTMLCanvasElement;
  width?: number;
  height?: number;
  scale?: number;
  background?: [number, number, number];
  debug?: boolean;
}

/**
 * Initialize a KAPLAY game instance on a canvas.
 * Returns existing instance if canvas already has one (singleton pattern).
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

  // Check if instance already exists for this canvas
  const existingInstance = gameInstancesByCanvas.get(canvas);
  if (existingInstance) {
    return existingInstance;
  }

  // Also check by ID if canvas has one
  if (canvas.id && gameInstancesById.has(canvas.id)) {
    const instanceById = gameInstancesById.get(canvas.id)!;
    // Store in WeakMap too for future lookups
    gameInstancesByCanvas.set(canvas, instanceById);
    return instanceById;
  }

  // Create new KAPLAY instance
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

  // Store references
  gameInstancesByCanvas.set(canvas, k);
  if (canvas.id) {
    gameInstancesById.set(canvas.id, k);
  }

  return k;
}

/**
 * Get a game instance by canvas element
 */
export function getGameByCanvas(canvas: HTMLCanvasElement): KAPLAYCtx | null {
  return gameInstancesByCanvas.get(canvas) || null;
}

/**
 * Get a game instance by canvas ID
 */
export function getGameByCanvasId(canvasId: string): KAPLAYCtx | null {
  return gameInstancesById.get(canvasId) || null;
}

/**
 * Destroy a game instance by canvas
 */
export function destroyGameByCanvas(canvas: HTMLCanvasElement): void {
  const k = gameInstancesByCanvas.get(canvas);
  if (k) {
    k.quit();
    gameInstancesByCanvas.delete(canvas);
    if (canvas.id) {
      gameInstancesById.delete(canvas.id);
    }
  }
}

/**
 * Destroy a game instance by ID
 */
export function destroyGame(canvasId: string): void {
  const k = gameInstancesById.get(canvasId);
  if (k) {
    k.quit();
    gameInstancesById.delete(canvasId);
  }
}

/**
 * Destroy all game instances
 */
export function destroyAllGames(): void {
  for (const [id, k] of gameInstancesById) {
    k.quit();
  }
  gameInstancesById.clear();
}

// Re-export types from kaplay for convenience
export type { KAPLAYCtx } from 'kaplay';
