-- ============================================================================
-- USER PROFILE DIAGNOSTICS AND RESTORATION SCRIPT
-- ============================================================================
-- Purpose: Diagnose and restore missing user profile for lmdrew@udel.edu
-- Date: 2025-11-05
-- Run these queries in Supabase SQL Editor
--
-- IMPORTANT: Run each section separately and review results before proceeding
-- ============================================================================

-- ============================================================================
-- STEP 1: VERIFY ACCOUNT STATUS
-- ============================================================================

-- 1.1: Check if auth user exists
SELECT
  id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at,
  raw_user_meta_data
FROM auth.users
WHERE email = 'lmdrew@udel.edu';

-- Expected: Should return 1 row if account exists in auth
-- If NO ROWS: Account was completely deleted, will need Supabase backup recovery
-- If 1 ROW: Proceed to next step


-- 1.2: Check if user profile exists
SELECT * FROM public.user_profiles
WHERE email = 'lmdrew@udel.edu';

-- Expected: Should return 0 rows (confirming profile is missing)
-- If 1 ROW: Profile exists, issue is elsewhere
-- If 0 ROWS: Profile is missing, proceed to restoration


-- 1.3: Check for orphaned sessions (sessions without user profile)
SELECT
  s.id as session_id,
  s.title,
  s.user_id,
  s.created_at,
  CASE
    WHEN up.id IS NULL THEN 'ORPHANED - No profile'
    ELSE 'OK - Has profile'
  END as status
FROM public.sessions s
LEFT JOIN public.user_profiles up ON s.user_id = up.id
WHERE up.id IS NULL
ORDER BY s.created_at DESC
LIMIT 10;

-- Expected: May show sessions belonging to deleted user profile
-- These sessions still reference the user_id but can't display user info


-- ============================================================================
-- STEP 2: CHECK DATABASE TRIGGER STATUS
-- ============================================================================

-- 2.1: Verify trigger exists and is enabled
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing,
  action_orientation
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';

-- Expected: Should return 1 row showing trigger is active
-- If NO ROWS: Trigger is missing, need to recreate it


-- 2.2: Check if trigger function exists
SELECT
  proname as function_name,
  prosrc as function_source
FROM pg_proc
WHERE proname = 'handle_new_user'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Expected: Should return function definition
-- If NO ROWS: Function is missing, need to recreate


-- ============================================================================
-- STEP 3A: RESTORE USER PROFILE (IF AUTH USER EXISTS)
-- ============================================================================
-- ONLY RUN THIS IF:
-- - Step 1.1 returned a row (auth user exists)
-- - Step 1.2 returned no rows (profile is missing)
-- ============================================================================

-- 3A.1: Get the auth user ID first
-- REPLACE THIS WITH THE ACTUAL ID FROM STEP 1.1 RESULTS
-- Example: DO $$
-- DECLARE
--   auth_user_id UUID;
-- BEGIN
--   -- Get the auth user ID
--   SELECT id INTO auth_user_id
--   FROM auth.users
--   WHERE email = 'lmdrew@udel.edu';
--
--   -- Check if we found the user
--   IF auth_user_id IS NULL THEN
--     RAISE EXCEPTION 'Auth user not found for lmdrew@udel.edu';
--   END IF;
--
--   RAISE NOTICE 'Found auth user ID: %', auth_user_id;
-- END $$;


-- 3A.2: Manually create the missing user profile
-- ⚠️ ONLY RUN AFTER CONFIRMING THE AUTH USER EXISTS
-- ⚠️ This will restore the profile link

DO $$
DECLARE
  auth_user_record RECORD;
BEGIN
  -- Get auth user info
  SELECT
    id,
    email,
    raw_user_meta_data->>'full_name' as full_name,
    raw_user_meta_data->>'name' as name,
    raw_user_meta_data->>'avatar_url' as avatar_url,
    raw_user_meta_data->>'picture' as picture
  INTO auth_user_record
  FROM auth.users
  WHERE email = 'lmdrew@udel.edu';

  -- Check if user exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user not found for lmdrew@udel.edu. Cannot restore profile.';
  END IF;

  -- Insert the user profile
  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    avatar_url,
    created_at,
    updated_at
  ) VALUES (
    auth_user_record.id,
    auth_user_record.email,
    COALESCE(auth_user_record.full_name, auth_user_record.name),
    COALESCE(auth_user_record.avatar_url, auth_user_record.picture),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();

  RAISE NOTICE '✓ User profile restored for: % (ID: %)', auth_user_record.email, auth_user_record.id;
END $$;


-- 3A.3: Verify restoration
SELECT
  up.id,
  up.email,
  up.full_name,
  up.created_at,
  au.email as auth_email,
  au.created_at as auth_created_at
FROM public.user_profiles up
JOIN auth.users au ON au.id = up.id
WHERE up.email = 'lmdrew@udel.edu';

-- Expected: Should return 1 row showing profile is restored and linked


-- ============================================================================
-- STEP 3B: RECOVERY OPTIONS (IF AUTH USER DOESN'T EXIST)
-- ============================================================================
-- If Step 1.1 returned no rows, the auth user was completely deleted
-- ============================================================================

-- Option 1: Check Supabase automated backups
-- 1. Go to Supabase Dashboard
-- 2. Navigate to: Database → Backups
-- 3. Look for backups from before Nov 4, 2025
-- 4. Contact Supabase support for point-in-time recovery

-- Option 2: Re-create the account (LOSES HISTORICAL DATA)
-- The user would need to sign up again with lmdrew@udel.edu
-- This creates a new auth user with a new ID
-- Historical sessions will remain orphaned with old user_id

-- Option 3: Contact Supabase Support
-- They may be able to restore from automated backups
-- Support link: https://supabase.com/dashboard/support


-- ============================================================================
-- STEP 4: VERIFY ALL ACCOUNTS
-- ============================================================================

-- 4.1: List all auth users and their profiles
SELECT
  au.id,
  au.email as auth_email,
  au.created_at as auth_created,
  au.last_sign_in_at,
  up.email as profile_email,
  up.created_at as profile_created,
  CASE
    WHEN up.id IS NULL THEN '⚠️ MISSING PROFILE'
    ELSE '✓ Profile exists'
  END as status
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
ORDER BY au.created_at DESC;

-- Expected: Should show both accounts with profiles


-- 4.2: Count orphaned data
SELECT
  (SELECT COUNT(*) FROM public.sessions s
   WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = s.user_id)
  ) as orphaned_sessions,
  (SELECT COUNT(*) FROM public.session_shares ss
   WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = ss.shared_by_user_id)
  ) as orphaned_shares_by,
  (SELECT COUNT(*) FROM public.session_shares ss
   WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = ss.shared_with_user_id)
  ) as orphaned_shares_with;

-- Expected: Should show 0s after restoration, or counts of orphaned records


-- ============================================================================
-- RESULTS SUMMARY
-- ============================================================================
-- After running this script, you should know:
-- 1. Whether the auth user still exists
-- 2. Whether the profile is missing
-- 3. Whether there are orphaned sessions
-- 4. Whether the trigger is working
-- 5. Whether the profile was successfully restored
--
-- Next steps:
-- - Test login with lmdrew@udel.edu in the application
-- - Verify sessions are visible
-- - Test sharing functionality with the restored account
-- ============================================================================
