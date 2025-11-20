/**
 * SupabasePresenceRepository
 *
 * Infrastructure layer service for user presence operations
 * Handles real-time presence tracking via Supabase
 */

import { SupabaseClient as SupabaseClientType, RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseClient } from './SupabaseClient.js';
import {
  IPresenceRepository,
  UserStatus,
  PresenceData,
  UpdatePresenceParams,
} from '../../../domain/repositories/IPresenceRepository.js';

/**
 * Repository for managing user presence and status
 */
export class SupabasePresenceRepository implements IPresenceRepository {
  private subscriptions: Map<string, RealtimeChannel> = new Map();

  /**
   * Get a fresh Supabase client with the current session
   */
  private getClient(): SupabaseClientType {
    return SupabaseClient.getInstance().getClient();
  }

  // ============================================================================
  // Presence Operations
  // ============================================================================

  /**
   * Update user's presence status
   * Uses database function for atomic upsert
   */
  async updatePresence(params: UpdatePresenceParams): Promise<void> {
    try {
      console.log('[PresenceRepository] Updating presence:', {
        userId: params.userId,
        status: params.status,
        activity: params.activity
      });

      const { error } = await this.getClient().rpc('update_user_presence', {
        p_user_id: params.userId,
        p_status: params.status,
        p_activity: params.activity || null,
      });

      if (error) {
        console.error('[PresenceRepository] Error updating presence:', error);
        throw new Error(`Failed to update presence: ${error.message}`);
      }

      console.log('[PresenceRepository] Presence updated successfully');
    } catch (error) {
      console.error('[PresenceRepository] Exception in updatePresence:', error);
      throw error;
    }
  }

  /**
   * Get presence data for a specific user
   */
  async getUserPresence(userId: string): Promise<PresenceData | null> {
    try {
      const { data, error } = await this.getClient()
        .from('user_presence')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // User might not have presence record yet
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error fetching user presence:', error);
        throw new Error(`Failed to fetch user presence: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return {
        userId: data.user_id,
        status: data.status as UserStatus,
        activity: data.activity,
        lastSeen: new Date(data.last_seen),
      };
    } catch (error) {
      console.error('Exception in getUserPresence:', error);
      throw error;
    }
  }

  /**
   * Get presence data for all friends of a user
   * Uses database function for efficient querying with RLS
   */
  async getFriendsPresence(userId: string): Promise<Map<string, PresenceData>> {
    try {
      console.log('[PresenceRepository] Fetching friends presence for user:', userId);

      const { data, error } = await this.getClient().rpc('get_friends_presence', {
        target_user_id: userId,
      });

      if (error) {
        console.error('[PresenceRepository] Error fetching friends presence:', error);
        throw new Error(`Failed to fetch friends presence: ${error.message}`);
      }

      console.log('[PresenceRepository] Friends presence data received:', data);

      const presenceMap = new Map<string, PresenceData>();

      if (data && Array.isArray(data)) {
        for (const row of data) {
          console.log('[PresenceRepository] Processing friend presence:', {
            friendId: row.friend_id,
            status: row.status,
            activity: row.activity,
            lastSeen: row.last_seen
          });
          presenceMap.set(row.friend_id, {
            userId: row.friend_id,
            status: row.status as UserStatus,
            activity: row.activity,
            lastSeen: new Date(row.last_seen),
          });
        }
      }

      console.log('[PresenceRepository] Returning presence map with', presenceMap.size, 'entries');
      return presenceMap;
    } catch (error) {
      console.error('[PresenceRepository] Exception in getFriendsPresence:', error);
      throw error;
    }
  }

  /**
   * Subscribe to presence updates for a user's friends
   * Returns an unsubscribe function
   */
  subscribeToFriendsPresence(
    userId: string,
    onUpdate: (friendId: string, presence: PresenceData) => void
  ): () => Promise<void> {
    const channelName = `presence:user:${userId}`;

    // Remove existing subscription if any
    const existing = this.subscriptions.get(channelName);
    if (existing) {
      this.getClient().removeChannel(existing);
      this.subscriptions.delete(channelName);
    }

    // Create new channel for presence updates
    const channel = this.getClient()
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        (payload) => {
          console.log('[PresenceRepository] Received realtime update:', payload);
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const data = payload.new as any;
            console.log('[PresenceRepository] Presence change detected for user:', data.user_id);
            // Only notify if this is a friend's update (will be filtered by RLS on query)
            this.isFriend(userId, data.user_id).then((isFriend) => {
              console.log('[PresenceRepository] Is friend check:', { userId: data.user_id, isFriend });
              if (isFriend) {
                console.log('[PresenceRepository] Notifying about friend presence update');
                onUpdate(data.user_id, {
                  userId: data.user_id,
                  status: data.status as UserStatus,
                  activity: data.activity,
                  lastSeen: new Date(data.last_seen),
                });
              }
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[PresenceRepository] Subscribed to presence updates for user ${userId}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[PresenceRepository] Error subscribing to presence channel`);
        }
      });

    this.subscriptions.set(channelName, channel);

    // Return unsubscribe function
    return async () => {
      await this.getClient().removeChannel(channel);
      this.subscriptions.delete(channelName);
      console.log(`[PresenceRepository] Unsubscribed from presence updates for user ${userId}`);
    };
  }

  /**
   * Check if two users are friends
   * Helper method for filtering presence updates
   */
  private async isFriend(userId: string, friendId: string): Promise<boolean> {
    try {
      const { data, error } = await this.getClient().rpc('are_friends', {
        user_a: userId,
        user_b: friendId,
      });

      if (error) {
        console.error('Error checking friendship:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Exception in isFriend:', error);
      return false;
    }
  }

  /**
   * Set user to offline status
   */
  async setOffline(userId: string): Promise<void> {
    try {
      await this.updatePresence({
        userId,
        status: 'offline',
        activity: undefined,
      });
    } catch (error) {
      console.error('Exception in setOffline:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from all presence subscriptions
   */
  async unsubscribeAll(): Promise<void> {
    try {
      const client = this.getClient();
      for (const [channelName, channel] of this.subscriptions.entries()) {
        await client.removeChannel(channel);
        console.log(`[PresenceRepository] Unsubscribed from ${channelName}`);
      }
      this.subscriptions.clear();
    } catch (error) {
      console.error('Exception in unsubscribeAll:', error);
      throw error;
    }
  }
}
