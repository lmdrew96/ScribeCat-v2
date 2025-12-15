/**
 * DungeonSelectionUI
 *
 * Modal UI for selecting which dungeon to enter from TownScene.
 * Shows all dungeons with unlock requirements based on player level.
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { type DungeonInfo, getAllDungeonInfo, isDungeonUnlocked } from '../data/dungeons.js';
import { playSound } from '../systems/sound.js';

export interface DungeonSelectionUICallbacks {
  freezePlayer: () => void;
  unfreezePlayer: () => void;
  onSelect: (dungeonId: string) => void;
}

export interface DungeonSelectionUIConfig {
  canvasWidth: number;
  canvasHeight: number;
}

interface SelectionState {
  active: boolean;
  elements: GameObj[];
  selectedIndex: number;
  dungeons: DungeonInfo[];
  playerLevel: number;
}

/**
 * Create a dungeon selection UI controller for town scenes
 */
export function createDungeonSelectionUI(
  k: KAPLAYCtx,
  config: DungeonSelectionUIConfig,
  callbacks: DungeonSelectionUICallbacks
) {
  const state: SelectionState = {
    active: false,
    elements: [],
    selectedIndex: 0,
    dungeons: [],
    playerLevel: 1,
  };

  /**
   * Clear UI and reset state
   */
  function clear(): void {
    for (const e of state.elements) {
      try { k.destroy(e); } catch { /* element may already be destroyed */ }
    }
    state.elements = [];
    state.active = false;
    state.selectedIndex = 0;
    callbacks.unfreezePlayer();
  }

  /**
   * Show dungeon selection UI
   */
  function show(playerLevel: number): void {
    state.active = true;
    state.playerLevel = playerLevel;
    state.dungeons = getAllDungeonInfo();

    // Find first unlocked dungeon to start selection at
    state.selectedIndex = 0;
    for (let i = 0; i < state.dungeons.length; i++) {
      if (isDungeonUnlocked(state.dungeons[i].id, playerLevel)) {
        state.selectedIndex = i;
        break;
      }
    }

    callbacks.freezePlayer();
    playSound(k, 'menuSelect');

    const { canvasWidth, canvasHeight } = config;
    const modalWidth = 280;
    const modalHeight = 240;
    const modalX = (canvasWidth - modalWidth) / 2;
    const modalY = (canvasHeight - modalHeight) / 2;

    // Background overlay
    state.elements.push(k.add([
      k.rect(canvasWidth, canvasHeight),
      k.pos(0, 0),
      k.color(0, 0, 0),
      k.opacity(0.5),
      k.fixed(),
      k.z(400),
    ]));

    // Modal background
    state.elements.push(k.add([
      k.rect(modalWidth, modalHeight),
      k.pos(modalX, modalY),
      k.color(20, 25, 40),
      k.outline(3, k.rgb(100, 150, 255)),
      k.fixed(),
      k.z(500),
    ]));

    // Title
    state.elements.push(k.add([
      k.text('SELECT DUNGEON', { size: 14 }),
      k.pos(canvasWidth / 2, modalY + 18),
      k.anchor('center'),
      k.color(100, 180, 255),
      k.fixed(),
      k.z(501),
    ]));

    // Player level display
    state.elements.push(k.add([
      k.text(`Your Level: ${playerLevel}`, { size: 13 }),
      k.pos(canvasWidth / 2, modalY + 36),
      k.anchor('center'),
      k.color(200, 200, 200),
      k.fixed(),
      k.z(501),
    ]));

    renderDungeonList();

    // Instructions
    state.elements.push(k.add([
      k.text('Up/Down: Select | ENTER: Enter | ESC: Cancel', { size: 12 }),
      k.pos(canvasWidth / 2, modalY + modalHeight - 12),
      k.anchor('center'),
      k.color(120, 120, 140),
      k.fixed(),
      k.z(501),
    ]));
  }

  /**
   * Render the dungeon list
   */
  function renderDungeonList(): void {
    const { canvasWidth, canvasHeight } = config;
    const modalWidth = 280;
    const modalHeight = 240;
    const modalX = (canvasWidth - modalWidth) / 2;
    const modalY = (canvasHeight - modalHeight) / 2;

    // Remove old dungeon item elements
    state.elements = state.elements.filter(e => {
      if ((e as any)._isDungeonItem) {
        try { k.destroy(e); } catch { /* element may already be destroyed */ }
        return false;
      }
      return true;
    });

    const itemHeight = 26;
    const listStartY = modalY + 52;

    state.dungeons.forEach((dungeon, i) => {
      const isSelected = i === state.selectedIndex;
      const isUnlocked = isDungeonUnlocked(dungeon.id, state.playerLevel);
      const itemY = listStartY + i * itemHeight;

      // Selection highlight background
      if (isSelected) {
        const highlight = k.add([
          k.rect(modalWidth - 20, itemHeight - 4),
          k.pos(modalX + 10, itemY),
          k.color(40, 60, 100),
          k.outline(1, k.rgb(100, 150, 255)),
          k.fixed(),
          k.z(501),
        ]) as any;
        highlight._isDungeonItem = true;
        state.elements.push(highlight);
      }

      // Selection arrow
      if (isSelected) {
        const arrow = k.add([
          k.text('>', { size: 12 }),
          k.pos(modalX + 16, itemY + itemHeight / 2 - 2),
          k.anchor('left'),
          k.color(255, 255, 100),
          k.fixed(),
          k.z(502),
        ]) as any;
        arrow._isDungeonItem = true;
        state.elements.push(arrow);
      }

      // Dungeon name
      const nameColor = isUnlocked
        ? (isSelected ? [255, 255, 255] : [200, 200, 200])
        : [100, 100, 100];
      const nameText = k.add([
        k.text(dungeon.name, { size: 14 }),
        k.pos(modalX + 30, itemY + itemHeight / 2 - 2),
        k.anchor('left'),
        k.color(...nameColor as [number, number, number]),
        k.fixed(),
        k.z(502),
      ]) as any;
      nameText._isDungeonItem = true;
      state.elements.push(nameText);

      // Right side: floors or lock status
      let rightText: string;
      let rightColor: [number, number, number];

      if (isUnlocked) {
        rightText = `${dungeon.totalFloors} floors`;
        rightColor = [150, 200, 150];
      } else {
        rightText = `Lv.${dungeon.requiredLevel}`;
        rightColor = [180, 100, 100];
      }

      const rightLabel = k.add([
        k.text(rightText, { size: 12 }),
        k.pos(modalX + modalWidth - 20, itemY + itemHeight / 2 - 2),
        k.anchor('right'),
        k.color(...rightColor),
        k.fixed(),
        k.z(502),
      ]) as any;
      rightLabel._isDungeonItem = true;
      state.elements.push(rightLabel);

      // Lock icon for locked dungeons
      if (!isUnlocked) {
        const lockIcon = k.add([
          k.text('LOCKED', { size: 12 }),
          k.pos(modalX + modalWidth - 55, itemY + itemHeight / 2 - 2),
          k.anchor('right'),
          k.color(150, 80, 80),
          k.fixed(),
          k.z(502),
        ]) as any;
        lockIcon._isDungeonItem = true;
        state.elements.push(lockIcon);
      }
    });
  }

  /**
   * Handle keyboard input
   */
  function handleInput(key: string): void {
    if (!state.active) return;

    if (key === 'escape') {
      playSound(k, 'menuSelect');
      clear();
      return;
    }

    if (key === 'up') {
      // Move to previous unlocked dungeon
      let newIndex = state.selectedIndex - 1;
      while (newIndex >= 0) {
        if (isDungeonUnlocked(state.dungeons[newIndex].id, state.playerLevel)) {
          state.selectedIndex = newIndex;
          playSound(k, 'menuSelect');
          renderDungeonList();
          return;
        }
        newIndex--;
      }
    }

    if (key === 'down') {
      // Move to next unlocked dungeon
      let newIndex = state.selectedIndex + 1;
      while (newIndex < state.dungeons.length) {
        if (isDungeonUnlocked(state.dungeons[newIndex].id, state.playerLevel)) {
          state.selectedIndex = newIndex;
          playSound(k, 'menuSelect');
          renderDungeonList();
          return;
        }
        newIndex++;
      }
    }

    if (key === 'enter') {
      const selectedDungeon = state.dungeons[state.selectedIndex];
      if (selectedDungeon && isDungeonUnlocked(selectedDungeon.id, state.playerLevel)) {
        playSound(k, 'menuConfirm');
        const dungeonId = selectedDungeon.id;
        clear();
        callbacks.onSelect(dungeonId);
      }
    }
  }

  return {
    get isActive() { return state.active; },
    clear,
    show,
    handleInput,
  };
}

export type DungeonSelectionUI = ReturnType<typeof createDungeonSelectionUI>;
