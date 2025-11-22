-- Fix get_game_leaderboard to include user profile information
-- This fixes leaderboard showing "Player" instead of actual user names

-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS public.get_game_leaderboard(UUID);

CREATE OR REPLACE FUNCTION public.get_game_leaderboard(
    p_game_session_id UUID
)
RETURNS TABLE (
    user_id UUID,
    user_email TEXT,
    user_full_name TEXT,
    user_avatar_url TEXT,
    total_score INTEGER,
    correct_answers INTEGER,
    total_answers INTEGER,
    avg_time_ms NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ps.user_id,
        up.email AS user_email,
        up.full_name AS user_full_name,
        up.avatar_url AS user_avatar_url,
        COALESCE(SUM(ps.points_earned), 0)::INTEGER AS total_score,
        COUNT(*) FILTER (WHERE ps.is_correct = true)::INTEGER AS correct_answers,
        COUNT(*)::INTEGER AS total_answers,
        ROUND(AVG(ps.time_taken_ms))::NUMERIC AS avg_time_ms
    FROM public.player_scores ps
    LEFT JOIN public.user_profiles up ON ps.user_id = up.id
    WHERE ps.game_session_id = p_game_session_id
    GROUP BY ps.user_id, up.email, up.full_name, up.avatar_url
    ORDER BY total_score DESC, avg_time_ms ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
