/**
 * StudyQuestSpriteRenderer
 *
 * Utility for loading sprite sheets and applying sprites to HTML elements.
 * Supports direct sprite application and 9-slice scaling for resizable panels.
 */

import { createLogger } from '../../../shared/logger.js';
import type { SpriteRegion, StudyQuestTheme } from './StudyQuestThemes.js';

const logger = createLogger('StudyQuestSpriteRenderer');

export class StudyQuestSpriteRenderer {
  private static instance: StudyQuestSpriteRenderer;
  private spriteCache: Map<string, HTMLImageElement> = new Map();
  private loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): StudyQuestSpriteRenderer {
    if (!StudyQuestSpriteRenderer.instance) {
      StudyQuestSpriteRenderer.instance = new StudyQuestSpriteRenderer();
    }
    return StudyQuestSpriteRenderer.instance;
  }

  /**
   * Load and cache a sprite sheet
   */
  async loadSpriteSheet(path: string): Promise<HTMLImageElement> {
    // Return cached image if available
    const cached = this.spriteCache.get(path);
    if (cached) {
      return cached;
    }

    // Return existing loading promise if in progress
    const loading = this.loadingPromises.get(path);
    if (loading) {
      return loading;
    }

    // Create new loading promise
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.spriteCache.set(path, img);
        this.loadingPromises.delete(path);
        logger.info(`Loaded sprite sheet: ${path}`);
        resolve(img);
      };
      img.onerror = () => {
        this.loadingPromises.delete(path);
        logger.error(`Failed to load sprite sheet: ${path}`);
        reject(new Error(`Failed to load: ${path}`));
      };
      img.src = path;
    });

    this.loadingPromises.set(path, promise);
    return promise;
  }

  /**
   * Check if a sprite sheet is loaded
   */
  isLoaded(path: string): boolean {
    return this.spriteCache.has(path);
  }

  /**
   * Get cached sprite sheet image
   */
  getCachedImage(path: string): HTMLImageElement | null {
    return this.spriteCache.get(path) || null;
  }

  /**
   * Apply a sprite region as CSS background to an element
   */
  applySpriteToElement(
    element: HTMLElement,
    spriteSheet: string,
    region: SpriteRegion,
    scale: number = 1
  ): void {
    const scaledWidth = region.width * scale;
    const scaledHeight = region.height * scale;

    element.style.backgroundImage = `url("${spriteSheet}")`;
    element.style.backgroundPosition = `-${region.x * scale}px -${region.y * scale}px`;
    element.style.backgroundSize = scale === 1 ? 'auto' : `${this.getSpriteSheetScaledSize(spriteSheet, scale)}`;
    element.style.backgroundRepeat = 'no-repeat';
    element.style.width = `${scaledWidth}px`;
    element.style.height = `${scaledHeight}px`;
    element.style.imageRendering = 'pixelated';
  }

  /**
   * Get scaled size string for background-size
   */
  private getSpriteSheetScaledSize(path: string, scale: number): string {
    const img = this.spriteCache.get(path);
    if (img) {
      return `${img.width * scale}px ${img.height * scale}px`;
    }
    return 'auto';
  }

  /**
   * Apply a sprite region as a STRETCHED background for flexible containers.
   * Extracts the region to a data URL and applies with background-size: 100% 100%.
   * Use this for panels/cards that need to contain content of varying sizes.
   */
  applySpriteAsBackground(
    element: HTMLElement,
    spriteSheet: string,
    region: SpriteRegion
  ): void {
    const img = this.spriteCache.get(spriteSheet);
    if (!img) {
      logger.warn(`Sprite sheet not loaded for background: ${spriteSheet}`);
      return;
    }

    // Extract just this region to a canvas
    const canvas = document.createElement('canvas');
    canvas.width = region.width;
    canvas.height = region.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      img,
      region.x, region.y, region.width, region.height,
      0, 0, region.width, region.height
    );

    // Convert to data URL and use as background
    const dataUrl = canvas.toDataURL('image/png');

    element.style.backgroundImage = `url("${dataUrl}")`;
    element.style.backgroundSize = '100% 100%'; // Stretch to fill element
    element.style.backgroundRepeat = 'no-repeat';
    element.style.backgroundPosition = 'center';
    element.style.imageRendering = 'pixelated';
  }

  /**
   * Apply sprite as a flexible-width button background
   * Uses the sprite but allows the element to have custom width
   */
  applySpriteButton(
    element: HTMLElement,
    spriteSheet: string,
    region: SpriteRegion,
    scale: number = 2
  ): void {
    const scaledHeight = region.height * scale;

    element.style.backgroundImage = `url("${spriteSheet}")`;
    element.style.backgroundPosition = `-${region.x * scale}px -${region.y * scale}px`;
    element.style.backgroundRepeat = 'no-repeat';
    element.style.backgroundSize = scale === 1 ? 'auto' : `${this.getSpriteSheetScaledSize(spriteSheet, scale)}`;
    element.style.minHeight = `${scaledHeight}px`;
    element.style.imageRendering = 'pixelated';
  }

  /**
   * Create a 9-slice panel element for resizable UI containers
   *
   * 9-slice divides the sprite into 9 regions:
   * [TL][T][TR]
   * [L ][C][R ]
   * [BL][B][BR]
   *
   * Corners stay fixed size, edges stretch, center fills
   */
  create9SlicePanel(
    spriteSheet: string,
    region: SpriteRegion,
    sliceInset: number,
    targetWidth: number,
    targetHeight: number,
    scale: number = 2
  ): HTMLElement {
    const container = document.createElement('div');
    container.className = 'sq-9slice-panel';

    const scaledInset = sliceInset * scale;
    const innerWidth = targetWidth - (scaledInset * 2);
    const innerHeight = targetHeight - (scaledInset * 2);

    container.style.cssText = `
      display: grid;
      grid-template-columns: ${scaledInset}px 1fr ${scaledInset}px;
      grid-template-rows: ${scaledInset}px 1fr ${scaledInset}px;
      width: ${targetWidth}px;
      height: ${targetHeight}px;
      image-rendering: pixelated;
    `;

    // Create 9 slice pieces
    const pieces = [
      { name: 'tl', col: 0, row: 0, srcX: 0, srcY: 0, w: sliceInset, h: sliceInset },
      { name: 't', col: 1, row: 0, srcX: sliceInset, srcY: 0, w: region.width - sliceInset * 2, h: sliceInset },
      { name: 'tr', col: 2, row: 0, srcX: region.width - sliceInset, srcY: 0, w: sliceInset, h: sliceInset },
      { name: 'l', col: 0, row: 1, srcX: 0, srcY: sliceInset, w: sliceInset, h: region.height - sliceInset * 2 },
      { name: 'c', col: 1, row: 1, srcX: sliceInset, srcY: sliceInset, w: region.width - sliceInset * 2, h: region.height - sliceInset * 2 },
      { name: 'r', col: 2, row: 1, srcX: region.width - sliceInset, srcY: sliceInset, w: sliceInset, h: region.height - sliceInset * 2 },
      { name: 'bl', col: 0, row: 2, srcX: 0, srcY: region.height - sliceInset, w: sliceInset, h: sliceInset },
      { name: 'b', col: 1, row: 2, srcX: sliceInset, srcY: region.height - sliceInset, w: region.width - sliceInset * 2, h: sliceInset },
      { name: 'br', col: 2, row: 2, srcX: region.width - sliceInset, srcY: region.height - sliceInset, w: sliceInset, h: sliceInset },
    ];

    for (const piece of pieces) {
      const el = document.createElement('div');
      el.className = `sq-9slice-${piece.name}`;

      const bgX = (region.x + piece.srcX) * scale;
      const bgY = (region.y + piece.srcY) * scale;

      el.style.cssText = `
        background-image: url("${spriteSheet}");
        background-position: -${bgX}px -${bgY}px;
        background-repeat: no-repeat;
        background-size: ${this.getSpriteSheetScaledSize(spriteSheet, scale)};
        image-rendering: pixelated;
      `;

      // For edges and center, we need to tile or stretch
      if (piece.name === 'c') {
        el.style.backgroundRepeat = 'repeat';
      } else if (piece.name === 't' || piece.name === 'b') {
        el.style.backgroundRepeat = 'repeat-x';
      } else if (piece.name === 'l' || piece.name === 'r') {
        el.style.backgroundRepeat = 'repeat-y';
      }

      container.appendChild(el);
    }

    return container;
  }

  /**
   * Apply theme colors as CSS variables to a container
   */
  applyThemeColors(container: HTMLElement, theme: StudyQuestTheme): void {
    const colors = theme.colors;

    // Core colors
    container.style.setProperty('--sq-primary', colors.primary);
    container.style.setProperty('--sq-secondary', colors.secondary);
    container.style.setProperty('--sq-accent', colors.accent);
    container.style.setProperty('--sq-background', colors.background);
    container.style.setProperty('--sq-surface', colors.surface);
    container.style.setProperty('--sq-surface-alt', colors.surfaceAlt);
    container.style.setProperty('--sq-border', colors.border);
    container.style.setProperty('--sq-shadow', colors.shadow);
    container.style.setProperty('--sq-text', colors.text);
    container.style.setProperty('--sq-text-muted', colors.textMuted);
    container.style.setProperty('--sq-text-on-primary', colors.textOnPrimary);
    container.style.setProperty('--sq-gold', colors.gold);
    container.style.setProperty('--sq-hp', colors.hp);
    container.style.setProperty('--sq-hp-bg', colors.hpBg);
    container.style.setProperty('--sq-xp', colors.xp);
    container.style.setProperty('--sq-xp-bg', colors.xpBg);

    // New semantic colors
    container.style.setProperty('--sq-success', colors.success);
    container.style.setProperty('--sq-danger', colors.danger);
    container.style.setProperty('--sq-warning', colors.warning);
  }

  /**
   * Draw a sprite region to a canvas context
   */
  drawToCanvas(
    ctx: CanvasRenderingContext2D,
    spriteSheet: HTMLImageElement,
    region: SpriteRegion,
    destX: number,
    destY: number,
    scale: number = 1
  ): void {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      spriteSheet,
      region.x,
      region.y,
      region.width,
      region.height,
      destX,
      destY,
      region.width * scale,
      region.height * scale
    );
  }

  /**
   * Draw a progress bar (like HP/XP) to canvas
   */
  drawProgressBar(
    ctx: CanvasRenderingContext2D,
    spriteSheet: HTMLImageElement,
    bgRegion: SpriteRegion,
    fillRegion: SpriteRegion,
    x: number,
    y: number,
    percentage: number,
    scale: number = 1
  ): void {
    // Draw background
    this.drawToCanvas(ctx, spriteSheet, bgRegion, x, y, scale);

    // Draw fill (clipped to percentage)
    if (percentage > 0) {
      const fillWidth = Math.floor(fillRegion.width * Math.min(1, percentage));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        spriteSheet,
        fillRegion.x,
        fillRegion.y,
        fillWidth,
        fillRegion.height,
        x,
        y,
        fillWidth * scale,
        fillRegion.height * scale
      );
    }
  }

  /**
   * Preload all theme sprite sheets
   */
  async preloadAllThemes(themes: StudyQuestTheme[]): Promise<void> {
    const loadPromises = themes
      .filter(t => t.spriteSheet)
      .map(t => this.loadSpriteSheet(t.spriteSheet!));

    await Promise.all(loadPromises);
    logger.info(`Preloaded ${loadPromises.length} theme sprite sheets`);
  }

  /**
   * Clear the sprite cache
   */
  clearCache(): void {
    this.spriteCache.clear();
    this.loadingPromises.clear();
    logger.info('Sprite cache cleared');
  }
}

// Export singleton getter
export const spriteRenderer = StudyQuestSpriteRenderer.getInstance();
