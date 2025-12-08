/**
 * HUD (Heads-Up Display)
 *
 * Draws player stats overlay: health bar, XP, gold, floor number.
 */

import type { KAPLAYCtx } from 'kaplay';
import { GameState } from '../state/index.js';

// HUD positioning constants
const HUD_PADDING = 10;
const HEALTH_BAR_WIDTH = 100;
const HEALTH_BAR_HEIGHT = 10;

export interface HUDConfig {
  showHealth?: boolean;
  showXP?: boolean;
  showGold?: boolean;
  showFloor?: boolean;
  position?: 'bottom-left' | 'bottom-right' | 'top-right';
}

/**
 * Draw the HUD overlay
 * Call this in k.onDraw()
 */
export function drawHUD(k: KAPLAYCtx, config: HUDConfig = {}): void {
  const {
    showHealth = true,
    showXP = true,
    showGold = true,
    showFloor = true,
    position = 'bottom-left',
  } = config;

  const { health, maxHealth, xp, gold, level } = GameState.player;
  const { floorNumber } = GameState.dungeon;

  let baseX: number;
  let baseY: number;

  switch (position) {
    case 'bottom-left':
      baseX = HUD_PADDING;
      baseY = k.height() - 40;
      break;
    case 'bottom-right':
      baseX = k.width() - 200;
      baseY = k.height() - 40;
      break;
    case 'top-right':
      baseX = k.width() - 200;
      baseY = HUD_PADDING;
      break;
    default:
      baseX = HUD_PADDING;
      baseY = k.height() - 40;
  }

  let yOffset = 0;

  // Health bar
  if (showHealth) {
    // Background
    k.drawRect({
      pos: k.vec2(baseX, baseY + yOffset),
      width: HEALTH_BAR_WIDTH,
      height: HEALTH_BAR_HEIGHT,
      color: k.rgb(50, 50, 50),
      fixed: true,
    });

    // Health fill
    const healthPercent = health / maxHealth;
    const healthColor = healthPercent > 0.5 ? k.rgb(74, 222, 128) : healthPercent > 0.25 ? k.rgb(251, 191, 36) : k.rgb(239, 68, 68);

    k.drawRect({
      pos: k.vec2(baseX, baseY + yOffset),
      width: HEALTH_BAR_WIDTH * healthPercent,
      height: HEALTH_BAR_HEIGHT,
      color: healthColor,
      fixed: true,
    });

    // Health text
    k.drawText({
      text: `${health}/${maxHealth}`,
      pos: k.vec2(baseX + HEALTH_BAR_WIDTH + 5, baseY + yOffset + HEALTH_BAR_HEIGHT / 2),
      size: 10,
      anchor: 'left',
      color: k.rgb(255, 255, 255),
      fixed: true,
    });

    yOffset += HEALTH_BAR_HEIGHT + 5;
  }

  // Stats row
  const statsY = baseY + yOffset;
  let statsX = baseX;

  // Level
  k.drawText({
    text: `Lv.${level}`,
    pos: k.vec2(statsX, statsY),
    size: 10,
    color: k.rgb(167, 139, 250), // Purple
    fixed: true,
  });
  statsX += 35;

  // XP
  if (showXP) {
    k.drawText({
      text: `XP:${xp}`,
      pos: k.vec2(statsX, statsY),
      size: 10,
      color: k.rgb(250, 204, 21), // Yellow
      fixed: true,
    });
    statsX += 50;
  }

  // Gold
  if (showGold) {
    k.drawText({
      text: `G:${gold}`,
      pos: k.vec2(statsX, statsY),
      size: 10,
      color: k.rgb(251, 191, 36), // Amber
      fixed: true,
    });
    statsX += 45;
  }

  // Floor
  if (showFloor) {
    k.drawText({
      text: `F${floorNumber}`,
      pos: k.vec2(statsX, statsY),
      size: 10,
      color: k.rgb(148, 163, 184), // Slate
      fixed: true,
    });
  }
}

/**
 * Draw a simple health bar above an entity
 */
export function drawEntityHealthBar(
  k: KAPLAYCtx,
  x: number,
  y: number,
  current: number,
  max: number,
  width = 40
): void {
  const height = 4;
  const percent = current / max;

  // Background
  k.drawRect({
    pos: k.vec2(x - width / 2, y),
    width,
    height,
    color: k.rgb(50, 50, 50),
  });

  // Fill
  const color = percent > 0.5 ? k.rgb(74, 222, 128) : percent > 0.25 ? k.rgb(251, 191, 36) : k.rgb(239, 68, 68);

  k.drawRect({
    pos: k.vec2(x - width / 2, y),
    width: width * percent,
    height,
    color,
  });
}
