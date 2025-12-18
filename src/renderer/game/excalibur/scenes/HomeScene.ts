/**
 * ExcaliburHomeScene
 *
 * The player's personal space where they can:
 * - View their cat collection
 * - Place and arrange decorations/furniture
 * - See achievements
 *
 * Features a grid-based decoration system where players can place items
 * they've purchased from the shop.
 * Uses background images from assets/BACKGROUNDS.
 */

import * as ex from 'excalibur';
import { GameState } from '../../state/GameState.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../config.js';
import type { CatColor } from '../adapters/SpriteAdapter.js';
import { getItem } from '../../data/items.js';
import { loadBackground, createBackgroundActor } from '../../loaders/BackgroundLoader.js';
import { AudioManager } from '../../audio/AudioManager.js';
import { PlayerActor } from '../actors/PlayerActor.js';

// Grid configuration for decoration placement
const HOME_GRID = {
  cols: 7,
  rows: 3,
  cellWidth: 80,
  cellHeight: 60,
  startX: 30,
  startY: 180,
};

export interface HomeSceneData {
  catColor?: CatColor;
  fromScene?: string;
}

/**
 * Door Actor
 */
class DoorActor extends ex.Actor {
  public targetScene: string;
  public label: string;

  constructor(config: { x: number; y: number; width: number; height: number; label: string; targetScene: string }) {
    super({
      pos: new ex.Vector(config.x, config.y),
      width: config.width,
      height: config.height,
      anchor: ex.Vector.Half,
      z: 3,
    });
    this.targetScene = config.targetScene;
    this.label = config.label;
  }

  onInitialize(): void {
    this.graphics.use(new ex.Rectangle({
      width: this.width,
      height: this.height,
      color: ex.Color.fromHex('#654321'),
      strokeColor: ex.Color.Black,
      lineWidth: 2,
    }));
  }
}

/**
 * Main Home Scene
 */
export class HomeScene extends ex.Scene {
  private player: PlayerActor | null = null;
  private door: DoorActor | null = null;
  private sceneData: HomeSceneData = {};

  // Input cooldown to prevent key events carrying over from scene transitions
  private inputEnabled = false;

  // Decoration state
  private decorateMode = false;
  private selectedDecorationIndex = 0;
  private decorationUIElements: ex.Actor[] = [];
  private placedDecorationSprites: ex.Actor[] = [];
  private gridOverlayElements: ex.Actor[] = [];

  // UI elements
  private decorCountLabel: ex.Label | null = null;

  // Callback for scene transitions
  public onExitToTown: (() => void) | null = null;

  onActivate(ctx: ex.SceneActivationContext<HomeSceneData>): void {
    this.sceneData = ctx.data || {};
    const catColor = this.sceneData.catColor || GameState.player.catColor;

    // Disable input briefly to prevent key events from previous scene
    this.inputEnabled = false;
    setTimeout(() => { this.inputEnabled = true; }, 200);

    // Reset state
    this.decorateMode = false;
    this.selectedDecorationIndex = 0;

    // Clear any existing actors from previous activation
    this.clear();

    // Setup background
    this.setupBackground();

    // Setup door
    this.setupDoor();

    // Setup player
    this.setupPlayer(catColor);

    // Setup UI
    this.setupUI();

    // Render placed decorations
    this.renderPlacedDecorations();

    // Setup input handlers
    this.setupInputHandlers();

    console.log('=== StudyQuest Home (Excalibur) ===');
  }

  onDeactivate(): void {
    // Reset input state to prevent stale handlers from firing
    this.inputEnabled = false;

    this.player = null;
    this.door = null;
    this.decorCountLabel = null;
    this.decorationUIElements = [];
    this.placedDecorationSprites = [];
    this.gridOverlayElements = [];
  }

