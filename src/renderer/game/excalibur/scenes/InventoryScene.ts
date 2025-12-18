/**
 * ExcaliburInventoryScene
 *
 * Standalone inventory management screen accessible from Town/Dungeon.
 * Players can view, use, equip, and sell items.
 */

import * as ex from 'excalibur';
import { GameState } from '../../state/GameState.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../config.js';
import { InputManager } from '../adapters/InputAdapter.js';
import { getItem, type ItemDefinition, type EquipmentSlot } from '../../data/items.js';
import { MAX_VISIBLE_ITEMS } from '../ui/UIConstants.js';
import { MessageToast } from '../components/MessageToast.js';

export interface InventorySceneData {
  fromScene?: string;
  dungeonReturnData?: {
    catColor?: string;
    dungeonId?: string;
    floorNumber?: number;
    currentRoomId?: string;
    playerX?: number;
    playerY?: number;
  };
}

const TABS = ['All', 'Items', 'Equip', 'Special', 'Decor'];

export interface InventorySceneConfig {
  onExit?: (scene: string, data?: unknown) => void;
}

/**
 * Main Inventory Scene
 */
export class InventoryScene extends ex.Scene {
  private inputManager: InputManager | null = null;
  private sceneData: InventorySceneData = {};

  // Input cooldown to prevent key events carrying over from scene transitions
  private inputEnabled = false;

  // State
  private selectedTab = 0;
  private selectedItem = 0;
  private isProcessing = false;

  // UI elements
  private uiElements: ex.Actor[] = [];
  private goldLabel: ex.Label | null = null;

  // HTML overlay components
  private messageToast: MessageToast | null = null;

  // Callbacks
  public onExit: ((scene: string, data?: unknown) => void) | null = null;

  constructor(config?: InventorySceneConfig) {
    super();
    if (config?.onExit) {
      this.onExit = config.onExit;
    }
  }

  onActivate(ctx: ex.SceneActivationContext<InventorySceneData>): void {
    this.sceneData = ctx.data || {};
    this.selectedTab = 0;
    this.selectedItem = 0;

    // Disable input briefly to prevent key events from previous scene
    this.inputEnabled = false;
    setTimeout(() => { this.inputEnabled = true; }, 200);

    this.clear();
    this.setupBackground();
    this.setupUI();
    this.setupOverlays();
    this.setupInputHandlers();
    this.renderUI();

    console.log('=== StudyQuest Inventory (Excalibur) ===');
  }

  onDeactivate(): void {
    // Reset input state to prevent stale handlers from firing
    this.inputEnabled = false;

    // Cleanup HTML overlays
    this.messageToast?.destroy();
    this.messageToast = null;

    // Clean up input manager to remove engine-level event listeners
    this.inputManager?.destroy();
    this.inputManager = null;
    this.uiElements = [];
    this.goldLabel = null;
  }

