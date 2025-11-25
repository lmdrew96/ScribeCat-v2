/**
 * SupabaseFriendsRepository
 *
 * Infrastructure layer service for friend and friend request operations
 * Uses Supabase database for storage and retrieval
 */

import { SupabaseClient as SupabaseClientType, RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseClient } from './SupabaseClient.js';
import { Friend } from '../../../domain/entities/Friend.js';
import { FriendRequest, FriendRequestStatus } from '../../../domain/entities/FriendRequest.js';

export interface SearchUserResult {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  isFriend: boolean;
  hasPendingRequest: boolean;
}

/**
 * Repository for managing friends and friend requests
 */
export class SupabaseFriendsRepository {
  private channels: Map<string, RealtimeChannel> = new Map();

  /**
   * Get a fresh Supabase client with the current session
   * This ensures RLS policies work correctly with the authenticated user
   */
  private getClient(): SupabaseClientType {
    return SupabaseClient.getInstance().getClient();
  }

  /**
   * Get the base Supabase client for Realtime subscriptions
   * This client has setSession() called on it for proper auth context
   */
  private getRealtimeClient(): SupabaseClientType {
    return SupabaseClient.getInstance().getRealtimeClient();
  }

  // ============================================================================
  // Friend Operations
  // ============================================================================

  /**
   * Get all friends for a user
   * Includes user profile data and optional presence information
   */
  async getFriends(userId: string): Promise<Friend[]> {
    try {
      const { data, error } = await this.getClient()
        .from('friendships')
        .select(`
          id,
          user_id,
          friend_id,
          created_at,
          friend_profile:user_profiles!friendships_friend_id_fkey (
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching friends:', error);
        throw new Error(`Failed to fetch friends: ${error.message}`);
      }

      if (!data) {
        return [];
      }

      return data.map((row: any) => {
        const profile = Array.isArray(row.friend_profile) ? row.friend_profile[0] : row.friend_profile;
        return Friend.fromDatabase({
          id: row.id,
          user_id: row.user_id,
          friend_id: row.friend_id,
          created_at: row.created_at,
          email: profile?.email || '',
          full_name: profile?.full_name,
          avatar_url: profile?.avatar_url,
        });
      });
    } catch (error) {
      console.error('Exception in getFriends:', error);
      throw error;
    }
  }

  /**
   * Get count of friends for a user
   */
  async getFriendsCount(userId: string): Promise<number> {
    try {
      const { count, error } = await this.getClient()
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        console.error('Error counting friends:', error);
        throw new Error(`Failed to count friends: ${error.message}`);
      }

      return count || 0;
    } catch (error) {
      console.error('Exception in getFriendsCount:', error);
      throw error;
    }
  }

  /**
   * Remove a friend (unfriend)
   * Uses atomic database function to delete both directions in a single transaction
   */
  async removeFriend(userId: string, friendId: string): Promise<void> {
    try {
      // Use atomic unfriend function (deletes both directions in single transaction)
      const { error } = await this.getClient()
        .rpc('unfriend', {
          p_user_id: userId,
          p_friend_id: friendId,
        });

      if (error) {
        throw new Error(`Failed to remove friendship: ${error.message}`);
      }
    } catch (error) {
      console.error('Exception in removeFriend:', error);
      throw error;
    }
  }

  /**
   * Check if two users are friends
   */
  async areFriends(userA: string, userB: string): Promise<boolean> {
    try {
      const { data, error } = await this.getClient().rpc('are_friends', {
        user_a: userA,
        user_b: userB,
      });

      if (error) {
        console.error('Error checking friendship:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Exception in areFriends:', error);
      return false;
    }
  }

  /**
   * Get mutual friends count between two users
   */
  async getMutualFriendsCount(userA: string, userB: string): Promise<number> {
    try {
      const { data, error } = await this.getClient().rpc('get_mutual_friends_count', {
        user_a: userA,
        user_b: userB,
      });

      if (error) {
        console.error('Error getting mutual friends count:', error);
        return 0;
      }

      return data || 0;
    } catch (error) {
      console.error('Exception in getMutualFriendsCount:', error);
      return 0;
    }
  }

  // ============================================================================
  // Friend Request Operations
  // ============================================================================

  /**
   * Get all friend requests for a user (both incoming and outgoing)
   */
  async getFriendRequests(userId: string): Promise<FriendRequest[]> {
    try {
      const { data, error } = await this.getClient()
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
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching friend requests:', error);
        throw new Error(`Failed to fetch friend requests: ${error.message}`);
      }

      if (!data) {
        return [];
      }

      return data.map((row: any) => {
        const senderProfile = Array.isArray(row.sender_profile) ? row.sender_profile[0] : row.sender_profile;
        const recipientProfile = Array.isArray(row.recipient_profile) ? row.recipient_profile[0] : row.recipient_profile;

        return FriendRequest.fromDatabase({
          id: row.id,
          sender_id: row.sender_id,
          recipient_id: row.recipient_id,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
          sender_email: senderProfile?.email,
          sender_full_name: senderProfile?.full_name,
          sender_avatar_url: senderProfile?.avatar_url,
          recipient_email: recipientProfile?.email,
          recipient_full_name: recipientProfile?.full_name,
          recipient_avatar_url: recipientProfile?.avatar_url,
        });
      });
    } catch (error) {
      console.error('Exception in getFriendRequests:', error);
      throw error;
    }
  }

  /**
   * Get pending incoming friend requests
   */
  async getIncomingFriendRequests(userId: string): Promise<FriendRequest[]> {
    const allRequests = await this.getFriendRequests(userId);
    return allRequests.filter(req => req.isIncoming(userId));
  }

  /**
   * Get pending outgoing friend requests
   */
  async getOutgoingFriendRequests(userId: string): Promise<FriendRequest[]> {
    const allRequests = await this.getFriendRequests(userId);
    return allRequests.filter(req => req.isOutgoing(userId));
  }

  /**
   * Get count of pending incoming friend requests
   */
  async getIncomingRequestsCount(userId: string): Promise<number> {
    try {
      const { count, error } = await this.getClient()
        .from('friend_requests')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('status', 'pending');

      if (error) {
        console.error('Error counting incoming requests:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Exception in getIncomingRequestsCount:', error);
      return 0;
    }
  }

  /**
   * Send a friend request
   */
  async sendFriendRequest(senderId: string, recipientId: string): Promise<FriendRequest> {
    try {
      // Check if already friends
      const alreadyFriends = await this.areFriends(senderId, recipientId);
      if (alreadyFriends) {
        throw new Error('Users are already friends');
      }

      // Check for existing pending request
      const hasPending = await this.hasPendingRequest(senderId, recipientId);
      if (hasPending) {
        throw new Error('Friend request already exists');
      }

      const { data, error } = await this.getClient()
        .from('friend_requests')
        .insert({
          sender_id: senderId,
          recipient_id: recipientId,
          status: 'pending',
        })
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
        .single();

      if (error) {
        console.error('Error sending friend request:', error);
        throw new Error(`Failed to send friend request: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned after sending friend request');
      }

      const senderProfile = Array.isArray(data.sender_profile) ? data.sender_profile[0] : data.sender_profile;
      const recipientProfile = Array.isArray(data.recipient_profile) ? data.recipient_profile[0] : data.recipient_profile;

      return FriendRequest.fromDatabase({
        id: data.id,
        sender_id: data.sender_id,
        recipient_id: data.recipient_id,
        status: data.status,
        created_at: data.created_at,
        updated_at: data.updated_at,
        sender_email: senderProfile?.email,
        sender_full_name: senderProfile?.full_name,
        sender_avatar_url: senderProfile?.avatar_url,
        recipient_email: recipientProfile?.email,
        recipient_full_name: recipientProfile?.full_name,
        recipient_avatar_url: recipientProfile?.avatar_url,
      });
    } catch (error) {
      console.error('Exception in sendFriendRequest:', error);
      throw error;
    }
  }

