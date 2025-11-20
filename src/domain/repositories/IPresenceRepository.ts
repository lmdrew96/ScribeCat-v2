/**
 * Presence Repository Interface
 * Defines operations for managing user presence and activity status
 */

export type UserStatus = 'online' | 'away' | 'offline';

export interface PresenceData {
  userId: string;
  status: UserStatus;
  activity?: string;
  lastSeen: Date;
}

export interface UpdatePresenceParams {
  userId: string;
  status: UserStatus;
  activity?: string;
}

export interface IPresenceRepository {
  /**
   * Update user's presence status
   */
  updatePresence(params: UpdatePresenceParams): Promise<void>;

  /**
   * Get presence data for a specific user
   */
  getUserPresence(userId: string): Promise<PresenceData | null>;

  /**
   * Get presence data for all friends of a user
   */
  getFriendsPresence(userId: string): Promise<Map<string, PresenceData>>;

  /**
   * Subscribe to presence updates for a user's friends
   * Returns an unsubscribe function
   */
  subscribeToFriendsPresence(
    userId: string,
    onUpdate: (friendId: string, presence: PresenceData) => void
  ): () => Promise<void>;

  /**
   * Set user to offline status
   */
  setOffline(userId: string): Promise<void>;

  /**
   * Unsubscribe from all presence subscriptions
   */
  unsubscribeAll(): Promise<void>;
}
