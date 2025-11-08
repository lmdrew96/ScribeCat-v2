-- Migration: Add summary column to sessions table
--
-- Context: Sessions now automatically generate and store short AI summaries
-- (max 150 characters) after transcription completes. These summaries are
-- displayed on session cards in study mode instead of transcription previews.
--
-- Changes:
-- 1. Add summary TEXT column to sessions table
-- 2. Summary is automatically generated after transcription completes
-- 3. Displayed on session cards for quick overview

-- Add summary column to sessions table
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add comment to explain the summary column
COMMENT ON COLUMN public.sessions.summary IS
'AI-generated short summary (max 150 chars) of the session content. Automatically generated after transcription completes and displayed on session cards in study mode.';

-- Success message
DO $$ BEGIN
    RAISE NOTICE '✓ Summary column migration completed';
    RAISE NOTICE '  - Added summary column to sessions table';
    RAISE NOTICE '  - Summaries will be auto-generated after transcription';
    RAISE NOTICE '  - Displayed on session cards in study mode';
END $$;
