/**
 * StudyRoom Entity
 *
 * Represents a collaborative study room where friends can study together.
 * Each room has a host, a shared session copy, and multiple participants.
 */

export interface StudyRoomData {
  readonly id: string;
  readonly name: string;
  readonly hostId: string;
  readonly hostEmail: string;
  readonly hostFullName?: string;
  readonly hostAvatarUrl?: string;
  readonly sessionId: string | null;
  readonly sessionTitle?: string;
  readonly maxParticipants: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly closedAt?: Date;
  readonly participantCount?: number;
}

/**
 * StudyRoom domain entity
 */
export class StudyRoom {
  constructor(private readonly data: StudyRoomData) {}

  /**
   * Create StudyRoom from database row
   */
  static fromDatabase(row: {
    id: string;
    name: string;
    host_id: string;
    session_id: string | null;
    max_participants: number;
    is_active: boolean;
    created_at: string | Date;
    updated_at: string | Date;
    closed_at?: string | Date | null;
    host_email?: string;
    host_full_name?: string | null;
    host_avatar_url?: string | null;
    session_title?: string | null;
    participant_count?: number;
  }): StudyRoom {
    return new StudyRoom({
      id: row.id,
      name: row.name,
      hostId: row.host_id,
      hostEmail: row.host_email || '',
      hostFullName: row.host_full_name || undefined,
      hostAvatarUrl: row.host_avatar_url || undefined,
      sessionId: row.session_id,
      sessionTitle: row.session_title || undefined,
      maxParticipants: row.max_participants,
      isActive: row.is_active,
      createdAt: typeof row.created_at === 'string' ? new Date(row.created_at) : row.created_at,
      updatedAt: typeof row.updated_at === 'string' ? new Date(row.updated_at) : row.updated_at,
      closedAt: row.closed_at
        ? typeof row.closed_at === 'string'
          ? new Date(row.closed_at)
          : row.closed_at
        : undefined,
      participantCount: row.participant_count,
    });
  }

  /**
   * Get room data as JSON
   */
  toJSON(): StudyRoomData {
    return { ...this.data };
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get id(): string {
    return this.data.id;
  }

  get name(): string {
    return this.data.name;
  }

  get hostId(): string {
    return this.data.hostId;
  }

  get sessionId(): string | null {
    return this.data.sessionId;
  }

  get maxParticipants(): number {
    return this.data.maxParticipants;
  }

  get isActive(): boolean {
    return this.data.isActive;
  }

  get participantCount(): number {
    return this.data.participantCount || 0;
  }

  // ============================================================================
  // Business Logic
  // ============================================================================

  /**
   * Check if user is the host
   */
  isHost(userId: string): boolean {
    return this.data.hostId === userId;
  }

  /**
   * Check if room is full
   */
  isFull(): boolean {
    return this.participantCount >= this.data.maxParticipants;
  }

  /**
   * Check if room is open (active and not full)
   */
  isOpen(): boolean {
    return this.data.isActive && !this.isFull();
  }

  /**
   * Check if room is closed
   */
  isClosed(): boolean {
    return !this.data.isActive || !!this.data.closedAt;
  }

  /**
   * Get host display name
   */
  getHostDisplayName(): string {
    return this.data.hostFullName || this.data.hostEmail.split('@')[0] || 'Unknown';
  }

  /**
   * Get host initials for avatar
   */
  getHostInitials(): string {
    if (this.data.hostFullName) {
      const parts = this.data.hostFullName.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return this.data.hostFullName.substring(0, 2).toUpperCase();
    }
    return this.data.hostEmail.substring(0, 2).toUpperCase();
  }

  /**
   * Get room status text
   */
  getStatusText(): string {
    if (!this.data.isActive) {
      return 'Closed';
    }
    if (this.isFull()) {
      return 'Full';
    }
    return `${this.participantCount}/${this.data.maxParticipants} participants`;
  }

  /**
   * Get time since creation
   */
  getTimeSinceCreated(): string {
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
   * Validate room data
   */
  static validate(data: Partial<StudyRoomData>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Room name is required');
    }

    if (data.name && data.name.length > 100) {
      errors.push('Room name must be 100 characters or less');
    }

    if (data.maxParticipants !== undefined) {
      if (data.maxParticipants < 2) {
        errors.push('Room must allow at least 2 participants');
      }
      if (data.maxParticipants > 8) {
        errors.push('Room cannot exceed 8 participants');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
