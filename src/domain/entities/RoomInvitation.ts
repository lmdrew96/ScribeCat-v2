/**
 * RoomInvitation Entity
 *
 * Represents an invitation to join a study room.
 * Host can invite friends, invitees can accept or decline.
 */

export type RoomInvitationStatus = 'pending' | 'accepted' | 'declined';

export interface RoomInvitationData {
  readonly id: string;
  readonly roomId: string;
  readonly roomName?: string;
  readonly inviterId: string;
  readonly inviterEmail: string;
  readonly inviterFullName?: string;
  readonly inviterAvatarUrl?: string;
  readonly inviteeId: string;
  readonly inviteeEmail: string;
  readonly inviteeFullName?: string;
  readonly inviteeAvatarUrl?: string;
  readonly status: RoomInvitationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * RoomInvitation domain entity
 */
export class RoomInvitation {
  constructor(private readonly data: RoomInvitationData) {}

  /**
   * Create RoomInvitation from database row
   */
  static fromDatabase(row: {
    id: string;
    room_id: string;
    inviter_id: string;
    invitee_id: string;
    status: string;
    created_at: string | Date;
    updated_at: string | Date;
    room_name?: string | null;
    inviter_email?: string;
    inviter_full_name?: string | null;
    inviter_avatar_url?: string | null;
    invitee_email?: string;
    invitee_full_name?: string | null;
    invitee_avatar_url?: string | null;
  }): RoomInvitation {
    return new RoomInvitation({
      id: row.id,
      roomId: row.room_id,
      roomName: row.room_name || undefined,
      inviterId: row.inviter_id,
      inviterEmail: row.inviter_email || '',
      inviterFullName: row.inviter_full_name || undefined,
      inviterAvatarUrl: row.inviter_avatar_url || undefined,
      inviteeId: row.invitee_id,
      inviteeEmail: row.invitee_email || '',
      inviteeFullName: row.invitee_full_name || undefined,
      inviteeAvatarUrl: row.invitee_avatar_url || undefined,
      status: row.status as RoomInvitationStatus,
      createdAt: typeof row.created_at === 'string' ? new Date(row.created_at) : row.created_at,
      updatedAt: typeof row.updated_at === 'string' ? new Date(row.updated_at) : row.updated_at,
    });
  }

  /**
   * Get invitation data as JSON
   */
  toJSON(): RoomInvitationData {
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

  get inviterId(): string {
    return this.data.inviterId;
  }

  get inviteeId(): string {
    return this.data.inviteeId;
  }

  get status(): RoomInvitationStatus {
    return this.data.status;
  }

  get createdAt(): Date {
    return this.data.createdAt;
  }

  // ============================================================================
  // Business Logic
  // ============================================================================

  /**
   * Check if invitation is pending
   */
  isPending(): boolean {
    return this.data.status === 'pending';
  }

  /**
   * Check if invitation is accepted
   */
  isAccepted(): boolean {
    return this.data.status === 'accepted';
  }

  /**
   * Check if invitation is declined
   */
  isDeclined(): boolean {
    return this.data.status === 'declined';
  }

  /**
   * Check if user is the inviter
   */
  isInviter(userId: string): boolean {
    return this.data.inviterId === userId;
  }

  /**
   * Check if user is the invitee
   */
  isInvitee(userId: string): boolean {
    return this.data.inviteeId === userId;
  }

  /**
   * Get inviter display name
   */
  getInviterDisplayName(): string {
    return this.data.inviterFullName || this.data.inviterEmail.split('@')[0] || 'Unknown';
  }

  /**
   * Get inviter initials
   */
  getInviterInitials(): string {
    if (this.data.inviterFullName) {
      const parts = this.data.inviterFullName.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return this.data.inviterFullName.substring(0, 2).toUpperCase();
    }
    return this.data.inviterEmail.substring(0, 2).toUpperCase();
  }

  /**
   * Get invitee display name
   */
  getInviteeDisplayName(): string {
    return this.data.inviteeFullName || this.data.inviteeEmail.split('@')[0] || 'Unknown';
  }

  /**
   * Get invitee initials
   */
  getInviteeInitials(): string {
    if (this.data.inviteeFullName) {
      const parts = this.data.inviteeFullName.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return this.data.inviteeFullName.substring(0, 2).toUpperCase();
    }
    return this.data.inviteeEmail.substring(0, 2).toUpperCase();
  }

  /**
   * Get room name or fallback
   */
  getRoomName(): string {
    return this.data.roomName || 'Study Room';
  }

  /**
   * Get status badge color
   */
  getStatusColor(): string {
    switch (this.data.status) {
      case 'pending':
        return '#007bff'; // Blue
      case 'accepted':
        return '#28a745'; // Green
      case 'declined':
        return '#dc3545'; // Red
      default:
        return '#6c757d'; // Gray
    }
  }

  /**
   * Get time since invitation
   */
  getTimeSinceInvitation(): string {
    const now = new Date();
    const diff = now.getTime() - this.data.createdAt.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }

  /**
   * Get invitation message for UI
   */
  getInvitationMessage(currentUserId: string): string {
    if (this.isInvitee(currentUserId)) {
      return `${this.getInviterDisplayName()} invited you to join "${this.getRoomName()}"`;
    } else {
      return `You invited ${this.getInviteeDisplayName()} to join "${this.getRoomName()}"`;
    }
  }
}
