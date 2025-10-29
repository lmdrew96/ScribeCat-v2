# Google Drive Integration Setup Guide

This guide explains how to set up Google Drive integration in ScribeCat v2 so users can upload exported sessions directly to their Google Drive.

## Overview

ScribeCat uses pre-configured OAuth 2.0 credentials to provide a seamless "Sign in with Google" experience. Users don't need to create their own Google Cloud project or manage OAuth credentials.

## For Developers: Setting Up OAuth Credentials

As the developer, you need to create OAuth credentials once and embed them in the application.

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: `ScribeCat` (or your preferred name)
4. Click "Create"

### Step 2: Enable Google Drive API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on it and press "Enable"

### Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type (unless you have a Google Workspace)
3. Click "Create"

**Fill in the required fields:**
- App name: `ScribeCat`
- User support email: Your email
- Developer contact email: Your email

**Scopes:**
- Click "Add or Remove Scopes"
- Add: `https://www.googleapis.com/auth/drive.file`
  - This scope only allows ScribeCat to access files it creates
  - Users' existing Drive files remain private

4. Click "Save and Continue"
5. Add test users (optional during development)
6. Click "Save and Continue"

### Step 4: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Desktop app**
4. Name: `ScribeCat Desktop`
5. Click "Create"

**Important:** Copy the Client ID and Client Secret that appear.

### Step 5: Add Credentials to ScribeCat

Open `src/infrastructure/services/drive/GoogleDriveService.ts` and replace the placeholder values:

```typescript
// Replace these lines:
private readonly CLIENT_ID = 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';
private readonly CLIENT_SECRET = 'YOUR_CLIENT_SECRET_HERE';

// With your actual credentials:
private readonly CLIENT_ID = '123456789-abcdefghijklmnop.apps.googleusercontent.com';
private readonly CLIENT_SECRET = 'GOCSPX-your_actual_client_secret_here';
```

### Step 6: Publish Your App (Optional but Recommended)

For production use, you should verify your app:

1. Go to "OAuth consent screen"
2. Click "Publish App"
3. Submit for verification (required if you want to remove the "unverified app" warning)

**Verification Requirements:**
- Privacy policy URL
- Terms of service URL
- App homepage
- Authorized domains

## For Users: Connecting Google Drive

Users have a simple experience:

1. Open ScribeCat Settings
2. Go to "Google Drive Integration" section
3. Click "Connect Google Drive"
4. Sign in with their Google account in the browser
5. Authorize ScribeCat to access Drive
6. Copy the authorization code
7. Paste it back into ScribeCat

That's it! No technical knowledge required.

## Security Considerations

### OAuth Credentials in Code

**Q: Is it safe to embed OAuth credentials in the app?**

**A:** Yes, this is standard practice for desktop applications:

- Desktop apps are "public clients" in OAuth terminology
- The Client Secret provides minimal security for desktop apps
- Google's security model accounts for this
- Users must explicitly authorize the app
- Users can revoke access anytime from their Google Account settings

### Scope Limitations

ScribeCat only requests the `drive.file` scope, which means:

✅ Can create new files in Drive
✅ Can access files it created
❌ Cannot access user's existing files
❌ Cannot see user's file list
❌ Cannot modify files created by other apps

### User Control

Users maintain full control:
- Can disconnect at any time from ScribeCat settings
- Can revoke access from [Google Account Settings](https://myaccount.google.com/permissions)
- Refresh tokens are stored securely in electron-store
- No passwords are ever stored

## Troubleshooting

### "Access blocked: This app's request is invalid"

**Cause:** OAuth consent screen not configured properly

**Solution:**
1. Ensure you've completed the OAuth consent screen setup
2. Add your email as a test user during development
3. Verify the redirect URI is set to `urn:ietf:wg:oauth:2.0:oob`

### "This app isn't verified"

**Cause:** App hasn't been verified by Google

**Solution:**
- During development: Click "Advanced" → "Go to ScribeCat (unsafe)"
- For production: Submit app for verification

### "Invalid grant" error

**Cause:** Refresh token expired or revoked

**Solution:**
- User needs to disconnect and reconnect
- Check that credentials are stored correctly

### "API key not valid"

**Cause:** Google Drive API not enabled

**Solution:**
1. Go to Google Cloud Console
2. Enable Google Drive API for your project

## Testing

### Test the Integration

1. Build and run ScribeCat
2. Open Settings → Google Drive Integration
3. Click "Connect Google Drive"
4. Complete the OAuth flow
5. Export a session with "Upload to Drive" enabled
6. Verify file appears in your Google Drive

### Test Disconnection

1. Click "Disconnect" in settings
2. Verify status shows "Not connected"
3. Try exporting - Drive upload should be disabled
4. Reconnect and verify it works again

## API Quotas

Google Drive API has usage quotas:

- **Queries per day:** 1,000,000,000
- **Queries per 100 seconds per user:** 1,000

For typical ScribeCat usage (a few uploads per day), you'll never hit these limits.

## Additional Resources

- [Google Drive API Documentation](https://developers.google.com/drive/api/v3/about-sdk)
- [OAuth 2.0 for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Google Cloud Console](https://console.cloud.google.com/)

## Support

If users encounter issues:
1. Check their Google Account permissions
2. Verify they're using the latest version of ScribeCat
3. Try disconnecting and reconnecting
4. Check the console logs for detailed error messages
