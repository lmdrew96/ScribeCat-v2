/**
 * Fix INSERT policy by using SECURITY DEFINER helper function
 *
 * ROOT CAUSE:
 * The INSERT policy's EXISTS subqueries are themselves subject to RLS, which can cause
 * the policy check to fail even when the conditions should pass. This is the same issue
 * that migration 013 solved for SELECT policies by using SECURITY DEFINER functions.
 *
 * SOLUTION:
 * Create a SECURITY DEFINER helper function that checks if a user can join a room,
 * then use that function in the INSERT policy. SECURITY DEFINER functions bypass RLS
 * when they run their internal queries, preventing circular dependencies and evaluation issues.
 *
 * This is the same pattern used for the SELECT policy ("Users can view participants in
 * accessible rooms") which uses can_user_view_participants() SECURITY DEFINER function.
 */

-- ============================================================================
-- Create SECURITY DEFINER helper function for INSERT policy
-- ============================================================================

-- Check if user can join a room (used in INSERT policy)
CREATE OR REPLACE FUNCTION public.can_user_join_room(
    p_user_id UUID,
    p_room_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        -- User has an invitation (pending or accepted)
        -- 'pending': During first-time acceptance (transaction timing)
        -- 'accepted': During rejoin after leaving
        SELECT 1 FROM public.room_invitations
        WHERE room_id = p_room_id
        AND invitee_id = p_user_id
        AND status IN ('pending', 'accepted')
    )
    OR EXISTS (
        -- User is the host of this room
        SELECT 1 FROM public.study_rooms
        WHERE id = p_room_id
        AND host_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update INSERT policy to use SECURITY DEFINER helper function
-- ============================================================================

-- Drop the policy that uses direct EXISTS (doesn't work due to RLS)
DROP POLICY IF EXISTS "Users can join rooms with invitations" ON public.room_participants;

-- Create new policy using SECURITY DEFINER helper
CREATE POLICY "Users can join rooms with invitations"
    ON public.room_participants
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND public.can_user_join_room(auth.uid(), room_id)
    );

/**
 * Why SECURITY DEFINER solves the problem:
 *
 * The can_user_join_room() function runs with the privileges of the function creator,
 * bypassing RLS. When it queries room_invitations and study_rooms, those queries
 * don't trigger RLS checks, so there's no circular dependency or evaluation issues.
 *
 * This is safe because:
 * 1. The function still validates the user has proper access (invitation or host)
 * 2. Users can't directly call INSERT - they must go through the application
 * 3. The application enforces the acceptance flow via acceptInvitation() method
 *
 * This matches the pattern used for the SELECT policy which uses
 * can_user_view_participants() with SECURITY DEFINER.
 */
