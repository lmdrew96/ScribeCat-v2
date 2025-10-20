# Vosk Model Path Fix

## Issue
The model path was being saved as an object instead of a string, causing the Vosk transcription to fail when trying to start the server.

## Root Cause
The IPC handler `vosk:model:getPath` returns an object:
```typescript
{ success: boolean; modelPath: string; modelsDir: string; error?: string }
```

However, the renderer code was trying to access `paths.path` which doesn't exist, and was saving the entire object to settings instead of just the string path.

## Changes Made

### 1. Fixed Type Definition (`src/shared/window.d.ts`)
Updated the return type for `getPath()` to match what the IPC handler actually returns:

```typescript
getPath: () => Promise<{ success: boolean; modelPath: string; modelsDir: string; error?: string }>;
```

### 2. Fixed VoskSetupDialog (`src/renderer/components/vosk-setup-dialog.ts`)
After download completes, properly extract and validate the model path:

```typescript
const paths = await window.scribeCat.transcription.vosk.model.getPath();
console.log('Model paths received:', paths);

// Extract the actual model path string
const modelPath = paths.modelPath;

if (!modelPath || typeof modelPath !== 'string') {
  throw new Error('Invalid model path received from server');
}

// Save the STRING path
await window.scribeCat.store.set('transcription.vosk.modelPath', modelPath);

// Start server with STRING path
await window.scribeCat.transcription.vosk.startServer(modelPath);
```

### 3. Fixed VoskSettingsSection (`src/renderer/components/vosk-settings.ts`)
Applied the same fix to the settings page download handler:

```typescript
const paths = await window.scribeCat.transcription.vosk.model.getPath();
console.log('Model paths received:', paths);

// Extract the actual model path string
const modelPath = paths.modelPath;

if (!modelPath || typeof modelPath !== 'string') {
  throw new Error('Invalid model path received from server');
}

// Save both URL and path to settings
await window.scribeCat.store.set('transcription.vosk.modelUrl', modelUrl);
await window.scribeCat.store.set('transcription.vosk.modelPath', modelPath);

// Start the server with the model path
await window.scribeCat.transcription.vosk.startServer(modelPath);
```

### 4. Added Validation in app.ts (`src/renderer/app.ts`)
Added validation when retrieving the model path from settings:

```typescript
const modelPath = await window.scribeCat.store.get('transcription.vosk.modelPath') as string;

console.log('Retrieved model path from settings:', modelPath, typeof modelPath);

if (!modelPath || typeof modelPath !== 'string') {
  throw new Error('Invalid model path in settings. Please re-download the model in Settings.');
}

if (!modelUrl || typeof modelUrl !== 'string') {
  throw new Error('Vosk model not configured. Please download the model in Settings.');
}
```

## Testing
- ✅ TypeScript compilation passes with no errors
- ✅ Build completes successfully
- ✅ Type safety enforced with proper type definitions
- ✅ Validation added to catch invalid paths early

## Impact
- Users who previously downloaded the model will need to re-download it to fix the corrupted path in settings
- New downloads will correctly save the path as a string
- The validation will provide clear error messages if the path is invalid

## Files Modified
1. `src/shared/window.d.ts` - Updated type definition
2. `src/renderer/components/vosk-setup-dialog.ts` - Fixed path extraction and validation
3. `src/renderer/components/vosk-settings.ts` - Fixed path extraction and validation
4. `src/renderer/app.ts` - Added validation when reading from settings
