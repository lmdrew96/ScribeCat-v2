/**
 * RoomParticipant Entity
 *
 * Represents a user participating in a study room.
 * Tracks join/leave times and active status.
 */

export interface RoomParticipantData {
  readonly id: string;
  readonly roomId: string;
  readonly userId: string;
  readonly userEmail: string;
  readonly userFullName?: string;
  readonly userAvatarUrl?: string;
  readonly joinedAt: Date;
  readonly leftAt?: Date;
  readonly isActive: boolean;
}

/**
 * RoomParticipant domain entity
 */
export class RoomParticipant {
  constructor(private readonly data: RoomParticipantData) {}

  /**
   * Create RoomParticipant from database row
   */
  static fromDatabase(row: {
    id: string;
    room_id: string;
    user_id: string;
    joined_at: string | Date;
    left_at?: string | Date | null;
    is_active: boolean;
    user_email?: string;
    user_full_name?: string | null;
    user_avatar_url?: string | null;
  }): RoomParticipant {
    return new RoomParticipant({
      id: row.id,
      roomId: row.room_id,
      userId: row.user_id,
      userEmail: row.user_email || '',
      userFullName: row.user_full_name || undefined,
      userAvatarUrl: row.user_avatar_url || undefined,
      joinedAt: typeof row.joined_at === 'string' ? new Date(row.joined_at) : row.joined_at,
      leftAt: row.left_at
        ? typeof row.left_at === 'string'
          ? new Date(row.left_at)
          : row.left_at
        : undefined,
      isActive: row.is_active,
    });
  }

  /**
   * Get participant data as JSON
   */
  toJSON(): RoomParticipantData {
    return { ...this.data };
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get id(): string {
    return this.data.id;
  }

  get roomId(): string {
    return this.data.roomId;
  }

  get userId(): string {
    return this.data.userId;
  }

  get isActive(): boolean {
    return this.data.isActive;
  }

  get joinedAt(): Date {
    return this.data.joinedAt;
  }

  get leftAt(): Date | undefined {
    return this.data.leftAt;
  }

  // ============================================================================
  // Business Logic
  // ============================================================================

  /**
   * Check if this is the current user
   */
  isCurrentUser(userId: string): boolean {
    return this.data.userId === userId;
  }

  /**
   * Get user display name
   */
  getDisplayName(): string {
    return this.data.userFullName || this.data.userEmail.split('@')[0] || 'Unknown';
  }

  /**
   * Get user initials for avatar
   */
  getInitials(): string {
    if (this.data.userFullName) {
      const parts = this.data.userFullName.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return this.data.userFullName.substring(0, 2).toUpperCase();
    }
    return this.data.userEmail.substring(0, 2).toUpperCase();
  }

  /**
   * Get status text
   */
  getStatusText(): string {
    if (!this.data.isActive && this.data.leftAt) {
      return `Left ${this.getTimeSinceLeft()}`;
    }
    return 'Active';
  }

  /**
   * Get time in room
   */
  getTimeInRoom(): string {
    const endTime = this.data.leftAt || new Date();
    const diff = endTime.getTime() - this.data.joinedAt.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Get time since joined
   */
  getTimeSinceJoined(): string {
    const now = new Date();
    const diff = now.getTime() - this.data.joinedAt.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }

  /**
   * Get time since left
   */
  getTimeSinceLeft(): string {
    if (!this.data.leftAt) return '';

    const now = new Date();
    const diff = now.getTime() - this.data.leftAt.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }
}
