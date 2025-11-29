-- Migration: Allow users to self-rejoin rooms they previously left
-- This removes the requirement for a new invitation when rejoining

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can join rooms" ON public.room_participants;

-- Create updated policy that allows self-rejoin
CREATE POLICY "Users can join rooms"
    ON public.room_participants
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND (
            -- Original check: User has accepted invitation
            EXISTS (
                SELECT 1 FROM public.room_invitations
                WHERE room_id = room_participants.room_id
                AND invitee_id = auth.uid()
                AND status = 'accepted'
            )
            OR
            -- NEW: User was previously in this room (has inactive participant record)
            -- This allows users who left to rejoin without requiring a new invitation
            EXISTS (
                SELECT 1 FROM public.room_participants rp
                WHERE rp.room_id = room_participants.room_id
                AND rp.user_id = auth.uid()
                AND rp.is_active = false
            )
        )
        AND
        -- Room must still be active
        EXISTS (
            SELECT 1 FROM public.study_rooms
            WHERE id = room_participants.room_id
            AND is_active = true
        )
    );
