-- Migration 055: StudyQuest RPG System
-- Single-player retro RPG mini-game that rewards studying with XP and gold

-- ============================================================================
-- Tables
-- ============================================================================

-- Character Classes
CREATE TABLE IF NOT EXISTS public.study_quest_classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    base_hp INTEGER NOT NULL DEFAULT 100,
    base_attack INTEGER NOT NULL DEFAULT 10,
    base_defense INTEGER NOT NULL DEFAULT 5,
    base_speed INTEGER NOT NULL DEFAULT 5,
    special_bonus TEXT, -- 'xp_gain', 'gold_gain', 'crit_chance'
    special_bonus_percent INTEGER DEFAULT 25,
    sprite_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default classes
INSERT INTO public.study_quest_classes (id, name, description, base_hp, base_attack, base_defense, base_speed, special_bonus, special_bonus_percent, sprite_key)
VALUES
    ('scholar', 'Scholar', 'A wise student who gains extra experience from their studies.', 80, 8, 6, 8, 'xp_gain', 25, 'scholar'),
    ('knight', 'Knight', 'A stalwart warrior who earns more gold from their adventures.', 120, 10, 8, 4, 'gold_gain', 25, 'knight'),
    ('rogue', 'Rogue', 'A swift adventurer with a keen eye for critical strikes.', 90, 12, 4, 10, 'crit_chance', 25, 'rogue')
ON CONFLICT (id) DO NOTHING;

-- Player Characters
CREATE TABLE IF NOT EXISTS public.study_quest_characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    class_id TEXT NOT NULL REFERENCES public.study_quest_classes(id),
    level INTEGER NOT NULL DEFAULT 1,
    current_xp INTEGER NOT NULL DEFAULT 0,
    total_xp_earned INTEGER NOT NULL DEFAULT 0,
    gold INTEGER NOT NULL DEFAULT 100,
    hp INTEGER NOT NULL DEFAULT 100,
    max_hp INTEGER NOT NULL DEFAULT 100,
    attack INTEGER NOT NULL DEFAULT 10,
    defense INTEGER NOT NULL DEFAULT 5,
    speed INTEGER NOT NULL DEFAULT 5,
    equipped_weapon_id UUID,
    equipped_armor_id UUID,
    equipped_accessory_id UUID,
    current_dungeon_id TEXT,
    current_floor INTEGER DEFAULT 0,
    battles_won INTEGER NOT NULL DEFAULT 0,
    battles_lost INTEGER NOT NULL DEFAULT 0,
    dungeons_completed INTEGER NOT NULL DEFAULT 0,
    quests_completed INTEGER NOT NULL DEFAULT 0,
    highest_dungeon_floor INTEGER NOT NULL DEFAULT 0,
    last_daily_reward_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Items (weapons, armor, consumables)
CREATE TABLE IF NOT EXISTS public.study_quest_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    item_type TEXT NOT NULL CHECK (item_type IN ('weapon', 'armor', 'accessory', 'consumable', 'key_item')),
    rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')) DEFAULT 'common',
    tier INTEGER NOT NULL DEFAULT 1,
    attack_bonus INTEGER DEFAULT 0,
    defense_bonus INTEGER DEFAULT 0,
    speed_bonus INTEGER DEFAULT 0,
    hp_bonus INTEGER DEFAULT 0,
    effect_type TEXT, -- 'heal', 'damage', 'buff', etc.
    effect_value INTEGER DEFAULT 0,
    buy_price INTEGER,
    sell_price INTEGER,
    required_level INTEGER DEFAULT 1,
    sprite_key TEXT,
    is_purchasable BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Player Inventory
CREATE TABLE IF NOT EXISTS public.study_quest_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES public.study_quest_characters(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.study_quest_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(character_id, item_id)
);

