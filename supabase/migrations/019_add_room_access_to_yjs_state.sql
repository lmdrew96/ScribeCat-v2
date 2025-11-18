-- Migration: Add Room-Based Access to Yjs State
--
-- PURPOSE: Allow study room participants to access Yjs collaborative editing state
--
-- ISSUE: 406 error when loading Yjs state for room sessions
-- The yjs_state table RLS policies only grant access to:
--   1. Session owners
--   2. Users with session_shares
-- But NOT to study room participants!
--
-- SOLUTION: Add RLS policy for room-based access (matching sessions table pattern)

-- ============================================================================
-- Add Room-Based Access Policy to yjs_state
-- ============================================================================

-- Users can manage Yjs state for sessions in rooms they're participating in
CREATE POLICY "Users can manage Yjs state for room sessions"
  ON yjs_state
  FOR ALL
  USING (
    -- User is an active participant in a room that uses this session
    session_id IN (
      SELECT sr.session_id
      FROM public.study_rooms sr
      JOIN public.room_participants rp ON rp.room_id = sr.id
      WHERE rp.user_id = auth.uid()
        AND rp.is_active = true
        AND sr.is_active = true
        AND sr.session_id IS NOT NULL
    )
  );

-- ============================================================================
-- Add Comment
-- ============================================================================

COMMENT ON POLICY "Users can manage Yjs state for room sessions" ON yjs_state IS
  'Grants full access to Yjs state for sessions in study rooms where user is an active participant';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Study room participants can now access Yjs collaborative editing state!
-- This fixes the 406 error when loading collaborative editor in rooms.
