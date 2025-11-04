-- Cleanup script for Phase 3 sharing system
-- Run this first if you encounter "already exists" errors

-- Drop existing indexes
DROP INDEX IF EXISTS public.idx_session_shares_session_id;
DROP INDEX IF EXISTS public.idx_session_shares_shared_with;
DROP INDEX IF EXISTS public.idx_session_shares_shared_by;
DROP INDEX IF EXISTS public.idx_share_invitations_token;
DROP INDEX IF EXISTS public.idx_share_invitations_email;
DROP INDEX IF EXISTS public.idx_share_invitations_session_id;
DROP INDEX IF EXISTS public.idx_user_profiles_email;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
DROP TRIGGER IF EXISTS update_sessions_updated_at ON public.sessions;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop existing functions (CASCADE to handle dependencies)
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_email(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.has_session_permission(UUID, UUID, TEXT) CASCADE;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their shares" ON public.session_shares;
DROP POLICY IF EXISTS "Users can create shares for their sessions" ON public.session_shares;
DROP POLICY IF EXISTS "Users can delete shares they created" ON public.session_shares;
DROP POLICY IF EXISTS "Users can accept shares" ON public.session_shares;

DROP POLICY IF EXISTS "Users can view their invitations" ON public.share_invitations;
DROP POLICY IF EXISTS "Users can create invitations" ON public.share_invitations;
DROP POLICY IF EXISTS "Users can delete invitations" ON public.share_invitations;
DROP POLICY IF EXISTS "Users can accept invitations" ON public.share_invitations;

DROP POLICY IF EXISTS "User profiles are viewable by everyone" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

DROP POLICY IF EXISTS "Users can view their sessions and shared sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can update their sessions and shared sessions" ON public.sessions;
DROP POLICY IF EXISTS "Only owners can delete sessions" ON public.sessions;

-- Drop existing tables (this will cascade delete all data)
DROP TABLE IF EXISTS public.session_shares CASCADE;
DROP TABLE IF EXISTS public.share_invitations CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Note: This script is safe to run multiple times
-- After running this, run the main migration: 003_sharing_system.sql
