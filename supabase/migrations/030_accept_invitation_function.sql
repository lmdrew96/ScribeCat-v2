/**
 * Create atomic accept_invitation function to bypass RLS issues
 *
 * ROOT CAUSE:
 * Even with SECURITY DEFINER helper functions, RLS policies are still enforced
 * on table queries within those functions. This causes the INSERT policy check
 * to fail because it can't properly evaluate the invitation status.
 *
 * SOLUTION:
 * Create a SECURITY DEFINER stored procedure that handles the ENTIRE invitation
 * acceptance flow (update invitation + insert/update participant) in a single
 * atomic transaction. This function runs with elevated privileges and can bypass
 * RLS entirely for the operations it performs.
 *
 * The application will call this function via RPC instead of doing the separate
 * UPDATE + INSERT operations.
 */

-- ============================================================================
-- Create stored procedure for atomic invitation acceptance
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_room_invitation(
    p_invitation_id UUID
)
RETURNS TABLE (
    participant_id UUID,
    room_id UUID,
    user_id UUID,
    joined_at TIMESTAMPTZ,
    is_active BOOLEAN
) AS $$
DECLARE
    v_invitation RECORD;
    v_result RECORD;
BEGIN
    -- Step 1: Fetch and validate invitation
    SELECT inv.id, inv.room_id, inv.invitee_id, inv.status
    INTO v_invitation
    FROM public.room_invitations inv
    WHERE inv.id = p_invitation_id
    AND inv.invitee_id = auth.uid()
    AND inv.status = 'pending';

    -- Check if invitation exists and is pending
    IF v_invitation.id IS NULL THEN
        RAISE EXCEPTION 'Invitation not found or already processed';
    END IF;

    -- Step 2: Update invitation status to 'accepted'
    UPDATE public.room_invitations
    SET status = 'accepted',
        updated_at = NOW()
    WHERE id = p_invitation_id;

    -- Step 3 & 4: Atomically insert or update participant (fixes race condition)
    -- Use INSERT ... ON CONFLICT to handle simultaneous acceptance without race conditions
    INSERT INTO public.room_participants (room_id, user_id, is_active, joined_at)
    VALUES (v_invitation.room_id, v_invitation.invitee_id, TRUE, NOW())
    ON CONFLICT (room_id, user_id, is_active)
    DO UPDATE SET
        joined_at = NOW(),
        left_at = NULL
    WHERE room_participants.room_id = v_invitation.room_id
    AND room_participants.user_id = v_invitation.invitee_id
    RETURNING room_participants.id,
              room_participants.room_id,
              room_participants.user_id,
              room_participants.joined_at,
              room_participants.is_active
    INTO v_result;

    -- Step 5: Return the participant record
    RETURN QUERY SELECT
        v_result.id AS participant_id,
        v_result.room_id,
        v_result.user_id,
        v_result.joined_at,
        v_result.is_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.accept_room_invitation(UUID) TO authenticated;

/**
 * How to use this function from the application:
 *
 * Instead of:
 *   1. UPDATE room_invitations SET status='accepted'
 *   2. INSERT INTO room_participants
 *
 * Call:
 *   SELECT * FROM accept_room_invitation('invitation-uuid')
 *
 * Or via Supabase client:
 *   supabase.rpc('accept_room_invitation', { p_invitation_id: invitationId })
 *
 * This handles everything in one atomic transaction with elevated privileges.
 */
