/**
 * Item Definitions for StudyQuest
 *
 * Includes consumables, equipment, and special items.
 */

export type ItemType = 'consumable' | 'equipment' | 'key';
export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';
export type EffectType = 'heal' | 'buff' | 'damage';

export interface ItemEffect {
  type: EffectType;
  value: number;
  duration?: number; // For buffs, in turns
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  type: ItemType;

  // Shop info
  buyPrice: number;
  sellPrice: number;

  // Consumable effects
  effect?: ItemEffect;

  // Equipment stats (if type === 'equipment')
  slot?: EquipmentSlot;
  stats?: {
    attack?: number;
    defense?: number;
    maxHealth?: number;
    luck?: number;
  };

  // Visual
  iconColor?: [number, number, number]; // RGB for placeholder icons
}

/**
 * All item definitions
 */
export const ITEMS: Record<string, ItemDefinition> = {
  // --- CONSUMABLES ---
  health_potion: {
    id: 'health_potion',
    name: 'Health Potion',
    description: 'Restores 30 HP.',
    type: 'consumable',
    buyPrice: 15,
    sellPrice: 5,
    effect: { type: 'heal', value: 30 },
    iconColor: [255, 100, 100], // Red
  },

  greater_potion: {
    id: 'greater_potion',
    name: 'Greater Potion',
    description: 'Restores 60 HP.',
    type: 'consumable',
    buyPrice: 30,
    sellPrice: 10,
    effect: { type: 'heal', value: 60 },
    iconColor: [255, 50, 50], // Darker red
  },

  max_potion: {
    id: 'max_potion',
    name: 'Max Potion',
    description: 'Fully restores HP.',
    type: 'consumable',
    buyPrice: 75,
    sellPrice: 25,
    effect: { type: 'heal', value: 999 }, // Clamped to maxHealth
    iconColor: [255, 0, 128], // Pink
  },

  // --- EQUIPMENT: WEAPONS ---
  wooden_sword: {
    id: 'wooden_sword',
    name: 'Wooden Sword',
    description: 'A basic wooden training sword.',
    type: 'equipment',
    slot: 'weapon',
    buyPrice: 50,
    sellPrice: 15,
    stats: { attack: 5 },
    iconColor: [139, 90, 43], // Brown
  },

  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Sword',
    description: 'A sturdy iron blade.',
    type: 'equipment',
    slot: 'weapon',
    buyPrice: 150,
    sellPrice: 50,
    stats: { attack: 12 },
    iconColor: [192, 192, 192], // Silver
  },

  // --- EQUIPMENT: ARMOR ---
  leather_armor: {
    id: 'leather_armor',
    name: 'Leather Armor',
    description: 'Basic leather protection.',
    type: 'equipment',
    slot: 'armor',
    buyPrice: 40,
    sellPrice: 12,
    stats: { defense: 3 },
    iconColor: [139, 69, 19], // Saddle brown
  },

  iron_armor: {
    id: 'iron_armor',
    name: 'Iron Armor',
    description: 'Heavy iron plate armor.',
    type: 'equipment',
    slot: 'armor',
    buyPrice: 200,
    sellPrice: 65,
    stats: { defense: 8, maxHealth: 20 },
    iconColor: [128, 128, 128], // Gray
  },

  // --- EQUIPMENT: ACCESSORIES ---
  lucky_charm: {
    id: 'lucky_charm',
    name: 'Lucky Charm',
    description: 'Increases critical hit chance.',
    type: 'equipment',
    slot: 'accessory',
    buyPrice: 100,
    sellPrice: 30,
    stats: { luck: 5 },
    iconColor: [255, 215, 0], // Gold
  },
};

/**
 * Get item definition by ID
 */
export function getItem(id: string): ItemDefinition | undefined {
  return ITEMS[id];
}

/**
 * Get all items of a specific type
 */
export function getItemsByType(type: ItemType): ItemDefinition[] {
  return Object.values(ITEMS).filter((item) => item.type === type);
}

/**
 * Get all consumable items
 */
export function getConsumables(): ItemDefinition[] {
  return getItemsByType('consumable');
}

/**
 * Get all equipment items
 */
export function getEquipment(): ItemDefinition[] {
  return getItemsByType('equipment');
}

/**
 * Get equipment for a specific slot
 */
export function getEquipmentBySlot(slot: EquipmentSlot): ItemDefinition[] {
  return getEquipment().filter((item) => item.slot === slot);
}

/**
 * Shop inventory - items available for purchase
 */
export const SHOP_INVENTORY = {
  consumables: ['health_potion', 'greater_potion', 'max_potion'],
  weapons: ['wooden_sword', 'iron_sword'],
  armor: ['leather_armor', 'iron_armor'],
  accessories: ['lucky_charm'],
};
