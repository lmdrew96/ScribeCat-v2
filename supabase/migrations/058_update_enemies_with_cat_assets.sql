-- Migration 058: Update StudyQuest Enemies and Dungeons with Cat-Themed Assets
-- Replaces generic fantasy enemies with cat RPG enemies that match our HD battler assets

-- ============================================================================
-- Clear combat logs that reference old enemies (historical data only)
-- ============================================================================

DELETE FROM public.study_quest_combat_log;

-- ============================================================================
-- Update Dungeons to match new backgrounds and cat theme
-- ============================================================================

UPDATE public.study_quest_dungeons SET
    name = 'Training Grounds',
    description = 'A safe cardboard box arena for new adventurers to practice.',
    boss_name = 'Rubber Ducky',
    boss_sprite_key = 'rubber_ducky',
    sprite_key = 'town'
WHERE id = 'training_grounds';

UPDATE public.study_quest_dungeons SET
    name = 'The Back Alley',
    description = 'A dark alleyway infested with rival rats.',
    boss_name = 'Rat Warlord',
    boss_sprite_key = 'rat_warrior',
    sprite_key = 'alley'
WHERE id = 'dark_forest';

UPDATE public.study_quest_dungeons SET
    name = 'Fish Docks',
    description = 'The docks where the fishmongers peddle their wares.',
    boss_name = 'The Great Can Opener',
    boss_sprite_key = 'can_opener_boss',
    sprite_key = 'fish_docks'
WHERE id = 'crystal_caves';

UPDATE public.study_quest_dungeons SET
    name = 'Dog Park',
    description = 'Enemy territory! Watch out for those ruff canines.',
    boss_name = 'Dog Champion',
    boss_sprite_key = 'dog_warrior',
    sprite_key = 'alley_night'
WHERE id = 'haunted_library';

UPDATE public.study_quest_dungeons SET
    name = 'Tuna Springs',
    description = 'A mystical hot spring guarded by fearsome creatures.',
    boss_name = 'The Roomba',
    boss_sprite_key = 'roomba',
    sprite_key = 'tuna_springs'
WHERE id = 'dragons_peak';

UPDATE public.study_quest_dungeons SET
    name = 'Moonlit Lake',
    description = 'The ultimate challenge awaits at the legendary Moonlit Lake.',
    boss_name = 'Giant Rubber Ducky',
    boss_sprite_key = 'big_rubber_ducky',
    sprite_key = 'moonlake'
WHERE id = 'void_realm';

-- ============================================================================
-- Delete old enemies and insert new cat-themed enemies
-- ============================================================================

-- First, delete all existing enemies
DELETE FROM public.study_quest_enemies;

-- Insert new cat-themed enemies with sprite_keys matching our battler assets
-- Note: Slimes use NULL sprite_key to fall back to animated slime sprites
INSERT INTO public.study_quest_enemies (id, name, dungeon_id, is_boss, base_hp, base_attack, base_defense, base_speed, xp_reward, gold_reward, sprite_key)
VALUES
    -- Training Grounds (town background) - Easy slimes (animated sprites)
    ('slime_green_1', 'Green Slime', 'training_grounds', false, 25, 4, 2, 3, 10, 5, NULL),
    ('slime_green_2', 'Bouncy Slime', 'training_grounds', false, 30, 5, 2, 4, 12, 6, NULL),
    ('rubber_ducky_boss', 'Rubber Ducky', 'training_grounds', true, 80, 8, 4, 5, 50, 25, 'rubber_ducky'),

    -- Back Alley (alley background) - Rats!
    ('rat_1', 'Alley Rat', 'dark_forest', false, 40, 10, 3, 7, 20, 12, 'rat'),
    ('rat_fighter_1', 'Rat Brawler', 'dark_forest', false, 50, 12, 4, 6, 25, 15, 'rat_fighter'),
    ('rat_mage_1', 'Rat Sorcerer', 'dark_forest', false, 35, 14, 2, 8, 28, 18, 'rat_mage'),
    ('rat_warrior_boss', 'Rat Warlord', 'dark_forest', true, 180, 18, 12, 8, 150, 75, 'rat_warrior'),

    -- Fish Docks (fish_docks background) - Fish themed
    ('tuna_can_1', 'Angry Tuna Can', 'crystal_caves', false, 55, 14, 8, 4, 35, 20, 'tuna_can'),
    ('fishmonger_1', 'Fishmonger', 'crystal_caves', false, 70, 16, 6, 5, 40, 25, 'fishmonger'),
    ('slime_purple_1', 'Toxic Slime', 'crystal_caves', false, 45, 18, 4, 6, 38, 22, NULL),
    ('can_opener_boss', 'The Great Can Opener', 'crystal_caves', true, 320, 25, 18, 6, 300, 150, 'can_opener_boss'),

    -- Dog Park (alley_night background) - Dogs!
    ('dog_1', 'Stray Dog', 'haunted_library', false, 60, 20, 8, 9, 50, 30, 'dog'),
    ('ruff_dog_1', 'Ruff Doggo', 'haunted_library', false, 75, 22, 10, 7, 55, 35, 'ruff_dog'),
    ('squirrel_warrior_1', 'Squirrel Scout', 'haunted_library', false, 45, 24, 5, 12, 48, 28, 'squirrel_warrior'),
    ('dog_warrior_boss', 'Dog Champion', 'haunted_library', true, 450, 30, 20, 10, 500, 250, 'dog_warrior'),

    -- Tuna Springs (tuna_springs background) - Mixed threats
    ('yarn_elemental_1', 'Yarn Elemental', 'dragons_peak', false, 80, 28, 12, 8, 80, 45, 'yarn_elemental'),
    ('nerf_ranger_1', 'Nerf Ranger', 'dragons_peak', false, 70, 32, 8, 14, 85, 50, 'nerf_ranger'),
    ('rat_necromancer_1', 'Rat Necromancer', 'dragons_peak', false, 90, 30, 10, 9, 90, 55, 'rat_necromancer'),
    ('roomba_boss', 'The Roomba', 'dragons_peak', true, 700, 42, 28, 12, 1000, 500, 'roomba'),

    -- Moonlit Lake (moonlake background) - Final challenges
    ('rat_ranger_1', 'Rat Sniper', 'void_realm', false, 100, 45, 12, 16, 150, 80, 'rat_ranger'),
    ('slime_purple_2', 'Void Slime', 'void_realm', false, 120, 40, 18, 10, 160, 85, NULL),
    ('yarn_elemental_2', 'Chaos Yarn', 'void_realm', false, 140, 48, 20, 11, 180, 95, 'yarn_elemental'),
    ('big_rubber_ducky_boss', 'Giant Rubber Ducky', 'void_realm', true, 1400, 58, 38, 18, 2500, 1000, 'big_rubber_ducky')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    dungeon_id = EXCLUDED.dungeon_id,
    is_boss = EXCLUDED.is_boss,
    base_hp = EXCLUDED.base_hp,
    base_attack = EXCLUDED.base_attack,
    base_defense = EXCLUDED.base_defense,
    base_speed = EXCLUDED.base_speed,
    xp_reward = EXCLUDED.xp_reward,
    gold_reward = EXCLUDED.gold_reward,
    sprite_key = EXCLUDED.sprite_key;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN public.study_quest_enemies.sprite_key IS 'Battler asset key matching files in assets/sprites/studyquest/battlers/';
COMMENT ON COLUMN public.study_quest_dungeons.sprite_key IS 'Background asset key matching files in assets/sprites/studyquest/backgrounds/';
