/**
 * MenuController - Centralized menu navigation and input handling
 *
 * Consolidates the repeated input handling patterns found across scenes:
 * - inputEnabled flag with cooldown after scene transitions
 * - Navigation debouncing (canNavigate with lastNavTime)
 * - Selection state management
 * - Processing flags to prevent double-actions
 *
 * Emits events for state changes so scenes can react accordingly.
 */

import * as ex from 'excalibur';
import { InputManager, type GameKey } from '../adapters/InputAdapter.js';
import { INPUT_COOLDOWN_MS } from './UIConstants.js';

/**
 * Menu navigation direction
 */
export type MenuDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Menu controller events
 */
export interface MenuControllerEvents {
  /** Fired when navigation occurs */
  navigate: (direction: MenuDirection, newIndex: number) => void;
  /** Fired when selection/confirm happens */
  select: (index: number) => void;
  /** Fired when back/cancel happens */
  back: () => void;
  /** Fired when a secondary action (e.g., 'U' for unequip) happens */
  action: (actionKey: GameKey) => void;
  /** Fired when input enabled state changes */
  inputStateChange: (enabled: boolean) => void;
}

/**
 * Configuration for MenuController
 */
export interface MenuControllerConfig {
  /** Total number of items in the menu */
  itemCount: number;
  /** Number of columns (for grid navigation, default 1 = list) */
  columns?: number;
  /** Initial selected index */
  initialIndex?: number;
  /** Whether to wrap around at edges */
  wrap?: boolean;
  /** Navigation debounce time in ms */
  debounceMs?: number;
  /** Initial input enabled state */
  inputEnabled?: boolean;
  /** Cooldown before enabling input (for scene transitions) */
  inputCooldownMs?: number;
  /** Keys that trigger selection */
  selectKeys?: GameKey[];
  /** Keys that trigger back/cancel */
  backKeys?: GameKey[];
  /** Additional action keys to listen for */
  actionKeys?: GameKey[];
}

/**
 * MenuController manages menu navigation state and input handling
 */
export class MenuController {
  private inputManager: InputManager | null = null;
  private engine: ex.Engine | null = null;

  // State
  private _selectedIndex = 0;
  private _itemCount = 0;
  private _columns = 1;
  private _wrap = false;
  private _inputEnabled = false;
  private _isProcessing = false;

  // Debouncing
  private lastNavTime = 0;
  private debounceMs = 80;

  // Configuration
  private selectKeys: GameKey[] = ['enter', 'space'];
  private backKeys: GameKey[] = ['escape'];
  private actionKeys: GameKey[] = [];

  // Event handlers
  private eventHandlers: Partial<MenuControllerEvents> = {};

  // Cleanup functions for input handlers
  private inputCleanups: (() => void)[] = [];

  constructor(config: MenuControllerConfig) {
    this._itemCount = config.itemCount;
    this._columns = config.columns ?? 1;
    this._selectedIndex = config.initialIndex ?? 0;
    this._wrap = config.wrap ?? false;
    this.debounceMs = config.debounceMs ?? 80;
    this._inputEnabled = config.inputEnabled ?? false;

    if (config.selectKeys) this.selectKeys = config.selectKeys;
    if (config.backKeys) this.backKeys = config.backKeys;
    if (config.actionKeys) this.actionKeys = config.actionKeys;

    // Apply initial input cooldown if specified
    if (config.inputCooldownMs !== undefined && config.inputCooldownMs > 0) {
      this._inputEnabled = false;
      setTimeout(() => {
        this.setInputEnabled(true);
      }, config.inputCooldownMs);
    }
  }

  /**
   * Bind to an InputManager (typically from a Player actor or scene)
   */
  bind(inputManager: InputManager, engine?: ex.Engine): void {
    this.unbind(); // Clean up any existing bindings
    this.inputManager = inputManager;
    this.engine = engine ?? null;
    this.setupInputHandlers();
  }

  /**
   * Unbind from the current InputManager
   */
  unbind(): void {
    // Clean up all input handlers
    for (const cleanup of this.inputCleanups) {
      cleanup();
    }
    this.inputCleanups = [];
    this.inputManager = null;
    this.engine = null;
  }