-- Dungeons
CREATE TABLE IF NOT EXISTS public.study_quest_dungeons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    required_level INTEGER NOT NULL DEFAULT 1,
    floor_count INTEGER NOT NULL DEFAULT 3,
    encounters_per_floor INTEGER NOT NULL DEFAULT 3,
    boss_name TEXT,
    boss_sprite_key TEXT,
    theme TEXT, -- 'forest', 'cave', 'library', 'volcano', 'void'
    xp_multiplier NUMERIC(3,2) DEFAULT 1.0,
    gold_multiplier NUMERIC(3,2) DEFAULT 1.0,
    unlock_order INTEGER NOT NULL DEFAULT 0,
    sprite_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default dungeons
INSERT INTO public.study_quest_dungeons (id, name, description, required_level, floor_count, encounters_per_floor, boss_name, theme, unlock_order)
VALUES
    ('training_grounds', 'Training Grounds', 'A safe place for new adventurers to hone their skills.', 1, 2, 2, 'Training Dummy', 'training', 1),
    ('dark_forest', 'Dark Forest', 'An ancient forest filled with mysterious creatures.', 5, 3, 3, 'Forest Guardian', 'forest', 2),
    ('crystal_caves', 'Crystal Caves', 'Glittering caverns hiding valuable treasures.', 10, 3, 3, 'Crystal Golem', 'cave', 3),
    ('haunted_library', 'Haunted Library', 'Knowledge awaits those brave enough to seek it.', 15, 4, 3, 'The Librarian', 'library', 4),
    ('dragons_peak', 'Dragon''s Peak', 'The fiery mountain where dragons dwell.', 25, 4, 4, 'Elder Dragon', 'volcano', 5),
    ('void_realm', 'Void Realm', 'The ultimate challenge for legendary heroes.', 40, 5, 4, 'Void Emperor', 'void', 6)
ON CONFLICT (id) DO NOTHING;

-- Enemies
CREATE TABLE IF NOT EXISTS public.study_quest_enemies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dungeon_id TEXT REFERENCES public.study_quest_dungeons(id),
    is_boss BOOLEAN DEFAULT false,
    base_hp INTEGER NOT NULL DEFAULT 50,
    base_attack INTEGER NOT NULL DEFAULT 8,
    base_defense INTEGER NOT NULL DEFAULT 3,
    base_speed INTEGER NOT NULL DEFAULT 5,
    xp_reward INTEGER NOT NULL DEFAULT 20,
    gold_reward INTEGER NOT NULL DEFAULT 10,
    level_scaling NUMERIC(3,2) DEFAULT 1.0, -- How much stats scale with floor
    drop_item_id UUID REFERENCES public.study_quest_items(id),
    drop_chance NUMERIC(3,2) DEFAULT 0.1,
    sprite_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default enemies
