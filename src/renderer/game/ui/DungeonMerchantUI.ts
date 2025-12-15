/**
 * DungeonMerchantUI
 *
 * Handles merchant interaction UI in dungeon scenes.
 * Extracted from DungeonScene.ts to reduce file size.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import type { RoomContent } from '../../canvas/dungeon/DungeonGenerator.js';
import { GameState } from '../state/GameState.js';
import { ITEMS } from '../data/items.js';
import { playSound } from '../systems/sound.js';

// Merchant inventory for dungeon merchants
const MERCHANT_ITEMS = ['health_potion', 'greater_potion'];

export interface MerchantUIState {
  active: boolean;
  elements: GameObj[];
  selectedItem: number;
  nearbyMerchant: RoomContent | null;
}

export interface MerchantUIConfig {
  canvasWidth: number;
  canvasHeight: number;
  searchDistance: number;
}

export interface MerchantUICallbacks {
  showFloatingMessage: (text: string, x: number, y: number, color?: [number, number, number]) => void;
  getMovementBounds: () => { minX: number; maxX: number; minY: number; maxY: number };
  freezePlayer: () => void;
  unfreezePlayer: () => void;
}

/**
 * Create a merchant UI controller for dungeon scenes
 */
export function createMerchantUI(
  k: KAPLAYCtx,
  config: MerchantUIConfig,
  callbacks: MerchantUICallbacks
) {
  const state: MerchantUIState = {
    active: false,
    elements: [],
    selectedItem: 0,
    nearbyMerchant: null,
  };

  /**
   * Clear merchant UI and reset state
   */
  function clear(): void {
    for (const e of state.elements) {
      try { k.destroy(e); } catch { /* element may already be destroyed */ }
    }
    state.elements = [];
    state.active = false;
    state.selectedItem = 0;
    callbacks.unfreezePlayer();
  }

  /**
   * Show merchant UI for the given merchant
   */
  function show(content: RoomContent): void {
    state.active = true;
    callbacks.freezePlayer();

    const { canvasWidth } = config;

    // Background
    state.elements.push(k.add([
      k.rect(300, 200),
      k.pos(canvasWidth / 2 - 150, 60),
      k.color(20, 30, 50),
      k.outline(3, k.rgb(255, 200, 100)),
      k.z(500),
    ]));

    // Title
    state.elements.push(k.add([
      k.text('Traveling Merchant', { size: 14 }),
      k.pos(canvasWidth / 2, 78),
      k.anchor('center'),
      k.color(255, 200, 100),
      k.z(501),
    ]));

    // Gold display
    state.elements.push(k.add([
      k.text(`Your Gold: ${GameState.player.gold}`, { size: 13 }),
      k.pos(canvasWidth / 2, 98),
      k.anchor('center'),
      k.color(251, 191, 36),
      k.z(501),
    ]));

    renderItems();

    // Instructions
    state.elements.push(k.add([
      k.text('Up/Down: Select | ENTER: Buy | ESC: Leave', { size: 12 }),
      k.pos(canvasWidth / 2, 248),
      k.anchor('center'),
      k.color(150, 150, 150),
      k.z(501),
    ]));
  }

  /**
   * Render merchant item list
   */
  function renderItems(): void {
    const { canvasWidth } = config;

    // Remove old item elements
    state.elements = state.elements.filter(e => {
      if ((e as any)._isItem) {
        try { k.destroy(e); } catch { /* element may already be destroyed */ }
        return false;
      }
      return true;
    });

    // Remove old gold display
    state.elements = state.elements.filter(e => {
      if ((e as any)._isGold) {
        try { k.destroy(e); } catch { /* element may already be destroyed */ }
        return false;
      }
      return true;
    });

    // Updated gold display
    const goldDisplay = k.add([
      k.text(`Your Gold: ${GameState.player.gold}`, { size: 13 }),
      k.pos(canvasWidth / 2, 98),
      k.anchor('center'),
      k.color(251, 191, 36),
      k.z(501),
    ]) as any;
    goldDisplay._isGold = true;
    state.elements.push(goldDisplay);

    MERCHANT_ITEMS.forEach((itemId, i) => {
      const item = ITEMS[itemId];
      if (!item) return;

      const isSelected = i === state.selectedItem;
      const canAfford = GameState.player.gold >= item.buyPrice;

      const itemBg = k.add([
        k.rect(260, 36),
        k.pos(canvasWidth / 2 - 130, 115 + i * 42),
        k.color(isSelected ? 40 : 25, isSelected ? 50 : 30, isSelected ? 70 : 45),
        k.outline(2, k.rgb(isSelected ? 255 : 100, isSelected ? 200 : 150, isSelected ? 100 : 100)),
        k.z(501),
      ]) as any;
      itemBg._isItem = true;
      state.elements.push(itemBg);

      const nameText = k.add([
        k.text(item.name, { size: 14 }),
        k.pos(canvasWidth / 2 - 120, 123 + i * 42),
        k.color(255, 255, 255),
        k.z(502),
      ]) as any;
      nameText._isItem = true;
      state.elements.push(nameText);

      const priceColor = canAfford ? [100, 255, 100] : [255, 100, 100];
      const priceText = k.add([
        k.text(`${item.buyPrice}g`, { size: 13 }),
        k.pos(canvasWidth / 2 + 100, 124 + i * 42),
        k.anchor('right'),
        k.color(...priceColor as [number, number, number]),
        k.z(502),
      ]) as any;
      priceText._isItem = true;
      state.elements.push(priceText);

      const descText = k.add([
        k.text(item.description, { size: 12 }),
        k.pos(canvasWidth / 2 - 120, 137 + i * 42),
        k.color(180, 180, 180),
        k.z(502),
      ]) as any;
      descText._isItem = true;
      state.elements.push(descText);
    });
  }

  /**
   * Handle keyboard input for merchant UI
   */
  function handleInput(key: string): void {
    if (!state.active) return;

    const { canvasWidth } = config;

    if (key === 'escape') {
      clear();
      callbacks.showFloatingMessage('Come again!', canvasWidth / 2, 140, [255, 200, 100]);
      return;
    }

    if (key === 'up' && state.selectedItem > 0) {
      state.selectedItem--;
      renderItems();
    } else if (key === 'down' && state.selectedItem < MERCHANT_ITEMS.length - 1) {
      state.selectedItem++;
      renderItems();
    } else if (key === 'enter') {
      const itemId = MERCHANT_ITEMS[state.selectedItem];
      const item = ITEMS[itemId];
      if (!item) return;

      if (GameState.player.gold >= item.buyPrice) {
        GameState.player.gold -= item.buyPrice;

        // Add item to inventory instead of using immediately
        GameState.addItem(itemId, 1);

        playSound(k, 'goldCollect');
        callbacks.showFloatingMessage(`Bought ${item.name}!`, canvasWidth / 2, 60, [100, 255, 100]);
        renderItems();
      } else {
        callbacks.showFloatingMessage('Not enough gold!', canvasWidth / 2, 60, [255, 100, 100]);
      }
    }
  }

  /**
   * Check for nearby merchants and update state
   */
  function checkNearby(playerPos: { x: number; y: number }): void {
    const room = GameState.getCurrentRoom();
    if (!room) return;

    state.nearbyMerchant = null;

    for (const content of room.contents) {
      if (content.type !== 'npc') continue;
      if (content.data?.npcType !== 'merchant') continue;

      const bounds = callbacks.getMovementBounds();
      const roomWidth = bounds.maxX - bounds.minX + 32;
      const roomHeight = bounds.maxY - bounds.minY + 32;
      const x = bounds.minX - 16 + content.x * roomWidth;
      const y = bounds.minY - 16 + content.y * roomHeight;

      const dx = playerPos.x - x;
      const dy = playerPos.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < config.searchDistance) {
        state.nearbyMerchant = content;
        break;
      }
    }
  }

  return {
    get isActive() { return state.active; },
    get nearbyMerchant() { return state.nearbyMerchant; },
    clear,
    show,
    handleInput,
    checkNearby,
  };
}

export type DungeonMerchantUI = ReturnType<typeof createMerchantUI>;
