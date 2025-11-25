-- Enable Realtime for room invitations and friend requests
-- This allows Supabase Realtime to broadcast changes to subscribed clients

-- Enable REPLICA IDENTITY FULL for room_invitations
-- This is required for Supabase Realtime to work with UPDATE events
ALTER TABLE public.room_invitations REPLICA IDENTITY FULL;

-- Enable REPLICA IDENTITY FULL for friend_requests
ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication (idempotent - won't error if already added)
DO $$
BEGIN
    -- Add room_invitations if not already in publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'room_invitations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.room_invitations;
    END IF;

    -- Add friend_requests if not already in publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'friend_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
    END IF;
END $$;
