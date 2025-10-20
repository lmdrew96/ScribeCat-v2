# Simulation Transcription Service

## Overview

The Simulation Transcription Service provides a testing environment for ScribeCat's transcription features without requiring Vosk or Whisper integration. It emits predefined phrases at regular intervals to simulate real-time speech-to-text transcription.

## Architecture

The simulation transcription follows Clean Architecture principles and is organized into three main components:

### 1. Service Interface (`ITranscriptionService.ts`)

Defines the contract that all transcription services must implement:

```typescript
interface ITranscriptionService {
  initialize(config?: TranscriptionConfig): Promise<void>;
  start(): Promise<string>;
  stop(sessionId: string): Promise<void>;
  onResult(callback: (result: TranscriptionResult) => void): void;
  isActive(): boolean;
  dispose(): void;
}
```

### 2. Simulation Implementation (`SimulationTranscriptionService.ts`)

Implements `ITranscriptionService` with simulated behavior:

- **Location**: `src/main/services/transcription/SimulationTranscriptionService.ts`
- **Runs in**: Main process (Electron)
- **Purpose**: Provides test transcription without external dependencies

**Key Features:**
- Emits 5 predefined phrases in sequence
- 3-second interval between phrases
- Loops back to start after last phrase
- Includes timestamps (elapsed seconds)
- All results marked as final (`isFinal: true`)

**Simulation Phrases:**
1. "This is a simulated transcription."
2. "The simulation mode is working correctly."
3. "These are test phrases to demonstrate functionality."
4. "Real transcription would connect to Vosk or Whisper services."
5. "Switch to real mode in settings to use actual transcription."

### 3. IPC Communication

**Main Process Handlers** (in `main.ts`):
- `transcription:simulation:start` - Starts simulation session
- `transcription:simulation:stop` - Stops active session
- `transcription:result` - Event channel for sending results to renderer

**Preload Bridge** (in `preload.ts`):
```typescript
window.scribeCat.transcription.simulation = {
  start: () => Promise<{ success: boolean; sessionId?: string }>,
  stop: (sessionId: string) => Promise<{ success: boolean }>,
  onResult: (callback: (result: TranscriptionResult) => void) => void,
  removeResultListener: () => void
}
```

## Usage

### Basic Usage

```typescript
// Start simulation transcription
const result = await window.scribeCat.transcription.simulation.start();
if (result.success) {
  console.log('Transcription started:', result.sessionId);
  
  // Listen for transcription results
  window.scribeCat.transcription.simulation.onResult((transcription) => {
    console.log(`[${transcription.timestamp.toFixed(1)}s] ${transcription.text}`);
  });
}

// Stop transcription
await window.scribeCat.transcription.simulation.stop(result.sessionId);

// Clean up listener
window.scribeCat.transcription.simulation.removeResultListener();
```

### Complete Example

```typescript
class TranscriptionManager {
  private sessionId: string | null = null;
  private transcripts: TranscriptionResult[] = [];

  async start() {
    try {
      // Start simulation
      const result = await window.scribeCat.transcription.simulation.start();
      
      if (!result.success) {
        console.error('Failed to start:', result.error);
        return;
      }
      
      this.sessionId = result.sessionId!;
      
      // Set up result handler
      window.scribeCat.transcription.simulation.onResult((transcription) => {
        this.transcripts.push(transcription);
        this.displayTranscription(transcription);
      });
      
      console.log('Transcription started successfully');
    } catch (error) {
      console.error('Error starting transcription:', error);
    }
  }

  async stop() {
    if (!this.sessionId) {
      console.warn('No active session to stop');
      return;
    }
    
    try {
      await window.scribeCat.transcription.simulation.stop(this.sessionId);
      window.scribeCat.transcription.simulation.removeResultListener();
      
      console.log('Transcription stopped');
      console.log('Total transcripts:', this.transcripts.length);
      
      this.sessionId = null;
    } catch (error) {
      console.error('Error stopping transcription:', error);
    }
  }

  private displayTranscription(result: TranscriptionResult) {
    const element = document.getElementById('transcription-output');
    if (element) {
      const line = document.createElement('div');
      line.textContent = `[${result.timestamp.toFixed(1)}s] ${result.text}`;
      element.appendChild(line);
    }
  }
}
```

## Settings Integration

The simulation mode can be toggled via settings:

```typescript
// Check if simulation mode is enabled
const { simulationMode } = await window.scribeCat.settings.getSimulationMode();
console.log('Simulation mode:', simulationMode);

// Enable/disable simulation mode
await window.scribeCat.settings.setSimulationMode(true);
```

**Default**: Simulation mode is enabled by default (`simulation-mode: true`)

**Storage**: Settings are persisted using `electron-store` in the user's app data directory

## Data Types

### TranscriptionResult

