/**
 * InventoryScene
 *
 * Standalone inventory management screen accessible from Town.
 * Players can view, use, equip, and sell items.
 *
 * Features:
 * - Category tabs: All, Items, Equipment, Special, Decorations
 * - Item list with quantities
 * - Selected item detail panel
 * - Actions: Use (consumables), Equip/Unequip, Sell
 * - Keyboard navigation
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { GameState } from '../state/GameState.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config.js';
import { getItem, type ItemDefinition, type EquipmentSlot } from '../data/items.js';
import { playSound } from '../systems/sound.js';

export interface InventorySceneData {
  fromScene?: string;
  dungeonReturnData?: {
    catColor?: string;
    dungeonId?: string;
    floorNumber?: number;
    floor?: any;
    currentRoomId?: string;
    playerX?: number;
    playerY?: number;
  };
}

export function registerInventoryScene(k: KAPLAYCtx): void {
  k.scene('inventory', (data: InventorySceneData = {}) => {
    const fromScene = data.fromScene || 'town';

    // --- BACKGROUND ---
    k.add([
      k.rect(CANVAS_WIDTH, CANVAS_HEIGHT),
      k.pos(0, 0),
      k.color(20, 20, 35),
      k.z(0),
    ]);

    // --- STATE ---
    let selectedTab = 0;
    let selectedItem = 0;
    let uiElements: GameObj[] = [];
    let messageElements: GameObj[] = [];
    let isProcessing = false;

    const tabs = ['All', 'Items', 'Equip', 'Special', 'Decor'];

    // Get items filtered by category
    function getInventoryItems(tabIndex: number): { id: string; quantity: number }[] {
      const allItems = GameState.player.items;

      switch (tabIndex) {
        case 0: // All
          return allItems;
        case 1: // Items (consumables)
          return allItems.filter((inv) => {
            const item = getItem(inv.id);
            return item?.type === 'consumable';
          });
        case 2: // Equipment
          return allItems.filter((inv) => {
            const item = getItem(inv.id);
            return item?.type === 'equipment';
          });
        case 3: // Special
          return allItems.filter((inv) => {
            const item = getItem(inv.id);
            return item?.type === 'special' || item?.type === 'key';
          });
        case 4: // Decorations
          return allItems.filter((inv) => {
            const item = getItem(inv.id);
            return item?.type === 'decoration';
          });
        default:
          return allItems;
      }
    }

    // --- GOLD DISPLAY ---
    const goldBg = k.add([
      k.rect(120, 30),
      k.pos(CANVAS_WIDTH - 130, 10),
      k.color(0, 0, 0),
      k.opacity(0.7),
      k.z(50),
    ]);

    const goldText = k.add([
      k.text(`Gold: ${GameState.player.gold}`, { size: 12 }),
      k.pos(CANVAS_WIDTH - 120, 18),
      k.color(251, 191, 36),
      k.z(51),
    ]);

    function updateGoldDisplay(): void {
      if (goldText.exists()) {
        goldText.text = `Gold: ${GameState.player.gold}`;
      }
    }

    // --- UI RENDERING ---
    function clearUI(): void {
      for (const e of uiElements) {
        try {
          if (e && e.exists()) k.destroy(e);
        } catch {
          // Already destroyed
        }
      }
      uiElements = [];
    }

    function clearMessages(): void {
      for (const e of messageElements) {
        try {
          if (e && e.exists()) k.destroy(e);
        } catch {
          // Already destroyed
        }
      }
      messageElements = [];
    }

    function renderUI(): void {
      if (isProcessing) return;
      clearUI();

      // Title
      const title = k.add([
        k.text('INVENTORY', { size: 20 }),
        k.pos(CANVAS_WIDTH / 2, 30),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.z(10),
      ]);
      uiElements.push(title);

      // Tab bar
      const tabWidth = 70;
      const tabSpacing = 10;
      const startX = CANVAS_WIDTH / 2 - ((tabs.length * tabWidth + (tabs.length - 1) * tabSpacing) / 2);

      tabs.forEach((tab, i) => {
        const isSelected = i === selectedTab;
        const tabBg = k.add([
          k.rect(tabWidth, 28),
          k.pos(startX + i * (tabWidth + tabSpacing), 55),
          k.color(isSelected ? 80 : 40, isSelected ? 80 : 40, isSelected ? 120 : 60),
          k.outline(2, k.rgb(100, 100, 150)),
          k.z(10),
        ]);
        uiElements.push(tabBg);

        const tabText = k.add([
          k.text(tab, { size: 13 }),
          k.pos(startX + i * (tabWidth + tabSpacing) + tabWidth / 2, 69),
          k.anchor('center'),
          k.color(isSelected ? 255 : 180, isSelected ? 255 : 180, isSelected ? 100 : 180),
          k.z(11),
        ]);
        uiElements.push(tabText);
      });

      // Main content area
      const contentBg = k.add([
        k.rect(CANVAS_WIDTH - 40, CANVAS_HEIGHT - 160),
        k.pos(20, 95),
        k.color(30, 30, 50),
        k.outline(2, k.rgb(80, 80, 120)),
        k.z(5),
      ]);
      uiElements.push(contentBg);

      // Get filtered items
      const items = getInventoryItems(selectedTab);

      // Ensure selectedItem is in bounds
      if (selectedItem >= items.length) {
        selectedItem = Math.max(0, items.length - 1);
      }

      if (items.length === 0) {
        const emptyText = k.add([
          k.text('No items in this category', { size: 12 }),
          k.pos(CANVAS_WIDTH / 2, 200),
          k.anchor('center'),
          k.color(150, 150, 150),
          k.z(10),
        ]);
        uiElements.push(emptyText);
      } else {
        // Item list (left side)
        const listX = 40;
        const listWidth = 280;
        const maxVisible = 8;
        const scrollOffset = Math.max(0, selectedItem - maxVisible + 1);
        const visibleItems = items.slice(scrollOffset, scrollOffset + maxVisible);

        visibleItems.forEach((inv, i) => {
          const item = getItem(inv.id);
          if (!item) return;

          const actualIndex = scrollOffset + i;
          const isSelected = actualIndex === selectedItem;
          const y = 110 + i * 30;

          // Item row background
          const rowBg = k.add([
            k.rect(listWidth, 26),
            k.pos(listX, y),
            k.color(isSelected ? 60 : 40, isSelected ? 60 : 40, isSelected ? 100 : 60),
            k.outline(isSelected ? 2 : 1, k.rgb(isSelected ? 251 : 60, isSelected ? 191 : 60, isSelected ? 36 : 80)),
            k.z(10),
          ]);
          uiElements.push(rowBg);

          // Tier badge
          const tierColors: Record<number, [number, number, number]> = {
            1: [100, 100, 100],
            2: [50, 150, 50],
            3: [50, 100, 200],
            4: [150, 50, 200],
            5: [200, 150, 50],
            6: [200, 50, 50],
          };
          const tierColor = tierColors[item.tier || 1] || tierColors[1];
          const tierBadge = k.add([
            k.rect(14, 14),
            k.pos(listX + 5, y + 6),
            k.color(tierColor[0], tierColor[1], tierColor[2]),
            k.outline(1, k.rgb(0, 0, 0)),
            k.z(11),
          ]);
          uiElements.push(tierBadge);

          // Icon
          const iconColor = item.iconColor || [100, 100, 100];
          const icon = k.add([
            k.rect(14, 14),
            k.pos(listX + 24, y + 6),
            k.color(iconColor[0], iconColor[1], iconColor[2]),
            k.outline(1, k.rgb(0, 0, 0)),
            k.z(11),
          ]);
          uiElements.push(icon);

          // Name
          const nameText = k.add([
            k.text(item.name, { size: 12 }),
            k.pos(listX + 45, y + 9),
            k.color(255, 255, 255),
            k.z(11),
          ]);
          uiElements.push(nameText);

          // Quantity
          const qtyText = k.add([
            k.text(`x${inv.quantity}`, { size: 12 }),
            k.pos(listX + listWidth - 30, y + 9),
            k.color(150, 200, 150),
            k.z(11),
          ]);
          uiElements.push(qtyText);
        });

        // Scroll indicator
        if (items.length > maxVisible) {
          const scrollInfo = k.add([
            k.text(`${selectedItem + 1}/${items.length}`, { size: 12 }),
            k.pos(listX + listWidth / 2, 355),
            k.anchor('center'),
            k.color(150, 150, 150),
            k.z(10),
          ]);
          uiElements.push(scrollInfo);
        }

        // Detail panel (right side)
        if (items.length > 0 && selectedItem < items.length) {
          const selectedInv = items[selectedItem];
          const selectedItemDef = getItem(selectedInv.id);
          if (selectedItemDef) {
            renderDetailPanel(selectedItemDef, selectedInv.id);
          }
        }
      }

      // Instructions
      const instructions = k.add([
        k.text('Arrows: Navigate | Q/E: Tab | U: Use | X: Equip | S: Sell | ESC: Back', { size: 12 }),
        k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 20),
        k.anchor('center'),
        k.color(150, 150, 150),
        k.z(10),
      ]);
      uiElements.push(instructions);
    }

    function renderDetailPanel(item: ItemDefinition, itemId: string): void {
      const panelX = 350;
      const panelY = 110;
      const panelWidth = 230;
      const panelHeight = 250;

      // Panel background
      const panelBg = k.add([
        k.rect(panelWidth, panelHeight),
        k.pos(panelX, panelY),
        k.color(25, 25, 45),
        k.outline(2, k.rgb(100, 100, 150)),
        k.z(10),
      ]);
      uiElements.push(panelBg);

      // Item name
      const nameText = k.add([
        k.text(item.name, { size: 14 }),
        k.pos(panelX + panelWidth / 2, panelY + 20),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.z(11),
      ]);
      uiElements.push(nameText);

      // Type badge
      const typeBadge = k.add([
        k.text(`[${item.type.toUpperCase()}]`, { size: 12 }),
        k.pos(panelX + panelWidth / 2, panelY + 40),
        k.anchor('center'),
        k.color(150, 150, 200),
        k.z(11),
      ]);
      uiElements.push(typeBadge);

      // Description
      const descText = k.add([
        k.text(item.description, { size: 12, width: panelWidth - 20 }),
        k.pos(panelX + 10, panelY + 60),
        k.color(200, 200, 200),
        k.z(11),
      ]);
      uiElements.push(descText);

      // Stats/effects (if any)
      let infoY = panelY + 120;

      if (item.stats) {
        const statStrings: string[] = [];
        if (item.stats.attack) statStrings.push(`+${item.stats.attack} ATK`);
        if (item.stats.defense) statStrings.push(`+${item.stats.defense} DEF`);
        if (item.stats.luck) statStrings.push(`+${item.stats.luck} LCK`);
        if (item.stats.maxHp) statStrings.push(`+${item.stats.maxHp} HP`);
        if (item.stats.maxMana) statStrings.push(`+${item.stats.maxMana} MP`);
        if (item.stats.manaRegen) statStrings.push(`+${item.stats.manaRegen} MP/turn`);

        if (statStrings.length > 0) {
          const statsText = k.add([
            k.text(statStrings.join('  '), { size: 12 }),
            k.pos(panelX + 10, infoY),
            k.color(100, 255, 100),
            k.z(11),
          ]);
          uiElements.push(statsText);
          infoY += 20;
        }
      }

      if (item.effect) {
        let effectStr = '';
        if (item.effect.type === 'heal') effectStr = `Heals ${item.effect.value} HP`;
        else if (item.effect.type === 'mana_restore') effectStr = `Restores ${item.effect.value} MP`;
        else if (item.effect.type === 'buff_attack') effectStr = `+${item.effect.value} ATK for ${item.effect.duration || 3} turns`;
        else if (item.effect.type === 'buff_defense') effectStr = `+${item.effect.value} DEF for ${item.effect.duration || 3} turns`;
        else if (item.effect.type === 'buff_luck') effectStr = `+${item.effect.value} LCK for ${item.effect.duration || 3} turns`;

        if (effectStr) {
          const effectText = k.add([
            k.text(`Effect: ${effectStr}`, { size: 12 }),
            k.pos(panelX + 10, infoY),
            k.color(100, 200, 255),
            k.z(11),
          ]);
          uiElements.push(effectText);
          infoY += 20;
        }
      }

      if (item.specialAbility) {
        const magicText = k.add([
          k.text(`Magic: ${item.specialAbility.name} (${item.specialAbility.manaCost} MP)`, { size: 12 }),
          k.pos(panelX + 10, infoY),
          k.color(200, 100, 255),
          k.z(11),
        ]);
        uiElements.push(magicText);
        infoY += 20;
      }

      if (item.decoration) {
        const decorText = k.add([
          k.text(`Size: ${item.decoration.width}x${item.decoration.height} tiles`, { size: 12 }),
          k.pos(panelX + 10, infoY),
          k.color(255, 200, 100),
          k.z(11),
        ]);
        uiElements.push(decorText);
        infoY += 20;
      }

      // Sell price
      const sellPrice = Math.floor(item.buyPrice / 2);
      const sellText = k.add([
        k.text(`Sell: ${sellPrice}G`, { size: 12 }),
        k.pos(panelX + 10, panelY + panelHeight - 50),
        k.color(251, 191, 36),
        k.z(11),
      ]);
      uiElements.push(sellText);

      // Equipped status (for equipment)
      if (item.type === 'equipment' && item.slot) {
        const isEquipped = GameState.player.equipped[item.slot] === itemId;
        if (isEquipped) {
          const equippedText = k.add([
            k.text('[EQUIPPED]', { size: 13 }),
            k.pos(panelX + panelWidth / 2, panelY + panelHeight - 25),
            k.anchor('center'),
            k.color(100, 255, 100),
            k.z(11),
          ]);
          uiElements.push(equippedText);
        }
      }
    }

    function showMessage(text: string, color: [number, number, number] = [255, 255, 255]): void {
      clearMessages();

      const msgBg = k.add([
        k.rect(300, 40),
        k.pos(CANVAS_WIDTH / 2 - 150, CANVAS_HEIGHT / 2 - 20),
        k.color(0, 0, 0),
        k.opacity(0.9),
        k.z(100),
      ]);
      messageElements.push(msgBg);

      const msgText = k.add([
        k.text(text, { size: 12 }),
        k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
        k.anchor('center'),
        k.color(color[0], color[1], color[2]),
        k.z(101),
      ]);
      messageElements.push(msgText);

      k.wait(1.5, clearMessages);
    }

    // --- ACTIONS ---
    function useItem(): void {
      if (isProcessing) return;

      const items = getInventoryItems(selectedTab);
      if (items.length === 0 || selectedItem >= items.length) {
        showMessage('No item selected!', [255, 100, 100]);
        return;
      }

      const inv = items[selectedItem];
      const item = getItem(inv.id);
      if (!item) return;

      // Only consumables can be used outside battle
      if (item.type !== 'consumable') {
        showMessage('Cannot use this item here!', [255, 100, 100]);
        return;
      }

      // In town, healing items heal the player
      if (item.effect?.type === 'heal') {
        if (GameState.player.health >= GameState.getEffectiveMaxHealth()) {
          showMessage('HP already full!', [255, 200, 100]);
          return;
        }

        isProcessing = true;
        GameState.removeItem(inv.id, 1);

        const healAmount = item.effect.value;
        const oldHp = GameState.player.health;
        GameState.player.health = Math.min(GameState.player.health + healAmount, GameState.getEffectiveMaxHealth());
        const actualHeal = GameState.player.health - oldHp;

        try {
          playSound(k, 'heal');
        } catch {
          // Sound not available
        }

        showMessage(`Healed ${actualHeal} HP!`, [100, 255, 100]);

        k.wait(0.1, () => {
          isProcessing = false;
          renderUI();
        });
        return;
      }

      // Mana restore
      if (item.effect?.type === 'mana_restore') {
        if (GameState.player.mana >= GameState.getEffectiveMaxMana()) {
          showMessage('MP already full!', [255, 200, 100]);
          return;
        }

        isProcessing = true;
        GameState.removeItem(inv.id, 1);

        const restoreAmount = item.effect.value;
        const actualRestore = GameState.restoreMana(restoreAmount);

        showMessage(`Restored ${actualRestore} MP!`, [100, 200, 255]);

        k.wait(0.1, () => {
          isProcessing = false;
          renderUI();
        });
        return;
      }

      // Buff potions - can only use in battle
      if (item.effect?.type.startsWith('buff_')) {
        showMessage('Use buff potions in battle!', [255, 200, 100]);
        return;
      }

      showMessage('Cannot use this item here!', [255, 100, 100]);
    }

    function equipItem(): void {
      if (isProcessing) return;

      const items = getInventoryItems(selectedTab);
      if (items.length === 0 || selectedItem >= items.length) {
        showMessage('No item selected!', [255, 100, 100]);
        return;
      }

      const inv = items[selectedItem];
      const item = getItem(inv.id);
      if (!item || item.type !== 'equipment' || !item.slot) {
        showMessage('Cannot equip this item!', [255, 100, 100]);
        return;
      }

      isProcessing = true;

      // Check if already equipped
      if (GameState.player.equipped[item.slot] === inv.id) {
        // Unequip
        GameState.unequipItem(item.slot);
        showMessage(`Unequipped ${item.name}!`, [255, 200, 100]);
      } else {
        // Equip
        const success = GameState.equipItem(inv.id);
        if (success) {
          try {
            playSound(k, 'equip');
          } catch {
            // Sound not available
          }
          showMessage(`Equipped ${item.name}!`, [100, 255, 100]);
        } else {
          showMessage('Failed to equip!', [255, 100, 100]);
        }
      }

      k.wait(0.1, () => {
        isProcessing = false;
        renderUI();
      });
    }

    function sellItem(): void {
      if (isProcessing) return;

      const items = getInventoryItems(selectedTab);
      if (items.length === 0 || selectedItem >= items.length) {
        showMessage('No item selected!', [255, 100, 100]);
        return;
      }

      const inv = items[selectedItem];
      const item = getItem(inv.id);
      if (!item) return;

      // Cannot sell key items or equipped items
      if (item.type === 'key') {
        showMessage('Cannot sell key items!', [255, 100, 100]);
        return;
      }

      if (item.type === 'equipment' && item.slot) {
        if (GameState.player.equipped[item.slot] === inv.id) {
          showMessage('Unequip first!', [255, 100, 100]);
          return;
        }
      }

      isProcessing = true;

      const sellPrice = Math.floor(item.buyPrice / 2);
      GameState.removeItem(inv.id, 1);
      GameState.addGold(sellPrice);
      updateGoldDisplay();

      try {
        playSound(k, 'coin');
      } catch {
        // Sound not available
      }

      showMessage(`Sold for ${sellPrice}G!`, [251, 191, 36]);

      k.wait(0.1, () => {
        isProcessing = false;
        renderUI();
      });
    }

    // --- INPUT ---
    k.onKeyPress('escape', () => {
      if (!isProcessing) {
        // Return to dungeon with proper state if we came from there
        if (fromScene === 'dungeon' && data.dungeonReturnData) {
          k.go('dungeon', {
            ...data.dungeonReturnData,
            returnFromBattle: false, // Not from battle, from inventory
          });
        } else {
          k.go(fromScene);
        }
      }
    });

    k.onKeyPress('up', () => {
      if (isProcessing) return;
      if (selectedItem > 0) {
        selectedItem--;
        renderUI();
      }
    });

    k.onKeyPress('down', () => {
      if (isProcessing) return;
      const items = getInventoryItems(selectedTab);
      if (selectedItem < items.length - 1) {
        selectedItem++;
        renderUI();
      }
    });

    k.onKeyPress('q', () => {
      if (isProcessing) return;
      if (selectedTab > 0) {
        selectedTab--;
        selectedItem = 0;
        renderUI();
      }
    });

    k.onKeyPress('e', () => {
      if (isProcessing) return;
      if (selectedTab < tabs.length - 1) {
        selectedTab++;
        selectedItem = 0;
        renderUI();
      }
    });

    k.onKeyPress('left', () => {
      if (isProcessing) return;
      if (selectedTab > 0) {
        selectedTab--;
        selectedItem = 0;
        renderUI();
      }
    });

    k.onKeyPress('right', () => {
      if (isProcessing) return;
      if (selectedTab < tabs.length - 1) {
        selectedTab++;
        selectedItem = 0;
        renderUI();
      }
    });

    k.onKeyPress('u', () => {
      useItem();
    });

    k.onKeyPress('x', () => {
      equipItem();
    });

    k.onKeyPress('s', () => {
      sellItem();
    });

    // Initial render
    renderUI();

    console.log('=== StudyQuest Inventory ===');
  });
}
