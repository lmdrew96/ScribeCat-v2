# Supabase Setup Guide for ScribeCat

This guide walks you through setting up Supabase for ScribeCat's cloud sync, sharing, and real-time collaboration features.

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or sign in
3. Click "New Project"
4. Fill in:
   - **Name**: ScribeCat (or your preferred name)
   - **Database Password**: Generate a strong password (save it securely)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is sufficient for initial development
5. Click "Create new project"
6. Wait for project to finish setting up (~2 minutes)

## Step 2: Get Your API Credentials

1. In your project dashboard, go to **Settings** (gear icon) → **API**
2. Copy and save these values (you'll need them later):
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")
   - **service_role** key (keep this secret!)

## Step 3: Run Database Migration

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Copy the entire contents of `/docs/supabase-schema.sql` from this project
4. Paste into the SQL editor
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. Verify success - you should see "Success. No rows returned"

## Step 4: Configure Storage

1. In your Supabase dashboard, go to **Storage** in the left sidebar
2. Click **Create a new bucket**
3. Fill in:
   - **Name**: `audio-files`
   - **Public bucket**: Unchecked (private)
   - **File size limit**: 100 MB (or higher if you have long recordings)
   - **Allowed MIME types**: `audio/webm, audio/wav, audio/mp3, audio/ogg`
4. Click **Create bucket**

### Set Storage Policies

1. Click on the `audio-files` bucket
2. Go to **Policies** tab
3. Click **New policy** → **For full customization**
4. Create policy for SELECT (download):
   - **Policy name**: Users can download their own audio files
   - **Allowed operation**: SELECT
   - **Target roles**: authenticated
   - **USING expression**:
   ```sql
   auth.uid()::text = (storage.foldername(name))[1]
   ```
5. Create policy for INSERT (upload):
   - **Policy name**: Users can upload to their own folder
   - **Allowed operation**: INSERT
   - **Target roles**: authenticated
   - **WITH CHECK expression**:
   ```sql
   auth.uid()::text = (storage.foldername(name))[1]
   ```
6. Create policy for DELETE:
   - **Policy name**: Users can delete their own files
   - **Allowed operation**: DELETE
   - **Target roles**: authenticated
   - **USING expression**:
   ```sql
   auth.uid()::text = (storage.foldername(name))[1]
   ```

## Step 5: Configure Google OAuth

You have two options for Google authentication:

### Option A: Let Supabase Handle Everything (Recommended - Simpler)

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Google** in the list and click to expand
3. Toggle **Enable Google Provider** to ON
4. You'll see Supabase's redirect URL: `https://xxxxx.supabase.co/auth/v1/callback`
5. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
6. Select your existing OAuth client (the one ScribeCat uses)
7. Under **Authorized redirect URIs**, add:
   ```
   https://xxxxx.supabase.co/auth/v1/callback
   ```
   (replace `xxxxx` with your actual Supabase project reference)
8. Click **Save**
9. Back in Supabase, enter your Google OAuth credentials:
   - **Client ID**: Your existing Google Client ID
   - **Client Secret**: Your existing Google Client Secret
10. Click **Save**

### Option B: Use Existing GoogleDriveService Flow (More Complex)

Keep your current OAuth flow but integrate with Supabase Auth:
- Continue using the manual code flow
- After getting Google tokens, create Supabase user with `signInWithIdToken()`
- This requires more custom code but gives you more control

**Recommendation**: Use Option A - it's simpler and provides a better UX.

## Step 6: Enable Realtime (for Phase 4)

1. In Supabase dashboard, go to **Database** → **Replication**
2. Find the `sessions` table
3. Toggle **Enable Realtime** to ON
4. Click **Save**

## Step 7: Supabase Credentials (Production Setup)

**For Developers:**

The Supabase credentials are bundled directly into the application code at `/src/config/supabase.config.ts`. All users share the same production backend, with data isolation provided by Row Level Security (RLS) policies.

**If you're building from source:**
- The credentials are already configured in the source code
- Users can sign in immediately without any additional configuration
- No environment variables or settings prompts needed

**Security Note:**
The `anon` key is safe to include in client code - it has limited permissions, and RLS policies ensure users can only access their own data.

## Step 8: Test Connection

To test that authentication is working:

1. Build and start ScribeCat: `npm run compile && npm start`
2. Click the "Sign In" button (👤 icon) in the header
3. Try signing in with Google OAuth or creating an account with email/password
4. After successful sign-in, your profile button should appear
5. Open DevTools (Help → Toggle Developer Tools) to check for errors
6. Verify user appears in Supabase dashboard under **Authentication** → **Users**

## Security Notes

- **Never commit** your `service_role` key to version control
- The `anon` key is safe to include in the app (it has limited permissions)
- Row Level Security (RLS) policies protect user data
- All data is encrypted at rest by Supabase
- Use HTTPS only (Supabase provides this by default)

## Troubleshooting

### "Invalid API key" error
- Double-check you copied the correct anon key
- Make sure there are no extra spaces or characters
- Verify the project URL is correct

### Google OAuth not working
- Verify redirect URI is EXACTLY as shown in Supabase
- Check that OAuth client is not restricted to certain domains
- Make sure you're using the correct Client ID and Secret

### "Row level security policy violated"
- Check that RLS policies are created correctly
- Verify user is authenticated before accessing data
- Review policy expressions in SQL Editor

### Database connection issues
- Check your internet connection
- Verify Supabase project is not paused (free tier auto-pauses after 1 week of inactivity)
- Check Supabase status page: https://status.supabase.com/

## Next Steps

After completing this setup:
1. The ScribeCat code will integrate with Supabase
2. Users can sign in with Google or email/password
3. Sessions will sync across devices
4. Real-time collaboration will be enabled

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Realtime Documentation](https://supabase.com/docs/guides/realtime)
