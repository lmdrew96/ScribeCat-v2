-- Migration 053: Force soft delete via service role function
-- This function runs as postgres (superuser) and bypasses all RLS

-- First, let's check what UPDATE policies exist and drop them all
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'direct_messages'
        AND cmd = 'UPDATE'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.direct_messages', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Create a very permissive UPDATE policy
-- This allows any authenticated user who is sender OR recipient to update
CREATE POLICY "allow_message_updates"
    ON public.direct_messages
    FOR UPDATE
    TO authenticated
    USING (true)  -- Allow selecting any row (RLS on SELECT will filter appropriately)
    WITH CHECK (
        -- Only allow if user is sender or recipient
        sender_id = auth.uid() OR recipient_id = auth.uid()
    );

-- Alternative: Create a function that runs as the table owner
CREATE OR REPLACE FUNCTION public.delete_message_for_user(
    p_message_id UUID,
    p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result JSON;
    v_sender UUID;
    v_recipient UUID;
BEGIN
    -- Get message info (this runs as postgres, bypassing RLS)
    SELECT sender_id, recipient_id
    INTO v_sender, v_recipient
    FROM direct_messages
    WHERE id = p_message_id;

    IF v_sender IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Message not found');
    END IF;

    IF p_user_id = v_sender THEN
        -- User is sender, mark as deleted for sender
        UPDATE direct_messages
        SET sender_deleted_at = NOW()
        WHERE id = p_message_id;
        RETURN json_build_object('success', true, 'deleted_for', 'sender');
    ELSIF p_user_id = v_recipient THEN
        -- User is recipient, mark as deleted for recipient
        UPDATE direct_messages
        SET recipient_deleted_at = NOW()
        WHERE id = p_message_id;
        RETURN json_build_object('success', true, 'deleted_for', 'recipient');
    ELSE
        RETURN json_build_object('success', false, 'error', 'Access denied');
    END IF;
END;
$$;

-- Ensure function is owned by postgres (superuser)
ALTER FUNCTION public.delete_message_for_user(UUID, UUID) OWNER TO postgres;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_message_for_user(UUID, UUID) TO authenticated;

-- Also grant service_role access
GRANT EXECUTE ON FUNCTION public.delete_message_for_user(UUID, UUID) TO service_role;
