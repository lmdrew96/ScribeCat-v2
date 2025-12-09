/**
 * TitleScene
 *
 * The main menu / title screen for StudyQuest.
 * This is where players start the game.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { GameState } from '../state/GameState.js';
import { loadCatSprites, getCatSpriteName, STARTER_CATS, type CatColor } from '../sprites/catSprites.js';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 400;

export function registerTitleScene(k: KAPLAYCtx): void {
  k.scene('title', async () => {
    // --- BACKGROUND ---
    // Simple gradient-like background using rectangles
    k.add([
      k.rect(CANVAS_WIDTH, CANVAS_HEIGHT),
      k.pos(0, 0),
      k.color(26, 26, 46), // #1a1a2e
      k.z(0),
    ]);

    // Decorative floor area
    k.add([
      k.rect(CANVAS_WIDTH, 100),
      k.pos(0, CANVAS_HEIGHT - 100),
      k.color(42, 42, 78), // #2a2a4e
      k.z(1),
    ]);

    // --- TITLE ---
    k.add([
      k.text('StudyQuest', { size: 40 }),
      k.pos(CANVAS_WIDTH / 2, 50),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.z(10),
    ]);

    // Subtitle
    k.add([
      k.text('A Cozy Cat RPG', { size: 14 }),
      k.pos(CANVAS_WIDTH / 2, 90),
      k.anchor('center'),
      k.color(150, 150, 180),
      k.z(10),
    ]);

    // --- CAT PREVIEW ---
    // Load grey cat for preview (default starter)
    await loadCatSprites(k, 'grey');

    let selectedCatIndex = 0;
    const starterCats = STARTER_CATS;
    let catPreview: GameObj | null = null;

    // Create cat preview
    async function updateCatPreview() {
      if (catPreview) k.destroy(catPreview);

      const color = starterCats[selectedCatIndex];
      await loadCatSprites(k, color);

      catPreview = k.add([
        k.sprite(getCatSpriteName(color, 'idle')),
        k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 130),
        k.anchor('center'),
        k.scale(3),
        k.z(20),
      ]);
      catPreview.play('idle');
    }

    await updateCatPreview();

    // Cat name display (above cat)
    const catNameDisplay = k.add([
      k.text(starterCats[selectedCatIndex].toUpperCase(), { size: 16 }),
      k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 190),
      k.anchor('center'),
      k.color(251, 191, 36), // Amber
      k.z(10),
    ]);

    // Cat selection hint (below cat)
    k.add([
      k.text('< > to change cat', { size: 11 }),
      k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 60),
      k.anchor('center'),
      k.color(150, 150, 180),
      k.z(10),
    ]);

    // --- MENU BUTTONS ---
    const buttonY = 140;
    const buttonSpacing = 40;

    interface MenuButton {
      entity: GameObj;
      label: string;
      action: () => void;
    }

    const buttons: MenuButton[] = [];
    let selectedButton = 0;

    function createButton(label: string, y: number, action: () => void): MenuButton {
      const entity = k.add([
        k.text(label, { size: 16 }),
        k.pos(CANVAS_WIDTH / 2, y),
        k.anchor('center'),
        k.color(200, 200, 200),
        k.z(10),
        'menu-button',
      ]);

      return { entity, label, action };
    }

    buttons.push(createButton('New Game', buttonY, () => {
      const selectedCat = starterCats[selectedCatIndex];
      GameState.reset();
      GameState.setCatColor(selectedCat);
      k.go('town', { catColor: selectedCat });
    }));

    buttons.push(createButton('Continue', buttonY + buttonSpacing, () => {
      // TODO: Load save and continue
      console.log('Continue - not implemented yet');
    }));

    // Update button highlighting
    function updateButtonHighlight() {
      buttons.forEach((btn, i) => {
        if (i === selectedButton) {
          btn.entity.color = k.rgb(251, 191, 36); // Amber highlight
          btn.entity.text = `> ${btn.label} <`;
        } else {
          btn.entity.color = k.rgb(200, 200, 200);
          btn.entity.text = btn.label;
        }
      });
    }

    updateButtonHighlight();

    // --- INPUT HANDLING ---
    // Menu navigation
    k.onKeyPress('up', () => {
      selectedButton = (selectedButton - 1 + buttons.length) % buttons.length;
      updateButtonHighlight();
    });

    k.onKeyPress('down', () => {
      selectedButton = (selectedButton + 1) % buttons.length;
      updateButtonHighlight();
    });

    // Cat selection
    k.onKeyPress('left', async () => {
      selectedCatIndex = (selectedCatIndex - 1 + starterCats.length) % starterCats.length;
      catNameDisplay.text = starterCats[selectedCatIndex].toUpperCase();
      await updateCatPreview();
    });

    k.onKeyPress('right', async () => {
      selectedCatIndex = (selectedCatIndex + 1) % starterCats.length;
      catNameDisplay.text = starterCats[selectedCatIndex].toUpperCase();
      await updateCatPreview();
    });

    // Select button
    k.onKeyPress('enter', () => {
      buttons[selectedButton].action();
    });

    k.onKeyPress('space', () => {
      buttons[selectedButton].action();
    });

    // --- FOOTER ---
    k.add([
      k.text('W/S Menu | A/D Cat | ENTER Select', { size: 10 }),
      k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 15),
      k.anchor('center'),
      k.color(100, 100, 120),
      k.z(10),
    ]);

    // Debug info
    console.log('=== StudyQuest Title Scene ===');
    console.log('Controls: ↑↓ navigate menu, ←→ select cat, ENTER/SPACE to confirm');
  });
}
