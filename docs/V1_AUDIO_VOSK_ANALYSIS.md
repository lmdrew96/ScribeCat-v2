# ScribeCat v1 Audio Recording & Vosk Integration Analysis

## Overview
This document analyzes the audio recording and transcription implementation from ScribeCat v1.8.5 to guide the v2 implementation.

---

## 1. NPM Packages & Dependencies

### From package.json (v1.8.5):

**Core Dependencies:**
- **None for Vosk/Whisper** - The v1 implementation uses simulation mode by default
- `electron-store` (v10.1.0) - Settings storage
- `ws` (v8.18.3) - WebSocket support (for potential real-time transcription)

**Audio-Related (Browser APIs):**
- Uses native Web APIs: `MediaRecorder`, `getUserMedia`, `AudioContext`
- No external npm packages for audio capture

**Important Finding:** 
The v1 codebase does NOT have actual Vosk or Whisper integration implemented. It uses **simulation mode** with placeholder transcription text.

---

## 2. Audio Recording Implementation

### Location: `src/renderer/app.js`

### Key Components:

#### A. MediaRecorder Setup (Lines ~1150-1200)
```javascript
// Request microphone access
const constraints = {
  audio: {
    deviceId: this.microphoneSelect?.value || undefined,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

const stream = await navigator.mediaDevices.getUserMedia(constraints);
this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
```

**Features:**
- Microphone device selection support
- Audio enhancement (echo cancellation, noise suppression, auto gain)
- WebM audio format output
- Chunk-based recording (`ondataavailable` event)

#### B. VU Meter Implementation (Lines ~1300-1400)
```javascript
// Web Audio API for real-time audio visualization
this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
const source = this.audioContext.createMediaStreamSource(stream);
this.analyserNode = this.audioContext.createAnalyser();

this.analyserNode.fftSize = 256;
this.analyserNode.smoothingTimeConstant = 0.8;
source.connect(this.analyserNode);

// Update VU meter every 100ms
setInterval(() => {
  const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
  this.analyserNode.getByteFrequencyData(dataArray);
  
  // Calculate RMS for audio level
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i] * dataArray[i];
  }
  const rms = Math.sqrt(sum / dataArray.length);
  const level = rms / 255; // Normalize to 0-1
  
  this.vuBar.style.width = `${Math.min(level * 100, 100)}%`;
}, 100);
```

**Features:**
- Real-time audio level visualization
- RMS (Root Mean Square) calculation for accurate levels
- Smooth animation updates

#### C. Audio Chunk Collection
```javascript
this.audioChunks = [];
this.mediaRecorder.ondataavailable = (event) => {
  if (event.data.size > 0) {
    this.audioChunks.push(event.data);
  }
};
```

---

## 3. Vosk Integration (Simulation Mode)

### Current Implementation Status: **NOT IMPLEMENTED**

The v1 code has placeholder functions but uses simulation mode:

### Location: `src/renderer/app.js` (Lines ~1450-1550)

```javascript
async startVoskTranscription(stream) {
  if (this.simulationMode) {
    // Simulate transcription in development mode
    console.log('Simulation mode: Using simulated Vosk transcription');
    this.startSimulatedTranscription();
    return;
  }
  
  // Real Vosk integration (NOT IMPLEMENTED)
  this.transcriptionSession = await window.electronAPI.startVoskTranscription({ 
    stream, 
    modelPath: this.voskModelPath 
  });
  
  window.electronAPI.onVoskResult((event, result) => {
    if (result && result.text) {
      this.addTranscriptionEntry(result.text);
    }
  });
}
```

