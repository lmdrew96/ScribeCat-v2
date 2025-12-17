-- Migration 059: Sync all client-side items to database
-- This ensures cloud inventory sync works properly by having all items
-- from src/renderer/game/data/items.ts in the database

-- First, ensure the item_type check constraint allows 'decoration' and 'special'
-- Drop and recreate the constraint if needed
DO $$
BEGIN
    -- Try to add new item types by recreating the constraint
    ALTER TABLE public.study_quest_items DROP CONSTRAINT IF EXISTS study_quest_items_item_type_check;
    ALTER TABLE public.study_quest_items ADD CONSTRAINT study_quest_items_item_type_check
        CHECK (item_type IN ('weapon', 'armor', 'accessory', 'consumable', 'key_item', 'special', 'decoration'));
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not modify item_type constraint: %', SQLERRM;
END $$;

-- ============================================================================
-- TIER 1 - TRAINING GROUNDS (Level 1)
-- ============================================================================

-- Consumables
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, effect_type, effect_value, buy_price, sell_price, is_purchasable)
VALUES
    ('health_potion', 'Health Potion', 'Restores 30 HP.', 'consumable', 'common', 1, 'heal', 30, 15, 5, true),
    ('mana_vial', 'Mana Vial', 'Restores 15 MP.', 'consumable', 'common', 1, 'heal', 15, 20, 7, true),
    ('strength_tonic', 'Strength Tonic', 'Boosts ATK by 3 for 3 turns.', 'consumable', 'common', 1, 'buff', 3, 25, 8, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    effect_type = EXCLUDED.effect_type,
    effect_value = EXCLUDED.effect_value,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Weapons
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, attack_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('wooden_sword', 'Wooden Sword', 'A basic wooden training sword.', 'weapon', 'common', 1, 5, 50, 15, true),
    ('fishbone_dagger', 'Fishbone Dagger', 'A sharp dagger made from a giant fish bone. Cats love it!', 'weapon', 'common', 1, 7, 80, 25, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    attack_bonus = EXCLUDED.attack_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Armor
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, defense_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('leather_armor', 'Leather Armor', 'Basic leather protection.', 'armor', 'common', 1, 3, 40, 12, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    defense_bonus = EXCLUDED.defense_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Accessories
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, speed_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('lucky_charm', 'Lucky Charm', 'Increases critical hit chance.', 'accessory', 'common', 1, 5, 100, 30, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    speed_bonus = EXCLUDED.speed_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Special Items
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, effect_type, effect_value, buy_price, sell_price, is_purchasable)
VALUES
    ('training_manual', 'Training Manual', 'A worn book with battle tips. Grants 50 bonus XP when used.', 'special', 'common', 1, 'buff', 50, 75, 20, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Decorations
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, buy_price, sell_price, is_purchasable)
VALUES
    ('simple_cat_bed', 'Simple Cat Bed', 'A cozy little bed for your feline friend.', 'decoration', 'common', 1, 100, 30, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- ============================================================================
-- TIER 2 - ENCHANTED FOREST (Level 5)
-- ============================================================================

-- Consumables
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, effect_type, effect_value, buy_price, sell_price, is_purchasable)
VALUES
    ('greater_potion', 'Greater Potion', 'Restores 60 HP.', 'consumable', 'uncommon', 2, 'heal', 60, 30, 10, true),
    ('mana_flask', 'Mana Flask', 'Restores 30 MP.', 'consumable', 'uncommon', 2, 'heal', 30, 40, 13, true),
    ('forest_brew', 'Forest Brew', 'Boosts DEF by 4 for 3 turns.', 'consumable', 'uncommon', 2, 'buff', 4, 45, 15, true),
    ('yarn_ball_bomb', 'Yarn Ball Bomb', 'An explosive yarn ball! Deals 25 damage to an enemy.', 'consumable', 'uncommon', 2, 'damage', 25, 35, 12, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    effect_type = EXCLUDED.effect_type,
    effect_value = EXCLUDED.effect_value,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Weapons
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, attack_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('iron_sword', 'Iron Sword', 'A sturdy iron blade.', 'weapon', 'uncommon', 2, 12, 150, 50, true),
    ('thorn_whip', 'Thorn Whip', 'A whip woven from enchanted forest vines.', 'weapon', 'uncommon', 2, 10, 180, 60, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    attack_bonus = EXCLUDED.attack_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Armor
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, defense_bonus, hp_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('iron_armor', 'Iron Armor', 'Heavy iron plate armor.', 'armor', 'uncommon', 2, 8, 20, 200, 65, true),
    ('tuna_can_shield', 'Tuna Can Shield', 'A shield made from a giant tuna can. Smells fishy but works!', 'armor', 'uncommon', 2, 5, 0, 120, 40, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    defense_bonus = EXCLUDED.defense_bonus,
    hp_bonus = EXCLUDED.hp_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Accessories
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, speed_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('forest_amulet', 'Forest Amulet', 'An amulet infused with forest magic.', 'accessory', 'uncommon', 2, 8, 180, 55, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    speed_bonus = EXCLUDED.speed_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Special Items
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, effect_type, effect_value, buy_price, sell_price, is_purchasable)
VALUES
    ('catnip_bundle', 'Catnip Bundle', 'Guarantees successful flee from any battle!', 'special', 'uncommon', 2, 'buff', 100, 60, 20, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Decorations
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, buy_price, sell_price, is_purchasable)
VALUES
    ('scratching_post', 'Scratching Post', 'Perfect for keeping claws sharp and furniture safe.', 'decoration', 'uncommon', 2, 150, 45, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- ============================================================================
-- TIER 3 - CRYSTAL CAVERNS (Level 10)
-- ============================================================================

-- Consumables
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, effect_type, effect_value, buy_price, sell_price, is_purchasable)
VALUES
    ('super_potion', 'Super Potion', 'Restores 100 HP.', 'consumable', 'rare', 3, 'heal', 100, 60, 20, true),
    ('mana_crystal', 'Mana Crystal', 'Restores 50 MP.', 'consumable', 'rare', 3, 'heal', 50, 70, 23, true),
    ('crystal_elixir', 'Crystal Elixir', 'Boosts LUCK by 10 for 5 turns.', 'consumable', 'rare', 3, 'buff', 10, 80, 25, true),
    ('catnip_potion', 'Catnip Potion', 'Boosts LUCK by 15 for 3 turns. Makes you feel amazing!', 'consumable', 'rare', 3, 'buff', 15, 100, 30, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    effect_type = EXCLUDED.effect_type,
    effect_value = EXCLUDED.effect_value,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Weapons
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, attack_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('crystal_sword', 'Crystal Sword', 'A blade forged from pure cave crystal.', 'weapon', 'rare', 3, 18, 300, 95, true),
    ('crystal_staff', 'Crystal Staff', 'A staff that channels crystalline energy.', 'weapon', 'rare', 3, 10, 350, 110, true),
    ('whisker_wand', 'Whisker Wand', 'A magical wand made from an ancient cat whisker.', 'weapon', 'rare', 3, 8, 400, 125, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    attack_bonus = EXCLUDED.attack_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Armor
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, defense_bonus, hp_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('crystal_armor', 'Crystal Armor', 'Armor made from interlocking crystal plates.', 'armor', 'rare', 3, 14, 30, 400, 130, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    defense_bonus = EXCLUDED.defense_bonus,
    hp_bonus = EXCLUDED.hp_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Accessories
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, speed_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('mana_ring', 'Mana Ring', 'A ring that enhances magical capacity.', 'accessory', 'rare', 3, 2, 300, 95, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    speed_bonus = EXCLUDED.speed_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Special Items
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, effect_type, effect_value, buy_price, sell_price, is_purchasable)
VALUES
    ('crystal_shard', 'Crystal Shard', 'A magical shard that can revive you once per dungeon run.', 'special', 'rare', 3, 'heal', 50, 200, 60, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Decorations
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, buy_price, sell_price, is_purchasable)
VALUES
    ('crystal_lamp', 'Crystal Lamp', 'A glowing crystal that lights up any room.', 'decoration', 'rare', 3, 250, 75, true),
    ('fish_fountain', 'Fish Fountain', 'A fountain with fish swimming around. Cats love to watch it!', 'decoration', 'rare', 3, 350, 105, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- ============================================================================
-- TIER 4 - ANCIENT LIBRARY (Level 15)
-- ============================================================================

-- Consumables
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, effect_type, effect_value, buy_price, sell_price, is_purchasable)
VALUES
    ('max_potion', 'Max Potion', 'Fully restores HP.', 'consumable', 'epic', 4, 'heal', 999, 100, 30, true),
    ('inkwell_mana', 'Inkwell Mana', 'Restores 75 MP. Made from enchanted ink.', 'consumable', 'epic', 4, 'heal', 75, 100, 30, true),
    ('scholars_focus', 'Scholar''s Focus', 'Boosts ATK by 8 for 4 turns through intense concentration.', 'consumable', 'epic', 4, 'buff', 8, 120, 35, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    effect_type = EXCLUDED.effect_type,
    effect_value = EXCLUDED.effect_value,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Weapons
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, attack_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('quill_blade', 'Quill Blade', 'A sword shaped like an oversized quill pen.', 'weapon', 'epic', 4, 22, 500, 160, true),
    ('tome_of_wisdom', 'Tome of Wisdom', 'An ancient book that serves as a powerful magical catalyst.', 'weapon', 'epic', 4, 14, 600, 190, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    attack_bonus = EXCLUDED.attack_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Armor
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, defense_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('librarian_robe', 'Librarian''s Robe', 'Enchanted robes worn by ancient library keepers.', 'armor', 'epic', 4, 18, 550, 175, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    defense_bonus = EXCLUDED.defense_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Accessories
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, speed_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('reading_glasses', 'Enchanted Reading Glasses', 'Magical spectacles that enhance perception.', 'accessory', 'epic', 4, 12, 450, 140, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    speed_bonus = EXCLUDED.speed_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Special Items
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, effect_type, effect_value, buy_price, sell_price, is_purchasable)
VALUES
    ('bookmark_of_return', 'Bookmark of Return', 'Instantly escape from any dungeon while keeping your loot!', 'special', 'epic', 4, 'buff', 1, 150, 45, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Decorations
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, buy_price, sell_price, is_purchasable)
VALUES
    ('floating_bookshelf', 'Floating Bookshelf', 'A magical bookshelf that hovers in mid-air.', 'decoration', 'epic', 4, 400, 120, true),
    ('study_desk', 'Study Desk', 'A cozy desk for all your studying needs.', 'decoration', 'epic', 4, 300, 90, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- ============================================================================
-- TIER 5 - VOLCANIC DEPTHS (Level 25)
-- ============================================================================

-- Consumables
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, effect_type, effect_value, buy_price, sell_price, is_purchasable)
VALUES
    ('lava_brew', 'Lava Brew', 'Restores 150 HP. Handle with care!', 'consumable', 'legendary', 5, 'heal', 150, 150, 45, true),
    ('molten_mana', 'Molten Mana', 'Restores 100 MP. Liquid magical fire.', 'consumable', 'legendary', 5, 'heal', 100, 150, 45, true),
    ('volcanic_fury', 'Volcanic Fury', 'Boosts ATK by 12 for 3 turns. Feel the burn!', 'consumable', 'legendary', 5, 'buff', 12, 180, 55, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    effect_type = EXCLUDED.effect_type,
    effect_value = EXCLUDED.effect_value,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Weapons
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, attack_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('flame_sword', 'Flame Sword', 'A blade wreathed in eternal flames.', 'weapon', 'legendary', 5, 30, 800, 260, true),
    ('inferno_staff', 'Inferno Staff', 'A staff containing the power of a volcano.', 'weapon', 'legendary', 5, 20, 900, 290, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    attack_bonus = EXCLUDED.attack_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Armor
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, defense_bonus, hp_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('dragon_scale_armor', 'Dragon Scale Armor', 'Armor crafted from volcanic dragon scales.', 'armor', 'legendary', 5, 25, 50, 850, 275, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    defense_bonus = EXCLUDED.defense_bonus,
    hp_bonus = EXCLUDED.hp_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Accessories
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, attack_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('ember_pendant', 'Ember Pendant', 'A pendant with a forever-burning ember inside.', 'accessory', 'legendary', 5, 8, 700, 225, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    attack_bonus = EXCLUDED.attack_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Special Items
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, effect_type, effect_value, buy_price, sell_price, is_purchasable)
VALUES
    ('phoenix_feather', 'Phoenix Feather', 'Auto-revive with 50% HP once when defeated.', 'special', 'legendary', 5, 'heal', 50, 500, 150, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Decorations
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, buy_price, sell_price, is_purchasable)
VALUES
    ('mini_volcano', 'Mini Volcano', 'A tiny volcanic decoration. Occasionally puffs smoke!', 'decoration', 'legendary', 5, 600, 180, true),
    ('cozy_fireplace', 'Cozy Fireplace', 'A warm fireplace perfect for napping nearby.', 'decoration', 'legendary', 5, 500, 150, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- ============================================================================
-- TIER 6 - THE VOID (Level 40)
-- ============================================================================

-- Consumables
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, effect_type, effect_value, buy_price, sell_price, is_purchasable)
VALUES
    ('void_elixir', 'Void Elixir', 'Restores 250 HP. Tastes like nothing.', 'consumable', 'legendary', 6, 'heal', 250, 300, 90, true),
    ('essence_of_nothing', 'Essence of Nothing', 'Restores 150 MP. Pure concentrated void energy.', 'consumable', 'legendary', 6, 'heal', 150, 300, 90, true),
    ('dimensional_tonic', 'Dimensional Tonic', 'Boosts ATK by 15 for 5 turns.', 'consumable', 'legendary', 6, 'buff', 15, 350, 105, true),
    ('void_shield_potion', 'Void Shield Potion', 'Boosts DEF by 15 for 5 turns.', 'consumable', 'legendary', 6, 'buff', 15, 350, 105, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    effect_type = EXCLUDED.effect_type,
    effect_value = EXCLUDED.effect_value,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Weapons
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, attack_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('void_blade', 'Void Blade', 'A sword forged from solidified nothingness.', 'weapon', 'legendary', 6, 45, 1500, 480, true),
    ('staff_of_oblivion', 'Staff of Oblivion', 'The ultimate magical weapon from the void.', 'weapon', 'legendary', 6, 28, 1800, 580, true),
    ('cosmic_claw', 'Cosmic Claw', 'A legendary weapon shaped like a giant cat claw.', 'weapon', 'legendary', 6, 40, 2000, 650, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    attack_bonus = EXCLUDED.attack_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Armor
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, defense_bonus, hp_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('reality_warper_armor', 'Reality Warper Armor', 'Armor that bends reality to protect its wearer.', 'armor', 'legendary', 6, 35, 80, 1600, 520, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    defense_bonus = EXCLUDED.defense_bonus,
    hp_bonus = EXCLUDED.hp_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Accessories
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, speed_bonus, buy_price, sell_price, is_purchasable)
VALUES
    ('cosmic_amulet', 'Cosmic Amulet', 'An amulet containing a tiny universe.', 'accessory', 'legendary', 6, 20, 1400, 450, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    speed_bonus = EXCLUDED.speed_bonus,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Special Items
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, effect_type, effect_value, buy_price, sell_price, is_purchasable)
VALUES
    ('cat_whisker_compass', 'Cat Whisker Compass', 'Reveals all rooms on the current floor.', 'special', 'legendary', 6, 'buff', 1, 500, 150, true),
    ('nine_lives_charm', 'Nine Lives Charm', 'Auto-revive at full HP once when defeated. The ultimate safety net!', 'special', 'legendary', 6, 'heal', 999, 800, 250, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- Decorations
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, buy_price, sell_price, is_purchasable)
VALUES
    ('void_portal_frame', 'Void Portal Frame', 'A decorative portal to nowhere. Looks cool though!', 'decoration', 'legendary', 6, 1000, 300, true),
    ('cosmic_cat_tree', 'Cosmic Cat Tree', 'A majestic cat tree that sparkles with starlight.', 'decoration', 'legendary', 6, 1200, 360, true)
ON CONFLICT (item_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price;

-- ============================================================================
-- Summary
-- ============================================================================
-- Total items added: ~60 items across 6 tiers
-- All items from src/renderer/game/data/items.ts now have database entries
-- Cloud inventory sync should now work properly
