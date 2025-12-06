-- Migration 057: Add default shop items for StudyQuest
-- Adds purchasable items to the shop

-- First, add heal_amount column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'study_quest_items'
                   AND column_name = 'heal_amount') THEN
        ALTER TABLE public.study_quest_items ADD COLUMN heal_amount INTEGER DEFAULT 0;
    END IF;
END $$;

-- Consumable items (potions)
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, effect_type, effect_value, buy_price, sell_price, is_purchasable)
VALUES
    ('health_potion_small', 'Small Health Potion', 'Restores 25 HP.', 'consumable', 'common', 1, 'heal', 25, 25, 10, true),
    ('health_potion_medium', 'Medium Health Potion', 'Restores 50 HP.', 'consumable', 'uncommon', 2, 'heal', 50, 50, 20, true),
    ('health_potion_large', 'Large Health Potion', 'Restores 100 HP.', 'consumable', 'rare', 3, 'heal', 100, 100, 40, true)
ON CONFLICT (item_key) DO NOTHING;

-- Update heal_amount based on effect_value for all consumables
UPDATE public.study_quest_items
SET heal_amount = effect_value
WHERE item_type = 'consumable' AND effect_type = 'heal';

-- Weapons (Tier 1)
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, attack_bonus, buy_price, sell_price, required_level, is_purchasable)
VALUES
    ('wooden_sword', 'Wooden Sword', 'A basic training sword.', 'weapon', 'common', 1, 3, 50, 20, 1, true),
    ('iron_sword', 'Iron Sword', 'A sturdy iron blade.', 'weapon', 'uncommon', 2, 6, 150, 60, 5, true),
    ('steel_sword', 'Steel Sword', 'A well-crafted steel sword.', 'weapon', 'rare', 3, 10, 350, 140, 10, true)
ON CONFLICT (item_key) DO NOTHING;

-- Armor (Tier 1)
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, defense_bonus, buy_price, sell_price, required_level, is_purchasable)
VALUES
    ('leather_armor', 'Leather Armor', 'Basic leather protection.', 'armor', 'common', 1, 2, 40, 16, 1, true),
    ('chainmail', 'Chainmail', 'Linked metal rings for defense.', 'armor', 'uncommon', 2, 5, 120, 48, 5, true),
    ('plate_armor', 'Plate Armor', 'Heavy but protective armor.', 'armor', 'rare', 3, 8, 300, 120, 10, true)
ON CONFLICT (item_key) DO NOTHING;

-- Accessories
INSERT INTO public.study_quest_items (item_key, name, description, item_type, rarity, tier, speed_bonus, hp_bonus, buy_price, sell_price, required_level, is_purchasable)
VALUES
    ('lucky_charm', 'Lucky Charm', 'A charm that brings good fortune.', 'accessory', 'common', 1, 1, 0, 30, 12, 1, true),
    ('swift_boots', 'Swift Boots', 'Boots that increase agility.', 'accessory', 'uncommon', 2, 3, 0, 100, 40, 5, true),
    ('heart_pendant', 'Heart Pendant', 'A pendant that increases vitality.', 'accessory', 'uncommon', 2, 0, 20, 100, 40, 5, true)
ON CONFLICT (item_key) DO NOTHING;

COMMENT ON COLUMN public.study_quest_items.heal_amount IS 'Amount of HP restored for consumable items';
