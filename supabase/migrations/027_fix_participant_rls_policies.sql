/**
 * Fix room_participants RLS policies to use SECURITY DEFINER helper functions
 *
 * ROOT CAUSES:
 * 1. SELECT policy only shows user's own participant record (line 58 in migration 013)
 *    RESULT: Users can't see other participants in their rooms
 * 2. INSERT policy doesn't verify accepted invitation (line 63 in migration 013)
 *    RESULT: Users can't rejoin rooms after leaving (even with accepted invitation)
 *
 * SOLUTION:
 * Migration 013 created SECURITY DEFINER helper functions to avoid circular RLS checks,
 * but the RLS policies themselves don't USE those functions. We'll update the policies
 * to call the helper functions, which bypass RLS and prevent infinite recursion.
 *
 * This fixes:
 * - Issue 2: Participant lists now show all active participants
 * - Issue 4: Users can rejoin rooms they have accepted invitations to
 */

-- ============================================================================
-- Ensure helper functions exist (may have been missed in migration 013)
-- ============================================================================

-- Check if user can view a room (used in RLS policies)
CREATE OR REPLACE FUNCTION public.can_user_view_room(
    p_user_id UUID,
    p_room_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        -- User is host
        SELECT 1 FROM public.study_rooms
        WHERE id = p_room_id
        AND host_id = p_user_id
    )
    OR EXISTS (
        -- User is participant
        SELECT 1 FROM public.room_participants
        WHERE room_id = p_room_id
        AND user_id = p_user_id
        AND is_active = true
    )
    OR EXISTS (
        -- User has invitation
        SELECT 1 FROM public.room_invitations
        WHERE room_id = p_room_id
        AND invitee_id = p_user_id
        AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can view participants in a room
CREATE OR REPLACE FUNCTION public.can_user_view_participants(
    p_user_id UUID,
    p_room_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.can_user_view_room(p_user_id, p_room_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Drop existing overly-restrictive policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own participant records" ON public.room_participants;
DROP POLICY IF EXISTS "Users can insert participant records" ON public.room_participants;

-- ============================================================================
-- Create new policies using SECURITY DEFINER helper functions
-- ============================================================================

-- SELECT policy: Use can_user_view_participants() helper function
-- This allows viewing ALL participants in rooms the user has access to
CREATE POLICY "Users can view participants in accessible rooms"
    ON public.room_participants
    FOR SELECT
    USING (
        public.can_user_view_participants(auth.uid(), room_id)
    );

-- INSERT policy: Verify user has accepted invitation OR is the host
-- This allows rejoining rooms after leaving (if invitation is still accepted)
CREATE POLICY "Users can join rooms with accepted invitations"
    ON public.room_participants
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND (
            -- User has accepted invitation to this room
            EXISTS (
                SELECT 1 FROM public.room_invitations
                WHERE room_id = room_participants.room_id
                AND invitee_id = auth.uid()
                AND status = 'accepted'
            )
            OR
            -- User is the host of this room
            EXISTS (
                SELECT 1 FROM public.study_rooms
                WHERE id = room_participants.room_id
                AND host_id = auth.uid()
            )
        )
    );

/**
 * Why this doesn't cause circular recursion:
 *
 * The can_user_view_participants() function is marked SECURITY DEFINER,
 * which means it runs with the privileges of the function creator (bypassing RLS).
 * When it queries study_rooms, room_participants, and room_invitations,
 * those queries don't trigger RLS checks, so there's no circular dependency.
 *
 * For the INSERT policy, we use direct EXISTS checks. These are safe because:
 * - room_invitations SELECT policy only checks (inviter_id OR invitee_id)
 * - study_rooms SELECT policy only checks host_id
 * Neither of these policies reference room_participants, so no circular dependency.
 */
