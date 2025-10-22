# Whisper ES Module Fix

## Problem
The WhisperTranscriptionService was using `require()` which caused a "ReferenceError: require is not defined" error because the main process uses ES modules, not CommonJS.

## Root Cause
```typescript
// This doesn't work in ES modules:
const { whisper } = require('whisper-node');
```

ES modules don't have access to `require()` - that's a CommonJS feature.

## Solution

### 1. Added ES Module Imports
```typescript
import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
```

### 2. Replaced `require()` with Direct Command Execution
Instead of trying to use `require('whisper-node')`, the service now:
1. **Primary method**: Calls `whisper-cpp` binary directly via `exec()`
2. **Fallback method**: Uses dynamic `import()` for whisper-node if binary not found

### 3. Implementation Details

**Primary Method (whisper-cpp binary):**
```typescript
private async transcribeFile(audioPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const command = `whisper-cpp -m "${this.modelPath}" -f "${audioPath}" -otxt -l en 2>&1`;
    
    exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        // If whisper-cpp not found, try fallback
        if (error.message.includes('command not found')) {
          this.tryWhisperNode(audioPath).then(resolve).catch(reject);
          return;
        }
        reject(error);
        return;
      }
      
      // Parse output from .txt file or stdout
      const txtFile = audioPath.replace('.wav', '.txt');
      if (fs.existsSync(txtFile)) {
        const transcription = fs.readFileSync(txtFile, 'utf-8').trim();
        fs.unlinkSync(txtFile);
        resolve(transcription);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}
```

**Fallback Method (whisper-node):**
```typescript
private async tryWhisperNode(audioPath: string): Promise<string> {
  try {
    // Dynamic import works in ES modules
    // @ts-ignore - whisper-node doesn't have type definitions
    const whisperModule = await import('whisper-node');
    const whisper = (whisperModule as any).default || whisperModule;
    
    const result = await whisper(audioPath, {
      modelPath: this.modelPath,
      language: 'en',
      whisperOptions: { outputFormat: ['txt'] }
    });
    
    // Handle various result formats
    if (typeof result === 'string') return result.trim();
    if (result?.transcription) return result.transcription.trim();
    if (Array.isArray(result)) return result.map(r => r.text || r).join(' ').trim();
    
    throw new Error('Unexpected result format');
  } catch (error) {
    throw new Error('Both whisper-cpp and whisper-node failed. Install: brew install whisper-cpp');
  }
}
```

## Benefits

1. **More Reliable**: Calling whisper-cpp binary directly is more stable than using whisper-node
2. **ES Module Compatible**: No more `require()` errors
3. **Graceful Fallback**: If binary not found, tries whisper-node package
4. **Better Error Messages**: Clear instructions for users to install whisper-cpp
5. **Proper Logging**: Detailed console logs for debugging

## Installation Requirements

For best results, install whisper-cpp:

**macOS:**
```bash
brew install whisper-cpp
```

**Linux:**
```bash
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make
sudo cp main /usr/local/bin/whisper-cpp
```

## Testing

1. **Compile:** `npm run compile` ✅
2. **Run:** `npm run dev`
3. **Open Settings** and select Whisper mode
4. **Download model** if not installed
5. **Record audio** and speak
6. **Check logs** for:
   ```
   [Whisper] transcribeFile() called for: /tmp/whisper-xxx.wav
   [Whisper] Executing command: whisper-cpp -m ...
   [Whisper] Transcription from file: your spoken text
   ```

## Files Modified

- `src/main/services/transcription/WhisperTranscriptionService.ts`
  - Added `exec` import from `child_process`
  - Added `promisify` import from `util`
  - Replaced `require()` with `exec()` for whisper-cpp
  - Added `tryWhisperNode()` fallback method with dynamic `import()`
  - Added `@ts-ignore` comment for whisper-node types

## Related Issues

- Fixes "ReferenceError: require is not defined" error
- Makes Whisper transcription functional in ES module environment
- Provides better error handling and user feedback

## Next Steps

1. Test with actual audio recording
2. Verify transcription results appear in UI
3. Test fallback to whisper-node if binary not installed
4. Document installation instructions for users
