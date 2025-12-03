/**
 * Messages Repository Interface
 * Defines operations for managing direct messages (Neomail-style)
 */

import { DirectMessage, MessageAttachmentData } from '../entities/DirectMessage.js';

export interface SendMessageParams {
  senderId: string;
  recipientId: string;
  subject?: string;
  content: string;
  attachments?: MessageAttachmentData[];
}

export interface GetConversationParams {
  userId: string;
  otherUserId: string;
  limit?: number;
}

export interface UploadAttachmentParams {
  userId: string;
  data: ArrayBuffer;
  name: string;
  type: string;
}

export interface IMessagesRepository {
  /**
   * Send a message to a friend
   */
  sendMessage(params: SendMessageParams): Promise<DirectMessage>;

  /**
   * Get inbox messages (received)
   */
  getInbox(userId: string, limit?: number): Promise<DirectMessage[]>;

  /**
   * Get sent messages
   */
  getSent(userId: string, limit?: number): Promise<DirectMessage[]>;

  /**
   * Get conversation between two users
   */
  getConversation(params: GetConversationParams): Promise<DirectMessage[]>;

  /**
   * Get a single message by ID
   */
  getMessage(messageId: string, userId: string): Promise<DirectMessage | null>;

  /**
   * Mark a message as read
   */
  markAsRead(messageId: string, userId: string): Promise<void>;

  /**
   * Mark all messages from a sender as read
   */
  markConversationAsRead(userId: string, senderId: string): Promise<number>;

  /**
   * Get count of unread messages
   */
  getUnreadCount(userId: string): Promise<number>;

  /**
   * Delete a message (soft delete for current user)
   */
  deleteMessage(messageId: string, userId: string): Promise<void>;

  /**
   * Upload an attachment to storage
   */
  uploadAttachment(params: UploadAttachmentParams): Promise<MessageAttachmentData>;

  /**
   * Subscribe to new messages for a user
   */
  subscribeToMessages(
    userId: string,
    onMessage: (message: DirectMessage) => void
  ): () => Promise<void>;

  /**
   * Unsubscribe from all message subscriptions
   */
  unsubscribeAll(): Promise<void>;
}
