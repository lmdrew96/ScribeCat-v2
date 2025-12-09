/**
 * Interaction System
 *
 * Handles proximity-based interaction detection.
 * Shows prompts when player is near interactable objects.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import type { Player } from '../components/Player.js';

export interface Interactable {
  entity: GameObj;
  type: string;
  promptText: string;
  onInteract: () => void;
  range?: number; // Custom interaction range (default 50)
}

export interface InteractionConfig {
  k: KAPLAYCtx;
  player: Player;
  interactables: Interactable[];
  onHighlight?: (target: Interactable | null) => void;
}

export interface InteractionSystem {
  currentTarget: Interactable | null;
  addInteractable: (interactable: Interactable) => void;
  removeInteractable: (entity: GameObj) => void;
  destroy: () => void;
}

const DEFAULT_RANGE = 50;

export function setupInteraction(config: InteractionConfig): InteractionSystem {
  const { k, player, interactables, onHighlight } = config;

  let currentTarget: Interactable | null = null;
  const items = [...interactables];

  // Prompt display elements
  let promptBg: GameObj | null = null;
  let promptText: GameObj | null = null;

  function showPrompt(text: string): void {
    if (promptBg) return; // Already showing

    const canvasWidth = 640;
    const canvasHeight = 400;

    promptBg = k.add([
      k.rect(200, 28),
      k.pos(canvasWidth / 2 - 100, canvasHeight - 45),
      k.color(0, 0, 0),
      k.opacity(0.8),
      k.z(100),
      'interaction-prompt',
    ]);

    promptText = k.add([
      k.text(text, { size: 12 }),
      k.pos(canvasWidth / 2, canvasHeight - 31),
      k.anchor('center'),
      k.color(251, 191, 36), // Amber
      k.z(101),
      'interaction-prompt',
    ]);
  }

  function hidePrompt(): void {
    if (promptBg) {
      k.destroy(promptBg);
      promptBg = null;
    }
    if (promptText) {
      k.destroy(promptText);
      promptText = null;
    }
  }

  // Update loop - check proximity each frame
  const updateCancel = k.onUpdate(() => {
    let nearest: Interactable | null = null;
    let nearestDist = Infinity;

    const playerPos = player.entity.pos;

    // Find nearest interactable within range
    for (const item of items) {
      if (!item.entity.exists()) continue;

      const dist = playerPos.dist(item.entity.pos);
      const range = item.range ?? DEFAULT_RANGE;

      if (dist < range && dist < nearestDist) {
        nearest = item;
        nearestDist = dist;
      }
    }

    // Update current target
    if (nearest !== currentTarget) {
      currentTarget = nearest;

      if (currentTarget) {
        showPrompt(currentTarget.promptText);
      } else {
        hidePrompt();
      }

      onHighlight?.(currentTarget);
    }
  });

  // Interaction input
  const enterCancel = k.onKeyPress('enter', () => {
    if (currentTarget) {
      currentTarget.onInteract();
    }
  });

  const spaceCancel = k.onKeyPress('space', () => {
    if (currentTarget) {
      currentTarget.onInteract();
    }
  });

  return {
    get currentTarget() {
      return currentTarget;
    },

    addInteractable(interactable: Interactable): void {
      items.push(interactable);
    },

    removeInteractable(entity: GameObj): void {
      const idx = items.findIndex((i) => i.entity === entity);
      if (idx !== -1) {
        items.splice(idx, 1);
      }
    },

    destroy(): void {
      updateCancel.cancel();
      enterCancel.cancel();
      spaceCancel.cancel();
      hidePrompt();
    },
  };
}
