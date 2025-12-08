/**
 * TownGame
 *
 * Wrapper class for the Town KAPLAY game.
 * Provides a simple API for integrating with the rest of the application.
 */

import type { KAPLAYCtx } from 'kaplay';
import { initGame, destroyGame } from './index.js';
import { registerTownScene, type TownSceneData } from './scenes/TownScene.js';
import { TOWN_WIDTH, TOWN_HEIGHT } from './config.js';
import type { CatColor } from './sprites/catSprites.js';
import type { BuildingId } from '../canvas/town/TownLayout.js';

// Weather types
type WeatherType = 'clear' | 'rain' | 'snow' | 'cloudy';

export class TownGame {
  private k: KAPLAYCtx;
  private canvasId: string;
  private catColor: CatColor = 'brown';
  private onBuildingInteract?: (buildingId: BuildingId) => void;
  private dayNightEnabled: boolean = true;
  private weatherEnabled: boolean = true;
  private currentWeather: WeatherType = 'clear';

  constructor(canvas: HTMLCanvasElement) {
    this.canvasId = canvas.id || `town-${Date.now()}`;
    canvas.id = this.canvasId;

    // Initialize KAPLAY
    this.k = initGame({
      canvas,
      width: TOWN_WIDTH,
      height: TOWN_HEIGHT,
      scale: 1,
      background: [26, 26, 46],
      debug: false,
    });

    // Register the scene
    registerTownScene(this.k);
  }

  /**
   * Set the cat color
   */
  setCatColor(color: CatColor): void {
    this.catColor = color;
  }

  /**
   * Set callback for building interactions
   */
  setOnBuildingInteract(callback: (buildingId: BuildingId) => void): void {
    this.onBuildingInteract = callback;
  }

  /**
   * Enable/disable day-night cycle
   */
  setDayNightEnabled(enabled: boolean): void {
    this.dayNightEnabled = enabled;
  }

  /**
   * Enable/disable weather effects
   */
  setWeatherEnabled(enabled: boolean): void {
    this.weatherEnabled = enabled;
  }

  /**
   * Set the current weather
   */
  setWeather(weather: WeatherType): void {
    this.currentWeather = weather;
    // Restart scene to apply new weather
    this.start();
  }

  /**
   * Start the game
   */
  start(): void {
    this.k.go('town', {
      catColor: this.catColor,
      onBuildingInteract: this.onBuildingInteract,
      dayNightEnabled: this.dayNightEnabled,
      weatherEnabled: this.weatherEnabled,
      initialWeather: this.currentWeather,
    } as TownSceneData);
  }

  /**
   * Destroy the game instance
   */
  destroy(): void {
    destroyGame(this.canvasId);
  }
}