  /**
   * Setup input handlers on the InputManager
   */
  private setupInputHandlers(): void {
    if (!this.inputManager) return;

    // Navigation keys
    const navKeys: { key: GameKey; direction: MenuDirection }[] = [
      { key: 'up', direction: 'up' },
      { key: 'w', direction: 'up' },
      { key: 'down', direction: 'down' },
      { key: 's', direction: 'down' },
      { key: 'left', direction: 'left' },
      { key: 'a', direction: 'left' },
      { key: 'right', direction: 'right' },
      { key: 'd', direction: 'right' },
    ];

    for (const { key, direction } of navKeys) {
      const cleanup = this.inputManager.onKeyPress(key, () => {
        if (!this._inputEnabled || this._isProcessing) return;
        if (!this.canNavigate()) return;
        this.navigate(direction);
      });
      this.inputCleanups.push(cleanup);
    }

    // Select keys
    for (const key of this.selectKeys) {
      const cleanup = this.inputManager.onKeyPress(key, () => {
        if (!this._inputEnabled || this._isProcessing) return;
        this.select();
      });
      this.inputCleanups.push(cleanup);
    }

    // Back keys
    for (const key of this.backKeys) {
      const cleanup = this.inputManager.onKeyPress(key, () => {
        if (!this._inputEnabled) return;
        this.back();
      });
      this.inputCleanups.push(cleanup);
    }

    // Action keys
    for (const key of this.actionKeys) {
      const cleanup = this.inputManager.onKeyPress(key, () => {
        if (!this._inputEnabled || this._isProcessing) return;
        this.eventHandlers.action?.(key);
      });
      this.inputCleanups.push(cleanup);
    }
  }

  /**
   * Check if navigation should be allowed (debounce)
   */
  private canNavigate(): boolean {
    const now = Date.now();
    if (now - this.lastNavTime < this.debounceMs) return false;
    this.lastNavTime = now;
    return true;
  }

  /**
   * Navigate in a direction
   */
  navigate(direction: MenuDirection): void {
    if (this._itemCount === 0) return;

    let newIndex = this._selectedIndex;

    switch (direction) {
      case 'up':
        newIndex = this._selectedIndex - this._columns;
        if (newIndex < 0) {
          newIndex = this._wrap
            ? this._itemCount - 1 - ((this._itemCount - 1 - this._selectedIndex) % this._columns)
            : this._selectedIndex;
        }
        break;

      case 'down':
        newIndex = this._selectedIndex + this._columns;
        if (newIndex >= this._itemCount) {
          newIndex = this._wrap ? this._selectedIndex % this._columns : this._selectedIndex;
        }
        break;

      case 'left':
        if (this._columns > 1) {
          // Grid navigation
          if (this._selectedIndex % this._columns > 0) {
            newIndex = this._selectedIndex - 1;
          } else if (this._wrap) {
            newIndex = Math.min(
              this._selectedIndex + this._columns - 1,
              this._itemCount - 1
            );
          }
        } else {
          // Tab-style navigation (left = previous)
          newIndex = this._selectedIndex - 1;
          if (newIndex < 0) {
            newIndex = this._wrap ? this._itemCount - 1 : 0;
          }
        }
        break;

      case 'right':
        if (this._columns > 1) {
          // Grid navigation
          if ((this._selectedIndex + 1) % this._columns !== 0 && this._selectedIndex < this._itemCount - 1) {
            newIndex = this._selectedIndex + 1;
          } else if (this._wrap) {
            newIndex = this._selectedIndex - (this._selectedIndex % this._columns);
          }
        } else {
          // Tab-style navigation (right = next)
          newIndex = this._selectedIndex + 1;
          if (newIndex >= this._itemCount) {
            newIndex = this._wrap ? 0 : this._itemCount - 1;
          }
        }
        break;
    }

    if (newIndex !== this._selectedIndex && newIndex >= 0 && newIndex < this._itemCount) {
      this._selectedIndex = newIndex;
      this.eventHandlers.navigate?.(direction, newIndex);
    }
  }