INSERT INTO public.study_quest_enemies (id, name, dungeon_id, is_boss, base_hp, base_attack, base_defense, base_speed, xp_reward, gold_reward)
VALUES
    -- Training Grounds
    ('training_dummy', 'Training Dummy', 'training_grounds', true, 80, 5, 2, 3, 50, 25),
    ('practice_target', 'Practice Target', 'training_grounds', false, 30, 4, 2, 3, 10, 5),
    -- Dark Forest
    ('forest_guardian', 'Forest Guardian', 'dark_forest', true, 200, 18, 12, 8, 150, 75),
    ('wolf', 'Wild Wolf', 'dark_forest', false, 45, 12, 4, 8, 25, 12),
    ('goblin', 'Goblin', 'dark_forest', false, 40, 10, 3, 6, 20, 15),
    ('treant', 'Treant', 'dark_forest', false, 60, 8, 10, 2, 30, 10),
    -- Crystal Caves
    ('crystal_golem', 'Crystal Golem', 'crystal_caves', true, 350, 25, 20, 5, 300, 150),
    ('cave_bat', 'Cave Bat', 'crystal_caves', false, 35, 14, 2, 12, 30, 18),
    ('rock_elemental', 'Rock Elemental', 'crystal_caves', false, 80, 12, 15, 3, 40, 20),
    ('gem_spider', 'Gem Spider', 'crystal_caves', false, 50, 16, 6, 9, 35, 25),
    -- Haunted Library
    ('librarian', 'The Librarian', 'haunted_library', true, 500, 30, 18, 12, 500, 250),
    ('ghost_scholar', 'Ghost Scholar', 'haunted_library', false, 55, 20, 5, 10, 50, 30),
    ('living_book', 'Living Book', 'haunted_library', false, 40, 18, 8, 8, 45, 25),
    ('exam_specter', 'Exam Specter', 'haunted_library', false, 70, 22, 10, 7, 60, 35),
    -- Dragon's Peak
    ('elder_dragon', 'Elder Dragon', 'dragons_peak', true, 800, 45, 30, 15, 1000, 500),
    ('fire_imp', 'Fire Imp', 'dragons_peak', false, 60, 28, 8, 14, 80, 45),
    ('lava_slug', 'Lava Slug', 'dragons_peak', false, 90, 24, 18, 4, 70, 40),
    ('drake', 'Drake', 'dragons_peak', false, 120, 32, 15, 10, 100, 55),
    -- Void Realm
    ('void_emperor', 'Void Emperor', 'void_realm', true, 1500, 60, 40, 20, 2500, 1000),
    ('shadow_wraith', 'Shadow Wraith', 'void_realm', false, 100, 40, 12, 18, 150, 80),
    ('void_walker', 'Void Walker', 'void_realm', false, 130, 45, 20, 15, 180, 90),
    ('nightmare', 'Nightmare', 'void_realm', false, 150, 50, 25, 12, 200, 100)
ON CONFLICT (id) DO NOTHING;

-- Quests
CREATE TABLE IF NOT EXISTS public.study_quest_quests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    quest_type TEXT NOT NULL CHECK (quest_type IN ('daily', 'weekly', 'story', 'achievement')),
    requirement_type TEXT NOT NULL CHECK (requirement_type IN ('study_time', 'battles_won', 'dungeon_complete', 'level_reach', 'gold_earn', 'xp_earn', 'items_collect', 'ai_tools')),
    requirement_value INTEGER NOT NULL,
    reward_xp INTEGER NOT NULL DEFAULT 0,
    reward_gold INTEGER NOT NULL DEFAULT 0,
    reward_item_id UUID REFERENCES public.study_quest_items(id),
    is_repeatable BOOLEAN DEFAULT false,
    unlock_level INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default quests
INSERT INTO public.study_quest_quests (id, name, description, quest_type, requirement_type, requirement_value, reward_xp, reward_gold, is_repeatable)
VALUES
    -- Daily quests
    ('daily_study_15', 'Daily Scholar', 'Study for 15 minutes today.', 'daily', 'study_time', 15, 50, 25, true),
    ('daily_study_30', 'Dedicated Learner', 'Study for 30 minutes today.', 'daily', 'study_time', 30, 100, 50, true),
    ('daily_battles_3', 'Battle Practice', 'Win 3 battles today.', 'daily', 'battles_won', 3, 75, 35, true),
    ('daily_ai_tools', 'AI Assistant', 'Use 5 AI tools today.', 'daily', 'ai_tools', 5, 60, 30, true),
    -- Weekly quests
    ('weekly_study_300', 'Weekly Scholar', 'Study for 5 hours this week.', 'weekly', 'study_time', 300, 500, 250, true),
    ('weekly_dungeon', 'Dungeon Master', 'Complete a dungeon this week.', 'weekly', 'dungeon_complete', 1, 400, 200, true),
    ('weekly_battles_20', 'Battle Veteran', 'Win 20 battles this week.', 'weekly', 'battles_won', 20, 350, 175, true),
    -- Story quests
    ('story_first_battle', 'First Blood', 'Win your first battle.', 'story', 'battles_won', 1, 100, 50, false),
    ('story_level_5', 'Rising Star', 'Reach level 5.', 'story', 'level_reach', 5, 200, 100, false),
    ('story_level_10', 'Seasoned Adventurer', 'Reach level 10.', 'story', 'level_reach', 10, 400, 200, false),
    ('story_first_dungeon', 'Dungeon Crawler', 'Complete your first dungeon.', 'story', 'dungeon_complete', 1, 300, 150, false),
    ('story_level_25', 'Elite Warrior', 'Reach level 25.', 'story', 'level_reach', 25, 800, 400, false),
    ('story_level_50', 'Legendary Hero', 'Reach the maximum level.', 'story', 'level_reach', 50, 2000, 1000, false)