  /**
   * Accept a friend request
   * The trigger will automatically create the friendship entries
   */
  async acceptFriendRequest(requestId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.getClient()
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId)
        .eq('recipient_id', userId);

      if (error) {
        console.error('Error accepting friend request:', error);
        throw new Error(`Failed to accept friend request: ${error.message}`);
      }
    } catch (error) {
      console.error('Exception in acceptFriendRequest:', error);
      throw error;
    }
  }

  /**
   * Reject a friend request
   */
  async rejectFriendRequest(requestId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.getClient()
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)
        .eq('recipient_id', userId);

      if (error) {
        console.error('Error rejecting friend request:', error);
        throw new Error(`Failed to reject friend request: ${error.message}`);
      }
    } catch (error) {
      console.error('Exception in rejectFriendRequest:', error);
      throw error;
    }
  }

  /**
   * Cancel a friend request (by sender)
   */
  async cancelFriendRequest(requestId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.getClient()
        .from('friend_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('sender_id', userId);

      if (error) {
        console.error('Error cancelling friend request:', error);
        throw new Error(`Failed to cancel friend request: ${error.message}`);
      }
    } catch (error) {
      console.error('Exception in cancelFriendRequest:', error);
      throw error;
    }
  }

  /**
   * Check if there's a pending friend request between two users
   */
  async hasPendingRequest(userA: string, userB: string): Promise<boolean> {
    try {
      const { data, error } = await this.getClient().rpc('has_pending_friend_request', {
        user_a: userA,
        user_b: userB,
      });

      if (error) {
        console.error('Error checking pending request:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Exception in hasPendingRequest:', error);
      return false;
    }
  }

  // ============================================================================
  // User Search Operations
  // ============================================================================

  /**
   * Search for users by email
   * Returns users with their friend/request status relative to the searching user
   */
  async searchUsersByEmail(searchEmail: string, currentUserId: string, limit: number = 20): Promise<SearchUserResult[]> {
    try {
      // Search for users by email (case-insensitive partial match)
      const { data: users, error: usersError } = await this.getClient()
        .from('user_profiles')
        .select('id, email, full_name, avatar_url')
        .ilike('email', `%${searchEmail}%`)
        .neq('id', currentUserId) // Exclude current user
        .limit(limit);

      if (usersError) {
        console.error('Error searching users:', usersError);
        throw new Error(`Failed to search users: ${usersError.message}`);
      }

      if (!users || users.length === 0) {
        return [];
      }

      // Batch query: Get all friendship statuses in one query (fixes N+1 problem)
      const userIds = users.map(u => u.id);
      const { data: friendships } = await this.getClient()
        .from('friendships')
        .select('friend_id')
        .eq('user_id', currentUserId)
        .in('friend_id', userIds);

      const friendIds = new Set(friendships?.map(f => f.friend_id) || []);

      // Batch query: Get all pending friend requests in one query
      const { data: pendingRequests } = await this.getClient()
        .from('friend_requests')
        .select('sender_id, recipient_id')
        .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
        .in('sender_id', [currentUserId, ...userIds])
        .in('recipient_id', [currentUserId, ...userIds])
        .eq('status', 'pending');

      // Build set of user IDs with pending requests (sent or received)
      const pendingRequestIds = new Set<string>();
      pendingRequests?.forEach(req => {
        if (req.sender_id === currentUserId) {
          pendingRequestIds.add(req.recipient_id);
        } else if (req.recipient_id === currentUserId) {
          pendingRequestIds.add(req.sender_id);
        }
      });

      // Map results using the batched data
      const results: SearchUserResult[] = users.map(user => ({
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
        isFriend: friendIds.has(user.id),
        hasPendingRequest: pendingRequestIds.has(user.id),
      }));

      return results;
    } catch (error) {
      console.error('Exception in searchUsersByEmail:', error);
      throw error;
    }
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<SearchUserResult | null> {
    try {
      const { data, error } = await this.getClient()
        .from('user_profiles')
        .select('id, email, full_name, avatar_url')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        avatarUrl: data.avatar_url,
        isFriend: false,
        hasPendingRequest: false,
      };
    } catch (error) {
      console.error('Exception in getUserProfile:', error);
      return null;
    }
  }

  // ============================================================================
  // Realtime Subscriptions
  // ============================================================================

  /**
   * Subscribe to friend requests for a specific user
   * Listens for INSERT and UPDATE events on friend_requests table
   */
  public subscribeToUserFriendRequests(
    userId: string,
    onFriendRequest: (friendRequest: FriendRequest, event: 'INSERT' | 'UPDATE') => void
  ): () => void {
    const channelName = `user-friend-requests:${userId}`;
    const client = this.getRealtimeClient();

    console.log('📡 Creating Realtime friend request subscription for user:', userId);
    console.log('🔑 Auth token present:', !!SupabaseClient.getInstance().getAccessToken());

    // Remove existing subscription if any (prevents duplicates)
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
      console.log(`Removing existing friend request subscription for user ${userId}`);
      existingChannel.unsubscribe().catch(err =>
        console.error('Error unsubscribing existing channel:', err)
      );
      client.removeChannel(existingChannel);
      this.channels.delete(channelName);
    }

    // Auth is already set via setSession() on the base client
    // No need to call setAuth() per channel - it can cause conflicts

    const channel = client
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
          console.log('New friend request received:', payload);

          // Fetch full friend request with profile data
          const friendRequest = await this.getFriendRequestById(payload.new.id);
          if (friendRequest) {
            onFriendRequest(friendRequest, 'INSERT');
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
          console.log('Friend request updated:', payload);

          // Fetch full friend request with profile data
          const friendRequest = await this.getFriendRequestById(payload.new.id);
          if (friendRequest) {
            onFriendRequest(friendRequest, 'UPDATE');
          }
        }
      );

    channel.subscribe((status) => {
      console.log(`Friend request subscription status for user ${userId}:`, status);
      if (status === 'SUBSCRIBED') {
        console.log(`Successfully subscribed to friend requests for user ${userId}`);
      } else if (status === 'TIMED_OUT') {
        console.error(`Friend request subscription timed out for user ${userId}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Friend request subscription error for user ${userId}`);
      }
    });

    this.channels.set(channelName, channel);

    // Return unsubscribe function
    return async () => {
      await channel.unsubscribe();
      client.removeChannel(channel);
      this.channels.delete(channelName);
      console.log(`Unsubscribed from friend requests for user ${userId}`);
    };
  }

  /**
   * Get friend request by ID with full profile data
   * Helper method for realtime subscription
   */
  private async getFriendRequestById(requestId: string): Promise<FriendRequest | null> {
    try {
      const { data, error } = await this.getClient()
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

      if (error || !data) {
        console.error('Error fetching friend request:', error);
        return null;
      }

      const senderProfile = Array.isArray(data.sender_profile) ? data.sender_profile[0] : data.sender_profile;
      const recipientProfile = Array.isArray(data.recipient_profile) ? data.recipient_profile[0] : data.recipient_profile;

      return FriendRequest.fromDatabase({
        id: data.id,
        sender_id: data.sender_id,
        recipient_id: data.recipient_id,
        status: data.status,
        created_at: data.created_at,
        updated_at: data.updated_at,
        sender_email: senderProfile?.email,
        sender_full_name: senderProfile?.full_name,
        sender_avatar_url: senderProfile?.avatar_url,
        recipient_email: recipientProfile?.email,
        recipient_full_name: recipientProfile?.full_name,
        recipient_avatar_url: recipientProfile?.avatar_url,
      });
    } catch (error) {
      console.error('Exception in getFriendRequestById:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from all friend-related subscriptions
   */
  public async unsubscribeAll(): Promise<void> {
    const client = this.getRealtimeClient();
    const unsubscribePromises = Array.from(this.channels.values()).map(channel =>
      channel.unsubscribe()
    );
    await Promise.all(unsubscribePromises);

    this.channels.forEach((channel) => {
      client.removeChannel(channel);
    });
    this.channels.clear();
    console.log('Unsubscribed from all friend channels');
  }
}
