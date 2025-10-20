# Vosk Model Auto-Download Implementation

## Overview

ScribeCat v2 now includes automatic download and installation of the Vosk speech recognition model. This eliminates the need for users to manually download and configure models.

## Model Details

- **Model**: vosk-model-en-us-0.22
- **Size**: ~1.8 GB
- **Language**: English (US)
- **Source**: https://alphacephei.com/vosk/models
- **Storage Location**: `{userData}/vosk-models/vosk-model-en-us-0.22`

## Architecture

### Components

1. **VoskModelManager** (`src/main/services/VoskModelManager.ts`)
   - Handles model download and extraction
   - Tracks download progress
   - Validates model installation
   - Manages model lifecycle

2. **IPC Handlers** (`src/main/main.ts`)
   - `vosk:model:isInstalled` - Check if model exists
   - `vosk:model:getPath` - Get model directory path
   - `vosk:model:download` - Start download
   - `vosk:model:delete` - Remove installed model
   - `vosk:model:downloadProgress` - Progress events

3. **Preload API** (`src/preload/preload.ts`)
   - `window.scribeCat.transcription.vosk.model.*`

## Usage

### Check if Model is Installed

```typescript
const result = await window.scribeCat.transcription.vosk.model.isInstalled();
if (result.success && result.isInstalled) {
  console.log('Model is ready to use');
} else {
  console.log('Model needs to be downloaded');
}
```

### Download Model

```typescript
// Set up progress listener
window.scribeCat.transcription.vosk.model.onDownloadProgress((progress) => {
  console.log(`Status: ${progress.status}`);
  console.log(`Progress: ${progress.percentage.toFixed(1)}%`);
  console.log(`Message: ${progress.message}`);
  
  // Update UI
  if (progress.status === 'downloading') {
    updateProgressBar(progress.percentage);
    updateStatusText(progress.message);
  } else if (progress.status === 'extracting') {
    showExtractionMessage();
  } else if (progress.status === 'complete') {
    showSuccessMessage();
  } else if (progress.status === 'error') {
    showErrorMessage(progress.message);
  }
});

// Start download
const result = await window.scribeCat.transcription.vosk.model.download();
if (result.success) {
  console.log('Download completed successfully');
} else {
  console.error('Download failed:', result.error);
}

// Clean up listener when done
window.scribeCat.transcription.vosk.model.removeDownloadProgressListener();
```

### Get Model Path

```typescript
const result = await window.scribeCat.transcription.vosk.model.getPath();
if (result.success) {
  console.log('Model path:', result.modelPath);
  console.log('Models directory:', result.modelsDir);
}
```

### Delete Model

```typescript
const result = await window.scribeCat.transcription.vosk.model.delete();
if (result.success) {
  console.log('Model deleted successfully');
}
```

## Download Progress Events

The `downloadProgress` event provides detailed information:

```typescript
interface DownloadProgress {
  bytesDownloaded: number;    // Bytes downloaded so far
  totalBytes: number;          // Total file size
  percentage: number;          // Progress percentage (0-100)
  status: 'downloading' | 'extracting' | 'complete' | 'error';
  message?: string;            // Human-readable status message
}
```

### Status Values

- **downloading**: File is being downloaded from server
- **extracting**: ZIP file is being extracted
- **complete**: Download and extraction successful
- **error**: Download or extraction failed

## First-Run Setup Flow

### Recommended Implementation

```typescript
async function initializeVosk() {
  // 1. Check if model is installed
  const installCheck = await window.scribeCat.transcription.vosk.model.isInstalled();
  
  if (!installCheck.success || !installCheck.isInstalled) {
    // 2. Show setup UI
    showVoskSetupDialog();
    return;
  }
  
  // 3. Model is installed, start server
  const pathResult = await window.scribeCat.transcription.vosk.model.getPath();
  if (!pathResult.success) {
    console.error('Failed to get model path');
    return;
  }
  
  // 4. Start HTTP server
  const serverResult = await window.scribeCat.transcription.vosk.startServer(
    pathResult.modelsDir
  );
  
  if (serverResult.success) {
    console.log('Vosk server started:', serverResult.serverUrl);
    // Ready for transcription
  }
}

function showVoskSetupDialog() {
  // Show modal with:
  // - Explanation of what Vosk is
  // - Download size (~1.8 GB)
  // - "Download Now" button
  // - "Skip" button (use simulation mode instead)
  
  const dialog = document.createElement('div');
  dialog.innerHTML = `
    <div class="setup-dialog">
      <h2>Offline Transcription Setup</h2>
      <p>ScribeCat uses Vosk for offline speech recognition.</p>
      <p>A one-time download of ~1.8 GB is required.</p>
      <div class="progress-container" style="display: none;">
        <div class="progress-bar"></div>
        <div class="progress-text"></div>
      </div>
      <button id="download-btn">Download Now</button>
      <button id="skip-btn">Skip (Use Simulation Mode)</button>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  document.getElementById('download-btn')?.addEventListener('click', async () => {
    startModelDownload(dialog);
  });
  
  document.getElementById('skip-btn')?.addEventListener('click', () => {
    dialog.remove();
    // Continue with simulation mode
  });
}

