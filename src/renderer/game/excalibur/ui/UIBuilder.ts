/**
 * UIBuilder - Factory for creating reusable Canvas UI components
 *
 * Consolidates common UI patterns (panels, buttons, labels, lists) into
 * reusable factory methods. Uses Excalibur's native NineSlice for scalable
 * panel rendering with UI sprite assets.
 *
 * This replaces the repetitive manual Actor + Rectangle pattern used across scenes.
 */

import * as ex from 'excalibur';
import { SceneFontCache, CommonFonts } from './FontCache.js';
import { UI_LAYERS, UI_PADDING, MENU_ITEM_HEIGHT, MAX_VISIBLE_ITEMS } from './UIConstants.js';
import { loadUISprite, getCurrentTheme, type UITheme } from '../../loaders/UISpriteLoader.js';

/**
 * Panel configuration options
 */
export interface PanelOptions {
  /** X position (center) */
  x: number;
  /** Y position (center) */
  y: number;
  /** Panel width */
  width: number;
  /** Panel height */
  height: number;
  /** Z-index layer (defaults to UI_LAYERS.MENU) */
  z?: number;
  /** UI theme (defaults to current theme) */
  theme?: UITheme;
  /** Background color hex (fallback if sprite fails) */
  backgroundColor?: string;
  /** Border color hex */
  borderColor?: string;
  /** Border width */
  borderWidth?: number;
  /** Whether to use 9-slice sprite (true) or simple rectangle (false) */
  useNineSlice?: boolean;
}

/**
 * Button configuration options
 */
export interface ButtonOptions {
  /** Button text */
  text: string;
  /** X position (center) */
  x: number;
  /** Y position (center) */
  y: number;
  /** Whether button is currently selected/highlighted */
  selected?: boolean;
  /** Z-index layer */
  z?: number;
  /** Font size */
  fontSize?: number;
  /** Normal text color */
  color?: string;
  /** Selected/highlighted text color */
  selectedColor?: string;
  /** Background width (0 = no background) */
  width?: number;
  /** Background height (0 = no background) */
  height?: number;
  /** Show selection indicator (e.g., "> text <") */
  showIndicator?: boolean;
}

/**
 * Label configuration options
 */
export interface LabelOptions {
  /** Label text */
  text: string;
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Z-index layer */
  z?: number;
  /** Font size */
  fontSize?: number;
  /** Text color (hex string) */
  color?: string;
  /** Text anchor (defaults to Half = center) */
  anchor?: ex.Vector;
}

/**
 * Scrollable list item
 */
export interface ListItem {
  /** Unique identifier */
  id: string;
  /** Display text */
  text: string;
  /** Secondary text (e.g., price, quantity) */
  subtext?: string;
  /** Whether item is disabled/grayed out */
  disabled?: boolean;
}

/**
 * Scrollable list configuration
 */
export interface ScrollableListOptions {
  /** List items */
  items: ListItem[];
  /** X position (left edge) */
  x: number;
  /** Y position (top of first item) */
  y: number;
  /** List width */
  width: number;
  /** Currently selected index */
  selectedIndex: number;
  /** Scroll offset (first visible item index) */
  scrollOffset?: number;
  /** Maximum visible items (defaults to MAX_VISIBLE_ITEMS) */
  maxVisible?: number;
  /** Z-index layer */
  z?: number;
  /** Item height (defaults to MENU_ITEM_HEIGHT) */
  itemHeight?: number;
  /** Show scroll indicators */
  showScrollIndicators?: boolean;
}

/**
 * Tab bar configuration
 */
export interface TabBarOptions {
  /** Tab labels */
  tabs: string[];
  /** X position (center) */
  x: number;
  /** Y position */
  y: number;
  /** Currently selected tab index */
  selectedIndex: number;
  /** Tab width */
  tabWidth?: number;
  /** Z-index layer */
  z?: number;
  /** Max characters to show per tab (truncate) */
  maxChars?: number;
}

/**
 * Toast message configuration
 */
export interface ToastOptions {
  /** Message text */
  text: string;
  /** X position (center) */
  x: number;
  /** Y position (center) */
  y: number;
  /** Toast width */
  width?: number;
  /** Toast height */
  height?: number;
  /** Z-index layer */
  z?: number;
  /** Text color */
  color?: string;
  /** Background color */
  backgroundColor?: string;
  /** Duration in ms before auto-fade (0 = no auto-fade) */
  duration?: number;
}

/**
 * Result of creating a scrollable list
 */
