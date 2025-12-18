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
import { AudioManager } from '../../audio/AudioManager.js';
import { loadBackground, createBackgroundActor } from '../../loaders/BackgroundLoader.js';

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
  private catPreviewGeneration = 0; // Used to cancel stale async operations
  private catNameLabel: ex.Label | null = null;
  private unlockLabel: ex.Label | null = null;
  private lockIcon: ex.Label | null = null;

  // Menu
  private buttons: MenuButton[] = [];
  private buttonLabels: ex.Label[] = [];
  private selectedButton = 0;

  // Settings menu
  private settingsMenuActive = false;
  private settingsMenuActors: ex.Actor[] = [];
  private settingsSelection = 0;

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
    this.settingsMenuActive = false;

    // Clear any existing actors
    this.clear();

    // Setup scene
    this.setupBackground();
    this.setupTitle();
    this.setupCatPreview();
    this.setupMenu();
    this.setupFooter();
    this.setupInputHandlers();

    // Play title music
    AudioManager.playSceneMusic('title');

    console.log('=== StudyQuest Title Scene (Excalibur) ===');
  }

  onDeactivate(): void {
    // Clean up input manager to remove engine-level event listeners
    this.inputManager?.destroy();
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
    // Increment generation to cancel any pending async operations
    const generation = ++this.catPreviewGeneration;

    // Kill only if actor was actually added to scene (has a scene reference)
    if (this.catPreview?.scene) {
      this.catPreview.kill();
    }
    this.catPreview = null;

    if (this.lockIcon?.scene) {
      this.lockIcon.kill();
    }
    this.lockIcon = null;

    const color = ALL_CAT_COLORS[this.selectedCatIndex];
    const isUnlocked = this.isCatUnlockedForPlayer(color);

    // Create preview actor
    this.catPreview = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 130),
      width: 96, // 32 * 3 scale
      height: 96,
      z: 20,
    });

    // Add to scene BEFORE async operation so kill() works properly
    this.add(this.catPreview);

    if (isUnlocked) {
      // Use placeholder initially
      this.catPreview.graphics.use(new ex.Rectangle({
        width: 96,
        height: 96,
        color: ex.Color.fromRGB(50, 50, 80, 0.5),
      }));

      // Load and display cat animation
      try {
        const animation = await loadCatAnimation(color, 'idle');

        // Check if this request is still current (user didn't switch cats)
        if (generation !== this.catPreviewGeneration) return;

        // Scale up the animation
        const scaledAnim = animation.clone();
        scaledAnim.scale = new ex.Vector(3, 3);
        if (this.catPreview) {
          this.catPreview.graphics.use(scaledAnim);
        }
      } catch (err) {
        console.warn('Failed to load cat animation:', err);
        if (generation === this.catPreviewGeneration && this.catPreview) {
          this.catPreview.graphics.use(new ex.Rectangle({
            width: 96,
            height: 96,
            color: ex.Color.Gray,
          }));
        }
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
      {
        label: 'Settings',
        action: () => this.openSettingsMenu(),
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

  // ====== SETTINGS MENU ======

  private openSettingsMenu(): void {
    this.settingsMenuActive = true;
    this.settingsSelection = 0;
    this.clearSettingsMenu();

    const audio = AudioManager;
    const menuX = CANVAS_WIDTH / 2;
    const menuStartY = 120;
    const rowHeight = 50;

    // Background panel
    const panelBg = new ex.Actor({
      pos: new ex.Vector(menuX, CANVAS_HEIGHT / 2),
      width: 320,
      height: 280,
      z: 200,
    });
    panelBg.graphics.use(new ex.Rectangle({
      width: 320,
      height: 280,
      color: ex.Color.fromRGB(20, 20, 40, 0.95),
    }));
    this.add(panelBg);
    this.settingsMenuActors.push(panelBg);

    // Title
    const title = new ex.Label({
      text: 'Settings',
      pos: new ex.Vector(menuX, menuStartY - 30),
      font: new ex.Font({ size: 24, color: ex.Color.fromHex('#FBBF24') }),
      z: 201,
    });
    title.graphics.anchor = ex.Vector.Half;
    this.add(title);
    this.settingsMenuActors.push(title);

    // Music Volume Row
    this.createSettingsRow(
      'Music Volume',
      Math.round(audio.musicVolume * 100) + '%',
      menuX,
      menuStartY + rowHeight * 0,
      0
    );

    // SFX Volume Row
    this.createSettingsRow(
      'SFX Volume',
      Math.round(audio.sfxVolume * 100) + '%',
      menuX,
      menuStartY + rowHeight * 1,
      1
    );

    // Music Enabled Row
    this.createSettingsRow(
      'Music',
      audio.musicEnabled ? 'ON' : 'OFF',
      menuX,
      menuStartY + rowHeight * 2,
      2
    );

    // SFX Enabled Row
    this.createSettingsRow(
      'Sound Effects',
      audio.sfxEnabled ? 'ON' : 'OFF',
      menuX,
      menuStartY + rowHeight * 3,
      3
    );

    // Back button
    this.createSettingsRow(
      'Back',
      '',
      menuX,
      menuStartY + rowHeight * 4 + 10,
      4
    );

    // Instructions
    const instructions = new ex.Label({
      text: 'W/S: Navigate | A/D: Adjust | ESC: Back',
      pos: new ex.Vector(menuX, menuStartY + rowHeight * 5 + 20),
      font: new ex.Font({ size: 12, color: ex.Color.fromRGB(120, 120, 150) }),
      z: 201,
    });
    instructions.graphics.anchor = ex.Vector.Half;
    this.add(instructions);
    this.settingsMenuActors.push(instructions);

    // Setup settings input handlers
    this.setupSettingsInputHandlers();
  }

  private createSettingsRow(label: string, value: string, x: number, y: number, index: number): void {
    const isSelected = this.settingsSelection === index;
    const labelColor = isSelected ? ex.Color.fromHex('#FBBF24') : ex.Color.fromRGB(200, 200, 200);

    // Label
    const labelActor = new ex.Label({
      text: isSelected ? `> ${label}` : label,
      pos: new ex.Vector(x - 80, y),
      font: new ex.Font({ size: 16, color: labelColor }),
      z: 201,
    });
    labelActor.graphics.anchor = new ex.Vector(0, 0.5);
    this.add(labelActor);
    this.settingsMenuActors.push(labelActor);

    // Value (if any)
    if (value) {
      const valueActor = new ex.Label({
        text: value,
        pos: new ex.Vector(x + 80, y),
        font: new ex.Font({ size: 16, color: isSelected ? ex.Color.fromHex('#60A5FA') : ex.Color.fromRGB(150, 150, 180) }),
        z: 201,
      });
      valueActor.graphics.anchor = new ex.Vector(1, 0.5);
      this.add(valueActor);
      this.settingsMenuActors.push(valueActor);
    }
  }

  private clearSettingsMenu(): void {
    for (const actor of this.settingsMenuActors) {
      actor.kill();
    }
    this.settingsMenuActors = [];
  }

  private closeSettingsMenu(): void {
    this.settingsMenuActive = false;
    this.clearSettingsMenu();
    this.setupInputHandlers(); // Restore main menu input handlers
  }

  private setupSettingsInputHandlers(): void {
    // Temporarily remove main input handlers
    this.inputManager?.destroy();
    this.inputManager = null;

    const engine = this.engine;
    if (!engine) return;

    this.inputManager = new InputManager(engine);
    const audio = AudioManager;

    // Navigate settings
    this.inputManager.onKeyPress('up', () => {
      if (this.settingsMenuActive) {
        this.settingsSelection = (this.settingsSelection - 1 + 5) % 5;
        this.refreshSettingsMenu();
      }
    });

    this.inputManager.onKeyPress('w', () => {
      if (this.settingsMenuActive) {
        this.settingsSelection = (this.settingsSelection - 1 + 5) % 5;
        this.refreshSettingsMenu();
      }
    });

    this.inputManager.onKeyPress('down', () => {
      if (this.settingsMenuActive) {
        this.settingsSelection = (this.settingsSelection + 1) % 5;
        this.refreshSettingsMenu();
      }
    });

    this.inputManager.onKeyPress('s', () => {
      if (this.settingsMenuActive) {
        this.settingsSelection = (this.settingsSelection + 1) % 5;
        this.refreshSettingsMenu();
      }
    });

    // Adjust values (left/right)
    this.inputManager.onKeyPress('left', () => this.adjustSetting(-1));
    this.inputManager.onKeyPress('a', () => this.adjustSetting(-1));
    this.inputManager.onKeyPress('right', () => this.adjustSetting(1));
    this.inputManager.onKeyPress('d', () => this.adjustSetting(1));

    // Select/Enter (for Back or toggle)
    this.inputManager.onKeyPress('enter', () => this.activateSetting());
    this.inputManager.onKeyPress('space', () => this.activateSetting());

    // Escape to close
    this.inputManager.onKeyPress('escape', () => this.closeSettingsMenu());
  }

  private adjustSetting(delta: number): void {
    if (!this.settingsMenuActive) return;

    const audio = AudioManager;
    const step = 0.1; // 10% increments

    switch (this.settingsSelection) {
      case 0: // Music Volume
        audio.musicVolume = Math.max(0, Math.min(1, audio.musicVolume + delta * step));
        break;
      case 1: // SFX Volume
        audio.sfxVolume = Math.max(0, Math.min(1, audio.sfxVolume + delta * step));
        // Play a test sound when adjusting
        if (delta !== 0) {
          audio.playSfx('button_click');
        }
        break;
      case 2: // Music Enabled
        audio.musicEnabled = delta > 0 ? true : false;
        break;
      case 3: // SFX Enabled
        audio.sfxEnabled = delta > 0 ? true : false;
        break;
      case 4: // Back button - no adjustment
        break;
    }

    this.refreshSettingsMenu();
  }

  private activateSetting(): void {
    if (!this.settingsMenuActive) return;

    const audio = AudioManager;

    switch (this.settingsSelection) {
      case 2: // Toggle Music
        audio.musicEnabled = !audio.musicEnabled;
        this.refreshSettingsMenu();
        break;
      case 3: // Toggle SFX
        audio.sfxEnabled = !audio.sfxEnabled;
        this.refreshSettingsMenu();
        break;
      case 4: // Back
        this.closeSettingsMenu();
        break;
    }
  }

  private refreshSettingsMenu(): void {
    this.clearSettingsMenu();
    
    const audio = AudioManager;
    const menuX = CANVAS_WIDTH / 2;
    const menuStartY = 120;
    const rowHeight = 50;

    // Background panel
    const panelBg = new ex.Actor({
      pos: new ex.Vector(menuX, CANVAS_HEIGHT / 2),
      width: 320,
      height: 280,
      z: 200,
    });
    panelBg.graphics.use(new ex.Rectangle({
      width: 320,
      height: 280,
      color: ex.Color.fromRGB(20, 20, 40, 0.95),
    }));
    this.add(panelBg);
    this.settingsMenuActors.push(panelBg);

    // Title
    const title = new ex.Label({
      text: 'Settings',
      pos: new ex.Vector(menuX, menuStartY - 30),
      font: new ex.Font({ size: 24, color: ex.Color.fromHex('#FBBF24') }),
      z: 201,
    });
    title.graphics.anchor = ex.Vector.Half;
    this.add(title);
    this.settingsMenuActors.push(title);

    // Music Volume Row
    this.createSettingsRow(
      'Music Volume',
      Math.round(audio.musicVolume * 100) + '%',
      menuX,
      menuStartY + rowHeight * 0,
      0
    );

    // SFX Volume Row
    this.createSettingsRow(
      'SFX Volume',
      Math.round(audio.sfxVolume * 100) + '%',
      menuX,
      menuStartY + rowHeight * 1,
      1
    );

    // Music Enabled Row
    this.createSettingsRow(
      'Music',
      audio.musicEnabled ? 'ON' : 'OFF',
      menuX,
      menuStartY + rowHeight * 2,
      2
    );

    // SFX Enabled Row
    this.createSettingsRow(
      'Sound Effects',
      audio.sfxEnabled ? 'ON' : 'OFF',
      menuX,
      menuStartY + rowHeight * 3,
      3
    );

    // Back button
    this.createSettingsRow(
      'Back',
      '',
      menuX,
      menuStartY + rowHeight * 4 + 10,
      4
    );

    // Instructions
    const instructions = new ex.Label({
      text: 'W/S: Navigate | A/D: Adjust | ESC: Back',
      pos: new ex.Vector(menuX, menuStartY + rowHeight * 5 + 20),
      font: new ex.Font({ size: 12, color: ex.Color.fromRGB(120, 120, 150) }),
      z: 201,
    });
    instructions.graphics.anchor = ex.Vector.Half;
    this.add(instructions);
    this.settingsMenuActors.push(instructions);
  }
}
