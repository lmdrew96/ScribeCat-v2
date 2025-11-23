-- Migration 041: Restore RLS Policies for user_profiles
--
-- Problem: Migration 003_cleanup.sql dropped the user_profiles table and all its RLS policies.
--          Migration 021_ensure_user_profiles_exists.sql recreated the table but forgot to
--          restore the RLS policies and enable RLS.
--
-- Solution: This migration restores the RLS policies that were originally created in
--           migration 003_sharing_system.sql (lines 159-176).

-- Enable Row Level Security on user_profiles table
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: SELECT - Allow all authenticated users to view profiles
-- Reasoning: Required for social features (friend search, displaying room participants,
--            showing game players, chat senders). Profile data (email, name, avatar) is
--            not sensitive in a collaborative app context.
CREATE POLICY "User profiles are viewable by everyone"
  ON public.user_profiles
  FOR SELECT
  USING (true);

-- Policy 2: UPDATE - Users can only update their own profile
-- Reasoning: Allows users to update preferences/settings while preventing
--            modification of other users' profiles.
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 3: INSERT - Users can only create their own profile
-- Reasoning: Prevents creating profiles for other users. Note that profiles are
--            typically auto-created via trigger (handle_new_user), but this policy
--            allows manual creation as a fallback.
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Note: No DELETE policy is intentionally omitted
-- Reasoning: Profiles should only be deleted when the auth user is deleted,
--            which is handled automatically via CASCADE (user_profiles.id references
--            auth.users(id) ON DELETE CASCADE). Manual deletion would break
--            referential integrity with friends, rooms, and game records.
