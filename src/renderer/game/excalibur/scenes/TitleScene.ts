/**
 * ExcaliburTitleScene
 *
 * The main menu / title screen for StudyQuest.
 * This is where players start the game.
 * Features cat selection carousel and menu navigation.
 */

import * as ex from 'excalibur';
import { GameState } from '../../state/GameState.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../config.js';
import { loadCatAnimation, type CatColor } from '../adapters/SpriteAdapter.js';
import { InputManager } from '../adapters/InputAdapter.js';
import {
  ALL_CAT_COLORS,
  CAT_DISPLAY_NAMES,
  CAT_UNLOCK_REQUIREMENTS,
  isCatUnlocked,
} from '../../data/catSprites.js';

export interface TitleSceneData {
  // No data needed for title scene
}

interface MenuButton {
  label: string;
  action: () => void;
}

/**
 * Main Title Scene
 */
export class TitleScene extends ex.Scene {
  private inputManager: InputManager | null = null;

  // Cat selection
  private selectedCatIndex = 0;
  private catPreview: ex.Actor | null = null;
  private catNameLabel: ex.Label | null = null;
  private unlockLabel: ex.Label | null = null;
  private lockIcon: ex.Label | null = null;

  // Menu
  private buttons: MenuButton[] = [];
  private buttonLabels: ex.Label[] = [];
  private selectedButton = 0;

  // Message display
  private messageLabel: ex.Label | null = null;
  private messageBg: ex.Actor | null = null;

  // Callbacks
  public onStartNewGame: ((catColor: CatColor) => void) | null = null;
  public onContinueGame: (() => Promise<{ success: boolean; catColor?: CatColor; dungeonData?: { dungeonId: string; floorNumber: number } }>) | null = null;

  onActivate(_ctx: ex.SceneActivationContext<TitleSceneData>): void {
    // Reset state
    this.selectedCatIndex = 0;
    this.selectedButton = 0;

    // Clear any existing actors
    this.clear();

    // Setup scene
    this.setupBackground();
    this.setupTitle();
    this.setupCatPreview();
    this.setupMenu();
    this.setupFooter();
    this.setupInputHandlers();

    console.log('=== StudyQuest Title Scene (Excalibur) ===');
  }

  onDeactivate(): void {
    this.inputManager = null;
    this.catPreview = null;
    this.catNameLabel = null;
    this.unlockLabel = null;
    this.lockIcon = null;
    this.buttonLabels = [];
    this.messageLabel = null;
    this.messageBg = null;
  }