### Simulated Transcription (Lines ~1550-1580)
```javascript
startSimulatedTranscription() {
  const simulatedTexts = [
    "This is a simulated transcription.",
    "The simulation mode is working correctly.",
    "These are test phrases to demonstrate functionality.",
    "Real transcription would connect to Vosk or Whisper services.",
    "Switch to real mode in Developer Settings to use actual APIs."
  ];
  
  let textIndex = 0;
  this.simulatedTranscriptionInterval = setInterval(() => {
    if (this.isRecording && textIndex < simulatedTexts.length) {
      this.addTranscriptionEntry(simulatedTexts[textIndex]);
      textIndex++;
    } else if (this.isRecording) {
      textIndex = 0; // Loop back to beginning
    }
  }, 3000); // Add new text every 3 seconds
}
```

---

## 4. IPC Communication (Electron Main ↔ Renderer)

### Location: `src/main.js` (Lines ~150-200)

### Transcription IPC Handlers:

```javascript
let transcriptionSession = null;

// Start Vosk transcription
ipcMain.handle('transcription:start-vosk', async () => {
  const simulationMode = store.get('simulation-mode', true);
  
  if (simulationMode) {
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.webContents.send('transcription:vosk-result', { 
          text: 'Simulated Vosk transcription.' 
        });
      }
    }, 2000);
    transcriptionSession = 'vosk-session';
    return transcriptionSession;
  } else {
    // Real Vosk implementation would go here
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.webContents.send('transcription:vosk-result', { 
          text: 'Real Vosk transcription not implemented yet.' 
        });
      }
    }, 1000);
    transcriptionSession = 'vosk-session-real';
    return transcriptionSession;
  }
});

// Start Whisper transcription
ipcMain.handle('transcription:start-whisper', async () => {
  // Similar simulation mode implementation
});

// Stop transcription
ipcMain.handle('transcription:stop', async () => {
  transcriptionSession = null;
  return true;
});
```

### Audio File Saving IPC:

```javascript
// Save audio file
ipcMain.handle('save-audio-file', async (event, { audioData, fileName, folderPath }) => {
  try {
    const outPath = path.join(folderPath, `${fileName}.wav`);
    const buffer = Buffer.from(audioData);
    fs.writeFileSync(outPath, buffer);
    return { success: true, path: outPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

---

## 5. Audio File Handling

### Saving Audio Files (Lines ~2100-2200 in app.js)

```javascript
async saveRecording() {
  // Get audio destination preference
  const audioDestination = await window.electronAPI.storeGet('audio-destination') || 'local';
  const localAudioFolder = await window.electronAPI.storeGet('local-audio-folder');
  
  // Save audio file
  if (this.audioChunks.length > 0) {
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
    const audioBuffer = await audioBlob.arrayBuffer();
    const audioArray = new Uint8Array(audioBuffer);
    
    if (audioDestination === 'local') {
      await window.electronAPI.saveAudioFile({
        audioData: Array.from(audioArray),
        fileName: audioFileName,
        folderPath: localAudioFolder
      });
    }
  }
}
```

**File Naming Convention:**
```
COURSEID–Descriptive_Title—DATE.wav
Example: CS101–Introduction_to_Algorithms—09-25-2024.wav
```

---

## 6. Backend Server (server.js)

### Purpose: 
Provides Claude API proxy for AI features (NOT for Vosk/Whisper)

### Key Endpoints:
- `/api/chat` - AI chat responses
- `/api/summary` - Generate AI summaries
- `/api/blurb` - Generate filename descriptions
- `/api/polish` - Auto-polish transcription text

**Note:** The backend server does NOT handle audio transcription. It only provides AI text processing.

---

## 7. What's Missing for Real Vosk Integration

### Required for v2 Implementation:

1. **Vosk Model Files:**
   - Download Vosk language models (e.g., `vosk-model-en-us-0.22`)
   - Store model path in settings
   - Load model on transcription start

2. **Vosk Node.js Binding:**
   - Install `vosk` npm package
   - Initialize recognizer with model
   - Process audio stream in chunks

3. **Audio Stream Processing:**
   - Convert MediaRecorder output to format Vosk expects
   - Handle real-time audio streaming
   - Process recognition results

4. **IPC Implementation:**
   - Stream audio data from renderer to main process
   - Send recognition results back to renderer
   - Handle session lifecycle (start/stop/pause)

### Example Real Implementation Pattern:

```javascript
// Main process (main.ts)
import vosk from 'vosk';

