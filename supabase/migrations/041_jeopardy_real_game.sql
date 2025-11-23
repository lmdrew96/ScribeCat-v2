-- Migration 041: Real Jeopardy Game Mechanics
-- Transform Jeopardy from Quiz Battle clone into authentic game show experience
-- Features: Question selection, buzzer system, turn rotation, Daily Doubles, Final Jeopardy

-- ============================================================================
-- New Tables
-- ============================================================================

-- Buzzer Presses
-- Tracks who buzzed in and when for each question (critical for fair buzzer timing)
CREATE TABLE IF NOT EXISTS public.buzzer_presses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.game_questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    pressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    buzzer_rank INTEGER, -- 1st, 2nd, 3rd to press (calculated on insert)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Schema Updates
-- ============================================================================

-- Update game_sessions for Jeopardy state tracking
ALTER TABLE public.game_sessions
    ADD COLUMN IF NOT EXISTS current_player_id UUID REFERENCES public.user_profiles(id), -- Whose turn to select question
    ADD COLUMN IF NOT EXISTS selected_question_id UUID REFERENCES public.game_questions(id), -- Currently active question
    ADD COLUMN IF NOT EXISTS round TEXT CHECK (round IN ('regular', 'final_jeopardy')) DEFAULT 'regular', -- Game round
    ADD COLUMN IF NOT EXISTS board_state JSONB DEFAULT '{}'::jsonb; -- Track answered questions

-- Update game_questions for Jeopardy-specific features
ALTER TABLE public.game_questions
    ADD COLUMN IF NOT EXISTS is_selected BOOLEAN DEFAULT false, -- Has this question been picked?
    ADD COLUMN IF NOT EXISTS selected_by_user_id UUID REFERENCES public.user_profiles(id), -- Who picked it
    ADD COLUMN IF NOT EXISTS is_daily_double BOOLEAN DEFAULT false, -- Special question with wager
    ADD COLUMN IF NOT EXISTS is_final_jeopardy BOOLEAN DEFAULT false, -- Final round question
    ADD COLUMN IF NOT EXISTS column_position INTEGER; -- Position in category (1-5 for 100-500 points)

-- Update player_scores to support multiple attempts per question
-- Drop the unique constraint so multiple players can attempt same question
ALTER TABLE public.player_scores
    DROP CONSTRAINT IF EXISTS unique_player_answer,
    ADD COLUMN IF NOT EXISTS buzzer_rank INTEGER, -- Order they buzzed in (1st, 2nd, 3rd)
    ADD COLUMN IF NOT EXISTS wager_amount INTEGER, -- For Daily Doubles and Final Jeopardy
    ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1; -- Track sequential attempts

-- Add new unique constraint: one answer per player per question per attempt
ALTER TABLE public.player_scores
    ADD CONSTRAINT unique_player_question_attempt UNIQUE (game_session_id, user_id, question_id, attempt_number);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_buzzer_presses_game ON public.buzzer_presses(game_session_id);
CREATE INDEX IF NOT EXISTS idx_buzzer_presses_question ON public.buzzer_presses(question_id);
CREATE INDEX IF NOT EXISTS idx_buzzer_presses_user ON public.buzzer_presses(user_id);
CREATE INDEX IF NOT EXISTS idx_buzzer_presses_timing ON public.buzzer_presses(question_id, pressed_at); -- For ranking

