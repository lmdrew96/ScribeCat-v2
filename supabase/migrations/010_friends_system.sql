-- Migration 010: Friends System
-- Adds friend requests and friendships functionality

-- ============================================================================
-- TABLES
-- ============================================================================

-- Friend Requests Table
-- Stores pending, accepted, and rejected friend requests
CREATE TABLE IF NOT EXISTS public.friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Prevent duplicate requests
    CONSTRAINT unique_friend_request UNIQUE (sender_id, recipient_id),
    -- Prevent self-friend requests
    CONSTRAINT no_self_friend_request CHECK (sender_id != recipient_id)
);

-- Friendships Table
-- Stores bidirectional friend relationships (created when request is accepted)
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Prevent duplicate friendships
    CONSTRAINT unique_friendship UNIQUE (user_id, friend_id),
    -- Prevent self-friendship
    CONSTRAINT no_self_friendship CHECK (user_id != friend_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Indexes for friend_requests
CREATE INDEX idx_friend_requests_sender ON public.friend_requests(sender_id) WHERE status = 'pending';
CREATE INDEX idx_friend_requests_recipient ON public.friend_requests(recipient_id) WHERE status = 'pending';
CREATE INDEX idx_friend_requests_status ON public.friend_requests(status);

-- Indexes for friendships
CREATE INDEX idx_friendships_user ON public.friendships(user_id);
CREATE INDEX idx_friendships_friend ON public.friendships(friend_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: are_friends
-- Check if two users are friends
CREATE OR REPLACE FUNCTION public.are_friends(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.friendships
        WHERE (user_id = user_a AND friend_id = user_b)
           OR (user_id = user_b AND friend_id = user_a)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_mutual_friends_count
-- Count mutual friends between two users
CREATE OR REPLACE FUNCTION public.get_mutual_friends_count(user_a UUID, user_b UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM public.friendships f1
        INNER JOIN public.friendships f2
            ON f1.friend_id = f2.friend_id
        WHERE f1.user_id = user_a
          AND f2.user_id = user_b
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: has_pending_friend_request
-- Check if there's a pending request between two users (either direction)
CREATE OR REPLACE FUNCTION public.has_pending_friend_request(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.friend_requests
        WHERE status = 'pending'
          AND ((sender_id = user_a AND recipient_id = user_b)
               OR (sender_id = user_b AND recipient_id = user_a))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update updated_at timestamp on friend_requests
CREATE OR REPLACE FUNCTION public.update_friend_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER friend_requests_updated_at
    BEFORE UPDATE ON public.friend_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_friend_request_timestamp();

-- Trigger: Create bidirectional friendship when request is accepted
CREATE OR REPLACE FUNCTION public.create_friendship_on_accept()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger when status changes to 'accepted'
    IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
        -- Create bidirectional friendship entries
        INSERT INTO public.friendships (user_id, friend_id)
        VALUES (NEW.sender_id, NEW.recipient_id)
        ON CONFLICT (user_id, friend_id) DO NOTHING;

        INSERT INTO public.friendships (user_id, friend_id)
        VALUES (NEW.recipient_id, NEW.sender_id)
        ON CONFLICT (user_id, friend_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER friend_request_accepted
    AFTER UPDATE ON public.friend_requests
    FOR EACH ROW
    WHEN (NEW.status = 'accepted')
    EXECUTE FUNCTION public.create_friendship_on_accept();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Friend Requests Policies
-- Users can view requests they sent or received
CREATE POLICY "Users can view their own friend requests"
    ON public.friend_requests
    FOR SELECT
    USING (
        auth.uid() = sender_id
        OR auth.uid() = recipient_id
    );

-- Users can send friend requests
CREATE POLICY "Users can send friend requests"
    ON public.friend_requests
    FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND sender_id != recipient_id
        -- Note: Duplicate requests are prevented by unique constraint
        -- Note: Already friends check is handled by application logic
    );

-- Users can update requests they sent (cancel) or received (accept/reject)
CREATE POLICY "Users can update their friend requests"
    ON public.friend_requests
    FOR UPDATE
    USING (
        auth.uid() = sender_id
        OR auth.uid() = recipient_id
    )
    WITH CHECK (
        auth.uid() = sender_id
        OR auth.uid() = recipient_id
    );

-- Users can delete requests they sent
CREATE POLICY "Users can delete friend requests they sent"
    ON public.friend_requests
    FOR DELETE
    USING (auth.uid() = sender_id);

-- Friendships Policies
-- Users can view their own friendships
CREATE POLICY "Users can view friendships"
    ON public.friendships
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR auth.uid() = friend_id
    );

-- Only the system can create friendships (via trigger)
-- No manual INSERT policy needed

-- Users can delete their own friendships (unfriend)
CREATE POLICY "Users can delete their friendships"
    ON public.friendships
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;
GRANT SELECT, DELETE ON public.friendships TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.friend_requests IS 'Stores friend requests between users with status tracking';
COMMENT ON TABLE public.friendships IS 'Stores bidirectional friend relationships, created when requests are accepted';
COMMENT ON FUNCTION public.are_friends IS 'Check if two users are friends';
COMMENT ON FUNCTION public.get_mutual_friends_count IS 'Count mutual friends between two users';
COMMENT ON FUNCTION public.has_pending_friend_request IS 'Check if there is a pending friend request between two users';
