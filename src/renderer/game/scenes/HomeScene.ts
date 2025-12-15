/**
 * HomeScene
 *
 * The player's personal space where they can:
 * - View their cat collection
 * - Place and arrange decorations/furniture
 * - See achievements
 *
 * Features a grid-based decoration system where players can place items
 * they've purchased from the shop.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { GameState } from '../state/GameState.js';
import { createPlayer } from '../components/Player.js';
import { setupMovement } from '../systems/movement.js';
import { setupInteraction, type Interactable } from '../systems/interaction.js';
import { createDoor } from '../components/Door.js';
import { PLAYER_SPEED, CANVAS_WIDTH, CANVAS_HEIGHT } from '../config.js';
import type { CatColor } from '../sprites/catSprites.js';
import { loadTownTiles, TOWN_TILES } from '../sprites/townSprites.js';
import { getItem } from '../data/items.js';
import { playSound } from '../systems/sound.js';

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

export function registerHomeScene(k: KAPLAYCtx): void {
  k.scene('home', async (data: HomeSceneData = {}) => {
    const catColor = data.catColor || GameState.player.catColor;

    // --- BACKGROUND (HD Image or Tiled Floor) ---
    let bgLoaded = false;
    try {
      await k.loadSprite('home-bg', '../../assets/BACKGROUNDS/cat_indoors_background.png');
      bgLoaded = true;
    } catch {
      console.log('HD home background not available, using tiled floor');
    }

    if (bgLoaded) {
      const bgSprite = k.add([
        k.sprite('home-bg'),
        k.pos(0, 0),
        k.z(0),
      ]);
      // Scale to cover canvas
      const bgScale = Math.max(CANVAS_WIDTH / 1024, CANVAS_HEIGHT / 576);
      bgSprite.scale = k.vec2(bgScale, bgScale);
    } else {
      // Fallback: Try tiled floor, else solid color
      let tilesLoaded = false;
      try {
        await loadTownTiles(k);
        tilesLoaded = true;
      } catch {
        console.log('Tiles not available, using solid colors');
      }

      // Wall (solid color background)
      k.add([
        k.rect(CANVAS_WIDTH, CANVAS_HEIGHT),
        k.pos(0, 0),
        k.color(255, 228, 196), // Bisque/cream
        k.z(0),
      ]);

      // Floor area
      if (tilesLoaded) {
        // Tiled wood floor
        const TILE_SCALE = 2;
        const TILE_SIZE = 16 * TILE_SCALE; // 32px
        const floorStartY = 150;

        for (let x = 0; x < CANVAS_WIDTH; x += TILE_SIZE) {
          for (let y = floorStartY; y < CANVAS_HEIGHT; y += TILE_SIZE) {
            // Alternate between two floor tile types for visual variety
            const tileId = (Math.floor(x / TILE_SIZE) + Math.floor(y / TILE_SIZE)) % 2 === 0
              ? TOWN_TILES.PATH_DIRT
              : TOWN_TILES.PATH_STONE_1;
            const spriteName = `town_tile_${tileId.toString().padStart(4, '0')}`;

            k.add([
              k.sprite(spriteName),
              k.pos(x, y),
              k.scale(TILE_SCALE),
              k.z(1),
            ]);
          }
        }
      } else {
        // Solid color floor fallback
        k.add([
          k.rect(CANVAS_WIDTH, CANVAS_HEIGHT - 150),
          k.pos(0, 150),
          k.color(139, 119, 101),
          k.z(1),
        ]);
      }

      // Wall border
      k.add([
        k.rect(CANVAS_WIDTH, 8),
        k.pos(0, 150),
        k.color(139, 90, 43),
        k.z(2),
      ]);
    }

    // --- DECORATION STATE ---
    let decorateMode = false;
    let selectedDecorationIndex = 0;
    let decorationUIElements: GameObj[] = [];
    let placedDecorationSprites: GameObj[] = [];
    let gridOverlayElements: GameObj[] = [];

    // Get decoration items from player inventory
    function getOwnedDecorations(): { id: string; quantity: number }[] {
      return GameState.player.items.filter((inv) => {
        const item = getItem(inv.id);
        return item?.type === 'decoration';
      });
    }

    // Check if a grid position is occupied
    function isGridOccupied(gridX: number, gridY: number): boolean {
      const placed = GameState.getPlacedDecorations();
      for (const p of placed) {
        const item = getItem(p.itemId);
        if (!item?.decoration) continue;
        // Check if this decoration covers the grid position
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

    // Get decoration at grid position (if any)
    function getDecorationAt(gridX: number, gridY: number): { itemId: string; x: number; y: number } | null {
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

    // Render placed decorations
    function renderPlacedDecorations(): void {
      // Clear existing sprites
      for (const sprite of placedDecorationSprites) {
        if (sprite.exists()) k.destroy(sprite);
      }
      placedDecorationSprites = [];

      const placed = GameState.getPlacedDecorations();
      for (const p of placed) {
        const item = getItem(p.itemId);
        if (!item?.decoration) continue;

        const pixelX = HOME_GRID.startX + p.x * HOME_GRID.cellWidth;
        const pixelY = HOME_GRID.startY + p.y * HOME_GRID.cellHeight;
        const width = item.decoration.width * HOME_GRID.cellWidth;
        const height = item.decoration.height * HOME_GRID.cellHeight;
        const color = item.decoration.placeholderColor;

        const decorSprite = k.add([
          k.rect(width - 4, height - 4),
          k.pos(pixelX + 2, pixelY + 2),
          k.color(color[0], color[1], color[2]),
          k.outline(2, k.rgb(0, 0, 0)),
          k.z(3),
        ]);
        placedDecorationSprites.push(decorSprite);

        const labelText = k.add([
          k.text(item.name, { size: 12 }),
          k.pos(pixelX + width / 2, pixelY + height / 2),
          k.anchor('center'),
          k.color(255, 255, 255),
          k.z(4),
        ]);
        placedDecorationSprites.push(labelText);
      }
    }

    // Clear decoration UI
    function clearDecorationUI(): void {
      for (const e of decorationUIElements) {
        if (e.exists()) k.destroy(e);
      }
      decorationUIElements = [];
      for (const e of gridOverlayElements) {
        if (e.exists()) k.destroy(e);
      }
      gridOverlayElements = [];
    }

    // Render grid overlay for decoration mode
    function renderGridOverlay(): void {
      for (const e of gridOverlayElements) {
        if (e.exists()) k.destroy(e);
      }
      gridOverlayElements = [];

      for (let gx = 0; gx < HOME_GRID.cols; gx++) {
        for (let gy = 0; gy < HOME_GRID.rows; gy++) {
          const pixelX = HOME_GRID.startX + gx * HOME_GRID.cellWidth;
          const pixelY = HOME_GRID.startY + gy * HOME_GRID.cellHeight;
          const isOccupied = isGridOccupied(gx, gy);

          const cell = k.add([
            k.rect(HOME_GRID.cellWidth - 2, HOME_GRID.cellHeight - 2),
            k.pos(pixelX + 1, pixelY + 1),
            k.color(isOccupied ? 100 : 50, isOccupied ? 50 : 100, isOccupied ? 50 : 50),
            k.opacity(0.3),
            k.outline(1, k.rgb(100, 100, 100)),
            k.z(10),
          ]);
          gridOverlayElements.push(cell);
        }
      }
    }

    // Render decoration mode UI
    function renderDecorationUI(): void {
      clearDecorationUI();
      renderGridOverlay();

      // Panel background
      const panelBg = k.add([
        k.rect(200, CANVAS_HEIGHT - 20),
        k.pos(CANVAS_WIDTH - 210, 10),
        k.color(20, 20, 40),
        k.opacity(0.9),
        k.outline(2, k.rgb(100, 100, 150)),
        k.z(100),
      ]);
      decorationUIElements.push(panelBg);

      // Title
      const title = k.add([
        k.text('DECORATE', { size: 14 }),
        k.pos(CANVAS_WIDTH - 110, 25),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.z(101),
      ]);
      decorationUIElements.push(title);

      const ownedDecorations = getOwnedDecorations();

      if (ownedDecorations.length === 0) {
        const noItems = k.add([
          k.text('No decorations owned.\nBuy some from the shop!', { size: 12, width: 180 }),
          k.pos(CANVAS_WIDTH - 200, 60),
          k.color(150, 150, 150),
          k.z(101),
        ]);
        decorationUIElements.push(noItems);
      } else {
        // Ensure index is in bounds
        if (selectedDecorationIndex >= ownedDecorations.length) {
          selectedDecorationIndex = 0;
        }

        ownedDecorations.forEach((inv, i) => {
          const item = getItem(inv.id);
          if (!item) return;

          const isSelected = i === selectedDecorationIndex;
          const y = 50 + i * 35;

          const rowBg = k.add([
            k.rect(180, 30),
            k.pos(CANVAS_WIDTH - 200, y),
            k.color(isSelected ? 60 : 30, isSelected ? 60 : 30, isSelected ? 100 : 50),
            k.outline(isSelected ? 2 : 1, k.rgb(isSelected ? 251 : 60, isSelected ? 191 : 60, isSelected ? 36 : 80)),
            k.z(101),
          ]);
          decorationUIElements.push(rowBg);

          const iconColor = item.decoration?.placeholderColor || [100, 100, 100];
          const icon = k.add([
            k.rect(20, 20),
            k.pos(CANVAS_WIDTH - 195, y + 5),
            k.color(iconColor[0], iconColor[1], iconColor[2]),
            k.outline(1, k.rgb(0, 0, 0)),
            k.z(102),
          ]);
          decorationUIElements.push(icon);

          const nameText = k.add([
            k.text(item.name, { size: 12 }),
            k.pos(CANVAS_WIDTH - 170, y + 8),
            k.color(255, 255, 255),
            k.z(102),
          ]);
          decorationUIElements.push(nameText);

          const qtyText = k.add([
            k.text(`x${inv.quantity}`, { size: 12 }),
            k.pos(CANVAS_WIDTH - 35, y + 8),
            k.color(150, 200, 150),
            k.z(102),
          ]);
          decorationUIElements.push(qtyText);
        });
      }

      // Instructions
      const instructions = k.add([
        k.text('Up/Down: Select\nENTER: Place at cursor\nDEL: Remove at cursor\nD: Exit decorate', { size: 12, width: 180 }),
        k.pos(CANVAS_WIDTH - 200, CANVAS_HEIGHT - 80),
        k.color(150, 150, 150),
        k.z(101),
      ]);
      decorationUIElements.push(instructions);
    }

    // Toggle decorate mode
    function toggleDecorateMode(): void {
      decorateMode = !decorateMode;
      if (decorateMode) {
        player.freeze();
        renderDecorationUI();
      } else {
        player.unfreeze();
        clearDecorationUI();
      }
    }

    // Get grid position from player position
    function getPlayerGridPos(): { x: number; y: number } | null {
      const px = player.entity.pos.x;
      const py = player.entity.pos.y;

      const gridX = Math.floor((px - HOME_GRID.startX) / HOME_GRID.cellWidth);
      const gridY = Math.floor((py - HOME_GRID.startY) / HOME_GRID.cellHeight);

      if (gridX >= 0 && gridX < HOME_GRID.cols && gridY >= 0 && gridY < HOME_GRID.rows) {
        return { x: gridX, y: gridY };
      }
      return null;
    }

    // Place selected decoration at cursor
    function placeDecoration(): void {
      const ownedDecorations = getOwnedDecorations();
      if (ownedDecorations.length === 0) return;

      const selected = ownedDecorations[selectedDecorationIndex];
      if (!selected) return;

      const item = getItem(selected.id);
      if (!item?.decoration) return;

      const gridPos = getPlayerGridPos();
      if (!gridPos) return;

      // Check if placement is valid (all cells free and within bounds)
      for (let dx = 0; dx < item.decoration.width; dx++) {
        for (let dy = 0; dy < item.decoration.height; dy++) {
          const checkX = gridPos.x + dx;
          const checkY = gridPos.y + dy;
          if (checkX >= HOME_GRID.cols || checkY >= HOME_GRID.rows) {
            return; // Out of bounds
          }
          if (isGridOccupied(checkX, checkY)) {
            return; // Already occupied
          }
        }
      }

      // Place it
      const success = GameState.placeDecoration(selected.id, gridPos.x, gridPos.y);
      if (success) {
        try {
          playSound(k, 'place');
        } catch {
          // Sound not available
        }
        renderPlacedDecorations();
        renderDecorationUI();
      }
    }

    // Remove decoration at cursor
    function removeDecoration(): void {
      const gridPos = getPlayerGridPos();
      if (!gridPos) return;

      const decoration = getDecorationAt(gridPos.x, gridPos.y);
      if (decoration) {
        const success = GameState.removeDecoration(decoration.x, decoration.y);
        if (success) {
          try {
            playSound(k, 'place');
          } catch {
            // Sound not available
          }
          renderPlacedDecorations();
          renderDecorationUI();
        }
      }
    }

    // Initial render of placed decorations
    renderPlacedDecorations();

    // --- DOOR ---
    const exitDoor = createDoor({
      k,
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 30,
      width: 50,
      height: 40,
      label: 'Town',
      targetScene: 'town',
      color: k.rgb(101, 67, 33),
      visible: true,
    });

    // Door label
    k.add([
      k.text('Exit', { size: 13 }),
      k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.z(10),
    ]);

    // --- PLAYER ---
    const player = await createPlayer({
      k,
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2 + 50,
      color: catColor,
    });

    // --- MOVEMENT ---
    setupMovement({
      k,
      player,
      speed: PLAYER_SPEED,
      bounds: {
        minX: 30,
        maxX: CANVAS_WIDTH - 30,
        minY: 160,
        maxY: CANVAS_HEIGHT - 60,
      },
    });

    // --- INTERACTIONS ---
    const interactables: Interactable[] = [
      {
        entity: exitDoor.entity,
        type: 'door',
        promptText: exitDoor.getPromptText(),
        onInteract: () => exitDoor.enter(),
      },
    ];

    setupInteraction({
      k,
      player,
      interactables,
    });

    // --- UI ---
    // Scene label
    k.add([
      k.text('Home', { size: 16 }),
      k.pos(20, 20),
      k.color(50, 50, 50),
      k.z(50),
    ]);

    // Decoration count
    const placedCount = GameState.getPlacedDecorations().length;
    k.add([
      k.text(`Decorations: ${placedCount}`, { size: 13 }),
      k.pos(20, 45),
      k.color(100, 100, 100),
      k.z(50),
    ]);

    // Controls hint
    k.add([
      k.text('Arrow/WASD: Move | D: Decorate | ENTER: Interact | ESC: Back', { size: 12 }),
      k.pos(CANVAS_WIDTH / 2, 10),
      k.anchor('top'),
      k.color(100, 100, 120),
      k.z(50),
    ]);

    // --- ESC to go back ---
    k.onKeyPress('escape', () => {
      if (decorateMode) {
        toggleDecorateMode();
      } else {
        k.go('town');
      }
    });

    // --- D to toggle decorate mode ---
    k.onKeyPress('d', () => {
      toggleDecorateMode();
    });

    // --- Decoration mode controls ---
    k.onKeyPress('up', () => {
      if (decorateMode) {
        const ownedDecorations = getOwnedDecorations();
        if (selectedDecorationIndex > 0) {
          selectedDecorationIndex--;
          renderDecorationUI();
        }
      }
    });

    k.onKeyPress('down', () => {
      if (decorateMode) {
        const ownedDecorations = getOwnedDecorations();
        if (selectedDecorationIndex < ownedDecorations.length - 1) {
          selectedDecorationIndex++;
          renderDecorationUI();
        }
      }
    });

    k.onKeyPress('enter', () => {
      if (decorateMode) {
        placeDecoration();
      }
    });

    k.onKeyPress('backspace', () => {
      if (decorateMode) {
        removeDecoration();
      }
    });

    k.onKeyPress('delete', () => {
      if (decorateMode) {
        removeDecoration();
      }
    });

    console.log('=== StudyQuest Home ===');
  });
}
