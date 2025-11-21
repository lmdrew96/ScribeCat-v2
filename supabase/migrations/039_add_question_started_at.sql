-- Migration: Add question_started_at timestamp to game_sessions
-- Purpose: Fix timer desync on first question by tracking when each question starts
-- Issue: Q1 used unsynchronized local time, Q2+ used updatedAt. Need explicit timestamp.

-- Add question_started_at column to game_sessions table
ALTER TABLE public.game_sessions
ADD COLUMN question_started_at TIMESTAMPTZ;

-- Add comment explaining the field
COMMENT ON COLUMN public.game_sessions.question_started_at IS
  'Timestamp when the current question started. Used for timer synchronization across all players.';

-- Create trigger to automatically set question_started_at when game starts
CREATE OR REPLACE FUNCTION public.set_question_started_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Set question_started_at when status changes to in_progress (game start)
  IF NEW.status = 'in_progress' AND OLD.status = 'waiting' THEN
    NEW.question_started_at = NOW();
  END IF;

  -- Update question_started_at when current_question_index changes (next question)
  IF NEW.current_question_index != OLD.current_question_index THEN
    NEW.question_started_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to game_sessions table
CREATE TRIGGER trigger_set_question_started_at
  BEFORE UPDATE ON public.game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_question_started_at();

-- Backfill existing in-progress games (set to current time as best estimate)
UPDATE public.game_sessions
SET question_started_at = updated_at
WHERE status = 'in_progress' AND question_started_at IS NULL;
