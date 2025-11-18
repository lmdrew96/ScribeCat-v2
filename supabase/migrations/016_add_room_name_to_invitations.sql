/**
 * Migration 016: Add room_name to room_invitations
 *
 * Fixes issue where invitees can't see room names due to RLS policies.
 * Stores room name denormalized in invitation for easy access.
 */

-- Add room_name column to room_invitations
ALTER TABLE public.room_invitations
ADD COLUMN IF NOT EXISTS room_name TEXT;

-- Backfill existing invitations with room names (for hosts who can still see them)
-- This will fail silently for invitations where the room name can't be fetched
DO $$
DECLARE
    inv RECORD;
    r_name TEXT;
BEGIN
    FOR inv IN SELECT id, room_id FROM public.room_invitations WHERE room_name IS NULL
    LOOP
        BEGIN
            SELECT name INTO r_name
            FROM public.study_rooms
            WHERE id = inv.room_id;

            IF FOUND THEN
                UPDATE public.room_invitations
                SET room_name = r_name
                WHERE id = inv.id;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- Skip if we can't access the room (RLS restriction)
                CONTINUE;
        END;
    END LOOP;
END $$;
