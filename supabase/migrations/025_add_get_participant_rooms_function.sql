/**
 * Add SECURITY DEFINER function to fetch room details for participants
 *
 * Problem: RLS policy on study_rooms only allows SELECT where user is host.
 * This prevents participants from seeing room details even when they have
 * a valid participant record.
 *
 * Solution: Create a SECURITY DEFINER function that bypasses RLS to fetch
 * room details for rooms where the user is an active participant.
 */

CREATE OR REPLACE FUNCTION public.get_participant_rooms(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    host_id UUID,
    session_id UUID,
    max_participants INTEGER,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    host_email TEXT,
    host_full_name TEXT,
    host_avatar_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sr.id,
        sr.name,
        sr.host_id,
        sr.session_id,
        sr.max_participants,
        sr.is_active,
        sr.created_at,
        sr.updated_at,
        sr.closed_at,
        up.email as host_email,
        up.full_name as host_full_name,
        up.avatar_url as host_avatar_url
    FROM public.study_rooms sr
    INNER JOIN public.room_participants rp
        ON rp.room_id = sr.id
    LEFT JOIN public.user_profiles up
        ON up.id = sr.host_id
    WHERE rp.user_id = p_user_id
        AND rp.is_active = true
        AND sr.is_active = true
        AND sr.host_id != p_user_id; -- Exclude rooms where user is host (already fetched separately)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_participant_rooms(UUID) TO authenticated;
