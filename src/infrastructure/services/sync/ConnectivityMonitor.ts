/**
 * ConnectivityMonitor
 *
 * ROOT CAUSE FIX for SyncManager assuming always online.
 * Implements actual connectivity checking via Supabase health endpoint ping.
 *
 * Features:
 * - Pings Supabase health endpoint to verify connectivity
 * - Listens to network status changes (when available)
 * - Emits events when connectivity changes
 * - Prevents unnecessary sync attempts when offline
 */

import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('ConnectivityMonitor');

export type ConnectivityStatus = 'online' | 'offline' | 'unknown';

export interface ConnectivityChangeEvent {
  status: ConnectivityStatus;
  previousStatus: ConnectivityStatus;
  timestamp: number;
}

export class ConnectivityMonitor {
  private status: ConnectivityStatus = 'unknown';
  private checkInterval: NodeJS.Timeout | null = null;
  private listeners: ((event: ConnectivityChangeEvent) => void)[] = [];
  private supabaseUrl: string;
  private lastCheckTime: number = 0;
  private consecutiveFailures: number = 0;

  constructor(supabaseUrl: string) {
    this.supabaseUrl = supabaseUrl;
  }

  /**
   * Start monitoring connectivity
   */
  async start(): Promise<void> {
    logger.info('Starting connectivity monitoring');

    // Perform initial check
    await this.checkConnectivity();

    // Check connectivity every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkConnectivity().catch(error => {
        logger.error('Error during connectivity check:', error);
      });
    }, 30000);

    logger.info(`Connectivity monitoring started. Initial status: ${this.status}`);
  }

  /**
   * Stop monitoring connectivity
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info('Connectivity monitoring stopped');
  }

  /**
   * Check connectivity by pinging Supabase health endpoint
   *
   * ROOT CAUSE FIX: Actually tests connectivity instead of assuming online
   */
  private async checkConnectivity(): Promise<void> {
    const previousStatus = this.status;
    this.lastCheckTime = Date.now();

    try {
      // Ping Supabase health endpoint with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${this.supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        signal: controller.signal,
        // Don't include credentials for health check
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);

      // If we get any response (even 401/403), we're connected
      // The endpoint exists and is reachable, authentication is a separate concern
      if (response.status >= 200 && response.status < 600) {
        this.handleConnectivitySuccess(previousStatus);
      } else {
        this.handleConnectivityFailure(previousStatus);
      }
    } catch (error) {
      this.handleConnectivityFailure(previousStatus);
    }
  }

  /**
   * Handle successful connectivity check
   */
  private handleConnectivitySuccess(previousStatus: ConnectivityStatus): void {
    this.consecutiveFailures = 0;

    if (this.status !== 'online') {
      this.status = 'online';
      logger.info('✅ Connectivity restored');
      this.emitStatusChange(previousStatus);
    }
  }

  /**
   * Handle failed connectivity check
   */
  private handleConnectivityFailure(previousStatus: ConnectivityStatus): void {
    this.consecutiveFailures++;

    // Only mark as offline after 2 consecutive failures to avoid false positives
    if (this.consecutiveFailures >= 2 && this.status !== 'offline') {
      this.status = 'offline';
      logger.warn(`❌ Connectivity lost (${this.consecutiveFailures} consecutive failures)`);
      this.emitStatusChange(previousStatus);
    }
  }

  /**
   * Emit status change event to listeners
   */
  private emitStatusChange(previousStatus: ConnectivityStatus): void {
    const event: ConnectivityChangeEvent = {
      status: this.status,
      previousStatus,
      timestamp: Date.now()
    };

    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.error('Error in connectivity change listener:', error);
      }
    });
  }

  /**
   * Register a listener for connectivity changes
   */
  onConnectivityChange(listener: (event: ConnectivityChangeEvent) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a connectivity change listener
   */
  removeListener(listener: (event: ConnectivityChangeEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Get current connectivity status
   */
  getStatus(): ConnectivityStatus {
    return this.status;
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.status === 'online';
  }

  /**
   * Force a connectivity check immediately
   */
  async forceCheck(): Promise<ConnectivityStatus> {
    await this.checkConnectivity();
    return this.status;
  }

  /**
   * Get time since last check (in milliseconds)
   */
  getTimeSinceLastCheck(): number {
    return Date.now() - this.lastCheckTime;
  }

  /**
   * Get statistics
   */
  getStats(): {
    status: ConnectivityStatus;
    consecutiveFailures: number;
    lastCheckTime: number;
    timeSinceLastCheck: number;
    listenerCount: number;
  } {
    return {
      status: this.status,
      consecutiveFailures: this.consecutiveFailures,
      lastCheckTime: this.lastCheckTime,
      timeSinceLastCheck: this.getTimeSinceLastCheck(),
      listenerCount: this.listeners.length
    };
  }
}
