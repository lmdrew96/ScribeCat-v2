-- Add is_room_only flag to sessions table
-- This flag marks sessions that are created exclusively for study rooms
-- and should not appear in the user's regular study mode session list

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS is_room_only BOOLEAN DEFAULT false NOT NULL;

COMMENT ON COLUMN sessions.is_room_only IS 'True if this session is a copy created for a study room and should not appear in the user''s study mode list';

-- Add index for efficient filtering when listing sessions
CREATE INDEX IF NOT EXISTS idx_sessions_is_room_only ON sessions(is_room_only);

-- Add index for common query pattern: user's non-room-only sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_room_only ON sessions(user_id, is_room_only, deleted_at);
