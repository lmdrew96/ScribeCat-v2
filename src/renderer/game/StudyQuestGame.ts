/**
 * StudyQuestGame
 *
 * The main StudyQuest game orchestrator using Excalibur.js game engine.
 * Manages all game scenes and coordinates gameplay.
 */

import { GameState } from './state/GameState.js';
import type { CatColor } from './excalibur/adapters/SpriteAdapter.js';
import { getEnemy } from './data/enemies.js';

// Excalibur imports
import { ExcaliburGame } from './excalibur/index.js';
import { TitleScene } from './excalibur/scenes/TitleScene.js';
import { TownScene } from './excalibur/scenes/TownScene.js';
import { InnScene } from './excalibur/scenes/InnScene.js';
import { HomeScene } from './excalibur/scenes/HomeScene.js';
import { ShopSceneHybrid } from './excalibur/scenes/ShopSceneHybrid.js';
import { InventoryScene } from './excalibur/scenes/InventorySceneHybrid.js';
import { BattleScene } from './excalibur/scenes/BattleScene.js';
import { DungeonScene, type DungeonSceneData } from './excalibur/scenes/DungeonScene.js';

export class StudyQuestGame {
  private canvasId: string;
  private excalibur: ExcaliburGame;

  // Autosave timer
  private autosaveInterval: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvasId = canvas.id || `studyquest-${Date.now()}`;
    canvas.id = this.canvasId;

    // Initialize Excalibur game engine
    this.excalibur = new ExcaliburGame({
      canvas,
      width: 640,
      height: 400,
    });

    // Register all game scenes
    this.registerScenes();

