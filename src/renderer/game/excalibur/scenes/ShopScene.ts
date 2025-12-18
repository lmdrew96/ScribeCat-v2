/**
 * ExcaliburShopScene
 *
 * Shop scene with 7 tabs: Items, Weapons, Armor, Special, Decor, Equip, Sell
 * Players can buy items, equipment, manage gear.
 * Uses background images and NPC sprites.
 */

import * as ex from 'excalibur';
import { GameState } from '../../state/GameState.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_SPEED } from '../../config.js';
import { loadCatAnimation, type CatColor, type CatAnimationType } from '../adapters/SpriteAdapter.js';
import { InputManager } from '../adapters/InputAdapter.js';
import { getItem, getShopItemsForTier, getUnlockedTier, type ItemDefinition, type EquipmentSlot } from '../../data/items.js';
import { loadBackground, createBackgroundActor } from '../../loaders/BackgroundLoader.js';
import { createNPCActor } from '../../loaders/NPCSpriteLoader.js';
import { AudioManager } from '../../audio/AudioManager.js';
import { MAX_VISIBLE_ITEMS } from '../ui/UIConstants.js';

export interface ShopSceneData {
  catColor?: CatColor;
  fromScene?: string;
}

const TABS = ['Items', 'Weapons', 'Armor', 'Special', 'Decor', 'Equip', 'Sell'];

/**
 * Player Actor for Shop scene
 */
class PlayerActor extends ex.Actor {
  private catColor: CatColor;
  private animations: Map<CatAnimationType, ex.Animation> = new Map();
  private inputManager: InputManager | null = null;
  private frozen = false;

  constructor(config: { x: number; y: number; catColor: CatColor }) {
    super({
      pos: new ex.Vector(config.x, config.y),
      width: 32,
      height: 32,
      anchor: ex.Vector.Half,
      z: 10,
    });
    this.catColor = config.catColor;
  }

  async onInitialize(engine: ex.Engine): Promise<void> {
    this.inputManager = new InputManager(engine);
    try {
      const idleAnim = await loadCatAnimation(this.catColor, 'idle');
      const walkAnim = await loadCatAnimation(this.catColor, 'walk');
      this.animations.set('idle', idleAnim);
      this.animations.set('walk', walkAnim);
      this.graphics.use(idleAnim);
    } catch (err) {
      this.graphics.use(new ex.Rectangle({ width: 32, height: 32, color: ex.Color.Gray }));
    }
  }

  onPreUpdate(engine: ex.Engine, delta: number): void {
    if (!this.inputManager || this.frozen) {
      this.vel = ex.Vector.Zero;
      return;
    }
    const movement = this.inputManager.getMovementVector();
    this.vel = movement.scale(PLAYER_SPEED);

    // Bounds
    const nextX = this.pos.x + this.vel.x * (delta / 1000);
    const nextY = this.pos.y + this.vel.y * (delta / 1000);
    if (nextX < 30 || nextX > CANVAS_WIDTH - 30) this.vel.x = 0;
    if (nextY < 200 || nextY > CANVAS_HEIGHT - 60) this.vel.y = 0;

    // Animation
    const isMoving = movement.x !== 0 || movement.y !== 0;
    const anim = isMoving ? 'walk' : 'idle';
    if (this.animations.has(anim)) this.graphics.use(this.animations.get(anim)!);
    if (movement.x < 0) this.graphics.flipHorizontal = true;
    else if (movement.x > 0) this.graphics.flipHorizontal = false;
  }

  getInputManager(): InputManager | null { return this.inputManager; }
  freeze(): void { this.frozen = true; this.vel = ex.Vector.Zero; }
  unfreeze(): void { this.frozen = false; }

  onPreKill(): void {
    // Clean up input manager to remove engine-level event listeners
    this.inputManager?.destroy();
    this.inputManager = null;
  }
}

/**
 * Main Shop Scene
 */
export class ShopScene extends ex.Scene {
  private player: PlayerActor | null = null;
  private sceneData: ShopSceneData = {};

