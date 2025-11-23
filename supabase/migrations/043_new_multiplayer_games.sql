-- Migration 043: New Multiplayer Games - Hot Seat Challenge & Lightning Chain
-- Replace Bingo and Collaborative Flashcards with new game types
-- Add support for progressive difficulty and power-ups

-- ============================================================================
-- Update game_type constraint
-- ============================================================================

-- Drop the old constraint
ALTER TABLE public.game_sessions DROP CONSTRAINT IF EXISTS game_sessions_game_type_check;

-- Add new constraint with updated game types
ALTER TABLE public.game_sessions ADD CONSTRAINT game_sessions_game_type_check
    CHECK (game_type IN ('quiz_battle', 'jeopardy', 'hot_seat_challenge', 'lightning_chain'));

-- ============================================================================
-- Add new columns to game_sessions
-- ============================================================================

-- Add Hot Seat Challenge specific columns
ALTER TABLE public.game_sessions
    ADD COLUMN IF NOT EXISTS current_turn_player UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS turn_question_count INTEGER DEFAULT 0;

-- Add Lightning Chain specific column
ALTER TABLE public.game_sessions
    ADD COLUMN IF NOT EXISTS team_timer INTEGER DEFAULT 180; -- 3 minutes in seconds

-- Add question_started_at for timer synchronization (if not exists from Jeopardy)
ALTER TABLE public.game_sessions
    ADD COLUMN IF NOT EXISTS question_started_at TIMESTAMPTZ;

-- ============================================================================
-- Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_game_sessions_current_turn_player ON public.game_sessions(current_turn_player);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN public.game_sessions.current_turn_player IS 'Player ID of current hot seat player (Hot Seat Challenge)';
COMMENT ON COLUMN public.game_sessions.turn_question_count IS 'Number of questions answered in current turn (0-5 for Hot Seat Challenge)';
COMMENT ON COLUMN public.game_sessions.team_timer IS 'Remaining team time in seconds (Lightning Chain cooperative mode)';
COMMENT ON COLUMN public.game_sessions.question_started_at IS 'Timestamp when current question started (for late joiner timer sync)';

-- ============================================================================
-- Update existing data (if any bingo or flashcards games exist)
-- ============================================================================

-- Cancel any existing bingo or flashcards games (they are no longer supported)
UPDATE public.game_sessions
SET status = 'cancelled', ended_at = NOW()
WHERE game_type IN ('bingo', 'flashcards')
  AND status IN ('waiting', 'in_progress');

-- Add comments about game type changes
COMMENT ON CONSTRAINT game_sessions_game_type_check ON public.game_sessions IS 'Valid game types: quiz_battle, jeopardy, hot_seat_challenge, lightning_chain (replaced bingo and flashcards in v1.63.0)';
