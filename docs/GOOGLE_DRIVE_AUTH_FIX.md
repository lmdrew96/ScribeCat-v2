# Google Drive Authentication Fix

## Issue
When connecting Google Drive, users would get an `invalid_grant` error immediately after authentication, even though they just connected. The export to Drive feature would fail with this error.

## Root Cause
The settings UI was treating the **authorization code** as if it were already a **refresh token** and storing it directly. This is incorrect because Google's OAuth 2.0 flow requires:

1. User authorizes the app → receives authorization code
2. **Exchange** authorization code for access token + refresh token (via API call)
3. Store the refresh token for future use

The bug was in `settings.ts` line 424:
```typescript
// ❌ WRONG: Treating auth code as refresh token
await window.scribeCat.drive.setCredentials({ refreshToken: code });
```

This skipped step 2, so when trying to upload files, Google rejected the invalid "refresh token" (which was actually just the auth code) with `invalid_grant`.

## The Fix

### 1. Added `exchangeCodeForTokens` IPC Handler (`src/main/main.ts`)
Created a new IPC handler that properly calls `GoogleDriveService.exchangeCodeForTokens()`:

```typescript
ipcMain.handle('drive:exchangeCodeForTokens', async (event, code: string) => {
  if (!this.googleDriveService) {
    return { success: false, error: 'Google Drive not configured' };
  }
  
  const result = await this.googleDriveService.exchangeCodeForTokens(code);
  
  if (result.success && this.googleDriveService) {
    // Store the refresh token for persistence
    const config = { refreshToken: (this.googleDriveService as any).config.refreshToken };
    (this.store as any).set('google-drive-credentials', JSON.stringify(config));
  }
  
  return result;
});
```

### 2. Exposed Method in Preload (`src/preload/preload.ts`)
Added the new method to the electron API:

```typescript
drive: {
  // ... other methods
  exchangeCodeForTokens: (code: string) => ipcRenderer.invoke('drive:exchangeCodeForTokens', code),
  // ... other methods
}
```

### 3. Updated Type Definitions (`src/shared/window.d.ts`)
Added proper typing for the new method:

```typescript
exchangeCodeForTokens: (code: string) => Promise<{ success: boolean; email?: string; error?: string }>;
```

### 4. Fixed Settings UI (`src/renderer/settings.ts`)
Updated `connectGoogleDrive()` to properly exchange the code:

```typescript
// ✅ CORRECT: Exchange auth code for tokens first
const exchangeResult = await window.scribeCat.drive.exchangeCodeForTokens(code);
if (!exchangeResult.success) {
  throw new Error(exchangeResult.error || 'Failed to authenticate');
}

// Store user email if available
if (exchangeResult.email) {
  this.driveUserEmail = exchangeResult.email;
}
```

## How It Works Now

1. User clicks "Connect to Google Drive" in Settings
2. Browser opens with Google OAuth consent screen
3. User authorizes and receives authorization code
4. User pastes code into ScribeCat
5. **NEW:** `exchangeCodeForTokens()` calls Google's API to exchange code for tokens
6. Google returns access token + refresh token
7. Refresh token is stored in electron-store
8. User can now upload files to Drive successfully

## OAuth 2.0 Flow Diagram

```
User → Google OAuth → Authorization Code
                            ↓
                    exchangeCodeForTokens()
                            ↓
                    Google Token API
                            ↓
                Access Token + Refresh Token
                            ↓
                    Store Refresh Token
                            ↓
                Future API calls use refresh token
```

## Testing

To verify the fix:

1. Disconnect Google Drive if already connected
2. Click "Connect to Google Drive" in Settings
3. Complete OAuth flow and paste authorization code
4. Should see "Google Drive connected successfully!"
5. Export a session with "Upload to Google Drive" checked
6. File should upload successfully without `invalid_grant` error
7. Check Google Drive - file should be there

## Related Files

- `src/main/main.ts` - Added IPC handler
- `src/preload/preload.ts` - Exposed method to renderer
- `src/shared/window.d.ts` - Type definitions
- `src/renderer/settings.ts` - Fixed authentication flow
- `src/infrastructure/services/drive/GoogleDriveService.ts` - Already had `exchangeCodeForTokens()` method (unchanged)

## Notes

- The `GoogleDriveService.exchangeCodeForTokens()` method was already implemented correctly
- The bug was only in the UI layer not calling it
- This fix maintains backward compatibility
- Existing connected users won't be affected (their refresh tokens are valid)
- New connections will now work properly
