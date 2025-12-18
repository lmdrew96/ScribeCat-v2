/**
 * UIOverlayManager - HTML overlay orchestrator for hybrid Canvas/HTML UI
 *
 * Manages an HTML layer positioned above the Excalibur canvas for complex UI
 * elements like menus, dialogs, tooltips that are better suited to HTML/CSS.
 *
 * Key responsibilities:
 * - Create and manage overlay container positioned over the canvas
 * - Register/show/hide named overlay components
 * - Handle input focus switching between game and HTML layers
 * - Convert game coordinates to page coordinates for positioning
 * - Emit events when overlays open/close for game input management
 */

import * as ex from 'excalibur';

/**
 * Simple typed event emitter for browser context
 */
type EventHandler = (...args: unknown[]) => void;

class SimpleEventEmitter {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, ...args: unknown[]): void {
    this.handlers.get(event)?.forEach((handler) => handler(...args));
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }
}

/**
 * Events emitted by UIOverlayManager
 */
export interface UIOverlayEvents {
  /** Fired when any overlay is opened */
  'overlay:opened': (id: string) => void;
  /** Fired when any overlay is closed */
  'overlay:closed': (id: string) => void;
  /** Fired when all overlays are closed */
  'all:closed': () => void;
}

/**
 * Overlay component interface
 */
export interface OverlayComponent {
  /** Unique identifier */
  id: string;
  /** The HTML element */
  element: HTMLElement;
  /** Whether this overlay should block game input when visible */
  blocksInput?: boolean;
  /** Z-index offset (relative to base overlay z-index) */
  zOffset?: number;
  /** Called when the overlay is shown */
  onShow?: () => void;
  /** Called when the overlay is hidden */
  onHide?: () => void;
}

/**
 * Configuration for UIOverlayManager
 */
export interface UIOverlayManagerConfig {
  /** The Excalibur engine instance */
  engine: ex.Engine;
  /** Parent element to append overlay container to (defaults to canvas parent) */
  parentElement?: HTMLElement;
  /** Base z-index for overlay container */
  baseZIndex?: number;
  /** CSS class to add to overlay container */
  containerClass?: string;
}

/**
 * UIOverlayManager manages HTML overlays above the game canvas
 */
export class UIOverlayManager extends SimpleEventEmitter {
  private engine: ex.Engine;
  private container: HTMLDivElement;
  private overlays: Map<string, OverlayComponent> = new Map();
  private visibleOverlays: Set<string> = new Set();
  private baseZIndex: number;

  // Pixel conversion for scaling
  private pixelConversion = 1;

