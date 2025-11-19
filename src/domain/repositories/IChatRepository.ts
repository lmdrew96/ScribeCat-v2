/**
 * Chat Repository Interface
 * Defines operations for managing chat messages
 */

import { ChatMessage } from '../entities/ChatMessage.js';

export interface SendMessageParams {
  roomId: string;
  userId: string;
  message: string;
}

export interface IChatRepository {
  /**
   * Send a message to a room
   */
  sendMessage(params: SendMessageParams): Promise<ChatMessage>;

  /**
   * Get recent messages for a room
   */
  getRoomMessages(roomId: string, limit?: number): Promise<ChatMessage[]>;

  /**
   * Delete a message
   */
  deleteMessage(messageId: string, userId: string): Promise<void>;

  /**
   * Subscribe to new messages in a room
   */
  subscribeToRoom(
    roomId: string,
    onMessage: (message: ChatMessage) => void,
    onTyping?: (userId: string, userName: string, isTyping: boolean) => void
  ): () => Promise<void>;

  /**
   * Broadcast typing status to other users in the room
   */
  broadcastTypingStatus(
    roomId: string,
    userId: string,
    userName: string,
    isTyping: boolean
  ): Promise<void>;

  /**
   * Unsubscribe from all room subscriptions
   */
  unsubscribeAll(): Promise<void>;
}
