-- Add source_session_id and source_user_id to track the original session
-- This is needed for study rooms to reference the original session's audio file

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS source_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN sessions.source_session_id IS 'For copied sessions (e.g., in study rooms), the ID of the original session';
COMMENT ON COLUMN sessions.source_user_id IS 'For copied sessions, the user_id of the original session owner (needed to locate audio files in storage)';
