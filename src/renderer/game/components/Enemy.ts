/**
 * Enemy Component
 *
 * Creates and manages enemy entities for battle.
 * Supports both animated enemies (folder with multiple PNGs) and
 * static enemies (single PNG files).
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
  isAnimated: boolean;

  playAnimation(anim: 'idle' | 'attack' | 'hurt' | 'death'): void;
  destroy(): void;
}

// Track loaded sprites to avoid reloading
const loadedSprites = new Set<string>();

/**
 * Load enemy sprites - handles both animated (folder) and static (single file) enemies
 */
async function loadEnemySprites(
  k: KAPLAYCtx,
  enemyDef: EnemyDefinition
): Promise<boolean> {
  const spritePrefix = `enemy-${enemyDef.id}`;

  // Check if already loaded
  if (loadedSprites.has(spritePrefix)) {
    return !!enemyDef.spriteFolder; // Return true if animated
  }

  // Static enemy (single image file)
  if (enemyDef.spriteFile) {
    const spritePath = `../../assets/ENEMIES/OTHER_ENEMIES/${enemyDef.spriteFile}`;
    const spriteName = `${spritePrefix}-static`;

    try {
      await k.loadSprite(spriteName, spritePath);
      loadedSprites.add(spritePrefix);
      console.log(`Loaded static enemy sprite: ${enemyDef.name}`);
      return false; // Not animated
    } catch (e) {
      console.warn(`Failed to load static enemy sprite: ${spritePath}`, e);
      createPlaceholderSprite(k, spriteName, enemyDef);
      loadedSprites.add(spritePrefix);
      return false;
    }
  }

  // Animated enemy (folder with multiple images)
  if (enemyDef.spriteFolder) {
    const basePath = `../../assets/ENEMIES/${enemyDef.spriteFolder}`;
    const animations = ['Idle', 'Attack', 'Hurt', 'Death1'];
    let loadedCount = 0;

    for (const anim of animations) {
      const animLower = anim.toLowerCase().replace('1', '');
      const spriteName = `${spritePrefix}-${animLower}`;

      try {
        await k.loadSprite(spriteName, `${basePath}/${anim}.png`);
        loadedCount++;
      } catch (e) {
        console.warn(`Failed to load enemy animation: ${spriteName}`, e);
        createPlaceholderSprite(k, spriteName, enemyDef);
      }
    }

    loadedSprites.add(spritePrefix);
    console.log(`Loaded animated enemy sprites: ${enemyDef.name} (${loadedCount}/${animations.length})`);
    return true; // Is animated
  }

  // No sprite info - create placeholder
  const spriteName = `${spritePrefix}-static`;
  createPlaceholderSprite(k, spriteName, enemyDef);
  loadedSprites.add(spritePrefix);
  return false;
}

/**
 * Create a colored placeholder for missing sprites
 * Uses the enemy's placeholderColor or a default
 */
function createPlaceholderSprite(
  k: KAPLAYCtx,
  name: string,
  enemyDef: EnemyDefinition
): void {
  const color = enemyDef.placeholderColor || [100, 100, 100];

  // Create a simple colored canvas
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Draw body (oval shape)
    ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    ctx.beginPath();
    ctx.ellipse(32, 40, 28, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark outline
    ctx.strokeStyle = `rgb(${Math.max(0, color[0] - 40)}, ${Math.max(0, color[1] - 40)}, ${Math.max(0, color[2] - 40)})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eyes
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(22, 36, 6, 0, Math.PI * 2);
    ctx.arc(42, 36, 6, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(24, 36, 3, 0, Math.PI * 2);
    ctx.arc(44, 36, 3, 0, Math.PI * 2);
    ctx.fill();

    // Add enemy initial for identification
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(enemyDef.name.charAt(0).toUpperCase(), 32, 58);
  }

  k.loadSprite(name, canvas.toDataURL());
}

/**
 * Get sprite name for an enemy animation or static sprite
 */
function getEnemySpriteName(enemyId: string, anim: string, isStatic: boolean): string {
  if (isStatic) {
    return `enemy-${enemyId}-static`;
  }
  return `enemy-${enemyId}-${anim}`;
}

/**
 * Create an enemy entity for battle
 */
export async function createEnemy(config: EnemyConfig): Promise<Enemy> {
  const { k, x, y, enemyDef, scale = 2.5 } = config;

  const isAnimated = await loadEnemySprites(k, enemyDef);
  const initialSprite = getEnemySpriteName(enemyDef.id, 'idle', !isAnimated);

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
    isAnimated,

    playAnimation(anim: 'idle' | 'attack' | 'hurt' | 'death') {
      // Static enemies don't change sprites on animation
      if (!isAnimated) {
        // For static enemies, we can do visual effects instead
        if (anim === 'attack') {
          // Quick shake for attack
          const originalX = entity.pos.x;
          entity.pos.x += 5;
          k.wait(0.1, () => { entity.pos.x = originalX - 5; });
          k.wait(0.2, () => { entity.pos.x = originalX; });
        } else if (anim === 'hurt') {
          // Flash red for hurt
          entity.color = k.rgb(255, 100, 100);
          k.wait(0.15, () => { entity.color = k.rgb(255, 255, 255); });
        } else if (anim === 'death') {
          // Fade out for death
          entity.opacity = 0.5;
          k.wait(0.2, () => { entity.opacity = 0.2; });
          k.wait(0.4, () => { entity.opacity = 0; });
        }
        return;
      }

      // Animated enemies - change sprite
      if (currentAnim === anim) return;
      currentAnim = anim;

      const spriteName = getEnemySpriteName(enemyDef.id, anim, false);
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
  const color = enemyDef.placeholderColor || [100, 100, 100];

  return k.add([
    k.rect(64, 48),
    k.pos(x, y),
    k.anchor('center'),
    k.color(color[0], color[1], color[2]),
    k.outline(2, k.rgb(0, 0, 0)),
    k.z(20),
    'enemy',
  ]);
}

/**
 * Get enemies by tier for floor-based encounters
 */
export function getEnemiesByTier(tier: 'low' | 'mid' | 'high' | 'boss'): string[] {
  // Import ENEMIES dynamically to get all enemy IDs by tier
  const { ENEMIES } = require('../data/enemies.js');
  return Object.keys(ENEMIES).filter(id => ENEMIES[id].tier === tier);
}

/**
 * Get appropriate enemy pool for a dungeon floor
 */
export function getEnemyPoolForFloor(floor: number): string[] {
  const { ENEMIES } = require('../data/enemies.js');
  const allEnemies = Object.keys(ENEMIES);

  // Floor 1-2: Only low tier enemies
  if (floor <= 2) {
    return allEnemies.filter(id => ENEMIES[id].tier === 'low');
  }

  // Floor 3-5: Low and mid tier enemies
  if (floor <= 5) {
    return allEnemies.filter(id =>
      ENEMIES[id].tier === 'low' || ENEMIES[id].tier === 'mid'
    );
  }

  // Floor 6-8: Mid and high tier enemies
  if (floor <= 8) {
    return allEnemies.filter(id =>
      ENEMIES[id].tier === 'mid' || ENEMIES[id].tier === 'high'
    );
  }

  // Floor 9+: High tier and bosses
  return allEnemies.filter(id =>
    ENEMIES[id].tier === 'high' || ENEMIES[id].tier === 'boss'
  );
}
