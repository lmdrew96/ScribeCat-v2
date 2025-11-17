/**
 * Simplify RLS policies to avoid infinite recursion
 *
 * The issue: Nested selects cause circular policy checks:
 * - study_rooms policy checks room_participants
 * - room_participants policy checks study_rooms
 * - Infinite recursion!
 *
 * Solution: Simplify policies to avoid cross-table EXISTS checks
 * Use only direct auth.uid() checks and simple foreign key lookups
 */

-- ============================================================================
-- Drop all existing policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their rooms" ON public.study_rooms;
DROP POLICY IF EXISTS "Users can create rooms" ON public.study_rooms;
DROP POLICY IF EXISTS "Host can update room" ON public.study_rooms;

DROP POLICY IF EXISTS "Users can view room participants" ON public.room_participants;
DROP POLICY IF EXISTS "Users can join rooms" ON public.room_participants;
DROP POLICY IF EXISTS "Users can leave rooms" ON public.room_participants;

DROP POLICY IF EXISTS "Users can view their invitations" ON public.room_invitations;
DROP POLICY IF EXISTS "Host can invite friends" ON public.room_invitations;
DROP POLICY IF EXISTS "Users can respond to invitations" ON public.room_invitations;

-- ============================================================================
-- Create simplified policies WITHOUT circular dependencies
-- ============================================================================

-- study_rooms policies
-- Simple: User can view if they're the host
-- No EXISTS checks on other tables to avoid recursion
CREATE POLICY "Users can view rooms they host"
    ON public.study_rooms
    FOR SELECT
    USING (auth.uid() = host_id);

CREATE POLICY "Users can create rooms"
    ON public.study_rooms
    FOR INSERT
    WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update room"
    ON public.study_rooms
    FOR UPDATE
    USING (auth.uid() = host_id)
    WITH CHECK (auth.uid() = host_id);

-- room_participants policies
-- Simple: User can view their own participant records
-- No EXISTS checks on study_rooms to avoid recursion
CREATE POLICY "Users can view their own participant records"
    ON public.room_participants
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert participant records"
    ON public.room_participants
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their participant records"
    ON public.room_participants
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- room_invitations policies
-- Simple: User can view if they're inviter or invitee
CREATE POLICY "Users can view their invitations"
    ON public.room_invitations
    FOR SELECT
    USING (
        auth.uid() = inviter_id
        OR auth.uid() = invitee_id
    );

CREATE POLICY "Users can send invitations"
    ON public.room_invitations
    FOR INSERT
    WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Users can update their invitations"
    ON public.room_invitations
    FOR UPDATE
    USING (
        auth.uid() = inviter_id
        OR auth.uid() = invitee_id
    )
    WITH CHECK (
        auth.uid() = inviter_id
        OR auth.uid() = invitee_id
    );

-- ============================================================================
-- Create helper functions with SECURITY DEFINER to check permissions
-- These bypass RLS and prevent circular dependencies
-- ============================================================================

-- Check if user can view a room (used in application logic)
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
