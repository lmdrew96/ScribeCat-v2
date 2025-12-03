/**
 * FriendsRealtimeSubscriptions
 *
 * Handles real-time subscriptions for friend requests.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { createLogger } from '../../../../shared/logger.js';
import type { FriendRequestData } from '../../../../domain/entities/FriendRequest.js';
import { RendererSupabaseClient } from '../../../services/RendererSupabaseClient.js';

const logger = createLogger('FriendsRealtimeSubscriptions');

export interface RealtimeSubscriptionCallbacks {
  getCurrentUserId: () => string | null;
  getFriendRequests: () => FriendRequestData[];
  updateFriendRequests: (updater: (requests: FriendRequestData[]) => FriendRequestData[]) => void;
  addFriendRequest: (request: FriendRequestData) => void;
  notifyRequestsListeners: () => void;
}

export class FriendsRealtimeSubscriptions {
  private friendRequestChannel: RealtimeChannel | null = null;
  private callbacks: RealtimeSubscriptionCallbacks;

  constructor(callbacks: RealtimeSubscriptionCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Subscribe to real-time friend request updates
   * Uses direct Supabase Realtime subscription in renderer process
   * (WebSockets don't work in Electron's main process - no browser APIs)
   */
  async subscribeToRequests(): Promise<void> {
    const userId = this.callbacks.getCurrentUserId();
    if (!userId) return;

    try {
      logger.info('📡 FriendsRealtimeSubscriptions: Setting up direct Supabase friend request subscription');

      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();

      if (!client) {
        logger.error('❌ FriendsRealtimeSubscriptions: No Supabase client available');
        return;
      }

      const channelName = `user-friend-requests:${userId}`;

      // Remove existing subscription if any
      if (this.friendRequestChannel) {
        logger.info('🔄 Removing existing friend request channel');
        this.friendRequestChannel.unsubscribe();
        client.removeChannel(this.friendRequestChannel);
        this.friendRequestChannel = null;
      }

      // Create new channel for friend request updates
      this.friendRequestChannel = client
        .channel(channelName)
        // Listen for new friend requests (INSERT)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'friend_requests',
            filter: `recipient_id=eq.${userId}`,
          },
          async (payload) => {
            logger.info('🔥 FriendsRealtimeSubscriptions: New friend request received:', payload);

            // Fetch full friend request with profile data
            const friendRequest = await this.fetchFriendRequestById(payload.new.id as string);
            if (friendRequest) {
              this.handleRequestChange(friendRequest, 'INSERT');
            }
          }
        )
        // Listen for friend request status changes (UPDATE)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'friend_requests',
            filter: `recipient_id=eq.${userId}`,
          },
          async (payload) => {
            logger.info('🔥 FriendsRealtimeSubscriptions: Friend request updated:', payload);

            // Fetch full friend request with profile data
            const friendRequest = await this.fetchFriendRequestById(payload.new.id as string);
            if (friendRequest) {
              this.handleRequestChange(friendRequest, 'UPDATE');
            }
          }
        );

      // Subscribe and log status
      this.friendRequestChannel.subscribe((status, err) => {
        logger.info('📡 FriendsRealtimeSubscriptions: Subscription status:', status);
        if (err) {
          logger.error('❌ FriendsRealtimeSubscriptions: Subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          logger.info('✅ FriendsRealtimeSubscriptions: Successfully subscribed');
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('❌ FriendsRealtimeSubscriptions: Channel error');
        } else if (status === 'TIMED_OUT') {
          logger.error('⏱️ FriendsRealtimeSubscriptions: Subscription timed out');
        }
      });

      logger.info('Subscribed to friend request real-time updates');
    } catch (error) {
      logger.error('Exception subscribing to friend request changes:', error);
    }
  }

  /**
   * Unsubscribe from real-time friend request updates
   */
  unsubscribeFromRequests(): void {
    if (this.friendRequestChannel) {
      logger.info('🔒 FriendsRealtimeSubscriptions: Unsubscribing from friend request channel');
      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();

      this.friendRequestChannel.unsubscribe();
      if (client) {
        client.removeChannel(this.friendRequestChannel);
      }
      this.friendRequestChannel = null;
      logger.info('Unsubscribed from friend request real-time updates');
    }
  }

  /**
   * Fetch friend request by ID with full profile data
   */
  private async fetchFriendRequestById(requestId: string): Promise<FriendRequestData | null> {
    try {
      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();

      const { data, error } = await client
        .from('friend_requests')
        .select(`
          id,
          sender_id,
          recipient_id,
          status,
          created_at,
          updated_at,
          sender_profile:user_profiles!friend_requests_sender_id_fkey (
            email,
            full_name,
            avatar_url
          ),
          recipient_profile:user_profiles!friend_requests_recipient_id_fkey (
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('id', requestId)
        .single();

      if (error) {
        logger.error('Error fetching friend request by ID:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      // Map to FriendRequestData
      const senderProfile = data.sender_profile as { email?: string; full_name?: string; avatar_url?: string } | null;
      const recipientProfile = data.recipient_profile as { email?: string; full_name?: string; avatar_url?: string } | null;

      return {
        id: data.id,
        senderId: data.sender_id,
        recipientId: data.recipient_id,
        status: data.status,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        senderEmail: senderProfile?.email,
        senderFullName: senderProfile?.full_name,
        senderAvatarUrl: senderProfile?.avatar_url,
        recipientEmail: recipientProfile?.email,
        recipientFullName: recipientProfile?.full_name,
        recipientAvatarUrl: recipientProfile?.avatar_url,
      };
    } catch (error) {
      logger.error('Exception fetching friend request by ID:', error);
      return null;
    }
  }

  /**
   * Handle real-time friend request change events
   */
  private handleRequestChange(friendRequest: FriendRequestData, eventType: 'INSERT' | 'UPDATE'): void {
    try {
      logger.info('Friend request change event:', eventType, friendRequest);

      if (eventType === 'INSERT') {
        // New friend request received - check if already exists
        const requests = this.callbacks.getFriendRequests();
        const existingIndex = requests.findIndex(req => req.id === friendRequest.id);
        if (existingIndex === -1) {
          this.callbacks.addFriendRequest(friendRequest);
        }
      } else if (eventType === 'UPDATE') {
        // Friend request status updated - update local state
        this.callbacks.updateFriendRequests((requests) => {
          return requests.map(req =>
            req.id === friendRequest.id ? friendRequest : req
          );
        });
      }

      this.callbacks.notifyRequestsListeners();
    } catch (error) {
      logger.error('Error handling friend request change:', error);
    }
  }
}
