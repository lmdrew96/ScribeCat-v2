/**
 * Enemy Component
 *
 * Creates and manages enemy entities for battle.
 * Supports both animated enemies (sprite sheets) and static enemies (single PNGs).
 *
 * FIXES:
 * - Calculates scale based on sprite size for consistent display
 * - Sprite sheets properly sliced with sliceX
 * - Dungeon enemies wander around
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import type { EnemyDefinition } from '../data/enemies.js';

export interface EnemyConfig {
  k: KAPLAYCtx;
  x: number;
  y: number;
  enemyDef: EnemyDefinition;
  targetSize?: number; // Desired display size in pixels
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

// Sprite sheet frame counts for slime animations
const SLIME_FRAME_COUNTS: Record<string, number> = {
  'Idle': 4,
  'Walk': 4,
  'Attack': 5,
  'Hurt': 4,
  'Death1': 4,
};

// Target display sizes
const BATTLE_TARGET_SIZE = 80;  // Enemy size in battle
const DUNGEON_TARGET_SIZE = 32; // Enemy size in dungeon exploration

/**
 * Load enemy sprites
 */
async function loadEnemySprites(
  k: KAPLAYCtx,
  enemyDef: EnemyDefinition
): Promise<boolean> {
  const spritePrefix = `enemy-${enemyDef.id}`;

  if (loadedSprites.has(spritePrefix)) {
    return !!enemyDef.spriteFolder;
  }

  // Static enemy (single image file)
  if (enemyDef.spriteFile) {
    const spritePath = `../../assets/ENEMIES/OTHER_ENEMIES/${enemyDef.spriteFile}`;
    const spriteName = `${spritePrefix}-static`;

    try {
      await k.loadSprite(spriteName, spritePath);
      loadedSprites.add(spritePrefix);
      console.log(`Loaded static enemy sprite: ${enemyDef.name}`);
      return false;
    } catch (e) {
      console.warn(`Failed to load static enemy sprite: ${spritePath}`, e);
      createPlaceholderSprite(k, spriteName, enemyDef);
      loadedSprites.add(spritePrefix);
      return false;
    }
  }

  // Animated enemy (folder with sprite sheet PNGs)
  if (enemyDef.spriteFolder) {
    const basePath = `../../assets/ENEMIES/${enemyDef.spriteFolder}`;

    const animations: Array<{ name: string; file: string; frames: number }> = [
      { name: 'idle', file: 'Idle', frames: SLIME_FRAME_COUNTS['Idle'] },
      { name: 'walk', file: 'Walk', frames: SLIME_FRAME_COUNTS['Walk'] },
      { name: 'attack', file: 'Attack', frames: SLIME_FRAME_COUNTS['Attack'] },
      { name: 'hurt', file: 'Hurt', frames: SLIME_FRAME_COUNTS['Hurt'] },
      { name: 'death', file: 'Death1', frames: SLIME_FRAME_COUNTS['Death1'] },
    ];

    for (const anim of animations) {
      const spriteName = `${spritePrefix}-${anim.name}`;

      try {
        await k.loadSprite(spriteName, `${basePath}/${anim.file}.png`, {
          sliceX: anim.frames,
          anims: {
            [anim.name]: {
              from: 0,
              to: anim.frames - 1,
              loop: anim.name === 'idle' || anim.name === 'walk',
              speed: 8,
            },
          },
        });
      } catch (e) {
        console.warn(`Failed to load enemy animation: ${spriteName}`, e);
        createPlaceholderSprite(k, spriteName, enemyDef);
      }
    }

    loadedSprites.add(spritePrefix);
    console.log(`Loaded animated enemy sprites: ${enemyDef.name}`);
    return true;
  }

  // No sprite info - create placeholder
  const spriteName = `${spritePrefix}-static`;
  createPlaceholderSprite(k, spriteName, enemyDef);
  loadedSprites.add(spritePrefix);
  return false;
}

/**
 * Create a colored placeholder for missing sprites
 */
