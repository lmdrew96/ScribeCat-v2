# AssemblyAI Renderer Process Migration

## Issue
AssemblyAI real-time streaming was failing with 403 errors because it was being used from Node.js (main process) instead of the browser context (renderer process). AssemblyAI's streaming API is designed for browser WebSocket connections only.

## Solution
Moved AssemblyAI transcription service from the main process to the renderer process to use the browser's native WebSocket API.

## Changes Made

### 1. Created Browser-Based Service
**File:** `src/renderer/assemblyai-transcription-service.ts`
- New service that runs directly in the renderer process
- Uses browser's native `WebSocket` API (not Node.js `ws` package)
- Uses browser's native `fetch` API for token requests
- Handles token acquisition, WebSocket connection, and audio streaming
- Converts audio to base64 for transmission (AssemblyAI requirement)

### 2. Updated Renderer App
**File:** `src/renderer/app.ts`
- Imported new `AssemblyAITranscriptionService`
- Added `assemblyAIService` state variable
- Modified `startAssemblyAITranscription()` to:
  - Create service instance in renderer
  - Initialize with API key
  - Set up result callback
  - Start session
- Modified `startAssemblyAIAudioStreaming()` to:
  - Send audio directly to service (no IPC)
  - Removed async from interval callback
- Modified `stopAssemblyAIAudioStreaming()` to:
  - Call service.stop() directly
  - Clean up service instance
- Removed IPC calls to main process
- Removed AssemblyAI result listener setup

### 3. Removed Main Process Code
**File:** `src/main/main.ts`
- Removed `AssemblyAITranscriptionService` import
- Removed `activeAssemblyAIServices` property
- Removed AssemblyAI service initialization
- Removed three IPC handlers:
  - `transcription:assemblyai:start`
  - `transcription:assemblyai:processAudio`
  - `transcription:assemblyai:stop`

**Deleted:** `src/main/services/transcription/AssemblyAITranscriptionService.ts`

### 4. Updated Preload Bridge
**File:** `src/preload/preload.ts`
- Removed `assemblyai` object from transcription API
- Kept only `simulation` transcription mode

### 5. Updated Content Security Policy
**File:** `src/renderer/index.html`
- Added `https://api.assemblyai.com` to `connect-src` directive
- Already had `wss://api.assemblyai.com` for WebSocket connections

## Architecture Benefits

### Before (Main Process)
```
Renderer → IPC → Main Process → Node.js WebSocket → AssemblyAI
                                      ↓
                                   403 Error
```

### After (Renderer Process)
```
Renderer → Browser WebSocket → AssemblyAI
                ↓
           ✅ Success
```

## Key Improvements

1. **No IPC Overhead**: Audio streams directly from renderer to AssemblyAI
2. **Faster Latency**: Eliminates IPC round-trip time
3. **Simpler Code**: No need for main process service management
4. **Browser-Native**: Uses APIs AssemblyAI expects (browser WebSocket, fetch)
5. **Fixes 403 Error**: AssemblyAI's API now receives connections from expected context

## Testing

To test the fix:
1. Compile: `npm run compile`
2. Run: `npm run dev`
3. Open Settings
4. Select AssemblyAI mode
5. Enter API key
6. Save settings
7. Start recording
8. Verify transcription works without 403 errors

## Technical Details

### Universal Streaming API (v3)
AssemblyAI has migrated to a new Universal Streaming API that:
- No longer requires temporary token acquisition
- Uses direct API key authentication in WebSocket URL
- Expects raw PCM audio data (not base64)
- Uses new message format with "Turn" objects

### WebSocket Connection
```typescript
const url = `wss://streaming.assemblyai.com/v3/stream?token=${apiKey}&sample_rate=16000&encoding=pcm_s16le&format_turns=true`;
this.ws = new WebSocket(url); // Browser's native WebSocket
```

### Audio Transmission
```typescript
// Send raw PCM audio data directly
this.ws.send(audioData); // ArrayBuffer of Int16 PCM data
```

### Message Handling
```typescript
// Receive Turn messages
{
  "type": "Turn",
  "turn_order": 0,
  "turn_is_formatted": true,
  "end_of_turn": true,
  "transcript": "Hello, world.",
  "end_of_turn_confidence": 0.95,
  "words": [...]
}
```

## References
- [AssemblyAI Browser Example](https://github.com/AssemblyAI/realtime-transcription-browser-js-example)
- [AssemblyAI Streaming Docs](https://www.assemblyai.com/docs/speech-to-text/streaming)
