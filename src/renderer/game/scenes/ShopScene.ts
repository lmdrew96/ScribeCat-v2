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
import { getItem, SHOP_INVENTORY, type ItemDefinition } from '../data/items.js';

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

    const tabs = ['Items', 'Weapons', 'Armor'];
    const tabInventories = [
      SHOP_INVENTORY.consumables,
      SHOP_INVENTORY.weapons,
      SHOP_INVENTORY.armor,
    ];

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
        k.rect(400, 250),
        k.pos(CANVAS_WIDTH / 2 - 200, 60),
        k.color(30, 30, 50),
        k.outline(3, k.rgb(100, 100, 150)),
        k.z(100),
      ]);
      shopUIElements.push(bg);

      // Title
      const title = k.add([
        k.text("Welcome to the Shop!", { size: 14 }),
        k.pos(CANVAS_WIDTH / 2, 80),
        k.anchor('center'),
        k.color(255, 255, 255),
        k.z(101),
      ]);
      shopUIElements.push(title);

      // Tabs
      tabs.forEach((tab, i) => {
        const isSelected = i === selectedTab;
        const tabBg = k.add([
          k.rect(80, 25),
          k.pos(170 + i * 90, 100),
          k.color(isSelected ? 100 : 50, isSelected ? 100 : 50, isSelected ? 150 : 80),
          k.outline(2, k.rgb(100, 100, 150)),
          k.z(101),
        ]);
        shopUIElements.push(tabBg);

        const tabText = k.add([
          k.text(tab, { size: 10 }),
          k.pos(210 + i * 90, 113),
          k.anchor('center'),
          k.color(isSelected ? 255 : 180, isSelected ? 255 : 180, isSelected ? 100 : 180),
          k.z(102),
        ]);
        shopUIElements.push(tabText);
      });

      // Item list
      const currentItems = tabInventories[selectedTab];
      currentItems.forEach((itemId, i) => {
        const item = getItem(itemId);
        if (!item) return;

        const isSelected = i === selectedItem;
        const y = 140 + i * 35;

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
        k.pos(CANVAS_WIDTH / 2, 290),
        k.anchor('center'),
        k.color(150, 150, 150),
        k.z(101),
      ]);
      shopUIElements.push(instructions);
    }

    function purchaseItem(): void {
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

      showShopMessage(k, `Purchased ${item.name}!`);
      renderShopUI();
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
