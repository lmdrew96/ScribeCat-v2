/**
 * AssemblyAI Real-Time Transcription Service (Browser)
 * Runs directly in renderer process using browser WebSocket API
 * Uses Universal Streaming API
 */

export class AssemblyAITranscriptionService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private resultCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private startTime: number = 0;
  private apiKey: string = '';

  async initialize(apiKey: string): Promise<void> {
    this.apiKey = apiKey;
    console.log('AssemblyAI service initialized');
  }

  async start(): Promise<string> {
    if (this.sessionId) {
      throw new Error('Session already active');
    }

    this.sessionId = `assemblyai-${Date.now()}`;
    this.startTime = Date.now();

    // Get temporary token from main process (which can use Authorization headers)
    const tempToken = await this.getTemporaryToken();
    
    // Connect to AssemblyAI WebSocket with temp token
    await this.connectWebSocket(tempToken);

    return this.sessionId;
  }

  private async getTemporaryToken(): Promise<string> {
    // Request temp token from main process
    const result = await window.scribeCat.transcription.assemblyai.getToken(this.apiKey);
    if (!result.success || !result.token) {
      throw new Error(result.error || 'Failed to get temporary token');
    }
    return result.token;
  }

  private async connectWebSocket(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use browser's native WebSocket API with temporary token
      // Note: sample_rate and encoding are set via query params, format_turns enables Turn-based messages
      const url = `wss://streaming.assemblyai.com/v3/ws?token=${encodeURIComponent(token)}&sample_rate=16000&encoding=pcm_s16le&format_turns=true`;
      
      console.log('🔗 Connecting to AssemblyAI WebSocket...');
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('✅ AssemblyAI WebSocket connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('❌ AssemblyAI WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log('AssemblyAI WebSocket closed:', event.code, event.reason);
      };
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'Begin') {
        console.log('🎙️ AssemblyAI session began:', message.id);
        return;
      }

      if (message.type === 'Turn') {
        const text = message.transcript;
        const isFinal = message.end_of_turn && message.turn_is_formatted;
        
        if (text && text.trim().length > 0 && this.resultCallback) {
          this.resultCallback(text, isFinal);
        }
      }

      if (message.type === 'Termination') {
        console.log('Session terminated:', message.audio_duration_seconds, 'seconds processed');
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  sendAudio(audioData: ArrayBuffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Universal Streaming expects raw PCM audio data (not base64)
      this.ws.send(audioData);
    }
  }

  onResult(callback: (text: string, isFinal: boolean) => void): void {
    this.resultCallback = callback;
  }

  stop(): void {
    if (this.ws) {
      // Send termination message
      this.ws.send(JSON.stringify({ type: 'Terminate' }));
      this.ws.close();
      this.ws = null;
    }
    this.sessionId = null;
  }

  isActive(): boolean {
    return this.sessionId !== null && this.ws !== null;
  }
}
