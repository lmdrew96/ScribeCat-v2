/**
 * Interaction System
 *
 * Handles proximity-based interactions for NPCs, buildings, objects.
 * Used by DungeonScene and TownScene.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';

export interface Interactable {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: string;
  data?: unknown;
  onInteract?: () => void;
}

export interface InteractionSystemConfig {
  player: GameObj;
  interactables: Interactable[];
  onNearby?: (interactable: Interactable | null) => void;
  onInteract?: (interactable: Interactable) => void;
}

/**
 * Create an interaction system that tracks nearby interactables
 */
export function createInteractionSystem(k: KAPLAYCtx, config: InteractionSystemConfig) {
  const { player, interactables, onNearby, onInteract } = config;
  let currentNearby: Interactable | null = null;

  // Update loop to check proximity
  const cancelUpdate = k.onUpdate(() => {
    let nearestInteractable: Interactable | null = null;
    let nearestDistance = Infinity;

    for (const interactable of interactables) {
      const dist = player.pos.dist(k.vec2(interactable.x, interactable.y));
      if (dist < interactable.radius && dist < nearestDistance) {
        nearestDistance = dist;
        nearestInteractable = interactable;
      }
    }

    if (nearestInteractable !== currentNearby) {
      currentNearby = nearestInteractable;
      onNearby?.(currentNearby);
    }
  });

  // Key handlers
  const cancelEnter = k.onKeyPress('enter', () => {
    if (currentNearby) {
      currentNearby.onInteract?.();
      onInteract?.(currentNearby);
    }
  });

  const cancelSpace = k.onKeyPress('space', () => {
    if (currentNearby) {
      currentNearby.onInteract?.();
      onInteract?.(currentNearby);
    }
  });

  return {
    get current() {
      return currentNearby;
    },

    addInteractable(interactable: Interactable) {
      interactables.push(interactable);
    },

    removeInteractable(id: string) {
      const index = interactables.findIndex((i) => i.id === id);
      if (index !== -1) {
        interactables.splice(index, 1);
      }
    },

    destroy() {
      cancelUpdate();
      cancelEnter();
      cancelSpace();
    },
  };
}

/**
 * Draw an interaction prompt
 */
export function drawInteractionPrompt(
  k: KAPLAYCtx,
  text: string,
  options: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    color?: ReturnType<typeof k.rgb>;
  } = {}
): void {
  const {
    x = k.width() / 2,
    y = k.height() - 30,
    width = 180,
    height = 28,
    color = k.rgb(251, 191, 36),
  } = options;

  k.drawRect({
    pos: k.vec2(x - width / 2, y),
    width,
    height,
    color: k.rgb(0, 0, 0),
    opacity: 0.75,
    radius: 4,
    fixed: true,
  });

  k.drawText({
    text,
    pos: k.vec2(x, y + height / 2 + 2),
    size: 11,
    anchor: 'center',
    color,
    fixed: true,
  });
}
