/**
 * FriendRequest Domain Entity
 * Represents a friend request with status tracking
 */

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface FriendRequestData {
  readonly id: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly status: FriendRequestStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  // Optional: Joined user profile data for sender/recipient
  readonly senderEmail?: string;
  readonly senderFullName?: string;
  readonly senderAvatarUrl?: string;
  readonly recipientEmail?: string;
  readonly recipientFullName?: string;
  readonly recipientAvatarUrl?: string;
}

/**
 * FriendRequest entity representing a friend request between users
 */
export class FriendRequest {
  private constructor(private readonly data: FriendRequestData) {
    this.validate();
  }

  /**
   * Factory method to create a new FriendRequest instance
   */
  static create(data: FriendRequestData): FriendRequest {
    return new FriendRequest(data);
  }

  /**
   * Factory method to create FriendRequest from database row
   */
  static fromDatabase(row: {
    id: string;
    sender_id: string;
    recipient_id: string;
    status: FriendRequestStatus;
    created_at: string | Date;
    updated_at: string | Date;
    // Optional joined sender profile data
    sender_email?: string;
    sender_full_name?: string;
    sender_avatar_url?: string;
    // Optional joined recipient profile data
    recipient_email?: string;
    recipient_full_name?: string;
    recipient_avatar_url?: string;
  }): FriendRequest {
    return FriendRequest.create({
      id: row.id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      status: row.status,
      createdAt: typeof row.created_at === 'string' ? new Date(row.created_at) : row.created_at,
      updatedAt: typeof row.updated_at === 'string' ? new Date(row.updated_at) : row.updated_at,
      senderEmail: row.sender_email,
      senderFullName: row.sender_full_name,
      senderAvatarUrl: row.sender_avatar_url,
      recipientEmail: row.recipient_email,
      recipientFullName: row.recipient_full_name,
      recipientAvatarUrl: row.recipient_avatar_url,
    });
  }