export interface ScrollableListResult {
  /** All actors created (add to scene, track for cleanup) */
  actors: ex.Actor[];
  /** Whether there are more items above the visible area */
  hasScrollUp: boolean;
  /** Whether there are more items below the visible area */
  hasScrollDown: boolean;
}

/**
 * NineSlice configuration for panel sprites
 * These margins define where to slice the source image
 */
const NINE_SLICE_CONFIG = {
  // Default margins for MAINMENU panel sprites
  // Adjust these based on actual asset dimensions
  topMargin: 8,
  leftMargin: 8,
  bottomMargin: 8,
  rightMargin: 8,
  sourceWidth: 64,
  sourceHeight: 64,
};

/**
 * UIBuilder - Factory class for creating UI components
 */
export class UIBuilder {
  private fontCache: SceneFontCache;
  private theme: UITheme;

  constructor(fontCache?: SceneFontCache, theme?: UITheme) {
    this.fontCache = fontCache || new SceneFontCache();
    this.theme = theme || getCurrentTheme();
  }

  /**
   * Set the current theme for new components
   */
  setTheme(theme: UITheme): void {
    this.theme = theme;
  }

  /**
   * Get the font cache (for direct font access if needed)
   */
  getFontCache(): SceneFontCache {
    return this.fontCache;
  }

  /**
   * Create a panel background actor
   * Uses NineSlice for scalable sprite panels, falls back to Rectangle
   */
  async createPanel(options: PanelOptions): Promise<ex.Actor> {
    const {
      x,
      y,
      width,
      height,
      z = UI_LAYERS.MENU,
      theme = this.theme,
      backgroundColor = '#1E1E32',
      borderColor = '#6496FF',
      borderWidth = 3,
      useNineSlice = true,
    } = options;

    const actor = new ex.Actor({
      pos: new ex.Vector(x, y),
      anchor: ex.Vector.Half,
      z,
    });

    if (useNineSlice) {
      try {
        // Try to load the UI sprite for NineSlice
        const sprite = await loadUISprite('mainmenu', theme);
        if (sprite && sprite.image) {
          const nineSlice = new ex.NineSlice({
            width,
            height,
            source: sprite.image,
            sourceConfig: {
              width: NINE_SLICE_CONFIG.sourceWidth,
              height: NINE_SLICE_CONFIG.sourceHeight,
              topMargin: NINE_SLICE_CONFIG.topMargin,
              leftMargin: NINE_SLICE_CONFIG.leftMargin,
              bottomMargin: NINE_SLICE_CONFIG.bottomMargin,
              rightMargin: NINE_SLICE_CONFIG.rightMargin,
            },
            destinationConfig: {
              drawCenter: true,
              horizontalStretch: ex.NineSliceStretch.TileFit,
              verticalStretch: ex.NineSliceStretch.TileFit,
            },
          });
          actor.graphics.use(nineSlice);
          return actor;
        }
      } catch (err) {
        console.warn('[UIBuilder] NineSlice failed, using fallback rectangle:', err);
      }
    }

    // Fallback to simple rectangle
    actor.graphics.use(
      new ex.Rectangle({
        width,
        height,
        color: ex.Color.fromHex(backgroundColor),
        strokeColor: ex.Color.fromHex(borderColor),
        lineWidth: borderWidth,
      })
    );

    return actor;
  }

  /**
   * Create a panel synchronously (no NineSlice, just Rectangle)
   * Use this when async is not practical
   */
  createPanelSync(options: PanelOptions): ex.Actor {
    const {
      x,
      y,
      width,
      height,
      z = UI_LAYERS.MENU,
      backgroundColor = '#1E1E32',
      borderColor = '#6496FF',
      borderWidth = 3,
    } = options;

    const actor = new ex.Actor({
      pos: new ex.Vector(x, y),
      anchor: ex.Vector.Half,
      z,
    });

    actor.graphics.use(
      new ex.Rectangle({
        width,
        height,
        color: ex.Color.fromHex(backgroundColor),
        strokeColor: ex.Color.fromHex(borderColor),
        lineWidth: borderWidth,
      })
    );

    return actor;
  }

  /**
   * Create a text label
   */
  createLabel(options: LabelOptions): ex.Label {
    const {
      text,
      x,
      y,
      z = UI_LAYERS.MENU + 1,
      fontSize = 13,
      color = '#FFFFFF',
      anchor = ex.Vector.Half,
    } = options;

    const font = this.fontCache.getFontHex(fontSize, color);

    const label = new ex.Label({
      text,
      pos: new ex.Vector(x, y),
      font,
      z,
    });
    label.graphics.anchor = anchor;

    return label;
  }

