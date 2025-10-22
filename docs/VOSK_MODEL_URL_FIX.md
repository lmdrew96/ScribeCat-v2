# Vosk Model URL Fix

## Issue
The settings store had `transcription.vosk.modelUrl` saved as `http://localhost:8765/vosk-model-en-us-0.22` when it should just be `http://localhost:8765`.

The `VoskModelServer.getServerUrl()` correctly returns `http://localhost:8765`, but the model folder name was being appended and saved to settings, causing issues when trying to access model files.

## Root Cause
While the code in `vosk-settings.ts` and `vosk-setup-dialog.ts` was correctly setting `modelUrl` to `http://localhost:8765`, the app was storing this value in settings unnecessarily. The real issue was that `app.ts` was reading this stored value instead of getting the URL dynamically from the server.

## Solution

### 1. Updated `app.ts` to Get Server URL Dynamically
**File:** `src/renderer/app.ts`

Changed the `startVoskTranscription()` function to:
- Remove reading `modelUrl` from settings
- Get the server URL dynamically from `isServerRunning()` or `startServer()` responses
- Use the `url` property (not `serverUrl`) from the API responses
- Only store `modelPath` in settings, not `modelUrl`

The server URL is now obtained at runtime:
```typescript
let serverUrl: string;
if (!serverStatus.isRunning) {
  const startResult = await window.scribeCat.transcription.vosk.startServer(modelPath);
  serverUrl = startResult.url!; // http://localhost:8765
} else {
  serverUrl = serverStatus.url!; // http://localhost:8765
}
```

### 2. Removed `modelUrl` Saving from Settings Components
**Files:** 
- `src/renderer/components/vosk-settings.ts`
- `src/renderer/components/vosk-setup-dialog.ts`

Both files now:
- Only save `transcription.vosk.modelPath` to settings
- Do NOT save `transcription.vosk.modelUrl` 
- Updated comments to reflect that server URL is obtained dynamically

## What Changed

### Before:
```typescript
// Settings stored:
'transcription.vosk.modelUrl' = 'http://localhost:8765/vosk-model-en-us-0.22' ❌
'transcription.vosk.modelPath' = '/path/to/model'

// app.ts read from settings:
const modelUrl = await window.scribeCat.store.get('transcription.vosk.modelUrl');
```

### After:
```typescript
// Settings stored:
'transcription.vosk.modelPath' = '/path/to/model' ✅
// No modelUrl stored

// app.ts gets URL dynamically:
const serverStatus = await window.scribeCat.transcription.vosk.isServerRunning();
const serverUrl = serverStatus.url; // http://localhost:8765
```

## Benefits

1. **Correct URL**: Server URL is always correct (`http://localhost:8765`)
2. **No Stale Data**: URL is obtained fresh each time, not from potentially outdated settings
3. **Simpler**: One less setting to manage
4. **Flexible**: If server port changes in the future, no settings update needed

## Testing

Build completed successfully with no TypeScript errors:
```bash
npm run build
✓ TypeScript compilation successful
✓ Electron builder successful
```

## Files Modified

1. `src/renderer/app.ts` - Updated to get server URL dynamically
2. `src/renderer/components/vosk-settings.ts` - Removed modelUrl saving
3. `src/renderer/components/vosk-setup-dialog.ts` - Removed modelUrl saving

## Next Steps

Users with the incorrect `modelUrl` stored in their settings will automatically use the correct URL on next app launch, as the app no longer reads from that setting. The old setting key can be safely ignored or removed in a future cleanup.
