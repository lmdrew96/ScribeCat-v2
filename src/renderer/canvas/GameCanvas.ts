/**
 * GameCanvas
 *
 * Abstract base class for all canvas-based game features in StudyQuest.
 * Provides common functionality for rendering, animation loops, and input handling.
 *
 * Used by: TownCanvas, DungeonCanvas, StudyBuddyCanvas, BattleCanvas
 */

import { createLogger } from '../../shared/logger.js';

const logger = createLogger('GameCanvas');

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Point, Size {}

export abstract class GameCanvas {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  protected animationFrame: number | null = null;
  protected lastTime: number = 0;
  protected isRunning: boolean = false;

  // Input state
  protected keys: Set<string> = new Set();
  protected mousePosition: Point = { x: 0, y: 0 };
  protected mouseDown: boolean = false;

  // Canvas dimensions
  protected width: number;
  protected height: number;
  protected scale: number;

  constructor(canvas: HTMLCanvasElement, width: number = 480, height: number = 270, scale: number = 2) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.scale = scale;

    // Set canvas dimensions
    this.canvas.width = width;
    this.canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas 2D context');
    }

    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false; // Crisp pixel art

    // Bind input handlers
    this.setupInputHandlers();

    logger.info(`GameCanvas initialized: ${width}x${height}`);
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();

    const loop = (currentTime: number) => {
      if (!this.isRunning) return;

      const deltaTime = currentTime - this.lastTime;
      this.lastTime = currentTime;

      // Update game state
      this.update(deltaTime);

      // Render frame
      this.render();

      this.animationFrame = requestAnimationFrame(loop);
    };

    this.animationFrame = requestAnimationFrame(loop);
    logger.info('Game loop started');
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    this.isRunning = false;

    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    logger.info('Game loop stopped');
  }

  /**
   * Check if the game loop is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Clear the canvas with a solid color
   */
  protected clear(color: string = '#1a1a2e'): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Draw text with shadow (pixel art style)
   */
  protected drawText(
    text: string,
    x: number,
    y: number,
    color: string = '#ffffff',
    fontSize: number = 10,
    align: CanvasTextAlign = 'left'
  ): void {
    this.ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    this.ctx.textAlign = align;

    // Shadow
    this.ctx.fillStyle = '#000000';
    this.ctx.fillText(text, x + 1, y + 1);

    // Text
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
  }

  /**
   * Draw a sprite frame from a horizontal sprite sheet
   */
  protected drawSpriteFrame(
    image: HTMLImageElement,
    frameIndex: number,
    frameWidth: number,
    frameHeight: number,
    destX: number,
    destY: number,
    scale: number = this.scale,
    flipX: boolean = false
  ): void {
    const sx = frameIndex * frameWidth;
    const sy = 0;
    const dw = frameWidth * scale;
    const dh = frameHeight * scale;

    this.ctx.save();

    if (flipX) {
      this.ctx.translate(destX + dw / 2, destY);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(image, sx, sy, frameWidth, frameHeight, -dw / 2, 0, dw, dh);
    } else {
      this.ctx.drawImage(image, sx, sy, frameWidth, frameHeight, destX - dw / 2, destY, dw, dh);
    }

    this.ctx.restore();
  }

  /**
   * Draw a tile from a tileset
   */
  protected drawTile(
    tileset: HTMLImageElement,
    tileX: number,
    tileY: number,
    tileSize: number,
    destX: number,
    destY: number,
    scale: number = this.scale
  ): void {
    const sx = tileX * tileSize;
    const sy = tileY * tileSize;
    const dw = tileSize * scale;
    const dh = tileSize * scale;

    this.ctx.drawImage(tileset, sx, sy, tileSize, tileSize, destX, destY, dw, dh);
  }

  /**
   * Draw a filled rectangle
   */
  protected drawRect(rect: Rect, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  /**
   * Draw a rectangle outline
   */
  protected drawRectOutline(rect: Rect, color: string, lineWidth: number = 1): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }

  /**
   * Check if a key is currently pressed
   */
  protected isKeyDown(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  /**
   * Check for any directional input (WASD or arrow keys)
   */
  protected getDirectionalInput(): Point {
    let dx = 0;
    let dy = 0;

    if (this.isKeyDown('w') || this.isKeyDown('arrowup')) dy -= 1;
    if (this.isKeyDown('s') || this.isKeyDown('arrowdown')) dy += 1;
    if (this.isKeyDown('a') || this.isKeyDown('arrowleft')) dx -= 1;
    if (this.isKeyDown('d') || this.isKeyDown('arrowright')) dx += 1;

    return { x: dx, y: dy };
  }

  /**
   * Check if interact key is pressed (Enter or Space)
   */
  protected isInteractPressed(): boolean {
    return this.isKeyDown('enter') || this.isKeyDown(' ');
  }

  /**
   * Convert screen coordinates to canvas coordinates
   */
  protected screenToCanvas(screenX: number, screenY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: (screenX - rect.left) * scaleX,
      y: (screenY - rect.top) * scaleY,
    };
  }

  /**
   * Set up input event handlers
   */
  private setupInputHandlers(): void {
    // Keyboard
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));

    // Mouse
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('click', this.handleClick.bind(this));
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isRunning) return;

    const key = e.key.toLowerCase();
    const wasPressed = this.keys.has(key);
    this.keys.add(key);

    // Only trigger onKeyDown if this is a new press
    if (!wasPressed) {
      this.onKeyDown(key);
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (!this.isRunning) return;

    const key = e.key.toLowerCase();
    this.keys.delete(key);
    this.onKeyUp(key);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isRunning) return;

    this.mousePosition = this.screenToCanvas(e.clientX, e.clientY);
    this.onMouseMove(this.mousePosition);
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.isRunning) return;

    this.mouseDown = true;
    const pos = this.screenToCanvas(e.clientX, e.clientY);
    this.onMouseDown(pos);
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.isRunning) return;

    this.mouseDown = false;
    const pos = this.screenToCanvas(e.clientX, e.clientY);
    this.onMouseUp(pos);
  }

  private handleClick(e: MouseEvent): void {
    if (!this.isRunning) return;

    const pos = this.screenToCanvas(e.clientX, e.clientY);
    this.onClick(pos);
  }

  /**
   * Clean up event handlers
   */
  destroy(): void {
    this.stop();

    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('keyup', this.handleKeyUp.bind(this));

    logger.info('GameCanvas destroyed');
  }

  // ============================================================================
  // Abstract methods - must be implemented by subclasses
  // ============================================================================

  /**
   * Update game state
   * @param deltaTime - Time since last frame in milliseconds
   */
  protected abstract update(deltaTime: number): void;

  /**
   * Render the current frame
   */
  protected abstract render(): void;

  // ============================================================================
  // Optional hooks - can be overridden by subclasses
  // ============================================================================

  /**
   * Called when a key is first pressed
   */
  protected onKeyDown(key: string): void {
    // Override in subclass
  }

  /**
   * Called when a key is released
   */
  protected onKeyUp(key: string): void {
    // Override in subclass
  }

  /**
   * Called when mouse moves
   */
  protected onMouseMove(position: Point): void {
    // Override in subclass
  }

  /**
   * Called when mouse button is pressed
   */
  protected onMouseDown(position: Point): void {
    // Override in subclass
  }

  /**
   * Called when mouse button is released
   */
  protected onMouseUp(position: Point): void {
    // Override in subclass
  }

  /**
   * Called when canvas is clicked
   */
  protected onClick(position: Point): void {
    // Override in subclass
  }
}
