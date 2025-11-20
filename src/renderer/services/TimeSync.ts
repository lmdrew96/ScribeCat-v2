/**
 * TimeSync Service
 *
 * Synchronizes client clocks with server time to ensure fair timing in multiplayer games.
 * Uses Supabase server time as the authoritative source.
 *
 * Problem it solves:
 * - Different players have different system clocks (some ahead, some behind)
 * - This causes unfair quiz timing where one player sees "10 seconds" while another sees "8 seconds"
 * - Clock drift over time compounds the problem
 *
 * Solution:
 * - Fetch server time from Supabase on initialization
 * - Calculate offset between client clock and server clock
 * - Refresh offset periodically to handle drift
 * - Provide synchronized now() method for all game timers
 */

import { RendererSupabaseClient } from './RendererSupabaseClient.js';

export class TimeSync {
  private static instance: TimeSync;
  private offsetMs: number = 0; // Difference between server and client time
  private lastSyncTime: number = 0;
  private syncInterval: number | null = null;
  private readonly SYNC_INTERVAL_MS = 15000; // Re-sync every 15 seconds to handle drift

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): TimeSync {
    if (!TimeSync.instance) {
      TimeSync.instance = new TimeSync();
    }
    return TimeSync.instance;
  }

  /**
   * Initialize time synchronization with server
   */
  public async initialize(): Promise<void> {
    await this.syncWithServer();

    // Set up periodic re-sync to handle clock drift
    this.syncInterval = window.setInterval(() => {
      this.syncWithServer().catch((err) => {
        console.error('Failed to sync time:', err);
      });
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.syncInterval !== null) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Sync with server to calculate time offset
   */
  private async syncWithServer(): Promise<void> {
    const clientSendTime = Date.now();

    // Query Supabase to get server time
    // Using a simple query that returns server timestamp
    const supabase = RendererSupabaseClient.getInstance().getClient();
    const { data, error } = await supabase.rpc('get_server_time');

    const clientReceiveTime = Date.now();

    if (error) {
      console.error('Time sync error:', error);
      return;
    }

    if (!data) {
      console.error('No server time returned');
      return;
    }

    // Calculate round-trip time (network latency)
    const roundTripTime = clientReceiveTime - clientSendTime;
    const estimatedLatency = roundTripTime / 2;

    // Server time when the response was sent
    const serverTime = new Date(data).getTime();

    // Adjust for latency to estimate current server time
    const estimatedServerTime = serverTime + estimatedLatency;

    // Calculate offset (server time - client time)
    this.offsetMs = estimatedServerTime - clientReceiveTime;
    this.lastSyncTime = clientReceiveTime;

    console.log(
      `[TimeSync] Synced with server. Offset: ${this.offsetMs}ms, Latency: ${estimatedLatency.toFixed(1)}ms`
    );
  }

  /**
   * Get synchronized current time (in milliseconds since epoch)
   * Use this instead of Date.now() for all game timers
   */
  public now(): number {
    return Date.now() + this.offsetMs;
  }

  /**
   * Get time offset in milliseconds
   */
  public getOffset(): number {
    return this.offsetMs;
  }

  /**
   * Check if time sync is initialized
   */
  public isSynced(): boolean {
    return this.lastSyncTime > 0;
  }

  /**
   * Get time since last sync (for debugging)
   */
  public getTimeSinceLastSync(): number {
    return Date.now() - this.lastSyncTime;
  }
}
