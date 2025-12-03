/**
 * FriendsPresenceTracker
 *
 * Handles presence tracking: online status, heartbeat, activity updates.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { createLogger } from '../../../../shared/logger.js';
import type { FriendData } from '../../../../domain/entities/Friend.js';
import { RendererSupabaseClient } from '../../../services/RendererSupabaseClient.js';

const logger = createLogger('FriendsPresenceTracker');

export interface PresenceTrackerCallbacks {
  getCurrentUserId: () => string | null;
  getFriends: () => FriendData[];
  updateFriends: (updater: (friends: FriendData[]) => FriendData[]) => void;
  notifyFriendsListeners: () => void;
}

export class FriendsPresenceTracker {
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 30000;
  private presenceChannel: RealtimeChannel | null = null;
  private callbacks: PresenceTrackerCallbacks;

  constructor(callbacks: PresenceTrackerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Start presence tracking for the current user
   */
  async startPresenceTracking(): Promise<void> {
    const userId = this.callbacks.getCurrentUserId();
    if (!userId) {
      logger.warn('Cannot start presence tracking: No user ID');
      return;
    }

    try {
      await this.updatePresence('online');

      this.heartbeatInterval = setInterval(async () => {
        try {
          await this.updatePresence('online');
        } catch (error) {
          logger.error('Heartbeat presence update failed:', error);
        }
      }, this.HEARTBEAT_INTERVAL_MS);

      await this.subscribeToPresenceUpdates();
      logger.info('Presence tracking started');
    } catch (error) {
      logger.error('Failed to start presence tracking:', error);
    }
  }

  /**
   * Stop presence tracking
   */
  async stopPresenceTracking(): Promise<void> {
    try {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      if (this.callbacks.getCurrentUserId()) {
        await this.updatePresence('offline');
      }

      if (this.presenceChannel) {
        logger.info('🔒 FriendsPresenceTracker: Unsubscribing from presence channel');
        const rendererClient = RendererSupabaseClient.getInstance();
        const client = rendererClient.getClient();

        this.presenceChannel.unsubscribe();
        if (client) {
          client.removeChannel(this.presenceChannel);
        }
        this.presenceChannel = null;
      }

      logger.info('Presence tracking stopped');
    } catch (error) {
      logger.error('Failed to stop presence tracking:', error);
    }
  }

  /**
   * Update current user's presence status
   */
  async updatePresence(status: 'online' | 'away' | 'offline', activity?: string): Promise<void> {
    const userId = this.callbacks.getCurrentUserId();
    if (!userId) return;

    try {
      const result = await window.scribeCat.friends.updatePresence({
        userId,
        status,
        activity,
      });

      if (!result.success) {
        logger.error('Failed to update presence:', result.error);
      }
    } catch (error) {
      logger.error('Exception updating presence:', error);
    }
  }

  /**
   * Set user activity status
   */
  async setActivity(activity: string | undefined): Promise<void> {
    await this.updatePresence('online', activity);
  }

  /**
   * Load friends' presence data
   */
  async loadFriendsPresence(): Promise<void> {
    const userId = this.callbacks.getCurrentUserId();
    if (!userId) return;

    try {
      const result = await window.scribeCat.friends.getFriendsPresence(userId);

      if (result.success && result.presence) {
        this.updateFriendsWithPresence(result.presence);
      }
    } catch (error) {
      logger.error('Failed to load friends presence:', error);
    }
  }

  /**
   * Subscribe to real-time presence updates from friends
   */
  private async subscribeToPresenceUpdates(): Promise<void> {
    const userId = this.callbacks.getCurrentUserId();
    if (!userId) return;

    try {
      logger.info('📡 FriendsPresenceTracker: Setting up direct Supabase presence subscription');

      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();

      if (!client) {
        logger.error('❌ FriendsPresenceTracker: No Supabase client available');
        return;
      }

      const channelName = `presence:user:${userId}`;

      if (this.presenceChannel) {
        logger.info('🔄 Removing existing presence channel');
        this.presenceChannel.unsubscribe();
        client.removeChannel(this.presenceChannel);
        this.presenceChannel = null;
      }

      this.presenceChannel = client
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_presence',
          },
          (payload) => {
            logger.debug('🔥 FriendsPresenceTracker: Presence change received:', payload);

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const data = payload.new as {
                user_id: string;
                status: 'online' | 'away' | 'offline';
                activity?: string;
                last_seen: string;
              };

              const friends = this.callbacks.getFriends();
              const isFriend = friends.some(f => f.friendId === data.user_id);

              if (isFriend) {
                logger.info(`📡 FriendsPresenceTracker: Friend ${data.user_id} presence: ${data.status}`);
                this.handlePresenceUpdate(data.user_id, {
                  status: data.status,
                  activity: data.activity,
                  lastSeen: new Date(data.last_seen),
                });
              }
            }
          }
        );

      this.presenceChannel.subscribe((status, err) => {
        logger.info('📡 FriendsPresenceTracker: Subscription status:', status);
        if (err) {
          logger.error('❌ FriendsPresenceTracker: Subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          logger.info('✅ FriendsPresenceTracker: Successfully subscribed');
        }
      });

      logger.info('Subscribed to friends presence updates');
    } catch (error) {
      logger.error('Failed to subscribe to presence updates:', error);
    }
  }

  /**
   * Update friends data with presence information
   */
  private updateFriendsWithPresence(presenceMap: Record<string, {
    status: 'online' | 'away' | 'offline';
    activity?: string;
    lastSeen: string;
  }>): void {
    this.callbacks.updateFriends((friends) => {
      return friends.map(friend => {
        const presence = presenceMap[friend.friendId];
        if (presence) {
          return {
            ...friend,
            isOnline: presence.status === 'online',
            currentActivity: presence.activity,
            lastSeen: new Date(presence.lastSeen),
          };
        }
        return friend;
      });
    });

    this.callbacks.notifyFriendsListeners();
    logger.debug('Updated presence for', Object.keys(presenceMap).length, 'friends');
  }

  /**
   * Handle incoming presence update for a single friend
   */
  private handlePresenceUpdate(friendId: string, presence: {
    status: 'online' | 'away' | 'offline';
    activity?: string;
    lastSeen: Date;
  }): void {
    this.callbacks.updateFriends((friends) => {
      return friends.map(f => {
        if (f.friendId === friendId) {
          return {
            ...f,
            isOnline: presence.status === 'online',
            currentActivity: presence.activity,
            lastSeen: presence.lastSeen,
          };
        }
        return f;
      });
    });

    this.callbacks.notifyFriendsListeners();
    logger.debug(`Presence updated for friend ${friendId}: ${presence.status}`);
  }
}
