/**
 * Item Definitions for StudyQuest
 *
 * Includes consumables, equipment, special items, and decorations.
 */

export type ItemType = 'consumable' | 'equipment' | 'key' | 'special' | 'decoration';
export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';
export type EffectType = 'heal' | 'buff' | 'damage' | 'mana_restore' | 'buff_attack' | 'buff_defense' | 'buff_luck';
export type DungeonTier = 1 | 2 | 3 | 4 | 5 | 6;

export interface ItemEffect {
  type: EffectType;
  value: number;
  duration?: number; // For buffs, in turns
}

export interface SpecialAbility {
  name: string;
  description: string;
  effect: ItemEffect;
  manaCost: number;
}

export interface DecorationProps {
  width: number; // Grid cells wide
  height: number; // Grid cells tall
  placeholderColor: [number, number, number]; // RGB for placeholder rendering
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  tier: DungeonTier; // Which dungeon tier this item belongs to (1-6)

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
    maxMana?: number;
    manaRegen?: number; // Mana restored per turn
  };

  // Magic weapon special ability
  specialAbility?: SpecialAbility;

  // Decoration properties (if type === 'decoration')
  decoration?: DecorationProps;

  // Visual
  iconColor?: [number, number, number]; // RGB for placeholder icons
}

/**
 * All item definitions
 */
