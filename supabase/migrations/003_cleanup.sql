-- ============================================================================
-- ⚠️ DANGER: DESTRUCTIVE CLEANUP SCRIPT ⚠️
-- ============================================================================
-- Cleanup script for Phase 3 sharing system
-- Run this first if you encounter "already exists" errors during initial setup
--
-- ⚠️ WARNING: THIS SCRIPT WILL DELETE ALL USER DATA ⚠️
--
-- This script will PERMANENTLY DELETE:
-- - All user profiles in public.user_profiles
-- - All session sharing relationships in public.session_shares
-- - All pending share invitations in public.share_invitations
--
-- IMPORTANT: auth.users table is NOT affected, but user profiles will be deleted!
--
-- ============================================================================
-- WHEN TO USE THIS SCRIPT:
-- ============================================================================
-- ✓ SAFE to run: During initial database setup (before any users exist)
-- ✓ SAFE to run: In development with test data only
-- ✗ NEVER run: On production database with real users
-- ✗ NEVER run: If users have already signed up and created data
--
-- ============================================================================
-- BEFORE RUNNING THIS SCRIPT:
-- ============================================================================
-- 1. Create a database backup in Supabase Dashboard
-- 2. Verify you're on the correct database (dev vs. production)
-- 3. Understand that ALL USER PROFILES will be deleted
-- 4. Ensure you have a way to restore if needed
--
-- ============================================================================
-- RECOVERY AFTER RUNNING:
-- ============================================================================
-- If you accidentally run this on a database with real users:
-- 1. Go to Supabase Dashboard → Database → Backups
-- 2. Restore from the most recent backup before this script ran
-- 3. Or contact Supabase support for point-in-time recovery
-- 4. Or run /supabase/diagnostics/restore_user_profile.sql to manually restore
--
-- ============================================================================
-- TO PROCEED: Uncomment the line below to confirm you understand the risks
-- ============================================================================
-- I_UNDERSTAND_THIS_WILL_DELETE_ALL_DATA := true;
--
-- (Keep this commented out to prevent accidental execution)
-- ============================================================================

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
-- ⚠️ WARNING: The next 3 lines will DELETE ALL USER DATA
DROP TABLE IF EXISTS public.session_shares CASCADE;
DROP TABLE IF EXISTS public.share_invitations CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;  -- ⚠️ DELETES ALL USER PROFILES

-- ============================================================================
-- CLEANUP COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Run the main migration: 003_sharing_system.sql
-- 2. Existing auth.users will get new user_profiles created on next login
--    (via the handle_new_user trigger in 003_sharing_system.sql)
-- 3. If you need to restore specific users, use:
--    /supabase/diagnostics/restore_user_profile.sql
-- ============================================================================
