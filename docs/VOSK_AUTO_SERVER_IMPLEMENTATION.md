# Vosk Auto HTTP Server Implementation

## Overview

This document describes the implementation of Vosk offline transcription using `vosk-browser` with an automatic local HTTP server. This approach was chosen after the native `vosk` npm package failed to compile due to Node.js v22 compatibility issues.

## Architecture

### Components

1. **VoskModelServer** (Main Process)
   - Location: `src/main/services/VoskModelServer.ts`
   - Simple HTTP server that serves Vosk model files from the filesystem
   - Runs on `localhost:8765` by default
   - Automatically starts/stops with the application

2. **VoskTranscriptionService** (Renderer Process)
   - Location: `src/renderer/vosk-transcription-service.ts`
   - Uses `vosk-browser` package to load models from the local HTTP server
   - Handles real-time speech-to-text transcription
   - Processes audio from MediaStream (microphone)

3. **IPC Handlers** (Main Process)
   - Location: `src/main/main.ts`
   - `vosk:server:start` - Start the HTTP server
   - `vosk:server:stop` - Stop the HTTP server
   - `vosk:server:isRunning` - Check server status

4. **Preload API**
   - Location: `src/preload/preload.ts`
   - Exposes Vosk server functions to renderer process
   - `window.scribeCat.transcription.vosk.*`

## How It Works

### 1. Server Startup

```typescript
// User configures model path in settings
const modelPath = '/Users/username/Downloads/vosk-model-small-en-us-0.15';

// Start server (main process)
const result = await window.scribeCat.transcription.vosk.startServer(modelPath);
// Returns: { success: true, serverUrl: 'http://localhost:8765' }
```

### 2. Model Loading

```typescript
// Initialize Vosk in renderer process
const voskService = new VoskTranscriptionService();

// Load model from local server
await voskService.initialize({
  modelUrl: 'http://localhost:8765/vosk-model-small-en-us-0.15',
  sampleRate: 16000,
  onResult: (result) => {
    console.log(result.text, result.isFinal);
  },
  onError: (error) => {
    console.error('Vosk error:', error);
  }
});
```

### 3. Transcription

```typescript
// Get microphone stream
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// Start transcription
const sessionId = await voskService.start(stream);

// Results come via callback:
// - Partial results (isFinal: false) - while speaking
// - Final results (isFinal: true) - end of phrase/sentence

// Stop transcription
await voskService.stop();
```

### 4. Server Shutdown

```typescript
// Stop server when done
await window.scribeCat.transcription.vosk.stopServer();

// Server also stops automatically on app quit
```

## Security Considerations

### HTTP Server Security

1. **Localhost Only**: Server binds to `localhost` only, not accessible from network
2. **Directory Traversal Protection**: Prevents `..` in file paths
3. **File Type Validation**: Only serves files, not directories
4. **CORS Enabled**: Required for vosk-browser to load models
5. **No Authentication**: Not needed since it's localhost-only

### Content Security Policy

The renderer process CSP allows connections to `localhost:8765`:
```html
<meta http-equiv="Content-Security-Policy" 
      content="connect-src 'self' http://localhost:8765">
```

## Model Directory Structure

Vosk models should be organized as follows:

```
/path/to/models/
├── vosk-model-small-en-us-0.15/
│   ├── am/
│   ├── graph/
│   ├── conf/
│   └── ... (other model files)
├── vosk-model-en-us-0.22/
│   └── ... (model files)
└── ... (other models)
```

The HTTP server serves files from the configured model directory. To load a specific model, use its folder name in the URL:
```
http://localhost:8765/vosk-model-small-en-us-0.15
```

## Configuration

### Settings Storage

Model path is stored in electron-store:
```typescript
// Save model path
await window.scribeCat.store.set('vosk-model-path', '/path/to/models');

// Retrieve model path
const modelPath = await window.scribeCat.store.get('vosk-model-path');
```

### Server Port

Default port is `8765`. Can be changed when starting server:
```typescript
await window.scribeCat.transcription.vosk.startServer(modelPath, 9000);
```

## Error Handling

### Common Errors

1. **Model Path Not Found**
   ```
   Error: Model path does not exist: /path/to/models
   ```
   Solution: Verify the model path exists and is accessible

2. **Port Already in Use**
   ```
   Error: Port 8765 is already in use
   ```
   Solution: Close other applications using the port or use a different port

3. **Model Load Failed**
   ```
   Error: Failed to load Vosk model
   ```
   Solution: Verify model directory structure is correct

4. **Invalid Model Directory**
   ```
   Error: Invalid Vosk model directory. Missing required files (am/, graph/, conf/)
   ```
   Solution: Download a complete Vosk model from https://alphacephei.com/vosk/models

## Performance

### Resource Usage

- **Memory**: ~100-500MB depending on model size
- **CPU**: Minimal when idle, moderate during transcription
- **Disk I/O**: Only during model loading (one-time)

### Latency

- **Model Loading**: 2-5 seconds (one-time)
- **Transcription**: Real-time with ~100-200ms latency
- **HTTP Overhead**: Negligible (localhost)

## Advantages Over Native Package

✅ **No Compilation Issues**: Pure JavaScript, no native dependencies
✅ **Works Offline**: All processing happens locally
✅ **Easy Setup**: No build tools or compilers required
✅ **Cross-Platform**: Works on macOS, Windows, Linux
✅ **Automatic Management**: Server lifecycle managed by app
✅ **Secure**: Localhost-only, no external network access

## Disadvantages

⚠️ **HTTP Server Required**: Adds complexity (but automated)
⚠️ **Browser-Based**: Limited to vosk-browser capabilities
⚠️ **Model Loading**: Requires HTTP server to be running

## Future Improvements

1. **Auto-Download Models**: Download models from Vosk website
2. **Model Management UI**: Browse, download, delete models
3. **Multiple Models**: Support switching between models
4. **Language Detection**: Auto-select model based on detected language
5. **Performance Monitoring**: Track transcription accuracy and speed

## Troubleshooting

### Server Won't Start

1. Check if port is available:
   ```bash
   lsof -i :8765
   ```

2. Try different port:
   ```typescript
   await window.scribeCat.transcription.vosk.startServer(modelPath, 9000);
   ```

### Model Won't Load

1. Verify model directory structure
2. Check server is running:
   ```typescript
   const status = await window.scribeCat.transcription.vosk.isServerRunning();
   console.log(status); // { success: true, isRunning: true, serverUrl: '...' }
   ```

3. Test server manually:
   ```bash
   curl http://localhost:8765/vosk-model-small-en-us-0.15/conf/model.conf
   ```

### No Transcription Results

1. Check microphone permissions
2. Verify audio stream is active
3. Check console for errors
4. Ensure model is loaded successfully

## References

- [Vosk Official Website](https://alphacephei.com/vosk/)
- [Vosk Models](https://alphacephei.com/vosk/models)
- [vosk-browser Package](https://www.npmjs.com/package/vosk-browser)
- [Vosk API Documentation](https://alphacephei.com/vosk/api)
