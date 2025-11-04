-- Phase 3: Sharing & Permissions System
-- This migration adds tables and policies for session sharing and collaboration

-- ============================================================================
-- 1. SESSION SHARES TABLE
-- ============================================================================
-- Tracks active shares between users
CREATE TABLE IF NOT EXISTS public.session_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level TEXT NOT NULL CHECK (permission_level IN ('viewer', 'editor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  -- Prevent duplicate shares
  UNIQUE(session_id, shared_with_user_id),

  -- Prevent self-sharing
  CHECK (shared_by_user_id != shared_with_user_id)
);

-- Indexes for performance
CREATE INDEX idx_session_shares_session_id ON public.session_shares(session_id);
CREATE INDEX idx_session_shares_shared_with ON public.session_shares(shared_with_user_id);
CREATE INDEX idx_session_shares_shared_by ON public.session_shares(shared_by_user_id);

-- ============================================================================
-- 2. SHARE INVITATIONS TABLE
-- ============================================================================
-- Tracks pending share invitations sent via email
CREATE TABLE IF NOT EXISTS public.share_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  permission_level TEXT NOT NULL CHECK (permission_level IN ('viewer', 'editor')),
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Prevent duplicate pending invitations
  UNIQUE(session_id, email)
);

-- Indexes
CREATE INDEX idx_share_invitations_token ON public.share_invitations(token);
CREATE INDEX idx_share_invitations_email ON public.share_invitations(email);
CREATE INDEX idx_share_invitations_session_id ON public.share_invitations(session_id);

-- ============================================================================
-- 3. USER PROFILES TABLE
-- ============================================================================
-- Extends auth.users with public profile information
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.session_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- session_shares policies
-- -----------------------------------------------------------------------------

-- Users can view shares for sessions they own or have been shared with
CREATE POLICY "Users can view their shares"
  ON public.session_shares
  FOR SELECT
  USING (
    auth.uid() = shared_by_user_id
    OR auth.uid() = shared_with_user_id
  );

-- Users can create shares for sessions they own
CREATE POLICY "Users can create shares for their sessions"
  ON public.session_shares
  FOR INSERT
  WITH CHECK (
    auth.uid() = shared_by_user_id
    AND EXISTS (
      SELECT 1 FROM public.sessions
      WHERE id = session_id AND user_id = auth.uid()
    )
  );

-- Users can delete shares they created
CREATE POLICY "Users can delete shares they created"
  ON public.session_shares
  FOR DELETE
  USING (auth.uid() = shared_by_user_id);

-- Users can accept shares (update accepted_at)
CREATE POLICY "Users can accept shares"
  ON public.session_shares
  FOR UPDATE
  USING (auth.uid() = shared_with_user_id)
  WITH CHECK (auth.uid() = shared_with_user_id);

-- -----------------------------------------------------------------------------
-- share_invitations policies
-- -----------------------------------------------------------------------------

-- Users can view invitations they created or received
CREATE POLICY "Users can view their invitations"
  ON public.share_invitations
  FOR SELECT
  USING (
    auth.uid() = shared_by_user_id
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Users can create invitations for their sessions
CREATE POLICY "Users can create invitations"
  ON public.share_invitations
  FOR INSERT
  WITH CHECK (
    auth.uid() = shared_by_user_id
    AND EXISTS (
      SELECT 1 FROM public.sessions
      WHERE id = session_id AND user_id = auth.uid()
    )
  );

-- Users can delete invitations they created
CREATE POLICY "Users can delete invitations"
  ON public.share_invitations
  FOR DELETE
  USING (auth.uid() = shared_by_user_id);

-- Users can accept invitations (update accepted_at)
CREATE POLICY "Users can accept invitations"
  ON public.share_invitations
  FOR UPDATE
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- -----------------------------------------------------------------------------
-- user_profiles policies
-- -----------------------------------------------------------------------------

-- Everyone can view user profiles (for displaying collaborators)
CREATE POLICY "User profiles are viewable by everyone"
  ON public.user_profiles
  FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- Update sessions table RLS to allow shared access
-- -----------------------------------------------------------------------------

-- Drop existing policies on sessions table
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.sessions;

-- Users can view sessions they own OR sessions shared with them
CREATE POLICY "Users can view their sessions and shared sessions"
  ON public.sessions
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.session_shares
      WHERE session_id = sessions.id
      AND shared_with_user_id = auth.uid()
    )
  );

-- Users can insert their own sessions
CREATE POLICY "Users can insert their own sessions"
  ON public.sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update sessions they own OR sessions shared with them as 'editor'
CREATE POLICY "Users can update their sessions and shared sessions"
  ON public.sessions
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.session_shares
      WHERE session_id = sessions.id
      AND shared_with_user_id = auth.uid()
      AND permission_level = 'editor'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.session_shares
      WHERE session_id = sessions.id
      AND shared_with_user_id = auth.uid()
      AND permission_level = 'editor'
    )
  );

-- Only owners can delete sessions
CREATE POLICY "Only owners can delete sessions"
  ON public.sessions
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's email by ID
CREATE OR REPLACE FUNCTION public.get_user_email(user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT email FROM auth.users WHERE id = user_id;
$$;

-- Function to check if user has permission to access a session
CREATE OR REPLACE FUNCTION public.has_session_permission(
  session_id UUID,
  user_id UUID,
  required_permission TEXT DEFAULT 'viewer'
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    -- User owns the session
    SELECT 1 FROM public.sessions
    WHERE id = session_id AND user_id = user_id

    UNION

    -- User has been granted access
    SELECT 1 FROM public.session_shares
    WHERE session_id = session_id
    AND shared_with_user_id = user_id
    AND (
      required_permission = 'viewer'
      OR permission_level = 'editor'
    )
  );
$$;

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

-- Auto-update updated_at on user_profiles
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Recreate sessions table trigger (may have been dropped by cleanup script)
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create user profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 7. GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant permissions on tables
GRANT ALL ON public.session_shares TO authenticated;
GRANT ALL ON public.share_invitations TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.get_user_email(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_session_permission(UUID, UUID, TEXT) TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Phase 3 database schema is now ready for sharing and collaboration!