CREATE INDEX IF NOT EXISTS idx_game_sessions_current_player ON public.game_sessions(current_player_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_selected_question ON public.game_sessions(selected_question_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_round ON public.game_sessions(round);

CREATE INDEX IF NOT EXISTS idx_game_questions_category ON public.game_questions(game_session_id, category);
CREATE INDEX IF NOT EXISTS idx_game_questions_selected ON public.game_questions(game_session_id, is_selected);
CREATE INDEX IF NOT EXISTS idx_game_questions_daily_double ON public.game_questions(game_session_id, is_daily_double);
CREATE INDEX IF NOT EXISTS idx_game_questions_final_jeopardy ON public.game_questions(is_final_jeopardy) WHERE is_final_jeopardy = true;

CREATE INDEX IF NOT EXISTS idx_player_scores_buzzer_rank ON public.player_scores(question_id, buzzer_rank);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-calculate buzzer rank on insert
CREATE OR REPLACE FUNCTION public.calculate_buzzer_rank()
RETURNS TRIGGER AS $$
DECLARE
    v_rank INTEGER;
BEGIN
    -- Calculate this user's rank for this question based on timestamp
    SELECT COUNT(*) + 1 INTO v_rank
    FROM public.buzzer_presses
    WHERE question_id = NEW.question_id
    AND pressed_at < NEW.pressed_at;

    NEW.buzzer_rank = v_rank;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_buzzer_rank
    BEFORE INSERT ON public.buzzer_presses
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_buzzer_rank();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Record buzzer press and return rank
CREATE OR REPLACE FUNCTION public.record_buzzer_press(
    p_game_session_id UUID,
    p_question_id UUID,
    p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    v_buzzer_id UUID;
    v_rank INTEGER;
BEGIN
    -- Check if user already buzzed for this question
    IF EXISTS (
        SELECT 1 FROM public.buzzer_presses
        WHERE game_session_id = p_game_session_id
        AND question_id = p_question_id
        AND user_id = p_user_id
    ) THEN
        -- Return existing rank
        SELECT buzzer_rank INTO v_rank
        FROM public.buzzer_presses
        WHERE game_session_id = p_game_session_id
        AND question_id = p_question_id
        AND user_id = p_user_id;

        RETURN v_rank;
    END IF;

    -- Insert new buzzer press (rank calculated by trigger)
    INSERT INTO public.buzzer_presses (game_session_id, question_id, user_id)
    VALUES (p_game_session_id, p_question_id, p_user_id)
    RETURNING buzzer_rank INTO v_rank;

    RETURN v_rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get ordered list of buzzers for a question
CREATE OR REPLACE FUNCTION public.get_question_buzzers(
    p_question_id UUID
)
RETURNS TABLE (
    user_id UUID,
    buzzer_rank INTEGER,
    pressed_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT bp.user_id, bp.buzzer_rank, bp.pressed_at
    FROM public.buzzer_presses bp
    WHERE bp.question_id = p_question_id
    ORDER BY bp.buzzer_rank ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get first buzzer for a question
CREATE OR REPLACE FUNCTION public.get_first_buzzer(
    p_question_id UUID
)
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT user_id
        FROM public.buzzer_presses
        WHERE question_id = p_question_id
        ORDER BY buzzer_rank ASC
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Select a question (mark as selected, set as current question)
CREATE OR REPLACE FUNCTION public.select_jeopardy_question(
    p_game_session_id UUID,
    p_question_id UUID,
    p_selected_by_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_already_selected BOOLEAN;
BEGIN
    -- Check if question already selected
    SELECT is_selected INTO v_already_selected
    FROM public.game_questions
    WHERE id = p_question_id
    AND game_session_id = p_game_session_id;

    IF v_already_selected THEN
        RETURN false; -- Question already answered
    END IF;

    -- Mark question as selected
    UPDATE public.game_questions
    SET is_selected = true,
        selected_by_user_id = p_selected_by_user_id,
        revealed_at = NOW()
    WHERE id = p_question_id;

    -- Update game session to track current question
    UPDATE public.game_sessions
    SET selected_question_id = p_question_id,
        updated_at = NOW()
    WHERE id = p_game_session_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get Jeopardy board state (categories × point values with availability)
CREATE OR REPLACE FUNCTION public.get_jeopardy_board(
    p_game_session_id UUID
)
RETURNS TABLE (
    question_id UUID,
    category TEXT,
    points INTEGER,
    column_position INTEGER,
    is_selected BOOLEAN,
    is_daily_double BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        gq.id,
        gq.category,
        gq.points,
        gq.column_position,
        gq.is_selected,
        gq.is_daily_double
    FROM public.game_questions gq
    WHERE gq.game_session_id = p_game_session_id
    AND gq.is_final_jeopardy = false
    ORDER BY gq.category, gq.column_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set current player (whose turn to select)
CREATE OR REPLACE FUNCTION public.set_current_jeopardy_player(
    p_game_session_id UUID,
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.game_sessions
    SET current_player_id = p_user_id,
        updated_at = NOW()
    WHERE id = p_game_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get player with lowest score (for turn rotation after no correct answer)
CREATE OR REPLACE FUNCTION public.get_lowest_scoring_player(
    p_game_session_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get player with lowest total score
    SELECT ps.user_id INTO v_user_id
    FROM public.player_scores ps
    WHERE ps.game_session_id = p_game_session_id
    GROUP BY ps.user_id
    ORDER BY SUM(ps.points_earned) ASC
    LIMIT 1;

    -- If no scores yet, return first participant
    IF v_user_id IS NULL THEN
        SELECT rp.user_id INTO v_user_id
        FROM public.game_sessions gs
        JOIN public.room_participants rp ON rp.room_id = gs.room_id
        WHERE gs.id = p_game_session_id
        AND rp.is_active = true
        LIMIT 1;
    END IF;

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Advance to Final Jeopardy round
CREATE OR REPLACE FUNCTION public.advance_to_final_jeopardy(
    p_game_session_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.game_sessions
    SET round = 'final_jeopardy',
        selected_question_id = (
            SELECT id FROM public.game_questions
            WHERE game_session_id = p_game_session_id
            AND is_final_jeopardy = true
            LIMIT 1
        ),
        updated_at = NOW()
    WHERE id = p_game_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if board is complete (all non-Final Jeopardy questions answered)
CREATE OR REPLACE FUNCTION public.is_jeopardy_board_complete(
    p_game_session_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_unanswered_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_unanswered_count
    FROM public.game_questions
    WHERE game_session_id = p_game_session_id
    AND is_final_jeopardy = false
    AND is_selected = false;

    RETURN v_unanswered_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit Jeopardy answer with wager support
CREATE OR REPLACE FUNCTION public.submit_jeopardy_answer(
    p_game_session_id UUID,
    p_question_id UUID,
    p_user_id UUID,
    p_answer TEXT,
    p_is_correct BOOLEAN,
    p_buzzer_rank INTEGER,
    p_wager_amount INTEGER DEFAULT NULL,
    p_time_taken_ms INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_points_earned INTEGER;
    v_question_points INTEGER;
    v_attempt_number INTEGER;
BEGIN
    -- Get question points
    SELECT points INTO v_question_points
    FROM public.game_questions
    WHERE id = p_question_id;

    -- Calculate points earned
    IF p_wager_amount IS NOT NULL THEN
        -- Daily Double or Final Jeopardy: use wager
        v_points_earned := CASE WHEN p_is_correct THEN p_wager_amount ELSE -p_wager_amount END;
    ELSE
        -- Regular question: use question points
        v_points_earned := CASE WHEN p_is_correct THEN v_question_points ELSE -v_question_points END;
    END IF;

    -- Get next attempt number for this user/question
    SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_attempt_number
    FROM public.player_scores
    WHERE game_session_id = p_game_session_id
    AND user_id = p_user_id
    AND question_id = p_question_id;

    -- Insert score
    INSERT INTO public.player_scores (
        game_session_id,
        user_id,
        question_id,
        answer,
        is_correct,
        points_earned,
        buzzer_rank,
        wager_amount,
        time_taken_ms,
        attempt_number
    ) VALUES (
        p_game_session_id,
        p_user_id,
        p_question_id,
        p_answer,
        p_is_correct,
        v_points_earned,
        p_buzzer_rank,
        p_wager_amount,
        p_time_taken_ms,
        v_attempt_number
    );

    -- After answer submission:
    -- 1. Clear selected_question_id (return to board)
    -- 2. Update current_player_id
    --    - If correct and first buzzer: they select next
    --    - If wrong or not first buzzer: lowest scorer selects next (handled by frontend for now)

    IF p_is_correct AND p_buzzer_rank = 1 THEN
        -- Correct answer by first buzzer: they select next question
        UPDATE public.game_sessions
        SET selected_question_id = NULL,
            current_player_id = p_user_id,
            updated_at = NOW()
        WHERE id = p_game_session_id;
    ELSE
        -- Wrong answer or not first buzzer: clear question, lowest scorer will select
        -- (Frontend handles setting current_player_id to lowest scorer)
        UPDATE public.game_sessions
        SET selected_question_id = NULL,
            updated_at = NOW()
        WHERE id = p_game_session_id;
    END IF;

    RETURN v_points_earned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.buzzer_presses ENABLE ROW LEVEL SECURITY;

-- Users can view buzzers in games they're participating in
CREATE POLICY "Users can view buzzer presses"
    ON public.buzzer_presses
    FOR SELECT
    USING (
        public.is_user_in_game_room(auth.uid(), game_session_id)
    );

-- Users can insert their own buzzer presses
CREATE POLICY "Users can record their own buzzer presses"
    ON public.buzzer_presses
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND public.is_user_in_game_room(auth.uid(), game_session_id)
    );

-- ============================================================================
-- Realtime Publication
-- ============================================================================

-- Enable realtime for buzzer_presses for live buzzer updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.buzzer_presses;

-- ============================================================================
-- Grants
-- ============================================================================

GRANT ALL ON public.buzzer_presses TO authenticated;
GRANT EXECUTE ON FUNCTION record_buzzer_press TO authenticated;
GRANT EXECUTE ON FUNCTION get_question_buzzers TO authenticated;
GRANT EXECUTE ON FUNCTION get_first_buzzer TO authenticated;
GRANT EXECUTE ON FUNCTION select_jeopardy_question TO authenticated;
GRANT EXECUTE ON FUNCTION get_jeopardy_board TO authenticated;
GRANT EXECUTE ON FUNCTION set_current_jeopardy_player TO authenticated;
GRANT EXECUTE ON FUNCTION get_lowest_scoring_player TO authenticated;
GRANT EXECUTE ON FUNCTION advance_to_final_jeopardy TO authenticated;
GRANT EXECUTE ON FUNCTION is_jeopardy_board_complete TO authenticated;
GRANT EXECUTE ON FUNCTION submit_jeopardy_answer TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.buzzer_presses IS 'Tracks buzzer presses for Jeopardy questions with timing';
COMMENT ON COLUMN public.buzzer_presses.buzzer_rank IS 'Order of buzzer press (1=first, 2=second, etc.)';

COMMENT ON COLUMN public.game_sessions.current_player_id IS 'Jeopardy: User whose turn it is to select a question';
COMMENT ON COLUMN public.game_sessions.selected_question_id IS 'Jeopardy: Currently active question';
COMMENT ON COLUMN public.game_sessions.round IS 'Jeopardy: regular or final_jeopardy';
COMMENT ON COLUMN public.game_sessions.board_state IS 'Jeopardy: Track answered questions in board grid';

COMMENT ON COLUMN public.game_questions.is_selected IS 'Jeopardy: Has this question been picked from the board?';
COMMENT ON COLUMN public.game_questions.selected_by_user_id IS 'Jeopardy: Who selected this question?';
COMMENT ON COLUMN public.game_questions.is_daily_double IS 'Jeopardy: Special question where player wagers';
COMMENT ON COLUMN public.game_questions.is_final_jeopardy IS 'Jeopardy: Final round question where all players wager';
COMMENT ON COLUMN public.game_questions.column_position IS 'Jeopardy: Position in category column (1-5)';

COMMENT ON COLUMN public.player_scores.buzzer_rank IS 'Jeopardy: Order this player buzzed in (1st, 2nd, 3rd)';
COMMENT ON COLUMN public.player_scores.wager_amount IS 'Jeopardy: Wagered points for Daily Double/Final Jeopardy';
COMMENT ON COLUMN public.player_scores.attempt_number IS 'Jeopardy: Allows multiple players to attempt same question';
