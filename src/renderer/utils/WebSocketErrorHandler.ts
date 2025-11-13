/**
 * WebSocketErrorHandler
 *
 * ROOT CAUSE FIX for blind WebSocket reconnection.
 * Properly categorizes errors and implements retry strategies based on error type.
 *
 * Error Categories:
 * - TRANSIENT: Network issues, temporary server problems (retry with backoff)
 * - PERMANENT: Auth failures, invalid API keys (don't retry, notify user)
 * - RATE_LIMIT: Too many requests (retry with longer backoff, respect retry-after)
 * - SERVER_ERROR: Server-side issues (retry with longer backoff, fewer attempts)
 */

export enum WebSocketErrorCategory {
  TRANSIENT = 'transient',        // Network errors, timeouts - safe to retry
  PERMANENT = 'permanent',         // Auth errors, invalid config - don't retry
  RATE_LIMIT = 'rate_limit',      // Rate limiting - retry with longer backoff
  SERVER_ERROR = 'server_error',  // Server issues - retry with caution
  UNKNOWN = 'unknown'              // Can't determine - treat as transient but limit retries
}

export interface CategorizedError {
  category: WebSocketErrorCategory;
  shouldRetry: boolean;
  retryDelayMs: number;
  userMessage: string;
  technicalDetails: string;
}

/**
 * Circuit Breaker states for connection management
 */
export enum CircuitState {
  CLOSED = 'closed',      // Normal operation, connection working
  OPEN = 'open',          // Too many failures, stop trying
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export class WebSocketErrorHandler {
  private failureCount: number = 0;
  private circuitState: CircuitState = CircuitState.CLOSED;
  private lastFailureTime: number = 0;
  private consecutiveSuccesses: number = 0;

  // Circuit breaker thresholds
  private readonly FAILURE_THRESHOLD = 5;           // Open circuit after 5 failures
  private readonly SUCCESS_THRESHOLD = 2;           // Close circuit after 2 successes in half-open
  private readonly RESET_TIMEOUT_MS = 60000;       // Try half-open after 1 minute
  private readonly BASE_RETRY_DELAY_MS = 2000;     // Base delay: 2 seconds

  /**
   * Categorize WebSocket close event
   */
  categorizeCloseEvent(event: CloseEvent): CategorizedError {
    const code = event.code;
    const reason = event.reason.toLowerCase();

    // 1008: Policy Violation (usually auth/API key issues)
    if (code === 1008) {
      if (reason.includes('concurrent')) {
        return {
          category: WebSocketErrorCategory.RATE_LIMIT,
          shouldRetry: false,
          retryDelayMs: 0,
          userMessage: 'You have too many active transcription sessions. Please close other sessions and try again.',
          technicalDetails: `WebSocket closed: ${code} - ${event.reason}`
        };
      } else if (reason.includes('balance') || reason.includes('quota')) {
        return {
          category: WebSocketErrorCategory.PERMANENT,
          shouldRetry: false,
          retryDelayMs: 0,
          userMessage: 'Your AssemblyAI account has insufficient balance or exceeded quota. Please check your account.',
          technicalDetails: `WebSocket closed: ${code} - ${event.reason}`
        };
      } else {
        return {
          category: WebSocketErrorCategory.PERMANENT,
          shouldRetry: false,
          retryDelayMs: 0,
          userMessage: 'Authentication failed. Please check your API key.',
          technicalDetails: `WebSocket closed: ${code} - ${event.reason}`
        };
      }
    }

    // 3005: Session/Protocol errors (AssemblyAI specific)
    if (code === 3005) {
      if (reason.includes('session expired')) {
        return {
          category: WebSocketErrorCategory.PERMANENT,
          shouldRetry: false,
          retryDelayMs: 0,
          userMessage: 'Session expired. Maximum session duration (3 hours) reached.',
          technicalDetails: `WebSocket closed: ${code} - ${event.reason}`
        };
      } else if (reason.includes('transmission rate')) {
        return {
          category: WebSocketErrorCategory.RATE_LIMIT,
          shouldRetry: false,
          retryDelayMs: 0,
          userMessage: 'Audio transmission rate too high. Please check your audio settings.',
          technicalDetails: `WebSocket closed: ${code} - ${event.reason}`
        };
      }
    }

    // 1000: Normal closure (not an error)
    if (code === 1000) {
      return {
        category: WebSocketErrorCategory.TRANSIENT,
        shouldRetry: false,
        retryDelayMs: 0,
        userMessage: 'Connection closed normally.',
        technicalDetails: 'Normal closure'
      };
    }

    // 1001: Going away (server shutting down)
    // 1011: Server error
    if (code === 1001 || code === 1011) {
      return {
        category: WebSocketErrorCategory.SERVER_ERROR,
        shouldRetry: true,
        retryDelayMs: this.calculateBackoffDelay(this.failureCount, 10000), // Longer backoff
        userMessage: 'Server temporarily unavailable. Will retry automatically.',
        technicalDetails: `WebSocket closed: ${code} - Server error`
      };
    }

    // 1006: Abnormal closure (network issues)
    // 1015: TLS handshake failure
    if (code === 1006 || code === 1015) {
      return {
        category: WebSocketErrorCategory.TRANSIENT,
        shouldRetry: true,
        retryDelayMs: this.calculateBackoffDelay(this.failureCount, this.BASE_RETRY_DELAY_MS),
        userMessage: 'Connection lost. Reconnecting automatically...',
        technicalDetails: `WebSocket closed: ${code} - Network error`
      };
    }

    // 429: Too Many Requests (if server sends it)
    if (code === 429) {
      return {
        category: WebSocketErrorCategory.RATE_LIMIT,
        shouldRetry: true,
        retryDelayMs: 30000, // Wait 30 seconds for rate limits
        userMessage: 'Rate limit exceeded. Will retry in 30 seconds.',
        technicalDetails: `WebSocket closed: ${code} - Rate limited`
      };
    }

    // Unknown/unexpected codes
    return {
      category: WebSocketErrorCategory.UNKNOWN,
      shouldRetry: this.failureCount < 3, // Limit retries for unknown errors
      retryDelayMs: this.calculateBackoffDelay(this.failureCount, this.BASE_RETRY_DELAY_MS),
      userMessage: 'Connection error. Attempting to reconnect...',
      technicalDetails: `WebSocket closed: ${code} - ${event.reason || 'Unknown reason'}`
    };
  }

  /**
   * Categorize connection errors (before WebSocket is established)
   */
  categorizeConnectionError(error: Error): CategorizedError {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes('network') || message.includes('timeout') || message.includes('enotfound')) {
      return {
        category: WebSocketErrorCategory.TRANSIENT,
        shouldRetry: true,
        retryDelayMs: this.calculateBackoffDelay(this.failureCount, this.BASE_RETRY_DELAY_MS),
        userMessage: 'Network error. Reconnecting automatically...',
        technicalDetails: error.message
      };
    }

    // Token/auth errors
    if (message.includes('token') || message.includes('auth') || message.includes('unauthorized')) {
      return {
        category: WebSocketErrorCategory.PERMANENT,
        shouldRetry: false,
        retryDelayMs: 0,
        userMessage: 'Authentication failed. Please check your API key.',
        technicalDetails: error.message
      };
    }

    // Unknown error
    return {
      category: WebSocketErrorCategory.UNKNOWN,
      shouldRetry: this.failureCount < 3,
      retryDelayMs: this.calculateBackoffDelay(this.failureCount, this.BASE_RETRY_DELAY_MS),
      userMessage: 'Connection failed. Attempting to reconnect...',
      technicalDetails: error.message
    };
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attemptNumber: number, baseDelay: number): number {
    // Exponential backoff: baseDelay * 2^attempt
    // Max delay: 60 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attemptNumber), 60000);
    return delay;
  }

