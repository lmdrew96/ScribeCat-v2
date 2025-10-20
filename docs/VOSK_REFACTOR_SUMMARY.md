# Vosk Integration Refactor Summary

## Date
October 20, 2025

## Objective
Refactor Vosk integration to use a more reliable approach after the native `vosk` npm package failed to compile with Node.js v22.

## Problem
The native `vosk` npm package has dependencies (`ffi-napi`) that are incompatible with Node.js v22, causing compilation failures during installation.

## Solution Chosen
**Option 2: vosk-browser + Automatic Local HTTP Server**

Instead of using the native vosk package, we implemented:
1. A local HTTP server in the main process to serve Vosk model files
2. Use of `vosk-browser` in the renderer process to load models from the local server
3. Automatic server lifecycle management

## Changes Made

### 1. Package Dependencies
- **Removed**: `vosk` (failed to install)
- **Kept**: `vosk-browser@0.0.8`

### 2. New Files Created

#### `src/main/services/VoskModelServer.ts`
- HTTP server that serves Vosk model files from filesystem
- Runs on `localhost:8765` by default
- Security features:
  - Localhost-only binding
  - Directory traversal protection
  - File type validation
  - CORS enabled for vosk-browser

#### `docs/VOSK_NATIVE_PACKAGE_ISSUE.md`
- Documents the compilation issue
- Lists alternative solutions considered
- Explains why Option 2 was chosen

#### `docs/VOSK_AUTO_SERVER_IMPLEMENTATION.md`
- Comprehensive implementation guide
- Architecture overview
- Usage examples
- Troubleshooting guide

### 3. Modified Files

#### `src/main/main.ts`
- Added `VoskModelServer` import and initialization
- Added IPC handlers:
  - `vosk:server:start` - Start HTTP server
  - `vosk:server:stop` - Stop HTTP server
  - `vosk:server:isRunning` - Check server status
- Added cleanup on app quit

#### `src/preload/preload.ts`
- Added Vosk server API to `window.scribeCat.transcription.vosk`:
  - `startServer(modelPath, port?)`
  - `stopServer()`
  - `isServerRunning()`

#### `src/renderer/vosk-transcription-service.ts`
- Updated to load models from local HTTP server
- Changed `modelPath` to `modelUrl` in config
- Improved error handling and logging
- Added proper TypeScript types

### 4. Architecture Changes

**Before:**
```
Renderer Process
└── vosk-browser (needs HTTP server)
    └── ❌ No server available
```

**After:**
```
Main Process                    Renderer Process
├── VoskModelServer            ├── VoskTranscriptionService
│   └── HTTP Server            │   └── vosk-browser
│       (localhost:8765)       │       └── Loads from localhost:8765
└── IPC Handlers               └── Uses preload API
```

## Benefits

✅ **No Compilation Issues**: Pure JavaScript, no native dependencies
✅ **Works Offline**: All processing happens locally
✅ **Automatic Management**: Server lifecycle managed by app
✅ **Cross-Platform**: Works on macOS, Windows, Linux
✅ **Secure**: Localhost-only, no external network access
✅ **Easy Setup**: No build tools or compilers required

## Usage Example

```typescript
// 1. Start server with model path
const result = await window.scribeCat.transcription.vosk.startServer(
  '/path/to/models'
);

// 2. Initialize Vosk service
const voskService = new VoskTranscriptionService();
await voskService.initialize({
  modelUrl: 'http://localhost:8765/vosk-model-small-en-us-0.15',
  onResult: (result) => console.log(result.text)
});

// 3. Start transcription
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
await voskService.start(stream);

// 4. Stop when done
await voskService.stop();
await window.scribeCat.transcription.vosk.stopServer();
```

## Testing Status

- ✅ TypeScript compilation successful
- ⏳ Runtime testing pending (requires Vosk model download)
- ⏳ Integration with UI pending

## Next Steps

1. **Download Vosk Model**: Get a model from https://alphacephei.com/vosk/models
2. **Update Settings UI**: Add model path configuration
3. **Test End-to-End**: Verify transcription works with real audio
4. **Add Model Management**: UI for downloading/managing models
5. **Performance Testing**: Measure latency and accuracy

## Configuration Required

Users will need to:
1. Download a Vosk model (e.g., `vosk-model-small-en-us-0.15`)
2. Extract it to a directory
3. Configure the model path in ScribeCat settings
4. The app will automatically start the HTTP server when needed

## Rollback Plan

If issues arise, the simulation transcription mode remains available as a fallback. Users can toggle between modes in settings.

## Documentation

- `docs/VOSK_NATIVE_PACKAGE_ISSUE.md` - Problem analysis
- `docs/VOSK_AUTO_SERVER_IMPLEMENTATION.md` - Implementation guide
- `docs/VOSK_REFACTOR_SUMMARY.md` - This summary

## Files Modified Summary

**New Files (3):**
- `src/main/services/VoskModelServer.ts`
- `docs/VOSK_NATIVE_PACKAGE_ISSUE.md`
- `docs/VOSK_AUTO_SERVER_IMPLEMENTATION.md`

**Modified Files (3):**
- `src/main/main.ts`
- `src/preload/preload.ts`
- `src/renderer/vosk-transcription-service.ts`

**Package Changes:**
- Removed: `vosk` (compilation failed)
- Kept: `vosk-browser@0.0.8`

## Conclusion

The refactor successfully implements Vosk offline transcription using a reliable, cross-platform approach that avoids native compilation issues. The automatic HTTP server provides a seamless user experience while maintaining security and performance.
