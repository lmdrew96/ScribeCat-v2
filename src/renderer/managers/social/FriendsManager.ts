/**
 * FriendsManager
 *
 * Manages friend relationships and friend requests in the renderer process.
 * Coordinates with FriendsModal and handles IPC communication with main process.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { createLogger } from '../../../shared/logger.js';
import type { FriendData } from '../../../domain/entities/Friend.js';
import type { FriendRequestData } from '../../../domain/entities/FriendRequest.js';
import type { SearchUserResult } from '../../../infrastructure/services/supabase/SupabaseFriendsRepository.js';
import { RendererSupabaseClient } from '../../services/RendererSupabaseClient.js';

const logger = createLogger('FriendsManager');

export type FriendsChangeListener = (friends: FriendData[]) => void;
export type RequestsChangeListener = (requests: FriendRequestData[]) => void;

/**
 * FriendsManager - Manages friend relationships and requests
 * Now includes real-time presence tracking
 */
export class FriendsManager {
  private friends: FriendData[] = [];
  private friendRequests: FriendRequestData[] = [];
  private currentUserId: string | null = null;

  private friendsListeners: Set<FriendsChangeListener> = new Set();
  private requestsListeners: Set<RequestsChangeListener> = new Set();

  // Presence tracking
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
  private presenceChannel: RealtimeChannel | null = null;

  // Friend request realtime subscription
  private friendRequestChannel: RealtimeChannel | null = null;

  constructor() {
    logger.info('FriendsManager initialized');
  }

  /**
   * Initialize the friends manager with current user
   */
  async initialize(userId: string): Promise<void> {
    this.currentUserId = userId;
    await this.loadFriends();
    await this.loadFriendRequests();

    // Start presence tracking
    await this.startPresenceTracking();

    // Subscribe to realtime friend request updates
    await this.subscribeToRequests();

    logger.info('FriendsManager initialized for user:', userId);
  }

  /**
   * Clear all data (on sign out)
   */
  async clear(): Promise<void> {
    // Stop presence tracking
    await this.stopPresenceTracking();

    // Unsubscribe from friend request updates
    this.unsubscribeFromRequests();

    this.currentUserId = null;
    this.friends = [];
    this.friendRequests = [];
    this.notifyFriendsListeners();
    this.notifyRequestsListeners();
    logger.info('FriendsManager cleared');
  }

  // ============================================================================
  // Friends Operations
  // ============================================================================

