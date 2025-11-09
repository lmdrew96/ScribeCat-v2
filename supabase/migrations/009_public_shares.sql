/**
 * Public Shares Migration
 *
 * Adds support for public sharing links with optional password protection
 * and expiration dates.
 */

-- Create public_shares table
CREATE TABLE IF NOT EXISTS public_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE, -- URL-safe token for sharing
  password_hash TEXT, -- Optional password (bcrypt hash)
  expires_at TIMESTAMPTZ, -- Optional expiration
  view_count INTEGER DEFAULT 0, -- Track how many times viewed
  max_views INTEGER, -- Optional max views limit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,

  CONSTRAINT public_shares_session_id_fkey FOREIGN KEY (session_id) REFERENCES sessions(id),
  CONSTRAINT public_shares_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id)
);

-- Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_public_shares_token ON public_shares(token);
CREATE INDEX IF NOT EXISTS idx_public_shares_session_id ON public_shares(session_id);
CREATE INDEX IF NOT EXISTS idx_public_shares_created_by ON public_shares(created_by_user_id);

-- Add index for cleanup queries (expired shares)
CREATE INDEX IF NOT EXISTS idx_public_shares_expires_at ON public_shares(expires_at) WHERE expires_at IS NOT NULL;

-- Row Level Security Policies
ALTER TABLE public_shares ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view public shares they created
CREATE POLICY "Users can view their own public shares"
  ON public_shares FOR SELECT
  USING (created_by_user_id = auth.uid());

-- Policy: Users can create public shares for sessions they own
CREATE POLICY "Users can create public shares for their sessions"
  ON public_shares FOR INSERT
  WITH CHECK (
    created_by_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = public_shares.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own public shares
CREATE POLICY "Users can delete their own public shares"
  ON public_shares FOR DELETE
  USING (created_by_user_id = auth.uid());

-- Policy: Users can update their own public shares
CREATE POLICY "Users can update their own public shares"
  ON public_shares FOR UPDATE
  USING (created_by_user_id = auth.uid())
  WITH CHECK (created_by_user_id = auth.uid());

-- Function: Generate a random URL-safe token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 32-character URL-safe token
    token := encode(gen_random_bytes(24), 'base64');
    token := replace(replace(replace(token, '/', '_'), '+', '-'), '=', '');

    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM public_shares WHERE public_shares.token = token) INTO exists;

    -- If token doesn't exist, use it
    IF NOT exists THEN
      RETURN token;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function: Check if public share is accessible (not expired, not over view limit)
CREATE OR REPLACE FUNCTION is_public_share_accessible(share_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  share RECORD;
BEGIN
  SELECT * INTO share FROM public_shares WHERE id = share_id;

  -- Check expiration
  IF share.expires_at IS NOT NULL AND share.expires_at < NOW() THEN
    RETURN FALSE;
  END IF;

  -- Check view limit
  IF share.max_views IS NOT NULL AND share.view_count >= share.max_views THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: Increment view count and update last accessed
CREATE OR REPLACE FUNCTION increment_share_view(share_token TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public_shares
  SET
    view_count = view_count + 1,
    last_accessed_at = NOW()
  WHERE token = share_token;
END;
$$ LANGUAGE plpgsql;

-- Automatic cleanup of expired shares (run daily)
-- Note: This would typically be set up as a cron job or scheduled function
CREATE OR REPLACE FUNCTION cleanup_expired_public_shares()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public_shares
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON public_shares TO authenticated;
GRANT ALL ON public_shares TO anon; -- Allow anonymous access to view public shares

-- Comments
COMMENT ON TABLE public_shares IS 'Public sharing links for sessions with optional password protection and expiration';
COMMENT ON COLUMN public_shares.token IS 'URL-safe token for accessing the public share';
COMMENT ON COLUMN public_shares.password_hash IS 'Optional bcrypt hash of password for protected shares';
COMMENT ON COLUMN public_shares.expires_at IS 'Optional expiration timestamp';
COMMENT ON COLUMN public_shares.view_count IS 'Number of times this share has been viewed';
COMMENT ON COLUMN public_shares.max_views IS 'Optional maximum number of views before share becomes inaccessible';
