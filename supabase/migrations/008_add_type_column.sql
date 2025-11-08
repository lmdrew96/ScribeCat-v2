-- Migration: Add type column to sessions table
--
-- Context: Sessions can now be either single sessions or multi-session study sets.
-- The 'type' column distinguishes between these session types.
--
-- Changes:
-- 1. Add type TEXT column to sessions table with default value 'single'
-- 2. Add child_session_ids JSONB array for multi-session study sets
-- 3. Add session_order INTEGER for ordering within study sets
--
-- Note: These columns support the multi-session study set feature where
-- users can combine multiple related sessions into a single study set.

-- Add type column to sessions table (defaults to 'single')
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'single'
CHECK (type IN ('single', 'multi-session-study-set'));

-- Add child_session_ids column for multi-session study sets
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS child_session_ids JSONB;

-- Add session_order column for ordering sessions within study sets
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS session_order INTEGER;

-- Add comments to explain the columns
COMMENT ON COLUMN public.sessions.type IS
'Session type: "single" for regular sessions, "multi-session-study-set" for study sets that combine multiple sessions';

COMMENT ON COLUMN public.sessions.child_session_ids IS
'Array of session IDs included in this multi-session study set (only used when type = "multi-session-study-set")';

COMMENT ON COLUMN public.sessions.session_order IS
'Order/position of this session within a study set (only used when type = "multi-session-study-set")';

-- Create index for efficient querying of multi-session study sets
CREATE INDEX IF NOT EXISTS idx_sessions_type ON public.sessions(type);

-- Success message
DO $$ BEGIN
    RAISE NOTICE '✓ Type column migration completed';
    RAISE NOTICE '  - Added type column to sessions table';
    RAISE NOTICE '  - Added child_session_ids column for study sets';
    RAISE NOTICE '  - Added session_order column for ordering';
    RAISE NOTICE '  - Created index on type column';
END $$;
