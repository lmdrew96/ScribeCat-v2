-- Migration: Fix Duration Column Type
--
-- PURPOSE: Change duration column from INTEGER to DOUBLE PRECISION
-- to support decimal values (e.g., 4654.021 seconds)
--
-- ISSUE: Session duration is stored as a decimal number in TypeScript/JavaScript,
-- but the database column was INTEGER, causing "invalid input syntax" errors
-- when copying sessions for study rooms.
--
-- SOLUTION: Change column type to DOUBLE PRECISION to handle decimal seconds

-- ============================================================================
-- Alter sessions table duration column type
-- ============================================================================

-- Change duration from INTEGER to DOUBLE PRECISION
ALTER TABLE public.sessions
  ALTER COLUMN duration TYPE DOUBLE PRECISION;

-- Add comment to document the column type
COMMENT ON COLUMN public.sessions.duration IS
  'Duration of the recording in seconds (supports decimal values for precise timing)';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Session durations can now store decimal values like 4654.021 seconds
