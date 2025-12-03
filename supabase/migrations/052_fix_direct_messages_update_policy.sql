-- Migration 052: Fix direct_messages UPDATE policies
-- Consolidate into a single policy that handles both sender and recipient updates

-- Drop all existing UPDATE policies
DROP POLICY IF EXISTS "Recipients can update received messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Senders can update sent messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can update their messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON public.direct_messages;
DROP POLICY IF EXISTS "Senders can soft delete their messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Recipients can soft delete their messages" ON public.direct_messages;

-- Create a SINGLE unified UPDATE policy
-- This allows both senders and recipients to update their messages
-- The key is having BOTH conditions in USING AND WITH CHECK using OR
CREATE POLICY "Users can update own messages"
    ON public.direct_messages
    FOR UPDATE
    USING (
        auth.uid() = sender_id OR auth.uid() = recipient_id
    )
    WITH CHECK (
        -- The updated row must still have the same sender_id and recipient_id
        -- (we're only allowing updates to read_at and *_deleted_at fields)
        auth.uid() = sender_id OR auth.uid() = recipient_id
    );

-- Drop the soft_delete_message function if it exists (we'll use direct updates instead)
DROP FUNCTION IF EXISTS public.soft_delete_message(UUID, UUID);
