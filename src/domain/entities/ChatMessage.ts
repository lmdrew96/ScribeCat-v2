/**
 * ChatMessage Entity
 * Represents a chat message in a study room
 */

export interface ChatMessageData {
  readonly id: string;
  readonly roomId: string;
  readonly userId: string;
  readonly message: string;
  readonly createdAt: Date;
}

export class ChatMessage {
  private constructor(private readonly data: ChatMessageData) {
    this.validate();
  }

  /**
   * Create a new ChatMessage instance
   */
  public static create(data: ChatMessageData): ChatMessage {
    return new ChatMessage(data);
  }

  /**
   * Validate message data
   */
  private validate(): void {
    if (!this.data.id) {
      throw new Error('Message ID is required');
    }

    if (!this.data.roomId) {
      throw new Error('Room ID is required');
    }

    if (!this.data.userId) {
      throw new Error('User ID is required');
    }

    if (!this.data.message || this.data.message.trim().length === 0) {
      throw new Error('Message content is required');
    }

    if (this.data.message.length > 2000) {
      throw new Error('Message is too long (max 2000 characters)');
    }

    if (!this.data.createdAt) {
      throw new Error('Created at timestamp is required');
    }
  }

  // Getters
  get id(): string {
    return this.data.id;
  }

  get roomId(): string {
    return this.data.roomId;
  }

  get userId(): string {
    return this.data.userId;
  }

  get message(): string {
    return this.data.message;
  }

  get createdAt(): Date {
    return this.data.createdAt;
  }

  /**
   * Check if message was sent by a specific user
   */
  public isSentBy(userId: string): boolean {
    return this.data.userId === userId;
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
   * Convert to plain object
   */
  public toJSON(): ChatMessageData {
    return { ...this.data };
  }
}