let recognizer = null;
let model = null;

ipcMain.handle('transcription:start-vosk', async (event, { modelPath }) => {
  model = new vosk.Model(modelPath);
  recognizer = new vosk.Recognizer({ model, sampleRate: 16000 });
  
  // Set up audio stream processing
  ipcMain.on('audio-chunk', (event, audioData) => {
    if (recognizer.acceptWaveform(audioData)) {
      const result = recognizer.result();
      event.sender.send('transcription:vosk-result', { text: result.text });
    }
  });
  
  return 'vosk-session-active';
});
```

---

## 8. Key Findings Summary

### ✅ What's Implemented:
- Audio recording with MediaRecorder
- Microphone device selection
- Audio enhancement (echo cancellation, noise suppression)
- VU meter visualization
- Audio file saving (WebM format)
- IPC structure for transcription
- Simulation mode for testing

### ❌ What's NOT Implemented:
- Actual Vosk integration
- Actual Whisper integration
- Real-time audio streaming to transcription engine
- Vosk model loading and management
- Audio format conversion for Vosk

### 🎯 Recommendations for v2:

1. **Start with simulation mode** (like v1) for initial development
2. **Implement Vosk integration** as a separate feature branch
3. **Consider using Whisper API** instead of local Vosk for easier implementation
4. **Use WebSocket** for real-time audio streaming if implementing local Vosk
5. **Add model management UI** for downloading/selecting Vosk models
6. **Implement audio format conversion** (WebM → PCM for Vosk)

---

## 9. Architecture Recommendations for v2

### Clean Architecture Approach:

```
src/
├── domain/
│   └── entities/
│       └── AudioRecording.ts
│       └── Transcription.ts
├── application/
│   └── use-cases/
│       └── StartRecordingUseCase.ts
│       └── TranscribeAudioUseCase.ts
├── infrastructure/
│   └── services/
│       └── transcription/
│           └── VoskTranscriptionService.ts (implements ITranscriptionService)
│           └── WhisperTranscriptionService.ts
│       └── audio/
│           └── MediaRecorderService.ts
│           └── AudioAnalyzerService.ts (VU meter)
└── presentation/
    └── recording-manager.ts (Electron main process)
```

### Interface Definition:

```typescript
// domain/services/ITranscriptionService.ts
export interface ITranscriptionService {
  initialize(config: TranscriptionConfig): Promise<void>;
  startTranscription(audioStream: MediaStream): Promise<string>;
  stopTranscription(sessionId: string): Promise<void>;
  onResult(callback: (result: TranscriptionResult) => void): void;
}
```

---

## 10. Next Steps for v2 Implementation

1. ✅ Create domain entities (Session, Transcription, AudioRecording)
2. ✅ Define service interfaces (ITranscriptionService, IAudioRepository)
3. ⏳ Implement MediaRecorder wrapper service
4. ⏳ Implement VU meter service
5. ⏳ Create simulation transcription service (for testing)
6. ⏳ Implement real Vosk service (future)
7. ⏳ Set up IPC handlers in main process
8. ⏳ Create recording manager for Electron main process

---

## Conclusion

The v1 implementation provides a solid foundation for audio recording UI/UX but lacks actual transcription engine integration. The v2 implementation should:

1. Maintain the simulation mode for development
2. Build proper abstractions for transcription services
3. Implement real Vosk/Whisper integration as separate services
4. Follow Clean Architecture principles for maintainability
5. Consider using cloud-based Whisper API for easier implementation initially

The IPC structure and audio recording flow from v1 can be adapted for v2 with improved type safety and architecture.