  constructor(config: UIOverlayManagerConfig) {
    super();

    this.engine = config.engine;
    this.baseZIndex = config.baseZIndex ?? 100;

    // Create overlay container
    this.container = document.createElement('div');
    this.container.className = config.containerClass ?? 'game-ui-overlay';
    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: ${this.baseZIndex};
      overflow: hidden;
    `;

    // Append to parent element (or canvas parent)
    const parent = config.parentElement ?? this.engine.canvas.parentElement;
    if (parent) {
      // Ensure parent has relative positioning for absolute overlay
      const parentPosition = getComputedStyle(parent).position;
      if (parentPosition === 'static') {
        parent.style.position = 'relative';
      }
      parent.appendChild(this.container);
    } else {
      console.warn('[UIOverlayManager] No parent element found for overlay container');
    }

    // Update pixel conversion on resize
    this.engine.screen.events.on('resize', () => this.updatePixelConversion());
    this.updatePixelConversion();
  }

  /**
   * Update pixel conversion factor for coordinate transformations
   */
  private updatePixelConversion(): void {
    try {
      const origin = this.engine.screen.worldToPageCoordinates(ex.Vector.Zero);
      const singlePixel = this.engine.screen.worldToPageCoordinates(ex.vec(1, 0)).sub(origin);
      this.pixelConversion = singlePixel.x || 1;
      this.container.style.setProperty('--pixel-conversion', this.pixelConversion.toString());
    } catch {
      this.pixelConversion = 1;
    }
  }

  /**
   * Convert game world position to page coordinates
   */
  worldToPagePosition(worldPos: ex.Vector): { x: number; y: number } {
    const pagePos = this.engine.screen.worldToPageCoordinates(worldPos);
    return { x: pagePos.x, y: pagePos.y };
  }

  /**
   * Convert screen position to page coordinates
   */
  screenToPagePosition(screenPos: ex.Vector): { x: number; y: number } {
    const pagePos = this.engine.screen.screenToPageCoordinates(screenPos);
    return { x: pagePos.x, y: pagePos.y };
  }

  /**
   * Register an overlay component
   */
  registerOverlay(component: OverlayComponent): void {
    const { id, element, blocksInput = true, zOffset = 0 } = component;

    // Style the element
    element.style.position = 'absolute';
    element.style.display = 'none';
    element.style.pointerEvents = blocksInput ? 'auto' : 'none';
    element.style.zIndex = String(this.baseZIndex + 1 + zOffset);
    element.dataset.overlayId = id;

    this.container.appendChild(element);
    this.overlays.set(id, component);
  }

  /**
   * Unregister and remove an overlay
   */
  unregisterOverlay(id: string): void {
    const overlay = this.overlays.get(id);
    if (overlay) {
      overlay.element.remove();
      this.overlays.delete(id);
      this.visibleOverlays.delete(id);
    }
  }

  /**
   * Show an overlay
   */
  showOverlay(id: string): boolean {
    const overlay = this.overlays.get(id);
    if (!overlay) {
      console.warn(`[UIOverlayManager] Overlay not found: ${id}`);
      return false;
    }

    overlay.element.style.display = 'block';
    this.visibleOverlays.add(id);

    overlay.onShow?.();
    this.emit('overlay:opened', id);

    return true;
  }

  /**
   * Hide an overlay
   */
  hideOverlay(id: string): boolean {
    const overlay = this.overlays.get(id);
    if (!overlay) return false;

    overlay.element.style.display = 'none';
    this.visibleOverlays.delete(id);

    overlay.onHide?.();
    this.emit('overlay:closed', id);

    // Check if all overlays are now closed
    if (this.visibleOverlays.size === 0) {
      this.emit('all:closed');
    }

    return true;
  }

  /**
   * Toggle an overlay's visibility
   */
  toggleOverlay(id: string): boolean {
    if (this.isOverlayVisible(id)) {
      return this.hideOverlay(id);
    } else {
      return this.showOverlay(id);
    }
  }

  /**
   * Hide all visible overlays
   */
  hideAllOverlays(): void {
    for (const id of this.visibleOverlays) {
      this.hideOverlay(id);
    }
  }

  /**
   * Check if an overlay is visible
   */
  isOverlayVisible(id: string): boolean {
    return this.visibleOverlays.has(id);
  }

  /**
   * Check if any input-blocking overlay is visible
   */
  hasBlockingOverlay(): boolean {
    for (const id of this.visibleOverlays) {
      const overlay = this.overlays.get(id);
      if (overlay?.blocksInput !== false) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get list of visible overlay IDs
   */
  getVisibleOverlays(): string[] {
    return Array.from(this.visibleOverlays);
  }

  /**
   * Position an overlay at specific game coordinates
   */
  positionAt(
    id: string,
    gamePos: ex.Vector,
    options?: {
      offset?: { x: number; y: number };
      anchor?: 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    }
  ): void {
    const overlay = this.overlays.get(id);
    if (!overlay) return;

    const { offset = { x: 0, y: 0 }, anchor = 'top-left' } = options ?? {};
    const pagePos = this.worldToPagePosition(gamePos);

    // Get the canvas bounds for relative positioning
    const canvasRect = this.engine.canvas.getBoundingClientRect();
    const relativeX = pagePos.x - canvasRect.left + offset.x;
    const relativeY = pagePos.y - canvasRect.top + offset.y;

    // Apply anchor-based transform
    let transform = '';
    switch (anchor) {
      case 'top-center':
        transform = 'translateX(-50%)';
        break;
      case 'top-right':
        transform = 'translateX(-100%)';
        break;
      case 'center':
        transform = 'translate(-50%, -50%)';
        break;
      case 'bottom-left':
        transform = 'translateY(-100%)';
        break;
      case 'bottom-center':
        transform = 'translate(-50%, -100%)';
        break;
      case 'bottom-right':
        transform = 'translate(-100%, -100%)';
        break;
      default:
        transform = '';
    }

    overlay.element.style.left = `${relativeX}px`;
    overlay.element.style.top = `${relativeY}px`;
    overlay.element.style.transform = transform;
  }

  /**
   * Center an overlay in the game canvas
   */
  centerOverlay(id: string): void {
    const overlay = this.overlays.get(id);
    if (!overlay) return;

    overlay.element.style.left = '50%';
    overlay.element.style.top = '50%';
    overlay.element.style.transform = 'translate(-50%, -50%)';
  }

  /**
   * Get the overlay container element
   */
  getContainer(): HTMLDivElement {
    return this.container;
  }

  /**
   * Get an overlay component by ID
   */
  getOverlay(id: string): OverlayComponent | undefined {
    return this.overlays.get(id);
  }

  /**
   * Get the pixel conversion factor
   */
  getPixelConversion(): number {
    return this.pixelConversion;
  }

  /**
   * Create a simple overlay element with common styles
   */
  static createOverlayElement(
    className?: string,
    styles?: Partial<CSSStyleDeclaration>
  ): HTMLDivElement {
    const element = document.createElement('div');
    if (className) {
      element.className = className;
    }

    // Apply base panel styles
    Object.assign(element.style, {
      backgroundColor: 'var(--panel-bg, #1E1E32)',
      border: '3px solid var(--panel-border, #6496FF)',
      borderRadius: '8px',
      padding: '16px',
      color: 'var(--text-color, #FFFFFF)',
      fontFamily: 'var(--font-family, sans-serif)',
      fontSize: '13px',
      boxShadow: '4px 4px 0 rgba(0, 0, 0, 0.5)',
      ...styles,
    });

    return element;
  }

  /**
   * Clean up and remove the overlay manager
   */
  destroy(): void {
    this.hideAllOverlays();
    this.overlays.clear();
    this.visibleOverlays.clear();
    this.container.remove();
    this.removeAllListeners();
  }
}

/**
 * Create common overlay CSS styles (inject once into document)
 */
export function injectOverlayStyles(): void {
  if (document.getElementById('game-overlay-styles')) return;

  const styles = document.createElement('style');
  styles.id = 'game-overlay-styles';
  styles.textContent = `
    /* Game UI Overlay Base Styles */
    .game-ui-overlay {
      --panel-bg: #1E1E32;
      --panel-bg-light: #2A2A4E;
      --panel-border: #6496FF;
      --text-color: #FFFFFF;
      --text-muted: #888888;
      --text-highlight: #FBBF24;
      --text-success: #64FF64;
      --text-error: #FF6464;
      --button-bg: #3A3A5E;
      --button-hover: #4A4A7E;
      --button-active: #5A5A9E;
      --scrollbar-bg: #1E1E32;
      --scrollbar-thumb: #6496FF;
    }

    /* Pixel-art text rendering */
    .game-ui-overlay * {
      image-rendering: pixelated;
      -webkit-font-smoothing: none;
    }

    /* Common panel styles */
    .game-overlay-panel {
      background-color: var(--panel-bg);
      border: 3px solid var(--panel-border);
      border-radius: 8px;
      padding: 16px;
      color: var(--text-color);
      box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.5);
    }

