/**
 * FriendsManager
 *
 * Manages friend relationships and friend requests in the renderer process.
 * Coordinates with FriendsModal and handles IPC communication with main process.
 */

import { createLogger } from '../../../shared/logger.js';
import type { FriendData } from '../../../domain/entities/Friend.js';
import type { FriendRequestData } from '../../../domain/entities/FriendRequest.js';
import type { SearchUserResult } from '../../../infrastructure/services/supabase/SupabaseFriendsRepository.js';

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

    logger.info('FriendsManager initialized for user:', userId);
  }

  /**
   * Clear all data (on sign out)
   */
  async clear(): Promise<void> {
    // Stop presence tracking
    await this.stopPresenceTracking();

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

      // Load initial friends presence
      await this.loadFriendsPresence();

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

      // Unsubscribe from presence updates
      if (this.currentUserId) {
        await window.scribeCat.friends.unsubscribeFromPresence(this.currentUserId);
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
        // Update friends with presence data
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
    if (!this.currentUserId) return;

    try {
      // Listen for presence updates from IPC
      window.scribeCat.friends.onPresenceUpdate((data) => {
        this.handlePresenceUpdate(data.friendId, {
          status: data.presence.status,
          activity: data.presence.activity,
          lastSeen: new Date(data.presence.lastSeen),
        });
      });

      const result = await window.scribeCat.friends.subscribeToPresence(this.currentUserId);

      if (result.success) {
        logger.info('Subscribed to friends presence updates');
      }
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
}