ON CONFLICT (id) DO NOTHING;

-- Player Quest Progress
CREATE TABLE IF NOT EXISTS public.study_quest_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES public.study_quest_characters(id) ON DELETE CASCADE,
    quest_id TEXT NOT NULL REFERENCES public.study_quest_quests(id) ON DELETE CASCADE,
    current_progress INTEGER NOT NULL DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    last_reset_at TIMESTAMPTZ, -- For daily/weekly reset tracking
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(character_id, quest_id)
);

-- Combat Log (for battle history)
CREATE TABLE IF NOT EXISTS public.study_quest_combat_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES public.study_quest_characters(id) ON DELETE CASCADE,
    enemy_id TEXT NOT NULL REFERENCES public.study_quest_enemies(id),
    dungeon_id TEXT REFERENCES public.study_quest_dungeons(id),
    floor_number INTEGER,
    result TEXT NOT NULL CHECK (result IN ('victory', 'defeat', 'fled')),
    damage_dealt INTEGER NOT NULL DEFAULT 0,
    damage_taken INTEGER NOT NULL DEFAULT 0,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    gold_earned INTEGER NOT NULL DEFAULT 0,
    item_dropped_id UUID REFERENCES public.study_quest_items(id),
    turns_taken INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_study_quest_characters_user ON public.study_quest_characters(user_id);
CREATE INDEX IF NOT EXISTS idx_study_quest_characters_level ON public.study_quest_characters(level);
CREATE INDEX IF NOT EXISTS idx_study_quest_inventory_character ON public.study_quest_inventory(character_id);
CREATE INDEX IF NOT EXISTS idx_study_quest_inventory_item ON public.study_quest_inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_study_quest_enemies_dungeon ON public.study_quest_enemies(dungeon_id);
CREATE INDEX IF NOT EXISTS idx_study_quest_progress_character ON public.study_quest_progress(character_id);
CREATE INDEX IF NOT EXISTS idx_study_quest_progress_quest ON public.study_quest_progress(quest_id);
CREATE INDEX IF NOT EXISTS idx_study_quest_combat_log_character ON public.study_quest_combat_log(character_id);
CREATE INDEX IF NOT EXISTS idx_study_quest_combat_log_created ON public.study_quest_combat_log(created_at DESC);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update updated_at timestamp
CREATE TRIGGER trigger_study_quest_characters_updated_at
    BEFORE UPDATE ON public.study_quest_characters
    FOR EACH ROW
    EXECUTE FUNCTION public.update_game_sessions_updated_at();

CREATE TRIGGER trigger_study_quest_progress_updated_at
    BEFORE UPDATE ON public.study_quest_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.update_game_sessions_updated_at();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Calculate XP needed for next level
