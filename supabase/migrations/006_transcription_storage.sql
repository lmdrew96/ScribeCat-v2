-- Migration: Move transcription data to Supabase Storage
--
-- Context: Large sessions with lengthy transcriptions exceed Supabase's API payload limit
-- when stored directly in the database. This migration moves transcription storage to
-- Supabase Storage (as JSON files) similar to how audio files are handled.
--
-- Changes:
-- 1. Add has_transcription boolean column to track if session has transcription file
-- 2. Keep transcription_text temporarily for backward compatibility
-- 3. Application will now store transcription data in Storage at:
--    {user_id}/{session_id}/transcription.json

-- Add has_transcription column to sessions table
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS has_transcription BOOLEAN DEFAULT FALSE;

-- Set has_transcription=true for existing sessions that have transcription_text
UPDATE public.sessions
SET has_transcription = TRUE
WHERE transcription_text IS NOT NULL AND transcription_text != '';

-- Add index for has_transcription for faster queries
CREATE INDEX IF NOT EXISTS idx_sessions_has_transcription
ON public.sessions(has_transcription)
WHERE has_transcription = TRUE;

-- Add comment to explain the new storage model
COMMENT ON COLUMN public.sessions.has_transcription IS
'Boolean flag indicating if a transcription file exists in transcription-data bucket at {user_id}/{session_id}/transcription.json';

COMMENT ON COLUMN public.sessions.transcription_text IS
'DEPRECATED: Transcription text is now stored in Supabase Storage. This column kept for backward compatibility and migration purposes. Will be removed in future migration after all data is migrated.';

-- Success message
DO $$ BEGIN
    RAISE NOTICE '✓ Transcription storage migration completed';
    RAISE NOTICE '  - Added has_transcription column';
    RAISE NOTICE '  - Updated existing sessions with transcription';
    RAISE NOTICE '  - Transcription data will now be stored in Storage';
    RAISE NOTICE '  - Old transcription_text column kept for backward compatibility';
END $$;