  private async setupBackground(): Promise<void> {
    // Try to load the cat indoors background
    const bgImage = await loadBackground('catIndoors');

    if (bgImage) {
      const bgActor = createBackgroundActor(bgImage, CANVAS_WIDTH, CANVAS_HEIGHT, 0);
      this.add(bgActor);
    } else {
      // Fallback to solid colors
      const wall = new ex.Actor({
        pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        z: 0,
      });
      wall.graphics.use(new ex.Rectangle({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        color: ex.Color.fromHex('#FFE4C4'), // Bisque/cream
      }));
      this.add(wall);

      // Floor area (wood-like color)
      const floor = new ex.Actor({
        pos: new ex.Vector(CANVAS_WIDTH / 2, 150 + (CANVAS_HEIGHT - 150) / 2),
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT - 150,
        z: 1,
      });
      floor.graphics.use(new ex.Rectangle({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT - 150,
        color: ex.Color.fromHex('#8B7765'), // Tan wood color
      }));
      this.add(floor);

      // Wall border
      const wallBorder = new ex.Actor({
        pos: new ex.Vector(CANVAS_WIDTH / 2, 150),
        width: CANVAS_WIDTH,
        height: 8,
        z: 2,
      });
      wallBorder.graphics.use(new ex.Rectangle({
        width: CANVAS_WIDTH,
        height: 8,
        color: ex.Color.fromHex('#8B5A2B'),
      }));
      this.add(wallBorder);
    }

    // Play home music
    AudioManager.playSceneMusic('home');
  }

