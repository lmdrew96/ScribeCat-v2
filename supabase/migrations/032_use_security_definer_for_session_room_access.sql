/**
 * Use SECURITY DEFINER function for room-based session access
 *
 * Problem: The session RLS policy does a complex JOIN between study_rooms
 * and room_participants. Even though participants can now see both tables,
 * the complex JOIN inside the RLS policy evaluation still fails.
 *
 * Solution: Create a SECURITY DEFINER function that bypasses RLS to check
 * if a user can access a session via room membership, then use that function
 * in the sessions RLS policy.
 */

-- Create helper function to check if user can access session via room
CREATE OR REPLACE FUNCTION public.can_user_access_session_via_room(
    p_user_id UUID,
    p_session_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is an active participant in any room using this session
    RETURN EXISTS (
        SELECT 1
        FROM public.study_rooms sr
        JOIN public.room_participants rp ON rp.room_id = sr.id
        WHERE sr.session_id = p_session_id
        AND rp.user_id = p_user_id
        AND rp.is_active = true
        AND sr.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the existing sessions RLS policies
DROP POLICY IF EXISTS "Users can view their sessions and shared sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can update their sessions and shared sessions" ON public.sessions;

-- Recreate SELECT policy with SECURITY DEFINER function
CREATE POLICY "Users can view their sessions and shared sessions"
    ON public.sessions
    FOR SELECT
    USING (
        -- Owner access
        user_id = auth.uid()
        OR
        -- Room-based access (using SECURITY DEFINER function)
        public.can_user_access_session_via_room(auth.uid(), sessions.id)
    );

-- Recreate UPDATE policy with SECURITY DEFINER function
CREATE POLICY "Users can update their sessions and shared sessions"
    ON public.sessions
    FOR UPDATE
    USING (
        -- Owner access
        user_id = auth.uid()
        OR
        -- Room-based access - all participants get editor access
        public.can_user_access_session_via_room(auth.uid(), sessions.id)
    )
    WITH CHECK (
        -- Same conditions as USING clause
        user_id = auth.uid()
        OR
        public.can_user_access_session_via_room(auth.uid(), sessions.id)
    );
