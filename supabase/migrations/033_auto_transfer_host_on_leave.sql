/**
 * Auto-transfer host when host leaves study room
 *
 * PROBLEM:
 * When a host leaves a room, the room becomes "orphaned" - it's still active
 * but no one can manage it (invite users, close room, kick disruptive users).
 *
 * SOLUTION:
 * When the host deactivates their participation (leaves), automatically promote
 * the next oldest active participant to become the new host.
 *
 * If no other participants exist, the room should close automatically.
 */

-- ============================================================================
-- Function: Transfer host to next participant
-- ============================================================================

CREATE OR REPLACE FUNCTION public.transfer_host_to_next_participant()
RETURNS TRIGGER AS $$
DECLARE
    v_room_host_id UUID;
    v_next_participant_id UUID;
BEGIN
    -- Only proceed if this participant was deactivated (left the room)
    IF NEW.is_active = FALSE AND OLD.is_active = TRUE THEN
        -- Check if this user is the current host
        SELECT host_id INTO v_room_host_id
        FROM public.study_rooms
        WHERE id = NEW.room_id;

        IF v_room_host_id = NEW.user_id THEN
            -- Host is leaving! Find the next oldest active participant
            SELECT user_id INTO v_next_participant_id
            FROM public.room_participants
            WHERE room_id = NEW.room_id
            AND user_id != NEW.user_id
            AND is_active = TRUE
            ORDER BY joined_at ASC
            LIMIT 1;

            IF v_next_participant_id IS NOT NULL THEN
                -- Transfer host to next participant
                UPDATE public.study_rooms
                SET host_id = v_next_participant_id,
                    updated_at = NOW()
                WHERE id = NEW.room_id;

                RAISE NOTICE 'Host transferred from % to % for room %',
                    NEW.user_id, v_next_participant_id, NEW.room_id;
            ELSE
                -- No other participants - close the room automatically
                UPDATE public.study_rooms
                SET is_active = FALSE,
                    closed_at = NOW(),
                    updated_at = NOW()
                WHERE id = NEW.room_id;

                RAISE NOTICE 'Room % automatically closed (no remaining participants)', NEW.room_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Trigger: Auto-transfer host when host leaves
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_transfer_host_on_leave ON public.room_participants;

CREATE TRIGGER trigger_transfer_host_on_leave
AFTER UPDATE OF is_active ON public.room_participants
FOR EACH ROW
WHEN (NEW.is_active = FALSE AND OLD.is_active = TRUE)
EXECUTE FUNCTION public.transfer_host_to_next_participant();

-- ============================================================================
-- Grant execute permission
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.transfer_host_to_next_participant() TO authenticated;