  private setupBackground(): void {
    // Dark purple background
    const bg = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      z: 0,
    });
    bg.graphics.use(new ex.Rectangle({
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      color: ex.Color.fromHex('#1a1a2e'),
    }));
    this.add(bg);

    // Decorative floor area
    const floor = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 50),
      width: CANVAS_WIDTH,
      height: 100,
      z: 1,
    });
    floor.graphics.use(new ex.Rectangle({
      width: CANVAS_WIDTH,
      height: 100,
      color: ex.Color.fromHex('#2a2a4e'),
    }));
    this.add(floor);
  }

  private setupTitle(): void {
    // Main title
    const title = new ex.Label({
      text: 'StudyQuest',
      pos: new ex.Vector(CANVAS_WIDTH / 2, 50),
      font: new ex.Font({ size: 40, color: ex.Color.White }),
      z: 10,
    });
    title.graphics.anchor = ex.Vector.Half;
    this.add(title);

    // Subtitle
    const subtitle = new ex.Label({
      text: 'A Cozy Cat RPG',
      pos: new ex.Vector(CANVAS_WIDTH / 2, 90),
      font: new ex.Font({ size: 14, color: ex.Color.fromRGB(150, 150, 180) }),
      z: 10,
    });
    subtitle.graphics.anchor = ex.Vector.Half;
    this.add(subtitle);
  }

  private setupCatPreview(): void {
    // Cat name display (above cat)
    this.catNameLabel = new ex.Label({
      text: CAT_DISPLAY_NAMES[ALL_CAT_COLORS[this.selectedCatIndex]],
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 190),
      font: new ex.Font({ size: 16, color: ex.Color.fromHex('#FBBF24') }),
      z: 10,
    });
    this.catNameLabel.graphics.anchor = ex.Vector.Half;
    this.add(this.catNameLabel);

    // Unlock requirement display
    this.unlockLabel = new ex.Label({
      text: '',
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 170),
      font: new ex.Font({ size: 13, color: ex.Color.fromRGB(150, 150, 180) }),
      z: 10,
    });
    this.unlockLabel.graphics.anchor = ex.Vector.Half;
    this.add(this.unlockLabel);

    // Cat selection hint (below cat area)
    const hint = new ex.Label({
      text: `< > to browse (${ALL_CAT_COLORS.length} cats)`,
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 60),
      font: new ex.Font({ size: 14, color: ex.Color.fromRGB(150, 150, 180) }),
      z: 10,
    });
    hint.graphics.anchor = ex.Vector.Half;
    this.add(hint);

    // Create initial cat preview
    this.updateCatPreview();
  }

  private async updateCatPreview(): Promise<void> {
    // Remove existing preview
    if (this.catPreview) {
      this.catPreview.kill();
      this.catPreview = null;
    }
    if (this.lockIcon) {
      this.lockIcon.kill();
      this.lockIcon = null;
    }

    const color = ALL_CAT_COLORS[this.selectedCatIndex];
    const isUnlocked = this.isCatUnlockedForPlayer(color);

    // Create preview actor
    this.catPreview = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 130),
      width: 96, // 32 * 3 scale
      height: 96,
      z: 20,
    });

    if (isUnlocked) {
      // Load and display cat animation
      try {
        const animation = await loadCatAnimation(color, 'idle');
        // Scale up the animation
        const scaledAnim = animation.clone();
        scaledAnim.scale = new ex.Vector(3, 3);
        this.catPreview.graphics.use(scaledAnim);
      } catch (err) {
        console.warn('Failed to load cat animation:', err);
        this.catPreview.graphics.use(new ex.Rectangle({
          width: 96,
          height: 96,
          color: ex.Color.Gray,
        }));
      }
    } else {
      // Show silhouette for locked cats
      this.catPreview.graphics.use(new ex.Rectangle({
        width: 96,
        height: 96,
        color: ex.Color.fromRGB(50, 50, 50, 0.5),
      }));

      // Add lock icon
      this.lockIcon = new ex.Label({
        text: '🔒',
        pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 130),
        font: new ex.Font({ size: 32, color: ex.Color.White }),
        z: 25,
      });
      this.lockIcon.graphics.anchor = ex.Vector.Half;
      this.add(this.lockIcon);
    }

    this.add(this.catPreview);

    // Update displays
    this.updateCatDisplays();
  }

  private updateCatDisplays(): void {
    const color = ALL_CAT_COLORS[this.selectedCatIndex];
    const isUnlocked = this.isCatUnlockedForPlayer(color);
    const req = CAT_UNLOCK_REQUIREMENTS[color];

    if (this.catNameLabel) {
      this.catNameLabel.text = CAT_DISPLAY_NAMES[color];
      this.catNameLabel.font = new ex.Font({
        size: 16,
        color: isUnlocked ? ex.Color.fromHex('#FBBF24') : ex.Color.fromRGB(100, 100, 100),
      });
    }

    if (this.unlockLabel) {
      this.unlockLabel.text = isUnlocked ? '' : `🔒 ${req.description}`;
    }
  }

  private isCatUnlockedForPlayer(color: CatColor): boolean {
    return isCatUnlocked(color);
  }

  private setupMenu(): void {
    const buttonY = 140;
    const buttonSpacing = 40;

    this.buttons = [
      {
        label: 'New Game',
        action: () => this.handleNewGame(),
      },
      {
        label: 'Continue',
        action: () => this.handleContinue(),
      },
    ];

    this.buttonLabels = [];

    this.buttons.forEach((btn, i) => {
      const label = new ex.Label({
        text: btn.label,
        pos: new ex.Vector(CANVAS_WIDTH / 2, buttonY + i * buttonSpacing),
        font: new ex.Font({ size: 16, color: ex.Color.fromRGB(200, 200, 200) }),
        z: 10,
      });
      label.graphics.anchor = ex.Vector.Half;
      this.add(label);
      this.buttonLabels.push(label);
    });

    this.updateButtonHighlight();
  }

  private updateButtonHighlight(): void {
    this.buttonLabels.forEach((label, i) => {
      if (i === this.selectedButton) {
        label.text = `> ${this.buttons[i].label} <`;
        label.font = new ex.Font({ size: 16, color: ex.Color.fromHex('#FBBF24') });
      } else {
        label.text = this.buttons[i].label;
        label.font = new ex.Font({ size: 16, color: ex.Color.fromRGB(200, 200, 200) });
      }
    });
  }

  private setupFooter(): void {
    const footer = new ex.Label({
      text: 'W/S Menu | A/D Cat | ENTER Select',
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 15),
      font: new ex.Font({ size: 13, color: ex.Color.fromRGB(100, 100, 120) }),
      z: 10,
    });
    footer.graphics.anchor = ex.Vector.Half;
    this.add(footer);
  }

  private setupInputHandlers(): void {
    // Create input manager from engine
    const engine = this.engine;
    if (!engine) return;

    this.inputManager = new InputManager(engine);

    // Menu navigation (up/down or W/S)
    this.inputManager.onKeyPress('up', () => {
      this.selectedButton = (this.selectedButton - 1 + this.buttons.length) % this.buttons.length;
      this.updateButtonHighlight();
    });

    this.inputManager.onKeyPress('w', () => {
      this.selectedButton = (this.selectedButton - 1 + this.buttons.length) % this.buttons.length;
      this.updateButtonHighlight();
    });

    this.inputManager.onKeyPress('down', () => {
      this.selectedButton = (this.selectedButton + 1) % this.buttons.length;
      this.updateButtonHighlight();
    });

    this.inputManager.onKeyPress('s', () => {
      this.selectedButton = (this.selectedButton + 1) % this.buttons.length;
      this.updateButtonHighlight();
    });

    // Cat selection (left/right or A/D)
    this.inputManager.onKeyPress('left', () => {
      this.selectedCatIndex = (this.selectedCatIndex - 1 + ALL_CAT_COLORS.length) % ALL_CAT_COLORS.length;
      this.updateCatPreview();
    });

    this.inputManager.onKeyPress('a', () => {
      this.selectedCatIndex = (this.selectedCatIndex - 1 + ALL_CAT_COLORS.length) % ALL_CAT_COLORS.length;
      this.updateCatPreview();
    });

    this.inputManager.onKeyPress('right', () => {
      this.selectedCatIndex = (this.selectedCatIndex + 1) % ALL_CAT_COLORS.length;
      this.updateCatPreview();
    });

    this.inputManager.onKeyPress('d', () => {
      this.selectedCatIndex = (this.selectedCatIndex + 1) % ALL_CAT_COLORS.length;
      this.updateCatPreview();
    });

    // Select button
    this.inputManager.onKeyPress('enter', () => {
      this.buttons[this.selectedButton].action();
    });

    this.inputManager.onKeyPress('space', () => {
      this.buttons[this.selectedButton].action();
    });
  }

  private async handleNewGame(): Promise<void> {
    const selectedCat = ALL_CAT_COLORS[this.selectedCatIndex];
    const isUnlocked = this.isCatUnlockedForPlayer(selectedCat);

    if (!isUnlocked) {
      this.showMessage('Cat is locked! Choose an unlocked cat.', ex.Color.fromRGB(255, 100, 100));
      return;
    }

    // Initialize cloud sync for new game
    await GameState.initializeCloudForNewGame();

    GameState.reset();
    GameState.setCatColor(selectedCat);

    if (this.onStartNewGame) {
      this.onStartNewGame(selectedCat);
    }
  }

  private async handleContinue(): Promise<void> {
    // Show loading message
    this.showMessage('Loading cloud save...', ex.Color.fromRGB(255, 255, 100));

    if (this.onContinueGame) {
      const result = await this.onContinueGame();

      // Clear loading message
      this.clearMessage();

      if (!result.success) {
        this.showMessage('No saved game found. Sign in or start a new game!', ex.Color.fromRGB(255, 100, 100));
      }
      // If success, the callback handler will navigate to the appropriate scene
    } else {
      this.clearMessage();
      this.showMessage('Continue not available', ex.Color.fromRGB(255, 100, 100));
    }
  }

  private showMessage(text: string, color: ex.Color): void {
    this.clearMessage();

    // Background
    this.messageBg = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
      width: 400,
      height: 40,
      z: 100,
    });
    this.messageBg.graphics.use(new ex.Rectangle({
      width: 400,
      height: 40,
      color: ex.Color.fromRGB(0, 0, 0, 0.8),
    }));
    this.add(this.messageBg);

    // Text
    this.messageLabel = new ex.Label({
      text,
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
      font: new ex.Font({ size: 14, color }),
      z: 101,
    });
    this.messageLabel.graphics.anchor = ex.Vector.Half;
    this.add(this.messageLabel);

    // Auto-clear after 2 seconds (for error messages)
    setTimeout(() => {
      if (this.messageLabel && this.messageLabel.text === text) {
        this.clearMessage();
      }
    }, 2000);
  }

  private clearMessage(): void {
    if (this.messageBg) {
      this.messageBg.kill();
      this.messageBg = null;
    }
    if (this.messageLabel) {
      this.messageLabel.kill();
      this.messageLabel = null;
    }
  }
}
