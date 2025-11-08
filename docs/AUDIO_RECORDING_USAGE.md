# Audio Recording Usage Guide

## Overview

ScribeCat v2 now has a clean, modular audio recording system based on the v1 analysis. The implementation uses native Web APIs (no external npm packages needed) and follows Clean Architecture principles.

## Architecture

```
Renderer Process (Browser APIs)
├── AudioRecorderService - Handles MediaRecorder API
├── AudioAnalyzerService - Handles Web Audio API (VU meter)
└── AudioManager - Coordinates both services

Main Process (Electron)
└── IPC Handlers - Saves audio files to disk
```

## Components

### 1. AudioRecorderService (`src/main/services/audio/AudioRecorderService.ts`)

Handles audio recording using the MediaRecorder API.

**Features:**
- Microphone device selection
- Audio enhancements (echo cancellation, noise suppression, auto gain)
- Pause/resume support
- WebM audio format output
- Chunk-based recording

**Key Methods:**
```typescript
async getAudioDevices(): Promise<AudioDevice[]>
async startRecording(config?: RecordingConfig): Promise<void>
async stopRecording(): Promise<RecordingResult>
pauseRecording(): void
resumeRecording(): void
getState(): string
```

### 2. AudioAnalyzerService (`src/main/services/audio/AudioAnalyzerService.ts`)

Handles real-time audio analysis for VU meter visualization.

**Features:**
- Real-time audio level calculation
- RMS (Root Mean Square) for accurate levels
- Normalized output (0-1 range)
- Configurable FFT size and smoothing

**Key Methods:**
```typescript
async initialize(stream: MediaStream, config?: AnalyzerConfig): Promise<void>
getLevel(): number // Returns 0-1
getLevelData(): AudioLevelData
startMonitoring(callback: (data: AudioLevelData) => void, interval?: number): void
stopMonitoring(): void
cleanup(): void
```

### 3. AudioManager (`src/renderer/audio-manager.ts`)

Coordinates both services and provides a unified API.

**Key Methods:**
```typescript
async getDevices(): Promise<AudioDevice[]>
async startRecording(config?: RecordingConfig): Promise<void>
async stopRecording(): Promise<RecordingResult>
pauseRecording(): void
resumeRecording(): void
getAudioLevel(): number
startLevelMonitoring(callback: (data: AudioLevelData) => void, interval?: number): void
stopLevelMonitoring(): void
```

## Usage Example

### Basic Recording

```typescript
import { AudioManager } from './audio-manager.js';

const audioManager = new AudioManager();

// Get available devices
const devices = await audioManager.getDevices();
console.log('Available microphones:', devices);

// Start recording with specific device
await audioManager.startRecording({
  deviceId: devices[0].deviceId,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
});

// Start VU meter monitoring
audioManager.startLevelMonitoring((data) => {
  console.log('Audio level:', data.level); // 0-1 range
  // Update UI VU meter here
}, 100); // Update every 100ms

// Stop recording
const result = await audioManager.stopRecording();
console.log('Recording duration:', result.duration);
console.log('Audio data size:', result.audioData.length);

// Save to disk via IPC
const saveResult = await window.scribeCat.audio.saveFile(
  Array.from(result.audioData),
  'my-recording',
  '/path/to/folder'
);
console.log('Saved to:', saveResult.path);
```

### With Pause/Resume

```typescript
const audioManager = new AudioManager();

// Start recording
await audioManager.startRecording();

// Pause after 5 seconds
setTimeout(() => {
  audioManager.pauseRecording();
  console.log('Recording paused');
}, 5000);

// Resume after 2 more seconds
setTimeout(() => {
  audioManager.resumeRecording();
  console.log('Recording resumed');
}, 7000);

// Stop after 10 seconds total
setTimeout(async () => {
  const result = await audioManager.stopRecording();
  console.log('Recording complete:', result);
}, 10000);
```

### Error Handling

```typescript
const audioManager = new AudioManager();

try {
  await audioManager.startRecording();
} catch (error) {
  if (error.message.includes('permission denied')) {
    console.error('Microphone permission denied');
    // Show UI prompt to enable microphone
  } else if (error.message.includes('No microphone found')) {
    console.error('No microphone detected');
    // Show UI message to connect microphone
  } else if (error.message.includes('being used by another application')) {
    console.error('Microphone in use');
    // Show UI message to close other apps
  } else {
    console.error('Recording error:', error);
  }
}
```

## IPC API

### Audio File Saving

```typescript
// Save audio file to disk
const result = await window.scribeCat.audio.saveFile(
  audioDataArray,  // number[] - audio data as array
  fileName,        // string - file name without extension
  folderPath       // string - absolute path to folder
);

// Returns: { success: boolean; path?: string; error?: string }
```

## Configuration Options

### RecordingConfig

```typescript
interface RecordingConfig {
  deviceId?: string;              // Specific microphone device ID
  echoCancellation?: boolean;     // Default: true
  noiseSuppression?: boolean;     // Default: true
  autoGainControl?: boolean;      // Default: true
}
```

### AnalyzerConfig

```typescript
interface AnalyzerConfig {
  fftSize?: number;                    // Must be power of 2, default: 256
  smoothingTimeConstant?: number;      // 0-1, default: 0.8
  updateInterval?: number;             // milliseconds, default: 100
}
```

## Audio Format

- **Output Format:** WebM (with Opus codec if supported)
- **Fallback:** Browser's default format
- **File Extension:** `.webm`

The service automatically selects the best supported MIME type:
1. `audio/webm;codecs=opus` (preferred)
2. `audio/webm`
3. `audio/ogg;codecs=opus`
4. `audio/mp4`
5. Browser default

## Permissions

### macOS
The app automatically requests microphone permission on startup. Users will see a system dialog.

### Renderer Process
The main process grants media permission to the renderer via `setPermissionRequestHandler`.

## Best Practices

1. **Always clean up:** Call `audioManager.cleanup()` when done
2. **Check state:** Use `audioManager.getState()` before operations
3. **Handle errors:** Wrap recording operations in try-catch
4. **Stop monitoring:** Call `stopLevelMonitoring()` when not needed
5. **Device selection:** Let users choose their preferred microphone

## Next Steps

- [ ] Integrate with transcription services (AssemblyAI)
- [ ] Implement audio playback for review
- [ ] Add waveform visualization
- [ ] Support multiple audio tracks

## Troubleshooting

### "Microphone permission denied"
- Check System Preferences > Security & Privacy > Microphone
- Ensure ScribeCat has permission enabled

### "No microphone found"
- Check if microphone is connected
- Try a different USB port
- Restart the application

### "Microphone is being used by another application"
- Close other apps using the microphone (Zoom, Teams, etc.)
- Check Activity Monitor for processes using audio input

### VU meter not working
- Ensure recording has started before initializing analyzer
- Check browser console for AudioContext errors
- Verify AudioContext state is 'running'

## References

- [MDN: MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [MDN: Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MDN: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
