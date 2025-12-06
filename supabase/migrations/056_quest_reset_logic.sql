-- Migration 056: Quest Reset Logic for StudyQuest
-- Resets daily quests at midnight, weekly quests on Mondays

-- ============================================================================
-- Quest Reset Function
-- ============================================================================

-- Function to check and reset expired quests for a user
CREATE OR REPLACE FUNCTION public.study_quest_check_quest_resets(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_today DATE := CURRENT_DATE;
  v_monday DATE := date_trunc('week', CURRENT_DATE)::DATE;
  v_character_id UUID;
BEGIN
  -- Get the user's character ID
  SELECT id INTO v_character_id
  FROM public.study_quest_characters
  WHERE user_id = p_user_id;

  IF v_character_id IS NULL THEN
    -- No character found, nothing to reset
    RETURN;
  END IF;

  -- Reset daily quests if last_reset was before today
  UPDATE public.study_quest_progress p
  SET
    current_progress = 0,
    is_completed = false,
    completed_at = NULL,
    last_reset_at = v_now,
    updated_at = v_now
  FROM public.study_quest_quests q
  WHERE p.quest_id = q.id
    AND p.character_id = v_character_id
    AND q.quest_type = 'daily'
    AND (p.last_reset_at IS NULL OR p.last_reset_at::DATE < v_today);

  -- Reset weekly quests if last_reset was before this Monday
  UPDATE public.study_quest_progress p
  SET
    current_progress = 0,
    is_completed = false,
    completed_at = NULL,
    last_reset_at = v_now,
    updated_at = v_now
  FROM public.study_quest_quests q
  WHERE p.quest_id = q.id
    AND p.character_id = v_character_id
    AND q.quest_type = 'weekly'
    AND (p.last_reset_at IS NULL OR p.last_reset_at::DATE < v_monday);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.study_quest_check_quest_resets TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION public.study_quest_check_quest_resets IS
  'Resets daily and weekly quest progress when appropriate. Call when loading character.';
