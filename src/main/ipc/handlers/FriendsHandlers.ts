/**
 * FriendsHandlers
 *
 * IPC handlers for friend and friend request operations.
 */

import type { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import { SupabaseFriendsRepository } from '../../../infrastructure/services/supabase/SupabaseFriendsRepository.js';
import { SupabasePresenceRepository } from '../../../infrastructure/services/supabase/SupabasePresenceRepository.js';

export class FriendsHandlers extends BaseHandler {
  private currentUserId: string | null = null;
  private friendsRepository: SupabaseFriendsRepository;
  private presenceRepository: SupabasePresenceRepository;

  constructor() {
    super();
    this.friendsRepository = new SupabaseFriendsRepository();
    this.presenceRepository = new SupabasePresenceRepository();
  }

  /** Set the current user ID for access checks */
  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
  }

  register(ipcMain: IpcMain): void {
    // ========================================================================
    // Friend Operations
    // ========================================================================

    /**
     * Get all friends for the current user
     */
    this.handle(ipcMain, 'friends:getFriends', async (_event) => {
      try {
        if (!this.currentUserId) {
          return {
            success: false,
            friends: [],
            error: 'Not authenticated',
          };
        }

        const friends = await this.friendsRepository.getFriends(this.currentUserId);

        return {
          success: true,
          friends: friends.map(f => f.toJSON()),
        };
      } catch (error) {
        console.error('Error in friends:getFriends:', error);
        return {
          success: false,
          friends: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    /**
     * Get friends count for the current user
     */
    this.handle(ipcMain, 'friends:getFriendsCount', async (_event) => {
      try {
        if (!this.currentUserId) {
          return { success: false, count: 0, error: 'Not authenticated' };
        }

        const count = await this.friendsRepository.getFriendsCount(this.currentUserId);

        return { success: true, count };
      } catch (error) {
        console.error('Error in friends:getFriendsCount:', error);
        return {
          success: false,
          count: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    /**
     * Remove a friend (unfriend)
     */
    this.handle(ipcMain, 'friends:removeFriend', async (_event, friendId: string) => {
      try {
        if (!this.currentUserId) {
          return { success: false, error: 'Not authenticated' };
        }

        await this.friendsRepository.removeFriend(this.currentUserId, friendId);

        return { success: true };
      } catch (error) {
        console.error('Error in friends:removeFriend:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    /**
     * Check if two users are friends
     */
    this.handle(ipcMain, 'friends:areFriends', async (_event, userId: string) => {
      try {
        if (!this.currentUserId) {
          return { success: false, areFriends: false, error: 'Not authenticated' };
        }

        const areFriends = await this.friendsRepository.areFriends(this.currentUserId, userId);

        return { success: true, areFriends };
      } catch (error) {
        console.error('Error in friends:areFriends:', error);
        return {
          success: false,
          areFriends: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    /**
     * Get mutual friends count
     */
    this.handle(ipcMain, 'friends:getMutualFriendsCount', async (_event, userId: string) => {
      try {
        if (!this.currentUserId) {
          return { success: false, count: 0, error: 'Not authenticated' };
        }

        const count = await this.friendsRepository.getMutualFriendsCount(this.currentUserId, userId);

        return { success: true, count };
      } catch (error) {
        console.error('Error in friends:getMutualFriendsCount:', error);
        return {
          success: false,
          count: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // ========================================================================
    // Friend Request Operations
    // ========================================================================

    /**
     * Get all friend requests (incoming and outgoing)
     */
    this.handle(ipcMain, 'friends:getFriendRequests', async (_event) => {
      try {
        if (!this.currentUserId) {
          return {
            success: false,
            requests: [],
            error: 'Not authenticated',
          };
        }

        const requests = await this.friendsRepository.getFriendRequests(this.currentUserId);

        return {
          success: true,
          requests: requests.map(r => r.toJSON()),
        };
      } catch (error) {
        console.error('Error in friends:getFriendRequests:', error);
        return {
          success: false,
          requests: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    /**
     * Get incoming friend requests
     */
    this.handle(ipcMain, 'friends:getIncomingRequests', async (_event) => {
      try {
        if (!this.currentUserId) {
          return {
            success: false,
            requests: [],
            error: 'Not authenticated',
          };
        }

        const requests = await this.friendsRepository.getIncomingFriendRequests(this.currentUserId);

        return {
          success: true,
          requests: requests.map(r => r.toJSON()),
        };
      } catch (error) {
        console.error('Error in friends:getIncomingRequests:', error);
        return {
          success: false,
          requests: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    /**
     * Get outgoing friend requests
     */
    this.handle(ipcMain, 'friends:getOutgoingRequests', async (_event) => {
      try {
        if (!this.currentUserId) {
          return {
            success: false,
            requests: [],
            error: 'Not authenticated',
          };
        }

        const requests = await this.friendsRepository.getOutgoingFriendRequests(this.currentUserId);

        return {
          success: true,
          requests: requests.map(r => r.toJSON()),
        };
      } catch (error) {
        console.error('Error in friends:getOutgoingRequests:', error);
        return {
          success: false,
          requests: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    /**
     * Get count of incoming friend requests
     */
    this.handle(ipcMain, 'friends:getIncomingRequestsCount', async (_event) => {
      try {
        if (!this.currentUserId) {
          return { success: false, count: 0, error: 'Not authenticated' };
        }

        const count = await this.friendsRepository.getIncomingRequestsCount(this.currentUserId);

        return { success: true, count };
      } catch (error) {
        console.error('Error in friends:getIncomingRequestsCount:', error);
        return {
          success: false,
          count: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    /**
     * Send a friend request
     */
    this.handle(ipcMain, 'friends:sendRequest', async (_event, recipientId: string) => {
      try {
        if (!this.currentUserId) {
          return { success: false, error: 'Not authenticated' };
        }

        const request = await this.friendsRepository.sendFriendRequest(this.currentUserId, recipientId);

        return {
          success: true,
          request: request.toJSON(),
        };
      } catch (error) {
        console.error('Error in friends:sendRequest:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    /**
     * Accept a friend request
     */
    this.handle(ipcMain, 'friends:acceptRequest', async (_event, requestId: string) => {
      try {
        if (!this.currentUserId) {
          return { success: false, error: 'Not authenticated' };
        }

        await this.friendsRepository.acceptFriendRequest(requestId, this.currentUserId);

        return { success: true };
      } catch (error) {
        console.error('Error in friends:acceptRequest:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    /**
     * Reject a friend request
     */
    this.handle(ipcMain, 'friends:rejectRequest', async (_event, requestId: string) => {
      try {
        if (!this.currentUserId) {
          return { success: false, error: 'Not authenticated' };
        }

        await this.friendsRepository.rejectFriendRequest(requestId, this.currentUserId);

        return { success: true };
      } catch (error) {
        console.error('Error in friends:rejectRequest:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    /**
     * Cancel a friend request (sender only)
     */
    this.handle(ipcMain, 'friends:cancelRequest', async (_event, requestId: string) => {
      try {
        if (!this.currentUserId) {
          return { success: false, error: 'Not authenticated' };
        }

        await this.friendsRepository.cancelFriendRequest(requestId, this.currentUserId);

        return { success: true };
      } catch (error) {
        console.error('Error in friends:cancelRequest:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // ========================================================================
    // User Search Operations
    // ========================================================================

    /**
     * Search for users by email
     */
    this.handle(ipcMain, 'friends:searchUsers', async (_event, searchEmail: string, limit: number = 20) => {
      try {
        if (!this.currentUserId) {
          return {
            success: false,
            users: [],
            error: 'Not authenticated',
          };
        }

        const users = await this.friendsRepository.searchUsersByEmail(searchEmail, this.currentUserId, limit);

        return {
          success: true,
          users,
        };
      } catch (error) {
        console.error('Error in friends:searchUsers:', error);
        return {
          success: false,
          users: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    /**
     * Get user profile by ID
     */
    this.handle(ipcMain, 'friends:getUserProfile', async (_event, userId: string) => {
      try {
        const profile = await this.friendsRepository.getUserProfile(userId);

        if (!profile) {
          return {
            success: false,
            error: 'User not found',
          };
        }

        return {
          success: true,
          profile,
        };
      } catch (error) {
        console.error('Error in friends:getUserProfile:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // ========================================================================
    // Presence Operations
    // ========================================================================

    /**
     * Update user's presence status
     */
    this.handle(
      ipcMain,
      'friends:updatePresence',
      async (_event, params: { userId: string; status: 'online' | 'away' | 'offline'; activity?: string }) => {
        try {
          console.log('[FriendsHandlers] Received updatePresence IPC call:', params);
          await this.presenceRepository.updatePresence(params);
          console.log('[FriendsHandlers] updatePresence completed successfully');

          return { success: true };
        } catch (error) {
          console.error('[FriendsHandlers] Error in friends:updatePresence:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }
    );

    /**
     * Get presence data for a specific user
     */
    this.handle(ipcMain, 'friends:getUserPresence', async (_event, userId: string) => {
      try {
        const presence = await this.presenceRepository.getUserPresence(userId);

        if (!presence) {
          return {
            success: false,
            presence: null,
            error: 'User presence not found',
          };
        }

        return {
          success: true,
          presence: {
            userId: presence.userId,
            status: presence.status,
            activity: presence.activity,
            lastSeen: presence.lastSeen.toISOString(),
          },
        };
      } catch (error) {
        console.error('Error in friends:getUserPresence:', error);
        return {
          success: false,
          presence: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    /**
     * Get presence data for all friends of a user
     */
    this.handle(ipcMain, 'friends:getFriendsPresence', async (_event, userId: string) => {
      try {
        console.log('[FriendsHandlers] Received getFriendsPresence IPC call for user:', userId);
        const presenceMap = await this.presenceRepository.getFriendsPresence(userId);

        // Convert Map to plain object for IPC serialization
        const presenceObj: Record<string, any> = {};
        for (const [friendId, presence] of presenceMap.entries()) {
          presenceObj[friendId] = {
            status: presence.status,
            activity: presence.activity,
            lastSeen: presence.lastSeen.toISOString(),
          };
        }

        console.log('[FriendsHandlers] Returning presence for', Object.keys(presenceObj).length, 'friends');
        return {
          success: true,
          presence: presenceObj,
        };
      } catch (error) {
        console.error('[FriendsHandlers] Error in friends:getFriendsPresence:', error);
        return {
          success: false,
          presence: {},
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    /**
     * Set user to offline status
     */
    this.handle(ipcMain, 'friends:setOffline', async (_event, userId: string) => {
      try {
        await this.presenceRepository.setOffline(userId);

        return { success: true };
      } catch (error) {
        console.error('Error in friends:setOffline:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * Cleanup method called on app shutdown
   * Sets current user offline
   */
  async cleanup(): Promise<void> {
    console.log('[FriendsHandlers] Cleaning up on app quit');

    // Set current user offline if authenticated
    if (this.currentUserId) {
      try {
        console.log(`[FriendsHandlers] Setting user ${this.currentUserId} offline`);
        await this.presenceRepository.setOffline(this.currentUserId);
      } catch (error) {
        console.error('[FriendsHandlers] Error setting user offline during cleanup:', error);
      }
    }

    console.log('[FriendsHandlers] Cleanup complete');
  }
}
