/**
 * NPC Component
 *
 * Creates an NPC entity with cat sprite and idle animation.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { loadCatSprites, getCatSpriteName, type CatColor } from '../sprites/catSprites.js';

export interface NPCConfig {
  k: KAPLAYCtx;
  x: number;
  y: number;
  color?: CatColor;
  name?: string;
  dialogue?: string[];
}

export interface NPCEntity {
  entity: GameObj;
  name: string;
  dialogue: string[];
  getPosition: () => { x: number; y: number };
}

// NPC color assignments by type
const NPC_COLORS: Record<string, CatColor> = {
  shopkeeper: 'siamese',
  innkeeper: 'white',
  guide: 'grey',
  elder: 'egypt',
  warrior: 'batman',
  mage: 'wizard',
  default: 'black',
};

export function getNPCColor(npcType?: string): CatColor {
  if (!npcType) return NPC_COLORS.default;
  return NPC_COLORS[npcType.toLowerCase()] || NPC_COLORS.default;
}

export async function createNPC(config: NPCConfig): Promise<NPCEntity> {
  const { k, x, y, color = 'grey', name = 'NPC', dialogue = [] } = config;

  // Load sprites
  await loadCatSprites(k, color);

  const spriteName = getCatSpriteName(color, 'idle');

  // Create NPC entity
  const entity = k.add([
    k.sprite(spriteName),
    k.pos(x, y),
    k.anchor('center'),
    k.scale(2),
    k.area({ shape: new k.Rect(k.vec2(-12, -12), 24, 24) }),
    k.z(10),
    'npc',
    { npcName: name, npcDialogue: dialogue },
  ]);

  // Play idle animation
  if (entity.play) {
    try {
      entity.play('idle');
    } catch {
      // Animation might not exist
    }
  }

  return {
    entity,
    name,
    dialogue,
    getPosition: () => ({ x: entity.pos.x, y: entity.pos.y }),
  };
}

/**
 * Create a simple fallback NPC (colored circle with face)
 */
export function createFallbackNPC(
  k: KAPLAYCtx,
  x: number,
  y: number,
  name: string = 'NPC'
): GameObj {
  const npcGroup: GameObj[] = [];

  // Body circle
  const body = k.add([
    k.circle(16),
    k.pos(x, y),
    k.anchor('center'),
    k.color(96, 165, 250), // Blue
    k.outline(2, k.rgb(60, 100, 180)),
    k.area({ shape: new k.Rect(k.vec2(-16, -16), 32, 32) }),
    k.z(10),
    'npc',
    { npcName: name },
  ]);

  // Cat face
  k.add([
    k.text(':3', { size: 12 }),
    k.pos(x, y + 2),
    k.anchor('center'),
    k.color(255, 255, 255),
    k.z(11),
  ]);

  return body;
}
