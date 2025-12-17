/**
 * InputAdapter
 *
 * Provides unified keyboard and gamepad input handling for Excalibur.js.
 * Mirrors the KAPLAY input patterns for consistent behavior across engines.
 */

import * as ex from 'excalibur';

// Key mappings to match KAPLAY conventions
export type GameKey =
  | 'up' | 'down' | 'left' | 'right'
  | 'w' | 'a' | 's' | 'd'
  | 'enter' | 'space' | 'escape'
  | 'i' | 'e' | 'q' | 'u';

// Map our game keys to Excalibur key codes
const KEY_MAP: Record<GameKey, ex.Keys> = {
  up: ex.Keys.ArrowUp,
  down: ex.Keys.ArrowDown,
  left: ex.Keys.ArrowLeft,
  right: ex.Keys.ArrowRight,
  w: ex.Keys.W,
  a: ex.Keys.A,
  s: ex.Keys.S,
  d: ex.Keys.D,
  enter: ex.Keys.Enter,
  space: ex.Keys.Space,
  escape: ex.Keys.Escape,
  i: ex.Keys.I,
  e: ex.Keys.E,
  q: ex.Keys.Q,
  u: ex.Keys.U,
};

/**
 * InputManager wraps Excalibur's input system with game-specific helpers
 */
export class InputManager {
  private engine: ex.Engine;
  private keyPressHandlers: Map<GameKey, (() => void)[]> = new Map();
  private keyDownHandlers: Map<GameKey, (() => void)[]> = new Map();
  private keyUpHandlers: Map<GameKey, (() => void)[]> = new Map();

  constructor(engine: ex.Engine) {
    this.engine = engine;
    this.setupKeyboardEvents();
  }

  /**
   * Setup keyboard event listeners
   */
  private setupKeyboardEvents(): void {
    // Listen for key press events
    this.engine.input.keyboard.on('press', (evt: ex.KeyEvent) => {
      const gameKey = this.excaliburKeyToGameKey(evt.key);
      if (gameKey) {
        const handlers = this.keyPressHandlers.get(gameKey);
        handlers?.forEach(handler => handler());
      }
    });

    // Listen for key down events (held)
    this.engine.input.keyboard.on('down', (evt: ex.KeyEvent) => {
      const gameKey = this.excaliburKeyToGameKey(evt.key);
      if (gameKey) {
        const handlers = this.keyDownHandlers.get(gameKey);
        handlers?.forEach(handler => handler());
      }
    });

    // Listen for key up events
    this.engine.input.keyboard.on('release', (evt: ex.KeyEvent) => {
      const gameKey = this.excaliburKeyToGameKey(evt.key);
      if (gameKey) {
        const handlers = this.keyUpHandlers.get(gameKey);
        handlers?.forEach(handler => handler());
      }
    });
  }

  /**
   * Convert Excalibur key to our game key
   */
  private excaliburKeyToGameKey(key: ex.Keys): GameKey | null {
    for (const [gameKey, exKey] of Object.entries(KEY_MAP)) {
      if (exKey === key) {
        return gameKey as GameKey;
      }
    }
    return null;
  }

  /**
   * Register a key press handler (fires once per press)
   * Returns a cancel function
   */
  onKeyPress(key: GameKey, handler: () => void): () => void {
    if (!this.keyPressHandlers.has(key)) {
      this.keyPressHandlers.set(key, []);
    }
    this.keyPressHandlers.get(key)!.push(handler);

    // Return cancel function
    return () => {
      const handlers = this.keyPressHandlers.get(key);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
      }
    };
  }

  /**
   * Register a key down handler (fires while held)
   * Returns a cancel function
   */
  onKeyDown(key: GameKey, handler: () => void): () => void {
    if (!this.keyDownHandlers.has(key)) {
      this.keyDownHandlers.set(key, []);
    }
    this.keyDownHandlers.get(key)!.push(handler);

    return () => {
      const handlers = this.keyDownHandlers.get(key);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
      }
    };
  }

  /**
   * Register a key up handler
   * Returns a cancel function
   */
  onKeyUp(key: GameKey, handler: () => void): () => void {
    if (!this.keyUpHandlers.has(key)) {
      this.keyUpHandlers.set(key, []);
    }
    this.keyUpHandlers.get(key)!.push(handler);

    return () => {
      const handlers = this.keyUpHandlers.get(key);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
      }
    };
  }

  /**
   * Check if a key is currently held down
   */
  isKeyHeld(key: GameKey): boolean {
    const exKey = KEY_MAP[key];
    return this.engine.input.keyboard.isHeld(exKey);
  }

  /**
   * Check if a key was just pressed this frame
   */
  wasKeyPressed(key: GameKey): boolean {
    const exKey = KEY_MAP[key];
    return this.engine.input.keyboard.wasPressed(exKey);
  }

  /**
   * Check if a key was just released this frame
   */
  wasKeyReleased(key: GameKey): boolean {
    const exKey = KEY_MAP[key];
    return this.engine.input.keyboard.wasReleased(exKey);
  }

  /**
   * Get movement vector from arrow keys or WASD
   * Returns normalized direction vector
   */
  getMovementVector(): ex.Vector {
    let x = 0;
    let y = 0;

    if (this.isKeyHeld('left') || this.isKeyHeld('a')) x -= 1;
    if (this.isKeyHeld('right') || this.isKeyHeld('d')) x += 1;
    if (this.isKeyHeld('up') || this.isKeyHeld('w')) y -= 1;
    if (this.isKeyHeld('down') || this.isKeyHeld('s')) y += 1;

    const vec = new ex.Vector(x, y);

    // Normalize diagonal movement
    if (vec.x !== 0 && vec.y !== 0) {
      return vec.normalize();
    }

    return vec;
  }

  /**
   * Check if any movement key is held
   */
  isMoving(): boolean {
    return (
      this.isKeyHeld('left') || this.isKeyHeld('right') ||
      this.isKeyHeld('up') || this.isKeyHeld('down') ||
      this.isKeyHeld('a') || this.isKeyHeld('d') ||
      this.isKeyHeld('w') || this.isKeyHeld('s')
    );
  }

  /**
   * Clear all handlers for a specific key
   */
  clearKey(key: GameKey): void {
    this.keyPressHandlers.delete(key);
    this.keyDownHandlers.delete(key);
    this.keyUpHandlers.delete(key);
  }

  /**
   * Clear all handlers
   */
  clearAll(): void {
    this.keyPressHandlers.clear();
    this.keyDownHandlers.clear();
    this.keyUpHandlers.clear();
  }
}