CREATE OR REPLACE FUNCTION public.study_quest_xp_for_level(p_level INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- Formula: 100 + (level * 50)
    RETURN 100 + (p_level * 50);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate total XP needed to reach a level
CREATE OR REPLACE FUNCTION public.study_quest_total_xp_for_level(p_level INTEGER)
RETURNS INTEGER AS $$
DECLARE
    total INTEGER := 0;
    i INTEGER;
BEGIN
    FOR i IN 1..(p_level - 1) LOOP
        total := total + public.study_quest_xp_for_level(i);
    END LOOP;
    RETURN total;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add XP to character and handle level ups
CREATE OR REPLACE FUNCTION public.study_quest_add_xp(
    p_character_id UUID,
    p_xp_amount INTEGER
)
RETURNS TABLE (
    new_level INTEGER,
    new_xp INTEGER,
    levels_gained INTEGER,
    hp_gained INTEGER,
    attack_gained INTEGER,
    defense_gained INTEGER,
    speed_gained INTEGER
) AS $$
DECLARE
    v_character RECORD;
    v_xp_needed INTEGER;
    v_levels_gained INTEGER := 0;
    v_hp_gained INTEGER := 0;
    v_attack_gained INTEGER := 0;
    v_defense_gained INTEGER := 0;
    v_speed_gained INTEGER := 0;
BEGIN
    -- Get current character
    SELECT * INTO v_character FROM public.study_quest_characters WHERE id = p_character_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Character not found';
    END IF;

    -- Add XP
    v_character.current_xp := v_character.current_xp + p_xp_amount;
    v_character.total_xp_earned := v_character.total_xp_earned + p_xp_amount;

    -- Check for level ups (max level 50)
    WHILE v_character.level < 50 LOOP
        v_xp_needed := public.study_quest_xp_for_level(v_character.level);

        IF v_character.current_xp >= v_xp_needed THEN
            v_character.current_xp := v_character.current_xp - v_xp_needed;
            v_character.level := v_character.level + 1;
            v_levels_gained := v_levels_gained + 1;

            -- Stat increases per level
            v_hp_gained := v_hp_gained + 10;
            v_attack_gained := v_attack_gained + 2;
            v_defense_gained := v_defense_gained + 1;
            v_speed_gained := v_speed_gained + 1;
        ELSE
            EXIT;
        END IF;
    END LOOP;

    -- Apply stat gains
    v_character.max_hp := v_character.max_hp + v_hp_gained;
    v_character.hp := v_character.hp + v_hp_gained; -- Also heal by the amount gained
    v_character.attack := v_character.attack + v_attack_gained;
    v_character.defense := v_character.defense + v_defense_gained;
    v_character.speed := v_character.speed + v_speed_gained;

    -- Update character
    UPDATE public.study_quest_characters
    SET
        level = v_character.level,
        current_xp = v_character.current_xp,
        total_xp_earned = v_character.total_xp_earned,
        max_hp = v_character.max_hp,
        hp = v_character.hp,
        attack = v_character.attack,
        defense = v_character.defense,
        speed = v_character.speed,
        last_activity_at = NOW()
    WHERE id = p_character_id;

    -- Return results
    new_level := v_character.level;
    new_xp := v_character.current_xp;
    levels_gained := v_levels_gained;
    hp_gained := v_hp_gained;
    attack_gained := v_attack_gained;
    defense_gained := v_defense_gained;
    speed_gained := v_speed_gained;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get global leaderboard
CREATE OR REPLACE FUNCTION public.study_quest_leaderboard(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    user_id UUID,
    character_name TEXT,
    class_id TEXT,
    level INTEGER,
    total_xp_earned INTEGER,
    dungeons_completed INTEGER,
    battles_won INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.user_id,
        c.name,
        c.class_id,
        c.level,
        c.total_xp_earned,
        c.dungeons_completed,
        c.battles_won
    FROM public.study_quest_characters c
    ORDER BY c.level DESC, c.total_xp_earned DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.study_quest_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_quest_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_quest_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_quest_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_quest_dungeons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_quest_enemies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_quest_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_quest_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_quest_combat_log ENABLE ROW LEVEL SECURITY;

-- Classes - everyone can read
CREATE POLICY "Anyone can view classes"
    ON public.study_quest_classes FOR SELECT
    USING (true);

-- Characters - users can CRUD their own
CREATE POLICY "Users can view their own character"
    ON public.study_quest_characters FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own character"
    ON public.study_quest_characters FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own character"
    ON public.study_quest_characters FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own character"
    ON public.study_quest_characters FOR DELETE
    USING (user_id = auth.uid());

-- Items - everyone can read
CREATE POLICY "Anyone can view items"
    ON public.study_quest_items FOR SELECT
    USING (true);

-- Inventory - users can manage their own
CREATE POLICY "Users can view their own inventory"
    ON public.study_quest_inventory FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.study_quest_characters c
            WHERE c.id = character_id AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can add to their own inventory"
    ON public.study_quest_inventory FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.study_quest_characters c
            WHERE c.id = character_id AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own inventory"
    ON public.study_quest_inventory FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.study_quest_characters c
            WHERE c.id = character_id AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete from their own inventory"
    ON public.study_quest_inventory FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.study_quest_characters c
            WHERE c.id = character_id AND c.user_id = auth.uid()
        )
    );

