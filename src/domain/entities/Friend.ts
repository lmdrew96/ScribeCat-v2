/**
 * Friend Domain Entity
 * Represents a friendship relationship with another user's profile data
 */

export interface FriendData {
  readonly id: string;
  readonly userId: string;
  readonly friendId: string;
  readonly friendEmail: string;
  readonly friendFullName?: string;
  readonly friendAvatarUrl?: string;
  readonly createdAt: Date;
  readonly isOnline?: boolean;
  readonly currentActivity?: string;
  readonly lastSeen?: Date;
}

/**
 * Friend entity representing a friendship relationship
 * Includes friend's user profile data for display purposes
 */
export class Friend {
  private constructor(private readonly data: FriendData) {
    this.validate();
  }

  /**
   * Factory method to create a new Friend instance
   */
  static create(data: FriendData): Friend {
    return new Friend(data);
  }

  /**
   * Factory method to create Friend from database row
   */
  static fromDatabase(row: {
    id: string;
    user_id: string;
    friend_id: string;
    created_at: string | Date;
    // Joined user_profiles data
    email?: string;
    full_name?: string;
    avatar_url?: string;
    // Optional presence data
    is_online?: boolean;
    current_activity?: string;
    last_seen?: string | Date;
  }): Friend {
    return Friend.create({
      id: row.id,
      userId: row.user_id,
      friendId: row.friend_id,
      friendEmail: row.email || '',
      friendFullName: row.full_name,
      friendAvatarUrl: row.avatar_url,
      createdAt: typeof row.created_at === 'string' ? new Date(row.created_at) : row.created_at,
      isOnline: row.is_online,
      currentActivity: row.current_activity,
      lastSeen: row.last_seen ? (typeof row.last_seen === 'string' ? new Date(row.last_seen) : row.last_seen) : undefined,
    });
  }

  /**
   * Validate the friend data
   */
  private validate(): void {
    if (!this.data.id) {
      throw new Error('Friend ID is required');
    }
    if (!this.data.userId) {
      throw new Error('User ID is required');
    }
    if (!this.data.friendId) {
      throw new Error('Friend ID is required');
    }
    if (this.data.userId === this.data.friendId) {
      throw new Error('User cannot be friends with themselves');
    }
    if (!this.data.friendEmail) {
      throw new Error('Friend email is required');
    }
    if (!this.data.createdAt) {
      throw new Error('Created at date is required');
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get id(): string {
    return this.data.id;
  }

  get userId(): string {
    return this.data.userId;
  }

  get friendId(): string {
    return this.data.friendId;
  }

  get friendEmail(): string {
    return this.data.friendEmail;
  }

  get friendFullName(): string | undefined {
    return this.data.friendFullName;
  }

  get friendAvatarUrl(): string | undefined {
    return this.data.friendAvatarUrl;
  }

  get createdAt(): Date {
    return this.data.createdAt;
  }

  get isOnline(): boolean {
    return this.data.isOnline || false;
  }

  get currentActivity(): string | undefined {
    return this.data.currentActivity;
  }

  get lastSeen(): Date | undefined {
    return this.data.lastSeen;
  }

  // ============================================================================
  // Business Logic Methods
  // ============================================================================

  /**
   * Get display name for the friend (full name or email)
   */
  getDisplayName(): string {
    if (this.data.friendFullName && this.data.friendFullName.trim()) {
      return this.data.friendFullName;
    }
    return this.data.friendEmail;
  }

  /**
   * Get initials for avatar display
   */
  getInitials(): string {
    const name = this.getDisplayName();
    const parts = name.split(/[\s@]+/);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Check if friend is currently online
   */
  isCurrentlyOnline(): boolean {
    return this.data.isOnline === true;
  }

  /**
   * Check if friend was recently online (within last 10 minutes)
   */
  isRecentlyOnline(): boolean {
    if (!this.data.lastSeen) {
      return false;
    }
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    return this.data.lastSeen > tenMinutesAgo;
  }

  /**
   * Get human-readable status text
   */
  getStatusText(): string {
    if (this.isCurrentlyOnline()) {
      if (this.data.currentActivity) {
        return this.data.currentActivity;
      }
      return 'Online';
    }

    if (this.isRecentlyOnline()) {
      return 'Recently online';
    }

    if (this.data.lastSeen) {
      return this.formatLastSeen(this.data.lastSeen);
    }

    return 'Offline';
  }

  /**
   * Format last seen time as human-readable string
   */
  private formatLastSeen(lastSeen: Date): string {
    const now = Date.now();
    const diff = now - lastSeen.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return lastSeen.toLocaleDateString();
    }
  }

  /**
   * Get friendship duration in days
   */
  getFriendshipDays(): number {
    const now = Date.now();
    const diff = now - this.data.createdAt.getTime();
    return Math.floor(diff / 86400000);
  }

  /**
   * Check if this is a new friendship (less than 7 days)
   */
  isNewFriend(): boolean {
    return this.getFriendshipDays() < 7;
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): FriendData {
    return { ...this.data };
  }

  /**
   * Create a copy with updated presence data
   */
  withPresence(presence: {
    isOnline?: boolean;
    currentActivity?: string;
    lastSeen?: Date;
  }): Friend {
    return Friend.create({
      ...this.data,
      ...presence,
    });
  }
}
