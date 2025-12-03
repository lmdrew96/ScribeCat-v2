-- Migration 051: Direct Messages (Neomail-style private messaging)
-- Friends-only private messaging with read status and attachments

-- ============================================================================
-- TABLES
-- ============================================================================

-- Direct Messages Table
CREATE TABLE IF NOT EXISTS public.direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT CHECK (char_length(subject) <= 200),
    content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 5000),
    attachments JSONB DEFAULT '[]'::jsonb,
    -- Read status (null = unread, timestamp = when read)
    read_at TIMESTAMPTZ,
    -- Soft delete support (delete for me vs everyone)
    sender_deleted_at TIMESTAMPTZ,
    recipient_deleted_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Prevent self-messaging
    CONSTRAINT no_self_message CHECK (sender_id != recipient_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Inbox query (recipient's undeleted messages, ordered by date)
CREATE INDEX idx_dm_inbox ON public.direct_messages(recipient_id, created_at DESC)
WHERE recipient_deleted_at IS NULL;

-- Sent messages query (sender's undeleted messages, ordered by date)
CREATE INDEX idx_dm_sent ON public.direct_messages(sender_id, created_at DESC)
WHERE sender_deleted_at IS NULL;

-- Unread count (for badge) - recipient's unread, undeleted messages
CREATE INDEX idx_dm_unread ON public.direct_messages(recipient_id)
WHERE read_at IS NULL AND recipient_deleted_at IS NULL;

-- Conversation lookup (messages between two specific users)
CREATE INDEX idx_dm_conversation ON public.direct_messages(
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id),
    created_at DESC
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: get_unread_message_count
-- Returns count of unread messages for a user (for badge display)
CREATE OR REPLACE FUNCTION public.get_unread_message_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.direct_messages
        WHERE recipient_id = p_user_id
          AND read_at IS NULL
          AND recipient_deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: mark_conversation_as_read
-- Marks all unread messages from a specific sender as read
CREATE OR REPLACE FUNCTION public.mark_conversation_as_read(
    p_user_id UUID,
    p_sender_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE public.direct_messages
    SET read_at = NOW()
    WHERE recipient_id = p_user_id
      AND sender_id = p_sender_id
      AND read_at IS NULL
      AND recipient_deleted_at IS NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_inbox_messages
-- Returns inbox messages with sender profile info
CREATE OR REPLACE FUNCTION public.get_inbox_messages(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    sender_id UUID,
    recipient_id UUID,
    subject TEXT,
    content TEXT,
    attachments JSONB,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    sender_email TEXT,
    sender_username TEXT,
    sender_full_name TEXT,
    sender_avatar_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        dm.id,
        dm.sender_id,
        dm.recipient_id,
        dm.subject,
        dm.content,
        dm.attachments,
        dm.read_at,
        dm.created_at,
        up.email AS sender_email,
        up.username AS sender_username,
        up.full_name AS sender_full_name,
        up.avatar_url AS sender_avatar_url
    FROM public.direct_messages dm
    LEFT JOIN public.user_profiles up ON up.id = dm.sender_id
    WHERE dm.recipient_id = p_user_id
      AND dm.recipient_deleted_at IS NULL
    ORDER BY dm.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_sent_messages
-- Returns sent messages with recipient profile info
CREATE OR REPLACE FUNCTION public.get_sent_messages(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    sender_id UUID,
    recipient_id UUID,
    subject TEXT,
    content TEXT,
    attachments JSONB,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    recipient_email TEXT,
    recipient_username TEXT,
    recipient_full_name TEXT,
    recipient_avatar_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        dm.id,
        dm.sender_id,
        dm.recipient_id,
        dm.subject,
        dm.content,
        dm.attachments,
        dm.read_at,
        dm.created_at,
        up.email AS recipient_email,
        up.username AS recipient_username,
        up.full_name AS recipient_full_name,
        up.avatar_url AS recipient_avatar_url
    FROM public.direct_messages dm
    LEFT JOIN public.user_profiles up ON up.id = dm.recipient_id
    WHERE dm.sender_id = p_user_id
      AND dm.sender_deleted_at IS NULL
    ORDER BY dm.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_conversation_messages
-- Returns messages between two users (for viewing a thread)
CREATE OR REPLACE FUNCTION public.get_conversation_messages(
    p_user_id UUID,
    p_other_user_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    sender_id UUID,
    recipient_id UUID,
    subject TEXT,
    content TEXT,
    attachments JSONB,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    sender_email TEXT,
    sender_username TEXT,
    sender_full_name TEXT,
    sender_avatar_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        dm.id,
        dm.sender_id,
        dm.recipient_id,
        dm.subject,
        dm.content,
        dm.attachments,
        dm.read_at,
        dm.created_at,
        up.email AS sender_email,
        up.username AS sender_username,
        up.full_name AS sender_full_name,
        up.avatar_url AS sender_avatar_url
    FROM public.direct_messages dm
    LEFT JOIN public.user_profiles up ON up.id = dm.sender_id
    WHERE (
        (dm.sender_id = p_user_id AND dm.recipient_id = p_other_user_id AND dm.sender_deleted_at IS NULL)
        OR (dm.sender_id = p_other_user_id AND dm.recipient_id = p_user_id AND dm.recipient_deleted_at IS NULL)
    )
    ORDER BY dm.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view messages they sent or received (if not deleted for them)
CREATE POLICY "Users can view their own messages"
    ON public.direct_messages
    FOR SELECT
    USING (
        (auth.uid() = sender_id AND sender_deleted_at IS NULL)
        OR (auth.uid() = recipient_id AND recipient_deleted_at IS NULL)
    );

-- Policy: Users can send messages only to friends (uses existing are_friends function)
CREATE POLICY "Users can send messages to friends"
    ON public.direct_messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND sender_id != recipient_id
        AND public.are_friends(sender_id, recipient_id)
    );

-- Policy: Recipients can update messages (mark as read, soft delete)
CREATE POLICY "Recipients can update received messages"
    ON public.direct_messages
    FOR UPDATE
    USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);

-- Policy: Senders can update their sent messages (soft delete only)
CREATE POLICY "Senders can update sent messages"
    ON public.direct_messages
    FOR UPDATE
    USING (auth.uid() = sender_id)
    WITH CHECK (auth.uid() = sender_id);

-- ============================================================================
-- ATTACHMENTS STORAGE BUCKET
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false, -- Private bucket
  5242880, -- 5MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: Users can upload attachments to their own folder
CREATE POLICY "Users can upload message attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage RLS: Users can view attachments they uploaded or received
CREATE POLICY "Users can view message attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  (
    -- User's own uploads
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Attachments from messages they received
    EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.recipient_id = auth.uid()
        AND dm.recipient_deleted_at IS NULL
        AND dm.attachments::text LIKE '%' || storage.filename(name) || '%'
    )
  )
);

-- Storage RLS: Users can delete their own uploads
CREATE POLICY "Users can delete own message attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_message_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_as_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inbox_messages(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sent_messages(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_messages(UUID, UUID, INTEGER) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.direct_messages IS 'Private messages between friends (Neomail-style)';
COMMENT ON FUNCTION public.get_unread_message_count IS 'Get count of unread messages for badge display';
COMMENT ON FUNCTION public.mark_conversation_as_read IS 'Mark all messages from a sender as read';
COMMENT ON FUNCTION public.get_inbox_messages IS 'Get inbox messages with sender profile info';
COMMENT ON FUNCTION public.get_sent_messages IS 'Get sent messages with recipient profile info';
COMMENT ON FUNCTION public.get_conversation_messages IS 'Get message thread between two users';