async function startModelDownload(dialog: HTMLElement) {
  const progressContainer = dialog.querySelector('.progress-container');
  const progressBar = dialog.querySelector('.progress-bar');
  const progressText = dialog.querySelector('.progress-text');
  const downloadBtn = dialog.querySelector('#download-btn');
  const skipBtn = dialog.querySelector('#skip-btn');
  
  // Show progress UI
  progressContainer.style.display = 'block';
  downloadBtn.disabled = true;
  skipBtn.disabled = true;
  
  // Set up progress listener
  window.scribeCat.transcription.vosk.model.onDownloadProgress((progress) => {
    progressBar.style.width = `${progress.percentage}%`;
    progressText.textContent = progress.message || '';
    
    if (progress.status === 'complete') {
      // Download complete, close dialog
      setTimeout(() => {
        dialog.remove();
        initializeVosk(); // Try again now that model is installed
      }, 1000);
    } else if (progress.status === 'error') {
      // Show error
      progressText.textContent = `Error: ${progress.message}`;
      downloadBtn.disabled = false;
      skipBtn.disabled = false;
    }
  });
  
  // Start download
  const result = await window.scribeCat.transcription.vosk.model.download();
  if (!result.success) {
    progressText.textContent = `Error: ${result.error}`;
    downloadBtn.disabled = false;
    skipBtn.disabled = false;
  }
}
```

## Error Handling

### Common Errors

1. **Network Error**
   ```
   Failed to download: HTTP 404
   ```
   Solution: Check internet connection, verify model URL is correct

2. **Disk Space Error**
   ```
   ENOSPC: no space left on device
   ```
   Solution: Free up disk space (need ~2 GB for download + extraction)

3. **Permission Error**
   ```
   EACCES: permission denied
   ```
   Solution: Check write permissions for userData directory

4. **Extraction Error**
   ```
   Model extraction failed - model files not found
   ```
   Solution: Re-download the model (may have been corrupted)

### Retry Logic

```typescript
async function downloadWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await window.scribeCat.transcription.vosk.model.download();
      if (result.success) {
        return true;
      }
      
      if (attempt < maxRetries) {
        console.log(`Download failed, retrying (${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
      }
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
  return false;
}
```

## Storage Management

### Model Location

Models are stored in the Electron userData directory:
- **macOS**: `~/Library/Application Support/ScribeCat/vosk-models/`
- **Windows**: `%APPDATA%/ScribeCat/vosk-models/`
- **Linux**: `~/.config/ScribeCat/vosk-models/`

### Disk Space Requirements

- **Download**: ~1.8 GB (temporary ZIP file)
- **Extracted**: ~1.8 GB (model files)
- **Total During Download**: ~3.6 GB
- **After Cleanup**: ~1.8 GB (ZIP is deleted)

### Cleanup

The ZIP file is automatically deleted after successful extraction. If download fails, partial files are cleaned up automatically.

## Performance Considerations

### Download Time

Approximate download times based on connection speed:
- **100 Mbps**: ~2-3 minutes
- **50 Mbps**: ~5-6 minutes
- **25 Mbps**: ~10-12 minutes
- **10 Mbps**: ~25-30 minutes

### Extraction Time

- **SSD**: ~10-20 seconds
- **HDD**: ~30-60 seconds

### Background Download

The download runs in the main process and doesn't block the UI. Users can:
- Continue using other app features
- Minimize the app
- Switch to other applications

However, closing the app will cancel the download.

## Security

### HTTPS

All downloads use HTTPS to ensure:
- Data integrity
- Protection against man-in-the-middle attacks
- Verification of source authenticity

### Validation

After download, the model is validated by checking for required files:
- `am/` directory (acoustic model)
- `graph/` directory (language model)
- `conf/` directory (configuration)

If validation fails, the download is considered failed and files are cleaned up.

## Future Enhancements

1. **Multiple Models**: Support for different languages
2. **Model Selection**: Let users choose model size (small/medium/large)
3. **Resume Downloads**: Continue interrupted downloads
4. **Bandwidth Limiting**: Throttle download speed
5. **Scheduled Downloads**: Download during off-peak hours
6. **Model Updates**: Check for and download model updates

## Testing

### Manual Testing

1. **First Install**:
   ```typescript
   // Should show false
   const result = await window.scribeCat.transcription.vosk.model.isInstalled();
   console.log(result.isInstalled); // false
   ```

2. **Download**:
   ```typescript
   await window.scribeCat.transcription.vosk.model.download();
   // Monitor progress events
   ```

3. **Verify Installation**:
   ```typescript
   const result = await window.scribeCat.transcription.vosk.model.isInstalled();
   console.log(result.isInstalled); // true
   ```

4. **Get Path**:
   ```typescript
   const result = await window.scribeCat.transcription.vosk.model.getPath();
   console.log(result.modelPath);
   ```

5. **Start Server**:
   ```typescript
   const result = await window.scribeCat.transcription.vosk.startServer(
     result.modelsDir
   );
   console.log(result.serverUrl); // http://localhost:8765
   ```

### Automated Testing

```typescript
describe('Vosk Model Download', () => {
  it('should detect when model is not installed', async () => {
    const result = await window.scribeCat.transcription.vosk.model.isInstalled();
    expect(result.success).toBe(true);
    expect(result.isInstalled).toBe(false);
  });
  
  it('should download and install model', async () => {
    const result = await window.scribeCat.transcription.vosk.model.download();
    expect(result.success).toBe(true);
  });
  
  it('should detect when model is installed', async () => {
    const result = await window.scribeCat.transcription.vosk.model.isInstalled();
    expect(result.success).toBe(true);
    expect(result.isInstalled).toBe(true);
  });
});
```

## Troubleshooting

### Download Stuck

If download appears stuck:
1. Check network connection
2. Check firewall settings
3. Try restarting the app
4. Check available disk space

### Extraction Fails

If extraction fails:
1. Delete partial files manually
2. Ensure sufficient disk space
3. Check write permissions
4. Try downloading again

### Model Not Working

If model is installed but not working:
1. Verify model path is correct
2. Check model directory structure
3. Try deleting and re-downloading
4. Check console for errors

## References

- [Vosk Official Website](https://alphacephei.com/vosk/)
- [Vosk Models](https://alphacephei.com/vosk/models)
- [Vosk API Documentation](https://alphacephei.com/vosk/api)
