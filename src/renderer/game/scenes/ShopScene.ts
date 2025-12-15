/**
 * ShopScene
 *
 * Where players can buy consumable items, equipment, and manage gear.
 *
 * FIXES:
 * - Better UI element cleanup to prevent freeze
 * - Sound loading check to prevent blocking
 * - Bounds checking for navigation
 * - Message overlay properly tracked
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { GameState } from '../state/GameState.js';
import { createPlayer } from '../components/Player.js';
import { setupMovement } from '../systems/movement.js';
import { setupInteraction, type Interactable } from '../systems/interaction.js';
import { createDoor } from '../components/Door.js';
import { PLAYER_SPEED, CANVAS_WIDTH, CANVAS_HEIGHT } from '../config.js';
import type { CatColor } from '../sprites/catSprites.js';
import { getItem, getShopItemsForTier, getUnlockedTier, type ItemDefinition, type EquipmentSlot, type DungeonTier } from '../data/items.js';
import { playSound } from '../systems/sound.js';

export interface ShopSceneData {
  catColor?: CatColor;
  fromScene?: string;
}

export function registerShopScene(k: KAPLAYCtx): void {
  k.scene('shop', async (data: ShopSceneData = {}) => {
    const catColor = data.catColor || GameState.player.catColor;

    // --- BACKGROUND (HD Image) ---
    let bgLoaded = false;
    try {
      // Add 5-second timeout to prevent indefinite hangs on slow/failed loads
      const loadPromise = k.loadSprite('shop-bg', '../../assets/BACKGROUNDS/Cat-Themed General Store Interior.png');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Asset load timeout')), 5000)
      );
      await Promise.race([loadPromise, timeoutPromise]);
      bgLoaded = true;
    } catch {
      console.log('HD shop background not available, using fallback');
    }

    if (bgLoaded) {
      const bgSprite = k.add([
        k.sprite('shop-bg'),
        k.pos(0, 0),
        k.z(0),
      ]);
      const bgScale = Math.max(CANVAS_WIDTH / 1024, CANVAS_HEIGHT / 576);
      bgSprite.scale = k.vec2(bgScale, bgScale);
    } else {
      k.add([
        k.rect(CANVAS_WIDTH, CANVAS_HEIGHT),
        k.pos(0, 0),
        k.color(101, 67, 33),
        k.z(0),
      ]);
      k.add([
        k.rect(CANVAS_WIDTH, 180),
        k.pos(0, 0),
        k.color(70, 130, 180),
        k.z(1),
      ]);
      k.add([
        k.rect(CANVAS_WIDTH, 8),
        k.pos(0, 180),
        k.color(50, 50, 50),
        k.z(2),
      ]);
    }

    // --- SHOP COUNTER ---
    k.add([
      k.rect(400, 60),
      k.pos(120, 200),
      k.color(139, 69, 19),
      k.outline(3, k.rgb(0, 0, 0)),
      k.z(5),
    ]);

    // --- SHOPKEEPER ---
    const shopkeeper = k.add([
      k.rect(40, 60),
      k.pos(CANVAS_WIDTH / 2 - 20, 140),
      k.color(255, 200, 150),
      k.outline(3, k.rgb(139, 69, 19)),
      k.z(6),
      'shopkeeper',
    ]);

    k.add([
      k.text(':3', { size: 16 }),
      k.pos(CANVAS_WIDTH / 2, 165),
      k.anchor('center'),
      k.color(80, 50, 30),
      k.z(7),
    ]);

    k.add([
      k.text('Shopkeeper', { size: 13 }),
      k.pos(CANVAS_WIDTH / 2, 130),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.z(10),
    ]);

    // --- ITEM DISPLAYS ---
    const displayItems = [
      { x: 150, label: 'Potions', color: k.rgb(255, 0, 128) },
      { x: 280, label: 'Weapons', color: k.rgb(192, 192, 192) },
      { x: 410, label: 'Armor', color: k.rgb(255, 215, 0) },
    ];

    displayItems.forEach((item) => {
      k.add([
        k.rect(60, 40),
        k.pos(item.x - 30, 50),
        k.color(item.color),
        k.outline(2, k.rgb(0, 0, 0)),
        k.z(4),
      ]);
      k.add([
        k.text(item.label, { size: 12 }),
        k.pos(item.x, 90),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.z(10),
      ]);
    });

    // --- DOOR ---
    const exitDoor = createDoor({
      k,
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 30,
      width: 50,
      height: 40,
      label: 'Town',
      targetScene: 'town',
      color: k.rgb(101, 67, 33),
      visible: true,
    });

    k.add([
      k.text('Exit', { size: 13 }),
      k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.z(10),
    ]);

    // --- PLAYER ---
    const player = await createPlayer({
      k,
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 120,
      color: catColor,
    });

    // --- MOVEMENT ---
    setupMovement({
      k,
      player,
      speed: PLAYER_SPEED,
      bounds: {
        minX: 30,
        maxX: CANVAS_WIDTH - 30,
        minY: 200,
        maxY: CANVAS_HEIGHT - 60,
      },
    });

    // --- SHOP STATE ---
    let shopOpen = false;
    let selectedTab = 0;
    let selectedItem = 0;
    let shopUIElements: GameObj[] = [];
    let messageElements: GameObj[] = []; // FIXED: Track message elements separately
    let goldDisplay: GameObj;
    let isProcessing = false; // FIXED: Prevent double-clicks

    const tabs = ['Items', 'Weapons', 'Armor', 'Special', 'Decor', 'Equip', 'Sell'];

    // Get items dynamically based on player's unlocked tier
    function getTabInventory(tabIndex: number): string[] {
      const playerTier = getUnlockedTier(GameState.player.level);
      const shopItems = getShopItemsForTier(playerTier);

      switch (tabIndex) {
        case 0: return shopItems.consumables;
        case 1: return shopItems.weapons;
        case 2: return shopItems.armor;
        case 3: return shopItems.special;
        case 4: return shopItems.decorations;
        case 5: return []; // Equipment tab - handled separately
        default: return [];
      }
    }

    function getPlayerEquipment(): { id: string; slot: EquipmentSlot }[] {
      const equipment: { id: string; slot: EquipmentSlot }[] = [];
      for (const invItem of GameState.player.items) {
        const item = getItem(invItem.id);
        if (item?.type === 'equipment' && item.slot) {
          for (let i = 0; i < invItem.quantity; i++) {
            equipment.push({ id: invItem.id, slot: item.slot });
          }
        }
      }
      return equipment;
    }

    // --- GOLD DISPLAY ---
    k.add([
      k.rect(100, 30),
      k.pos(CANVAS_WIDTH - 110, 10),
      k.color(0, 0, 0),
      k.opacity(0.6),
      k.z(50),
    ]);

    goldDisplay = k.add([
      k.text(`Gold: ${GameState.player.gold}`, { size: 12 }),
      k.pos(CANVAS_WIDTH - 100, 18),
      k.color(251, 191, 36),
      k.z(51),
    ]);

    function updateGoldDisplay(): void {
      if (goldDisplay && goldDisplay.exists()) {
        goldDisplay.text = `Gold: ${GameState.player.gold}`;
      }
    }

    // --- SHOP UI ---
    function openShop(): void {
      if (shopOpen || isProcessing) return;
      shopOpen = true;
      player.freeze();
      selectedTab = 0;
      selectedItem = 0;
      renderShopUI();
    }

    function closeShop(): void {
      if (!shopOpen) return;
      shopOpen = false;
      player.unfreeze();
      clearShopUI();
      clearMessages();
    }

    function clearShopUI(): void {
      for (const e of shopUIElements) {
        try {
          if (e && e.exists()) {
            k.destroy(e);
          }
        } catch (err) {
          // Element already destroyed, ignore
        }
      }
      shopUIElements = [];
    }

    // FIXED: Separate message cleanup
    function clearMessages(): void {
      for (const e of messageElements) {
        try {
          if (e && e.exists()) {
            k.destroy(e);
          }
        } catch (err) {
          // Element already destroyed, ignore
        }
      }
      messageElements = [];
    }

    function renderShopUI(): void {
      if (isProcessing) return;

      clearShopUI();
      // Don't clear messages here - they have their own timeout

      // Background
      const bg = k.add([
        k.rect(400, 280),
        k.pos(CANVAS_WIDTH / 2 - 200, 50),
        k.color(30, 30, 50),
        k.outline(3, k.rgb(100, 100, 150)),
        k.z(100),
      ]);
      shopUIElements.push(bg);

      // Title
      const playerTier = getUnlockedTier(GameState.player.level);
      const titleText = selectedTab === 5 ? "Equipment Manager" : `Shop (Tier ${playerTier} Unlocked)`;
      const title = k.add([
        k.text(titleText, { size: 14 }),
        k.pos(CANVAS_WIDTH / 2, 70),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.z(101),
      ]);
      shopUIElements.push(title);

      // Tabs (7 tabs: Items, Weapons, Armor, Special, Decor, Equip, Sell)
      tabs.forEach((tab, i) => {
        const isSelected = i === selectedTab;
        const tabWidth = 48;
        const tabSpacing = 5;
        const startX = CANVAS_WIDTH / 2 - 185;
        const tabBg = k.add([
          k.rect(tabWidth, 22),
          k.pos(startX + i * (tabWidth + tabSpacing), 90),
          k.color(isSelected ? 100 : 50, isSelected ? 100 : 50, isSelected ? 150 : 80),
          k.outline(2, k.rgb(100, 100, 150)),
          k.z(101),
        ]);
        shopUIElements.push(tabBg);

        const tabText = k.add([
          k.text(tab, { size: 11 }),
          k.pos(startX + i * (tabWidth + tabSpacing) + tabWidth / 2, 101),
          k.anchor('center'),
          k.color(isSelected ? 255 : 180, isSelected ? 255 : 180, isSelected ? 100 : 180),
          k.z(102),
        ]);
        shopUIElements.push(tabText);
      });

      if (selectedTab === 5) {
        renderEquipmentTab();
      } else if (selectedTab === 6) {
        renderSellTab();
      } else {
        renderShopTab();
      }
    }

    /**
     * Get player's sellable items (all items in inventory)
     */
    function getSellableItems(): { id: string; quantity: number; item: ItemDefinition }[] {
      const sellable: { id: string; quantity: number; item: ItemDefinition }[] = [];
      for (const invItem of GameState.player.items) {
        const item = getItem(invItem.id);
        if (item && item.sellPrice > 0) {
          sellable.push({ id: invItem.id, quantity: invItem.quantity, item });
        }
      }
      return sellable;
    }

    function renderShopTab(): void {
      const currentItems = getTabInventory(selectedTab);

      // FIXED: Ensure selectedItem is in bounds
      if (selectedItem >= currentItems.length) {
        selectedItem = Math.max(0, currentItems.length - 1);
      }

      if (currentItems.length === 0) {
        const emptyText = k.add([
          k.text('No items available in this category', { size: 13 }),
          k.pos(CANVAS_WIDTH / 2, 180),
          k.anchor('center'),
          k.color(150, 150, 150),
          k.z(102),
        ]);
        shopUIElements.push(emptyText);
      } else {
        // Show up to 4 items (to leave room for description)
        const visibleItems = currentItems.slice(0, 4);
        visibleItems.forEach((itemId, i) => {
          const item = getItem(itemId);
          if (!item) return;

          const isSelected = i === selectedItem;
          const y = 120 + i * 30;

          const itemBg = k.add([
            k.rect(380, 26),
            k.pos(CANVAS_WIDTH / 2 - 190, y),
            k.color(isSelected ? 60 : 40, isSelected ? 60 : 40, isSelected ? 100 : 60),
            k.outline(isSelected ? 2 : 1, k.rgb(isSelected ? 251 : 80, isSelected ? 191 : 80, isSelected ? 36 : 100)),
            k.z(101),
          ]);
          shopUIElements.push(itemBg);

          // Tier badge
          const tierColors: Record<number, [number, number, number]> = {
            1: [100, 100, 100], // Gray
            2: [50, 150, 50],   // Green
            3: [50, 100, 200],  // Blue
            4: [150, 50, 200],  // Purple
            5: [200, 150, 50],  // Gold
            6: [200, 50, 50],   // Red
          };
          const tierColor = tierColors[item.tier || 1] || tierColors[1];
          const tierBadge = k.add([
            k.rect(16, 16),
            k.pos(CANVAS_WIDTH / 2 - 185, y + 5),
            k.color(tierColor[0], tierColor[1], tierColor[2]),
            k.outline(1, k.rgb(0, 0, 0)),
            k.z(102),
          ]);
          shopUIElements.push(tierBadge);

          const tierNum = k.add([
            k.text(`${item.tier || 1}`, { size: 12 }),
            k.pos(CANVAS_WIDTH / 2 - 177, y + 8),
            k.anchor('center'),
            k.color(255, 255, 255),
            k.z(103),
          ]);
          shopUIElements.push(tierNum);

          // Icon
          const iconColor = item.iconColor || [100, 100, 100];
          const icon = k.add([
            k.rect(16, 16),
            k.pos(CANVAS_WIDTH / 2 - 165, y + 5),
            k.color(iconColor[0], iconColor[1], iconColor[2]),
            k.outline(1, k.rgb(0, 0, 0)),
            k.z(102),
          ]);
          shopUIElements.push(icon);

          const nameText = k.add([
            k.text(item.name, { size: 12 }),
            k.pos(CANVAS_WIDTH / 2 - 145, y + 9),
            k.color(255, 255, 255),
            k.z(102),
          ]);
          shopUIElements.push(nameText);

          const priceText = k.add([
            k.text(`${item.buyPrice}G`, { size: 12 }),
            k.pos(CANVAS_WIDTH / 2 + 155, y + 9),
            k.color(251, 191, 36),
            k.z(102),
          ]);
          shopUIElements.push(priceText);

          // Owned count
          const owned = GameState.getItemCount(itemId);
          if (owned > 0) {
            const ownedText = k.add([
              k.text(`x${owned}`, { size: 12 }),
              k.pos(CANVAS_WIDTH / 2 + 115, y + 10),
              k.color(150, 200, 150),
              k.z(102),
            ]);
            shopUIElements.push(ownedText);
          }
        });

        // Selected item description panel
        if (currentItems.length > 0 && selectedItem < currentItems.length) {
          const selectedItemDef = getItem(currentItems[selectedItem]);
          if (selectedItemDef) {
            const descY = 245;

            const descBg = k.add([
              k.rect(380, 50),
              k.pos(CANVAS_WIDTH / 2 - 190, descY),
              k.color(20, 20, 40),
              k.outline(1, k.rgb(80, 80, 120)),
              k.z(101),
            ]);
            shopUIElements.push(descBg);

            const descText = k.add([
              k.text(selectedItemDef.description, { size: 12, width: 370 }),
              k.pos(CANVAS_WIDTH / 2 - 185, descY + 5),
              k.color(200, 200, 200),
              k.z(102),
            ]);
            shopUIElements.push(descText);

            // Show special info based on item type
            let extraInfo = '';
            if (selectedItemDef.stats) {
              const statStrings: string[] = [];
              if (selectedItemDef.stats.attack) statStrings.push(`+${selectedItemDef.stats.attack} ATK`);
              if (selectedItemDef.stats.defense) statStrings.push(`+${selectedItemDef.stats.defense} DEF`);
              if (selectedItemDef.stats.luck) statStrings.push(`+${selectedItemDef.stats.luck} LCK`);
              if (selectedItemDef.stats.maxMana) statStrings.push(`+${selectedItemDef.stats.maxMana} MP`);
              extraInfo = statStrings.join(' | ');
            }
            if (selectedItemDef.specialAbility) {
              extraInfo = `Magic: ${selectedItemDef.specialAbility.name} (${selectedItemDef.specialAbility.manaCost} MP)`;
            }
            if (selectedItemDef.decoration) {
              extraInfo = `Decoration: ${selectedItemDef.decoration.width}x${selectedItemDef.decoration.height} tiles`;
            }
            if (extraInfo) {
              const extraText = k.add([
                k.text(extraInfo, { size: 12 }),
                k.pos(CANVAS_WIDTH / 2 - 185, descY + 35),
                k.color(100, 200, 255),
                k.z(102),
              ]);
              shopUIElements.push(extraText);
            }
          }
        }
      }

      const instructions = k.add([
        k.text('Arrows: Navigate | Q/E: Switch Tab | ENTER: Buy | ESC: Close', { size: 12 }),
        k.pos(CANVAS_WIDTH / 2, 310),
        k.anchor('center'),
        k.color(150, 150, 150),
        k.z(101),
      ]);
      shopUIElements.push(instructions);
    }

    function renderEquipmentTab(): void {
      const equipped = GameState.player.equipped;
      const slots: { slot: EquipmentSlot; label: string; y: number }[] = [
        { slot: 'weapon', label: 'Weapon', y: 125 },
        { slot: 'armor', label: 'Armor', y: 155 },
        { slot: 'accessory', label: 'Accessory', y: 185 },
      ];

      const headerText = k.add([
        k.text('Currently Equipped:', { size: 13 }),
        k.pos(CANVAS_WIDTH / 2 - 180, 125),
        k.color(200, 200, 200),
        k.z(102),
      ]);
      shopUIElements.push(headerText);

      slots.forEach(({ slot, label, y }) => {
        const equippedId = equipped[slot];
        const item = equippedId ? getItem(equippedId) : null;
        const displayY = y + 15;

        const slotLabel = k.add([
          k.text(`${label}:`, { size: 12 }),
          k.pos(CANVAS_WIDTH / 2 - 170, displayY),
          k.color(150, 150, 200),
          k.z(102),
        ]);
        shopUIElements.push(slotLabel);

        const itemText = k.add([
          k.text(item ? item.name : '(none)', { size: 12 }),
          k.pos(CANVAS_WIDTH / 2 - 90, displayY),
          k.color(item ? 255 : 100, item ? 255 : 100, item ? 255 : 100),
          k.z(102),
        ]);
        shopUIElements.push(itemText);

        if (item?.stats) {
          const statsStr = Object.entries(item.stats)
            .map(([stat, v]) => `+${v} ${stat.substring(0, 3).toUpperCase()}`)
            .join(' ');
          const statsText = k.add([
            k.text(statsStr, { size: 12 }),
            k.pos(CANVAS_WIDTH / 2 + 80, displayY),
            k.color(100, 255, 100),
            k.z(102),
          ]);
          shopUIElements.push(statsText);
        }
      });

      const divider = k.add([
        k.rect(360, 2),
        k.pos(CANVAS_WIDTH / 2 - 180, 215),
        k.color(80, 80, 120),
        k.z(102),
      ]);
      shopUIElements.push(divider);

      const availableHeader = k.add([
        k.text('Available to Equip:', { size: 13 }),
        k.pos(CANVAS_WIDTH / 2 - 180, 225),
        k.color(200, 200, 200),
        k.z(102),
      ]);
      shopUIElements.push(availableHeader);

      const playerEquipment = getPlayerEquipment();

      // FIXED: Ensure selectedItem is in bounds for equipment tab
      if (selectedItem >= playerEquipment.length) {
        selectedItem = Math.max(0, playerEquipment.length - 1);
      }

      if (playerEquipment.length === 0) {
        const noItems = k.add([
          k.text('No equipment in inventory. Buy some from the shop!', { size: 12 }),
          k.pos(CANVAS_WIDTH / 2, 250),
          k.anchor('center'),
          k.color(150, 150, 150),
          k.z(102),
        ]);
        shopUIElements.push(noItems);
      } else {
        playerEquipment.slice(0, 3).forEach((eq, i) => {
          const item = getItem(eq.id);
          if (!item) return;

          const isSelected = i === selectedItem;
          const y = 240 + i * 25;

          const itemBg = k.add([
            k.rect(360, 22),
            k.pos(CANVAS_WIDTH / 2 - 180, y),
            k.color(isSelected ? 60 : 40, isSelected ? 80 : 40, isSelected ? 100 : 60),
            k.outline(isSelected ? 2 : 1, k.rgb(isSelected ? 100 : 60, isSelected ? 255 : 60, isSelected ? 100 : 80)),
            k.z(101),
          ]);
          shopUIElements.push(itemBg);

          const iconColor = item.iconColor || [100, 100, 100];
          const icon = k.add([
            k.rect(16, 16),
            k.pos(CANVAS_WIDTH / 2 - 175, y + 3),
            k.color(iconColor[0], iconColor[1], iconColor[2]),
            k.outline(1, k.rgb(0, 0, 0)),
            k.z(102),
          ]);
          shopUIElements.push(icon);

          const nameText = k.add([
            k.text(item.name, { size: 12 }),
            k.pos(CANVAS_WIDTH / 2 - 150, y + 6),
            k.color(255, 255, 255),
            k.z(102),
          ]);
          shopUIElements.push(nameText);

          const slotText = k.add([
            k.text(`(${eq.slot})`, { size: 12 }),
            k.pos(CANVAS_WIDTH / 2 + 100, y + 7),
            k.color(150, 150, 200),
            k.z(102),
          ]);
          shopUIElements.push(slotText);
        });
      }

      const instructions = k.add([
        k.text('Arrows: Select | ENTER: Equip | U: Unequip slot | ESC: Close', { size: 12 }),
        k.pos(CANVAS_WIDTH / 2, 310),
        k.anchor('center'),
        k.color(150, 150, 150),
        k.z(101),
      ]);
      shopUIElements.push(instructions);
    }

    function renderSellTab(): void {
      const sellableItems = getSellableItems();

      // FIXED: Ensure selectedItem is in bounds for sell tab
      if (selectedItem >= sellableItems.length) {
        selectedItem = Math.max(0, sellableItems.length - 1);
      }

      const headerText = k.add([
        k.text('Sell Your Items:', { size: 13 }),
        k.pos(CANVAS_WIDTH / 2 - 180, 120),
        k.color(200, 200, 200),
        k.z(102),
      ]);
      shopUIElements.push(headerText);

      if (sellableItems.length === 0) {
        const noItems = k.add([
          k.text('No items to sell. Go find some loot!', { size: 12 }),
          k.pos(CANVAS_WIDTH / 2, 180),
          k.anchor('center'),
          k.color(150, 150, 150),
          k.z(102),
        ]);
        shopUIElements.push(noItems);
      } else {
        // Show up to 5 items
        sellableItems.slice(0, 5).forEach((sellItem, i) => {
          const isSelected = i === selectedItem;
          const y = 140 + i * 28;

          const itemBg = k.add([
            k.rect(360, 24),
            k.pos(CANVAS_WIDTH / 2 - 180, y),
            k.color(isSelected ? 60 : 40, isSelected ? 50 : 40, isSelected ? 80 : 60),
            k.outline(isSelected ? 2 : 1, k.rgb(isSelected ? 251 : 80, isSelected ? 191 : 80, isSelected ? 36 : 100)),
            k.z(101),
          ]);
          shopUIElements.push(itemBg);

          // Icon
          const iconColor = sellItem.item.iconColor || [100, 100, 100];
          const icon = k.add([
            k.rect(16, 16),
            k.pos(CANVAS_WIDTH / 2 - 175, y + 4),
            k.color(iconColor[0], iconColor[1], iconColor[2]),
            k.outline(1, k.rgb(0, 0, 0)),
            k.z(102),
          ]);
          shopUIElements.push(icon);

          // Item name
          const nameText = k.add([
            k.text(sellItem.item.name, { size: 12 }),
            k.pos(CANVAS_WIDTH / 2 - 155, y + 7),
            k.color(255, 255, 255),
            k.z(102),
          ]);
          shopUIElements.push(nameText);

          // Quantity owned
          const qtyText = k.add([
            k.text(`x${sellItem.quantity}`, { size: 12 }),
            k.pos(CANVAS_WIDTH / 2 + 60, y + 7),
            k.color(150, 200, 150),
            k.z(102),
          ]);
          shopUIElements.push(qtyText);

          // Sell price
          const priceText = k.add([
            k.text(`${sellItem.item.sellPrice}G`, { size: 12 }),
            k.pos(CANVAS_WIDTH / 2 + 140, y + 7),
            k.color(251, 191, 36),
            k.z(102),
          ]);
          shopUIElements.push(priceText);
        });

        // Selected item description
        if (sellableItems.length > 0 && selectedItem < sellableItems.length) {
          const selectedSellItem = sellableItems[selectedItem];
          const descY = 285;

          const descBg = k.add([
            k.rect(360, 30),
            k.pos(CANVAS_WIDTH / 2 - 180, descY),
            k.color(20, 20, 40),
            k.outline(1, k.rgb(80, 80, 120)),
            k.z(101),
          ]);
          shopUIElements.push(descBg);

          const descText = k.add([
            k.text(selectedSellItem.item.description, { size: 12, width: 350 }),
            k.pos(CANVAS_WIDTH / 2 - 175, descY + 8),
            k.color(200, 200, 200),
            k.z(102),
          ]);
          shopUIElements.push(descText);
        }
      }

      const instructions = k.add([
        k.text('Arrows: Select | ENTER: Sell 1 | ESC: Close', { size: 12 }),
        k.pos(CANVAS_WIDTH / 2, 320),
        k.anchor('center'),
        k.color(150, 150, 150),
        k.z(101),
      ]);
      shopUIElements.push(instructions);
    }

    function purchaseItem(): void {
      if (isProcessing) return;

      if (selectedTab === 5) {
        equipSelectedItem();
        return;
      }

      if (selectedTab === 6) {
        sellItem();
        return;
      }

      const currentItems = getTabInventory(selectedTab);
      if (currentItems.length === 0 || selectedItem >= currentItems.length) {
        showShopMessage("No item selected!");
        return;
      }

      const itemId = currentItems[selectedItem];
      const item = getItem(itemId);
      if (!item) {
        showShopMessage("Item not found!");
        return;
      }

      if (GameState.player.gold < item.buyPrice) {
        showShopMessage("Not enough gold!");
        return;
      }

      // FIXED: Set processing flag to prevent double-purchase
      isProcessing = true;

      GameState.spendGold(item.buyPrice);
      GameState.addItem(itemId, 1);
      updateGoldDisplay();

      // FIXED: Play sound safely
      try {
        playSound(k, 'shopBuy');
      } catch (err) {
        console.warn('Could not play shop sound');
      }

      showShopMessage(`Purchased ${item.name}!`);

      // FIXED: Delay re-render slightly to prevent UI conflicts
      k.wait(0.1, () => {
        isProcessing = false;
        if (shopOpen) {
          renderShopUI();
        }
      });
    }

    function equipSelectedItem(): void {
      if (isProcessing) return;

      const playerEquipment = getPlayerEquipment();
      if (playerEquipment.length === 0 || selectedItem >= playerEquipment.length) {
        showShopMessage("No item selected!");
        return;
      }

      isProcessing = true;

      const eq = playerEquipment[selectedItem];
      const success = GameState.equipItem(eq.id);

      if (success) {
        const item = getItem(eq.id);
        try {
          playSound(k, 'equip');
        } catch (err) {
          console.warn('Could not play equip sound');
        }
        showShopMessage(`Equipped ${item?.name || 'item'}!`);
        selectedItem = 0;
      } else {
        showShopMessage("Failed to equip!");
      }

      k.wait(0.1, () => {
        isProcessing = false;
        if (shopOpen) {
          renderShopUI();
        }
      });
    }

    function sellItem(): void {
      if (isProcessing) return;

      const sellableItems = getSellableItems();
      if (sellableItems.length === 0 || selectedItem >= sellableItems.length) {
        showShopMessage("No item selected!");
        return;
      }

      const sellItemData = sellableItems[selectedItem];

      // Check if item is currently equipped
      const equipped = GameState.player.equipped;
      if (equipped.weapon === sellItemData.id ||
          equipped.armor === sellItemData.id ||
          equipped.accessory === sellItemData.id) {
        showShopMessage("Unequip item first!");
        return;
      }

      isProcessing = true;

      // Remove one item and add gold
      GameState.removeItem(sellItemData.id, 1);
      GameState.addGold(sellItemData.item.sellPrice);
      updateGoldDisplay();

      try {
        playSound(k, 'goldCollect');
      } catch (err) {
        console.warn('Could not play sell sound');
      }

      showShopMessage(`Sold ${sellItemData.item.name} for ${sellItemData.item.sellPrice}G!`);

      // Reset selection if we sold the last of this item
      const updatedItems = getSellableItems();
      if (selectedItem >= updatedItems.length) {
        selectedItem = Math.max(0, updatedItems.length - 1);
      }

      k.wait(0.1, () => {
        isProcessing = false;
        if (shopOpen) {
          renderShopUI();
        }
      });
    }

    function unequipSlot(): void {
      if (selectedTab !== 5 || isProcessing) return;

      const slots: EquipmentSlot[] = ['weapon', 'armor', 'accessory'];
      for (const slot of slots) {
        if (GameState.player.equipped[slot]) {
          const itemId = GameState.player.equipped[slot]!;
          const item = getItem(itemId);
          GameState.unequipItem(slot);
          showShopMessage(`Unequipped ${item?.name || slot}!`);

          k.wait(0.1, () => {
            if (shopOpen) {
              renderShopUI();
            }
          });
          return;
        }
      }

      showShopMessage("Nothing equipped!");
    }

    // FIXED: Show message with proper tracking
    function showShopMessage(text: string): void {
      // Clear any existing messages first
      clearMessages();

      const msgBg = k.add([
        k.rect(300, 40),
        k.pos(170, 30),
        k.color(0, 0, 0),
        k.opacity(0.9),
        k.z(300),
      ]);
      messageElements.push(msgBg);

      const msgText = k.add([
        k.text(text, { size: 12 }),
        k.pos(320, 50),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.z(301),
      ]);
      messageElements.push(msgText);

      k.wait(1.5, () => {
        clearMessages();
      });
    }

    // --- INTERACTIONS ---
    const interactables: Interactable[] = [
      {
        entity: exitDoor.entity,
        type: 'door',
        promptText: exitDoor.getPromptText(),
        onInteract: () => {
          if (!shopOpen) exitDoor.enter();
        },
      },
      {
        entity: shopkeeper,
        type: 'npc',
        promptText: 'ENTER to browse wares',
        range: 80,
        onInteract: () => {
          openShop();
        },
      },
    ];

    setupInteraction({
      k,
      player,
      interactables,
    });

    // --- UI ---
    k.add([
      k.text('Shop', { size: 16 }),
      k.pos(20, 20),
      k.color(255, 255, 255),
      k.z(50),
    ]);

    k.add([
      k.text('Arrow/WASD: Move | ENTER: Interact | ESC: Back', { size: 12 }),
      k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 15),
      k.anchor('center'),
      k.color(200, 200, 200),
      k.z(50),
    ]);

    // --- INPUT ---
    k.onKeyPress('escape', () => {
      // Don't allow escape during purchase/equip operations to prevent state desync
      if (isProcessing) return;

      if (shopOpen) {
        closeShop();
      } else {
        k.go('town');
      }
    });

    k.onKeyPress('up', () => {
      if (!shopOpen || isProcessing) return;
      if (selectedItem > 0) {
        selectedItem--;
        renderShopUI();
      }
    });

    k.onKeyPress('down', () => {
      if (!shopOpen || isProcessing) return;

      // FIXED: Get correct max items based on tab
      let maxItems: number;
      if (selectedTab === 5) {
        maxItems = getPlayerEquipment().length;
      } else if (selectedTab === 6) {
        maxItems = getSellableItems().length;
      } else {
        maxItems = getTabInventory(selectedTab).length;
      }

      if (selectedItem < maxItems - 1) {
        selectedItem++;
        renderShopUI();
      }
    });

    k.onKeyPress('q', () => {
      if (!shopOpen || isProcessing) return;
      if (selectedTab > 0) {
        selectedTab--;
        selectedItem = 0;
        renderShopUI();
      }
    });

    k.onKeyPress('e', () => {
      if (!shopOpen || isProcessing) return;
      if (selectedTab < tabs.length - 1) {
        selectedTab++;
        selectedItem = 0;
        renderShopUI();
      }
    });

    k.onKeyPress('left', () => {
      if (!shopOpen || isProcessing) return;
      if (selectedTab > 0) {
        selectedTab--;
        selectedItem = 0;
        renderShopUI();
      }
    });

    k.onKeyPress('right', () => {
      if (!shopOpen || isProcessing) return;
      if (selectedTab < tabs.length - 1) {
        selectedTab++;
        selectedItem = 0;
        renderShopUI();
      }
    });

    k.onKeyPress('enter', () => {
      if (shopOpen && !isProcessing) {
        purchaseItem();
      }
    });

    k.onKeyPress('u', () => {
      if (shopOpen && !isProcessing) {
        unequipSlot();
      }
    });

    console.log('=== StudyQuest Shop ===');
  });
}
