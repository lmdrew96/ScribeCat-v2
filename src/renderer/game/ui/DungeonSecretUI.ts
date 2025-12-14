/**
 * DungeonSecretUI
 *
 * Handles secret discovery and claiming in dungeon scenes.
 * Extracted from DungeonScene.ts to reduce file size.
 */

import type { KAPLAYCtx } from 'kaplay';
import type { RoomContent } from '../../canvas/dungeon/DungeonGenerator.js';
import { GameState } from '../state/GameState.js';
import { playSound } from '../systems/sound.js';

export interface SecretUIConfig {
  canvasWidth: number;
  canvasHeight: number;
  searchDistance: number;
}

export interface SecretUICallbacks {
  showFloatingMessage: (text: string, x: number, y: number, color?: [number, number, number]) => void;
  getMovementBounds: () => { minX: number; maxX: number; minY: number; maxY: number };
  renderRoom: () => void;
}

export interface SecretUIState {
  nearbySecret: RoomContent | null;
}

/**
 * Create a secret discovery controller for dungeon scenes
 */
export function createSecretUI(
  k: KAPLAYCtx,
  config: SecretUIConfig,
  callbacks: SecretUICallbacks
) {
  const state: SecretUIState = {
    nearbySecret: null,
  };

  /**
   * Check for nearby undiscovered secrets
   */
  function checkNearby(playerPos: { x: number; y: number }): void {
    const room = GameState.getCurrentRoom();
    if (!room) return;

    state.nearbySecret = null;

    for (const content of room.contents) {
      if (content.type !== 'secret' || content.triggered) continue;
      if (content.data?.discovered) continue; // Already found

      const bounds = callbacks.getMovementBounds();
      const roomWidth = bounds.maxX - bounds.minX + 32;
      const roomHeight = bounds.maxY - bounds.minY + 32;
      const x = bounds.minX - 16 + content.x * roomWidth;
      const y = bounds.minY - 16 + content.y * roomHeight;

      const dx = playerPos.x - x;
      const dy = playerPos.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < config.searchDistance) {
        state.nearbySecret = content;
        break;
      }
    }
  }

  /**
   * Discover a nearby secret (make it visible)
   */
  function discover(): void {
    if (!state.nearbySecret) return;

    state.nearbySecret.data.discovered = true;
    playSound(k, 'discover');
    callbacks.showFloatingMessage('You found something!', config.canvasWidth / 2, 100, [255, 220, 100]);

    // Re-render to show the secret
    callbacks.renderRoom();
  }

  /**
   * Claim a discovered secret and receive rewards
   */
  function claim(content: RoomContent, x: number, y: number): void {
    content.triggered = true;

    const secretName = content.data?.secretName || 'Secret';
    const rewardType = content.data?.rewardType || 'gold_large';

    if (rewardType === 'full_heal') {
      GameState.player.health = GameState.player.maxHealth;
      playSound(k, 'heal');
      callbacks.showFloatingMessage(`${secretName}!`, x, y - 30, [255, 220, 100]);
      callbacks.showFloatingMessage('Fully Healed!', x, y - 10, [100, 255, 100]);
    } else {
      const goldReward = content.data?.goldReward || 100;
      const xpReward = content.data?.xpReward || 30;

      GameState.addGold(goldReward);
      GameState.addXp(xpReward);

      playSound(k, 'goldCollect');
      callbacks.showFloatingMessage(`${secretName}!`, x, y - 30, [255, 220, 100]);
      callbacks.showFloatingMessage(`+${goldReward} Gold!`, x, y - 10, [251, 191, 36]);
      callbacks.showFloatingMessage(`+${xpReward} XP!`, x, y + 10, [150, 255, 150]);
    }

    callbacks.renderRoom();
  }

  return {
    get nearbySecret() { return state.nearbySecret; },
    checkNearby,
    discover,
    claim,
  };
}

export type DungeonSecretUI = ReturnType<typeof createSecretUI>;
