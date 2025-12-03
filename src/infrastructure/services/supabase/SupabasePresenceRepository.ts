/**
 * SupabasePresenceRepository
 *
 * Infrastructure layer service for user presence operations
 * Handles real-time presence tracking via Supabase
 */

import { SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';
import { SupabaseClient } from './SupabaseClient.js';
import {
  IPresenceRepository,
  UserStatus,
  PresenceData,
  UpdatePresenceParams,
} from '../../../domain/repositories/IPresenceRepository.js';

/**
 * Repository for managing user presence and status
 * Real-time subscriptions are handled directly in FriendsManager (renderer).
 */
export class SupabasePresenceRepository implements IPresenceRepository {
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

}