  // Shop state
  private shopOpen = false;
  private shopInputEnabled = false; // Separate cooldown for shop UI
  private lastNavTime = 0; // Debounce for navigation to prevent double-presses
  private selectedTab = 0;
  private selectedItem = 0;
  private scrollOffset = 0;
  private isProcessing = false;

  // Input cooldown to prevent key events carrying over from scene transitions
  private inputEnabled = false;

  /**
   * Debounce navigation to prevent double-presses from duplicate key events.
   * Returns true if navigation should proceed, false if it should be blocked.
   */
  private canNavigate(debounceMs = 80): boolean {
    const now = Date.now();
    if (now - this.lastNavTime < debounceMs) return false;
    this.lastNavTime = now;
    return true;
  }

  // UI elements
  private shopUIElements: ex.Actor[] = [];
  private messageElements: ex.Actor[] = [];
  private goldLabel: ex.Label | null = null;

  // Callbacks
  public onExitToTown: (() => void) | null = null;

  onActivate(ctx: ex.SceneActivationContext<ShopSceneData>): void {
    this.sceneData = ctx.data || {};
    const catColor = this.sceneData.catColor || GameState.player.catColor;

    this.shopOpen = false;
    this.selectedTab = 0;
    this.selectedItem = 0;
    this.scrollOffset = 0;

    // Disable input briefly to prevent key events from previous scene
    this.inputEnabled = false;
    setTimeout(() => { this.inputEnabled = true; }, 200);

    this.clear();
    this.setupBackground();
    this.setupShopkeeper();
    this.setupDoor();
    this.setupPlayer(catColor);
    this.setupUI();
    this.setupInputHandlers();

    console.log('=== StudyQuest Shop (Excalibur) ===');
  }

  onDeactivate(): void {
    // Reset input state to prevent stale handlers from firing
    this.inputEnabled = false;

    this.player = null;
    this.shopUIElements = [];
    this.messageElements = [];
    this.goldLabel = null;
  }

