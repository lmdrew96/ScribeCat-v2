/**
 * FontCache - Shared font caching utility for Excalibur scenes
 *
 * Creates and caches ex.Font instances to avoid creating new Font objects
 * on every render, which improves performance and reduces garbage collection.
 */

import * as ex from 'excalibur';

/**
 * Font configuration key for caching
 */
interface FontConfig {
  size: number;
  color: string;
}

/**
 * Generate a cache key from font configuration
 */
function getFontKey(size: number, color: string): string {
  return `${size}:${color}`;
}

/**
 * SceneFontCache - Per-scene font caching
 *
 * Each scene should create its own FontCache instance to manage fonts
 * used in that scene. Fonts are cached by size and color combination.
 */
export class SceneFontCache {
  private cache: Map<string, ex.Font> = new Map();

  /**
   * Get or create a cached font with the specified size and color
   */
  getFont(size: number, color: ex.Color): ex.Font {
    const colorKey = color.toHex();
    const key = getFontKey(size, colorKey);

    let font = this.cache.get(key);
    if (!font) {
      font = new ex.Font({ size, color });
      this.cache.set(key, font);
    }
    return font;
  }

  /**
   * Get or create a cached font with the specified size and hex color string
   */
  getFontHex(size: number, hexColor: string): ex.Font {
    const key = getFontKey(size, hexColor);

    let font = this.cache.get(key);
    if (!font) {
      font = new ex.Font({ size, color: ex.Color.fromHex(hexColor) });
      this.cache.set(key, font);
    }
    return font;
  }

  /**
   * Get or create a cached font with RGB(A) color
   */
  getFontRGB(size: number, r: number, g: number, b: number, a = 1): ex.Font {
    const colorKey = `rgba(${r},${g},${b},${a})`;
    const key = getFontKey(size, colorKey);

    let font = this.cache.get(key);
    if (!font) {
      font = new ex.Font({ size, color: ex.Color.fromRGB(r, g, b, a) });
      this.cache.set(key, font);
    }
    return font;
  }

  /**
   * Clear all cached fonts (call on scene deactivation if needed)
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached fonts
   */
  get size(): number {
    return this.cache.size;
  }
}

/**
 * Common font configurations used across scenes
 */
export const CommonFonts = {
  // White fonts at common sizes
  WHITE_12: { size: 12, color: '#FFFFFF' },
  WHITE_13: { size: 13, color: '#FFFFFF' },
  WHITE_14: { size: 14, color: '#FFFFFF' },
  WHITE_16: { size: 16, color: '#FFFFFF' },
  WHITE_20: { size: 20, color: '#FFFFFF' },

  // Gold/Yellow fonts
  GOLD_12: { size: 12, color: '#FBBF24' },
  GOLD_13: { size: 13, color: '#FBBF24' },
  GOLD_14: { size: 14, color: '#FBBF24' },

  // Gray/muted fonts
  GRAY_12: { size: 12, r: 200, g: 200, b: 200 },
  GRAY_13: { size: 13, r: 200, g: 200, b: 200 },
  MUTED_12: { size: 12, r: 150, g: 150, b: 150 },

  // Status colors
  GREEN_14: { size: 14, color: '#64FF64' },
  RED_14: { size: 14, color: '#FF6464' },
  BLUE_14: { size: 14, color: '#6496FF' },
} as const;
