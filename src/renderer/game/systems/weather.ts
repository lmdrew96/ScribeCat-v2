/**
 * Weather System
 *
 * Handles weather particle effects for rain, snow, etc.
 */

import type { KAPLAYCtx } from 'kaplay';

export type WeatherType = 'clear' | 'rain' | 'snow' | 'cloudy';

export interface WeatherConfig {
  canvasWidth: number;
  canvasHeight: number;
  intensity?: number; // 0.5 = half particles, 2 = double particles
}

/**
 * Create a weather system that spawns particles
 */
export function createWeatherSystem(k: KAPLAYCtx, initialWeather: WeatherType, config: WeatherConfig) {
  const { canvasWidth, canvasHeight, intensity = 1 } = config;
  let currentWeather = initialWeather;
  let spawnCancel: (() => void) | null = null;

  function startWeather(weather: WeatherType) {
    // Stop existing weather
    if (spawnCancel) {
      spawnCancel();
      spawnCancel = null;
    }

    currentWeather = weather;

    if (weather === 'clear' || weather === 'cloudy') {
      return; // No particles for these
    }

    const spawnInterval = weather === 'rain' ? 0.05 / intensity : 0.1 / intensity;

    spawnCancel = k.loop(spawnInterval, () => {
      const camPos = k.camPos();

      if (weather === 'rain') {
        k.add([
          k.rect(1, 8 + Math.random() * 6),
          k.pos(
            camPos.x - canvasWidth / 2 + Math.random() * canvasWidth,
            camPos.y - canvasHeight / 2 - 10
          ),
          k.color(155, 185, 255),
          k.opacity(0.5 + Math.random() * 0.3),
          k.move(k.vec2(-0.3, 1).unit(), 350 + Math.random() * 100),
          k.lifespan(2),
          k.z(100),
          'weatherParticle',
        ]);
      } else if (weather === 'snow') {
        const size = 2 + Math.random() * 3;
        k.add([
          k.circle(size),
          k.pos(
            camPos.x - canvasWidth / 2 + Math.random() * canvasWidth,
            camPos.y - canvasHeight / 2 - 10
          ),
          k.color(255, 255, 255),
          k.opacity(0.6 + Math.random() * 0.3),
          k.move(k.vec2(-0.1 + Math.random() * 0.2, 1).unit(), 40 + Math.random() * 40),
          k.lifespan(12),
          k.z(100),
          'weatherParticle',
        ]);
      }
    });
  }

  // Start initial weather if not clear
  if (initialWeather !== 'clear') {
    startWeather(initialWeather);
  }

  return {
    get current() {
      return currentWeather;
    },

    setWeather(weather: WeatherType) {
      if (weather !== currentWeather) {
        startWeather(weather);
      }
    },

    destroy() {
      if (spawnCancel) {
        spawnCancel();
      }
      // Clean up existing particles
      k.get('weatherParticle').forEach((p) => k.destroy(p));
    },
  };
}

/**
 * Draw cloudy overlay
 */
export function drawCloudOverlay(k: KAPLAYCtx, opacity = 0.15): void {
  k.drawRect({
    pos: k.vec2(0, 0),
    width: k.width(),
    height: k.height(),
    color: k.rgb(128, 128, 140),
    opacity,
    fixed: true,
  });
}