    /* Scrollable list styles */
    .game-overlay-list {
      max-height: 200px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-bg);
    }

    .game-overlay-list::-webkit-scrollbar {
      width: 8px;
    }

    .game-overlay-list::-webkit-scrollbar-track {
      background: var(--scrollbar-bg);
    }

    .game-overlay-list::-webkit-scrollbar-thumb {
      background-color: var(--scrollbar-thumb);
      border-radius: 4px;
    }

    /* List item styles */
    .game-overlay-item {
      padding: 8px 12px;
      cursor: pointer;
      border-radius: 4px;
      transition: background-color 0.1s;
    }

    .game-overlay-item:hover {
      background-color: var(--button-hover);
    }

    .game-overlay-item.selected {
      background-color: rgba(100, 150, 255, 0.3);
      color: var(--text-highlight);
    }

    .game-overlay-item.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Button styles */
    .game-overlay-button {
      background-color: var(--button-bg);
      border: 2px solid var(--panel-border);
      border-radius: 4px;
      padding: 8px 16px;
      color: var(--text-color);
      cursor: pointer;
      font-size: 12px;
      transition: background-color 0.1s;
    }

    .game-overlay-button:hover {
      background-color: var(--button-hover);
    }

    .game-overlay-button:active {
      background-color: var(--button-active);
    }

    .game-overlay-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Tab bar styles */
    .game-overlay-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 12px;
      border-bottom: 2px solid var(--panel-border);
      padding-bottom: 8px;
    }

    .game-overlay-tab {
      padding: 6px 12px;
      cursor: pointer;
      border-radius: 4px 4px 0 0;
      color: var(--text-muted);
      transition: color 0.1s, background-color 0.1s;
    }

    .game-overlay-tab:hover {
      color: var(--text-color);
      background-color: var(--button-hover);
    }

    .game-overlay-tab.active {
      color: var(--text-highlight);
      border-bottom: 2px solid var(--text-highlight);
      margin-bottom: -2px;
    }

    /* Tooltip styles */
    .game-overlay-tooltip {
      position: absolute;
      background-color: var(--panel-bg);
      border: 2px solid var(--panel-border);
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 11px;
      max-width: 200px;
      pointer-events: none;
      z-index: 1000;
      box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.5);
    }

    /* Toast/notification styles */
    .game-overlay-toast {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(0, 0, 0, 0.9);
      border: 2px solid var(--panel-border);
      border-radius: 4px;
      padding: 8px 16px;
      color: var(--text-color);
      font-size: 12px;
      animation: toast-fade-in 0.2s ease-out;
    }

    @keyframes toast-fade-in {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    /* Modal backdrop */
    .game-overlay-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      pointer-events: auto;
    }
  `;

  document.head.appendChild(styles);
}