  /**
   * Create a button (label with optional background and selection state)
   */
  createButton(options: ButtonOptions): { actors: ex.Actor[]; label: ex.Label } {
    const {
      text,
      x,
      y,
      selected = false,
      z = UI_LAYERS.MENU + 1,
      fontSize = 13,
      color = '#FFFFFF',
      selectedColor = '#FBBF24',
      width = 0,
      height = 0,
      showIndicator = true,
    } = options;

    const actors: ex.Actor[] = [];

    // Create background if dimensions provided
    if (width > 0 && height > 0) {
      const bg = new ex.Actor({
        pos: new ex.Vector(x, y),
        anchor: ex.Vector.Half,
        z: z - 1,
      });
      bg.graphics.use(
        new ex.Rectangle({
          width,
          height,
          color: selected
            ? ex.Color.fromRGB(100, 150, 255, 0.3)
            : ex.Color.fromRGB(0, 0, 0, 0.4),
        })
      );
      actors.push(bg);
    }

    // Create label
    const displayText = selected && showIndicator ? `> ${text} <` : text;
    const textColor = selected ? selectedColor : color;
    const font = this.fontCache.getFontHex(fontSize, textColor);

    const label = new ex.Label({
      text: displayText,
      pos: new ex.Vector(x, y),
      font,
      z,
    });
    label.graphics.anchor = ex.Vector.Half;
    actors.push(label);

    return { actors, label };
  }

  /**
   * Create a scrollable list of items
   */
  createScrollableList(options: ScrollableListOptions): ScrollableListResult {
    const {
      items,
      x,
      y,
      width,
      selectedIndex,
      scrollOffset = 0,
      maxVisible = MAX_VISIBLE_ITEMS,
      z = UI_LAYERS.MENU + 1,
      itemHeight = MENU_ITEM_HEIGHT,
      showScrollIndicators = true,
    } = options;

    const actors: ex.Actor[] = [];
    const visibleItems = items.slice(scrollOffset, scrollOffset + maxVisible);
    const hasScrollUp = scrollOffset > 0;
    const hasScrollDown = scrollOffset + maxVisible < items.length;

    // Scroll up indicator
    if (showScrollIndicators && hasScrollUp) {
      const upIndicator = this.createLabel({
        text: '▲ more',
        x: x + width / 2,
        y: y - 10,
        fontSize: 10,
        color: '#888888',
        z,
      });
      actors.push(upIndicator);
    }

    // Render visible items
    visibleItems.forEach((item, i) => {
      const actualIndex = scrollOffset + i;
      const isSelected = actualIndex === selectedIndex;
      const itemY = y + i * itemHeight;

      // Selection highlight background
      if (isSelected) {
        const highlight = new ex.Actor({
          pos: new ex.Vector(x + width / 2, itemY),
          anchor: ex.Vector.Half,
          z: z - 1,
        });
        highlight.graphics.use(
          new ex.Rectangle({
            width: width - UI_PADDING.SMALL * 2,
            height: itemHeight - 2,
            color: ex.Color.fromRGB(100, 150, 255, 0.3),
          })
        );
        actors.push(highlight);
      }

      // Item text
      const textColor = item.disabled ? '#666666' : isSelected ? '#FBBF24' : '#FFFFFF';
      const itemLabel = this.createLabel({
        text: item.text,
        x: x + UI_PADDING.MEDIUM,
        y: itemY,
        fontSize: 12,
        color: textColor,
        anchor: ex.Vector.Zero,
        z,
      });
      actors.push(itemLabel);

      // Subtext (right-aligned)
      if (item.subtext) {
        const subtextColor = item.disabled ? '#444444' : '#AAAAAA';
        const subtextLabel = this.createLabel({
          text: item.subtext,
          x: x + width - UI_PADDING.MEDIUM,
          y: itemY,
          fontSize: 11,
          color: subtextColor,
          anchor: new ex.Vector(1, 0), // Right-aligned
          z,
        });
        actors.push(subtextLabel);
      }
    });

    // Scroll down indicator
    if (showScrollIndicators && hasScrollDown) {
      const downIndicator = this.createLabel({
        text: '▼ more',
        x: x + width / 2,
        y: y + maxVisible * itemHeight + 5,
        fontSize: 10,
        color: '#888888',
        z,
      });
      actors.push(downIndicator);
    }

    return { actors, hasScrollUp, hasScrollDown };
  }

