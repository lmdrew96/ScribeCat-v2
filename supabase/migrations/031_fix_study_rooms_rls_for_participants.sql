/**
 * Fix study_rooms RLS to allow participants to view rooms
 *
 * Problem: Migration 013 simplified RLS policies to avoid infinite recursion,
 * but made the study_rooms SELECT policy too restrictive - only hosts can view rooms.
 * This breaks session sharing because participants can't see the study_rooms record
 * that links sessions to rooms, causing the session RLS policy to fail.
 *
 * Solution: Add a policy allowing participants to view study_rooms records
 * for rooms they're actively participating in.
 */

-- Add policy for participants to view rooms they're in
CREATE POLICY "Participants can view their rooms"
    ON public.study_rooms
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.room_participants
            WHERE room_id = study_rooms.id
            AND user_id = auth.uid()
            AND is_active = true
        )
    );
