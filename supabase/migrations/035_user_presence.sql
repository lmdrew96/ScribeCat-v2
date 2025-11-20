-- Migration 035: User Presence System
-- Enable real-time presence tracking for friends to see online/offline status and activities

-- Create enum for user status
CREATE TYPE user_status AS ENUM ('online', 'away', 'offline');

-- Create user_presence table
CREATE TABLE IF NOT EXISTS user_presence (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    status user_status NOT NULL DEFAULT 'offline',
    activity TEXT, -- e.g., "Studying PSYCH101", "In Quiz Battle", null if just online
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient friend presence queries
CREATE INDEX idx_user_presence_status ON user_presence(status);
CREATE INDEX idx_user_presence_last_seen ON user_presence(last_seen);

-- Enable Row Level Security
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can always read their own presence
CREATE POLICY "Users can read own presence"
    ON user_presence
    FOR SELECT
    USING (auth.uid() = user_id);

-- RLS Policy: Users can update their own presence
CREATE POLICY "Users can update own presence"
    ON user_presence
    FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own presence
CREATE POLICY "Users can insert own presence"
    ON user_presence
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Friends can see each other's presence
CREATE POLICY "Friends can see each other's presence"
    ON user_presence
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM friendships
            WHERE (
                (friendships.user_id = auth.uid() AND friendships.friend_id = user_presence.user_id)
                OR
                (friendships.friend_id = auth.uid() AND friendships.user_id = user_presence.user_id)
            )
        )
    );

-- Function to get friends' presence information
CREATE OR REPLACE FUNCTION get_friends_presence(target_user_id UUID)
RETURNS TABLE (
    friend_id UUID,
    status user_status,
    activity TEXT,
    last_seen TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN f.user_id = target_user_id THEN f.friend_id
            ELSE f.user_id
        END as friend_id,
        COALESCE(up.status, 'offline'::user_status) as status,
        up.activity,
        COALESCE(up.last_seen, NOW() - INTERVAL '1 year') as last_seen
    FROM friendships f
    LEFT JOIN user_presence up ON (
        CASE
            WHEN f.user_id = target_user_id THEN f.friend_id
            ELSE f.user_id
        END = up.user_id
    )
    WHERE f.user_id = target_user_id OR f.friend_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user presence (upsert)
CREATE OR REPLACE FUNCTION update_user_presence(
    p_user_id UUID,
    p_status user_status,
    p_activity TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO user_presence (user_id, status, activity, last_seen, updated_at)
    VALUES (p_user_id, p_status, p_activity, NOW(), NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        status = EXCLUDED.status,
        activity = EXCLUDED.activity,
        last_seen = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically set users to offline if they haven't updated in 2 minutes
CREATE OR REPLACE FUNCTION auto_set_offline()
RETURNS void AS $$
BEGIN
    UPDATE user_presence
    SET status = 'offline'::user_status,
        activity = NULL,
        updated_at = NOW()
    WHERE status != 'offline'::user_status
    AND last_seen < NOW() - INTERVAL '2 minutes';
END;
$$ LANGUAGE plpgsql;

-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_presence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_presence_updated_at
    BEFORE UPDATE ON user_presence
    FOR EACH ROW
    EXECUTE FUNCTION update_presence_timestamp();

-- Enable realtime for user_presence table
ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON user_presence TO authenticated;
GRANT EXECUTE ON FUNCTION get_friends_presence(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_presence(UUID, user_status, TEXT) TO authenticated;

-- Comment on table and columns for documentation
COMMENT ON TABLE user_presence IS 'Tracks real-time presence status of users (online/away/offline) and their current activity';
COMMENT ON COLUMN user_presence.status IS 'User status: online (active), away (idle), or offline';
COMMENT ON COLUMN user_presence.activity IS 'Current user activity, e.g., "Studying PSYCH101" or "In Quiz Battle"';
COMMENT ON COLUMN user_presence.last_seen IS 'Last time the user updated their presence (heartbeat)';
COMMENT ON COLUMN user_presence.updated_at IS 'When this presence record was last modified';