  /**
   * Check if circuit breaker should allow a retry
   */
  shouldAttemptRetry(): boolean {
    if (this.circuitState === CircuitState.OPEN) {
      // Check if enough time has passed to try half-open
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure >= this.RESET_TIMEOUT_MS) {
        this.circuitState = CircuitState.HALF_OPEN;
        console.log('🔧 Circuit breaker: OPEN → HALF_OPEN (testing connection)');
        return true;
      }
      console.log('🚫 Circuit breaker OPEN: Not attempting retry');
      return false;
    }

    return true; // CLOSED or HALF_OPEN allow retries
  }

  /**
   * Record a failure and update circuit breaker state
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.consecutiveSuccesses = 0;

    if (this.circuitState === CircuitState.HALF_OPEN) {
      // Failed during half-open test, go back to OPEN
      this.circuitState = CircuitState.OPEN;
      console.log(`🔴 Circuit breaker: HALF_OPEN → OPEN (failure count: ${this.failureCount})`);
    } else if (this.failureCount >= this.FAILURE_THRESHOLD && this.circuitState === CircuitState.CLOSED) {
      // Too many failures, open the circuit
      this.circuitState = CircuitState.OPEN;
      console.log(`🔴 Circuit breaker: CLOSED → OPEN (${this.failureCount} failures)`);
    }
  }

  /**
   * Record a success and update circuit breaker state
   */
  recordSuccess(): void {
    this.consecutiveSuccesses++;

    if (this.circuitState === CircuitState.HALF_OPEN) {
      if (this.consecutiveSuccesses >= this.SUCCESS_THRESHOLD) {
        // Success during half-open, close the circuit
        this.reset();
        console.log('🟢 Circuit breaker: HALF_OPEN → CLOSED (connection recovered)');
      }
    } else if (this.circuitState === CircuitState.CLOSED) {
      // Normal operation, reset failure count
      this.failureCount = 0;
    }
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.failureCount = 0;
    this.consecutiveSuccesses = 0;
    this.circuitState = CircuitState.CLOSED;
    this.lastFailureTime = 0;
  }

  /**
   * Get current circuit breaker state
   */
  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Force circuit open (for permanent errors)
   */
  forceCircuitOpen(): void {
    this.circuitState = CircuitState.OPEN;
    this.lastFailureTime = Date.now();
    console.log('🔴 Circuit breaker: FORCED OPEN (permanent error detected)');
  }
}
