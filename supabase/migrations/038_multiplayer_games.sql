-- Migration 038: Multiplayer Games System
-- Interactive games for study rooms (Quiz Battle, Jeopardy, Bingo, Collaborative Flashcards)

-- ============================================================================
-- Tables
-- ============================================================================

-- Game Sessions
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
    game_type TEXT NOT NULL CHECK (game_type IN ('quiz_battle', 'jeopardy', 'bingo', 'flashcards')),
    status TEXT NOT NULL CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')) DEFAULT 'waiting',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    current_question_index INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Game Questions
CREATE TABLE IF NOT EXISTS public.game_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL,
    question_data JSONB NOT NULL,
    correct_answer TEXT NOT NULL,
    category TEXT,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
    points INTEGER NOT NULL DEFAULT 100,
    time_limit_seconds INTEGER DEFAULT 30,
    revealed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_question_per_game UNIQUE (game_session_id, question_index)
);

-- Player Scores
CREATE TABLE IF NOT EXISTS public.player_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.game_questions(id) ON DELETE CASCADE,
    answer TEXT,
    is_correct BOOLEAN,
    points_earned INTEGER NOT NULL DEFAULT 0,
    time_taken_ms INTEGER,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_player_answer UNIQUE (game_session_id, user_id, question_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_game_sessions_room ON public.game_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON public.game_sessions(status) WHERE status IN ('waiting', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_game_sessions_type ON public.game_sessions(game_type);

-- Partial unique index to ensure only one active game per room
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_game_per_room
    ON public.game_sessions(room_id)
    WHERE status IN ('waiting', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_game_questions_session ON public.game_questions(game_session_id);
CREATE INDEX IF NOT EXISTS idx_game_questions_index ON public.game_questions(game_session_id, question_index);

CREATE INDEX IF NOT EXISTS idx_player_scores_session ON public.player_scores(game_session_id);
CREATE INDEX IF NOT EXISTS idx_player_scores_user ON public.player_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_player_scores_question ON public.player_scores(question_id);
CREATE INDEX IF NOT EXISTS idx_player_scores_session_user ON public.player_scores(game_session_id, user_id);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update updated_at timestamp on game_sessions
CREATE OR REPLACE FUNCTION public.update_game_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_game_sessions_updated_at
    BEFORE UPDATE ON public.game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_game_sessions_updated_at();

-- Auto-set started_at when game starts
CREATE OR REPLACE FUNCTION public.set_game_started_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'in_progress' AND OLD.status = 'waiting' AND NEW.started_at IS NULL THEN
        NEW.started_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_game_started_at
    BEFORE UPDATE ON public.game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_game_started_at();

-- Auto-set ended_at when game ends
CREATE OR REPLACE FUNCTION public.set_game_ended_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('completed', 'cancelled') AND OLD.status IN ('waiting', 'in_progress') AND NEW.ended_at IS NULL THEN
        NEW.ended_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_game_ended_at
    BEFORE UPDATE ON public.game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_game_ended_at();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Get active game for a room
CREATE OR REPLACE FUNCTION public.get_active_game_for_room(
    p_room_id UUID
)
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id
        FROM public.game_sessions
        WHERE room_id = p_room_id
        AND status IN ('waiting', 'in_progress')
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get player total score for a game
CREATE OR REPLACE FUNCTION public.get_player_total_score(
    p_game_session_id UUID,
    p_user_id UUID
)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COALESCE(SUM(points_earned), 0)
        FROM public.player_scores
        WHERE game_session_id = p_game_session_id
        AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get leaderboard for a game
CREATE OR REPLACE FUNCTION public.get_game_leaderboard(
    p_game_session_id UUID
)
RETURNS TABLE (
    user_id UUID,
    total_score INTEGER,
    correct_answers INTEGER,
    total_answers INTEGER,
    avg_time_ms NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ps.user_id,
        COALESCE(SUM(ps.points_earned), 0)::INTEGER AS total_score,
        COUNT(*) FILTER (WHERE ps.is_correct = true)::INTEGER AS correct_answers,
        COUNT(*)::INTEGER AS total_answers,
        ROUND(AVG(ps.time_taken_ms))::NUMERIC AS avg_time_ms
    FROM public.player_scores ps
    WHERE ps.game_session_id = p_game_session_id
    GROUP BY ps.user_id
    ORDER BY total_score DESC, avg_time_ms ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is in the room for a game
CREATE OR REPLACE FUNCTION public.is_user_in_game_room(
    p_user_id UUID,
    p_game_session_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.game_sessions gs
        JOIN public.room_participants rp ON rp.room_id = gs.room_id
        WHERE gs.id = p_game_session_id
        AND rp.user_id = p_user_id
        AND rp.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current question for a game
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
    SELECT current_question_index INTO v_current_index
    FROM public.game_sessions
    WHERE id = p_game_session_id;

    -- Return the question (without correct answer for security)
    RETURN QUERY
    SELECT
        gq.id,
        gq.question_index,
        gq.question_data,
        gq.category,
        gq.difficulty,
        gq.points,
        gq.time_limit_seconds
    FROM public.game_questions gq
    WHERE gq.game_session_id = p_game_session_id
    AND gq.question_index = v_current_index
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-cancel games when room closes
CREATE OR REPLACE FUNCTION public.cancel_games_on_room_close()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = false AND OLD.is_active = true THEN
        UPDATE public.game_sessions
        SET status = 'cancelled'
        WHERE room_id = NEW.id
        AND status IN ('waiting', 'in_progress');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cancel_games_on_room_close
    AFTER UPDATE ON public.study_rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.cancel_games_on_room_close();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_scores ENABLE ROW LEVEL SECURITY;

-- game_sessions policies

-- Users can view games in rooms they're participating in
CREATE POLICY "Users can view games in their rooms"
    ON public.game_sessions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.room_participants rp
            WHERE rp.room_id = game_sessions.room_id
            AND rp.user_id = auth.uid()
            AND rp.is_active = true
        )
    );

-- Room hosts can create games
CREATE POLICY "Room hosts can create games"
    ON public.game_sessions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.study_rooms sr
            WHERE sr.id = room_id
            AND sr.host_id = auth.uid()
            AND sr.is_active = true
        )
    );

-- Room hosts can update games
CREATE POLICY "Room hosts can update games"
    ON public.game_sessions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.study_rooms sr
            WHERE sr.id = room_id
            AND sr.host_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.study_rooms sr
            WHERE sr.id = room_id
            AND sr.host_id = auth.uid()
        )
    );

