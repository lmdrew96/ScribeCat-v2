# User Profile Restoration Guide

## Problem: Missing User Profile for lmdrew@udel.edu

Your main account (lmdrew@udel.edu) is missing from the `user_profiles` table, likely due to the cleanup migration script (`003_cleanup.sql`) being run after the account was created.

## Quick Summary

**What happened:**
1. You created account lmdrew@udel.edu (existed in both `auth.users` and `public.user_profiles`)
2. The cleanup migration script (`003_cleanup.sql`) was run to reset the database
3. This script dropped the entire `user_profiles` table, deleting all profiles
4. The sharing system migration (`003_sharing_system.sql`) was run, recreating the table structure
5. Your test account (lmdrew96@gmail.com) was created **after** the cleanup, so its profile exists
6. Your main account was created **before** the cleanup, so its profile is missing

**Result:** The auth user still exists in `auth.users`, but the profile record in `public.user_profiles` was deleted.

---

## Step-by-Step Restoration Process

### Step 1: Access Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Navigate to: **SQL Editor** (left sidebar)
3. Create a new query

### Step 2: Run Diagnostic Queries

Copy and paste the contents of `restore_user_profile.sql` section by section:

#### 2.1: Verify Auth User Exists

```sql
SELECT
  id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at,
  raw_user_meta_data
FROM auth.users
WHERE email = 'lmdrew@udel.edu';
```

**Expected Result:** 1 row with your account details

**If NO ROWS returned:**
- The auth user was completely deleted
- You'll need to restore from Supabase backup (see "Complete Account Deletion" section below)
- Or re-create the account (loses historical data)

**If 1 ROW returned:**
- ✅ Good! The auth user still exists
- Note down the `id` value
- Proceed to next step

#### 2.2: Confirm Profile is Missing

```sql
SELECT * FROM public.user_profiles
WHERE email = 'lmdrew@udel.edu';
```

**Expected Result:** 0 rows (confirming profile is missing)

**If 1 ROW returned:**
- The profile already exists
- The issue may be something else (check application logs)
- No restoration needed

**If 0 ROWS returned:**
- ✅ Confirmed: Profile is missing
- Proceed to restoration

#### 2.3: Check for Orphaned Sessions

```sql
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
```

This shows any sessions that belong to users without profiles. These will be "reconnected" once we restore the profile.

### Step 3: Verify Database Trigger

Run this to confirm the auto-creation trigger is installed:

```sql
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
```

**Expected Result:** 1 row showing the trigger exists

**If NO ROWS:**
- The trigger is missing
- It should have been created by `003_sharing_system.sql`
- You may need to re-run that migration

### Step 4: Restore the User Profile

⚠️ **IMPORTANT:** Only run this after confirming the auth user exists (Step 2.1 returned a row)

Copy and paste this entire block into SQL Editor and run it:

```sql
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
```

**Expected Result:**
```
NOTICE: ✓ User profile restored for: lmdrew@udel.edu (ID: [uuid])
```

### Step 5: Verify Restoration

```sql
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
```

**Expected Result:** 1 row showing the profile is now linked to the auth user

### Step 6: Test in Application

1. Close and restart your ScribeCat application
2. Log in with lmdrew@udel.edu
3. Verify your sessions are visible
4. Test sharing a session with lmdrew96@gmail.com
5. Confirm the sharing works (this was the original bug we fixed)

---

## Complete Account Deletion (If Auth User Missing)

If Step 2.1 returned no rows, the auth user was completely deleted from `auth.users`. Recovery options:

### Option 1: Restore from Supabase Backup (Recommended)

1. Go to Supabase Dashboard
2. Navigate to: **Database → Backups**
3. Find a backup from before November 4, 2025 (before the cleanup)
4. Click **Restore** and follow the prompts
5. **Warning:** This will restore the ENTIRE database to that point, potentially losing other recent data

### Option 2: Point-in-Time Recovery via Supabase Support

1. Contact Supabase Support: https://supabase.com/dashboard/support
2. Request point-in-time recovery for the `auth.users` table
3. Specify: "Restore user with email lmdrew@udel.edu from before Nov 4, 2025"
4. This may preserve other recent data while restoring the missing user

### Option 3: Re-create the Account (Loses Historical Data)

1. Sign up again with lmdrew@udel.edu in the ScribeCat app
2. The trigger will automatically create a new profile
3. **Downside:** New user_id means:
   - Old sessions remain orphaned (can't be accessed)
   - Old shares are broken
   - It's essentially a new account

---

## Verify All Accounts

After restoration, verify both accounts exist:

```sql
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
```

**Expected Result:** Both lmdrew@udel.edu and lmdrew96@gmail.com with "✓ Profile exists"

---

## Prevention for the Future

The cleanup script has now been updated with:
- ⚠️ Prominent warnings about data deletion
- Clear documentation about when to use it
- Instructions for backup and recovery
- References to this restoration guide

**Key Rules:**
1. **NEVER** run `003_cleanup.sql` on a database with real users
2. **ALWAYS** create a backup before running migration scripts
3. **ONLY** use cleanup scripts during initial development setup
4. If you need to reset, restore from backup rather than using cleanup

---

## Technical Details

### How User Profiles Should Work

1. User signs up via app (email/password or Google OAuth)
2. Supabase creates entry in `auth.users` table
3. Database trigger `handle_new_user()` automatically fires
4. Trigger creates matching row in `public.user_profiles`
5. Application reads from `public.user_profiles` for all user info

### Why the Profile Disappeared

The `user_profiles` table has this constraint:
```sql
id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
```

This means:
- If `auth.users` row is deleted → profile automatically deleted
- If `user_profiles` table is dropped → all profiles deleted (this is what happened)
- The cleanup script dropped the table, deleting all profiles

### Related Files

- **Migration:** `/supabase/migrations/003_sharing_system.sql` (creates trigger)
- **Cleanup:** `/supabase/migrations/003_cleanup.sql` (now has warnings)
- **Restoration:** `/supabase/diagnostics/restore_user_profile.sql` (this script)
- **Sharing Fix:** `/src/main/ipc/handlers/SharingHandlers.ts` (fixed to use correct column names)

---

## Need Help?

If you encounter issues:

1. Check the application logs: Look for errors in the console
2. Verify Supabase connection: Check if other database operations work
3. Review RLS policies: Ensure they're not blocking access
4. Contact Supabase support: For backup/recovery assistance

---

## Summary Checklist

- [ ] Run Step 2.1: Verify auth user exists
- [ ] Run Step 2.2: Confirm profile is missing
- [ ] Run Step 3: Verify trigger is installed
- [ ] Run Step 4: Restore user profile
- [ ] Run Step 5: Verify restoration
- [ ] Test in application: Log in and verify sessions
- [ ] Test sharing: Share a session between accounts
- [ ] Verify both accounts: Check lmdrew@udel.edu and lmdrew96@gmail.com

Once all steps are complete, both accounts should be fully functional!