  /**
   * Trigger selection on current item
   */
  select(): void {
    if (this._itemCount === 0) return;
    this.eventHandlers.select?.(this._selectedIndex);
  }

  /**
   * Trigger back/cancel
   */
  back(): void {
    this.eventHandlers.back?.();
  }

  // ============ Event Registration ============

  /**
   * Register an event handler
   */
  on<K extends keyof MenuControllerEvents>(event: K, handler: MenuControllerEvents[K]): void {
    this.eventHandlers[event] = handler as any;
  }

  /**
   * Remove an event handler
   */
  off<K extends keyof MenuControllerEvents>(event: K): void {
    delete this.eventHandlers[event];
  }

  // ============ State Accessors ============

  /** Get current selected index */
  get selectedIndex(): number {
    return this._selectedIndex;
  }

  /** Set selected index (clamps to valid range) */
  set selectedIndex(value: number) {
    this._selectedIndex = Math.max(0, Math.min(value, this._itemCount - 1));
  }

  /** Get item count */
  get itemCount(): number {
    return this._itemCount;
  }

  /** Update item count (resets selection if out of bounds) */
  set itemCount(value: number) {
    this._itemCount = value;
    if (this._selectedIndex >= value) {
      this._selectedIndex = Math.max(0, value - 1);
    }
  }

  /** Check if input is enabled */
  get inputEnabled(): boolean {
    return this._inputEnabled;
  }

  /** Enable/disable input */
  setInputEnabled(enabled: boolean): void {
    if (this._inputEnabled !== enabled) {
      this._inputEnabled = enabled;
      this.eventHandlers.inputStateChange?.(enabled);
    }
  }

  /** Enable input after a cooldown delay */
  enableInputAfterDelay(delayMs = INPUT_COOLDOWN_MS): void {
    this._inputEnabled = false;
    setTimeout(() => {
      this.setInputEnabled(true);
    }, delayMs);
  }

  /** Check if currently processing an action */
  get isProcessing(): boolean {
    return this._isProcessing;
  }

  /** Set processing state (blocks input during async operations) */
  set isProcessing(value: boolean) {
    this._isProcessing = value;
  }

  /** Get number of columns */
  get columns(): number {
    return this._columns;
  }

  /** Set number of columns */
  set columns(value: number) {
    this._columns = Math.max(1, value);
  }

  // ============ Scroll Helpers ============

  /**
   * Calculate scroll offset to keep selection visible
   */
  calculateScrollOffset(maxVisible: number, currentOffset = 0): number {
    if (this._selectedIndex < currentOffset) {
      return this._selectedIndex;
    } else if (this._selectedIndex >= currentOffset + maxVisible) {
      return this._selectedIndex - maxVisible + 1;
    }
    return Math.max(0, Math.min(currentOffset, Math.max(0, this._itemCount - maxVisible)));
  }

  // ============ Cleanup ============

  /**
   * Dispose of the controller and clean up resources
   */
  dispose(): void {
    this.unbind();
    this.eventHandlers = {};
  }
}

/**
 * Create a simple list menu controller
 */
export function createListMenuController(
  itemCount: number,
  options?: Partial<MenuControllerConfig>
): MenuController {
  return new MenuController({
    itemCount,
    columns: 1,
    wrap: false,
    ...options,
  });
}

/**
 * Create a tab navigation controller
 */
export function createTabController(
  tabCount: number,
  options?: Partial<MenuControllerConfig>
): MenuController {
  return new MenuController({
    itemCount: tabCount,
    columns: 1, // Tabs use left/right as prev/next
    wrap: true,
    selectKeys: [], // Tabs don't typically have select
    ...options,
  });
}

/**
 * Create a grid menu controller
 */
export function createGridMenuController(
  itemCount: number,
  columns: number,
  options?: Partial<MenuControllerConfig>
): MenuController {
  return new MenuController({
    itemCount,
    columns,
    wrap: false,
    ...options,
  });
}
