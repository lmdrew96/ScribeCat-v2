# AssemblyAI Temporary Token Authentication Fix

## Problem
AssemblyAI's Universal Streaming API v3 was returning 403 Forbidden errors when attempting to connect from the browser (renderer process) because:

1. Browser WebSocket API cannot set custom HTTP headers (like `Authorization`)
2. AssemblyAI requires authentication via Authorization header OR temporary token
3. Direct API key authentication in browser is not possible due to WebSocket limitations

## Solution
Implemented a two-step authentication pattern using temporary tokens:

### Architecture
```
Renderer Process (Browser)
    ↓ Request temp token via IPC
Main Process (Node.js)
    ↓ HTTPS GET with Authorization header
AssemblyAI Token Endpoint
    ↓ Returns temporary token
Main Process
    ↓ Returns token to renderer
Renderer Process
    ↓ Connect WebSocket with token in URL
AssemblyAI Streaming WebSocket
```

## Implementation Details

### 1. Main Process - Token Generation (`src/main/main.ts`)
Added IPC handler to generate temporary tokens:

```typescript
ipcMain.handle('transcription:assemblyai:getToken', async (event, apiKey: string) => {
  const https = await import('https');
  
  return new Promise((resolve) => {
          const options = {
            hostname: 'streaming.assemblyai.com',
            path: '/v3/token?expires_in_seconds=600',
            method: 'GET',
            headers: {
              'Authorization': apiKey
            }
          };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const response = JSON.parse(data);
        if (res.statusCode === 200 && response.token) {
          resolve({ success: true, token: response.token });
        } else {
          resolve({ success: false, error: `Failed to get token: ${res.statusCode}` });
        }
      });
    });
    
    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });
    
    req.end();
  });
});
```

**Why this works:**
- Node.js `https` module can set Authorization headers
- Token endpoint returns a temporary token valid for 10 minutes (600 seconds max)
- Token can be safely used in WebSocket URL

### 2. Preload Script - IPC Bridge (`src/preload/preload.ts`)
Exposed token request method to renderer:

```typescript
transcription: {
  assemblyai: {
    getToken: (apiKey: string) => ipcRenderer.invoke('transcription:assemblyai:getToken', apiKey)
  }
}
```

### 3. Type Definitions (`src/shared/window.d.ts`)
Added type definition for the new method:

```typescript
assemblyai: {
  getToken: (apiKey: string) => Promise<{ success: boolean; token?: string; error?: string }>;
}
```

### 4. Renderer Service (`src/renderer/assemblyai-transcription-service.ts`)
Updated to request token and use it in WebSocket connection:

```typescript
private async getTemporaryToken(): Promise<string> {
  const result = await window.scribeCat.transcription.assemblyai.getToken(this.apiKey);
  if (!result.success || !result.token) {
    throw new Error(result.error || 'Failed to get temporary token');
  }
  return result.token;
}

private async connectWebSocket(token: string): Promise<void> {
  const url = `wss://streaming.assemblyai.com/v3/stream?token=${token}&sample_rate=16000&encoding=pcm_s16le&format_turns=true`;
  this.ws = new WebSocket(url);
  // ... rest of WebSocket setup
}
```

## Key Benefits

1. **Security**: API key never exposed to browser/renderer process
2. **Compatibility**: Works with browser WebSocket API limitations
3. **Official Pattern**: Matches AssemblyAI's recommended browser implementation
4. **Token Expiry**: Tokens expire after 10 minutes (max allowed), limiting exposure window

## Testing

To test the fix:

1. Compile: `npm run compile`
2. Run: `npm run dev`
3. Open Settings and configure AssemblyAI API key
4. Start recording with AssemblyAI transcription enabled
5. Verify WebSocket connects without 403 errors
6. Confirm transcription results appear in real-time

## References

- [AssemblyAI Browser Example](https://github.com/AssemblyAI/realtime-transcription-browser-js-example)
- [Universal Streaming API v3 Docs](https://www.assemblyai.com/docs/api-reference/streaming)
- [Browser WebSocket Limitations](docs/ASSEMBLYAI_BROWSER_LIMITATION.md)

## Related Files

- `src/main/main.ts` - Token generation endpoint
- `src/preload/preload.ts` - IPC bridge
- `src/shared/window.d.ts` - Type definitions
- `src/renderer/assemblyai-transcription-service.ts` - Browser-based service
- `docs/ASSEMBLYAI_BROWSER_LIMITATION.md` - Technical background