function createPlaceholderSprite(
  k: KAPLAYCtx,
  name: string,
  enemyDef: EnemyDefinition
): void {
  const color = enemyDef.placeholderColor || [100, 100, 100];

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    ctx.beginPath();
    ctx.ellipse(32, 40, 28, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgb(${Math.max(0, color[0] - 40)}, ${Math.max(0, color[1] - 40)}, ${Math.max(0, color[2] - 40)})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(22, 36, 6, 0, Math.PI * 2);
    ctx.arc(42, 36, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(24, 36, 3, 0, Math.PI * 2);
    ctx.arc(44, 36, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(enemyDef.name.charAt(0).toUpperCase(), 32, 58);
  }

  k.loadSprite(name, canvas.toDataURL());
}

function getEnemySpriteName(enemyId: string, anim: string, isStatic: boolean): string {
  if (isStatic) {
    return `enemy-${enemyId}-static`;
  }
  return `enemy-${enemyId}-${anim}`;
}

/**
 * Calculate scale to normalize enemy to target display size
 * FIXED: Uses sprite size metadata instead of fixed scales
 */
function calculateScale(enemyDef: EnemyDefinition, targetSize: number): number {
  const spriteSize = enemyDef.spriteSize || 64;
  return targetSize / spriteSize;
}

/**
 * Create an enemy entity for battle
 * FIXED: Now scales based on sprite size for consistent display
 */
export async function createEnemy(config: EnemyConfig): Promise<Enemy> {
  const { k, x, y, enemyDef, targetSize = BATTLE_TARGET_SIZE } = config;

  const isAnimated = await loadEnemySprites(k, enemyDef);
  const initialSprite = getEnemySpriteName(enemyDef.id, 'idle', !isAnimated);

  // FIXED: Calculate scale based on sprite size
  const scale = calculateScale(enemyDef, targetSize);

  const entity = k.add([
    k.sprite(initialSprite),
    k.pos(x, y),
    k.anchor('center'),
    k.scale(scale),
    k.z(20),
    'enemy',
  ]);

  // Play idle animation if animated
  if (isAnimated) {
    try {
      entity.play('idle');
    } catch (e) {
      console.warn('Could not play idle animation');
    }
  }

  let currentAnim = 'idle';

  const enemy: Enemy = {
    entity,
    definition: enemyDef,
    isAnimated,

    playAnimation(anim: 'idle' | 'attack' | 'hurt' | 'death') {
      if (!isAnimated) {
        // Static enemies - visual effects
        if (anim === 'attack') {
          const originalX = entity.pos.x;
          entity.pos.x += 5;
          k.wait(0.1, () => { entity.pos.x = originalX - 5; });
          k.wait(0.2, () => { entity.pos.x = originalX; });
        } else if (anim === 'hurt') {
          entity.color = k.rgb(255, 100, 100);
          k.wait(0.15, () => { entity.color = k.rgb(255, 255, 255); });
        } else if (anim === 'death') {
          entity.opacity = 0.5;
          k.wait(0.2, () => { entity.opacity = 0.2; });
          k.wait(0.4, () => { entity.opacity = 0; });
        }
        return;
      }

      if (currentAnim === anim) return;
      currentAnim = anim;

      const spriteName = getEnemySpriteName(enemyDef.id, anim, false);
      try {
        entity.use(k.sprite(spriteName));
        entity.play(anim);
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
 */
export function createPlaceholderEnemy(
  k: KAPLAYCtx,
  x: number,
  y: number,
  enemyDef: EnemyDefinition
): GameObj {
  const color = enemyDef.placeholderColor || [100, 100, 100];

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

/**
 * Create a wandering enemy entity for dungeon exploration
 * FIXED: Now scales based on sprite size
 */
export async function createDungeonEnemy(config: {
  k: KAPLAYCtx;
  x: number;
  y: number;
  enemyId: string;
  bounds?: { minX: number; maxX: number; minY: number; maxY: number };
}): Promise<GameObj> {
  const { k, x, y, enemyId, bounds } = config;
  const { ENEMIES } = await import('../data/enemies.js');
  const enemyDef = ENEMIES[enemyId];

  if (!enemyDef) {
    return k.add([
      k.circle(10),
      k.pos(x, y),
      k.anchor('center'),
      k.color(239, 68, 68),
      k.outline(2, k.rgb(180, 40, 40)),
      k.area({ shape: new k.Rect(k.vec2(-10, -10), 20, 20) }),
      k.z(5),
      'enemy',
      { enemyId },
    ]);
  }

  try {
    const isAnimated = await loadEnemySprites(k, enemyDef);
    const spriteName = getEnemySpriteName(enemyDef.id, 'idle', !isAnimated);

    // FIXED: Calculate scale for dungeon size
    const scale = calculateScale(enemyDef, DUNGEON_TARGET_SIZE);

    const entity = k.add([
      k.sprite(spriteName),
      k.pos(x, y),
      k.anchor('center'),
      k.scale(scale),
      k.area({ shape: new k.Rect(k.vec2(-12, -12), 24, 24) }),
      k.z(5),
      'enemy',
      { enemyId, isAnimated },
    ]);

    if (isAnimated) {
      try {
        entity.play('idle');
      } catch (e) {}
    }

    addWanderBehavior(k, entity, bounds);

    return entity;
  } catch {
    const color = enemyDef.placeholderColor || [239, 68, 68];

    const body = k.add([
      k.circle(10),
      k.pos(x, y),
      k.anchor('center'),
      k.color(color[0], color[1], color[2]),
      k.outline(2, k.rgb(
        Math.max(0, color[0] - 40),
        Math.max(0, color[1] - 40),
        Math.max(0, color[2] - 40)
      )),
      k.area({ shape: new k.Rect(k.vec2(-10, -10), 20, 20) }),
      k.z(5),
      'enemy',
      { enemyId },
    ]);

    addWanderBehavior(k, body, bounds);

    return body;
  }
}

/**
 * Add simple wandering behavior to an enemy
 */
function addWanderBehavior(
  k: KAPLAYCtx,
  entity: GameObj,
  bounds?: { minX: number; maxX: number; minY: number; maxY: number }
): void {
  const moveBounds = bounds || {
    minX: entity.pos.x - 60,
    maxX: entity.pos.x + 60,
    minY: entity.pos.y - 40,
    maxY: entity.pos.y + 40,
  };

  let targetX = entity.pos.x;
  let targetY = entity.pos.y;
  let moveSpeed = 20 + Math.random() * 20;
  let waitTime = 0;
  let isWaiting = true;

  function pickNewTarget() {
    targetX = moveBounds.minX + Math.random() * (moveBounds.maxX - moveBounds.minX);
    targetY = moveBounds.minY + Math.random() * (moveBounds.maxY - moveBounds.minY);
    isWaiting = false;
  }

  function startWaiting() {
    waitTime = 1 + Math.random() * 2;
    isWaiting = true;
  }

  startWaiting();

  k.onUpdate(() => {
    if (!entity.exists()) return;

    if (isWaiting) {
      waitTime -= k.dt();
      if (waitTime <= 0) {
        pickNewTarget();
      }
      return;
    }

    const dx = targetX - entity.pos.x;
    const dy = targetY - entity.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      startWaiting();
      return;
    }

    const moveX = (dx / dist) * moveSpeed * k.dt();
    const moveY = (dy / dist) * moveSpeed * k.dt();

    entity.pos.x += moveX;
    entity.pos.y += moveY;

    if (entity.scale && dx !== 0) {
      entity.scale.x = dx > 0 ? Math.abs(entity.scale.x) : -Math.abs(entity.scale.x);
    }
  });
}

/**
 * Get enemies by tier for floor-based encounters
 */
export function getEnemiesByTier(tier: 'low' | 'mid' | 'high' | 'boss'): string[] {
  const { ENEMIES } = require('../data/enemies.js');
  return Object.keys(ENEMIES).filter(id => ENEMIES[id].tier === tier);
}

/**
 * Get appropriate enemy pool for a dungeon floor
 */
export function getEnemyPoolForFloor(floor: number): string[] {
  const { ENEMIES } = require('../data/enemies.js');
  const allEnemies = Object.keys(ENEMIES);

  if (floor <= 2) {
    return allEnemies.filter(id => ENEMIES[id].tier === 'low');
  }
  if (floor <= 5) {
    return allEnemies.filter(id =>
      ENEMIES[id].tier === 'low' || ENEMIES[id].tier === 'mid'
    );
  }
  if (floor <= 8) {
    return allEnemies.filter(id =>
      ENEMIES[id].tier === 'mid' || ENEMIES[id].tier === 'high'
    );
  }
  return allEnemies.filter(id =>
    ENEMIES[id].tier === 'high' || ENEMIES[id].tier === 'boss'
  );
}

// Export target sizes for use elsewhere
export { BATTLE_TARGET_SIZE, DUNGEON_TARGET_SIZE };
