# Vosk-Browser Model Format Issue

## Date
October 22, 2025

## Problem Summary
The vosk-browser package expects models to be served as `.tar.gz` archives, but our current implementation downloads models as `.zip` files and extracts them to a directory. This causes a "Unrecognized archive format" error when trying to initialize vosk-browser.

## Root Cause
**Architectural Mismatch:**
- `vosk-browser` is designed to download and cache models itself
- It expects a URL pointing to a `.tar.gz` archive
- Our implementation pre-downloads models as `.zip` files and extracts them
- We then try to serve the extracted directory via a local HTTP server
- vosk-browser tries to download the directory as a tar.gz and fails

## Error Messages
```
extracting /vosk/http___localhost_8765/downloaded.tar.gz to /vosk/http___localhost_8765 (strip_first_component: true)
Unrecognized archive format
```

## What Works
✅ esbuild bundler successfully bundles vosk-browser npm package  
✅ Content Security Policy configured to allow Web Workers and WebAssembly  
✅ Model server serves files with proper CORS headers  
✅ Model server can serve directory listings  
✅ Simulation transcription mode works perfectly  

## What Doesn't Work
❌ vosk-browser cannot load pre-extracted model directories  
❌ vosk-browser expects tar.gz archives, not directories  

## Attempted Solutions

### 1. CSP Fixes (Completed)
- Added `'unsafe-eval'` for Worker creation
- Added `'wasm-unsafe-eval'` for WebAssembly
- Added `data:` and `blob:` to `connect-src`
- Added `blob:` and `data:` to `worker-src`

### 2. Server Modifications (Completed)
- Added directory listing support
- Added CORS headers
- Verified all model files are accessible

### 3. Model Format (Not Completed)
- Attempted to serve extracted directory
- vosk-browser rejects non-archive formats

## Possible Solutions

### Option 1: Keep Original Archive (Recommended)
**Modify VoskModelManager to:**
1. Download the `.zip` file
2. Convert it to `.tar.gz` format (or download tar.gz version if available)
3. Keep both the archive and extracted version
4. Serve the `.tar.gz` to vosk-browser
5. Use extracted version for other purposes

**Pros:**
- Works with vosk-browser's expected workflow
- Minimal changes to vosk-browser integration

**Cons:**
- Requires tar/gzip libraries in Node.js
- Doubles storage space (archive + extracted)

### Option 2: Use Different Vosk Integration
**Switch to vosk-server or native Vosk:**
- Use Vosk's native Node.js bindings (if available)
- Run vosk-server as a separate process
- Use a different browser-based ASR library

**Pros:**
- More control over model loading
- Better performance potential

**Cons:**
- Significant refactoring required
- May have platform-specific issues

### Option 3: Modify vosk-browser
**Fork and modify vosk-browser to:**
- Accept pre-extracted model directories
- Skip download/extract step
- Load model files directly

**Pros:**
- Full control over behavior

**Cons:**
- Maintenance burden
- Need to keep fork updated

## Recommended Next Steps

1. **Short-term:** Use Simulation mode for testing/development
2. **Medium-term:** Implement Option 1 (keep original archive)
3. **Long-term:** Evaluate Option 2 if performance/features require it

## Implementation Notes for Option 1

### Required Changes:
1. **VoskModelManager.ts:**
   ```typescript
   // After downloading zip, create tar.gz
   private async createTarGz(sourceDir: string, outputPath: string): Promise<void> {
     // Use tar and zlib to create archive
   }
   ```

2. **VoskModelServer.ts:**
   ```typescript
   // Serve the tar.gz file when root is requested
   if (filePath === '' || filePath === '/') {
     const tarGzPath = path.join(this.modelPath, '../model.tar.gz');
     // Serve the tar.gz file
   }
   ```

3. **Dependencies:**
   ```bash
   npm install tar
   ```

## Related Files
- `src/main/services/VoskModelManager.ts` - Model download/extraction
- `src/main/services/VoskModelServer.ts` - Local HTTP server
- `src/renderer/vosk-transcription-service.ts` - vosk-browser integration
- `src/renderer/index.html` - CSP configuration

## References
- [vosk-browser npm package](https://www.npmjs.com/package/vosk-browser)
- [vosk-browser GitHub](https://github.com/ccoreilly/vosk-browser)
- [Vosk API Documentation](https://alphacephei.com/vosk/)

## Status
**BLOCKED** - Requires implementation of one of the solutions above before vosk-browser transcription will work.

**Current Workaround:** Use Simulation transcription mode for development and testing.