-- Dungeons - everyone can read
CREATE POLICY "Anyone can view dungeons"
    ON public.study_quest_dungeons FOR SELECT
    USING (true);

-- Enemies - everyone can read
CREATE POLICY "Anyone can view enemies"
    ON public.study_quest_enemies FOR SELECT
    USING (true);

-- Quests - everyone can read
CREATE POLICY "Anyone can view quests"
    ON public.study_quest_quests FOR SELECT
    USING (true);

-- Quest Progress - users can manage their own
CREATE POLICY "Users can view their own quest progress"
    ON public.study_quest_progress FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.study_quest_characters c
            WHERE c.id = character_id AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create their own quest progress"
    ON public.study_quest_progress FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.study_quest_characters c
            WHERE c.id = character_id AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own quest progress"
    ON public.study_quest_progress FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.study_quest_characters c
            WHERE c.id = character_id AND c.user_id = auth.uid()
        )
    );

-- Combat Log - users can view and create their own
CREATE POLICY "Users can view their own combat log"
    ON public.study_quest_combat_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.study_quest_characters c
            WHERE c.id = character_id AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can add to their own combat log"
    ON public.study_quest_combat_log FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.study_quest_characters c
            WHERE c.id = character_id AND c.user_id = auth.uid()
        )
    );

-- ============================================================================
-- Grants
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.study_quest_classes TO authenticated;
GRANT ALL ON public.study_quest_characters TO authenticated;
GRANT SELECT ON public.study_quest_items TO authenticated;
GRANT ALL ON public.study_quest_inventory TO authenticated;
GRANT SELECT ON public.study_quest_dungeons TO authenticated;
GRANT SELECT ON public.study_quest_enemies TO authenticated;
GRANT SELECT ON public.study_quest_quests TO authenticated;
GRANT ALL ON public.study_quest_progress TO authenticated;
GRANT ALL ON public.study_quest_combat_log TO authenticated;

GRANT EXECUTE ON FUNCTION public.study_quest_xp_for_level TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_quest_total_xp_for_level TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_quest_add_xp TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_quest_leaderboard TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.study_quest_classes IS 'Character classes for StudyQuest RPG';
COMMENT ON TABLE public.study_quest_characters IS 'Player characters for StudyQuest RPG';
COMMENT ON TABLE public.study_quest_items IS 'Items, weapons, armor, and consumables';
COMMENT ON TABLE public.study_quest_inventory IS 'Player inventory for StudyQuest';
COMMENT ON TABLE public.study_quest_dungeons IS 'Dungeon definitions with floors and encounters';
COMMENT ON TABLE public.study_quest_enemies IS 'Enemy types and stats for each dungeon';
COMMENT ON TABLE public.study_quest_quests IS 'Quest definitions (daily, weekly, story)';
COMMENT ON TABLE public.study_quest_progress IS 'Player quest progress tracking';
COMMENT ON TABLE public.study_quest_combat_log IS 'Battle history for analytics';
