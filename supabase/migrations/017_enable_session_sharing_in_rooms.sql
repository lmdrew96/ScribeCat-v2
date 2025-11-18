-- Migration: Enable Session Sharing in Study Rooms
--
-- PURPOSE: Allow all room participants to view and edit the room's shared session
--
-- IMPLEMENTATION APPROACH:
-- Instead of creating individual session_shares for each participant (approach 1),
-- we extend the sessions RLS policies to grant access based on room membership (approach 2).
-- This is cleaner and automatically handles join/leave without managing session_shares.

-- ============================================================================
-- Update Sessions RLS Policies for Room-Based Access
-- ============================================================================

-- Drop existing "Users can view their sessions and shared sessions" policy
DROP POLICY IF EXISTS "Users can view their sessions and shared sessions" ON public.sessions;

-- Recreate with room access included
CREATE POLICY "Users can view their sessions and shared sessions"
  ON public.sessions
  FOR SELECT
  USING (
    -- User owns the session
    user_id = auth.uid()
    OR
    -- Session is shared with user via session_shares
    EXISTS (
      SELECT 1 FROM public.session_shares
      WHERE session_id = sessions.id
      AND shared_with_user_id = auth.uid()
    )
    OR
    -- User is an active participant in a room that uses this session
    EXISTS (
      SELECT 1 FROM public.study_rooms sr
      JOIN public.room_participants rp ON rp.room_id = sr.id
      WHERE sr.session_id = sessions.id
      AND rp.user_id = auth.uid()
      AND rp.is_active = true
      AND sr.is_active = true
    )
  );

-- Drop existing "Users can update their sessions and shared sessions" policy
DROP POLICY IF EXISTS "Users can update their sessions and shared sessions" ON public.sessions;

-- Recreate with room access included (editor permission for all room participants)
CREATE POLICY "Users can update their sessions and shared sessions"
  ON public.sessions
  FOR UPDATE
  USING (
    -- User owns the session
    user_id = auth.uid()
    OR
    -- Session is shared with user as 'editor'
    EXISTS (
      SELECT 1 FROM public.session_shares
      WHERE session_id = sessions.id
      AND shared_with_user_id = auth.uid()
      AND permission_level = 'editor'
    )
    OR
    -- User is an active participant in a room that uses this session
    -- (all room participants get editor access for collaborative editing)
    EXISTS (
      SELECT 1 FROM public.study_rooms sr
      JOIN public.room_participants rp ON rp.room_id = sr.id
      WHERE sr.session_id = sessions.id
      AND rp.user_id = auth.uid()
      AND rp.is_active = true
      AND sr.is_active = true
    )
  )
  WITH CHECK (
    -- Same conditions as USING clause
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.session_shares
      WHERE session_id = sessions.id
      AND shared_with_user_id = auth.uid()
      AND permission_level = 'editor'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.study_rooms sr
      JOIN public.room_participants rp ON rp.room_id = sr.id
      WHERE sr.session_id = sessions.id
      AND rp.user_id = auth.uid()
      AND rp.is_active = true
      AND sr.is_active = true
    )
  );

-- ============================================================================
-- Helper Function: Check if User Can Edit Room Session
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_edit_room_session(
  p_session_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.study_rooms sr
    JOIN public.room_participants rp ON rp.room_id = sr.id
    WHERE sr.session_id = p_session_id
    AND rp.user_id = p_user_id
    AND rp.is_active = true
    AND sr.is_active = true
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.can_edit_room_session(UUID, UUID) TO authenticated;

-- ============================================================================
-- Update Comments
-- ============================================================================

COMMENT ON COLUMN public.study_rooms.session_id IS
'Optional: Session shared in this room. All active room participants get editor access via RLS policies.';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Study room participants can now view and edit the room''s session!
-- Access is automatically granted/revoked when participants join/leave.
