/**
 * TownView
 *
 * Wrapper component that manages the TownCanvas and integrates it with
 * the StudyQuestModal. Handles building interactions and view transitions.
 */

import { createLogger } from '../../../shared/logger.js';
import { TownCanvas, type BuildingId } from '../../canvas/town/index.js';
import type { CatColor } from '../../canvas/CatSpriteManager.js';

const logger = createLogger('TownView');

// Callbacks for building interactions
type BuildingCallback = () => void;

interface TownViewCallbacks {
  onShop: BuildingCallback;
  onInn: BuildingCallback;
  onDungeons: BuildingCallback;
  onQuests: BuildingCallback;
  onHome: BuildingCallback;
}

export class TownView {
  private container: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private townCanvas: TownCanvas | null = null;
  private callbacks: TownViewCallbacks;
  private isActive: boolean = false;
  private catColor: CatColor = 'brown';

  constructor(callbacks: TownViewCallbacks) {
    this.callbacks = callbacks;

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'studyquest-town-canvas-container';
    this.container.innerHTML = `
      <div class="town-canvas-wrapper">
        <canvas class="town-canvas"></canvas>
      </div>
      <div class="town-controls">
        <div class="town-controls-hint">
          <span>WASD/Arrows to move</span>
          <span>Enter to interact</span>
          <span>1-5 quick travel</span>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('.town-canvas') as HTMLCanvasElement;

    // Inject styles
    this.injectStyles();
  }

  /**
   * Get the container element
   */
  getElement(): HTMLElement {
    return this.container;
  }

  /**
   * Initialize and start the canvas
   */
  start(): void {
    if (this.isActive) return;

    // Create canvas if not already created
    if (!this.townCanvas) {
      this.townCanvas = new TownCanvas(this.canvas);
      this.townCanvas.setCatColor(this.catColor);
      this.townCanvas.setOnBuildingInteract((buildingId) => {
        this.handleBuildingInteraction(buildingId);
      });
    }

    this.townCanvas.start();
    this.isActive = true;
    logger.info('Town view started');
  }

  /**
   * Stop the canvas (when switching away)
   */
  stop(): void {
    if (!this.isActive) return;

    this.townCanvas?.stop();
    this.isActive = false;
    logger.info('Town view stopped');
  }

  /**
   * Set the cat color
   */
  setCatColor(color: CatColor): void {
    this.catColor = color;
    this.townCanvas?.setCatColor(color);
  }

  /**
   * Check if town view is active
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Handle building interactions
   */
  private handleBuildingInteraction(buildingId: BuildingId): void {
    logger.info(`Building interaction: ${buildingId}`);

    switch (buildingId) {
      case 'shop':
        this.callbacks.onShop();
        break;
      case 'inn':
        this.callbacks.onInn();
        break;
      case 'dungeons':
        this.callbacks.onDungeons();
        break;
      case 'quests':
        this.callbacks.onQuests();
        break;
      case 'home':
        this.callbacks.onHome();
        break;
    }
  }

  /**
   * Inject component styles
   */
  private injectStyles(): void {
    if (document.getElementById('town-view-styles')) return;

    const style = document.createElement('style');
    style.id = 'town-view-styles';
    style.textContent = `
      .studyquest-town-canvas-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 16px;
      }

      .town-canvas-wrapper {
        border: 4px solid var(--sq-border, #4a4a6a);
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        background: #1a1a2e;
      }

      .town-canvas {
        display: block;
        image-rendering: pixelated;
        width: 480px;
        height: 320px;
      }

      .town-controls {
        display: flex;
        justify-content: center;
        gap: 16px;
      }

      .town-controls-hint {
        display: flex;
        gap: 16px;
        font-size: 11px;
        color: var(--sq-text-muted, #9ca3af);
        font-family: 'Courier New', monospace;
      }

      .town-controls-hint span {
        background: rgba(0, 0, 0, 0.3);
        padding: 4px 8px;
        border-radius: 4px;
      }

      /* Card-based fallback toggle */
      .town-mode-toggle {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }

      .town-mode-btn {
        padding: 6px 12px;
        font-size: 11px;
        background: var(--sq-surface, #2a2a4e);
        color: var(--sq-text, #ffffff);
        border: 2px solid var(--sq-border, #4a4a6a);
        border-radius: 4px;
        cursor: pointer;
        font-family: 'Courier New', monospace;
      }

      .town-mode-btn.active {
        background: var(--sq-primary, #6366f1);
        border-color: var(--sq-primary, #6366f1);
      }

      .town-mode-btn:hover {
        background: var(--sq-surface-alt, #3a3a5e);
      }

      .town-mode-btn.active:hover {
        background: var(--sq-primary, #6366f1);
        filter: brightness(1.1);
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stop();
    this.townCanvas = null;
  }
}

/**
 * Create a toggle to switch between canvas and card town views
 */
export function createTownModeToggle(
  onCanvasMode: () => void,
  onCardMode: () => void,
  defaultMode: 'canvas' | 'cards' = 'canvas'
): HTMLElement {
  const toggle = document.createElement('div');
  toggle.className = 'town-mode-toggle';
  toggle.innerHTML = `
    <button class="town-mode-btn ${defaultMode === 'canvas' ? 'active' : ''}" data-mode="canvas">
      🎮 Explore Mode
    </button>
    <button class="town-mode-btn ${defaultMode === 'cards' ? 'active' : ''}" data-mode="cards">
      📋 Quick Access
    </button>
  `;

  toggle.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.town-mode-btn') as HTMLButtonElement;
    if (!btn) return;

    // Update active state
    toggle.querySelectorAll('.town-mode-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const mode = btn.dataset.mode;
    if (mode === 'canvas') {
      onCanvasMode();
    } else {
      onCardMode();
    }
  });

  return toggle;
}
