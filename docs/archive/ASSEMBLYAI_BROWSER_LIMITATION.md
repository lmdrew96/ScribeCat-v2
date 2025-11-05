# AssemblyAI Browser WebSocket Limitation

## Issue
After multiple attempts to connect to AssemblyAI's Universal Streaming API v3 from the browser, all approaches result in 403 Forbidden errors:

1. ❌ Token in URL query parameter: `?token=${apiKey}`
2. ❌ API key as WebSocket subprotocol: `new WebSocket(url, [apiKey])`
3. ❌ API key in URL query parameter: `?api_key=${apiKey}`

## Root Cause
AssemblyAI's Universal Streaming API appears to require HTTP headers for authentication (specifically an `Authorization` header), which **browser WebSocket APIs do not support**. The browser's `WebSocket` constructor only accepts:
- URL
- Optional subprotocols (not the same as HTTP headers)

## Evidence
```javascript
// Browser WebSocket limitation:
const ws = new WebSocket(url);  // No way to add custom headers
const ws = new WebSocket(url, protocols);  // Protocols ≠ Headers
```

The Python SDK example shows it uses headers:
```python
headers = {"Authorization": api_key}
```

But browsers cannot set custom headers on WebSocket connections.

## Recommended Solutions

### Option 1: Use AssemblyAI's Official JavaScript SDK (Recommended)
AssemblyAI provides an official JavaScript SDK that handles authentication properly:

```bash
npm install assemblyai
```

```typescript
import { RealtimeTranscriber } from 'assemblyai';

const transcriber = new RealtimeTranscriber({
  apiKey: 'your-api-key',
  sampleRate: 16000
});

transcriber.on('transcript', (transcript) => {
  console.log(transcript.text);
});

await transcriber.connect();
// Send audio...
```

**Pros:**
- Official support
- Handles authentication correctly
- Maintained by AssemblyAI
- Works in browser

**Cons:**
- Adds dependency
- May increase bundle size

### Option 2: Proxy Through Main Process
Keep AssemblyAI in the main process where we can use Node.js libraries that support custom headers:

```typescript
// Main process can use 'ws' package with headers
const WebSocket = require('ws');
const ws = new WebSocket(url, {
  headers: {
    'Authorization': apiKey
  }
});
```

**Pros:**
- Full control over connection
- Can use Node.js WebSocket libraries with header support

**Cons:**
- IPC overhead
- More complex architecture
- The original 403 issue we tried to fix

### Option 3: Backend Proxy Server
Create a small proxy server that:
1. Accepts WebSocket connections from browser
2. Forwards to AssemblyAI with proper authentication
3. Relays messages back to browser

**Pros:**
- Keeps API key secure (not in browser)
- Full control

**Cons:**
- Requires running separate server
- Additional complexity
- Deployment overhead

## Recommendation

**Use Option 1: AssemblyAI's Official JavaScript SDK**

This is the cleanest solution that:
- ✅ Works in browser context
- ✅ Handles authentication properly
- ✅ Is officially supported
- ✅ Avoids IPC overhead
- ✅ Future-proof (maintained by AssemblyAI)

## Implementation with Official SDK

```typescript
// Install
npm install assemblyai

// src/renderer/assemblyai-transcription-service.ts
import { RealtimeTranscriber } from 'assemblyai';

export class AssemblyAITranscriptionService {
  private transcriber: RealtimeTranscriber | null = null;
  private resultCallback: ((text: string, isFinal: boolean) => void) | null = null;

  async initialize(apiKey: string): Promise<void> {
    this.transcriber = new RealtimeTranscriber({
      apiKey,
      sampleRate: 16000,
      encoding: 'pcm_s16le'
    });

    this.transcriber.on('transcript', (transcript) => {
      if (this.resultCallback) {
        this.resultCallback(
          transcript.text,
          transcript.message_type === 'FinalTranscript'
        );
      }
    });
  }

  async start(): Promise<string> {
    if (!this.transcriber) {
      throw new Error('Not initialized');
    }
    
    await this.transcriber.connect();
    return `assemblyai-${Date.now()}`;
  }

  sendAudio(audioData: ArrayBuffer): void {
    if (this.transcriber) {
      this.transcriber.sendAudio(audioData);
    }
  }

  onResult(callback: (text: string, isFinal: boolean) => void): void {
    this.resultCallback = callback;
  }

  async stop(): Promise<void> {
    if (this.transcriber) {
      await this.transcriber.close();
      this.transcriber = null;
    }
  }
}
```

## Conclusion

The 403 errors are due to browser WebSocket API limitations, not our implementation. The official AssemblyAI JavaScript SDK is the proper solution for browser-based real-time transcription.
