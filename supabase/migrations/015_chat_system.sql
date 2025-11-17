-- Migration 015: Chat System for Study Rooms
-- Real-time messaging functionality for group study rooms

-- =====================================================
-- Chat Messages Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL CHECK (char_length(message) <= 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_chat_messages_room_id ON public.chat_messages(room_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX idx_chat_messages_room_created ON public.chat_messages(room_id, created_at DESC);

-- =====================================================
-- Row Level Security Policies
-- =====================================================

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages from rooms they're participants in
CREATE POLICY "Users can view messages from their rooms"
    ON public.chat_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.room_participants
            WHERE room_participants.room_id = chat_messages.room_id
              AND room_participants.user_id = auth.uid()
              AND room_participants.is_active = true
        )
    );

-- Users can insert messages into rooms they're participants in
CREATE POLICY "Users can send messages to their rooms"
    ON public.chat_messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1
            FROM public.room_participants
            WHERE room_participants.room_id = chat_messages.room_id
              AND room_participants.user_id = auth.uid()
              AND room_participants.is_active = true
        )
    );

-- Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
    ON public.chat_messages
    FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- Auto-cleanup Function (Delete messages older than 30 days)
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.chat_messages
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Schedule cleanup to run daily (requires pg_cron extension)
-- Note: This requires the pg_cron extension to be enabled
-- If not available, can be run manually or via cron job
-- SELECT cron.schedule('cleanup-old-chats', '0 2 * * *', 'SELECT cleanup_old_chat_messages()');

-- =====================================================
-- Helper Functions
-- =====================================================

-- Get recent messages for a room
CREATE OR REPLACE FUNCTION get_room_messages(
    p_room_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    room_id UUID,
    user_id UUID,
    message TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user is in room
    IF NOT EXISTS (
        SELECT 1
        FROM public.room_participants
        WHERE room_participants.room_id = p_room_id
          AND room_participants.user_id = auth.uid()
          AND room_participants.is_active = true
    ) THEN
        RAISE EXCEPTION 'User is not a participant in this room';
    END IF;

    RETURN QUERY
    SELECT
        cm.id,
        cm.room_id,
        cm.user_id,
        cm.message,
        cm.created_at
    FROM public.chat_messages cm
    WHERE cm.room_id = p_room_id
    ORDER BY cm.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.chat_messages TO authenticated;
GRANT EXECUTE ON FUNCTION get_room_messages TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_chat_messages TO authenticated;
