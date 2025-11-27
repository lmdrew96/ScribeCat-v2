-- Final Jeopardy wagers table
-- Tracks each player's wager before the question is revealed

CREATE TABLE IF NOT EXISTS public.final_jeopardy_wagers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wager_amount INTEGER NOT NULL CHECK (wager_amount >= 0),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_session_id, user_id)
);

-- Enable RLS
ALTER TABLE public.final_jeopardy_wagers ENABLE ROW LEVEL SECURITY;

-- RLS policies - participants can view and submit wagers for their game
CREATE POLICY "Participants can view FJ wagers" ON public.final_jeopardy_wagers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.game_sessions gs
            JOIN public.room_participants rp ON rp.room_id = gs.room_id
            WHERE gs.id = game_session_id
            AND rp.user_id = auth.uid()
            AND rp.is_active = true
        )
    );

CREATE POLICY "Participants can submit their FJ wager" ON public.final_jeopardy_wagers
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.game_sessions gs
            JOIN public.room_participants rp ON rp.room_id = gs.room_id
            WHERE gs.id = game_session_id
            AND rp.user_id = auth.uid()
            AND rp.is_active = true
        )
    );

-- Enable realtime for FJ wagers
ALTER PUBLICATION supabase_realtime ADD TABLE public.final_jeopardy_wagers;

-- Submit Final Jeopardy wager
CREATE OR REPLACE FUNCTION public.submit_final_jeopardy_wager(
    p_game_session_id UUID,
    p_user_id UUID,
    p_wager_amount INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert or update wager (in case player changes their mind before question reveal)
    INSERT INTO public.final_jeopardy_wagers (game_session_id, user_id, wager_amount)
    VALUES (p_game_session_id, p_user_id, p_wager_amount)
    ON CONFLICT (game_session_id, user_id)
    DO UPDATE SET wager_amount = p_wager_amount, submitted_at = NOW();

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if all players have submitted FJ wagers
CREATE OR REPLACE FUNCTION public.all_final_jeopardy_wagers_submitted(
    p_game_session_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_participant_count INTEGER;
    v_wager_count INTEGER;
BEGIN
    -- Count active participants in the room
    SELECT COUNT(*) INTO v_participant_count
    FROM public.game_sessions gs
    JOIN public.room_participants rp ON rp.room_id = gs.room_id
    WHERE gs.id = p_game_session_id
    AND rp.is_active = true;

    -- Count submitted wagers
    SELECT COUNT(*) INTO v_wager_count
    FROM public.final_jeopardy_wagers
    WHERE game_session_id = p_game_session_id;

    RETURN v_wager_count >= v_participant_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get Final Jeopardy wagers for a game
CREATE OR REPLACE FUNCTION public.get_final_jeopardy_wagers(
    p_game_session_id UUID
)
RETURNS TABLE (
    user_id UUID,
    wager_amount INTEGER,
    submitted_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT fjw.user_id, fjw.wager_amount, fjw.submitted_at
    FROM public.final_jeopardy_wagers fjw
    WHERE fjw.game_session_id = p_game_session_id
    ORDER BY fjw.submitted_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get a specific player's FJ wager
CREATE OR REPLACE FUNCTION public.get_player_final_jeopardy_wager(
    p_game_session_id UUID,
    p_user_id UUID
)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT wager_amount
        FROM public.final_jeopardy_wagers
        WHERE game_session_id = p_game_session_id
        AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if all players have answered Final Jeopardy
CREATE OR REPLACE FUNCTION public.all_final_jeopardy_answers_submitted(
    p_game_session_id UUID,
    p_question_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_participant_count INTEGER;
    v_answer_count INTEGER;
BEGIN
    -- Count active participants in the room
    SELECT COUNT(*) INTO v_participant_count
    FROM public.game_sessions gs
    JOIN public.room_participants rp ON rp.room_id = gs.room_id
    WHERE gs.id = p_game_session_id
    AND rp.is_active = true;

    -- Count submitted answers for this question
    SELECT COUNT(*) INTO v_answer_count
    FROM public.player_scores
    WHERE game_session_id = p_game_session_id
    AND question_id = p_question_id;

    RETURN v_answer_count >= v_participant_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.submit_final_jeopardy_wager(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.all_final_jeopardy_wagers_submitted(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_final_jeopardy_wagers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_final_jeopardy_wager(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.all_final_jeopardy_answers_submitted(UUID, UUID) TO authenticated;
