# Whisper Model Setup for ScribeCat v2

## Overview

ScribeCat v2 now supports Whisper models for offline transcription. This document covers the installation, setup, and testing of the Whisper model integration.

## Architecture

### Components

1. **WhisperModelManager** (`src/main/services/WhisperModelManager.ts`)
   - Manages downloading and installation of Whisper models
   - Supports multiple model sizes (tiny, base, small)
   - Provides progress tracking during downloads
   - Stores models in `userData/whisper-models/`

2. **IPC Handlers** (`src/main/main.ts`)
   - `whisper:model:isInstalled` - Check if a model is installed
   - `whisper:model:getPath` - Get the path to a model file
   - `whisper:model:download` - Download a model
   - `whisper:model:delete` - Delete a model
   - `whisper:model:getAvailable` - Get list of available models

3. **Preload API** (`src/preload/preload.ts`)
   - Exposes Whisper functionality to renderer process
   - Available at `window.scribeCat.transcription.whisper`

## Available Models

| Model | Size | Description | Use Case |
|-------|------|-------------|----------|
| tiny  | ~75MB | Fastest, least accurate | Testing, quick transcription |
| base  | ~142MB | Good balance | Recommended for most users |
| small | ~466MB | Better accuracy, slower | High-quality transcription |

## Installation

### 1. Dependencies

The `whisper-node` package is already installed:

```bash
npm install whisper-node --save
```

### 2. Model Download

Models are downloaded from Hugging Face and stored in:
```
~/Library/Application Support/scribecat-v2/whisper-models/
```

## Testing

### Console Testing

Open DevTools in the running application and test the API:

```javascript
// 1. Check available models
const result = await window.scribeCat.transcription.whisper.model.getAvailable();
console.log('Available models:', result);

// 2. Check if base model is installed
const installed = await window.scribeCat.transcription.whisper.model.isInstalled('base');
console.log('Base model installed:', installed);

// 3. Get model path
const pathInfo = await window.scribeCat.transcription.whisper.model.getPath('base');
console.log('Model path:', pathInfo);

// 4. Download base model (with progress tracking)
window.scribeCat.transcription.whisper.model.onDownloadProgress((progress) => {
  console.log(`Download progress: ${progress.percentage.toFixed(2)}%`);
  console.log(`Status: ${progress.status}`);
  console.log(`Message: ${progress.message}`);
});

const downloadResult = await window.scribeCat.transcription.whisper.model.download('base');
console.log('Download result:', downloadResult);

// Clean up listener
window.scribeCat.transcription.whisper.model.removeDownloadProgressListener();

// 5. Verify installation
const isInstalled = await window.scribeCat.transcription.whisper.model.isInstalled('base');
console.log('Model installed after download:', isInstalled);

// 6. Delete model (optional)
// const deleteResult = await window.scribeCat.transcription.whisper.model.delete('base');
// console.log('Delete result:', deleteResult);
```

### Expected Results

1. **getAvailable()** should return:
```javascript
{
  success: true,
  models: [
    { name: 'tiny', description: 'Fastest, good for testing', size: 78643200 },
    { name: 'base', description: 'Good balance of speed and accuracy', size: 148897792 },
    { name: 'small', description: 'Better accuracy, slower', size: 488447232 }
  ]
}
```

2. **isInstalled('base')** should return:
```javascript
{ success: true, isInstalled: false }  // Before download
{ success: true, isInstalled: true }   // After download
```

3. **getPath('base')** should return:
```javascript
{
  success: true,
  modelPath: '/Users/[username]/Library/Application Support/scribecat-v2/whisper-models/ggml-base.bin',
  modelsDir: '/Users/[username]/Library/Application Support/scribecat-v2/whisper-models'
}
```

4. **download('base')** should:
   - Emit progress events during download
   - Complete with `{ success: true }`
   - Download ~142MB file

## Progress Tracking

The download process emits progress events:

```typescript
interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  percentage: number;
  status: 'downloading' | 'extracting' | 'complete' | 'error';
  message?: string;
}
```

Example progress output:
```
Download progress: 0.00%
Status: downloading
Message: Downloading base model...

Download progress: 25.50%
Status: downloading
Message: Downloading base model...

Download progress: 100.00%
Status: complete
Message: Download complete
```

## Error Handling

Common errors and solutions:

### Network Errors
```javascript
{
  success: false,
  error: 'Failed to download: HTTP 404'
}
```
**Solution**: Check internet connection and Hugging Face availability

### Disk Space Errors
```javascript
{
  success: false,
  error: 'ENOSPC: no space left on device'
}
```
**Solution**: Free up disk space (models require 75MB-466MB)

### Permission Errors
```javascript
{
  success: false,
  error: 'EACCES: permission denied'
}
```
**Solution**: Check file system permissions for userData directory

## Integration with WhisperTranscriptionService

Once models are downloaded, they can be used with the `WhisperTranscriptionService`:

```typescript
// Future implementation
const whisperService = new WhisperTranscriptionService(modelPath);
await whisperService.transcribe(audioBuffer);
```

## Next Steps

1. ✅ Install whisper-node package
2. ✅ Create WhisperModelManager service
3. ✅ Add IPC handlers
4. ✅ Update preload API
5. ✅ Test model download
6. 🔄 Create WhisperTranscriptionService (next task)
7. 🔄 Integrate with UI
8. 🔄 Add model selection in settings

## File Locations

- **Service**: `src/main/services/WhisperModelManager.ts`
- **IPC Handlers**: `src/main/main.ts` (lines with `whisper:model:*`)
- **Preload API**: `src/preload/preload.ts` (transcription.whisper section)
- **Models Directory**: `~/Library/Application Support/scribecat-v2/whisper-models/`

## Troubleshooting

### Model won't download
1. Check console for error messages
2. Verify internet connection
3. Try downloading a smaller model (tiny) first
4. Check Hugging Face status

### Model path not found
1. Verify model was downloaded successfully
2. Check userData directory exists
3. Verify file permissions

### Progress events not firing
1. Ensure listener is set before calling download
2. Check that download hasn't already completed
3. Verify IPC communication is working

## References

- Whisper Models: https://huggingface.co/ggerganov/whisper.cpp
- whisper-node: https://www.npmjs.com/package/whisper-node
- Whisper.cpp: https://github.com/ggerganov/whisper.cpp