    console.log('StudyQuestGame initialized with Excalibur engine');
  }

  /**
   * Register all game scenes
   */
  private registerScenes(): void {
    // TitleScene (entry point)
    const titleScene = new TitleScene();
    titleScene.onStartNewGame = (catColor: CatColor) => {
      this.goTo('town', { catColor });
    };
    titleScene.onContinueGame = async () => {
      const success = await GameState.loadFromCloud();
      if (success) {
        // Check if player was in a dungeon - resume there if so
        if (GameState.hasActiveDungeonRun()) {
          this.goTo('dungeon', {
            catColor: GameState.player.catColor,
            dungeonId: GameState.dungeon.dungeonId,
            floorNumber: GameState.dungeon.floorNumber,
          });
        } else {
          this.goTo('town', { catColor: GameState.player.catColor });
        }
        return { success: true, catColor: GameState.player.catColor };
      }
      return { success: false };
    };
    this.excalibur.registerScene('title', titleScene);

    // TownScene (central hub)
    const townScene = new TownScene();
    townScene.onGoToScene = (scene: string, data?: unknown) => {
      this.goTo(scene, data as Record<string, unknown>);
    };
    this.excalibur.registerScene('town', townScene);

    // InnScene
    const innScene = new InnScene();
    innScene.onExitToTown = () => {
      this.goTo('town');
    };
    this.excalibur.registerScene('inn', innScene);

    // HomeScene
    const homeScene = new HomeScene();
    homeScene.onExitToTown = () => {
      this.goTo('town');
    };
    this.excalibur.registerScene('home', homeScene);

    // ShopScene (using hybrid Canvas + HTML approach)
    const shopScene = new ShopSceneHybrid();
    shopScene.onExitToTown = () => {
      this.goTo('town');
    };
    this.excalibur.registerScene('shop', shopScene);

    // InventoryScene
    const inventoryScene = new InventoryScene({
      onExit: (returnScene?: string, returnData?: unknown) => {
        if (returnScene) {
          this.goTo(returnScene, returnData as Record<string, unknown>);
        } else {
          this.goTo('town');
        }
      },
    });
    this.excalibur.registerScene('inventory', inventoryScene);

    // BattleScene
    const battleScene = new BattleScene();
    battleScene.onBattleEnd = (result: 'victory' | 'defeat' | 'flee', returnData?: unknown) => {
      // On defeat, return to town (dungeon state already cleared in BattleScene)
      if (result === 'defeat') {
        this.goTo('town');
        return;
      }
      // On victory or flee, return to the scene that started the battle
      const sceneData = returnData as Record<string, unknown> | undefined;
      if (sceneData) {
        this.goTo('dungeon', sceneData);
      } else {
        this.goTo('town');
      }
    };
    this.excalibur.registerScene('battle', battleScene);

    // DungeonScene
    const dungeonScene = new DungeonScene({
      onGoToBattle: (enemyId: string, returnData: DungeonSceneData) => {
        const enemyDef = getEnemy(enemyId);
        if (!enemyDef) {
          console.error(`Unknown enemy ID: ${enemyId}`);
          return;
        }
        this.goTo('battle', {
          enemyDef,
          floorLevel: returnData.floorNumber,
          returnScene: 'dungeon',
          returnData,
        });
      },
      onExitToTown: () => {
        this.goTo('town');
      },
      onOpenInventory: (returnData: DungeonSceneData) => {
        this.goTo('inventory', {
          fromScene: 'dungeon',
          dungeonReturnData: returnData,
        });
      },
    });
    this.excalibur.registerScene('dungeon', dungeonScene);

    console.log('All 8 scenes registered');
  }

  /**
   * Start the game (shows title screen)
   */
  async start(): Promise<void> {
    // Start periodic autosave (every 30 seconds)
    this.startAutosave();

    // Start the Excalibur engine
    await this.excalibur.start();

    // Go to title scene
    this.goTo('title');
  }

  /**
   * Start periodic autosave timer
   */
  private startAutosave(): void {
    // Clear any existing interval
    if (this.autosaveInterval !== null) {
      clearInterval(this.autosaveInterval);
    }

    // Autosave every 60 seconds if cloud sync is enabled
    this.autosaveInterval = window.setInterval(() => {
      if (GameState.isCloudSyncEnabled()) {
        this.performAutosave('periodic');
      }
    }, 60000); // 60 seconds

    console.log('Autosave system initialized (60s interval)');
  }

  /**
   * Perform autosave with visual indicator
   */
  private async performAutosave(reason: string): Promise<void> {
    console.log(`Autosave triggered: ${reason}`);
    this.showSaveIndicator();
    try {
      await GameState.saveToCloud();
    } catch (err) {
      console.warn('Autosave failed:', err);
    } finally {
      this.hideSaveIndicator();
    }
  }

  /**
   * Show saving indicator in canvas container
   */
  private showSaveIndicator(): void {
    const container = this.excalibur.getEngine().canvas.parentElement;
    if (!container) return;

    // Remove existing indicator if present
    this.hideSaveIndicator();

    const indicator = document.createElement('div');
    indicator.id = 'sq-save-indicator';
    indicator.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 10px;
      background: rgba(0, 0, 0, 0.75);
      border: 1px solid #6496ff;
      border-radius: 4px;
      color: #fff;
      font-size: 11px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      z-index: 200;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    indicator.innerHTML = `
      <span class="sq-save-spinner" style="
        width: 10px;
        height: 10px;
        border: 2px solid #6496ff;
        border-top-color: transparent;
        border-radius: 50%;
        animation: sq-spin 1s linear infinite;
      "></span>
      Saving...
    `;

    // Add spinner animation if not present
    if (!document.getElementById('sq-save-indicator-styles')) {
      const style = document.createElement('style');
      style.id = 'sq-save-indicator-styles';
      style.textContent = `
        @keyframes sq-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    container.appendChild(indicator);
  }

  /**
   * Hide saving indicator
   */
  private hideSaveIndicator(): void {
    const indicator = document.getElementById('sq-save-indicator');
    indicator?.remove();
  }

  /**
   * Trigger a save after significant events (floor clear, boss defeat, level up)
   */
  triggerEventSave(event: 'floor_clear' | 'boss_defeat' | 'level_up'): void {
    if (GameState.isCloudSyncEnabled()) {
      this.performAutosave(event);
    }
  }

  /**
   * Start a new game with a specific cat color
   */
  newGame(catColor: CatColor = 'grey'): void {
    GameState.reset();
    GameState.setCatColor(catColor);
    this.goTo('town');
  }

  /**
   * Go to a specific scene
   */
  goTo(scene: string, data?: Record<string, unknown>): void {
    this.excalibur.goToScene(scene, data);
  }

  /**
   * Get the Excalibur game instance (for advanced usage)
   */
  getExcaliburGame(): ExcaliburGame {
    return this.excalibur;
  }

  /**
   * Destroy the game and clean up
   */
  destroy(): void {
    // Clear autosave interval
    if (this.autosaveInterval !== null) {
      clearInterval(this.autosaveInterval);
      this.autosaveInterval = null;
    }

    // Destroy Excalibur
    this.excalibur.destroy();
  }
}
