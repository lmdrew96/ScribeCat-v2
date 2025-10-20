# Vosk Native Package Installation Issue

## Problem

Attempted to install the `vosk` npm package but encountered compilation errors with its native dependencies (`ffi-napi`). The errors are related to Node.js API compatibility issues with Node.js v22.19.0.

## Error Details

```
npm error gyp ERR! build error
npm error gyp ERR! stack Error: `make` failed with exit code: 2
```

The `ffi-napi` package (a dependency of `vosk`) is failing to compile due to incompatible function pointer types and API changes in newer Node.js versions.

## Root Cause

The `vosk` npm package depends on `ffi-napi` which has not been updated to support the latest Node.js APIs. This is a common issue with native Node.js modules that use N-API.

## Alternative Solutions

### Option 1: Use Vosk via Python Bridge (Recommended)
Instead of using the Node.js vosk package, we can:
1. Install Vosk Python package (`pip install vosk`)
2. Create a Python script that handles transcription
3. Call the Python script from Node.js using `child_process`
4. Communicate via stdin/stdout or files

**Pros:**
- Vosk Python package is well-maintained
- No native compilation issues
- Works offline
- Full Vosk functionality

**Cons:**
- Requires Python installation
- Slightly more complex architecture
- Small performance overhead for IPC

### Option 2: Use vosk-browser with Local HTTP Server
Keep using `vosk-browser` but run a simple local HTTP server automatically:
1. Bundle model files with the app
2. Start a local HTTP server on app launch (e.g., port 8765)
3. Use vosk-browser to load models from localhost

**Pros:**
- No native compilation
- Works in renderer process
- Simpler than Python bridge

**Cons:**
- Still requires HTTP server
- User experience not ideal
- Security considerations for local server

### Option 3: Wait for vosk Package Update
Monitor the `vosk` npm package for updates that support newer Node.js versions.

**Pros:**
- Clean Node.js solution
- No workarounds needed

**Cons:**
- Unknown timeline
- May never be updated

### Option 4: Use Alternative Transcription Library
Consider using a different offline transcription solution:
- `whisper.cpp` with Node.js bindings
- `sherpa-onnx` (supports multiple models including Vosk)
- `faster-whisper` via Python bridge

## Recommended Approach

**Implement Option 1: Vosk via Python Bridge**

This provides the best balance of:
- Reliability (Python package is stable)
- Offline capability
- No compilation issues
- Good performance

Implementation steps:
1. Create Python script for Vosk transcription
2. Add Python dependency check on app startup
3. Implement Node.js wrapper to call Python script
4. Stream audio data to Python process
5. Receive transcription results via stdout

## Next Steps

1. Document Python bridge architecture
2. Create Python transcription script
3. Implement Node.js wrapper service
4. Update IPC handlers
5. Test end-to-end flow
