/**
 * TitleScene
 *
 * The main menu / title screen for StudyQuest.
 * This is where players start the game.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { GameState } from '../state/GameState.js';
import {
  loadCatSprites,
  getCatSpriteName,
  ALL_CAT_COLORS,
  CAT_DISPLAY_NAMES,
  CAT_UNLOCK_REQUIREMENTS,
  isCatUnlocked,
  type CatColor
} from '../sprites/catSprites.js';
import { playSound, playCatMeow } from '../systems/sound.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config.js';

export function registerTitleScene(k: KAPLAYCtx): void {
  k.scene('title', async () => {
    // --- BACKGROUND ---
    // Try to load HD background
    let bgLoaded = false;
    try {
      await k.loadSprite('title-bg', '../../assets/BACKGROUNDS/moonlake 16-9.png');
      bgLoaded = true;
    } catch {
      console.log('Title HD background not available, using fallback');
    }

    if (bgLoaded) {
      const bgSprite = k.add([
        k.sprite('title-bg'),
        k.pos(0, 0),
        k.z(0),
      ]);
      // Scale to cover canvas
      const bgScale = Math.max(CANVAS_WIDTH / 1920, CANVAS_HEIGHT / 1080);
      bgSprite.scale = k.vec2(bgScale, bgScale);

      // Dark overlay for readability
      k.add([
        k.rect(CANVAS_WIDTH, CANVAS_HEIGHT),
        k.pos(0, 0),
        k.color(0, 0, 0),
        k.opacity(0.4),
        k.z(1),
      ]);
    } else {
      // Fallback: gradient background
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
    }

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
    const allCats = ALL_CAT_COLORS;
    let catPreview: GameObj | null = null;
    let lockIcon: GameObj | null = null;

    // Get player stats for unlock checking
    const playerStats = {
      level: GameState.player.level,
      battlesWon: GameState.player.battlesWon || 0,
      goldEarned: GameState.player.totalGoldEarned || 0,
      achievements: GameState.player.achievements || [],
    };

    // Create cat preview
    async function updateCatPreview() {
      if (catPreview) k.destroy(catPreview);
      if (lockIcon) k.destroy(lockIcon);

      const color = allCats[selectedCatIndex];
      const isUnlocked = isCatUnlocked(color, playerStats);

      if (isUnlocked) {
        await loadCatSprites(k, color);
        catPreview = k.add([
          k.sprite(getCatSpriteName(color, 'idle')),
          k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 130),
          k.anchor('center'),
          k.scale(3),
          k.z(20),
        ]);
        catPreview.play('idle');
      } else {
        // Show silhouette for locked cats
        await loadCatSprites(k, 'grey'); // Use grey as base
        catPreview = k.add([
          k.sprite(getCatSpriteName('grey', 'idle')),
          k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 130),
          k.anchor('center'),
          k.scale(3),
          k.z(20),
          k.color(50, 50, 50), // Dark silhouette
          k.opacity(0.5),
        ]);
        catPreview.play('idle');

        // Add lock icon
        lockIcon = k.add([
          k.text('🔒', { size: 32 }),
          k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 130),
          k.anchor('center'),
          k.z(25),
        ]);
      }
    }

    await updateCatPreview();

    // Cat name display (above cat)
    const catNameDisplay = k.add([
      k.text(CAT_DISPLAY_NAMES[allCats[selectedCatIndex]], { size: 16 }),
      k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 190),
      k.anchor('center'),
      k.color(251, 191, 36), // Amber
      k.z(10),
    ]);

    // Unlock requirement display
    const unlockDisplay = k.add([
      k.text('', { size: 13 }),
      k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 170),
      k.anchor('center'),
      k.color(150, 150, 180),
      k.z(10),
    ]);

    function updateUnlockDisplay() {
      const color = allCats[selectedCatIndex];
      const isUnlocked = isCatUnlocked(color, playerStats);
      const req = CAT_UNLOCK_REQUIREMENTS[color];

      if (isUnlocked) {
        unlockDisplay.text = '';
        catNameDisplay.color = k.rgb(251, 191, 36); // Amber
      } else {
        unlockDisplay.text = `🔒 ${req.description}`;
        catNameDisplay.color = k.rgb(100, 100, 100); // Grey for locked
      }
    }
    updateUnlockDisplay();

    // Cat selection hint (below cat)
    k.add([
      k.text(`< > to browse (${allCats.length} cats)`, { size: 14 }),
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

    buttons.push(createButton('New Game', buttonY, async () => {
      const selectedCat = allCats[selectedCatIndex];
      const isUnlocked = isCatUnlocked(selectedCat, playerStats);

      if (!isUnlocked) {
        // Show error for locked cat
        playSound(k, 'menuSelect');
        const errorMsg = k.add([
          k.text('Cat is locked! Choose an unlocked cat.', { size: 14 }),
          k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
          k.anchor('center'),
          k.color(255, 100, 100),
          k.z(100),
        ]);
        k.wait(1.5, () => k.destroy(errorMsg));
        return;
      }

      playSound(k, 'menuConfirm');
      playCatMeow(k);

      // Initialize cloud sync for new game (so progress can be saved)
      await GameState.initializeCloudForNewGame();

      GameState.reset();
      GameState.setCatColor(selectedCat);
      k.go('town', { catColor: selectedCat });
    }));

    buttons.push(createButton('Continue', buttonY + buttonSpacing, async () => {
      playSound(k, 'menuConfirm');

      // Show loading message
      const loadingMsg = k.add([
        k.text('Loading cloud save...', { size: 12 }),
        k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
        k.anchor('center'),
        k.color(255, 255, 100),
        k.z(100),
      ]);

      // Try to load from cloud
      const success = await GameState.loadFromCloud();

      k.destroy(loadingMsg);

      if (success) {
        playCatMeow(k);

        // Check if player was in a dungeon - resume there if so
        if (GameState.hasActiveDungeonRun()) {
          console.log(`Resuming dungeon: ${GameState.dungeon.dungeonId} floor ${GameState.dungeon.floorNumber}`);
          k.go('dungeon', {
            catColor: GameState.player.catColor,
            dungeonId: GameState.dungeon.dungeonId,
            floorNumber: GameState.dungeon.floorNumber,
          });
        } else {
          k.go('town', { catColor: GameState.player.catColor });
        }
      } else {
        // Show error message
        const errorMsg = k.add([
          k.text('No saved game found. Sign in or start a new game!', { size: 14 }),
          k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
          k.anchor('center'),
          k.color(255, 100, 100),
          k.z(100),
        ]);

        k.wait(2, () => {
          k.destroy(errorMsg);
        });
      }
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
      playSound(k, 'menuSelect');
      selectedButton = (selectedButton - 1 + buttons.length) % buttons.length;
      updateButtonHighlight();
    });

    k.onKeyPress('down', () => {
      playSound(k, 'menuSelect');
      selectedButton = (selectedButton + 1) % buttons.length;
      updateButtonHighlight();
    });

    // Cat selection
    k.onKeyPress('left', async () => {
      playSound(k, 'menuSelect');
      selectedCatIndex = (selectedCatIndex - 1 + allCats.length) % allCats.length;
      catNameDisplay.text = CAT_DISPLAY_NAMES[allCats[selectedCatIndex]];
      updateUnlockDisplay();
      await updateCatPreview();
    });

    k.onKeyPress('right', async () => {
      playSound(k, 'menuSelect');
      selectedCatIndex = (selectedCatIndex + 1) % allCats.length;
      catNameDisplay.text = CAT_DISPLAY_NAMES[allCats[selectedCatIndex]];
      updateUnlockDisplay();
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
      k.text('W/S Menu | A/D Cat | ENTER Select', { size: 13 }),
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