  /**
   * Load friends from the server
   */
  async loadFriends(): Promise<void> {
    try {
      const result = await window.scribeCat.friends.getFriends();

      if (result.success) {
        this.friends = result.friends || [];
        this.notifyFriendsListeners();
        logger.info(`Loaded ${this.friends.length} friends`);

        // Load presence data for all friends after loading friends list
        if (this.currentUserId && this.friends.length > 0) {
          await this.loadFriendsPresence();
        }
      } else {
        logger.error('Failed to load friends:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception loading friends:', error);
      throw error;
    }
  }

  /**
   * Get all friends
   */
  getFriends(): FriendData[] {
    return [...this.friends];
  }

  /**
   * Get friends count
   */
  getFriendsCount(): number {
    return this.friends.length;
  }

  /**
   * Get online friends only
   */
  getOnlineFriends(): FriendData[] {
    return this.friends.filter(f => f.isOnline);
  }

  /**
   * Get friend by ID
   */
  getFriendById(friendId: string): FriendData | null {
    return this.friends.find(f => f.friendId === friendId) || null;
  }

  /**
   * Check if a user is a friend
   */
  isFriend(userId: string): boolean {
    return this.friends.some(f => f.friendId === userId);
  }

  /**
   * Remove a friend (unfriend)
   */
  async removeFriend(friendId: string): Promise<void> {
    try {
      const result = await window.scribeCat.friends.removeFriend(friendId);

      if (result.success) {
        // Remove from local state
        this.friends = this.friends.filter(f => f.friendId !== friendId);
        this.notifyFriendsListeners();
        logger.info('Friend removed:', friendId);
      } else {
        logger.error('Failed to remove friend:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception removing friend:', error);
      throw error;
    }
  }

  /**
   * Get mutual friends count
   */
  async getMutualFriendsCount(userId: string): Promise<number> {
    try {
      const result = await window.scribeCat.friends.getMutualFriendsCount(userId);

      if (result.success) {
        return result.count || 0;
      } else {
        logger.error('Failed to get mutual friends count:', result.error);
        return 0;
      }
    } catch (error) {
      logger.error('Exception getting mutual friends count:', error);
      return 0;
    }
  }

  // ============================================================================
  // Friend Requests Operations
  // ============================================================================

  /**
   * Load friend requests from the server
   */
  async loadFriendRequests(): Promise<void> {
    try {
      const result = await window.scribeCat.friends.getFriendRequests();

      if (result.success) {
        this.friendRequests = result.requests || [];
        this.notifyRequestsListeners();
        logger.info(`Loaded ${this.friendRequests.length} friend requests`);
      } else {
        logger.error('Failed to load friend requests:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception loading friend requests:', error);
      throw error;
    }
  }

  /**
   * Get all friend requests
   */
  getFriendRequests(): FriendRequestData[] {
    return [...this.friendRequests];
  }

  /**
   * Get incoming friend requests (pending requests where current user is recipient)
   */
  getIncomingRequests(): FriendRequestData[] {
    if (!this.currentUserId) return [];

    return this.friendRequests.filter(
      req => req.status === 'pending' && req.recipientId === this.currentUserId
    );
  }

  /**
   * Get outgoing friend requests (pending requests where current user is sender)
   */
  getOutgoingRequests(): FriendRequestData[] {
    if (!this.currentUserId) return [];

    return this.friendRequests.filter(
      req => req.status === 'pending' && req.senderId === this.currentUserId
    );
  }

  /**
   * Get incoming requests count
   */
  getIncomingRequestsCount(): number {
    return this.getIncomingRequests().length;
  }

  /**
   * Check if there's a pending request with a user
   */
  hasPendingRequest(userId: string): boolean {
    if (!this.currentUserId) return false;

    return this.friendRequests.some(
      req => req.status === 'pending' &&
        ((req.senderId === this.currentUserId && req.recipientId === userId) ||
         (req.senderId === userId && req.recipientId === this.currentUserId))
    );
  }

  /**
   * Send a friend request
   */
  async sendFriendRequest(recipientId: string): Promise<void> {
    try {
      const result = await window.scribeCat.friends.sendRequest(recipientId);

      if (result.success) {
        // Add to local state
        if (result.request) {
          this.friendRequests.push(result.request);
          this.notifyRequestsListeners();
        }
        logger.info('Friend request sent to:', recipientId);
      } else {
        logger.error('Failed to send friend request:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception sending friend request:', error);
      throw error;
    }
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(requestId: string): Promise<void> {
    try {
      const result = await window.scribeCat.friends.acceptRequest(requestId);

      if (result.success) {
        // Update local state - the request will be marked as accepted
        const request = this.friendRequests.find(r => r.id === requestId);
        if (request) {
          // Remove from requests (since it's now accepted)
          this.friendRequests = this.friendRequests.filter(r => r.id !== requestId);
          this.notifyRequestsListeners();
        }

        // Reload friends to get the new friend
        await this.loadFriends();

        logger.info('Friend request accepted:', requestId);
      } else {
        logger.error('Failed to accept friend request:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception accepting friend request:', error);
      throw error;
    }
  }

  /**
   * Reject a friend request
   */
  async rejectFriendRequest(requestId: string): Promise<void> {
    try {
      const result = await window.scribeCat.friends.rejectRequest(requestId);

      if (result.success) {
        // Remove from local state
        this.friendRequests = this.friendRequests.filter(r => r.id !== requestId);
        this.notifyRequestsListeners();
        logger.info('Friend request rejected:', requestId);
      } else {
        logger.error('Failed to reject friend request:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception rejecting friend request:', error);
      throw error;
    }
  }

  /**
   * Cancel a friend request (sender only)
   */
  async cancelFriendRequest(requestId: string): Promise<void> {
    try {
      const result = await window.scribeCat.friends.cancelRequest(requestId);

      if (result.success) {
        // Remove from local state
        this.friendRequests = this.friendRequests.filter(r => r.id !== requestId);
        this.notifyRequestsListeners();
        logger.info('Friend request cancelled:', requestId);
      } else {
        logger.error('Failed to cancel friend request:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception cancelling friend request:', error);
      throw error;
    }
  }

  // ============================================================================
  // User Search Operations
  // ============================================================================

  /**
   * Search for users by email
   */
  async searchUsers(searchEmail: string, limit: number = 20): Promise<SearchUserResult[]> {
    try {
      const result = await window.scribeCat.friends.searchUsers(searchEmail, limit);

      if (result.success) {
        return result.users || [];
      } else {
        logger.error('Failed to search users:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception searching users:', error);
      throw error;
    }
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<SearchUserResult | null> {
    try {
      const result = await window.scribeCat.friends.getUserProfile(userId);

      if (result.success && result.profile) {
        return result.profile;
      } else {
        logger.error('Failed to get user profile:', result.error);
        return null;
      }
    } catch (error) {
      logger.error('Exception getting user profile:', error);
      return null;
    }
  }

  // ============================================================================
  // Listeners
  // ============================================================================

  /**
   * Add a listener for friends list changes
   */
  addFriendsListener(listener: FriendsChangeListener): void {
    this.friendsListeners.add(listener);
  }

  /**
   * Remove a friends list listener
   */
  removeFriendsListener(listener: FriendsChangeListener): void {
    this.friendsListeners.delete(listener);
  }

  /**
   * Notify all friends listeners
   */
  private notifyFriendsListeners(): void {
    for (const listener of this.friendsListeners) {
      try {
        listener(this.friends);
      } catch (error) {
        logger.error('Error in friends listener:', error);
      }
    }
  }

  /**
   * Add a listener for friend requests changes
   */
  addRequestsListener(listener: RequestsChangeListener): void {
    this.requestsListeners.add(listener);
  }

  /**
   * Remove a requests listener
   */
  removeRequestsListener(listener: RequestsChangeListener): void {
    this.requestsListeners.delete(listener);
  }

  /**
   * Notify all requests listeners
   */
  private notifyRequestsListeners(): void {
    for (const listener of this.requestsListeners) {
      try {
        listener(this.friendRequests);
      } catch (error) {
        logger.error('Error in requests listener:', error);
      }
    }
  }

  /**
   * Refresh all data
   */
  async refresh(): Promise<void> {
    await Promise.all([
      this.loadFriends(),
      this.loadFriendRequests(),
    ]);
  }

  // ============================================================================
  // Presence Tracking
  // ============================================================================

  /**
   * Start presence tracking for the current user
   * - Sets user status to online
   * - Starts heartbeat to keep presence updated
   * - Subscribes to friends' presence changes
   */
  private async startPresenceTracking(): Promise<void> {
    if (!this.currentUserId) {
      logger.warn('Cannot start presence tracking: No user ID');
      return;
    }

    try {
      // Set initial presence to online
      await this.updatePresence('online');

      // Start heartbeat to update presence every 30 seconds
      this.heartbeatInterval = setInterval(async () => {
        try {
          await this.updatePresence('online');
        } catch (error) {
          logger.error('Heartbeat presence update failed:', error);
        }
      }, this.HEARTBEAT_INTERVAL_MS);

      // Subscribe to friends' presence updates
      await this.subscribeToPresenceUpdates();

      // Note: loadFriendsPresence() is now called automatically after loadFriends()
      // so we don't need to call it here

      logger.info('Presence tracking started');
    } catch (error) {
      logger.error('Failed to start presence tracking:', error);
    }
  }

  /**
   * Stop presence tracking
   * - Clears heartbeat interval
   * - Sets user to offline
   * - Unsubscribes from presence updates
   */
  private async stopPresenceTracking(): Promise<void> {
    try {
      // Clear heartbeat interval
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Set user to offline
      if (this.currentUserId) {
        await this.updatePresence('offline');
      }

      // Unsubscribe from presence updates (direct channel cleanup)
      if (this.presenceChannel) {
        logger.info('🔒 FriendsManager: Unsubscribing from presence channel');
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
  private async updatePresence(status: 'online' | 'away' | 'offline', activity?: string): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const result = await window.scribeCat.friends.updatePresence({
        userId: this.currentUserId,
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
   * Example: "Studying PSYCH101", "In Quiz Battle", etc.
   */
  async setActivity(activity: string | undefined): Promise<void> {
    await this.updatePresence('online', activity);
  }

  /**
   * Load friends' presence data
   */
  private async loadFriendsPresence(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      const result = await window.scribeCat.friends.getFriendsPresence(this.currentUserId);

      if (result.success && result.presence) {
        this.updateFriendsWithPresence(result.presence);
      }
    } catch (error) {
      logger.error('Failed to load friends presence:', error);
    }
  }

  /**
   * Subscribe to real-time presence updates from friends
   * Uses direct Supabase Realtime subscription in renderer process
   * (WebSockets don't work in Electron's main process - no browser APIs)
   */
  private async subscribeToPresenceUpdates(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      logger.info('📡 FriendsManager: Setting up direct Supabase presence subscription in renderer');

      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();

      if (!client) {
        logger.error('❌ FriendsManager: No Supabase client available in renderer');
        return;
      }

      const channelName = `presence:user:${this.currentUserId}`;

      // Remove existing subscription if any
      if (this.presenceChannel) {
        logger.info('🔄 Removing existing presence channel');
        this.presenceChannel.unsubscribe();
        client.removeChannel(this.presenceChannel);
        this.presenceChannel = null;
      }

      // Create new channel for presence updates
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
            logger.debug('🔥 FriendsManager: Presence change received:', payload);

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const data = payload.new as {
                user_id: string;
                status: 'online' | 'away' | 'offline';
                activity?: string;
                last_seen: string;
              };

              // Check if this is a friend's update (we have the friends list locally)
              const isFriend = this.friends.some(f => f.friendId === data.user_id);

              if (isFriend) {
                logger.info(`📡 FriendsManager: Friend ${data.user_id} presence updated: ${data.status}`);
                this.handlePresenceUpdate(data.user_id, {
                  status: data.status,
                  activity: data.activity,
                  lastSeen: new Date(data.last_seen),
                });
              }
            }
          }
        );

      // Subscribe and log status
      this.presenceChannel.subscribe((status, err) => {
        logger.info('📡 FriendsManager: Presence subscription status:', status);
        if (err) {
          logger.error('❌ FriendsManager: Presence subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          logger.info('✅ FriendsManager: Successfully subscribed to presence in RENDERER process');
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('❌ FriendsManager: Presence channel error');
        } else if (status === 'TIMED_OUT') {
          logger.error('⏱️ FriendsManager: Presence subscription timed out');
        }
      });

      logger.info('Subscribed to friends presence updates (direct renderer subscription)');
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
    let updated = false;

    this.friends = this.friends.map(friend => {
      const presence = presenceMap[friend.friendId];
      if (presence) {
        updated = true;
        return {
          ...friend,
          isOnline: presence.status === 'online',
          currentActivity: presence.activity,
          lastSeen: new Date(presence.lastSeen),
        };
      }
      return friend;
    });

    if (updated) {
      this.notifyFriendsListeners();
      logger.debug('Updated presence for', Object.keys(presenceMap).length, 'friends');
    }
  }

  /**
   * Handle incoming presence update for a single friend
   */
  private handlePresenceUpdate(friendId: string, presence: {
    status: 'online' | 'away' | 'offline';
    activity?: string;
    lastSeen: Date;
  }): void {
    const friendIndex = this.friends.findIndex(f => f.friendId === friendId);

    if (friendIndex !== -1) {
      this.friends[friendIndex] = {
        ...this.friends[friendIndex],
        isOnline: presence.status === 'online',
        currentActivity: presence.activity,
        lastSeen: presence.lastSeen,
      };

      this.notifyFriendsListeners();
      logger.debug(`Presence updated for friend ${friendId}: ${presence.status}`);
    }
  }

  // ============================================================================
  // Friend Request Realtime Subscriptions
  // ============================================================================

  /**
   * Subscribe to real-time friend request updates
   * Uses direct Supabase Realtime subscription in renderer process
   * (WebSockets don't work in Electron's main process - no browser APIs)
   */
  private async subscribeToRequests(): Promise<void> {
    if (!this.currentUserId) return;

    try {
      logger.info('📡 FriendsManager: Setting up direct Supabase friend request subscription in renderer');

      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();

      if (!client) {
        logger.error('❌ FriendsManager: No Supabase client available in renderer');
        return;
      }

      const channelName = `user-friend-requests:${this.currentUserId}`;

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
            filter: `recipient_id=eq.${this.currentUserId}`,
          },
          async (payload) => {
            logger.info('🔥 FriendsManager: New friend request received:', payload);

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
            filter: `recipient_id=eq.${this.currentUserId}`,
          },
          async (payload) => {
            logger.info('🔥 FriendsManager: Friend request updated:', payload);

            // Fetch full friend request with profile data
            const friendRequest = await this.fetchFriendRequestById(payload.new.id as string);
            if (friendRequest) {
              this.handleRequestChange(friendRequest, 'UPDATE');
            }
          }
        );

      // Subscribe and log status
      this.friendRequestChannel.subscribe((status, err) => {
        logger.info('📡 FriendsManager: Friend request subscription status:', status);
        if (err) {
          logger.error('❌ FriendsManager: Friend request subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          logger.info('✅ FriendsManager: Successfully subscribed to friend requests in RENDERER process');
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('❌ FriendsManager: Friend request channel error');
        } else if (status === 'TIMED_OUT') {
          logger.error('⏱️ FriendsManager: Friend request subscription timed out');
        }
      });

      logger.info('Subscribed to friend request real-time updates (direct renderer subscription)');
    } catch (error) {
      logger.error('Exception subscribing to friend request changes:', error);
    }
  }

  /**
   * Fetch friend request by ID with full profile data
   * Helper method for realtime subscription - runs in renderer using RendererSupabaseClient
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
   * Unsubscribe from real-time friend request updates
   */
  private unsubscribeFromRequests(): void {
    if (this.friendRequestChannel) {
      logger.info('🔒 FriendsManager: Unsubscribing from friend request channel');
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
   * Handle real-time friend request change events
   */
  private handleRequestChange(friendRequest: FriendRequestData, eventType: 'INSERT' | 'UPDATE'): void {
    try {
      logger.info('Friend request change event:', eventType, friendRequest);

      if (eventType === 'INSERT') {
        // New friend request received - add to local state
        const existingIndex = this.friendRequests.findIndex(req => req.id === friendRequest.id);
        if (existingIndex === -1) {
          this.friendRequests.push(friendRequest);
        }
      } else if (eventType === 'UPDATE') {
        // Friend request status updated - update local state
        const existingIndex = this.friendRequests.findIndex(req => req.id === friendRequest.id);
        if (existingIndex !== -1) {
          this.friendRequests[existingIndex] = friendRequest;
        }
      }

      this.notifyRequestsListeners();
    } catch (error) {
      logger.error('Error handling friend request change:', error);
    }
  }
}