  /**
   * Validate the friend request data
   */
  private validate(): void {
    if (!this.data.id) {
      throw new Error('Friend request ID is required');
    }
    if (!this.data.senderId) {
      throw new Error('Sender ID is required');
    }
    if (!this.data.recipientId) {
      throw new Error('Recipient ID is required');
    }
    if (this.data.senderId === this.data.recipientId) {
      throw new Error('Cannot send friend request to yourself');
    }
    if (!this.data.status) {
      throw new Error('Status is required');
    }
    const validStatuses: FriendRequestStatus[] = ['pending', 'accepted', 'rejected', 'cancelled'];
    if (!validStatuses.includes(this.data.status)) {
      throw new Error(`Invalid status: ${this.data.status}`);
    }
    if (!this.data.createdAt) {
      throw new Error('Created at date is required');
    }
    if (!this.data.updatedAt) {
      throw new Error('Updated at date is required');
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get id(): string {
    return this.data.id;
  }

  get senderId(): string {
    return this.data.senderId;
  }

  get recipientId(): string {
    return this.data.recipientId;
  }

  get status(): FriendRequestStatus {
    return this.data.status;
  }

  get createdAt(): Date {
    return this.data.createdAt;
  }

  get updatedAt(): Date {
    return this.data.updatedAt;
  }

  get senderEmail(): string | undefined {
    return this.data.senderEmail;
  }

  get senderFullName(): string | undefined {
    return this.data.senderFullName;
  }

  get senderAvatarUrl(): string | undefined {
    return this.data.senderAvatarUrl;
  }

  get recipientEmail(): string | undefined {
    return this.data.recipientEmail;
  }

  get recipientFullName(): string | undefined {
    return this.data.recipientFullName;
  }

  get recipientAvatarUrl(): string | undefined {
    return this.data.recipientAvatarUrl;
  }

  // ============================================================================
  // Business Logic Methods
  // ============================================================================

  /**
   * Check if the request is pending
   */
  isPending(): boolean {
    return this.data.status === 'pending';
  }

  /**
   * Check if the request is accepted
   */
  isAccepted(): boolean {
    return this.data.status === 'accepted';
  }

  /**
   * Check if the request is rejected
   */
  isRejected(): boolean {
    return this.data.status === 'rejected';
  }

  /**
   * Check if the request is cancelled
   */
  isCancelled(): boolean {
    return this.data.status === 'cancelled';
  }

  /**
   * Check if the request is resolved (accepted, rejected, or cancelled)
   */
  isResolved(): boolean {
    return !this.isPending();
  }

  /**
   * Check if a user is the sender
   */
  isSender(userId: string): boolean {
    return this.data.senderId === userId;
  }

  /**
   * Check if a user is the recipient
   */
  isRecipient(userId: string): boolean {
    return this.data.recipientId === userId;
  }

  /**
   * Check if the request is incoming for a specific user
   */
  isIncoming(userId: string): boolean {
    return this.isRecipient(userId) && this.isPending();
  }

  /**
   * Check if the request is outgoing for a specific user
   */
  isOutgoing(userId: string): boolean {
    return this.isSender(userId) && this.isPending();
  }

  /**
   * Get display name for the sender
   */
  getSenderDisplayName(): string {
    if (this.data.senderFullName && this.data.senderFullName.trim()) {
      return this.data.senderFullName;
    }
    return this.data.senderEmail || 'Unknown User';
  }

  /**
   * Get display name for the recipient
   */
  getRecipientDisplayName(): string {
    if (this.data.recipientFullName && this.data.recipientFullName.trim()) {
      return this.data.recipientFullName;
    }
    return this.data.recipientEmail || 'Unknown User';
  }

  /**
   * Get display name for the "other" user (relative to current user)
   */
  getOtherUserDisplayName(currentUserId: string): string {
    if (this.isSender(currentUserId)) {
      return this.getRecipientDisplayName();
    }
    return this.getSenderDisplayName();
  }

  /**
   * Get the "other" user's ID (relative to current user)
   */
  getOtherUserId(currentUserId: string): string {
    return this.isSender(currentUserId) ? this.data.recipientId : this.data.senderId;
  }

  /**
   * Get the "other" user's email
   */
  getOtherUserEmail(currentUserId: string): string | undefined {
    return this.isSender(currentUserId) ? this.data.recipientEmail : this.data.senderEmail;
  }

  /**
   * Get the "other" user's avatar URL
   */
  getOtherUserAvatarUrl(currentUserId: string): string | undefined {
    return this.isSender(currentUserId) ? this.data.recipientAvatarUrl : this.data.senderAvatarUrl;
  }

  /**
   * Get initials for the sender
   */
  getSenderInitials(): string {
    const name = this.getSenderDisplayName();
    const parts = name.split(/[\s@]+/);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Get initials for the recipient
   */
  getRecipientInitials(): string {
    const name = this.getRecipientDisplayName();
    const parts = name.split(/[\s@]+/);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Get initials for the "other" user
   */
  getOtherUserInitials(currentUserId: string): string {
    return this.isSender(currentUserId) ? this.getRecipientInitials() : this.getSenderInitials();
  }

  /**
   * Get how long ago the request was created
   */
  getAgeInMinutes(): number {
    const now = Date.now();
    const diff = now - this.data.createdAt.getTime();
    return Math.floor(diff / 60000);
  }

  /**
   * Get human-readable time since request was created
   */
  getTimeSinceCreated(): string {
    const minutes = this.getAgeInMinutes();
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return this.data.createdAt.toLocaleDateString();
    }
  }

  /**
   * Check if request is stale (pending for more than 30 days)
   */
  isStale(): boolean {
    if (!this.isPending()) {
      return false;
    }
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return this.data.createdAt.getTime() < thirtyDaysAgo;
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): FriendRequestData {
    return { ...this.data };
  }

  /**
   * Create a copy with updated status
   */
  withStatus(status: FriendRequestStatus): FriendRequest {
    return FriendRequest.create({
      ...this.data,
      status,
      updatedAt: new Date(),
    });
  }
}