-- game_questions policies

-- Users can view questions in games they're participating in
CREATE POLICY "Users can view game questions"
    ON public.game_questions
    FOR SELECT
    USING (
        public.is_user_in_game_room(auth.uid(), game_session_id)
    );

-- Room hosts can insert questions
CREATE POLICY "Room hosts can insert questions"
    ON public.game_questions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.game_sessions gs
            JOIN public.study_rooms sr ON sr.id = gs.room_id
            WHERE gs.id = game_session_id
            AND sr.host_id = auth.uid()
        )
    );

-- player_scores policies

-- Users can view all scores in games they're participating in
CREATE POLICY "Users can view game scores"
    ON public.player_scores
    FOR SELECT
    USING (
        public.is_user_in_game_room(auth.uid(), game_session_id)
    );

-- Users can insert their own scores
CREATE POLICY "Users can submit their own scores"
    ON public.player_scores
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND public.is_user_in_game_room(auth.uid(), game_session_id)
    );

-- ============================================================================
-- Realtime Publication
-- ============================================================================

-- Enable realtime for all game tables for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_scores;

-- ============================================================================
-- Grants
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.game_sessions TO authenticated;
GRANT ALL ON public.game_questions TO authenticated;
GRANT ALL ON public.player_scores TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_game_for_room TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_total_score TO authenticated;
GRANT EXECUTE ON FUNCTION get_game_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_in_game_room TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_game_question TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.game_sessions IS 'Multiplayer game sessions within study rooms';
COMMENT ON TABLE public.game_questions IS 'Questions for each game session';
COMMENT ON TABLE public.player_scores IS 'Individual player answers and scores for each question';

COMMENT ON COLUMN public.game_sessions.game_type IS 'Type of game: quiz_battle, jeopardy, bingo, or flashcards';
COMMENT ON COLUMN public.game_sessions.status IS 'Current game status: waiting, in_progress, completed, or cancelled';
COMMENT ON COLUMN public.game_sessions.config IS 'Game-specific configuration (number of questions, categories, etc.)';
COMMENT ON COLUMN public.game_sessions.current_question_index IS 'Index of the currently active question';
COMMENT ON COLUMN public.game_questions.question_data IS 'Question text, options, and metadata in JSON format';
COMMENT ON COLUMN public.game_questions.correct_answer IS 'The correct answer (not exposed to clients during game)';
COMMENT ON COLUMN public.player_scores.time_taken_ms IS 'Time taken to answer in milliseconds (for tiebreakers)';