```typescript
interface TranscriptionResult {
  text: string;        // The transcribed text
  timestamp: number;   // Elapsed seconds from start
  isFinal: boolean;    // Always true for simulation
}
```

### TranscriptionConfig

```typescript
interface TranscriptionConfig {
  language?: string;      // Not used in simulation
  modelPath?: string;     // Not used in simulation
  sampleRate?: number;    // Not used in simulation
  [key: string]: unknown; // Additional options
}
```

## Error Handling

The service includes comprehensive error handling:

```typescript
// Service not initialized
if (!initialized) {
  throw new Error('Service not initialized. Call initialize() first.');
}

// Session already active
if (activeSessionId) {
  throw new Error('A transcription session is already active.');
}

// Session ID mismatch
if (activeSessionId !== sessionId) {
  throw new Error(`Session ID mismatch. Active: ${activeSessionId}, Requested: ${sessionId}`);
}
```

**Best Practices:**
- Always check `result.success` before using data
- Handle errors in try-catch blocks
- Clean up listeners when done
- Stop sessions before starting new ones

## Testing

### Manual Testing

1. Start the app: `npm run dev`
2. Open DevTools (View → Toggle Developer Tools)
3. Run in console:

```javascript
// Start transcription
const result = await window.scribeCat.transcription.simulation.start();
console.log('Session ID:', result.sessionId);

// Listen for results
window.scribeCat.transcription.simulation.onResult((r) => {
  console.log(`[${r.timestamp.toFixed(1)}s] ${r.text}`);
});

// Wait 15 seconds to see all 5 phrases...

// Stop transcription
await window.scribeCat.transcription.simulation.stop(result.sessionId);
window.scribeCat.transcription.simulation.removeResultListener();
```

### Expected Output

```
[0.0s] This is a simulated transcription.
[3.0s] The simulation mode is working correctly.
[6.0s] These are test phrases to demonstrate functionality.
[9.0s] Real transcription would connect to Vosk or Whisper services.
[12.0s] Switch to real mode in settings to use actual transcription.
[15.0s] This is a simulated transcription.  // Loops back
```

## Future Integration

When implementing real Vosk/Whisper transcription:

1. **Create new service classes** implementing `ITranscriptionService`:
   - `VoskTranscriptionService` (already exists as stub)
   - `WhisperTranscriptionService` (already exists as stub)

2. **Add service selection logic** in main.ts:
```typescript
const simulationMode = this.store.get('simulation-mode', true);
const transcriptionService = simulationMode 
  ? this.simulationTranscriptionService
  : this.voskTranscriptionService;
```

3. **Update IPC handlers** to use selected service:
```typescript
ipcMain.handle('transcription:start', async () => {
  const service = this.getActiveTranscriptionService();
  return await service.start();
});
```

4. **Keep simulation available** for testing and demos

## Troubleshooting

### No transcription results appearing

**Check:**
- Is the session started? (`result.success === true`)
- Is the result listener registered?
- Are there any console errors?

**Solution:**
```typescript
// Verify session is active
const result = await window.scribeCat.transcription.simulation.start();
console.log('Started:', result.success, 'Session:', result.sessionId);

// Verify listener is registered
window.scribeCat.transcription.simulation.onResult((r) => {
  console.log('Received result:', r);
});
```

### "Session already active" error

**Cause:** Trying to start a new session without stopping the previous one

**Solution:**
```typescript
// Always stop before starting new session
if (currentSessionId) {
  await window.scribeCat.transcription.simulation.stop(currentSessionId);
}
const result = await window.scribeCat.transcription.simulation.start();
```

### Memory leaks from listeners

**Cause:** Not removing event listeners when done

**Solution:**
```typescript
// Always clean up listeners
window.scribeCat.transcription.simulation.removeResultListener();

// Or in cleanup/unmount:
componentWillUnmount() {
  window.scribeCat.transcription.simulation.removeResultListener();
}
```

## Performance

- **CPU Usage**: Minimal (simple interval timer)
- **Memory Usage**: ~1KB per session
- **Network**: None (fully local)
- **Latency**: Consistent 3-second intervals

## Security

- Runs in main process (isolated from renderer)
- No external network calls
- No file system access
- No sensitive data handling

## Related Files

- `src/main/services/transcription/ITranscriptionService.ts` - Interface definition
- `src/main/services/transcription/SimulationTranscriptionService.ts` - Implementation
- `src/main/main.ts` - IPC handlers
- `src/preload/preload.ts` - API bridge
- `src/shared/window.d.ts` - Type definitions
- `docs/V1_AUDIO_VOSK_ANALYSIS.md` - Original v1 analysis

## Next Steps

1. ✅ Simulation transcription implemented
2. 🔄 UI integration (connect to recording interface)
3. ⏳ Real Vosk integration
4. ⏳ Real Whisper integration
5. ⏳ Transcription enhancement (punctuation, formatting)
6. ⏳ Export transcriptions to various formats
