-- Migration: Make session_id optional in study_rooms
--
-- REASON: Study rooms can be created for general collaboration
-- without being tied to a specific session. Session linking
-- will be implemented later when we add session copying to Supabase.

-- Make session_id nullable
ALTER TABLE public.study_rooms
  ALTER COLUMN session_id DROP NOT NULL;

-- Update comment
COMMENT ON COLUMN public.study_rooms.session_id IS 'Optional: The shared session copy that all participants can edit (will be implemented with session copying feature)';
