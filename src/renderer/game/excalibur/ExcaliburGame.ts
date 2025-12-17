/**
 * ExcaliburGame
 *
 * Main Excalibur.js game engine wrapper for StudyQuest.
 * This runs alongside KAPLAY during the migration period,
 * allowing scenes to be migrated incrementally.
 */

import * as ex from 'excalibur';

export interface ExcaliburGameConfig {
  canvas: HTMLCanvasElement;
  width?: number;
  height?: number;
  backgroundColor?: ex.Color;
}

export class ExcaliburGame {
  private engine: ex.Engine;
  private isRunning = false;

  constructor(config: ExcaliburGameConfig) {
    const {
      canvas,
      width = 640,
      height = 400,
      backgroundColor = ex.Color.fromHex('#1a1a2e'),
    } = config;

    this.engine = new ex.Engine({
      canvasElement: canvas,
      width,
      height,
      backgroundColor,
      displayMode: ex.DisplayMode.Fixed,
      pixelArt: true, // Enable pixel-perfect rendering
      antialiasing: false,
      suppressPlayButton: true, // Don't show play button overlay
      suppressConsoleBootMessage: true,
    });
  }

  /**
   * Get the underlying Excalibur engine instance
   */
  getEngine(): ex.Engine {
    return this.engine;
  }

  /**
   * Register a scene with the engine
   */
  registerScene(name: string, scene: ex.Scene): void {
    this.engine.addScene(name, scene);
  }

  /**
   * Navigate to a scene
   */
  goToScene(name: string, data?: unknown): void {
    // Excalibur v0.29+ uses goToScene with activation context
    this.engine.goToScene(name, {
      sceneActivationData: data,
    });
  }

  /**
   * Start the engine
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    await this.engine.start();
    this.isRunning = true;
  }

  /**
   * Stop the engine (pause, don't destroy)
   */
  stop(): void {
    if (!this.isRunning) return;

    this.engine.stop();
    this.isRunning = false;
  }

  /**
   * Check if engine is currently running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current scene name
   */
  getCurrentScene(): string {
    return this.engine.currentSceneName;
  }

  /**
   * Destroy the engine and clean up resources
   */
  destroy(): void {
    this.stop();
    // Excalibur doesn't have a built-in destroy method,
    // but stopping it and removing references is sufficient
  }
}
