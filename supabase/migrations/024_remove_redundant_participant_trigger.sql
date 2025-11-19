-- Migration: Remove redundant deactivate_participant_on_leave trigger
--
-- This trigger was setting is_active = false when left_at is set, but the
-- leaveRoom() method already does this explicitly in the UPDATE statement.
-- Having both causes redundant operations and can contribute to race conditions.
--
-- Created: 2025-11-18

-- Drop the trigger first
DROP TRIGGER IF EXISTS trigger_deactivate_participant_on_leave ON public.room_participants;

-- Drop the function
DROP FUNCTION IF EXISTS public.deactivate_participant_on_leave();