  private async setupBackground(): Promise<void> {
    // Try to load the general store background
    const bgImage = await loadBackground('generalStore');

    if (bgImage) {
      const bgActor = createBackgroundActor(bgImage, CANVAS_WIDTH, CANVAS_HEIGHT, 0);
      this.add(bgActor);
    } else {
      // Fallback to solid colors
      const bg = new ex.Actor({
        pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
        width: CANVAS_WIDTH, height: CANVAS_HEIGHT, z: 0,
      });
      bg.graphics.use(new ex.Rectangle({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, color: ex.Color.fromHex('#654321') }));
      this.add(bg);

      // Wall
      const wall = new ex.Actor({
        pos: new ex.Vector(CANVAS_WIDTH / 2, 90), width: CANVAS_WIDTH, height: 180, z: 1,
      });
      wall.graphics.use(new ex.Rectangle({ width: CANVAS_WIDTH, height: 180, color: ex.Color.fromHex('#4682B4') }));
      this.add(wall);
    }

    // Counter
    const counter = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, 230), width: 400, height: 60, z: 5,
    });
    counter.graphics.use(new ex.Rectangle({ width: 400, height: 60, color: ex.Color.fromHex('#8B4513'), strokeColor: ex.Color.Black, lineWidth: 3 }));
    this.add(counter);

    // Play shop music
    AudioManager.playSceneMusic('shop');
  }

  private async setupShopkeeper(): Promise<void> {
    const shopkeeper = await createNPCActor('shopkeeper', CANVAS_WIDTH / 2, 170, 60, 6);
    this.add(shopkeeper);

    const label = new ex.Label({
      text: 'Shopkeeper', pos: new ex.Vector(CANVAS_WIDTH / 2, 130),
      font: new ex.Font({ size: 13, color: ex.Color.White }), z: 10,
    });
    label.graphics.anchor = ex.Vector.Half;
    this.add(label);
  }

  private setupDoor(): void {
    const door = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30),
      width: 50, height: 40, z: 3,
    });
    door.graphics.use(new ex.Rectangle({ width: 50, height: 40, color: ex.Color.fromHex('#654321'), strokeColor: ex.Color.Black, lineWidth: 2 }));
    this.add(door);

    const exitLabel = new ex.Label({
      text: 'Exit', pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 10),
      font: new ex.Font({ size: 13, color: ex.Color.White }), z: 10,
    });
    exitLabel.graphics.anchor = ex.Vector.Half;
    this.add(exitLabel);
  }

  private setupPlayer(catColor: CatColor): void {
    this.player = new PlayerActor({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 120, catColor });
    this.add(this.player);
  }

  private setupUI(): void {
    // Gold display
    const goldBg = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH - 60, 25), width: 100, height: 30, z: 50,
    });
    goldBg.graphics.use(new ex.Rectangle({ width: 100, height: 30, color: ex.Color.fromRGB(0, 0, 0, 0.6) }));
    this.add(goldBg);

    this.goldLabel = new ex.Label({
      text: `Gold: ${GameState.player.gold}`,
      pos: new ex.Vector(CANVAS_WIDTH - 100, 25),
      font: new ex.Font({ size: 12, color: ex.Color.fromHex('#FBBF24') }), z: 51,
    });
    this.add(this.goldLabel);

    // Scene label
    const sceneLabel = new ex.Label({
      text: 'Shop', pos: new ex.Vector(20, 20),
      font: new ex.Font({ size: 16, color: ex.Color.White }), z: 50,
    });
    this.add(sceneLabel);

    // Controls hint
    const controls = new ex.Label({
      text: 'Arrow/WASD: Move | ENTER: Browse | ESC: Back',
      pos: new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 15),
      font: new ex.Font({ size: 12, color: ex.Color.fromRGB(200, 200, 200) }), z: 50,
    });
    controls.graphics.anchor = ex.Vector.Half;
    this.add(controls);
  }

  private setupInputHandlers(): void {
    const checkPlayer = () => {
      if (this.player?.getInputManager()) {
        const input = this.player.getInputManager()!;

        input.onKeyPress('enter', () => {
          if (!this.inputEnabled) return;
          if (this.shopOpen) {
            if (!this.shopInputEnabled || this.isProcessing) return;
            this.purchaseItem();
          } else {
            this.checkShopkeeperInteraction();
          }
        });

        input.onKeyPress('space', () => {
          if (!this.inputEnabled) return;
          if (!this.shopOpen) this.checkShopkeeperInteraction();
        });

        input.onKeyPress('escape', () => {
          if (!this.inputEnabled) return;
          if (this.shopOpen) this.closeShop();
          else this.exitToTown();
        });

        // Item navigation (up/down/w/s) - with debounce to prevent double-firing
        input.onKeyPress('up', () => {
          if (!this.inputEnabled || !this.shopInputEnabled) return;
          if (!this.canNavigate()) return;
          if (this.shopOpen && !this.isProcessing && this.selectedItem > 0) {
            this.selectedItem--;
            this.updateScrollOffset();
            this.renderShopUI();
          }
        });

        input.onKeyPress('w', () => {
          if (!this.inputEnabled || !this.shopInputEnabled) return;
          if (!this.canNavigate()) return;
          if (this.shopOpen && !this.isProcessing && this.selectedItem > 0) {
            this.selectedItem--;
            this.updateScrollOffset();
            this.renderShopUI();
          }
        });

        input.onKeyPress('down', () => {
          if (!this.inputEnabled || !this.shopInputEnabled) return;
          if (!this.canNavigate()) return;
          if (this.shopOpen && !this.isProcessing) {
            const items = this.getTabItems();
            if (this.selectedItem < items.length - 1) {
              this.selectedItem++;
              this.updateScrollOffset();
              this.renderShopUI();
            }
          }
        });

        input.onKeyPress('s', () => {
          if (!this.inputEnabled || !this.shopInputEnabled) return;
          if (!this.canNavigate()) return;
          if (this.shopOpen && !this.isProcessing) {
            const items = this.getTabItems();
            if (this.selectedItem < items.length - 1) {
              this.selectedItem++;
              this.updateScrollOffset();
              this.renderShopUI();
            }
          }
        });

        // Tab navigation (left/right arrows and Q/E) - with debounce
        input.onKeyPress('left', () => {
          if (!this.inputEnabled || !this.shopInputEnabled) return;
          if (!this.canNavigate()) return;
          if (this.shopOpen && !this.isProcessing && this.selectedTab > 0) {
            this.selectedTab--;
            this.selectedItem = 0;
            this.scrollOffset = 0;
            this.renderShopUI();
          }
        });

        input.onKeyPress('q', () => {
          if (!this.inputEnabled || !this.shopInputEnabled) return;
          if (!this.canNavigate()) return;
          if (this.shopOpen && !this.isProcessing && this.selectedTab > 0) {
            this.selectedTab--;
            this.selectedItem = 0;
            this.scrollOffset = 0;
            this.renderShopUI();
          }
        });

        input.onKeyPress('right', () => {
          if (!this.inputEnabled || !this.shopInputEnabled) return;
          if (!this.canNavigate()) return;
          if (this.shopOpen && !this.isProcessing && this.selectedTab < TABS.length - 1) {
            this.selectedTab++;
            this.selectedItem = 0;
            this.scrollOffset = 0;
            this.renderShopUI();
          }
        });

        input.onKeyPress('e', () => {
          if (!this.inputEnabled || !this.shopInputEnabled) return;
          if (!this.canNavigate()) return;
          if (this.shopOpen && !this.isProcessing && this.selectedTab < TABS.length - 1) {
            this.selectedTab++;
            this.selectedItem = 0;
            this.scrollOffset = 0;
            this.renderShopUI();
          }
        });

        input.onKeyPress('u', () => {
          if (!this.inputEnabled || !this.shopInputEnabled) return;
          if (this.shopOpen && this.selectedTab === 5 && !this.isProcessing) {
            this.unequipSlot();
          }
        });
      } else {
        setTimeout(checkPlayer, 100);
      }
    };
    checkPlayer();
  }

  private checkShopkeeperInteraction(): void {
    if (!this.player) return;
    const shopkeeperPos = new ex.Vector(CANVAS_WIDTH / 2, 170);
    const dist = this.player.pos.distance(shopkeeperPos);
    if (dist < 100) this.openShop();

    // Check door
    const doorPos = new ex.Vector(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30);
    if (this.player.pos.distance(doorPos) < 60) this.exitToTown();
  }

  private openShop(): void {
    if (this.shopOpen) return;
    this.shopOpen = true;
    this.shopInputEnabled = false; // Disable shop input briefly to prevent immediate actions
    setTimeout(() => { this.shopInputEnabled = true; }, 150);
    this.player?.freeze();
    this.selectedTab = 0;
    this.selectedItem = 0;
    this.scrollOffset = 0;
    this.renderShopUI();
  }

  private closeShop(): void {
    this.shopOpen = false;
    this.player?.unfreeze();
    this.clearShopUI();
    this.clearMessages();
  }

  private clearShopUI(): void {
    for (const e of this.shopUIElements) e.kill();
    this.shopUIElements = [];
  }

  private clearMessages(): void {
    for (const e of this.messageElements) e.kill();
    this.messageElements = [];
  }

  private getTabItems(): string[] {
    const tier = getUnlockedTier(GameState.player.level);
    const shopItems = getShopItemsForTier(tier);
    switch (this.selectedTab) {
      case 0: return shopItems.consumables;
      case 1: return shopItems.weapons;
      case 2: return shopItems.armor;
      case 3: return shopItems.special;
      case 4: return shopItems.decorations;
      case 5: return this.getPlayerEquipment().map(e => e.id);
      case 6: return this.getSellableItems().map(s => s.id);
      default: return [];
    }
  }

  private getPlayerEquipment(): { id: string; slot: EquipmentSlot }[] {
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

  private getSellableItems(): { id: string; quantity: number; item: ItemDefinition }[] {
    const sellable: { id: string; quantity: number; item: ItemDefinition }[] = [];
    for (const invItem of GameState.player.items) {
      const item = getItem(invItem.id);
      if (item && item.sellPrice > 0) {
        sellable.push({ id: invItem.id, quantity: invItem.quantity, item });
      }
    }
    return sellable;
  }

  private updateScrollOffset(): void {
    const items = this.getTabItems();
    if (this.selectedItem < this.scrollOffset) {
      this.scrollOffset = this.selectedItem;
    } else if (this.selectedItem >= this.scrollOffset + MAX_VISIBLE_ITEMS) {
      this.scrollOffset = this.selectedItem - MAX_VISIBLE_ITEMS + 1;
    }
    this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, Math.max(0, items.length - MAX_VISIBLE_ITEMS)));
  }

  private renderShopUI(): void {
    this.clearShopUI();

    const modalX = CANVAS_WIDTH / 2;
    const modalY = CANVAS_HEIGHT / 2 - 20;
    const modalWidth = 420;
    const modalHeight = 300;

    // Background
    const bg = new ex.Actor({
      pos: new ex.Vector(modalX, modalY),
      width: modalWidth, height: modalHeight, z: 100,
    });
    bg.graphics.use(new ex.Rectangle({
      width: modalWidth, height: modalHeight,
      color: ex.Color.fromHex('#1E1E32'),
      strokeColor: ex.Color.fromHex('#6496FF'), lineWidth: 3,
    }));
    this.add(bg);
    this.shopUIElements.push(bg);

    // Title
    const tier = getUnlockedTier(GameState.player.level);
    const titleText = this.selectedTab === 5 ? 'Equipment Manager' : `Shop (Tier ${tier} Unlocked)`;
    const title = new ex.Label({
      text: titleText,
      pos: new ex.Vector(modalX, modalY - modalHeight / 2 + 20),
      font: new ex.Font({ size: 14, color: ex.Color.White }), z: 101,
    });
    title.graphics.anchor = ex.Vector.Half;
    this.add(title);
    this.shopUIElements.push(title);

    // Tabs
    const tabWidth = 50;
    const tabStartX = modalX - (TABS.length * tabWidth) / 2 + tabWidth / 2;
    TABS.forEach((tab, i) => {
      const isSelected = i === this.selectedTab;
      const tabLabel = new ex.Label({
        text: tab.substring(0, 5),
        pos: new ex.Vector(tabStartX + i * tabWidth, modalY - modalHeight / 2 + 45),
        font: new ex.Font({ size: 11, color: isSelected ? ex.Color.fromHex('#FBBF24') : ex.Color.fromRGB(180, 180, 180) }), z: 102,
      });
      tabLabel.graphics.anchor = ex.Vector.Half;
      this.add(tabLabel);
      this.shopUIElements.push(tabLabel);
    });

    // Items
    const items = this.getTabItems();
    if (this.selectedItem >= items.length) this.selectedItem = Math.max(0, items.length - 1);

    if (items.length === 0) {
      const emptyLabel = new ex.Label({
        text: 'No items available',
        pos: new ex.Vector(modalX, modalY),
        font: new ex.Font({ size: 13, color: ex.Color.fromRGB(150, 150, 150) }), z: 102,
      });
      emptyLabel.graphics.anchor = ex.Vector.Half;
      this.add(emptyLabel);
      this.shopUIElements.push(emptyLabel);
    } else {
      const visibleItems = items.slice(this.scrollOffset, this.scrollOffset + MAX_VISIBLE_ITEMS);
      visibleItems.forEach((itemId, i) => {
        const item = getItem(itemId);
        if (!item) return;

        const actualIndex = this.scrollOffset + i;
        const isSelected = actualIndex === this.selectedItem;
        const y = modalY - modalHeight / 2 + 70 + i * 28;

        // Row background
        const rowBg = new ex.Actor({
          pos: new ex.Vector(modalX, y + 12),
          width: modalWidth - 20, height: 24, z: 101,
        });
        rowBg.graphics.use(new ex.Rectangle({
          width: modalWidth - 20, height: 24,
          color: isSelected ? ex.Color.fromHex('#3C3C64') : ex.Color.fromHex('#28283C'),
          strokeColor: isSelected ? ex.Color.fromHex('#FBBF24') : ex.Color.fromHex('#505078'), lineWidth: 1,
        }));
        this.add(rowBg);
        this.shopUIElements.push(rowBg);

        // Item name
        const nameLabel = new ex.Label({
          text: item.name,
          pos: new ex.Vector(modalX - modalWidth / 2 + 30, y + 12),
          font: new ex.Font({ size: 12, color: ex.Color.White }), z: 102,
        });
        nameLabel.graphics.anchor = new ex.Vector(0, 0.5);
        this.add(nameLabel);
        this.shopUIElements.push(nameLabel);

        // Price (or sell price)
        const price = this.selectedTab === 6 ? item.sellPrice : item.buyPrice;
        const priceLabel = new ex.Label({
          text: `${price}G`,
          pos: new ex.Vector(modalX + modalWidth / 2 - 30, y + 12),
          font: new ex.Font({ size: 12, color: ex.Color.fromHex('#FBBF24') }), z: 102,
        });
        priceLabel.graphics.anchor = new ex.Vector(1, 0.5);
        this.add(priceLabel);
        this.shopUIElements.push(priceLabel);

        // Owned count
        const owned = GameState.getItemCount(itemId);
        if (owned > 0 && this.selectedTab < 5) {
          const ownedLabel = new ex.Label({
            text: `x${owned}`,
            pos: new ex.Vector(modalX + modalWidth / 2 - 70, y + 12),
            font: new ex.Font({ size: 12, color: ex.Color.fromRGB(150, 200, 150) }), z: 102,
          });
          ownedLabel.graphics.anchor = new ex.Vector(1, 0.5);
          this.add(ownedLabel);
          this.shopUIElements.push(ownedLabel);
        }
      });

      // Description for selected item
      if (items.length > 0 && this.selectedItem < items.length) {
        const selectedItemDef = getItem(items[this.selectedItem]);
        if (selectedItemDef) {
          const descLabel = new ex.Label({
            text: selectedItemDef.description.substring(0, 60) + (selectedItemDef.description.length > 60 ? '...' : ''),
            pos: new ex.Vector(modalX, modalY + modalHeight / 2 - 50),
            font: new ex.Font({ size: 11, color: ex.Color.fromRGB(200, 200, 200) }), z: 102,
          });
          descLabel.graphics.anchor = ex.Vector.Half;
          this.add(descLabel);
          this.shopUIElements.push(descLabel);
        }
      }
    }

    // Instructions
    const instrText = this.selectedTab === 5
      ? 'Up/Down: Select | ENTER: Equip | U: Unequip | Q/E: Tab | ESC: Close'
      : this.selectedTab === 6
      ? 'Up/Down: Select | ENTER: Sell | Q/E: Tab | ESC: Close'
      : 'Up/Down: Select | ENTER: Buy | Q/E: Tab | ESC: Close';
    const instr = new ex.Label({
      text: instrText,
      pos: new ex.Vector(modalX, modalY + modalHeight / 2 - 15),
      font: new ex.Font({ size: 11, color: ex.Color.fromRGB(150, 150, 150) }), z: 101,
    });
    instr.graphics.anchor = ex.Vector.Half;
    this.add(instr);
    this.shopUIElements.push(instr);
  }

  private purchaseItem(): void {
    if (this.isProcessing) return;

    if (this.selectedTab === 5) {
      this.equipSelectedItem();
      return;
    }

    if (this.selectedTab === 6) {
      this.sellItem();
      return;
    }

    const items = this.getTabItems();
    if (items.length === 0 || this.selectedItem >= items.length) {
      this.showMessage('No item selected!');
      return;
    }

    const itemId = items[this.selectedItem];
    const item = getItem(itemId);
    if (!item) return;

    if (GameState.player.gold < item.buyPrice) {
      this.showMessage('Not enough gold!');
      return;
    }

    this.isProcessing = true;
    GameState.spendGold(item.buyPrice);
    GameState.addItem(itemId, 1);
    this.updateGoldDisplay();
    this.showMessage(`Purchased ${item.name}!`);

    if (GameState.isCloudSyncEnabled()) {
      GameState.saveToCloud().catch(err => console.warn('Autosave failed:', err));
    }

    setTimeout(() => {
      this.isProcessing = false;
      if (this.shopOpen) this.renderShopUI();
    }, 100);
  }

  private equipSelectedItem(): void {
    if (this.isProcessing) return;

    const equipment = this.getPlayerEquipment();
    if (equipment.length === 0 || this.selectedItem >= equipment.length) {
      this.showMessage('No item selected!');
      return;
    }

    this.isProcessing = true;
    const eq = equipment[this.selectedItem];
    const success = GameState.equipItem(eq.id);

    if (success) {
      const item = getItem(eq.id);
      this.showMessage(`Equipped ${item?.name || 'item'}!`);
      this.selectedItem = 0;
    } else {
      this.showMessage('Failed to equip!');
    }

    setTimeout(() => {
      this.isProcessing = false;
      if (this.shopOpen) this.renderShopUI();
    }, 100);
  }

  private sellItem(): void {
    if (this.isProcessing) return;

    const sellable = this.getSellableItems();
    if (sellable.length === 0 || this.selectedItem >= sellable.length) {
      this.showMessage('No item selected!');
      return;
    }

    const sellData = sellable[this.selectedItem];
    const equipped = GameState.player.equipped;
    if (equipped.weapon === sellData.id || equipped.armor === sellData.id || equipped.accessory === sellData.id) {
      this.showMessage('Unequip item first!');
      return;
    }

    this.isProcessing = true;
    GameState.removeItem(sellData.id, 1);
    GameState.addGold(sellData.item.sellPrice);
    this.updateGoldDisplay();
    this.showMessage(`Sold ${sellData.item.name} for ${sellData.item.sellPrice}G!`);

    const updated = this.getSellableItems();
    if (this.selectedItem >= updated.length) {
      this.selectedItem = Math.max(0, updated.length - 1);
    }

    setTimeout(() => {
      this.isProcessing = false;
      if (this.shopOpen) this.renderShopUI();
    }, 100);
  }

  private unequipSlot(): void {
    if (this.isProcessing) return;

    // Get the currently selected equipment item
    const equipment = this.getPlayerEquipment();
    if (equipment.length === 0 || this.selectedItem >= equipment.length) {
      this.showMessage('No item selected!');
      return;
    }

    const selectedEquip = equipment[this.selectedItem];
    const item = getItem(selectedEquip.id);

    // Check if this specific item is currently equipped in its slot
    if (GameState.player.equipped[selectedEquip.slot] === selectedEquip.id) {
      this.isProcessing = true;
      GameState.unequipItem(selectedEquip.slot);
      this.showMessage(`Unequipped ${item?.name || selectedEquip.slot}!`);

      // Adjust selection if needed
      const updatedEquipment = this.getPlayerEquipment();
      if (this.selectedItem >= updatedEquipment.length) {
        this.selectedItem = Math.max(0, updatedEquipment.length - 1);
      }

      setTimeout(() => {
        this.isProcessing = false;
        if (this.shopOpen) this.renderShopUI();
      }, 100);
    } else {
      this.showMessage('Item not equipped!');
    }
  }

  private showMessage(text: string): void {
    this.clearMessages();

    const msgBg = new ex.Actor({
      pos: new ex.Vector(CANVAS_WIDTH / 2, 50), width: 300, height: 40, z: 300,
    });
    msgBg.graphics.use(new ex.Rectangle({ width: 300, height: 40, color: ex.Color.fromRGB(0, 0, 0, 0.9) }));
    this.add(msgBg);
    this.messageElements.push(msgBg);

    const msgLabel = new ex.Label({
      text, pos: new ex.Vector(CANVAS_WIDTH / 2, 50),
      font: new ex.Font({ size: 12, color: ex.Color.White }), z: 301,
    });
    msgLabel.graphics.anchor = ex.Vector.Half;
    this.add(msgLabel);
    this.messageElements.push(msgLabel);

    setTimeout(() => this.clearMessages(), 1500);
  }

  private updateGoldDisplay(): void {
    if (this.goldLabel) this.goldLabel.text = `Gold: ${GameState.player.gold}`;
  }

  private exitToTown(): void {
    if (this.onExitToTown) this.onExitToTown();
  }
}
