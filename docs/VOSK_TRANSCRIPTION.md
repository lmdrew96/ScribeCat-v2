# Vosk Transcription Setup Guide

## Overview

ScribeCat v2 uses Vosk for real-time speech-to-text transcription. Vosk is an offline speech recognition toolkit that runs locally on your machine, ensuring privacy and no internet dependency.

## Architecture

- **vosk-browser**: Used in the renderer process for real-time transcription
- **VoskTranscriptionService**: Handles audio processing and transcription
- **AudioConverter**: Utility for audio format conversion

## Prerequisites

### 1. Download Vosk Model

Vosk requires a language model to perform transcription. Models are available for many languages.

**For English (US):**
1. Visit: https://alphacephei.com/vosk/models
2. Download `vosk-model-small-en-us-0.15` (40MB) or `vosk-model-en-us-0.22` (1.8GB for better accuracy)
3. Extract the ZIP file to a location on your computer

**Model Recommendations:**
- **Small models** (~40-50MB): Fast, good for real-time transcription, slightly lower accuracy
- **Large models** (~1-2GB): Slower, best accuracy, may have latency on older machines

### 2. Serve Model Files

**Important:** `vosk-browser` requires model files to be served via HTTP, not loaded from the file system.

**Option A: Use a local HTTP server (Recommended for development)**

```bash
# Navigate to your models directory
cd /path/to/vosk-models

# Start a simple HTTP server
# Python 3:
python3 -m http.server 8000

# Python 2:
python -m SimpleHTTPServer 8000

# Node.js (if you have http-server installed):
npx http-server -p 8000 --cors
```

Then your model URL would be: `http://localhost:8000/vosk-model-small-en-us-0.15`

**Option B: Bundle models with the app (For production)**

Place model files in the `public` or `assets` directory and configure Electron to serve them.

## Configuration

### 1. Set Model Path in Settings

The model path should be stored in electron-store:

```typescript
// In settings or configuration
await store.set('vosk-model-url', 'http://localhost:8000/vosk-model-small-en-us-0.15');
```

### 2. Initialize Vosk Service

```typescript
import { VoskTranscriptionService } from './vosk-transcription-service';

const voskService = new VoskTranscriptionService();

// Initialize with model
await voskService.initialize({
  modelPath: 'http://localhost:8000/vosk-model-small-en-us-0.15',
  sampleRate: 16000, // Vosk requires 16000 Hz
  onResult: (result) => {
    console.log('Transcription:', result.text);
    console.log('Is final:', result.isFinal);
    console.log('Timestamp:', result.timestamp);
  },
  onError: (error) => {
    console.error('Vosk error:', error);
  }
});
```

### 3. Start Transcription

```typescript
// Get audio stream from microphone
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// Start transcription
const sessionId = await voskService.start(stream);

// Transcription results will be emitted via the onResult callback
```

### 4. Stop Transcription

```typescript
await voskService.stop();
```

### 5. Clean Up

```typescript
voskService.dispose();
```

## Usage Example

```typescript
// Complete example
async function startVoskTranscription() {
  const voskService = new VoskTranscriptionService();
  
  try {
    // Initialize
    await voskService.initialize({
      modelPath: 'http://localhost:8000/vosk-model-small-en-us-0.15',
      sampleRate: 16000,
      onResult: (result) => {
        if (result.isFinal) {
          // Final transcription result
          console.log('Final:', result.text);
          addTranscriptionToUI(result.text, result.timestamp);
        } else {
          // Partial result (as user is speaking)
          console.log('Partial:', result.text);
          updateLiveTranscription(result.text);
        }
      },
      onError: (error) => {
        console.error('Transcription error:', error);
        showErrorToUser(error.message);
      }
    });
    
    // Get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    // Start transcription
    await voskService.start(stream);
    
    console.log('Vosk transcription started');
    
    // Stop after some time or on user action
    // await voskService.stop();
    // voskService.dispose();
    
  } catch (error) {
    console.error('Failed to start Vosk:', error);
  }
}
```

## Transcription Results

### Result Object

```typescript
interface VoskResult {
  text: string;      // Transcribed text
  timestamp: number; // Time in seconds from start
  isFinal: boolean;  // true = final result, false = partial/interim
}
```

### Partial vs Final Results

- **Partial results**: Emitted continuously as the user speaks (not final, may change)
- **Final results**: Emitted when Vosk determines a phrase/sentence is complete

Use partial results for live feedback, final results for saving to transcript.

## Audio Requirements

Vosk expects:
- **Sample Rate**: 16000 Hz (16 kHz)
- **Format**: PCM audio (handled automatically by vosk-browser)
- **Channels**: Mono (single channel)

The `VoskTranscriptionService` handles audio format conversion automatically.

## Performance Tips

1. **Use smaller models** for real-time transcription on older hardware
2. **Close other audio applications** to avoid conflicts
3. **Use a good microphone** for better accuracy
4. **Speak clearly** and at a moderate pace
5. **Minimize background noise** for best results

## Troubleshooting

### Model Loading Fails

**Error**: "Failed to load model"

**Solutions**:
- Ensure model files are served via HTTP (not file://)
- Check that the model URL is correct and accessible
- Verify CORS is enabled on your HTTP server
- Try a different model (some may be corrupted)

### No Transcription Results

**Possible causes**:
- Microphone not working or permission denied
- Audio level too low (check VU meter)
- Model not compatible with audio format
- Sample rate mismatch

**Solutions**:
- Check microphone permissions in system settings
- Test microphone in other applications
- Verify model is loaded successfully
- Check browser console for errors

### Poor Accuracy

**Solutions**:
- Use a larger, more accurate model
- Improve microphone quality
- Reduce background noise
- Speak more clearly and at moderate pace
- Ensure proper microphone positioning

### High Latency

**Solutions**:
- Use a smaller model
- Close other applications
- Reduce buffer size (may affect accuracy)
- Upgrade hardware if consistently slow

## Model Languages

Vosk supports many languages. Visit https://alphacephei.com/vosk/models for:

- English (US, UK, Indian)
- Spanish
- French
- German
- Russian
- Chinese
- Japanese
- And many more...

Each language requires its own model file.

## Privacy & Security

**Advantages of Vosk:**
- ✅ Runs completely offline (no internet required)
- ✅ No data sent to external servers
- ✅ Full privacy - audio stays on your machine
- ✅ No API costs or rate limits
- ✅ Works without internet connection

**Considerations:**
- Models can be large (40MB - 2GB)
- Requires local storage for models
- May be slower than cloud-based solutions on older hardware

## Integration with ScribeCat

The Vosk service integrates with ScribeCat's recording system:

1. User starts recording
2. Audio stream is captured from microphone
3. VoskTranscriptionService processes audio in real-time
4. Transcription results are displayed live
5. Final results are saved to session transcript
6. Audio is saved separately for playback

## Next Steps

1. Download and set up a Vosk model
2. Configure model path in ScribeCat settings
3. Test transcription with a recording
4. Adjust settings for optimal performance
5. Try different models for better accuracy

## Resources

- **Vosk Website**: https://alphacephei.com/vosk/
- **Vosk Models**: https://alphacephei.com/vosk/models
- **vosk-browser GitHub**: https://github.com/ccoreilly/vosk-browser
- **Vosk Documentation**: https://alphacephei.com/vosk/documentation

## Support

For issues with:
- **Vosk itself**: Check Vosk documentation and GitHub issues
- **ScribeCat integration**: Report via ScribeCat's issue tracker
- **Model quality**: Try different models or report to Vosk team
