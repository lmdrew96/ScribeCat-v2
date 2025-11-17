/**
 * Fix infinite recursion in room_participants RLS policy
 *
 * The original policy queried room_participants within the room_participants SELECT policy,
 * causing infinite recursion. This fix simplifies the policy to check via study_rooms instead.
 */

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view room participants" ON public.room_participants;

-- Create new policy that checks via study_rooms to avoid recursion
CREATE POLICY "Users can view room participants"
    ON public.room_participants
    FOR SELECT
    USING (
        -- User is participant of this specific participant record
        auth.uid() = user_id
        OR
        -- User is host of the room
        EXISTS (
            SELECT 1 FROM public.study_rooms
            WHERE id = room_id
            AND host_id = auth.uid()
        )
        OR
        -- User has an invitation to the room
        EXISTS (
            SELECT 1 FROM public.room_invitations
            WHERE room_id = room_participants.room_id
            AND invitee_id = auth.uid()
            AND status = 'pending'
        )
    );

-- Also fix the join policy - it should allow joining after accepting invitation OR being the host
DROP POLICY IF EXISTS "Users can join rooms" ON public.room_participants;

CREATE POLICY "Users can join rooms"
    ON public.room_participants
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND (
            -- User has accepted invitation
            EXISTS (
                SELECT 1 FROM public.room_invitations
                WHERE room_id = room_participants.room_id
                AND invitee_id = auth.uid()
                AND status = 'accepted'
            )
            OR
            -- User is the host (auto-added by trigger)
            EXISTS (
                SELECT 1 FROM public.study_rooms
                WHERE id = room_participants.room_id
                AND host_id = auth.uid()
            )
        )
    );
