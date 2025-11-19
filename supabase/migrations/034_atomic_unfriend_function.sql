/**
 * Atomic unfriend function to prevent one-directional friendship bugs
 *
 * PROBLEM:
 * The current unfriend logic executes two separate DELETE queries:
 * 1. DELETE user→friend
 * 2. DELETE friend→user
 *
 * If the second DELETE fails (RLS denial, network error), the friendship
 * becomes one-directional (user doesn't see friend, but friend still sees user).
 *
 * SOLUTION:
 * Create a SECURITY DEFINER function that deletes both directions atomically
 * in a single transaction.
 */

-- ============================================================================
-- Function: Atomically remove friendship in both directions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.unfriend(
    p_user_id UUID,
    p_friend_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- Delete both directions of the friendship atomically
    -- This runs in a single transaction, so either both succeed or both fail
    DELETE FROM public.friendships
    WHERE (user_id = p_user_id AND friend_id = p_friend_id)
       OR (user_id = p_friend_id AND friend_id = p_user_id);

    -- Verify that user_id is actually the authenticated user (security check)
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: Can only unfriend as yourself';
    END IF;

    RAISE NOTICE 'Removed friendship between % and %', p_user_id, p_friend_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant execute permission
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.unfriend(UUID, UUID) TO authenticated;

-- ============================================================================
-- Add helpful comment
-- ============================================================================

COMMENT ON FUNCTION public.unfriend(UUID, UUID) IS
'Atomically removes friendship in both directions. Prevents one-directional friendship bugs.';
