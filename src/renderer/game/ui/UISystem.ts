/**
 * StudyQuest UI System
 *
 * Modular UI system with theme switching support.
 * Provides main menu, dialogs, and health bar components.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';

// ============================================================================
// Types
// ============================================================================

export type UITheme = 'beige' | 'blue' | 'brown' | 'pink';
export type UIElement = 'mainmenu' | 'ok' | 'yesno' | 'character';

export interface MainMenuCallbacks {
  onPlay?: () => void;
  onSettings?: () => void;
  onExit?: () => void;
}

export interface YesNoCallbacks {
  onYes?: () => void;
  onNo?: () => void;
}

// ============================================================================
// Sprite Name Mapping (handles inconsistent file naming)
// ============================================================================

const SPRITE_NAME_MAP: Record<UITheme, Record<UIElement, string>> = {
  beige: { mainmenu: 'BEIGE', ok: 'BEIGE', yesno: 'GREY', character: 'BEIGE' },
  blue: { mainmenu: 'BLUE', ok: 'BLUE', yesno: 'BLUE', character: 'BLUE' },
  brown: { mainmenu: 'TAN', ok: 'TAN', yesno: 'BROWN', character: 'TAN' },
  pink: { mainmenu: 'PINK', ok: 'PINK', yesno: 'PINK', character: 'PINK' },
};

// Folder names match theme names but uppercased
const THEME_FOLDERS: Record<UITheme, string> = {
  beige: 'BEIGE',
  blue: 'BLUE',
  brown: 'BROWN',
  pink: 'PINK',
};

// ============================================================================
// Font Configuration
// ============================================================================

const STUDYQUEST_FONT = {
  name: 'ithaca',
  path: '../../assets/Ithaca-LVB75.ttf',
};

// ============================================================================
// Button Hit Regions (pixel coordinates within sprites)
// ============================================================================

// Main menu sprite is ~75x85, buttons stacked vertically
const MAINMENU_BUTTONS = {
  play: { x: 8, y: 25, width: 58, height: 14 },
  settings: { x: 8, y: 43, width: 58, height: 14 },
  exit: { x: 8, y: 61, width: 58, height: 14 },
};

// OK dialog sprite is ~95x55
const OK_BUTTON = { x: 55, y: 32, width: 30, height: 16 };

// Yes/No dialog sprite is ~95x35
const YESNO_BUTTONS = {
  yes: { x: 18, y: 20, width: 25, height: 12 },
  no: { x: 52, y: 20, width: 25, height: 12 },
};

// Character HUD dimensions (CHARACTER sprite 76x28 at 1x)
// Cat portrait on left (~32px), three stat areas on right
const CHARACTER_HUD = {
  // Health bar (top bar - red) - inside the bar border
  health: {
    fillX: 25,
    fillY: 7,
    fillWidth: 36,
    fillHeight: 3,
  },
  // XP bar (middle bar - blue/purple) - inside the bar border
  xp: {
    fillX: 25,
    fillY: 13,
    fillWidth: 36,
    fillHeight: 3,
  },
  // Currency text position (bottom area, after coin icon ~8px wide)
  currency: {
    textX: 32,
    textY: 22,
    fontSize: 16,
  },
};

// ============================================================================
// UISystem Class
// ============================================================================

export class UISystem {
  private k: KAPLAYCtx;
  private theme: UITheme = 'blue';
  private loadedSprites: Set<string> = new Set();
  private fontLoaded = false;

  // Active UI element references
  private mainMenuContainer: GameObj | null = null;
  private okDialogContainer: GameObj | null = null;
  private yesNoDialogContainer: GameObj | null = null;
  private characterHudContainer: GameObj | null = null;

  // Character stats state
  private currentHealth = 100;
  private maxHealth = 100;
  private currentXP = 0;
  private maxXP = 100;
  private currency = 0;

  constructor(k: KAPLAYCtx) {
    this.k = k;
  }

  // ==========================================================================
  // Font Loading
  // ==========================================================================

  /**
   * Load the StudyQuest font. Called automatically when needed.
   */
  private async loadFont(): Promise<void> {
    if (this.fontLoaded) return;

    try {
      await this.k.loadFont(STUDYQUEST_FONT.name, STUDYQUEST_FONT.path);
      this.fontLoaded = true;
    } catch (err) {
      console.warn('Failed to load StudyQuest font:', err);
    }
  }

  // ==========================================================================
  // Theme Management
  // ==========================================================================

  /**
   * Set the UI color theme. Loads sprites if needed and refreshes visible UI.
   */
  async setColorTheme(theme: UITheme): Promise<void> {
    this.theme = theme;
    await this.loadThemeSprites(theme);

    // Refresh visible UI elements with new theme
    this.refreshVisibleUI();
  }

  /**
   * Refresh all visible UI elements with current theme sprites
   */
  private refreshVisibleUI(): void {
    // Refresh character HUD if visible
    if (this.characterHudContainer) {
      const pos = this.characterHudContainer.pos;
      this.hideCharacterHud();
      this.showCharacterHud(pos.x, pos.y);
    }

    // Refresh main menu if visible (preserving callbacks isn't possible, so just update sprite)
    if (this.mainMenuContainer) {
      const menuSprite = this.mainMenuContainer.get('ui-mainmenu')[0];
      if (menuSprite) {
        menuSprite.use(this.k.sprite(this.getCurrentSpriteKey('mainmenu')));
      }
    }

    // Refresh OK dialog if visible
    if (this.okDialogContainer) {
      const okSprite = this.okDialogContainer.get('ui-ok-dialog')[0];
      if (okSprite) {
        okSprite.use(this.k.sprite(this.getCurrentSpriteKey('ok')));
      }
    }

    // Refresh Yes/No dialog if visible
    if (this.yesNoDialogContainer) {
      const yesNoSprite = this.yesNoDialogContainer.get('ui-yesno-dialog')[0];
      if (yesNoSprite) {
        yesNoSprite.use(this.k.sprite(this.getCurrentSpriteKey('yesno')));
      }
    }
  }

  /**
   * Get current theme
   */
  getTheme(): UITheme {
    return this.theme;
  }

  /**
   * Load all sprites for a theme
   */
  private async loadThemeSprites(theme: UITheme): Promise<void> {
    const folder = THEME_FOLDERS[theme];
    const elements: UIElement[] = ['mainmenu', 'ok', 'yesno', 'character'];

    for (const element of elements) {
      const spriteName = this.getSpriteKey(theme, element);
      if (this.loadedSprites.has(spriteName)) continue;

      const suffix = SPRITE_NAME_MAP[theme][element];
      const filename = this.getFilename(element, suffix);
      // Use ../../ to reach root assets folder from dist/renderer/
      const path = `../../assets/UI/CAT/${folder}/${filename}`;

      try {
        this.k.loadSprite(spriteName, path);
        this.loadedSprites.add(spriteName);
      } catch (err) {
        console.error(`Failed to load UI sprite: ${path}`, err);
      }
    }
  }

  /**
   * Get sprite key for caching
   */
  private getSpriteKey(theme: UITheme, element: UIElement): string {
    return `ui-${element}-${theme}`;
  }

  /**
   * Get filename for a UI element
   */
  private getFilename(element: UIElement, suffix: string): string {
    const elementUpper = element.toUpperCase();
    return `${elementUpper}_${suffix}.png`;
  }

  /**
   * Get current sprite key for an element
   */
  private getCurrentSpriteKey(element: UIElement): string {
    return this.getSpriteKey(this.theme, element);
  }

  // ==========================================================================
  // Main Menu
  // ==========================================================================

  /**
   * Show the main menu
   */
  async showMainMenu(callbacks: MainMenuCallbacks = {}): Promise<void> {
    await this.loadThemeSprites(this.theme);
    this.hideMainMenu();

    const k = this.k;
    const centerX = k.width() / 2;
    const centerY = k.height() / 2;

    // Create container for all menu elements
    this.mainMenuContainer = k.add([k.pos(0, 0), k.z(100), 'ui-mainmenu-container']);

    // Add menu sprite
    const menuSprite = this.mainMenuContainer.add([
      k.sprite(this.getCurrentSpriteKey('mainmenu')),
      k.pos(centerX, centerY),
      k.anchor('center'),
      k.scale(2),
      'ui-mainmenu',
    ]);

    // Calculate sprite bounds for click detection
    const spriteWidth = 75 * 2; // scaled
    const spriteHeight = 85 * 2;
    const spriteLeft = centerX - spriteWidth / 2;
    const spriteTop = centerY - spriteHeight / 2;

    // Create click areas for buttons
    this.createMenuButton(
      spriteLeft,
      spriteTop,
      MAINMENU_BUTTONS.play,
      callbacks.onPlay,
      'play'
    );
    this.createMenuButton(
      spriteLeft,
      spriteTop,
      MAINMENU_BUTTONS.settings,
      callbacks.onSettings,
      'settings'
    );
    this.createMenuButton(
      spriteLeft,
      spriteTop,
      MAINMENU_BUTTONS.exit,
      callbacks.onExit,
      'exit'
    );
  }

  /**
   * Create an invisible clickable button area
   */
  private createMenuButton(
    spriteLeft: number,
    spriteTop: number,
    region: { x: number; y: number; width: number; height: number },
    callback?: () => void,
    tag?: string
  ): void {
    if (!this.mainMenuContainer || !callback) return;

    const k = this.k;
    const scale = 2;

    this.mainMenuContainer.add([
      k.pos(spriteLeft + region.x * scale, spriteTop + region.y * scale),
      k.rect(region.width * scale, region.height * scale),
      k.color(255, 255, 255),
      k.opacity(0), // Invisible
      k.area(),
      k.z(101),
      tag ? `ui-btn-${tag}` : 'ui-btn',
    ]);

    // Handle click on this button region
    this.mainMenuContainer.onUpdate(() => {
      if (k.isMousePressed('left')) {
        const mousePos = k.mousePos();
        const btnX = spriteLeft + region.x * scale;
        const btnY = spriteTop + region.y * scale;
        const btnW = region.width * scale;
        const btnH = region.height * scale;

        if (
          mousePos.x >= btnX &&
          mousePos.x <= btnX + btnW &&
          mousePos.y >= btnY &&
          mousePos.y <= btnY + btnH
        ) {
          callback();
        }
      }
    });
  }

  /**
   * Hide the main menu
   */
  hideMainMenu(): void {
    if (this.mainMenuContainer) {
      this.mainMenuContainer.destroy();
      this.mainMenuContainer = null;
    }
  }

  // ==========================================================================
  // OK Dialog
  // ==========================================================================

  /**
   * Show an OK dialog with a message
   */
  async showOkDialog(message: string, onOk?: () => void): Promise<void> {
    await this.loadThemeSprites(this.theme);
    await this.loadFont();
    this.hideOkDialog();

    const k = this.k;
    const centerX = k.width() / 2;
    const centerY = k.height() / 2;

    // Create container
    this.okDialogContainer = k.add([k.pos(0, 0), k.z(200), 'ui-ok-container']);

    // Semi-transparent overlay
    this.okDialogContainer.add([
      k.rect(k.width(), k.height()),
      k.color(0, 0, 0),
      k.opacity(0.5),
      k.pos(0, 0),
      'ui-overlay',
    ]);

    // Dialog sprite (scale 2x)
    const scale = 2;
    const spriteWidth = 95 * scale;
    const spriteHeight = 55 * scale;
    const spriteLeft = centerX - spriteWidth / 2;
    const spriteTop = centerY - spriteHeight / 2;

    this.okDialogContainer.add([
      k.sprite(this.getCurrentSpriteKey('ok')),
      k.pos(centerX, centerY),
      k.anchor('center'),
      k.scale(scale),
      'ui-ok-dialog',
    ]);

    // Message text centered in dialog
    this.okDialogContainer.add([
      k.text(message, { size: 16, width: spriteWidth - 20, font: STUDYQUEST_FONT.name, align: 'center' }),
      k.pos(centerX, centerY),
      k.anchor('center'),
      k.color(50, 50, 50),
      'ui-ok-text',
    ]);

    // Click handler for OK button
    const handleClick = () => {
      if (k.isMousePressed('left')) {
        const mousePos = k.mousePos();
        const btnX = spriteLeft + OK_BUTTON.x * scale;
        const btnY = spriteTop + OK_BUTTON.y * scale;
        const btnW = OK_BUTTON.width * scale;
        const btnH = OK_BUTTON.height * scale;

        if (
          mousePos.x >= btnX &&
          mousePos.x <= btnX + btnW &&
          mousePos.y >= btnY &&
          mousePos.y <= btnY + btnH
        ) {
          this.hideOkDialog();
          onOk?.();
        }
      }
    };

    this.okDialogContainer.onUpdate(handleClick);
  }

  /**
   * Hide the OK dialog
   */
  hideOkDialog(): void {
    if (this.okDialogContainer) {
      this.okDialogContainer.destroy();
      this.okDialogContainer = null;
    }
  }

  // ==========================================================================
  // Yes/No Dialog
  // ==========================================================================

  /**
   * Show a Yes/No dialog with a message
   */
  async showYesNoDialog(message: string, callbacks: YesNoCallbacks = {}): Promise<void> {
    await this.loadThemeSprites(this.theme);
    await this.loadFont();
    this.hideYesNoDialog();

    const k = this.k;
    const centerX = k.width() / 2;
    const centerY = k.height() / 2;

    // Create container
    this.yesNoDialogContainer = k.add([k.pos(0, 0), k.z(200), 'ui-yesno-container']);

    // Semi-transparent overlay
    this.yesNoDialogContainer.add([
      k.rect(k.width(), k.height()),
      k.color(0, 0, 0),
      k.opacity(0.5),
      k.pos(0, 0),
      'ui-overlay',
    ]);

    // Dialog sprite (scale 2x)
    const scale = 2;
    const spriteWidth = 95 * scale;
    const spriteHeight = 35 * scale;
    const spriteLeft = centerX - spriteWidth / 2;
    const spriteTop = centerY - spriteHeight / 2;

    this.yesNoDialogContainer.add([
      k.sprite(this.getCurrentSpriteKey('yesno')),
      k.pos(centerX, centerY),
      k.anchor('center'),
      k.scale(scale),
      'ui-yesno-dialog',
    ]);

    // Message text above dialog
    this.yesNoDialogContainer.add([
      k.text(message, { size: 16, width: spriteWidth - 20, font: STUDYQUEST_FONT.name, align: 'center' }),
      k.pos(centerX, spriteTop - 10),
      k.anchor('center'),
      k.color(255, 255, 255),
      'ui-yesno-text',
    ]);

    // Click handler for Yes/No buttons
    const handleClick = () => {
      if (k.isMousePressed('left')) {
        const mousePos = k.mousePos();

        // Check YES button
        const yesX = spriteLeft + YESNO_BUTTONS.yes.x * scale;
        const yesY = spriteTop + YESNO_BUTTONS.yes.y * scale;
        const yesW = YESNO_BUTTONS.yes.width * scale;
        const yesH = YESNO_BUTTONS.yes.height * scale;

        if (
          mousePos.x >= yesX &&
          mousePos.x <= yesX + yesW &&
          mousePos.y >= yesY &&
          mousePos.y <= yesY + yesH
        ) {
          this.hideYesNoDialog();
          callbacks.onYes?.();
          return;
        }

        // Check NO button
        const noX = spriteLeft + YESNO_BUTTONS.no.x * scale;
        const noY = spriteTop + YESNO_BUTTONS.no.y * scale;
        const noW = YESNO_BUTTONS.no.width * scale;
        const noH = YESNO_BUTTONS.no.height * scale;

        if (
          mousePos.x >= noX &&
          mousePos.x <= noX + noW &&
          mousePos.y >= noY &&
          mousePos.y <= noY + noH
        ) {
          this.hideYesNoDialog();
          callbacks.onNo?.();
        }
      }
    };

    this.yesNoDialogContainer.onUpdate(handleClick);
  }

  /**
   * Hide the Yes/No dialog
   */
  hideYesNoDialog(): void {
    if (this.yesNoDialogContainer) {
      this.yesNoDialogContainer.destroy();
      this.yesNoDialogContainer = null;
    }
  }

  // ==========================================================================
  // Character HUD (Health, XP, Currency)
  // ==========================================================================

  /**
   * Show the character HUD at a position
   */
  async showCharacterHud(x: number, y: number): Promise<GameObj> {
    await this.loadThemeSprites(this.theme);
    await this.loadFont();
    this.hideCharacterHud();

    const k = this.k;
    const scale = 2;

    // Create container
    this.characterHudContainer = k.add([k.pos(x, y), k.z(50), 'ui-character-hud']);

    // Character HUD frame sprite (drawn first, as background)
    this.characterHudContainer.add([
      k.sprite(this.getCurrentSpriteKey('character')),
      k.pos(0, 0),
      k.scale(scale),
      k.z(50),
      'ui-character-frame',
    ]);

    // Health fill (red bar - top) - drawn on top of frame
    const healthFill = this.characterHudContainer.add([
      k.pos(CHARACTER_HUD.health.fillX * scale, CHARACTER_HUD.health.fillY * scale),
      k.rect(CHARACTER_HUD.health.fillWidth * scale, CHARACTER_HUD.health.fillHeight * scale),
      k.color(220, 60, 60), // Red
      k.z(51),
      'ui-health-fill',
    ]);

    // XP fill (blue/purple bar - middle) - drawn on top of frame
    const xpFill = this.characterHudContainer.add([
      k.pos(CHARACTER_HUD.xp.fillX * scale, CHARACTER_HUD.xp.fillY * scale),
      k.rect(CHARACTER_HUD.xp.fillWidth * scale, CHARACTER_HUD.xp.fillHeight * scale),
      k.color(100, 150, 220), // Blue
      k.z(51),
      'ui-xp-fill',
    ]);

    // Currency text (bottom) - drawn on top
    const currencyText = this.characterHudContainer.add([
      k.text(this.currency.toString(), {
        size: CHARACTER_HUD.currency.fontSize,
        font: STUDYQUEST_FONT.name,
      }),
      k.pos(CHARACTER_HUD.currency.textX * scale, CHARACTER_HUD.currency.textY * scale),
      k.anchor('left'),
      k.color(80, 60, 40), // Brown text
      k.z(52),
      'ui-currency-text',
    ]);

    // Store references for updates
    const container = this.characterHudContainer as GameObj & {
      healthFill: GameObj;
      xpFill: GameObj;
      currencyText: GameObj;
    };
    container.healthFill = healthFill;
    container.xpFill = xpFill;
    container.currencyText = currencyText;

    // Initial updates
    this.updateHealth(this.currentHealth, this.maxHealth);
    this.updateXP(this.currentXP, this.maxXP);
    this.updateCurrency(this.currency);

    return this.characterHudContainer;
  }

  /**
   * Hide the character HUD
   */
  hideCharacterHud(): void {
    if (this.characterHudContainer) {
      this.characterHudContainer.destroy();
      this.characterHudContainer = null;
    }
  }

  /**
   * Update health bar fill
   */
  updateHealth(current: number, max: number): void {
    this.currentHealth = current;
    this.maxHealth = max;

    if (!this.characterHudContainer) return;

    const container = this.characterHudContainer as GameObj & { healthFill?: GameObj };
    const fill = container.healthFill;
    if (!fill) return;

    const k = this.k;
    const scale = 2;
    const percentage = Math.max(0, Math.min(1, current / max));
    const newWidth = CHARACTER_HUD.health.fillWidth * scale * percentage;

    // Update fill width
    fill.width = newWidth;

    // Change color based on health
    if (percentage > 0.5) {
      fill.color = k.rgb(220, 60, 60); // Red (healthy)
    } else if (percentage > 0.25) {
      fill.color = k.rgb(255, 193, 7); // Yellow (warning)
    } else {
      fill.color = k.rgb(180, 40, 40); // Dark red (critical)
    }
  }

  /**
   * Update XP bar fill
   */
  updateXP(current: number, max: number): void {
    this.currentXP = current;
    this.maxXP = max;

    if (!this.characterHudContainer) return;

    const container = this.characterHudContainer as GameObj & { xpFill?: GameObj };
    const fill = container.xpFill;
    if (!fill) return;

    const scale = 2;
    const percentage = Math.max(0, Math.min(1, current / max));
    const newWidth = CHARACTER_HUD.xp.fillWidth * scale * percentage;

    // Update fill width
    fill.width = newWidth;
  }

  /**
   * Update currency display
   */
  updateCurrency(amount: number): void {
    this.currency = amount;

    if (!this.characterHudContainer) return;

    const container = this.characterHudContainer as GameObj & { currencyText?: GameObj };
    const text = container.currencyText;
    if (!text) return;

    text.text = amount.toString();
  }

  // Legacy aliases for backwards compatibility
  async showHealthBar(x: number, y: number): Promise<GameObj> {
    return this.showCharacterHud(x, y);
  }

  hideHealthBar(): void {
    this.hideCharacterHud();
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Hide all UI elements
   */
  hideAll(): void {
    this.hideMainMenu();
    this.hideOkDialog();
    this.hideYesNoDialog();
    this.hideCharacterHud();
  }
}