  private setupBackground(): void {
    const bg = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
      width: CANVAS_WIDTH, height: CANVAS_HEIGHT, z: 0,
    });
    bg.graphics.use(new ex.Rectangle({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, color: ex.Color.fromHex('#141423') }));
    this.add(bg);
  }

  private setupUI(): void {
    // Gold display
    const goldBg = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH - 65, 25), width: 120, height: 30, z: 50,
    });
    goldBg.graphics.use(new ex.Rectangle({ width: 120, height: 30, color: ex.Color.fromRGB(0, 0, 0, 0.7) }));
    this.add(goldBg);

    this.goldLabel = new ex.Label({
      text: `Gold: ${GameState.player.gold}`,
      pos: new ex.Vector(CANVAS_WIDTH - 115, 25),
      font: new ex.Font({ size: 12, color: ex.Color.fromHex('#FBBF24') }), z: 51,
    });
    this.add(this.goldLabel);
  }

  private setupInputHandlers(): void {
    const engine = this.engine;
    if (!engine) return;

    this.inputManager = new InputManager(engine);

    this.inputManager.onKeyPress('escape', () => {
      if (!this.inputEnabled) return;
      if (!this.isProcessing) this.exitScene();
    });

    // Item navigation (up/down/w/s)
    this.inputManager.onKeyPress('up', () => {
      if (!this.inputEnabled) return;
      if (this.isProcessing) return;
      if (this.selectedItem > 0) {
        this.selectedItem--;
        this.renderUI();
      }
    });

    this.inputManager.onKeyPress('w', () => {
      if (!this.inputEnabled) return;
      if (this.isProcessing) return;
      if (this.selectedItem > 0) {
        this.selectedItem--;
        this.renderUI();
      }
    });

    this.inputManager.onKeyPress('down', () => {
      if (!this.inputEnabled) return;
      if (this.isProcessing) return;
      const items = this.getInventoryItems();
      if (this.selectedItem < items.length - 1) {
        this.selectedItem++;
        this.renderUI();
      }
    });

    this.inputManager.onKeyPress('s', () => {
      if (!this.inputEnabled) return;
      if (this.isProcessing) return;
      const items = this.getInventoryItems();
      if (this.selectedItem < items.length - 1) {
        this.selectedItem++;
        this.renderUI();
      }
    });

    // Tab navigation (left/right arrows and Q/E)
    this.inputManager.onKeyPress('left', () => {
      if (!this.inputEnabled) return;
      if (this.isProcessing) return;
      if (this.selectedTab > 0) {
        this.selectedTab--;
        this.selectedItem = 0;
        this.renderUI();
      }
    });

    this.inputManager.onKeyPress('q', () => {
      if (!this.inputEnabled) return;
      if (this.isProcessing) return;
      if (this.selectedTab > 0) {
        this.selectedTab--;
        this.selectedItem = 0;
        this.renderUI();
      }
    });

    this.inputManager.onKeyPress('right', () => {
      if (!this.inputEnabled) return;
      if (this.isProcessing) return;
      if (this.selectedTab < TABS.length - 1) {
        this.selectedTab++;
        this.selectedItem = 0;
        this.renderUI();
      }
    });

    this.inputManager.onKeyPress('e', () => {
      if (!this.inputEnabled) return;
      if (this.isProcessing) return;
      if (this.selectedTab < TABS.length - 1) {
        this.selectedTab++;
        this.selectedItem = 0;
        this.renderUI();
      }
    });

    this.inputManager.onKeyPress('u', () => {
      if (!this.inputEnabled) return;
      this.useItem();
    });
    this.inputManager.onKeyPress('enter', () => {
      if (!this.inputEnabled) return;
      this.equipItem();
    });
  }

  private getInventoryItems(): { id: string; quantity: number }[] {
    const allItems = GameState.player.items;

    switch (this.selectedTab) {
      case 0: return allItems;
      case 1: return allItems.filter(inv => getItem(inv.id)?.type === 'consumable');
      case 2: return allItems.filter(inv => getItem(inv.id)?.type === 'equipment');
      case 3: return allItems.filter(inv => {
        const item = getItem(inv.id);
        return item?.type === 'special' || item?.type === 'key';
      });
      case 4: return allItems.filter(inv => getItem(inv.id)?.type === 'decoration');
      default: return allItems;
    }
  }

  private clearUI(): void {
    for (const e of this.uiElements) e.kill();
    this.uiElements = [];
  }

  private renderUI(): void {
    if (this.isProcessing) return;
    this.clearUI();

    // Title
    const title = new ex.Label({
      text: 'INVENTORY',
      pos: new ex.Vector(CANVAS_WIDTH / 2, 30),
      font: new ex.Font({ size: 20, color: ex.Color.White }), z: 10,
    });
    title.graphics.anchor = ex.Vector.Half;
    this.add(title);
    this.uiElements.push(title);

    // Tabs
    const tabWidth = 70;
    const tabSpacing = 10;
    const startX = CANVAS_WIDTH / 2 - ((TABS.length * tabWidth + (TABS.length - 1) * tabSpacing) / 2);

    TABS.forEach((tab, i) => {
      const isSelected = i === this.selectedTab;
      const tabLabel = new ex.Label({
        text: tab,
        pos: new ex.Vector(startX + i * (tabWidth + tabSpacing) + tabWidth / 2, 60),
        font: new ex.Font({ size: 13, color: isSelected ? ex.Color.fromHex('#FBBF24') : ex.Color.fromRGB(180, 180, 180) }), z: 11,
      });
      tabLabel.graphics.anchor = ex.Vector.Half;
      this.add(tabLabel);
      this.uiElements.push(tabLabel);
    });

    // Content background
    const contentBg = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20),
      width: CANVAS_WIDTH - 40, height: CANVAS_HEIGHT - 150, z: 5,
    });
    contentBg.graphics.use(new ex.Rectangle({
      width: CANVAS_WIDTH - 40, height: CANVAS_HEIGHT - 150,
      color: ex.Color.fromHex('#1E1E32'),
      strokeColor: ex.Color.fromHex('#505078'), lineWidth: 2,
    }));
    this.add(contentBg);
    this.uiElements.push(contentBg);

    // Items
    const items = this.getInventoryItems();
    if (this.selectedItem >= items.length) {
      this.selectedItem = Math.max(0, items.length - 1);
    }

    if (items.length === 0) {
      const emptyLabel = new ex.Label({
        text: 'No items in this category',
        pos: new ex.Vector(CANVAS_WIDTH / 2, 200),
        font: new ex.Font({ size: 12, color: ex.Color.fromRGB(150, 150, 150) }), z: 10,
      });
      emptyLabel.graphics.anchor = ex.Vector.Half;
      this.add(emptyLabel);
      this.uiElements.push(emptyLabel);
    } else {
      const scrollOffset = Math.max(0, this.selectedItem - MAX_VISIBLE_ITEMS + 1);
      const visibleItems = items.slice(scrollOffset, scrollOffset + MAX_VISIBLE_ITEMS);

      visibleItems.forEach((inv, i) => {
        const item = getItem(inv.id);
        if (!item) return;

        const actualIndex = scrollOffset + i;
        const isSelected = actualIndex === this.selectedItem;
        const y = 100 + i * 28;
        const listX = 40;
        const listWidth = 280;

        // Row background
        const rowBg = new ex.Actor({
          pos: new ex.Vector(listX + listWidth / 2, y + 12),
          width: listWidth, height: 24, z: 10,
        });
        rowBg.graphics.use(new ex.Rectangle({
          width: listWidth, height: 24,
          color: isSelected ? ex.Color.fromHex('#3C3C64') : ex.Color.fromHex('#28283C'),
          strokeColor: isSelected ? ex.Color.fromHex('#FBBF24') : ex.Color.fromHex('#3C3C50'), lineWidth: 1,
        }));
        this.add(rowBg);
        this.uiElements.push(rowBg);

        // Icon
        const iconColor = item.iconColor || [100, 100, 100];
        const icon = new ex.Actor({
          pos: new ex.Vector(listX + 20, y + 12), width: 14, height: 14, z: 11,
        });
        icon.graphics.use(new ex.Rectangle({
          width: 14, height: 14,
          color: ex.Color.fromRGB(iconColor[0], iconColor[1], iconColor[2]),
          strokeColor: ex.Color.Black, lineWidth: 1,
        }));
        this.add(icon);
        this.uiElements.push(icon);

        // Name
        const nameLabel = new ex.Label({
          text: item.name,
          pos: new ex.Vector(listX + 40, y + 12),
          font: new ex.Font({ size: 12, color: ex.Color.White }), z: 11,
        });
        nameLabel.graphics.anchor = new ex.Vector(0, 0.5);
        this.add(nameLabel);
        this.uiElements.push(nameLabel);

        // Quantity
        const qtyLabel = new ex.Label({
          text: `x${inv.quantity}`,
          pos: new ex.Vector(listX + listWidth - 20, y + 12),
          font: new ex.Font({ size: 12, color: ex.Color.fromRGB(150, 200, 150) }), z: 11,
        });
        qtyLabel.graphics.anchor = new ex.Vector(1, 0.5);
        this.add(qtyLabel);
        this.uiElements.push(qtyLabel);
      });

      // Detail panel for selected item
      if (items.length > 0 && this.selectedItem < items.length) {
        const selectedInv = items[this.selectedItem];
        const selectedItemDef = getItem(selectedInv.id);
        if (selectedItemDef) {
          this.renderDetailPanel(selectedItemDef, selectedInv.id);
        }
      }
    }

    // Instructions
    const instr = new ex.Label({
      text: 'Arrows: Navigate | Q/E: Tab | U: Use | ENTER: Equip | ESC: Back',
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 20),
      font: new ex.Font({ size: 12, color: ex.Color.fromRGB(150, 150, 150) }), z: 10,
    });
    instr.graphics.anchor = ex.Vector.Half;
    this.add(instr);
    this.uiElements.push(instr);
  }

  private renderDetailPanel(item: ItemDefinition, itemId: string): void {
    const panelX = 350;
    const panelY = 100;
    const panelWidth = 230;
    const panelHeight = 230;

    const panelBg = new ex.Actor({
      pos: new ex.Vector(panelX + panelWidth / 2, panelY + panelHeight / 2),
      width: panelWidth, height: panelHeight, z: 10,
    });
    panelBg.graphics.use(new ex.Rectangle({
      width: panelWidth, height: panelHeight,
      color: ex.Color.fromHex('#19192D'),
      strokeColor: ex.Color.fromHex('#6496FF'), lineWidth: 2,
    }));
    this.add(panelBg);
    this.uiElements.push(panelBg);

    // Item name
    const nameLabel = new ex.Label({
      text: item.name,
      pos: new ex.Vector(panelX + panelWidth / 2, panelY + 20),
      font: new ex.Font({ size: 14, color: ex.Color.White }), z: 11,
    });
    nameLabel.graphics.anchor = ex.Vector.Half;
    this.add(nameLabel);
    this.uiElements.push(nameLabel);

    // Type
    const typeLabel = new ex.Label({
      text: `(${item.type.toUpperCase()})`,
      pos: new ex.Vector(panelX + panelWidth / 2, panelY + 40),
      font: new ex.Font({ size: 12, color: ex.Color.fromRGB(150, 150, 200) }), z: 11,
    });
    typeLabel.graphics.anchor = ex.Vector.Half;
    this.add(typeLabel);
    this.uiElements.push(typeLabel);

    // Description
    const descLabel = new ex.Label({
      text: item.description.substring(0, 80) + (item.description.length > 80 ? '...' : ''),
      pos: new ex.Vector(panelX + 10, panelY + 65),
      font: new ex.Font({ size: 11, color: ex.Color.fromRGB(200, 200, 200) }), z: 11,
    });
    this.add(descLabel);
    this.uiElements.push(descLabel);

    // Stats
    if (item.stats) {
      const statStrings: string[] = [];
      if (item.stats.attack) statStrings.push(`+${item.stats.attack} ATK`);
      if (item.stats.defense) statStrings.push(`+${item.stats.defense} DEF`);
      if (item.stats.luck) statStrings.push(`+${item.stats.luck} LCK`);

      if (statStrings.length > 0) {
        const statsLabel = new ex.Label({
          text: statStrings.join('  '),
          pos: new ex.Vector(panelX + 10, panelY + 120),
          font: new ex.Font({ size: 12, color: ex.Color.fromRGB(100, 255, 100) }), z: 11,
        });
        this.add(statsLabel);
        this.uiElements.push(statsLabel);
      }
    }

    // Effect
    if (item.effect) {
      let effectStr = '';
      if (item.effect.type === 'heal') effectStr = `Heals ${item.effect.value} HP`;
      else if (item.effect.type === 'mana_restore') effectStr = `Restores ${item.effect.value} MP`;

      if (effectStr) {
        const effectLabel = new ex.Label({
          text: `Effect: ${effectStr}`,
          pos: new ex.Vector(panelX + 10, panelY + 145),
          font: new ex.Font({ size: 12, color: ex.Color.fromRGB(100, 200, 255) }), z: 11,
        });
        this.add(effectLabel);
        this.uiElements.push(effectLabel);
      }
    }

    // Sell price
    const sellPrice = Math.floor(item.buyPrice / 2);
    const sellLabel = new ex.Label({
      text: `Sell: ${sellPrice}G`,
      pos: new ex.Vector(panelX + 10, panelY + panelHeight - 40),
      font: new ex.Font({ size: 12, color: ex.Color.fromHex('#FBBF24') }), z: 11,
    });
    this.add(sellLabel);
    this.uiElements.push(sellLabel);

    // Equipped status
    if (item.type === 'equipment' && item.slot) {
      const isEquipped = GameState.player.equipped[item.slot] === itemId;
      if (isEquipped) {
        const equippedLabel = new ex.Label({
          text: '* EQUIPPED *',
          pos: new ex.Vector(panelX + panelWidth / 2, panelY + panelHeight - 20),
          font: new ex.Font({ size: 13, color: ex.Color.fromRGB(100, 255, 100) }), z: 11,
        });
        equippedLabel.graphics.anchor = ex.Vector.Half;
        this.add(equippedLabel);
        this.uiElements.push(equippedLabel);
      }
    }
  }

  private useItem(): void {
    if (this.isProcessing) return;

    const items = this.getInventoryItems();
    if (items.length === 0 || this.selectedItem >= items.length) {
      this.showMessage('No item selected!', [255, 100, 100]);
      return;
    }

    const inv = items[this.selectedItem];
    const item = getItem(inv.id);
    if (!item || item.type !== 'consumable') {
      this.showMessage('Cannot use this item here!', [255, 100, 100]);
      return;
    }

    if (item.effect?.type === 'heal') {
      if (GameState.player.health >= GameState.getEffectiveMaxHealth()) {
        this.showMessage('HP already full!', [255, 200, 100]);
        return;
      }

      this.isProcessing = true;
      GameState.removeItem(inv.id, 1);
      const healAmount = item.effect.value;
      const oldHp = GameState.player.health;
      GameState.player.health = Math.min(GameState.player.health + healAmount, GameState.getEffectiveMaxHealth());
      const actualHeal = GameState.player.health - oldHp;
      this.showMessage(`Healed ${actualHeal} HP!`, [100, 255, 100]);

      setTimeout(() => {
        this.isProcessing = false;
        this.renderUI();
      }, 100);
      return;
    }

    if (item.effect?.type === 'mana_restore') {
      if (GameState.player.mana >= GameState.getEffectiveMaxMana()) {
        this.showMessage('MP already full!', [255, 200, 100]);
        return;
      }

      this.isProcessing = true;
      GameState.removeItem(inv.id, 1);
      const actualRestore = GameState.restoreMana(item.effect.value);
      this.showMessage(`Restored ${actualRestore} MP!`, [100, 200, 255]);

      setTimeout(() => {
        this.isProcessing = false;
        this.renderUI();
      }, 100);
      return;
    }

    this.showMessage('Cannot use this item here!', [255, 100, 100]);
  }

  private equipItem(): void {
    if (this.isProcessing) return;

    const items = this.getInventoryItems();
    if (items.length === 0 || this.selectedItem >= items.length) {
      this.showMessage('No item selected!', [255, 100, 100]);
      return;
    }

    const inv = items[this.selectedItem];
    const item = getItem(inv.id);
    if (!item || item.type !== 'equipment' || !item.slot) {
      this.showMessage('Cannot equip this item!', [255, 100, 100]);
      return;
    }

    this.isProcessing = true;

    if (GameState.player.equipped[item.slot] === inv.id) {
      GameState.unequipItem(item.slot);
      this.showMessage(`Unequipped ${item.name}!`, [255, 200, 100]);
    } else {
      const success = GameState.equipItem(inv.id);
      if (success) {
        this.showMessage(`Equipped ${item.name}!`, [100, 255, 100]);
      } else {
        this.showMessage('Failed to equip!', [255, 100, 100]);
      }
    }

    setTimeout(() => {
      this.isProcessing = false;
      this.renderUI();
    }, 100);
  }

  private showMessage(text: string, color: [number, number, number] = [255, 255, 255]): void {
    // Determine toast type based on color
    let type: 'default' | 'success' | 'error' | 'warning' = 'default';
    if (color[1] > 200 && color[0] < 150 && color[2] < 150) {
      type = 'success'; // Green-ish
    } else if (color[0] > 200 && color[1] < 150 && color[2] < 150) {
      type = 'error'; // Red-ish
    } else if (color[0] > 200 && color[1] > 150 && color[2] < 150) {
      type = 'warning'; // Yellow-ish
    }

    this.messageToast?.show(text, { type, duration: 1500, position: 'center' });
  }

  /**
   * Setup HTML overlay components
   */
  private setupOverlays(): void {
    const canvas = this.engine.canvas;
    const container = canvas.parentElement;

    if (!container) {
      console.warn('InventoryScene: Could not find canvas container for overlays');
      return;
    }

    // Ensure container has relative positioning for absolute overlays
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    // Create message toast
    this.messageToast = new MessageToast(container);
  }

  private exitScene(): void {
    const fromScene = this.sceneData.fromScene || 'town';
    if (this.onExit) {
      if (fromScene === 'dungeon' && this.sceneData.dungeonReturnData) {
        this.onExit('dungeon', this.sceneData.dungeonReturnData);
      } else {
        this.onExit(fromScene);
      }
    }
  }
}
