# Phase 3 Sharing System - Database Migration Instructions

## Quick Fix for Migration Errors

If you're getting errors like:
- `relation "idx_session_shares_session_id" already exists`
- `cannot drop function update_updated_at_column() because other objects depend on it`

Follow these steps:

### Step 1: Run Cleanup Script

1. Go to your **Supabase Dashboard** → **SQL Editor**
2. Create a **New Query**
3. Copy and paste the contents of: `supabase/migrations/003_cleanup.sql`
4. Click **Run**

This will safely remove any partially-applied migration components. The cleanup script uses CASCADE to handle function dependencies and will recreate necessary triggers in the main migration.

### Step 2: Run Main Migration

1. Still in **SQL Editor**, create another **New Query**
2. Copy and paste the contents of: `supabase/migrations/003_sharing_system.sql`
3. Click **Run**

The migration should now complete successfully!

---

## What This Migration Does

### Tables Created:
- **session_shares** - Tracks active shares between users
- **share_invitations** - Tracks pending email invitations
- **user_profiles** - Stores public user profile information

### Security Features:
- **Row Level Security (RLS)** - Users can only see their own data
- **Permission Levels** - Viewer (read-only) or Editor (can modify)
- **Auto-profile creation** - User profiles created automatically on signup

### Features Enabled:
- Share sessions with other users by email
- View sessions shared with you
- Manage share permissions (viewer/editor)
- Accept or decline share invitations

---

## Verification

After running both scripts, verify the migration succeeded:

```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('session_shares', 'share_invitations', 'user_profiles');

-- Should return 3 rows
```

---

## Troubleshooting

### Error: "permission denied for schema auth"
- Make sure you're running this in the Supabase Dashboard SQL Editor, not a client connection
- The SQL Editor has elevated permissions needed for cross-schema operations

### Error: "relation 'public.sessions' does not exist"
- You need to run the earlier migrations first (001 and 002)
- Check your migrations folder for the correct order

### Tables created but sharing doesn't work
- Make sure you restarted the Electron app after running the migration
- Check browser console for any errors
- Verify you're signed in with a valid Supabase account

---

## Need Help?

If you encounter any other issues, check:
1. Supabase Dashboard → **Database** → **Tables** (verify tables exist)
2. Supabase Dashboard → **Database** → **Policies** (verify RLS policies)
3. Browser Console (look for error messages)
