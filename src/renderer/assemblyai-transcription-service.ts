/**
 * AssemblyAI Real-Time Transcription Service (Browser)
 * Runs directly in renderer process using browser WebSocket API
 * Uses Universal Streaming API
 *
 * ROOT CAUSE FIX: Now uses WebSocketErrorHandler for proper error categorization
 * and circuit breaker pattern to prevent infinite retry loops.
 */

import { WebSocketErrorHandler, CircuitState } from './utils/WebSocketErrorHandler.js';

export interface TranscriptionSettings {
  speechModel?: 'best' | 'nano';
  languageCode?: string;
  speakerLabels?: boolean;
  disfluencies?: boolean;
  punctuate?: boolean;
  formatText?: boolean;
  keyterms?: string[];  // Custom vocabulary for improved accuracy (max 100 terms, 5-50 chars each)
}

export interface TranscriptionError {
  type: 'AUTH_ERROR' | 'MAX_CONCURRENT_SESSIONS' | 'SESSION_EXPIRED' | 'TRANSMISSION_RATE' | 'UNKNOWN_ERROR';
  message: string;
  code?: number;
}

export interface TranscriptionWord {
  text: string;
  start: number;  // Start time in seconds
  end: number;    // End time in seconds
}

export class AssemblyAITranscriptionService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private resultCallback: ((text: string, isFinal: boolean, startTime?: number, endTime?: number, words?: TranscriptionWord[]) => void) | null = null;
  private errorCallback: ((error: TranscriptionError) => void) | null = null;
  private startTime: number = 0;
  private apiKey: string = '';
  private terminationReceived: boolean = false;
  private isStoppingIntentionally: boolean = false;
  private closeTimeout: NodeJS.Timeout | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private tokenCreatedAt: number = 0;
  private isRefreshing: boolean = false;
  private stopPromiseResolve: (() => void) | null = null;
  private settings: TranscriptionSettings = {};

  // Audio buffering for token refresh transitions
  private audioBuffer: ArrayBuffer[] = [];
  private maxBufferSize: number = 300; // Max audio chunks to buffer (~30 seconds at 100ms intervals)
  private lastTranscriptionTime: number = 0;
  private stalledCheckInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private droppedPacketCount: number = 0;

  // ROOT CAUSE FIX: Audio level monitoring to distinguish silence from stalled transcription
  private currentAudioLevel: number = 0;
  private readonly SILENCE_THRESHOLD = 0.01; // Below this level (0-1 range) is considered silence

  // Session duration limits (AssemblyAI enforces 3-hour max)
  private readonly MAX_SESSION_DURATION = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
  private readonly SESSION_WARNING_TIME = 2.75 * 60 * 60 * 1000; // 2h 45m (15 min warning)
  private sessionDurationWarningTimer: NodeJS.Timeout | null = null;

  // ROOT CAUSE FIX: Error categorization and circuit breaker
  private errorHandler: WebSocketErrorHandler = new WebSocketErrorHandler();

  // ROOT CAUSE FIX: Track timestamp offset across websocket reconnections
  // When token refresh creates a new websocket, AssemblyAI resets its timestamp counter to 0
  // We capture elapsed time as an offset to maintain absolute timestamps
  private timestampOffset: number = 0;

  async initialize(apiKey: string, settings?: TranscriptionSettings): Promise<void> {
    this.apiKey = apiKey;
    if (settings) {
      this.settings = settings;
    }
  }

  updateSettings(settings: TranscriptionSettings): void {
    this.settings = settings;
  }

  async start(): Promise<string> {
    if (this.sessionId) {
      throw new Error('Session already active');
    }

    // ROOT CAUSE FIX: Reset error handler for new session
    this.errorHandler.reset();
    this.droppedPacketCount = 0;
    this.audioBuffer = [];
    this.isStoppingIntentionally = false;
    this.timestampOffset = 0; // Reset offset for new session

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

    // Schedule session duration warning (15 minutes before 3-hour limit)
    this.scheduleSessionDurationWarning();

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
  }

  /**
   * Update the current audio level (called by TranscriptionModeService)
   * ROOT CAUSE FIX: This allows stalled detection to distinguish silence from actual failures
   */
  setAudioLevel(level: number): void {
    this.currentAudioLevel = level;
  }

  /**
   * Start periodic check for stalled transcription
   *
   * ROOT CAUSE FIX: Now checks audio level to distinguish silence from stalled transcription.
   * If there's actual audio but no transcription, that's a real problem.
   * If audio level is silent, no transcription is expected and normal.
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
        const isSilent = this.currentAudioLevel < this.SILENCE_THRESHOLD;

        if (isSilent) {
          // Audio is silent, so no transcription is expected - this is normal
          return;
        }

        // ROOT CAUSE FIX: Audio is NOT silent but no transcription received - this indicates a problem
        console.warn(`Audio detected but no transcription for ${Math.floor(timeSinceLastTranscription / 1000)}s - possible issue`);

        // Check if WebSocket is still connected
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          console.error('WebSocket disconnected, attempting recovery');
          this.handleUnexpectedDisconnection();
        } else {
          console.warn('WebSocket connected but not transcribing audio - may be server processing delay');
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

  /**
   * Schedule warning for approaching 3-hour session limit
   */
  private scheduleSessionDurationWarning(): void {
    // Clear any existing timer
    if (this.sessionDurationWarningTimer) {
      clearTimeout(this.sessionDurationWarningTimer);
    }

    // Schedule warning at 2h 45m (15 minutes before 3-hour limit)
    this.sessionDurationWarningTimer = setTimeout(() => {
      console.warn('Approaching 3-hour session limit! 15 minutes remaining before automatic disconnect.');
      this.handleError({
        type: 'UNKNOWN_ERROR',
        message: 'Approaching maximum session duration. Your session will automatically end in 15 minutes. Please save your work.',
        code: undefined
      });
    }, this.SESSION_WARNING_TIME);
  }

  private stopSessionDurationWarning(): void {
    if (this.sessionDurationWarningTimer) {
      clearTimeout(this.sessionDurationWarningTimer);
      this.sessionDurationWarningTimer = null;
    }
  }

  private async refreshToken(): Promise<void> {
    if (this.isRefreshing || !this.sessionId) {
      return;
    }

    this.isRefreshing = true;

    try {
      // Get new token
      const newToken = await this.getTemporaryToken();
      this.tokenCreatedAt = Date.now();

      // Keep old WebSocket reference
      const oldWs = this.ws;

      // ROOT CAUSE FIX: Capture elapsed time as offset before connecting new websocket
      // AssemblyAI will reset its timestamp counter for the new connection
      this.timestampOffset = (Date.now() - this.startTime) / 1000;
      console.log(`🔄 Token refresh: setting timestamp offset to ${this.timestampOffset.toFixed(1)}s`);

      // Connect new WebSocket BEFORE closing old one (seamless handoff)
      await this.connectWebSocket(newToken);

      // Now that new connection is established, close old one
      if (oldWs && oldWs !== this.ws) {
        oldWs.close();
      }

      // Flush any buffered audio packets
      this.flushAudioBuffer();

      // Reset reconnect attempts on successful refresh
      this.reconnectAttempts = 0;

      // Schedule next refresh
      this.scheduleTokenRefresh();
    } catch (error) {
      console.error('Failed to refresh token:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        // Exponential backoff: 5s, 10s, 20s
        const retryDelay = 5000 * Math.pow(2, this.reconnectAttempts - 1);
        setTimeout(() => this.refreshToken(), retryDelay);
      } else {
        console.error('Max reconnect attempts reached. Stopping session');
        // Clear buffer to prevent memory issues
        this.audioBuffer = [];

        // Notify about the error
        this.handleError({
          type: 'UNKNOWN_ERROR',
          message: 'Failed to maintain connection after multiple attempts. Session has been stopped.',
          code: undefined
        });

        // Properly stop the session
        this.sessionId = null;
        this.closeWebSocket();
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

      // Keyterms prompting: boost accuracy for custom vocabulary (BETA feature)
      if (this.settings.keyterms && this.settings.keyterms.length > 0) {
        // Validate keyterms: max 100 terms, 5-50 characters each
        const validKeyterms = this.settings.keyterms
          .filter(term => term.length >= 5 && term.length <= 50)
          .slice(0, 100);

        if (validKeyterms.length > 0) {
          params.append('keyterms_prompt', JSON.stringify(validKeyterms));
        }
      }

      const url = `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        // ROOT CAUSE FIX: Record success for circuit breaker
        this.errorHandler.recordSuccess();
        this.reconnectAttempts = 0; // Reset on successful connection
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('AssemblyAI WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        // ROOT CAUSE FIX: Use error handler to categorize and decide retry strategy
        const categorizedError = this.errorHandler.categorizeCloseEvent(event);

        // Check if this is an intentional shutdown with normal closure
        // Don't show error notification for expected closures
        // Code 1000 = Normal Closure, Code 1005 = No Status Received (also normal for some closures)
        const isExpectedClosure = (event.code === 1000 || event.code === 1005) && this.isStoppingIntentionally;

        // Check if this is the old WebSocket being closed during token refresh
        // (the new WebSocket is already connected, so this closure is expected)
        const isTokenRefreshClosure = this.isRefreshing && (event.code === 1000 || event.code === 1005);

        if (!isExpectedClosure && !isTokenRefreshClosure) {
          // Map to legacy error types for backward compatibility
          let errorType: TranscriptionError['type'] = 'UNKNOWN_ERROR';
          if (event.code === 1008) {
            if (event.reason.toLowerCase().includes('concurrent')) {
              errorType = 'MAX_CONCURRENT_SESSIONS';
            } else {
              errorType = 'AUTH_ERROR';
            }
          } else if (event.code === 3005) {
            if (event.reason.toLowerCase().includes('session expired')) {
              errorType = 'SESSION_EXPIRED';
            } else if (event.reason.toLowerCase().includes('transmission rate')) {
              errorType = 'TRANSMISSION_RATE';
            }
          }

          // Notify user with categorized error message (only for unexpected closures)
          this.handleError({
            type: errorType,
            message: categorizedError.userMessage,
            code: event.code
          });
        } else if (isTokenRefreshClosure) {
          console.log('🔄 Old WebSocket closed during token refresh (expected)');
        } else {
          console.log('✅ WebSocket closed normally after intentional stop');
        }

        // Decide whether to reconnect based on error category
        if (this.sessionId && !this.terminationReceived && !this.isRefreshing) {
          if (categorizedError.shouldRetry) {
            console.log(`♻️ Error is retryable (${categorizedError.category}), attempting reconnection...`);
            this.handleUnexpectedDisconnection(categorizedError.retryDelayMs);
          } else {
            console.error(`❌ Fatal error (${categorizedError.category}), cannot reconnect:`, categorizedError.technicalDetails);
            // Force circuit open for permanent errors
            if (categorizedError.category === 'permanent') {
              this.errorHandler.forceCircuitOpen();
            }
            // Clean up session
            this.sessionId = null;
            this.audioBuffer = [];
          }
        }

        // Reset the flag after handling closure
        this.isStoppingIntentionally = false;
      };
    });
  }

  /**
   * Handle unexpected disconnection with circuit breaker pattern
   *
   * ROOT CAUSE FIX: No longer blindly retries every 10 seconds.
   * Now uses circuit breaker to detect permanent failures and categorizes errors.
   */
  private async handleUnexpectedDisconnection(retryDelayMs: number = 0): Promise<void> {
    // Don't reconnect if we're already stopping or refreshing
    if (!this.sessionId || this.terminationReceived || this.isRefreshing) {
      return;
    }

    // ROOT CAUSE FIX: Check circuit breaker before attempting retry
    if (!this.errorHandler.shouldAttemptRetry()) {
      console.error('🔴 Circuit breaker OPEN: Too many failures, giving up reconnection attempts');
      this.handleError({
        type: 'UNKNOWN_ERROR',
        message: 'Connection failed after multiple attempts. Please check your network and try starting a new session.',
        code: undefined
      });
      this.sessionId = null;
      this.audioBuffer = [];
      return;
    }

    // Wait for specified delay before retrying (exponential backoff)
    if (retryDelayMs > 0) {
      console.log(`⏳ Waiting ${retryDelayMs / 1000}s before retry (circuit: ${this.errorHandler.getCircuitState()})...`);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }

    try {
      console.log(`🔄 Attempting to reconnect... (attempt ${this.errorHandler.getFailureCount() + 1}, circuit: ${this.errorHandler.getCircuitState()})`);

      // Get a new token
      const newToken = await this.getTemporaryToken();
      this.tokenCreatedAt = Date.now();

      // Reconnect
      await this.connectWebSocket(newToken);
      console.log('✅ Reconnected successfully after unexpected disconnection');

      // Reschedule token refresh
      this.scheduleTokenRefresh();

      // Flush buffered audio
      this.flushAudioBuffer();
    } catch (error) {
      console.error('❌ Failed to reconnect:', error);

      // ROOT CAUSE FIX: Categorize the connection error
      const categorizedError = this.errorHandler.categorizeConnectionError(error as Error);
      this.errorHandler.recordFailure();

      console.log(`📊 Connection error category: ${categorizedError.category}`, {
        shouldRetry: categorizedError.shouldRetry,
        retryDelay: categorizedError.retryDelayMs,
        failureCount: this.errorHandler.getFailureCount(),
        circuitState: this.errorHandler.getCircuitState()
      });

      if (categorizedError.shouldRetry) {
        // Retry with categorized delay
        this.handleUnexpectedDisconnection(categorizedError.retryDelayMs);
      } else {
        // Permanent error, stop trying
        console.error(`❌ Permanent error detected, stopping reconnection attempts:`, categorizedError.technicalDetails);
        this.handleError({
          type: 'AUTH_ERROR',
          message: categorizedError.userMessage,
          code: undefined
        });
        this.sessionId = null;
        this.audioBuffer = [];
      }
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

        // Extract word-level timestamps for interactive features (click-to-seek, word highlighting)
        let words: TranscriptionWord[] | undefined;
        if (message.words && Array.isArray(message.words) && message.words.length > 0) {
          words = message.words.map((w: any) => ({
            text: w.text,
            start: w.start / 1000 + this.timestampOffset,  // Convert ms to seconds + offset
            end: w.end / 1000 + this.timestampOffset       // Convert ms to seconds + offset
          }));
        }

        // ROOT CAUSE FIX: Apply timestamp offset for reconnection handling
        // After websocket reconnection, AssemblyAI resets timestamps to 0
        // Adding offset maintains absolute position in the recording
        if (startTime !== undefined) {
          startTime += this.timestampOffset;
        }
        if (endTime !== undefined) {
          endTime += this.timestampOffset;
        }

        console.log('📊 AssemblyAI Turn:', {
          text: text?.substring(0, 50) + '...',
          isFinal,
          wordCount: message.words?.length,
          rawAudioStart_ms: message.audio_start,
          rawAudioEnd_ms: message.audio_end,
          timestampOffset: this.timestampOffset,
          adjustedStartTime: startTime,
          adjustedEndTime: endTime
        });

        if (text && text.trim().length > 0 && this.resultCallback) {
          this.resultCallback(text, isFinal, startTime, endTime, words);
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

      // Reset dropped packet count on successful send
      if (this.droppedPacketCount > 0) {
        console.log(`ℹ️ Connection recovered. Previously dropped ${this.droppedPacketCount} packets (~${(this.droppedPacketCount * 0.1).toFixed(1)}s of audio)`);
        this.droppedPacketCount = 0;
      }
    } else if (this.isRefreshing && this.audioBuffer.length < this.maxBufferSize) {
      // Buffer audio during token refresh to prevent data loss
      this.audioBuffer.push(audioData);
      if (this.audioBuffer.length === 1) {
        console.log('🔄 WebSocket not ready, buffering audio packets during token refresh...');
      }
    } else if (this.audioBuffer.length >= this.maxBufferSize) {
      // ROOT CAUSE FIX LIMITATION: Buffer full - this indicates token refresh is taking too long
      // Ideally we would pause audio capture, but that requires complex state coordination
      // between services. Instead, we track dropped packets and warn the user.
      this.droppedPacketCount++;

      if (this.droppedPacketCount === 1) {
        console.error('❌ Audio buffer full! Token refresh taking longer than expected.');
        console.error('⚠️ Dropping audio packets - transcription gaps may occur.');
      } else if (this.droppedPacketCount % 50 === 0) {
        // Log every 50 dropped packets (~5 seconds)
        console.error(`❌ Dropped ${this.droppedPacketCount} packets so far (~${(this.droppedPacketCount * 0.1).toFixed(1)}s of audio)`);
      }

      // Notify user if we're dropping significant audio
      if (this.droppedPacketCount === 50) { // ~5 seconds of audio
        this.handleError({
          type: 'UNKNOWN_ERROR',
          message: 'Connection refresh taking longer than expected. Some audio may not be transcribed.',
          code: undefined
        });
      }
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

  onResult(callback: (text: string, isFinal: boolean, startTime?: number, endTime?: number, words?: TranscriptionWord[]) => void): void {
    this.resultCallback = callback;
  }

  /**
   * Register callback for transcription errors
   */
  onError(callback: (error: TranscriptionError) => void): void {
    this.errorCallback = callback;
  }

  /**
   * Handle transcription errors by logging and notifying callbacks
   */
  private handleError(error: TranscriptionError): void {
    console.error(`🚨 Transcription Error [${error.type}]:`, error.message);
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }

  async stop(): Promise<void> {
    // Clear token refresh timer
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }

    // Stop stalled transcription check
    this.stopStalledCheck();

    // Stop session duration warning
    this.stopSessionDurationWarning();

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

      // Set flag to indicate intentional shutdown (prevents error notification on close)
      this.isStoppingIntentionally = true;

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

    // Stop session duration warning
    this.stopSessionDurationWarning();

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