  private setupDoor(): void {
    this.door = new DoorActor({
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 30,
      width: 50,
      height: 40,
      label: 'Town',
      targetScene: 'town',
    });
    this.add(this.door);

    // Door label
    const label = new ex.Label({
      text: 'Exit',
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10),
      font: new ex.Font({ size: 13, color: ex.Color.White }),
      z: 10,
    });
    label.graphics.anchor = ex.Vector.Half;
    this.add(label);
  }

  private setupPlayer(catColor: CatColor): void {
    this.player = new PlayerActor({
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2 + 50,
      catColor,
      bounds: {
        minX: 30,
        maxX: CANVAS_WIDTH - 30,
        minY: 160,
        maxY: CANVAS_HEIGHT - 60,
      },
    });
    this.add(this.player);
  }

  private setupUI(): void {
    // Scene label
    const sceneLabel = new ex.Label({
      text: 'Home',
      pos: new ex.Vector(20, 20),
      font: new ex.Font({ size: 16, color: ex.Color.fromHex('#323232') }),
      z: 50,
    });
    this.add(sceneLabel);

    // Decoration count
    const placedCount = GameState.getPlacedDecorations().length;
    this.decorCountLabel = new ex.Label({
      text: `Decorations: ${placedCount}`,
      pos: new ex.Vector(20, 45),
      font: new ex.Font({ size: 13, color: ex.Color.fromHex('#646464') }),
      z: 50,
    });
    this.add(this.decorCountLabel);

    // Controls hint
    const controlsLabel = new ex.Label({
      text: 'Arrow/WASD: Move | D: Decorate | ENTER: Interact | ESC: Back',
      pos: new ex.Vector(CANVAS_WIDTH / 2, 10),
      font: new ex.Font({ size: 12, color: ex.Color.fromHex('#646478') }),
      z: 50,
    });
    controlsLabel.graphics.anchor = new ex.Vector(0.5, 0);
    this.add(controlsLabel);
  }

  private setupInputHandlers(): void {
    const checkPlayer = () => {
      if (this.player?.getInputManager()) {
        const input = this.player.getInputManager()!;

        // ESC to exit or cancel decorate mode
        input.onKeyPress('escape', () => {
          if (!this.inputEnabled) return;
          if (this.decorateMode) {
            this.toggleDecorateMode();
          } else {
            this.exitToTown();
          }
        });

        // D to toggle decorate mode
        input.onKeyPress('d', () => {
          if (!this.inputEnabled) return;
          this.toggleDecorateMode();
        });

        // ENTER to interact or place decoration
        input.onKeyPress('enter', () => {
          if (!this.inputEnabled) return;
          if (this.decorateMode) {
            this.placeDecoration();
          } else {
            this.checkInteraction();
          }
        });

        // SPACE to interact
        input.onKeyPress('space', () => {
          if (!this.inputEnabled) return;
          if (!this.decorateMode) {
            this.checkInteraction();
          }
        });

        // Arrow keys for decoration selection
        input.onKeyPress('up', () => {
          if (!this.inputEnabled) return;
          if (this.decorateMode) {
            this.selectPreviousDecoration();
          }
        });

        input.onKeyPress('down', () => {
          if (!this.inputEnabled) return;
          if (this.decorateMode) {
            this.selectNextDecoration();
          }
        });

        // Q key for removing decoration (since we don't have delete/backspace in InputAdapter)
        input.onKeyPress('q', () => {
          if (!this.inputEnabled) return;
          if (this.decorateMode) {
            this.removeDecoration();
          }
        });
      } else {
        setTimeout(checkPlayer, 100);
      }
    };
    checkPlayer();
  }

  // --- Decoration System ---

  private getOwnedDecorations(): { id: string; quantity: number }[] {
    return GameState.player.items.filter((inv) => {
      const item = getItem(inv.id);
      return item?.type === 'decoration';
    });
  }

  private isGridOccupied(gridX: number, gridY: number): boolean {
    const placed = GameState.getPlacedDecorations();
    for (const p of placed) {
      const item = getItem(p.itemId);
      if (!item?.decoration) continue;
      if (
        gridX >= p.x &&
        gridX < p.x + item.decoration.width &&
        gridY >= p.y &&
        gridY < p.y + item.decoration.height
      ) {
        return true;
      }
    }
    return false;
  }

  private getDecorationAt(gridX: number, gridY: number): { itemId: string; x: number; y: number } | null {
    const placed = GameState.getPlacedDecorations();
    for (const p of placed) {
      const item = getItem(p.itemId);
      if (!item?.decoration) continue;
      if (
        gridX >= p.x &&
        gridX < p.x + item.decoration.width &&
        gridY >= p.y &&
        gridY < p.y + item.decoration.height
      ) {
        return p;
      }
    }
    return null;
  }

  private getPlayerGridPos(): { x: number; y: number } | null {
    if (!this.player) return null;

    const px = this.player.pos.x;
    const py = this.player.pos.y;

    const gridX = Math.floor((px - HOME_GRID.startX) / HOME_GRID.cellWidth);
    const gridY = Math.floor((py - HOME_GRID.startY) / HOME_GRID.cellHeight);

    if (gridX >= 0 && gridX < HOME_GRID.cols && gridY >= 0 && gridY < HOME_GRID.rows) {
      return { x: gridX, y: gridY };
    }
    return null;
  }

  private toggleDecorateMode(): void {
    this.decorateMode = !this.decorateMode;
    if (this.decorateMode) {
      this.player?.freeze();
      this.renderDecorationUI();
    } else {
      this.player?.unfreeze();
      this.clearDecorationUI();
    }
  }

  private renderPlacedDecorations(): void {
    // Clear existing sprites
    for (const sprite of this.placedDecorationSprites) {
      sprite.kill();
    }
    this.placedDecorationSprites = [];

    const placed = GameState.getPlacedDecorations();
    for (const p of placed) {
      const item = getItem(p.itemId);
      if (!item?.decoration) continue;

      const pixelX = HOME_GRID.startX + p.x * HOME_GRID.cellWidth;
      const pixelY = HOME_GRID.startY + p.y * HOME_GRID.cellHeight;
      const width = item.decoration.width * HOME_GRID.cellWidth;
      const height = item.decoration.height * HOME_GRID.cellHeight;
      const color = item.decoration.placeholderColor;

      // Decoration rectangle
      const decorSprite = new ex.Actor({
        pos: new ex.Vector(pixelX + width / 2, pixelY + height / 2),
        width: width - 4,
        height: height - 4,
        z: 3,
      });
      decorSprite.graphics.use(new ex.Rectangle({
        width: width - 4,
        height: height - 4,
        color: ex.Color.fromRGB(color[0], color[1], color[2]),
        strokeColor: ex.Color.Black,
        lineWidth: 2,
      }));
      this.add(decorSprite);
      this.placedDecorationSprites.push(decorSprite);

      // Label
      const labelText = new ex.Label({
        text: item.name,
        pos: new ex.Vector(pixelX + width / 2, pixelY + height / 2),
        font: new ex.Font({ size: 12, color: ex.Color.White }),
        z: 4,
      });
      labelText.graphics.anchor = ex.Vector.Half;
      this.add(labelText);
      this.placedDecorationSprites.push(labelText);
    }

    // Update count label
    if (this.decorCountLabel) {
      this.decorCountLabel.text = `Decorations: ${placed.length}`;
    }
  }

  private clearDecorationUI(): void {
    for (const e of this.decorationUIElements) {
      e.kill();
    }
    this.decorationUIElements = [];
    for (const e of this.gridOverlayElements) {
      e.kill();
    }
    this.gridOverlayElements = [];
  }

  private renderGridOverlay(): void {
    for (const e of this.gridOverlayElements) {
      e.kill();
    }
    this.gridOverlayElements = [];

    for (let gx = 0; gx < HOME_GRID.cols; gx++) {
      for (let gy = 0; gy < HOME_GRID.rows; gy++) {
        const pixelX = HOME_GRID.startX + gx * HOME_GRID.cellWidth;
        const pixelY = HOME_GRID.startY + gy * HOME_GRID.cellHeight;
        const isOccupied = this.isGridOccupied(gx, gy);

        const cell = new ex.Actor({
          pos: new ex.Vector(pixelX + HOME_GRID.cellWidth / 2, pixelY + HOME_GRID.cellHeight / 2),
          width: HOME_GRID.cellWidth - 2,
          height: HOME_GRID.cellHeight - 2,
          z: 10,
        });
        cell.graphics.use(new ex.Rectangle({
          width: HOME_GRID.cellWidth - 2,
          height: HOME_GRID.cellHeight - 2,
          color: isOccupied
            ? ex.Color.fromRGB(100, 50, 50, 0.3)
            : ex.Color.fromRGB(50, 100, 50, 0.3),
          strokeColor: ex.Color.fromRGB(100, 100, 100),
          lineWidth: 1,
        }));
        this.add(cell);
        this.gridOverlayElements.push(cell);
      }
    }
  }

  private renderDecorationUI(): void {
    this.clearDecorationUI();
    this.renderGridOverlay();

    const panelX = CANVAS_WIDTH - 105;
    const panelY = CANVAS_HEIGHT / 2;

    // Panel background
    const panelBg = new ex.Actor({
      pos: new ex.Vector(panelX, panelY),
      width: 200,
      height: CANVAS_HEIGHT - 20,
      z: 100,
    });
    panelBg.graphics.use(new ex.Rectangle({
      width: 200,
      height: CANVAS_HEIGHT - 20,
      color: ex.Color.fromRGB(20, 20, 40, 0.9),
      strokeColor: ex.Color.fromRGB(100, 100, 150),
      lineWidth: 2,
    }));
    this.add(panelBg);
    this.decorationUIElements.push(panelBg);

    // Title
    const title = new ex.Label({
      text: 'DECORATE',
      pos: new ex.Vector(panelX, 25),
      font: new ex.Font({ size: 14, color: ex.Color.White }),
      z: 101,
    });
    title.graphics.anchor = ex.Vector.Half;
    this.add(title);
    this.decorationUIElements.push(title);

    const ownedDecorations = this.getOwnedDecorations();

    if (ownedDecorations.length === 0) {
      const noItems = new ex.Label({
        text: 'No decorations owned.\nBuy some from the shop!',
        pos: new ex.Vector(CANVAS_WIDTH - 200, 60),
        font: new ex.Font({ size: 12, color: ex.Color.fromRGB(150, 150, 150) }),
        z: 101,
      });
      this.add(noItems);
      this.decorationUIElements.push(noItems);
    } else {
      // Ensure index is in bounds
      if (this.selectedDecorationIndex >= ownedDecorations.length) {
        this.selectedDecorationIndex = 0;
      }

      ownedDecorations.forEach((inv, i) => {
        const item = getItem(inv.id);
        if (!item) return;

        const isSelected = i === this.selectedDecorationIndex;
        const y = 50 + i * 35;

        // Row background
        const rowBg = new ex.Actor({
          pos: new ex.Vector(panelX, y + 15),
          width: 180,
          height: 30,
          z: 101,
        });
        rowBg.graphics.use(new ex.Rectangle({
          width: 180,
          height: 30,
          color: isSelected ? ex.Color.fromRGB(60, 60, 100) : ex.Color.fromRGB(30, 30, 50),
          strokeColor: isSelected ? ex.Color.fromHex('#FBBF24') : ex.Color.fromRGB(60, 60, 80),
          lineWidth: isSelected ? 2 : 1,
        }));
        this.add(rowBg);
        this.decorationUIElements.push(rowBg);

        // Icon
        const iconColor = item.decoration?.placeholderColor || [100, 100, 100];
        const icon = new ex.Actor({
          pos: new ex.Vector(CANVAS_WIDTH - 185, y + 15),
          width: 20,
          height: 20,
          z: 102,
        });
        icon.graphics.use(new ex.Rectangle({
          width: 20,
          height: 20,
          color: ex.Color.fromRGB(iconColor[0], iconColor[1], iconColor[2]),
          strokeColor: ex.Color.Black,
          lineWidth: 1,
        }));
        this.add(icon);
        this.decorationUIElements.push(icon);

        // Name
        const nameText = new ex.Label({
          text: item.name,
          pos: new ex.Vector(CANVAS_WIDTH - 170, y + 15),
          font: new ex.Font({ size: 12, color: ex.Color.White }),
          z: 102,
        });
        nameText.graphics.anchor = new ex.Vector(0, 0.5);
        this.add(nameText);
        this.decorationUIElements.push(nameText);

        // Quantity
        const qtyText = new ex.Label({
          text: `x${inv.quantity}`,
          pos: new ex.Vector(CANVAS_WIDTH - 35, y + 15),
          font: new ex.Font({ size: 12, color: ex.Color.fromRGB(150, 200, 150) }),
          z: 102,
        });
        qtyText.graphics.anchor = new ex.Vector(0, 0.5);
        this.add(qtyText);
        this.decorationUIElements.push(qtyText);
      });
    }

    // Instructions
    const instructions = new ex.Label({
      text: 'Up/Down: Select\nENTER: Place at cursor\nQ: Remove at cursor\nD: Exit decorate',
      pos: new ex.Vector(CANVAS_WIDTH - 200, CANVAS_HEIGHT - 80),
      font: new ex.Font({ size: 12, color: ex.Color.fromRGB(150, 150, 150) }),
      z: 101,
    });
    this.add(instructions);
    this.decorationUIElements.push(instructions);
  }

  private selectPreviousDecoration(): void {
    const ownedDecorations = this.getOwnedDecorations();
    if (this.selectedDecorationIndex > 0) {
      this.selectedDecorationIndex--;
      this.renderDecorationUI();
    }
  }

  private selectNextDecoration(): void {
    const ownedDecorations = this.getOwnedDecorations();
    if (this.selectedDecorationIndex < ownedDecorations.length - 1) {
      this.selectedDecorationIndex++;
      this.renderDecorationUI();
    }
  }

  private placeDecoration(): void {
    const ownedDecorations = this.getOwnedDecorations();
    if (ownedDecorations.length === 0) return;

    const selected = ownedDecorations[this.selectedDecorationIndex];
    if (!selected) return;

    const item = getItem(selected.id);
    if (!item?.decoration) return;

    const gridPos = this.getPlayerGridPos();
    if (!gridPos) return;

    // Check if placement is valid (all cells free and within bounds)
    for (let dx = 0; dx < item.decoration.width; dx++) {
      for (let dy = 0; dy < item.decoration.height; dy++) {
        const checkX = gridPos.x + dx;
        const checkY = gridPos.y + dy;
        if (checkX >= HOME_GRID.cols || checkY >= HOME_GRID.rows) {
          return; // Out of bounds
        }
        if (this.isGridOccupied(checkX, checkY)) {
          return; // Already occupied
        }
      }
    }

    // Place it
    const success = GameState.placeDecoration(selected.id, gridPos.x, gridPos.y);
    if (success) {
      this.renderPlacedDecorations();
      this.renderDecorationUI();
    }
  }

  private removeDecoration(): void {
    const gridPos = this.getPlayerGridPos();
    if (!gridPos) return;

    const decoration = this.getDecorationAt(gridPos.x, gridPos.y);
    if (decoration) {
      const success = GameState.removeDecoration(decoration.x, decoration.y);
      if (success) {
        this.renderPlacedDecorations();
        this.renderDecorationUI();
      }
    }
  }

  private checkInteraction(): void {
    if (!this.player) return;

    const playerPos = this.player.pos;

    // Check door interaction
    if (this.door) {
      const dist = playerPos.distance(this.door.pos);
      if (dist < 60) {
        this.exitToTown();
        return;
      }
    }
  }

  private exitToTown(): void {
    if (this.onExitToTown) {
      this.onExitToTown();
    } else {
      console.log('Exit to town requested');
    }
  }
}
