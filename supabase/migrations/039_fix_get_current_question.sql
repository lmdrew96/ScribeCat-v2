-- Migration 039: Fix ambiguous column reference in get_current_game_question
--
-- The issue: RLS policy uses is_user_in_game_room which JOINs tables,
-- causing 'id' column to be ambiguous when RPC function returns it.
--
-- Solution: Use explicit column aliases in the RETURN QUERY to avoid ambiguity

CREATE OR REPLACE FUNCTION public.get_current_game_question(
    p_game_session_id UUID
)
RETURNS TABLE (
    id UUID,
    question_index INTEGER,
    question_data JSONB,
    category TEXT,
    difficulty TEXT,
    points INTEGER,
    time_limit_seconds INTEGER
) AS $$
DECLARE
    v_current_index INTEGER;
BEGIN
    -- Get current question index
    SELECT gs.current_question_index INTO v_current_index
    FROM public.game_sessions gs
    WHERE gs.id = p_game_session_id;

    -- Return the question (without correct answer for security)
    -- Use explicit aliases to avoid ambiguity with RLS policies
    RETURN QUERY
    SELECT
        gq.id AS id,
        gq.question_index AS question_index,
        gq.question_data AS question_data,
        gq.category AS category,
        gq.difficulty AS difficulty,
        gq.points AS points,
        gq.time_limit_seconds AS time_limit_seconds
    FROM public.game_questions gq
    WHERE gq.game_session_id = p_game_session_id
    AND gq.question_index = v_current_index
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure grants are still in place
GRANT EXECUTE ON FUNCTION public.get_current_game_question TO authenticated;
