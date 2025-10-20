# Vosk Auto-Configuration Fix

## Overview
Fixed the issue where the Vosk model URL wasn't being automatically configured after download, causing "Vosk model URL not configured" errors when trying to start transcription.

## Problem
- Model downloaded successfully ✅
- But `startVoskTranscription()` didn't know the model URL ❌
- Error: "Vosk model URL not configured"

## Solution Implemented

### 1. VoskSetupDialog (`src/renderer/components/vosk-setup-dialog.ts`)
After successful download in the first-run setup dialog:
- Automatically saves model URL to settings: `transcription.vosk.modelUrl`
- Starts the Vosk server
- Uses proper API: `window.scribeCat.store.set()` and `window.scribeCat.transcription.vosk.startServer()`

```typescript
// Auto-configure model URL after successful download
try {
  const modelUrl = `http://localhost:8765/vosk-model-en-us-0.22`;
  
  // Save to settings
  await window.scribeCat.store.set('transcription.vosk.modelUrl', modelUrl);
  
  // Start the server
  await window.scribeCat.transcription.vosk.startServer();
  
  console.log('Vosk model URL configured:', modelUrl);
} catch (configError) {
  console.error('Failed to auto-configure model URL:', configError);
  // Don't fail the download, just log the error
}
```

### 2. VoskSettingsSection (`src/renderer/components/vosk-settings.ts`)
Same auto-configuration after download from settings page:
- Saves model URL to settings
- Starts the Vosk server
- Ensures configuration is ready for transcription

### 3. startVoskTranscription() (`src/renderer/app.ts`)
Enhanced to check settings and ensure server is running:

```typescript
async function startVoskTranscription(): Promise<void> {
  // Get model URL from settings (using correct key)
  const modelUrl = await window.scribeCat.store.get('transcription.vosk.modelUrl') as string;
  
  if (!modelUrl) {
    throw new Error('Vosk model URL not configured. Please download the model in Settings.');
  }
  
  // Make sure server is running
  const serverStatus = await window.scribeCat.transcription.vosk.isServerRunning();
  if (!serverStatus.isRunning) {
    console.log('Vosk server not running, starting it...');
    const startResult = await window.scribeCat.transcription.vosk.startServer();
    if (!startResult.success) {
      throw new Error(`Failed to start Vosk server: ${startResult.error || 'Unknown error'}`);
    }
    console.log('Vosk server started successfully');
  }
  
  // ... rest of transcription setup
}
```

## Key Changes

1. **Correct Settings Key**: Changed from `'vosk-model-url'` to `'transcription.vosk.modelUrl'` for consistency
2. **Auto-Configuration**: Model URL is now automatically saved after download
3. **Server Auto-Start**: Server is automatically started after download and checked before transcription
4. **Error Handling**: Graceful error handling that doesn't fail the download if configuration has issues

## Flow

### Download Flow:
1. User downloads model (via setup dialog or settings)
2. Download completes successfully
3. **Auto-configure**: Save model URL to settings
4. **Auto-start**: Start Vosk server
5. Ready for transcription!

### Transcription Flow:
1. User starts recording with Vosk mode
2. Check if model URL is configured in settings
3. Check if server is running
4. If not running, start it automatically
5. Initialize Vosk service with model URL
6. Start transcription

## Benefits

- **Seamless Experience**: Users don't need to manually configure anything
- **Automatic Recovery**: Server auto-starts if not running
- **Clear Error Messages**: Helpful messages guide users if something is missing
- **Consistent State**: Settings are always in sync with model installation

## Testing Checklist

- [ ] Download model via first-run setup dialog
- [ ] Verify model URL is saved to settings
- [ ] Verify server starts automatically
- [ ] Download model via settings page
- [ ] Verify same auto-configuration happens
- [ ] Try starting Vosk transcription
- [ ] Verify server auto-starts if not running
- [ ] Verify clear error if model not downloaded

## Related Files

- `src/renderer/components/vosk-setup-dialog.ts` - First-run setup dialog
- `src/renderer/components/vosk-settings.ts` - Settings page model management
- `src/renderer/app.ts` - Main app with transcription logic
- `src/shared/window.d.ts` - Window API type definitions

## Notes

- The Vosk browser integration is still TODO (vosk-browser package configuration)
- When that's ready, the commented-out code in `startVoskTranscription()` can be enabled
- The auto-configuration ensures everything is ready for when Vosk is fully integrated
