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
 */
export class FriendsManager {
  private friends: FriendData[] = [];
  private friendRequests: FriendRequestData[] = [];
  private currentUserId: string | null = null;

  private friendsListeners: Set<FriendsChangeListener> = new Set();
  private requestsListeners: Set<RequestsChangeListener> = new Set();

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
    logger.info('FriendsManager initialized for user:', userId);
  }

  /**
   * Clear all data (on sign out)
   */
  clear(): void {
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
}
