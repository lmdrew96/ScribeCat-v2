/**
 * Chat Manager
 * Manages chat operations for study rooms
 */

import { ChatMessage } from '../../../domain/entities/ChatMessage.js';

export interface ChatMessageDisplay {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  isOwnMessage: boolean;
}

export class ChatManager {
  private messages: Map<string, ChatMessage[]> = new Map();
  private currentUserId: string | null = null;
  private unsubscribeFn: (() => void) | null = null;

  /**
   * Initialize chat manager with current user
   */
  public initialize(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * Send a message to a room
   */
  public async sendMessage(roomId: string, message: string): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('Chat manager not initialized');
    }

    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    if (message.length > 2000) {
      throw new Error('Message is too long (max 2000 characters)');
    }

    const result = await window.scribeCat.chat.sendMessage({
      roomId,
      userId: this.currentUserId,
      message: message.trim(),
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to send message');
    }

    // Add message to local cache
    const chatMessage = ChatMessage.create(result.message!);
    this.addMessage(roomId, chatMessage);
  }

  /**
   * Load messages for a room
   */
  public async loadMessages(roomId: string, limit: number = 50): Promise<ChatMessage[]> {
    const result = await window.scribeCat.chat.getRoomMessages(roomId, limit);

    if (!result.success) {
      throw new Error(result.error || 'Failed to load messages');
    }

    const messages = (result.messages || []).map((msg) => ChatMessage.create(msg));
    this.messages.set(roomId, messages);

    return messages;
  }

  /**
   * Subscribe to new messages in a room
   */
  public subscribeToRoom(
    roomId: string,
    callback: (message: ChatMessage) => void
  ): void {
    // Unsubscribe from previous room if any
    this.unsubscribe();

    // Subscribe to new messages
    this.unsubscribeFn = window.scribeCat.chat.subscribeToRoom(
      roomId,
      (messageData) => {
        const message = ChatMessage.create(messageData);
        this.addMessage(roomId, message);
        callback(message);
      }
    );
  }

  /**
   * Unsubscribe from current room
   */
  public unsubscribe(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
  }

  /**
   * Get messages for a room
   */
  public getMessages(roomId: string): ChatMessage[] {
    return this.messages.get(roomId) || [];
  }

  /**
   * Delete a message
   */
  public async deleteMessage(messageId: string): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('Chat manager not initialized');
    }

    const result = await window.scribeCat.chat.deleteMessage(messageId, this.currentUserId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete message');
    }

    // Remove from local cache
    this.messages.forEach((messages, roomId) => {
      const index = messages.findIndex((msg) => msg.id === messageId);
      if (index !== -1) {
        messages.splice(index, 1);
        this.messages.set(roomId, messages);
      }
    });
  }

  /**
   * Clear messages for a room
   */
  public clearMessages(roomId: string): void {
    this.messages.delete(roomId);
  }

  /**
   * Add message to local cache
   */
  private addMessage(roomId: string, message: ChatMessage): void {
    const messages = this.messages.get(roomId) || [];

    // Check if message already exists (prevent duplicates)
    if (messages.some((msg) => msg.id === message.id)) {
      return;
    }

    messages.push(message);
    this.messages.set(roomId, messages);
  }

  /**
   * Format message for display
   */
  public formatMessageForDisplay(
    message: ChatMessage,
    userName: string
  ): ChatMessageDisplay {
    return {
      id: message.id,
      userId: message.userId,
      userName,
      message: message.message,
      timestamp: message.createdAt,
      isOwnMessage: message.userId === this.currentUserId,
    };
  }

  /**
   * Clean up
   */
  public destroy(): void {
    this.unsubscribe();
    this.messages.clear();
    this.currentUserId = null;
  }
}
