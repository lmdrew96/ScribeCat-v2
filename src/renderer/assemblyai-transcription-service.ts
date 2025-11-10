/**
 * AssemblyAI Real-Time Transcription Service (Browser)
 * Runs directly in renderer process using browser WebSocket API
 * Uses Universal Streaming API
 */

export interface TranscriptionSettings {
  speechModel?: 'best' | 'nano';
  languageCode?: string;
  speakerLabels?: boolean;
  disfluencies?: boolean;
  punctuate?: boolean;
  formatText?: boolean;
}

export class AssemblyAITranscriptionService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private resultCallback: ((text: string, isFinal: boolean, startTime?: number, endTime?: number) => void) | null = null;
  private startTime: number = 0;
  private apiKey: string = '';
  private terminationReceived: boolean = false;
  private closeTimeout: NodeJS.Timeout | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private tokenCreatedAt: number = 0;
  private isRefreshing: boolean = false;
  private stopPromiseResolve: (() => void) | null = null;
  private settings: TranscriptionSettings = {};

  // Audio buffering for token refresh transitions
  private audioBuffer: ArrayBuffer[] = [];
  private maxBufferSize: number = 100; // Max audio chunks to buffer (prevent memory issues)
  private lastTranscriptionTime: number = 0;
  private stalledCheckInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;

  async initialize(apiKey: string, settings?: TranscriptionSettings): Promise<void> {
    this.apiKey = apiKey;
    if (settings) {
      this.settings = settings;
    }
    console.log('AssemblyAI service initialized with settings:', this.settings);
  }

  updateSettings(settings: TranscriptionSettings): void {
    this.settings = settings;
    console.log('AssemblyAI settings updated:', this.settings);
  }

  async start(): Promise<string> {
    if (this.sessionId) {
      throw new Error('Session already active');
    }

    this.sessionId = `assemblyai-${Date.now()}`;
    this.startTime = Date.now();
    this.lastTranscriptionTime = Date.now();

    // Get temporary token from main process (which can use Authorization headers)
    const tempToken = await this.getTemporaryToken();
    this.tokenCreatedAt = Date.now();

    // Connect to AssemblyAI WebSocket with temp token
    await this.connectWebSocket(tempToken);

    // Set up token refresh timer (refresh after 8 minutes, token expires after 10 minutes)
    this.scheduleTokenRefresh();

    // Start monitoring for stalled transcription
    this.startStalledCheck();

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

  /**
   * Start periodic check for stalled transcription
   * If no transcription received for 30 seconds, attempt recovery
   */
  private startStalledCheck(): void {
    // Clear any existing interval
    if (this.stalledCheckInterval) {
      clearInterval(this.stalledCheckInterval);
    }

    // Check every 15 seconds
    this.stalledCheckInterval = setInterval(() => {
      const timeSinceLastTranscription = Date.now() - this.lastTranscriptionTime;
      const thirtySeconds = 30 * 1000;

      // Only consider it stalled if we're not already refreshing and session is active
      if (timeSinceLastTranscription > thirtySeconds && !this.isRefreshing && this.sessionId) {
        console.warn(`⚠️ No transcription received for ${Math.floor(timeSinceLastTranscription / 1000)}s, checking connection...`);

        // Check if WebSocket is still connected
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          console.error('❌ WebSocket disconnected, attempting recovery...');
          this.handleUnexpectedDisconnection();
        } else {
          console.log('✅ WebSocket connected, may be silence or processing delay');
        }
      }
    }, 15000); // Check every 15 seconds
  }

  private stopStalledCheck(): void {
    if (this.stalledCheckInterval) {
      clearInterval(this.stalledCheckInterval);
      this.stalledCheckInterval = null;
    }
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

      // Keep old WebSocket reference
      const oldWs = this.ws;

      // Connect new WebSocket BEFORE closing old one (seamless handoff)
      console.log('🔗 Establishing new WebSocket connection...');
      await this.connectWebSocket(newToken);
      console.log('✅ New WebSocket connected, closing old connection...');

      // Now that new connection is established, close old one
      if (oldWs && oldWs !== this.ws) {
        oldWs.close();
      }

      // Flush any buffered audio packets
      this.flushAudioBuffer();

      console.log('✅ Token refreshed and reconnected successfully');

      // Reset reconnect attempts on successful refresh
      this.reconnectAttempts = 0;

      // Schedule next refresh
      this.scheduleTokenRefresh();
    } catch (error) {
      console.error('❌ Failed to refresh token:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        // Exponential backoff: 5s, 10s, 20s
        const retryDelay = 5000 * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`⏳ Retry attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${retryDelay / 1000}s...`);
        setTimeout(() => this.refreshToken(), retryDelay);
      } else {
        console.error('❌ Max reconnect attempts reached. Transcription may be lost.');
        // Clear buffer to prevent memory issues
        this.audioBuffer = [];
      }
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
      // Build WebSocket URL with advanced parameters
      const params = new URLSearchParams({
        token: token,
        sample_rate: '16000',
        encoding: 'pcm_s16le',
        format_turns: 'true',
        format_words: 'true'
      });

      // Add advanced parameters based on settings
      // NOTE: speech_model is not supported in v3 WebSocket API
      // if (this.settings.speechModel) {
      //   params.append('speech_model', this.settings.speechModel);
      // }
      if (this.settings.languageCode) {
        params.append('language_code', this.settings.languageCode);
      }
      if (this.settings.speakerLabels !== undefined) {
        params.append('speaker_labels', String(this.settings.speakerLabels));
      }
      if (this.settings.disfluencies !== undefined) {
        params.append('disfluencies', String(this.settings.disfluencies));
      }
      if (this.settings.punctuate !== undefined) {
        params.append('punctuate', String(this.settings.punctuate));
      }
      if (this.settings.formatText !== undefined) {
        params.append('format_text', String(this.settings.formatText));
      }

      const url = `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`;

      console.log('🔗 Connecting to AssemblyAI WebSocket with advanced settings:', this.settings);
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
        // Update last transcription time for stalled detection
        this.lastTranscriptionTime = Date.now();

        const text = message.transcript;
        const isFinal = message.end_of_turn && message.turn_is_formatted;

        // Extract start time - use word-level timestamps for accuracy (words array excludes filler)
        // Fall back to audio_start if words not available
        let startTime: number | undefined;
        if (message.words && Array.isArray(message.words) && message.words.length > 0) {
          // Use the first word's start time (already cleaned of filler)
          startTime = message.words[0].start / 1000; // Convert ms to seconds
        } else if (message.audio_start !== undefined) {
          // Fallback to turn's audio_start
          startTime = message.audio_start / 1000;
        }

        // Extract end time - use word-level timestamps for accuracy
        // Fall back to audio_end if words not available
        let endTime: number | undefined;
        if (message.words && Array.isArray(message.words) && message.words.length > 0) {
          // Use the last word's end time
          const lastWord = message.words[message.words.length - 1];
          endTime = lastWord.end / 1000; // Convert ms to seconds
        } else if (message.audio_end !== undefined) {
          // Fallback to turn's audio_end
          endTime = message.audio_end / 1000;
        }

        console.log('📊 AssemblyAI Turn:', {
          text: text?.substring(0, 50) + '...',
          isFinal,
          wordCount: message.words?.length,
          firstWordStart: message.words?.[0]?.start,
          lastWordEnd: message.words?.[message.words.length - 1]?.end,
          audio_start_ms: message.audio_start,
          audio_end_ms: message.audio_end,
          startTime_seconds: startTime,
          endTime_seconds: endTime
        });

        if (text && text.trim().length > 0 && this.resultCallback) {
          this.resultCallback(text, isFinal, startTime, endTime);
        }
      }

      if (message.type === 'Termination') {
        console.log('Session terminated:', message.audio_duration_seconds, 'seconds processed');
        this.terminationReceived = true;

        // Resolve the stop promise if waiting
        if (this.stopPromiseResolve) {
          this.stopPromiseResolve();
          this.stopPromiseResolve = null;
        }

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
    } else if (this.isRefreshing && this.audioBuffer.length < this.maxBufferSize) {
      // Buffer audio during token refresh to prevent data loss
      this.audioBuffer.push(audioData);
      if (this.audioBuffer.length === 1) {
        console.log('🔄 WebSocket not ready, buffering audio packets during token refresh...');
      }
    } else if (this.audioBuffer.length >= this.maxBufferSize) {
      console.warn('⚠️ Audio buffer full, dropping packets. This may indicate a connection issue.');
    }
  }

  /**
   * Flush buffered audio packets to the WebSocket
   * Called after successful reconnection during token refresh
   */
  private flushAudioBuffer(): void {
    if (this.audioBuffer.length === 0) {
      return;
    }

    console.log(`📤 Flushing ${this.audioBuffer.length} buffered audio packets...`);

    let successfulSends = 0;
    while (this.audioBuffer.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const audioData = this.audioBuffer.shift()!;
      this.ws.send(audioData);
      successfulSends++;
    }

    console.log(`✅ Flushed ${successfulSends} audio packets successfully`);

    // Clear any remaining buffer if WebSocket closed during flush
    if (this.audioBuffer.length > 0) {
      console.warn(`⚠️ ${this.audioBuffer.length} packets remain in buffer (WebSocket closed during flush)`);
      this.audioBuffer = [];
    }
  }

  onResult(callback: (text: string, isFinal: boolean, startTime?: number, endTime?: number) => void): void {
    this.resultCallback = callback;
  }

  async stop(): Promise<void> {
    // Clear token refresh timer
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }

    // Stop stalled transcription check
    this.stopStalledCheck();

    if (this.ws) {
      // Create a promise that resolves when termination is received
      const terminationPromise = new Promise<void>((resolve) => {
        this.stopPromiseResolve = resolve;

        // Set a timeout to resolve anyway if we don't receive termination confirmation
        // This gives AssemblyAI 5 seconds to send final transcription segments
        this.closeTimeout = setTimeout(() => {
          console.log('⏱️ Termination timeout reached (5s), closing WebSocket');
          if (this.stopPromiseResolve) {
            this.stopPromiseResolve();
            this.stopPromiseResolve = null;
          }
          this.closeWebSocket();
        }, 5000);
      });

      // Reset termination flag
      this.terminationReceived = false;

      // Send termination message
      this.ws.send(JSON.stringify({ type: 'Terminate' }));
      console.log('📤 Sent termination message, waiting for final results...');

      // Wait for termination message or timeout
      await terminationPromise;
      console.log('✅ AssemblyAI stop complete, all final results received');
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

    // Stop stalled check
    this.stopStalledCheck();

    // Close the WebSocket connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Clear audio buffer
    this.audioBuffer = [];

    this.sessionId = null;
    this.terminationReceived = false;
    this.isRefreshing = false;
    this.reconnectAttempts = 0;
  }

  isActive(): boolean {
    return this.sessionId !== null && this.ws !== null;
  }
}
