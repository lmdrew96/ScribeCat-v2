/**
 * StudyQuestItem Entity
 *
 * Represents items in the StudyQuest RPG: weapons, armor, accessories, consumables, and key items.
 */

export type ItemType = 'weapon' | 'armor' | 'accessory' | 'consumable' | 'key_item';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type EffectType = 'heal' | 'damage' | 'buff_attack' | 'buff_defense' | 'buff_speed' | 'cure_status';

export interface StudyQuestItemData {
  readonly id: string;
  readonly itemKey: string;
  readonly name: string;
  readonly description?: string;
  readonly itemType: ItemType;
  readonly rarity: ItemRarity;
  readonly tier: number;
  readonly attackBonus: number;
  readonly defenseBonus: number;
  readonly speedBonus: number;
  readonly hpBonus: number;
  readonly effectType?: EffectType;
  readonly effectValue: number;
  readonly buyPrice?: number;
  readonly sellPrice?: number;
  readonly requiredLevel: number;
  readonly spriteKey?: string;
  readonly isPurchasable: boolean;
  readonly createdAt: Date;
}

/**
 * StudyQuestItem domain entity
 */
export class StudyQuestItem {
  constructor(private readonly data: StudyQuestItemData) {}

  /**
   * Create StudyQuestItem from database row
   */
  static fromDatabase(row: {
    id: string;
    item_key: string;
    name: string;
    description?: string | null;
    item_type: string;
    rarity: string;
    tier: number;
    attack_bonus: number;
    defense_bonus: number;
    speed_bonus: number;
    hp_bonus: number;
    effect_type?: string | null;
    effect_value: number;
    buy_price?: number | null;
    sell_price?: number | null;
    required_level: number;
    sprite_key?: string | null;
    is_purchasable: boolean;
    created_at: string | Date;
  }): StudyQuestItem {
    return new StudyQuestItem({
      id: row.id,
      itemKey: row.item_key,
      name: row.name,
      description: row.description ?? undefined,
      itemType: row.item_type as ItemType,
      rarity: row.rarity as ItemRarity,
      tier: row.tier,
      attackBonus: row.attack_bonus,
      defenseBonus: row.defense_bonus,
      speedBonus: row.speed_bonus,
      hpBonus: row.hp_bonus,
      effectType: row.effect_type as EffectType | undefined,
      effectValue: row.effect_value,
      buyPrice: row.buy_price ?? undefined,
      sellPrice: row.sell_price ?? undefined,
      requiredLevel: row.required_level,
      spriteKey: row.sprite_key ?? undefined,
      isPurchasable: row.is_purchasable,
      createdAt: new Date(row.created_at),
    });
  }

  // Getters
  get id(): string {
    return this.data.id;
  }
  get itemKey(): string {
    return this.data.itemKey;
  }
  get name(): string {
    return this.data.name;
  }
  get description(): string | undefined {
    return this.data.description;
  }
  get itemType(): ItemType {
    return this.data.itemType;
  }
  get rarity(): ItemRarity {
    return this.data.rarity;
  }
  get tier(): number {
    return this.data.tier;
  }
  get attackBonus(): number {
    return this.data.attackBonus;
  }
  get defenseBonus(): number {
    return this.data.defenseBonus;
  }
  get speedBonus(): number {
    return this.data.speedBonus;
  }
  get hpBonus(): number {
    return this.data.hpBonus;
  }
  get effectType(): EffectType | undefined {
    return this.data.effectType;
  }
  get effectValue(): number {
    return this.data.effectValue;
  }
  get buyPrice(): number | undefined {
    return this.data.buyPrice;
  }
  get sellPrice(): number | undefined {
    return this.data.sellPrice;
  }
  get requiredLevel(): number {
    return this.data.requiredLevel;
  }
  get spriteKey(): string | undefined {
    return this.data.spriteKey;
  }
  get isPurchasable(): boolean {
    return this.data.isPurchasable;
  }
  get createdAt(): Date {
    return this.data.createdAt;
  }

  /**
   * Check if this is an equippable item
   */
  get isEquippable(): boolean {
    return ['weapon', 'armor', 'accessory'].includes(this.itemType);
  }

  /**
   * Check if this is a consumable
   */
  get isConsumable(): boolean {
    return this.itemType === 'consumable';
  }

  /**
   * Get total stat bonus for display
   */
  get totalStatBonus(): number {
    return this.attackBonus + this.defenseBonus + this.speedBonus + this.hpBonus;
  }

  /**
   * Get rarity color for UI
   */
  get rarityColor(): string {
    const colors: Record<ItemRarity, string> = {
      common: '#9ca3af',
      uncommon: '#22c55e',
      rare: '#3b82f6',
      epic: '#a855f7',
      legendary: '#f59e0b',
    };
    return colors[this.rarity];
  }

  /**
   * Get formatted stats string for display
   */
  get statsDisplay(): string {
    const stats: string[] = [];
    if (this.attackBonus > 0) stats.push(`+${this.attackBonus} ATK`);
    if (this.defenseBonus > 0) stats.push(`+${this.defenseBonus} DEF`);
    if (this.speedBonus > 0) stats.push(`+${this.speedBonus} SPD`);
    if (this.hpBonus > 0) stats.push(`+${this.hpBonus} HP`);
    return stats.join(', ') || 'No stat bonuses';
  }

  /**
   * Convert to JSON for IPC transport
   */
  toJSON(): StudyQuestItemData {
    return { ...this.data };
  }
}

/**
 * Inventory slot with item and quantity
 */
export interface InventorySlot {
  readonly id: string;
  readonly characterId: string;
  readonly item: StudyQuestItem;
  readonly quantity: number;
  readonly acquiredAt: Date;
}

/**
 * Create InventorySlot from database row with joined item
 */
export function createInventorySlot(row: {
  id: string;
  character_id: string;
  quantity: number;
  acquired_at: string | Date;
  item: {
    id: string;
    item_key: string;
    name: string;
    description?: string | null;
    item_type: string;
    rarity: string;
    tier: number;
    attack_bonus: number;
    defense_bonus: number;
    speed_bonus: number;
    hp_bonus: number;
    effect_type?: string | null;
    effect_value: number;
    buy_price?: number | null;
    sell_price?: number | null;
    required_level: number;
    sprite_key?: string | null;
    is_purchasable: boolean;
    created_at: string | Date;
  };
}): InventorySlot {
  return {
    id: row.id,
    characterId: row.character_id,
    item: StudyQuestItem.fromDatabase(row.item),
    quantity: row.quantity,
    acquiredAt: new Date(row.acquired_at),
  };
}
