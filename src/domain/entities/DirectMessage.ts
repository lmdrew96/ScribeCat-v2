/**
 * DirectMessage Entity
 * Represents a private message between friends (Neomail-style)
 */

export interface MessageAttachmentData {
  readonly type: 'image' | 'file' | 'session_link';
  readonly url: string;
  readonly name: string;
  readonly size?: number;
  readonly mimeType?: string;
  readonly thumbnailUrl?: string;
}

export interface DirectMessageData {
  readonly id: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly subject?: string;
  readonly content: string;
  readonly attachments: MessageAttachmentData[];
  readonly readAt?: Date;
  readonly createdAt: Date;
  // Sender profile (populated on fetch)
  readonly senderEmail?: string;
  readonly senderUsername?: string;
  readonly senderFullName?: string;
  readonly senderAvatarUrl?: string;
  // Recipient profile (populated on fetch)
  readonly recipientEmail?: string;
  readonly recipientUsername?: string;
  readonly recipientFullName?: string;
  readonly recipientAvatarUrl?: string;
}

export class DirectMessage {
  private constructor(private readonly data: DirectMessageData) {
    this.validate();
  }

  /**
   * Create a new DirectMessage instance
   */
  public static create(data: DirectMessageData): DirectMessage {
    return new DirectMessage(data);
  }

  /**
   * Create from database row
   */
  public static fromDatabase(row: {
    id: string;
    sender_id: string;
    recipient_id: string;
    subject?: string | null;
    content: string;
    attachments?: unknown[] | null;
    read_at?: string | null;
    created_at: string;
    sender_email?: string | null;
    sender_username?: string | null;
    sender_full_name?: string | null;
    sender_avatar_url?: string | null;
    recipient_email?: string | null;
    recipient_username?: string | null;
    recipient_full_name?: string | null;
    recipient_avatar_url?: string | null;
  }): DirectMessage {
    return DirectMessage.create({
      id: row.id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      subject: row.subject || undefined,
      content: row.content,
      attachments: (row.attachments || []) as MessageAttachmentData[],
      readAt: row.read_at ? new Date(row.read_at) : undefined,
      createdAt: new Date(row.created_at),
      senderEmail: row.sender_email || undefined,
      senderUsername: row.sender_username || undefined,
      senderFullName: row.sender_full_name || undefined,
      senderAvatarUrl: row.sender_avatar_url || undefined,
      recipientEmail: row.recipient_email || undefined,
      recipientUsername: row.recipient_username || undefined,
      recipientFullName: row.recipient_full_name || undefined,
      recipientAvatarUrl: row.recipient_avatar_url || undefined,
    });
  }

  /**
   * Validate message data
   */
  private validate(): void {
    if (!this.data.id) {
      throw new Error('Message ID is required');
    }

    if (!this.data.senderId) {
      throw new Error('Sender ID is required');
    }

    if (!this.data.recipientId) {
      throw new Error('Recipient ID is required');
    }

    if (!this.data.content || this.data.content.trim().length === 0) {
      throw new Error('Message content is required');
    }

    if (this.data.content.length > 5000) {
      throw new Error('Message is too long (max 5000 characters)');
    }

    if (this.data.subject && this.data.subject.length > 200) {
      throw new Error('Subject is too long (max 200 characters)');
    }

    if (!this.data.createdAt) {
      throw new Error('Created at timestamp is required');
    }
  }

  // Getters
  get id(): string {
    return this.data.id;
  }

  get senderId(): string {
    return this.data.senderId;
  }

  get recipientId(): string {
    return this.data.recipientId;
  }

  get subject(): string | undefined {
    return this.data.subject;
  }

  get content(): string {
    return this.data.content;
  }

  get attachments(): MessageAttachmentData[] {
    return this.data.attachments;
  }

  get readAt(): Date | undefined {
    return this.data.readAt;
  }

  get createdAt(): Date {
    return this.data.createdAt;
  }

  get isRead(): boolean {
    return !!this.data.readAt;
  }

  get senderEmail(): string | undefined {
    return this.data.senderEmail;
  }

  get senderUsername(): string | undefined {
    return this.data.senderUsername;
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

  get recipientUsername(): string | undefined {
    return this.data.recipientUsername;
  }

  get recipientFullName(): string | undefined {
    return this.data.recipientFullName;
  }

  get recipientAvatarUrl(): string | undefined {
    return this.data.recipientAvatarUrl;
  }

  /**
   * Get sender display name (@username or email prefix)
   */
  public getSenderDisplayName(): string {
    if (this.data.senderUsername) {
      return `@${this.data.senderUsername}`;
    }
    return this.data.senderEmail?.split('@')[0] || 'Unknown';
  }

  /**
   * Get recipient display name (@username or email prefix)
   */
  public getRecipientDisplayName(): string {
    if (this.data.recipientUsername) {
      return `@${this.data.recipientUsername}`;
    }
    return this.data.recipientEmail?.split('@')[0] || 'Unknown';
  }

  /**
   * Get sender initials for avatar
   */
  public getSenderInitials(): string {
    if (this.data.senderFullName) {
      const parts = this.data.senderFullName.split(' ');
      return parts
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase();
    }
    if (this.data.senderUsername) {
      return this.data.senderUsername.slice(0, 2).toUpperCase();
    }
    if (this.data.senderEmail) {
      return this.data.senderEmail.slice(0, 2).toUpperCase();
    }
    return '??';
  }

  /**
   * Check if message was sent by a specific user
   */
  public isSentBy(userId: string): boolean {
    return this.data.senderId === userId;
  }

  /**
   * Check if message was received by a specific user
   */
  public isReceivedBy(userId: string): boolean {
    return this.data.recipientId === userId;
  }

  /**
   * Check if message has attachments
   */
  public hasAttachments(): boolean {
    return this.data.attachments.length > 0;
  }

  /**
   * Get attachment count
   */
  public getAttachmentCount(): number {
    return this.data.attachments.length;
  }

  /**
   * Get content preview (truncated for list display)
   */
  public getContentPreview(maxLength = 100): string {
    if (this.data.content.length <= maxLength) {
      return this.data.content;
    }
    return this.data.content.slice(0, maxLength).trim() + '...';
  }

  /**
   * Get relative time (e.g., "2 minutes ago")
   */
  public getRelativeTime(): string {
    const now = new Date();
    const diffMs = now.getTime() - this.data.createdAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return this.data.createdAt.toLocaleDateString();
  }

  /**
   * Get formatted date for message detail view
   */
  public getFormattedDate(): string {
    return this.data.createdAt.toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Convert to plain object
   */
  public toJSON(): DirectMessageData {
    return { ...this.data };
  }
}
