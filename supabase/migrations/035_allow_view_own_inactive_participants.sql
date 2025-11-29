-- Migration: Allow users to view their own inactive participant records and rooms they left
-- This is needed for the "Rejoin" feature to work - users need to see rooms they previously left

-- ============================================================================
-- Fix room_participants SELECT policy
-- ============================================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view participants in accessible rooms" ON public.room_participants;

-- Create updated policy that also allows viewing own inactive records
CREATE POLICY "Users can view participants in accessible rooms"
    ON public.room_participants
    FOR SELECT
    USING (
        -- User can view their OWN participant records (active or inactive)
        user_id = auth.uid()
        OR
        -- User can view OTHER participants in rooms they have access to
        public.can_user_view_participants(auth.uid(), room_id)
    );

-- ============================================================================
-- Fix study_rooms SELECT policy for participants
-- ============================================================================

-- Drop existing participant policy
DROP POLICY IF EXISTS "Participants can view their rooms" ON public.study_rooms;

-- Create updated policy that allows viewing rooms user was previously in
CREATE POLICY "Participants can view their rooms"
    ON public.study_rooms
    FOR SELECT
    USING (
        EXISTS (
            -- User is or was a participant in this room (active OR inactive)
            SELECT 1 FROM public.room_participants
            WHERE room_id = study_rooms.id
            AND user_id = auth.uid()
        )
    );
