/**
 * AssemblyAI Real-Time Transcription Service (Browser)
 * Runs directly in renderer process using browser WebSocket API
 * Uses Universal Streaming API
 */

export class AssemblyAITranscriptionService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private resultCallback: ((text: string, isFinal: boolean, timestamp?: number) => void) | null = null;
  private startTime: number = 0;
  private apiKey: string = '';
  private terminationReceived: boolean = false;
  private closeTimeout: NodeJS.Timeout | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private tokenCreatedAt: number = 0;
  private isRefreshing: boolean = false;

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
    this.tokenCreatedAt = Date.now();

    // Connect to AssemblyAI WebSocket with temp token
    await this.connectWebSocket(tempToken);

    // Set up token refresh timer (refresh after 8 minutes, token expires after 10 minutes)
    this.scheduleTokenRefresh();

    return this.sessionId;
  }

  private scheduleTokenRefresh(): void {
    // Clear any existing timer
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    // Schedule token refresh after 8 minutes (480 seconds)
    // Token expires after 10 minutes (600 seconds), so we refresh 2 minutes before expiration
    const refreshDelay = 8 * 60 * 1000; // 8 minutes in milliseconds

    this.tokenRefreshTimer = setTimeout(() => {
      this.refreshToken();
    }, refreshDelay);

    console.log('Token refresh scheduled for 8 minutes from now');
  }

  private async refreshToken(): Promise<void> {
    if (this.isRefreshing || !this.sessionId) {
      return;
    }

    console.log('🔄 Refreshing AssemblyAI token...');
    this.isRefreshing = true;

    try {
      // Get new token
      const newToken = await this.getTemporaryToken();
      this.tokenCreatedAt = Date.now();

      // Close old WebSocket gracefully
      const oldWs = this.ws;
      this.ws = null; // Prevent sending audio during transition

      if (oldWs) {
        oldWs.close();
      }

      // Connect with new token
      await this.connectWebSocket(newToken);
      console.log('✅ Token refreshed and reconnected successfully');

      // Schedule next refresh
      this.scheduleTokenRefresh();
    } catch (error) {
      console.error('❌ Failed to refresh token:', error);
      // If refresh fails, try again in 5 minutes
      setTimeout(() => this.refreshToken(), 5 * 60 * 1000);
    } finally {
      this.isRefreshing = false;
    }
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
      // Note: sample_rate and encoding are set via query params
      // format_turns enables Turn-based messages, format_words provides word-level timestamps
      const url = `wss://streaming.assemblyai.com/v3/ws?token=${encodeURIComponent(token)}&sample_rate=16000&encoding=pcm_s16le&format_turns=true&format_words=true`;

      console.log('🔗 Connecting to AssemblyAI WebSocket with word-level timestamps...');
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

        // If connection closes unexpectedly during active session (not during stop/refresh)
        // attempt to reconnect
        if (this.sessionId && !this.terminationReceived && !this.isRefreshing) {
          console.log('⚠️ Unexpected disconnection detected, attempting to reconnect...');
          this.handleUnexpectedDisconnection();
        }
      };
    });
  }

  private async handleUnexpectedDisconnection(): Promise<void> {
    // Don't reconnect if we're already stopping or refreshing
    if (!this.sessionId || this.terminationReceived || this.isRefreshing) {
      return;
    }

    try {
      console.log('🔄 Attempting to reconnect...');

      // Get a new token
      const newToken = await this.getTemporaryToken();
      this.tokenCreatedAt = Date.now();

      // Reconnect
      await this.connectWebSocket(newToken);
      console.log('✅ Reconnected successfully after unexpected disconnection');

      // Reschedule token refresh
      this.scheduleTokenRefresh();
    } catch (error) {
      console.error('❌ Failed to reconnect:', error);
      // Try again in 10 seconds
      setTimeout(() => this.handleUnexpectedDisconnection(), 10000);
    }
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

        // Use word-level timestamps for accuracy (words array excludes filler)
        // Fall back to audio_start if words not available
        let timestamp: number | undefined;
        if (message.words && Array.isArray(message.words) && message.words.length > 0) {
          // Use the first word's start time (already cleaned of filler)
          timestamp = message.words[0].start / 1000; // Convert ms to seconds
        } else if (message.audio_start !== undefined) {
          // Fallback to turn's audio_start
          timestamp = message.audio_start / 1000;
        }

        console.log('📊 AssemblyAI Turn:', {
          text: text?.substring(0, 50) + '...',
          isFinal,
          wordCount: message.words?.length,
          firstWordStart: message.words?.[0]?.start,
          audio_start_ms: message.audio_start,
          timestamp_seconds: timestamp,
          audio_end_ms: message.audio_end
        });

        if (text && text.trim().length > 0 && this.resultCallback) {
          this.resultCallback(text, isFinal, timestamp);
        }
      }

      if (message.type === 'Termination') {
        console.log('Session terminated:', message.audio_duration_seconds, 'seconds processed');
        this.terminationReceived = true;
        // Close the WebSocket after receiving termination confirmation
        this.closeWebSocket();
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

  onResult(callback: (text: string, isFinal: boolean, timestamp?: number) => void): void {
    this.resultCallback = callback;
  }

  stop(): void {
    // Clear token refresh timer
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }

    if (this.ws) {
      // Reset termination flag
      this.terminationReceived = false;

      // Send termination message
      this.ws.send(JSON.stringify({ type: 'Terminate' }));

      // Set a timeout to close the WebSocket if we don't receive termination confirmation
      // This gives AssemblyAI 5 seconds to send final transcription segments
      this.closeTimeout = setTimeout(() => {
        console.log('Termination timeout reached, closing WebSocket');
        this.closeWebSocket();
      }, 5000);
    } else {
      this.sessionId = null;
    }
  }

  private closeWebSocket(): void {
    // Clear any pending timers
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }

    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }

    // Close the WebSocket connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.sessionId = null;
    this.terminationReceived = false;
    this.isRefreshing = false;
  }

  isActive(): boolean {
    return this.sessionId !== null && this.ws !== null;
  }
}
