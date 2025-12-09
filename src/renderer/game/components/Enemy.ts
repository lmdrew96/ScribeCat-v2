/**
 * Enemy Component
 *
 * Creates and manages enemy entities for battle.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import type { EnemyDefinition } from '../data/enemies.js';

export interface EnemyConfig {
  k: KAPLAYCtx;
  x: number;
  y: number;
  enemyDef: EnemyDefinition;
  scale?: number;
}

export interface Enemy {
  entity: GameObj;
  definition: EnemyDefinition;

  playAnimation(anim: 'idle' | 'attack' | 'hurt' | 'death'): void;
  destroy(): void;
}

/**
 * Load enemy sprites
 */
async function loadEnemySprites(
  k: KAPLAYCtx,
  enemyDef: EnemyDefinition
): Promise<void> {
  const basePath = `assets/ENEMIES/${enemyDef.spriteFolder}`;
  const spritePrefix = `enemy-${enemyDef.id}`;

  // Check if already loaded
  const testSprite = `${spritePrefix}-idle`;
  try {
    k.getSprite(testSprite);
    return; // Already loaded
  } catch {
    // Need to load
  }

  // Load each animation
  const animations = ['Idle', 'Attack', 'Hurt', 'Death1'];

  for (const anim of animations) {
    const animLower = anim.toLowerCase().replace('1', '');
    const spriteName = `${spritePrefix}-${animLower}`;

    try {
      await k.loadSprite(spriteName, `${basePath}/${anim}.png`);
    } catch (e) {
      console.warn(`Failed to load enemy sprite: ${spriteName}`, e);
      // Create placeholder
      createPlaceholderSprite(k, spriteName, enemyDef.id);
    }
  }
}

/**
 * Create a colored placeholder for missing sprites
 */
function createPlaceholderSprite(
  k: KAPLAYCtx,
  name: string,
  enemyId: string
): void {
  // Different colors for different enemies
  const colors: Record<string, [number, number, number]> = {
    grey_slime: [150, 150, 150],
    demon_slime: [180, 50, 50],
  };

  const color = colors[enemyId] || [100, 100, 100];

  // Create a simple colored canvas
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    ctx.beginPath();
    ctx.ellipse(16, 20, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(11, 18, 3, 0, Math.PI * 2);
    ctx.arc(21, 18, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(12, 18, 1.5, 0, Math.PI * 2);
    ctx.arc(22, 18, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  k.loadSprite(name, canvas.toDataURL());
}

/**
 * Get sprite name for an enemy animation
 */
function getEnemySpriteName(enemyId: string, anim: string): string {
  return `enemy-${enemyId}-${anim}`;
}

/**
 * Create an enemy entity for battle
 */
export async function createEnemy(config: EnemyConfig): Promise<Enemy> {
  const { k, x, y, enemyDef, scale = 3 } = config;

  await loadEnemySprites(k, enemyDef);

  const initialSprite = getEnemySpriteName(enemyDef.id, 'idle');

  const entity = k.add([
    k.sprite(initialSprite),
    k.pos(x, y),
    k.anchor('center'),
    k.scale(scale),
    k.z(20),
    'enemy',
  ]);

  let currentAnim = 'idle';

  const enemy: Enemy = {
    entity,
    definition: enemyDef,

    playAnimation(anim: 'idle' | 'attack' | 'hurt' | 'death') {
      if (currentAnim === anim) return;
      currentAnim = anim;

      const spriteName = getEnemySpriteName(enemyDef.id, anim);
      try {
        entity.use(k.sprite(spriteName));
      } catch (e) {
        console.warn(`Animation not found: ${spriteName}`);
      }
    },

    destroy() {
      k.destroy(entity);
    },
  };

  return enemy;
}

/**
 * Create a simple placeholder enemy for testing
 * (Uses colored rectangles instead of sprites)
 */
export function createPlaceholderEnemy(
  k: KAPLAYCtx,
  x: number,
  y: number,
  enemyDef: EnemyDefinition
): GameObj {
  const colors: Record<string, [number, number, number]> = {
    grey_slime: [150, 150, 150],
    demon_slime: [180, 50, 50],
  };

  const color = colors[enemyDef.id] || [100, 100, 100];

  return k.add([
    k.rect(48, 36),
    k.pos(x, y),
    k.anchor('center'),
    k.color(color[0], color[1], color[2]),
    k.outline(2, k.rgb(0, 0, 0)),
    k.z(20),
    'enemy',
  ]);
}
