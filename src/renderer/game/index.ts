/**
 * KAPLAY Game Engine Initialization
 *
 * Central initialization for KAPLAY game instances.
 * Uses singleton pattern - only one KAPLAY instance per canvas.
 *
 * FIXES:
 * - Properly clears all caches on destroy to prevent white screen on reopen
 */

import kaplay, { KAPLAYCtx } from 'kaplay';

// Store references to game instances by canvas element (WeakMap for automatic cleanup)
const gameInstancesByCanvas = new WeakMap<HTMLCanvasElement, KAPLAYCtx>();
// Also store by ID for lookup convenience
const gameInstancesById = new Map<string, KAPLAYCtx>();
// Store canvas elements by ID so we can clean up WeakMap on destroy
const canvasesById = new Map<string, HTMLCanvasElement>();
// Track destroyed canvas IDs to force reinitialization
const destroyedCanvasIds = new Set<string>();

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
 * FIXED: Now properly detects destroyed instances and reinitializes.
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

  // FIXED: Check if this canvas was previously destroyed - if so, force new instance
  if (canvas.id && destroyedCanvasIds.has(canvas.id)) {
    destroyedCanvasIds.delete(canvas.id);
    // Don't return cached instance - create fresh one
  } else {
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
    canvasesById.set(canvas.id, canvas);
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
    try {
      k.quit();
    } catch (e) {
      console.warn('Error quitting KAPLAY:', e);
    }
    gameInstancesByCanvas.delete(canvas);
    if (canvas.id) {
      gameInstancesById.delete(canvas.id);
      canvasesById.delete(canvas.id);
      // FIXED: Mark this canvas ID as destroyed so next init creates fresh instance
      destroyedCanvasIds.add(canvas.id);
    }

    // Clear the canvas for fresh reinitialization
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
}

/**
 * Destroy a game instance by ID
 * FIXED: Now properly marks canvas as destroyed for reinitialization
 */
export function destroyGame(canvasId: string): void {
  const k = gameInstancesById.get(canvasId);
  const canvas = canvasesById.get(canvasId);

  if (k) {
    try {
      k.quit();
    } catch (e) {
      console.warn('Error quitting KAPLAY:', e);
    }
    gameInstancesById.delete(canvasId);
  }

  // Also clean up WeakMap and canvas reference
  if (canvas) {
    gameInstancesByCanvas.delete(canvas);
    canvasesById.delete(canvasId);

    // Clear the canvas for fresh reinitialization
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // FIXED: Mark this canvas ID as destroyed so next init creates fresh instance
  destroyedCanvasIds.add(canvasId);
}

/**
 * Destroy all game instances
 */
export function destroyAllGames(): void {
  for (const [id, k] of gameInstancesById) {
    try {
      k.quit();
    } catch (e) {
      console.warn('Error quitting KAPLAY:', e);
    }

    // Clean up WeakMap and clear canvas
    const canvas = canvasesById.get(id);
    if (canvas) {
      gameInstancesByCanvas.delete(canvas);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    // Mark as destroyed
    destroyedCanvasIds.add(id);
  }
  gameInstancesById.clear();
  canvasesById.clear();
}

// Re-export types from kaplay for convenience
export type { KAPLAYCtx } from 'kaplay';