  /**
   * Create a tab bar
   */
  createTabBar(options: TabBarOptions): ex.Actor[] {
    const {
      tabs,
      x,
      y,
      selectedIndex,
      tabWidth = 50,
      z = UI_LAYERS.MENU + 2,
      maxChars = 5,
    } = options;

    const actors: ex.Actor[] = [];
    const totalWidth = tabs.length * tabWidth;
    const startX = x - totalWidth / 2 + tabWidth / 2;

    tabs.forEach((tab, i) => {
      const isSelected = i === selectedIndex;
      const tabX = startX + i * tabWidth;
      const displayText = tab.length > maxChars ? tab.substring(0, maxChars) : tab;

      const textColor = isSelected ? '#FBBF24' : '#B4B4B4';
      const font = this.fontCache.getFontHex(11, textColor);

      const tabLabel = new ex.Label({
        text: displayText,
        pos: new ex.Vector(tabX, y),
        font,
        z,
      });
      tabLabel.graphics.anchor = ex.Vector.Half;
      actors.push(tabLabel);

      // Underline for selected tab
      if (isSelected) {
        const underline = new ex.Actor({
          pos: new ex.Vector(tabX, y + 8),
          anchor: ex.Vector.Half,
          z: z - 1,
        });
        underline.graphics.use(
          new ex.Rectangle({
            width: tabWidth - 4,
            height: 2,
            color: ex.Color.fromHex('#FBBF24'),
          })
        );
        actors.push(underline);
      }
    });

    return actors;
  }

  /**
   * Create a toast/message notification
   */
  createToast(options: ToastOptions): { actors: ex.Actor[]; fadeOut: () => void } {
    const {
      text,
      x,
      y,
      width = 300,
      height = 40,
      z = UI_LAYERS.OVERLAY,
      color = '#FFFFFF',
      backgroundColor = 'rgba(0,0,0,0.8)',
      duration = 0,
    } = options;

    const actors: ex.Actor[] = [];

    // Background
    const bg = new ex.Actor({
      pos: new ex.Vector(x, y),
      anchor: ex.Vector.Half,
      z,
    });
    bg.graphics.use(
      new ex.Rectangle({
        width,
        height,
        color: ex.Color.fromRGB(0, 0, 0, 0.8),
        strokeColor: ex.Color.fromHex('#6496FF'),
        lineWidth: 2,
      })
    );
    actors.push(bg);

    // Text
    const label = this.createLabel({
      text,
      x,
      y,
      fontSize: 12,
      color,
      z: z + 1,
    });
    actors.push(label);

    // Fade out function
    const fadeOut = () => {
      actors.forEach((actor) => {
        actor.actions.fade(0, 300).callMethod(() => actor.kill());
      });
    };

    // Auto-fade if duration specified
    if (duration > 0) {
      setTimeout(fadeOut, duration);
    }

    return { actors, fadeOut };
  }

  /**
   * Create a simple horizontal divider line
   */
  createDivider(x: number, y: number, width: number, z = UI_LAYERS.MENU): ex.Actor {
    const divider = new ex.Actor({
      pos: new ex.Vector(x, y),
      anchor: ex.Vector.Half,
      z,
    });
    divider.graphics.use(
      new ex.Rectangle({
        width,
        height: 1,
        color: ex.Color.fromRGB(100, 100, 100, 0.5),
      })
    );
    return divider;
  }

  /**
   * Create a semi-transparent backdrop overlay
   */
  createBackdrop(
    width: number,
    height: number,
    opacity = 0.7,
    z = UI_LAYERS.OVERLAY - 1
  ): ex.Actor {
    const backdrop = new ex.Actor({
      pos: new ex.Vector(width / 2, height / 2),
      anchor: ex.Vector.Half,
      z,
    });
    backdrop.graphics.use(
      new ex.Rectangle({
        width,
        height,
        color: ex.Color.fromRGB(0, 0, 0, opacity),
      })
    );
    return backdrop;
  }

  /**
   * Clean up the font cache (call on scene deactivation)
   */
  dispose(): void {
    this.fontCache.clear();
  }
}

/**
 * Create a UIBuilder instance with a new font cache
 */
export function createUIBuilder(theme?: UITheme): UIBuilder {
  return new UIBuilder(new SceneFontCache(), theme);
}

/**
 * Utility: Kill all actors in an array and clear the array
 */
export function clearActors(actors: ex.Actor[]): void {
  for (const actor of actors) {
    actor.kill();
  }
  actors.length = 0;
}
