/**
 * PauseMenuController - Pause menu component for dungeon scene
 *
 * Handles pause menu rendering and input for dungeon scenes.
 * Extracted from DungeonScene to improve maintainability.
 */

import * as ex from 'excalibur';
import { SceneFontCache } from '../ui/FontCache.js';
import { MenuController, createListMenuController } from '../ui/MenuController.js';
import { InputManager } from '../adapters/InputAdapter.js';
import { UI_LAYERS } from '../ui/UIConstants.js';

/**
 * Pause menu options
 */
export type PauseMenuOption = 'resume' | 'settings' | 'leave';

/**
 * Pause menu configuration
 */
export interface PauseMenuConfig {
  /** Canvas width */
  canvasWidth: number;
  /** Canvas height */
  canvasHeight: number;
  /** Z-index base (defaults to UI_LAYERS.PAUSE_MENU) */
  zIndex?: number;
}

/**
 * Pause menu callbacks
 */
export interface PauseMenuCallbacks {
  /** Called when user selects Resume */
  onResume: () => void;
  /** Called when user selects Settings */
  onSettings?: () => void;
  /** Called when user selects Leave Dungeon */
  onLeaveDungeon: () => void;
}

const MENU_OPTIONS: { id: PauseMenuOption; label: string }[] = [
  { id: 'resume', label: 'Resume' },
  { id: 'settings', label: 'Settings' },
  { id: 'leave', label: 'Leave Dungeon' },
];

/**
 * PauseMenuController manages the pause menu UI
 */
export class PauseMenuController {
  private scene: ex.Scene;
  private config: PauseMenuConfig;
  private callbacks: PauseMenuCallbacks;
  private fontCache: SceneFontCache;
  private menuController: MenuController;

  // State
  private _isActive = false;
  private actors: ex.Actor[] = [];

  constructor(
    scene: ex.Scene,
    config: PauseMenuConfig,
    callbacks: PauseMenuCallbacks,
    fontCache?: SceneFontCache
  ) {
    this.scene = scene;
    this.config = config;
    this.callbacks = callbacks;
    this.fontCache = fontCache || new SceneFontCache();

    // Create menu controller for navigation
    this.menuController = createListMenuController(MENU_OPTIONS.length, {
      wrap: false,
      inputEnabled: false,
    });

    // Setup menu events
    this.menuController.on('navigate', () => this.render());
    this.menuController.on('select', (index) => this.handleSelect(index));
    this.menuController.on('back', () => this.hide());
  }

  /**
   * Check if pause menu is currently active
   */
  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Bind to an InputManager for handling input
   */
  bind(inputManager: InputManager): void {
    this.menuController.bind(inputManager);
  }

  /**
   * Unbind from the current InputManager
   */
  unbind(): void {
    this.menuController.unbind();
  }

  /**
   * Show the pause menu
   */
  show(): void {
    if (this._isActive) return;

    this._isActive = true;
    this.menuController.selectedIndex = 0;
    this.menuController.setInputEnabled(true);
    this.render();
  }

  /**
   * Hide the pause menu
   */
  hide(): void {
    if (!this._isActive) return;

    this._isActive = false;
    this.menuController.setInputEnabled(false);
    this.clear();
    this.callbacks.onResume();
  }

  /**
   * Handle menu option selection
   */
  private handleSelect(index: number): void {
    const option = MENU_OPTIONS[index];
    if (!option) return;

    switch (option.id) {
      case 'resume':
        this.hide();
        break;
      case 'settings':
        this.hide();
        this.callbacks.onSettings?.();
        break;
      case 'leave':
        this.hide();
        this.callbacks.onLeaveDungeon();
        break;
    }
  }

  /**
   * Render the pause menu
   */
  private render(): void {
    this.clear();

    const { canvasWidth, canvasHeight, zIndex = UI_LAYERS.PAUSE_MENU } = this.config;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // Backdrop
    const backdrop = new ex.Actor({
      pos: ex.vec(centerX, centerY),
      width: canvasWidth,
      height: canvasHeight,
      z: zIndex,
    });
    backdrop.graphics.use(
      new ex.Rectangle({
        width: canvasWidth,
        height: canvasHeight,
        color: ex.Color.fromRGB(0, 0, 0, 0.7),
      })
    );
    this.scene.add(backdrop);
    this.actors.push(backdrop);

    // Menu box
    const menuWidth = 200;
    const menuHeight = 148;
    const menuBox = new ex.Actor({
      pos: ex.vec(centerX, centerY),
      width: menuWidth,
      height: menuHeight,
      z: zIndex + 1,
    });
    menuBox.graphics.use(
      new ex.Rectangle({
        width: menuWidth,
        height: menuHeight,
        color: ex.Color.fromRGB(30, 30, 50),
        strokeColor: ex.Color.fromHex('#6496FF'),
        lineWidth: 2,
      })
    );
    this.scene.add(menuBox);
    this.actors.push(menuBox);

    // Title
    const title = new ex.Actor({
      pos: ex.vec(centerX, centerY - 40),
      z: zIndex + 2,
    });
    title.graphics.use(
      new ex.Text({
        text: 'PAUSED',
        font: this.fontCache.getFont(16, ex.Color.White),
      })
    );
    title.graphics.anchor = ex.Vector.Half;
    this.scene.add(title);
    this.actors.push(title);

    // Options
    MENU_OPTIONS.forEach((option, i) => {
      const isSelected = i === this.menuController.selectedIndex;
      const optActor = new ex.Actor({
        pos: ex.vec(centerX, centerY - 10 + i * 28),
        z: zIndex + 2,
      });

      const displayText = isSelected ? `> ${option.label} <` : option.label;
      const color = isSelected ? '#FBBF24' : '#b4b4b4';

      optActor.graphics.use(
        new ex.Text({
          text: displayText,
          font: this.fontCache.getFontHex(14, color),
        })
      );
      optActor.graphics.anchor = ex.Vector.Half;
      this.scene.add(optActor);
      this.actors.push(optActor);
    });

    // Controls hint
    const hint = new ex.Actor({
      pos: ex.vec(centerX, centerY + 50),
      z: zIndex + 2,
    });
    hint.graphics.use(
      new ex.Text({
        text: 'W/S: Navigate | ENTER: Select | ESC: Resume',
        font: this.fontCache.getFontRGB(11, 150, 150, 150),
      })
    );
    hint.graphics.anchor = ex.Vector.Half;
    this.scene.add(hint);
    this.actors.push(hint);
  }

  /**
   * Clear all menu actors
   */
  clear(): void {
    for (const actor of this.actors) {
      actor.kill();
    }
    this.actors = [];
  }

  /**
   * Dispose and clean up resources
   */
  dispose(): void {
    this.clear();
    this.menuController.dispose();
    this.fontCache.clear();
  }
}