export const ITEMS: Record<string, ItemDefinition> = {
  // ============================================================
  // TIER 1 - TRAINING GROUNDS (Level 1)
  // ============================================================

  // --- CONSUMABLES ---
  health_potion: {
    id: 'health_potion',
    name: 'Health Potion',
    description: 'Restores 30 HP.',
    type: 'consumable',
    tier: 1,
    buyPrice: 15,
    sellPrice: 5,
    effect: { type: 'heal', value: 30 },
    iconColor: [255, 100, 100],
  },

  mana_vial: {
    id: 'mana_vial',
    name: 'Mana Vial',
    description: 'Restores 15 MP.',
    type: 'consumable',
    tier: 1,
    buyPrice: 20,
    sellPrice: 7,
    effect: { type: 'mana_restore', value: 15 },
    iconColor: [100, 150, 255],
  },

  strength_tonic: {
    id: 'strength_tonic',
    name: 'Strength Tonic',
    description: 'Boosts ATK by 3 for 3 turns.',
    type: 'consumable',
    tier: 1,
    buyPrice: 25,
    sellPrice: 8,
    effect: { type: 'buff_attack', value: 3, duration: 3 },
    iconColor: [255, 140, 0],
  },

  // --- WEAPONS ---
  wooden_sword: {
    id: 'wooden_sword',
    name: 'Wooden Sword',
    description: 'A basic wooden training sword.',
    type: 'equipment',
    tier: 1,
    slot: 'weapon',
    buyPrice: 50,
    sellPrice: 15,
    stats: { attack: 5 },
    iconColor: [139, 90, 43],
  },

  fishbone_dagger: {
    id: 'fishbone_dagger',
    name: 'Fishbone Dagger',
    description: 'A sharp dagger made from a giant fish bone. Cats love it!',
    type: 'equipment',
    tier: 1,
    slot: 'weapon',
    buyPrice: 80,
    sellPrice: 25,
    stats: { attack: 7, luck: 3 },
    iconColor: [230, 230, 230],
  },

  // --- ARMOR ---
  leather_armor: {
    id: 'leather_armor',
    name: 'Leather Armor',
    description: 'Basic leather protection.',
    type: 'equipment',
    tier: 1,
    slot: 'armor',
    buyPrice: 40,
    sellPrice: 12,
    stats: { defense: 3 },
    iconColor: [139, 69, 19],
  },

  // --- ACCESSORIES ---
  lucky_charm: {
    id: 'lucky_charm',
    name: 'Lucky Charm',
    description: 'Increases critical hit chance.',
    type: 'equipment',
    tier: 1,
    slot: 'accessory',
    buyPrice: 100,
    sellPrice: 30,
    stats: { luck: 5 },
    iconColor: [255, 215, 0],
  },

  // --- SPECIAL ---
  training_manual: {
    id: 'training_manual',
    name: 'Training Manual',
    description: 'A worn book with battle tips. Grants 50 bonus XP when used.',
    type: 'special',
    tier: 1,
    buyPrice: 75,
    sellPrice: 20,
    effect: { type: 'buff', value: 50 },
    iconColor: [180, 140, 100],
  },

  // --- DECORATION ---
  simple_cat_bed: {
    id: 'simple_cat_bed',
    name: 'Simple Cat Bed',
    description: 'A cozy little bed for your feline friend.',
    type: 'decoration',
    tier: 1,
    buyPrice: 100,
    sellPrice: 30,
    decoration: { width: 1, height: 1, placeholderColor: [200, 180, 160] },
    iconColor: [200, 180, 160],
  },

  // ============================================================
  // TIER 2 - ENCHANTED FOREST (Level 5)
  // ============================================================

  // --- CONSUMABLES ---
  greater_potion: {
    id: 'greater_potion',
    name: 'Greater Potion',
    description: 'Restores 60 HP.',
    type: 'consumable',
    tier: 2,
    buyPrice: 30,
    sellPrice: 10,
    effect: { type: 'heal', value: 60 },
    iconColor: [255, 50, 50],
  },

  mana_flask: {
    id: 'mana_flask',
    name: 'Mana Flask',
    description: 'Restores 30 MP.',
    type: 'consumable',
    tier: 2,
    buyPrice: 40,
    sellPrice: 13,
    effect: { type: 'mana_restore', value: 30 },
    iconColor: [70, 130, 255],
  },

  forest_brew: {
    id: 'forest_brew',
    name: 'Forest Brew',
    description: 'Boosts DEF by 4 for 3 turns.',
    type: 'consumable',
    tier: 2,
    buyPrice: 45,
    sellPrice: 15,
    effect: { type: 'buff_defense', value: 4, duration: 3 },
    iconColor: [50, 180, 80],
  },

  yarn_ball_bomb: {
    id: 'yarn_ball_bomb',
    name: 'Yarn Ball Bomb',
    description: 'An explosive yarn ball! Deals 25 damage to an enemy.',
    type: 'consumable',
    tier: 2,
    buyPrice: 35,
    sellPrice: 12,
    effect: { type: 'damage', value: 25 },
    iconColor: [255, 100, 150],
  },

  // --- WEAPONS ---
  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Sword',
    description: 'A sturdy iron blade.',
    type: 'equipment',
    tier: 2,
    slot: 'weapon',
    buyPrice: 150,
    sellPrice: 50,
    stats: { attack: 12 },
    iconColor: [192, 192, 192],
  },

  thorn_whip: {
    id: 'thorn_whip',
    name: 'Thorn Whip',
    description: 'A whip woven from enchanted forest vines.',
    type: 'equipment',
    tier: 2,
    slot: 'weapon',
    buyPrice: 180,
    sellPrice: 60,
    stats: { attack: 10 },
    specialAbility: {
      name: 'Vine Lash',
      description: 'Strike with thorny vines.',
      effect: { type: 'damage', value: 20 },
      manaCost: 10,
    },
    iconColor: [34, 139, 34],
  },

  // --- ARMOR ---
  iron_armor: {
    id: 'iron_armor',
    name: 'Iron Armor',
    description: 'Heavy iron plate armor.',
    type: 'equipment',
    tier: 2,
    slot: 'armor',
    buyPrice: 200,
    sellPrice: 65,
    stats: { defense: 8, maxHealth: 20 },
    iconColor: [128, 128, 128],
  },

  tuna_can_shield: {
    id: 'tuna_can_shield',
    name: 'Tuna Can Shield',
    description: 'A shield made from a giant tuna can. Smells fishy but works!',
    type: 'equipment',
    tier: 2,
    slot: 'armor',
    buyPrice: 120,
    sellPrice: 40,
    stats: { defense: 5 },
    iconColor: [180, 180, 200],
  },

  // --- ACCESSORIES ---
  forest_amulet: {
    id: 'forest_amulet',
    name: 'Forest Amulet',
    description: 'An amulet infused with forest magic.',
    type: 'equipment',
    tier: 2,
    slot: 'accessory',
    buyPrice: 180,
    sellPrice: 55,
    stats: { luck: 8, maxMana: 10 },
    iconColor: [100, 200, 100],
  },

  // --- SPECIAL ---
  catnip_bundle: {
    id: 'catnip_bundle',
    name: 'Catnip Bundle',
    description: 'Guarantees successful flee from any battle!',
    type: 'special',
    tier: 2,
    buyPrice: 60,
    sellPrice: 20,
    effect: { type: 'buff', value: 100 },
    iconColor: [150, 220, 150],
  },

  // --- DECORATION ---
  scratching_post: {
    id: 'scratching_post',
    name: 'Scratching Post',
    description: 'Perfect for keeping claws sharp and furniture safe.',
    type: 'decoration',
    tier: 2,
    buyPrice: 150,
    sellPrice: 45,
    decoration: { width: 1, height: 2, placeholderColor: [180, 140, 100] },
    iconColor: [180, 140, 100],
  },

  // ============================================================
  // TIER 3 - CRYSTAL CAVERNS (Level 10)
  // ============================================================

  // --- CONSUMABLES ---
  super_potion: {
    id: 'super_potion',
    name: 'Super Potion',
    description: 'Restores 100 HP.',
    type: 'consumable',
    tier: 3,
    buyPrice: 60,
    sellPrice: 20,
    effect: { type: 'heal', value: 100 },
    iconColor: [255, 0, 100],
  },

  mana_crystal: {
    id: 'mana_crystal',
    name: 'Mana Crystal',
    description: 'Restores 50 MP.',
    type: 'consumable',
    tier: 3,
    buyPrice: 70,
    sellPrice: 23,
    effect: { type: 'mana_restore', value: 50 },
    iconColor: [100, 200, 255],
  },

  crystal_elixir: {
    id: 'crystal_elixir',
    name: 'Crystal Elixir',
    description: 'Boosts LUCK by 10 for 5 turns.',
    type: 'consumable',
    tier: 3,
    buyPrice: 80,
    sellPrice: 25,
    effect: { type: 'buff_luck', value: 10, duration: 5 },
    iconColor: [200, 100, 255],
  },

  catnip_potion: {
    id: 'catnip_potion',
    name: 'Catnip Potion',
    description: 'Boosts LUCK by 15 for 3 turns. Makes you feel amazing!',
    type: 'consumable',
    tier: 3,
    buyPrice: 100,
    sellPrice: 30,
    effect: { type: 'buff_luck', value: 15, duration: 3 },
    iconColor: [150, 255, 150],
  },

  // --- WEAPONS ---
  crystal_sword: {
    id: 'crystal_sword',
    name: 'Crystal Sword',
    description: 'A blade forged from pure cave crystal.',
    type: 'equipment',
    tier: 3,
    slot: 'weapon',
    buyPrice: 300,
    sellPrice: 95,
    stats: { attack: 18 },
    iconColor: [150, 220, 255],
  },

  crystal_staff: {
    id: 'crystal_staff',
    name: 'Crystal Staff',
    description: 'A staff that channels crystalline energy.',
    type: 'equipment',
    tier: 3,
    slot: 'weapon',
    buyPrice: 350,
    sellPrice: 110,
    stats: { attack: 10 },
    specialAbility: {
      name: 'Crystal Bolt',
      description: 'Fire a bolt of crystal energy.',
      effect: { type: 'damage', value: 35 },
      manaCost: 15,
    },
    iconColor: [180, 230, 255],
  },

  whisker_wand: {
    id: 'whisker_wand',
    name: 'Whisker Wand',
    description: 'A magical wand made from an ancient cat whisker.',
    type: 'equipment',
    tier: 3,
    slot: 'weapon',
    buyPrice: 400,
    sellPrice: 125,
    stats: { attack: 8, luck: 5 },
    specialAbility: {
      name: 'Meow Wave',
      description: 'Unleash a wave of feline energy!',
      effect: { type: 'damage', value: 30 },
      manaCost: 12,
    },
    iconColor: [255, 200, 220],
  },

  // --- ARMOR ---
  crystal_armor: {
    id: 'crystal_armor',
    name: 'Crystal Armor',
    description: 'Armor made from interlocking crystal plates.',
    type: 'equipment',
    tier: 3,
    slot: 'armor',
    buyPrice: 400,
    sellPrice: 130,
    stats: { defense: 14, maxHealth: 30 },
    iconColor: [180, 220, 255],
  },

  // --- ACCESSORIES ---
  mana_ring: {
    id: 'mana_ring',
    name: 'Mana Ring',
    description: 'A ring that enhances magical capacity.',
    type: 'equipment',
    tier: 3,
    slot: 'accessory',
    buyPrice: 300,
    sellPrice: 95,
    stats: { maxMana: 25, manaRegen: 2 },
    iconColor: [100, 180, 255],
  },

  // --- SPECIAL ---
  crystal_shard: {
    id: 'crystal_shard',
    name: 'Crystal Shard',
    description: 'A magical shard that can revive you once per dungeon run.',
    type: 'special',
    tier: 3,
    buyPrice: 200,
    sellPrice: 60,
    effect: { type: 'heal', value: 50 },
    iconColor: [220, 240, 255],
  },

  // --- DECORATION ---
  crystal_lamp: {
    id: 'crystal_lamp',
    name: 'Crystal Lamp',
    description: 'A glowing crystal that lights up any room.',
    type: 'decoration',
    tier: 3,
    buyPrice: 250,
    sellPrice: 75,
    decoration: { width: 1, height: 1, placeholderColor: [180, 220, 255] },
    iconColor: [180, 220, 255],
  },

  // ============================================================
  // TIER 4 - ANCIENT LIBRARY (Level 15)
  // ============================================================

  // --- CONSUMABLES ---
  max_potion: {
    id: 'max_potion',
    name: 'Max Potion',
    description: 'Fully restores HP.',
    type: 'consumable',
    tier: 4,
    buyPrice: 100,
    sellPrice: 30,
    effect: { type: 'heal', value: 999 },
    iconColor: [255, 0, 128],
  },

  inkwell_mana: {
    id: 'inkwell_mana',
    name: 'Inkwell Mana',
    description: 'Restores 75 MP. Made from enchanted ink.',
    type: 'consumable',
    tier: 4,
    buyPrice: 100,
    sellPrice: 30,
    effect: { type: 'mana_restore', value: 75 },
    iconColor: [50, 50, 150],
  },

  scholars_focus: {
    id: 'scholars_focus',
    name: "Scholar's Focus",
    description: 'Boosts ATK by 8 for 4 turns through intense concentration.',
    type: 'consumable',
    tier: 4,
    buyPrice: 120,
    sellPrice: 35,
    effect: { type: 'buff_attack', value: 8, duration: 4 },
    iconColor: [255, 220, 100],
  },

  // --- WEAPONS ---
  quill_blade: {
    id: 'quill_blade',
    name: 'Quill Blade',
    description: 'A sword shaped like an oversized quill pen.',
    type: 'equipment',
    tier: 4,
    slot: 'weapon',
    buyPrice: 500,
    sellPrice: 160,
    stats: { attack: 22 },
    iconColor: [255, 250, 240],
  },

  tome_of_wisdom: {
    id: 'tome_of_wisdom',
    name: 'Tome of Wisdom',
    description: 'An ancient book that serves as a powerful magical catalyst.',
    type: 'equipment',
    tier: 4,
    slot: 'weapon',
    buyPrice: 600,
    sellPrice: 190,
    stats: { attack: 14 },
    specialAbility: {
      name: 'Knowledge Blast',
      description: 'Blast enemies with concentrated knowledge!',
      effect: { type: 'damage', value: 45 },
      manaCost: 20,
    },
    iconColor: [139, 90, 43],
  },

  // --- ARMOR ---
  librarian_robe: {
    id: 'librarian_robe',
    name: "Librarian's Robe",
    description: 'Enchanted robes worn by ancient library keepers.',
    type: 'equipment',
    tier: 4,
    slot: 'armor',
    buyPrice: 550,
    sellPrice: 175,
    stats: { defense: 18, maxMana: 30 },
    iconColor: [80, 60, 120],
  },

  // --- ACCESSORIES ---
  reading_glasses: {
    id: 'reading_glasses',
    name: 'Enchanted Reading Glasses',
    description: 'Magical spectacles that enhance perception.',
    type: 'equipment',
    tier: 4,
    slot: 'accessory',
    buyPrice: 450,
    sellPrice: 140,
    stats: { luck: 12, manaRegen: 3 },
    iconColor: [200, 180, 255],
  },

  // --- SPECIAL ---
  bookmark_of_return: {
    id: 'bookmark_of_return',
    name: 'Bookmark of Return',
    description: 'Instantly escape from any dungeon while keeping your loot!',
    type: 'special',
    tier: 4,
    buyPrice: 150,
    sellPrice: 45,
    effect: { type: 'buff', value: 1 },
    iconColor: [255, 100, 100],
  },

  // --- DECORATION ---
  floating_bookshelf: {
    id: 'floating_bookshelf',
    name: 'Floating Bookshelf',
    description: 'A magical bookshelf that hovers in mid-air.',
    type: 'decoration',
    tier: 4,
    buyPrice: 400,
    sellPrice: 120,
    decoration: { width: 2, height: 1, placeholderColor: [139, 90, 43] },
    iconColor: [139, 90, 43],
  },

  // ============================================================
  // TIER 5 - VOLCANIC DEPTHS (Level 25)
  // ============================================================

  // --- CONSUMABLES ---
  lava_brew: {
    id: 'lava_brew',
    name: 'Lava Brew',
    description: 'Restores 150 HP. Handle with care!',
    type: 'consumable',
    tier: 5,
    buyPrice: 150,
    sellPrice: 45,
    effect: { type: 'heal', value: 150 },
    iconColor: [255, 100, 0],
  },

  molten_mana: {
    id: 'molten_mana',
    name: 'Molten Mana',
    description: 'Restores 100 MP. Liquid magical fire.',
    type: 'consumable',
    tier: 5,
    buyPrice: 150,
    sellPrice: 45,
    effect: { type: 'mana_restore', value: 100 },
    iconColor: [255, 150, 50],
  },

  volcanic_fury: {
    id: 'volcanic_fury',
    name: 'Volcanic Fury',
    description: 'Boosts ATK by 12 for 3 turns. Feel the burn!',
    type: 'consumable',
    tier: 5,
    buyPrice: 180,
    sellPrice: 55,
    effect: { type: 'buff_attack', value: 12, duration: 3 },
    iconColor: [255, 80, 0],
  },

  // --- WEAPONS ---
  flame_sword: {
    id: 'flame_sword',
    name: 'Flame Sword',
    description: 'A blade wreathed in eternal flames.',
    type: 'equipment',
    tier: 5,
    slot: 'weapon',
    buyPrice: 800,
    sellPrice: 260,
    stats: { attack: 30 },
    iconColor: [255, 100, 0],
  },

  inferno_staff: {
    id: 'inferno_staff',
    name: 'Inferno Staff',
    description: 'A staff containing the power of a volcano.',
    type: 'equipment',
    tier: 5,
    slot: 'weapon',
    buyPrice: 900,
    sellPrice: 290,
    stats: { attack: 20 },
    specialAbility: {
      name: 'Meteor Strike',
      description: 'Call down a fiery meteor!',
      effect: { type: 'damage', value: 60 },
      manaCost: 30,
    },
    iconColor: [255, 50, 0],
  },

  // --- ARMOR ---
  dragon_scale_armor: {
    id: 'dragon_scale_armor',
    name: 'Dragon Scale Armor',
    description: 'Armor crafted from volcanic dragon scales.',
    type: 'equipment',
    tier: 5,
    slot: 'armor',
    buyPrice: 850,
    sellPrice: 275,
    stats: { defense: 25, maxHealth: 50 },
    iconColor: [180, 50, 50],
  },

  // --- ACCESSORIES ---
  ember_pendant: {
    id: 'ember_pendant',
    name: 'Ember Pendant',
    description: 'A pendant with a forever-burning ember inside.',
    type: 'equipment',
    tier: 5,
    slot: 'accessory',
    buyPrice: 700,
    sellPrice: 225,
    stats: { attack: 8, maxMana: 40, manaRegen: 4 },
    iconColor: [255, 120, 50],
  },

  // --- SPECIAL ---
  phoenix_feather: {
    id: 'phoenix_feather',
    name: 'Phoenix Feather',
    description: 'Auto-revive with 50% HP once when defeated.',
    type: 'special',
    tier: 5,
    buyPrice: 500,
    sellPrice: 150,
    effect: { type: 'heal', value: 50 },
    iconColor: [255, 200, 100],
  },

  // --- DECORATION ---
  mini_volcano: {
    id: 'mini_volcano',
    name: 'Mini Volcano',
    description: 'A tiny volcanic decoration. Occasionally puffs smoke!',
    type: 'decoration',
    tier: 5,
    buyPrice: 600,
    sellPrice: 180,
    decoration: { width: 1, height: 1, placeholderColor: [180, 60, 30] },
    iconColor: [180, 60, 30],
  },

  // ============================================================
  // TIER 6 - THE VOID (Level 40)
  // ============================================================

  // --- CONSUMABLES ---
  void_elixir: {
    id: 'void_elixir',
    name: 'Void Elixir',
    description: 'Restores 250 HP. Tastes like nothing.',
    type: 'consumable',
    tier: 6,
    buyPrice: 300,
    sellPrice: 90,
    effect: { type: 'heal', value: 250 },
    iconColor: [80, 0, 120],
  },

  essence_of_nothing: {
    id: 'essence_of_nothing',
    name: 'Essence of Nothing',
    description: 'Restores 150 MP. Pure concentrated void energy.',
    type: 'consumable',
    tier: 6,
    buyPrice: 300,
    sellPrice: 90,
    effect: { type: 'mana_restore', value: 150 },
    iconColor: [60, 0, 100],
  },

  dimensional_tonic: {
    id: 'dimensional_tonic',
    name: 'Dimensional Tonic',
    description: 'Boosts ATK by 15 for 5 turns.',
    type: 'consumable',
    tier: 6,
    buyPrice: 350,
    sellPrice: 105,
    effect: { type: 'buff_attack', value: 15, duration: 5 },
    iconColor: [150, 0, 200],
  },

  void_shield_potion: {
    id: 'void_shield_potion',
    name: 'Void Shield Potion',
    description: 'Boosts DEF by 15 for 5 turns.',
    type: 'consumable',
    tier: 6,
    buyPrice: 350,
    sellPrice: 105,
    effect: { type: 'buff_defense', value: 15, duration: 5 },
    iconColor: [100, 0, 150],
  },

  // --- WEAPONS ---
  void_blade: {
    id: 'void_blade',
    name: 'Void Blade',
    description: 'A sword forged from solidified nothingness.',
    type: 'equipment',
    tier: 6,
    slot: 'weapon',
    buyPrice: 1500,
    sellPrice: 480,
    stats: { attack: 45 },
    iconColor: [60, 0, 80],
  },

  staff_of_oblivion: {
    id: 'staff_of_oblivion',
    name: 'Staff of Oblivion',
    description: 'The ultimate magical weapon from the void.',
    type: 'equipment',
    tier: 6,
    slot: 'weapon',
    buyPrice: 1800,
    sellPrice: 580,
    stats: { attack: 28 },
    specialAbility: {
      name: 'Void Collapse',
      description: 'Collapse reality around your enemy!',
      effect: { type: 'damage', value: 80 },
      manaCost: 40,
    },
    iconColor: [40, 0, 60],
  },

  cosmic_claw: {
    id: 'cosmic_claw',
    name: 'Cosmic Claw',
    description: 'A legendary weapon shaped like a giant cat claw.',
    type: 'equipment',
    tier: 6,
    slot: 'weapon',
    buyPrice: 2000,
    sellPrice: 650,
    stats: { attack: 40, luck: 15 },
    specialAbility: {
      name: 'Nine Lives Strike',
      description: 'Strike with the power of nine lives!',
      effect: { type: 'damage', value: 90 },
      manaCost: 45,
    },
    iconColor: [255, 220, 180],
  },

  // --- ARMOR ---
  reality_warper_armor: {
    id: 'reality_warper_armor',
    name: 'Reality Warper Armor',
    description: 'Armor that bends reality to protect its wearer.',
    type: 'equipment',
    tier: 6,
    slot: 'armor',
    buyPrice: 1600,
    sellPrice: 520,
    stats: { defense: 35, maxHealth: 80, maxMana: 20 },
    iconColor: [100, 50, 150],
  },

  // --- ACCESSORIES ---
  cosmic_amulet: {
    id: 'cosmic_amulet',
    name: 'Cosmic Amulet',
    description: 'An amulet containing a tiny universe.',
    type: 'equipment',
    tier: 6,
    slot: 'accessory',
    buyPrice: 1400,
    sellPrice: 450,
    stats: { luck: 20, maxMana: 60, manaRegen: 6 },
    iconColor: [180, 100, 255],
  },

  // --- SPECIAL ---
  cat_whisker_compass: {
    id: 'cat_whisker_compass',
    name: 'Cat Whisker Compass',
    description: 'Reveals all rooms on the current floor.',
    type: 'special',
    tier: 6,
    buyPrice: 500,
    sellPrice: 150,
    effect: { type: 'buff', value: 1 },
    iconColor: [255, 230, 200],
  },

  nine_lives_charm: {
    id: 'nine_lives_charm',
    name: 'Nine Lives Charm',
    description: 'Auto-revive at full HP once when defeated. The ultimate safety net!',
    type: 'special',
    tier: 6,
    buyPrice: 800,
    sellPrice: 250,
    effect: { type: 'heal', value: 999 },
    iconColor: [255, 215, 0],
  },

  // --- DECORATIONS ---
  void_portal_frame: {
    id: 'void_portal_frame',
    name: 'Void Portal Frame',
    description: 'A decorative portal to nowhere. Looks cool though!',
    type: 'decoration',
    tier: 6,
    buyPrice: 1000,
    sellPrice: 300,
    decoration: { width: 2, height: 2, placeholderColor: [80, 0, 120] },
    iconColor: [80, 0, 120],
  },

  cosmic_cat_tree: {
    id: 'cosmic_cat_tree',
    name: 'Cosmic Cat Tree',
    description: 'A majestic cat tree that sparkles with starlight.',
    type: 'decoration',
    tier: 6,
    buyPrice: 1200,
    sellPrice: 360,
    decoration: { width: 2, height: 2, placeholderColor: [100, 80, 180] },
    iconColor: [100, 80, 180],
  },

  study_desk: {
    id: 'study_desk',
    name: 'Study Desk',
    description: 'A cozy desk for all your studying needs.',
    type: 'decoration',
    tier: 4,
    buyPrice: 300,
    sellPrice: 90,
    decoration: { width: 2, height: 1, placeholderColor: [139, 90, 43] },
    iconColor: [139, 90, 43],
  },

  fish_fountain: {
    id: 'fish_fountain',
    name: 'Fish Fountain',
    description: 'A fountain with fish swimming around. Cats love to watch it!',
    type: 'decoration',
    tier: 3,
    buyPrice: 350,
    sellPrice: 105,
    decoration: { width: 1, height: 1, placeholderColor: [100, 180, 220] },
    iconColor: [100, 180, 220],
  },

  cozy_fireplace: {
    id: 'cozy_fireplace',
    name: 'Cozy Fireplace',
    description: 'A warm fireplace perfect for napping nearby.',
    type: 'decoration',
    tier: 5,
    buyPrice: 500,
    sellPrice: 150,
    decoration: { width: 2, height: 1, placeholderColor: [200, 100, 50] },
    iconColor: [200, 100, 50],
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
 * Get all items of a specific tier
 */
export function getItemsByTier(tier: DungeonTier): ItemDefinition[] {
  return Object.values(ITEMS).filter((item) => item.tier === tier);
}

/**
 * Get all decoration items
 */
export function getDecorations(): ItemDefinition[] {
  return getItemsByType('decoration');
}

/**
 * Get all special items
 */
export function getSpecialItems(): ItemDefinition[] {
  return getItemsByType('special');
}

/**
 * Get items available for a player's level (unlocks based on dungeon tier)
 */
export function getAvailableItemsForLevel(level: number): ItemDefinition[] {
  const unlockedTier = getUnlockedTier(level);
  return Object.values(ITEMS).filter((item) => item.tier <= unlockedTier);
}

/**
 * Get the highest tier unlocked for a given level
 */
export function getUnlockedTier(level: number): DungeonTier {
  if (level >= 40) return 6;
  if (level >= 25) return 5;
  if (level >= 15) return 4;
  if (level >= 10) return 3;
  if (level >= 5) return 2;
  return 1;
}

/**
 * Shop inventory organized by tier - items available for purchase
 */
export const SHOP_INVENTORY: Record<DungeonTier, {
  consumables: string[];
  weapons: string[];
  armor: string[];
  accessories: string[];
  special: string[];
  decorations: string[];
}> = {
  1: {
    consumables: ['health_potion', 'mana_vial', 'strength_tonic'],
    weapons: ['wooden_sword', 'fishbone_dagger'],
    armor: ['leather_armor'],
    accessories: ['lucky_charm'],
    special: ['training_manual'],
    decorations: ['simple_cat_bed'],
  },
  2: {
    consumables: ['greater_potion', 'mana_flask', 'forest_brew', 'yarn_ball_bomb'],
    weapons: ['iron_sword', 'thorn_whip'],
    armor: ['iron_armor', 'tuna_can_shield'],
    accessories: ['forest_amulet'],
    special: ['catnip_bundle'],
    decorations: ['scratching_post'],
  },
  3: {
    consumables: ['super_potion', 'mana_crystal', 'crystal_elixir', 'catnip_potion'],
    weapons: ['crystal_sword', 'crystal_staff', 'whisker_wand'],
    armor: ['crystal_armor'],
    accessories: ['mana_ring'],
    special: ['crystal_shard'],
    decorations: ['crystal_lamp', 'fish_fountain'],
  },
  4: {
    consumables: ['max_potion', 'inkwell_mana', 'scholars_focus'],
    weapons: ['quill_blade', 'tome_of_wisdom'],
    armor: ['librarian_robe'],
    accessories: ['reading_glasses'],
    special: ['bookmark_of_return'],
    decorations: ['floating_bookshelf', 'study_desk'],
  },
  5: {
    consumables: ['lava_brew', 'molten_mana', 'volcanic_fury'],
    weapons: ['flame_sword', 'inferno_staff'],
    armor: ['dragon_scale_armor'],
    accessories: ['ember_pendant'],
    special: ['phoenix_feather'],
    decorations: ['mini_volcano', 'cozy_fireplace'],
  },
  6: {
    consumables: ['void_elixir', 'essence_of_nothing', 'dimensional_tonic', 'void_shield_potion'],
    weapons: ['void_blade', 'staff_of_oblivion', 'cosmic_claw'],
    armor: ['reality_warper_armor'],
    accessories: ['cosmic_amulet'],
    special: ['cat_whisker_compass', 'nine_lives_charm'],
    decorations: ['void_portal_frame', 'cosmic_cat_tree'],
  },
};

/**
 * Get all shop items available up to a given tier
 */
export function getShopItemsForTier(maxTier: DungeonTier): {
  consumables: string[];
  weapons: string[];
  armor: string[];
  accessories: string[];
  special: string[];
  decorations: string[];
} {
  const result = {
    consumables: [] as string[],
    weapons: [] as string[],
    armor: [] as string[],
    accessories: [] as string[],
    special: [] as string[],
    decorations: [] as string[],
  };

  for (let tier = 1; tier <= maxTier; tier++) {
    const tierInventory = SHOP_INVENTORY[tier as DungeonTier];
    result.consumables.push(...tierInventory.consumables);
    result.weapons.push(...tierInventory.weapons);
    result.armor.push(...tierInventory.armor);
    result.accessories.push(...tierInventory.accessories);
    result.special.push(...tierInventory.special);
    result.decorations.push(...tierInventory.decorations);
  }

  return result;
}

/**
 * Get a random item drop for treasure chests based on dungeon tier
 * Returns null if no item drops (just gold instead)
 *
 * Drop rates:
 * - 50% chance of getting an item
 * - Items weighted: consumables (50%), equipment (35%), special (15%)
 */
export function getChestLootItem(dungeonTier: DungeonTier): string | null {
  // 50% chance to drop an item
  if (Math.random() > 0.5) return null;

  const tierInventory = SHOP_INVENTORY[dungeonTier];

  // Build weighted loot pool
  const lootPool: { id: string; weight: number }[] = [];

  // Consumables - 50% weight (most common)
  tierInventory.consumables.forEach(id => lootPool.push({ id, weight: 50 }));

  // Equipment - 35% weight (less common)
  tierInventory.weapons.forEach(id => lootPool.push({ id, weight: 35 }));
  tierInventory.armor.forEach(id => lootPool.push({ id, weight: 35 }));
  tierInventory.accessories.forEach(id => lootPool.push({ id, weight: 35 }));

  // Special items - 15% weight (rare)
  tierInventory.special.forEach(id => lootPool.push({ id, weight: 15 }));

  if (lootPool.length === 0) return null;

  // Weighted random selection
  const totalWeight = lootPool.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of lootPool) {
    random -= item.weight;
    if (random <= 0) {
      return item.id;
    }
  }

  // Fallback to first item
  return lootPool[0].id;
}
