/**
 * ShopScene
 *
 * Where players can buy:
 * - Consumable items (potions, etc.)
 * - Equipment (weapons, armor)
 * - Furniture for their home
 */

import type { KAPLAYCtx, GameObj } from 'kaplay';
import { GameState } from '../state/GameState.js';
import { createPlayer } from '../components/Player.js';
import { setupMovement } from '../systems/movement.js';
import { setupInteraction, type Interactable } from '../systems/interaction.js';
import { createDoor } from '../components/Door.js';
import { PLAYER_SPEED } from '../config.js';
import type { CatColor } from '../sprites/catSprites.js';
import { getItem, SHOP_INVENTORY, type ItemDefinition, type EquipmentSlot } from '../data/items.js';
import { playSound } from '../systems/sound.js';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 400;

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
      await k.loadSprite('shop-bg', '../../assets/BACKGROUNDS/Cat-Themed General Store Interior.png');
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
      // Scale to cover canvas
      const bgScale = Math.max(CANVAS_WIDTH / 1024, CANVAS_HEIGHT / 576);
      bgSprite.scale = k.vec2(bgScale, bgScale);
    } else {
      // Fallback: original colored rectangles
      // Floor
      k.add([
        k.rect(CANVAS_WIDTH, CANVAS_HEIGHT),
        k.pos(0, 0),
        k.color(101, 67, 33),
        k.z(0),
      ]);

      // Wall
      k.add([
        k.rect(CANVAS_WIDTH, 180),
        k.pos(0, 0),
        k.color(70, 130, 180),
        k.z(1),
      ]);

      // Wall border
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
      k.color(139, 69, 19), // Wood counter
      k.outline(3, k.rgb(0, 0, 0)),
      k.z(5),
    ]);

    // --- SHOPKEEPER (placeholder) ---
    const shopkeeper = k.add([
      k.rect(40, 60),
      k.pos(CANVAS_WIDTH / 2 - 20, 140),
      k.color(255, 182, 193), // Pink (placeholder)
      k.outline(2, k.rgb(0, 0, 0)),
      k.z(6),
      'shopkeeper',
    ]);

    // Shopkeeper label
    k.add([
      k.text('Shopkeeper', { size: 10 }),
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
        k.text(item.label, { size: 8 }),
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

    // Door label
    k.add([
      k.text('Exit', { size: 10 }),
      k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10),
      k.anchor('center'),
      k.color(255, 255, 255),
      k.z(10),
    ]);

    // --- PLAYER ---
    const player = await createPlayer({
      k,
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 100,
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
        minY: 270,
        maxY: CANVAS_HEIGHT - 60,
      },
    });

    // --- SHOP STATE ---
    let shopOpen = false;
    let selectedTab = 0;
    let selectedItem = 0;
    let shopUIElements: GameObj[] = [];
    let goldDisplay: GameObj;

    const tabs = ['Items', 'Weapons', 'Armor', 'Equip'];
    const tabInventories = [
      SHOP_INVENTORY.consumables,
      SHOP_INVENTORY.weapons,
      SHOP_INVENTORY.armor,
      [], // Equipment tab shows owned equipment
    ];

    // Get equipment from player inventory for Equip tab
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
    const goldBg = k.add([
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
      goldDisplay.text = `Gold: ${GameState.player.gold}`;
    }

    // --- SHOP UI ---
    function openShop(): void {
      if (shopOpen) return;
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
    }

    function clearShopUI(): void {
      shopUIElements.forEach((e) => k.destroy(e));
      shopUIElements = [];
    }

    function renderShopUI(): void {
      clearShopUI();

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
      const titleText = selectedTab === 3 ? "Equipment Manager" : "Welcome to the Shop!";
      const title = k.add([
        k.text(titleText, { size: 14 }),
        k.pos(CANVAS_WIDTH / 2, 70),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.z(101),
      ]);
      shopUIElements.push(title);

      // Tabs
      tabs.forEach((tab, i) => {
        const isSelected = i === selectedTab;
        const tabWidth = 70;
        const tabBg = k.add([
          k.rect(tabWidth, 25),
          k.pos(145 + i * (tabWidth + 10), 90),
          k.color(isSelected ? 100 : 50, isSelected ? 100 : 50, isSelected ? 150 : 80),
          k.outline(2, k.rgb(100, 100, 150)),
          k.z(101),
        ]);
        shopUIElements.push(tabBg);

        const tabText = k.add([
          k.text(tab, { size: 9 }),
          k.pos(145 + i * (tabWidth + 10) + tabWidth / 2, 103),
          k.anchor('center'),
          k.color(isSelected ? 255 : 180, isSelected ? 255 : 180, isSelected ? 100 : 180),
          k.z(102),
        ]);
        shopUIElements.push(tabText);
      });

      // Render based on tab
      if (selectedTab === 3) {
        renderEquipmentTab();
      } else {
        renderShopTab();
      }
    }

    function renderShopTab(): void {
      // Item list
      const currentItems = tabInventories[selectedTab];
      currentItems.forEach((itemId, i) => {
        const item = getItem(itemId);
        if (!item) return;

        const isSelected = i === selectedItem;
        const y = 125 + i * 35;

        // Item background
        const itemBg = k.add([
          k.rect(380, 30),
          k.pos(CANVAS_WIDTH / 2 - 190, y),
          k.color(isSelected ? 60 : 40, isSelected ? 60 : 40, isSelected ? 100 : 60),
          k.outline(isSelected ? 2 : 1, k.rgb(isSelected ? 251 : 80, isSelected ? 191 : 80, isSelected ? 36 : 100)),
          k.z(101),
        ]);
        shopUIElements.push(itemBg);

        // Item icon (color rectangle)
        const iconColor = item.iconColor || [100, 100, 100];
        const icon = k.add([
          k.rect(20, 20),
          k.pos(CANVAS_WIDTH / 2 - 180, y + 5),
          k.color(iconColor[0], iconColor[1], iconColor[2]),
          k.outline(1, k.rgb(0, 0, 0)),
          k.z(102),
        ]);
        shopUIElements.push(icon);

        // Item name
        const nameText = k.add([
          k.text(item.name, { size: 10 }),
          k.pos(CANVAS_WIDTH / 2 - 150, y + 10),
          k.color(255, 255, 255),
          k.z(102),
        ]);
        shopUIElements.push(nameText);

        // Item price
        const priceText = k.add([
          k.text(`${item.buyPrice}G`, { size: 10 }),
          k.pos(CANVAS_WIDTH / 2 + 150, y + 10),
          k.color(251, 191, 36),
          k.z(102),
        ]);
        shopUIElements.push(priceText);

        // Owned count (for consumables)
        if (item.type === 'consumable') {
          const owned = GameState.getItemCount(itemId);
          const ownedText = k.add([
            k.text(`Owned: ${owned}`, { size: 8 }),
            k.pos(CANVAS_WIDTH / 2 + 80, y + 12),
            k.color(150, 150, 150),
            k.z(102),
          ]);
          shopUIElements.push(ownedText);
        }
      });

      // Instructions
      const instructions = k.add([
        k.text('Arrows: Navigate | Q/E: Switch Tab | ENTER: Buy | ESC: Close', { size: 8 }),
        k.pos(CANVAS_WIDTH / 2, 310),
        k.anchor('center'),
        k.color(150, 150, 150),
        k.z(101),
      ]);
      shopUIElements.push(instructions);
    }

    function renderEquipmentTab(): void {
      // Show currently equipped items
      const equipped = GameState.player.equipped;
      const slots: { slot: EquipmentSlot; label: string; y: number }[] = [
        { slot: 'weapon', label: 'Weapon', y: 125 },
        { slot: 'armor', label: 'Armor', y: 155 },
        { slot: 'accessory', label: 'Accessory', y: 185 },
      ];

      // Section header
      const headerText = k.add([
        k.text('Currently Equipped:', { size: 10 }),
        k.pos(CANVAS_WIDTH / 2 - 180, 125),
        k.color(200, 200, 200),
        k.z(102),
      ]);
      shopUIElements.push(headerText);

      slots.forEach(({ slot, label, y }) => {
        const equippedId = equipped[slot];
        const item = equippedId ? getItem(equippedId) : null;
        const displayY = y + 15;

        // Slot label
        const slotLabel = k.add([
          k.text(`${label}:`, { size: 9 }),
          k.pos(CANVAS_WIDTH / 2 - 170, displayY),
          k.color(150, 150, 200),
          k.z(102),
        ]);
        shopUIElements.push(slotLabel);

        // Equipped item or "None"
        const itemText = k.add([
          k.text(item ? item.name : '(none)', { size: 9 }),
          k.pos(CANVAS_WIDTH / 2 - 90, displayY),
          k.color(item ? 255 : 100, item ? 255 : 100, item ? 255 : 100),
          k.z(102),
        ]);
        shopUIElements.push(itemText);

        // Stats if equipped
        if (item?.stats) {
          const statsStr = Object.entries(item.stats)
            .map(([k, v]) => `+${v} ${k.substring(0, 3).toUpperCase()}`)
            .join(' ');
          const statsText = k.add([
            k.text(statsStr, { size: 8 }),
            k.pos(CANVAS_WIDTH / 2 + 80, displayY),
            k.color(100, 255, 100),
            k.z(102),
          ]);
          shopUIElements.push(statsText);
        }
      });

      // Divider
      const divider = k.add([
        k.rect(360, 2),
        k.pos(CANVAS_WIDTH / 2 - 180, 215),
        k.color(80, 80, 120),
        k.z(102),
      ]);
      shopUIElements.push(divider);

      // Available equipment header
      const availableHeader = k.add([
        k.text('Available to Equip:', { size: 10 }),
        k.pos(CANVAS_WIDTH / 2 - 180, 225),
        k.color(200, 200, 200),
        k.z(102),
      ]);
      shopUIElements.push(availableHeader);

      // List available equipment
      const playerEquipment = getPlayerEquipment();

      if (playerEquipment.length === 0) {
        const noItems = k.add([
          k.text('No equipment in inventory. Buy some from the shop!', { size: 9 }),
          k.pos(CANVAS_WIDTH / 2, 250),
          k.anchor('center'),
          k.color(150, 150, 150),
          k.z(102),
        ]);
        shopUIElements.push(noItems);
      } else {
        playerEquipment.slice(0, 3).forEach((eq, i) => {
          const item = getItem(eq.id)!;
          const isSelected = i === selectedItem;
          const y = 240 + i * 25;

          // Item background
          const itemBg = k.add([
            k.rect(360, 22),
            k.pos(CANVAS_WIDTH / 2 - 180, y),
            k.color(isSelected ? 60 : 40, isSelected ? 80 : 40, isSelected ? 100 : 60),
            k.outline(isSelected ? 2 : 1, k.rgb(isSelected ? 100 : 60, isSelected ? 255 : 60, isSelected ? 100 : 80)),
            k.z(101),
          ]);
          shopUIElements.push(itemBg);

          // Icon
          const iconColor = item.iconColor || [100, 100, 100];
          const icon = k.add([
            k.rect(16, 16),
            k.pos(CANVAS_WIDTH / 2 - 175, y + 3),
            k.color(iconColor[0], iconColor[1], iconColor[2]),
            k.outline(1, k.rgb(0, 0, 0)),
            k.z(102),
          ]);
          shopUIElements.push(icon);

          // Name
          const nameText = k.add([
            k.text(item.name, { size: 9 }),
            k.pos(CANVAS_WIDTH / 2 - 150, y + 6),
            k.color(255, 255, 255),
            k.z(102),
          ]);
          shopUIElements.push(nameText);

          // Slot type
          const slotText = k.add([
            k.text(`[${eq.slot}]`, { size: 8 }),
            k.pos(CANVAS_WIDTH / 2 + 100, y + 7),
            k.color(150, 150, 200),
            k.z(102),
          ]);
          shopUIElements.push(slotText);
        });
      }

      // Instructions
      const instructions = k.add([
        k.text('Arrows: Select | ENTER: Equip | U: Unequip slot | ESC: Close', { size: 8 }),
        k.pos(CANVAS_WIDTH / 2, 310),
        k.anchor('center'),
        k.color(150, 150, 150),
        k.z(101),
      ]);
      shopUIElements.push(instructions);
    }

    function purchaseItem(): void {
      // Equipment tab has different behavior
      if (selectedTab === 3) {
        equipSelectedItem();
        return;
      }

      const currentItems = tabInventories[selectedTab];
      if (selectedItem >= currentItems.length) return;

      const itemId = currentItems[selectedItem];
      const item = getItem(itemId);
      if (!item) return;

      // Check gold
      if (GameState.player.gold < item.buyPrice) {
        showShopMessage(k, "Not enough gold!");
        return;
      }

      // Purchase
      GameState.spendGold(item.buyPrice);
      GameState.addItem(itemId, 1);
      updateGoldDisplay();

      playSound(k, 'shopBuy');
      showShopMessage(k, `Purchased ${item.name}!`);
      renderShopUI();
    }

    function equipSelectedItem(): void {
      const playerEquipment = getPlayerEquipment();
      if (selectedItem >= playerEquipment.length) {
        showShopMessage(k, "No item selected!");
        return;
      }

      const eq = playerEquipment[selectedItem];
      const success = GameState.equipItem(eq.id);

      if (success) {
        const item = getItem(eq.id)!;
        playSound(k, 'equip');
        showShopMessage(k, `Equipped ${item.name}!`);
        selectedItem = 0; // Reset selection
      } else {
        showShopMessage(k, "Failed to equip!");
      }

      renderShopUI();
    }

    function unequipSlot(): void {
      if (selectedTab !== 3) return;

      // Cycle through slots and unequip first equipped
      const slots: EquipmentSlot[] = ['weapon', 'armor', 'accessory'];
      for (const slot of slots) {
        if (GameState.player.equipped[slot]) {
          const itemId = GameState.player.equipped[slot]!;
          const item = getItem(itemId);
          GameState.unequipItem(slot);
          showShopMessage(k, `Unequipped ${item?.name || slot}!`);
          renderShopUI();
          return;
        }
      }

      showShopMessage(k, "Nothing equipped!");
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
    // Scene label
    k.add([
      k.text('Shop', { size: 16 }),
      k.pos(20, 20),
      k.color(255, 255, 255),
      k.z(50),
    ]);

    // Controls hint
    k.add([
      k.text('Arrow/WASD: Move | ENTER: Interact | ESC: Back', { size: 8 }),
      k.pos(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 15),
      k.anchor('center'),
      k.color(200, 200, 200),
      k.z(50),
    ]);

    // --- INPUT ---
    k.onKeyPress('escape', () => {
      if (shopOpen) {
        closeShop();
      } else {
        k.go('town');
      }
    });

    k.onKeyPress('up', () => {
      if (!shopOpen) return;
      const currentItems = tabInventories[selectedTab];
      if (selectedItem > 0) {
        selectedItem--;
        renderShopUI();
      }
    });

    k.onKeyPress('down', () => {
      if (!shopOpen) return;
      const currentItems = tabInventories[selectedTab];
      if (selectedItem < currentItems.length - 1) {
        selectedItem++;
        renderShopUI();
      }
    });

    k.onKeyPress('q', () => {
      if (!shopOpen) return;
      if (selectedTab > 0) {
        selectedTab--;
        selectedItem = 0;
        renderShopUI();
      }
    });

    k.onKeyPress('e', () => {
      if (!shopOpen) return;
      if (selectedTab < tabs.length - 1) {
        selectedTab++;
        selectedItem = 0;
        renderShopUI();
      }
    });

    k.onKeyPress('left', () => {
      if (!shopOpen) return;
      if (selectedTab > 0) {
        selectedTab--;
        selectedItem = 0;
        renderShopUI();
      }
    });

    k.onKeyPress('right', () => {
      if (!shopOpen) return;
      if (selectedTab < tabs.length - 1) {
        selectedTab++;
        selectedItem = 0;
        renderShopUI();
      }
    });

    k.onKeyPress('enter', () => {
      if (shopOpen) {
        purchaseItem();
      }
    });

    k.onKeyPress('u', () => {
      if (shopOpen) {
        unequipSlot();
      }
    });

    console.log('=== StudyQuest Shop ===');
  });
}

/**
 * Show a temporary message from the shopkeeper
 */
function showShopMessage(k: KAPLAYCtx, text: string): void {
  const msgBg = k.add([
    k.rect(300, 40),
    k.pos(170, 30),
    k.color(0, 0, 0),
    k.opacity(0.9),
    k.z(300),
  ]);

  const msgText = k.add([
    k.text(text, { size: 12 }),
    k.pos(320, 50),
    k.anchor('center'),
    k.color(255, 255, 255),
    k.z(301),
  ]);

  // Auto-hide after 1.5 seconds
  k.wait(1.5, () => {
    k.destroy(msgBg);
    k.destroy(msgText);
  });
}
