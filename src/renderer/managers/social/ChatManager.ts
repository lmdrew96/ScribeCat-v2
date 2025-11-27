/**
 * Chat Manager
 * Manages chat operations for study rooms
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { ChatMessage } from '../../../domain/entities/ChatMessage.js';
import { RendererSupabaseClient } from '../../services/RendererSupabaseClient.js';

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
  private currentUserName: string | null = null;
  private chatChannel: RealtimeChannel | null = null;
  private currentRoomId: string | null = null;

  /**
   * Initialize chat manager with current user
   */
  public initialize(userId: string, userName: string): void {
    this.currentUserId = userId;
    this.currentUserName = userName;
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
   * Uses direct Supabase Realtime subscription in renderer process
   * (WebSockets don't work in Electron's main process - no browser APIs)
   */
  public subscribeToRoom(
    roomId: string,
    onMessage: (message: ChatMessage) => void,
    onTyping?: (userId: string, userName: string, isTyping: boolean) => void
  ): void {
    // Unsubscribe from previous room if any
    this.unsubscribe();

    console.log('📡 ChatManager: Setting up direct Supabase subscription in renderer for room:', roomId);

    const rendererClient = RendererSupabaseClient.getInstance();
    const client = rendererClient.getClient();

    if (!client) {
      console.error('❌ ChatManager: No Supabase client available in renderer');
      return;
    }

    this.currentRoomId = roomId;
    const channelName = `room-chat:${roomId}`;

    // Create the realtime channel
    this.chatChannel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('🔥 ChatManager: New message received via realtime:', payload);

          // Map payload to ChatMessage
          const messageData = {
            id: payload.new.id,
            roomId: payload.new.room_id,
            userId: payload.new.user_id,
            message: payload.new.message,
            createdAt: new Date(payload.new.created_at),
          };

          const message = ChatMessage.create(messageData);
          this.addMessage(roomId, message);
          onMessage(message);
        }
      );

    // Subscribe to typing status broadcasts if callback provided
    if (onTyping) {
      this.chatChannel.on(
        'broadcast',
        { event: 'typing-status' },
        (payload: { payload: { userId: string; userName: string; isTyping: boolean } }) => {
          const { userId, userName, isTyping } = payload.payload;
          // Don't show typing indicator for current user
          if (userId !== this.currentUserId) {
            onTyping(userId, userName, isTyping);
          }
        }
      );
    }

    // Subscribe and log status
    this.chatChannel.subscribe((status, err) => {
      console.log('📡 ChatManager: Subscription status:', status);
      if (err) {
        console.error('❌ ChatManager: Subscription error:', err);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ ChatManager: Successfully subscribed to chat in RENDERER process');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ ChatManager: Channel error');
      } else if (status === 'TIMED_OUT') {
        console.error('⏱️ ChatManager: Subscription timed out');
      }
    });
  }

  /**
   * Unsubscribe from current room
   */
  public unsubscribe(): void {
    if (this.chatChannel) {
      console.log('🔒 ChatManager: Unsubscribing from chat channel');
      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();

      this.chatChannel.unsubscribe();
      if (client) {
        client.removeChannel(this.chatChannel);
      }
      this.chatChannel = null;
      this.currentRoomId = null;
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
   * Messages are kept sorted by timestamp to handle out-of-order delivery
   */
  private addMessage(roomId: string, message: ChatMessage): void {
    const messages = this.messages.get(roomId) || [];

    // Check if message already exists (prevent duplicates)
    if (messages.some((msg) => msg.id === message.id)) {
      return;
    }

    messages.push(message);

    // Sort by timestamp to handle out-of-order realtime delivery
    messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

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
   * Broadcast typing status to other users in the room
   * Uses direct channel broadcast (no IPC needed since we own the channel)
   */
  public async broadcastTyping(roomId: string, isTyping: boolean): Promise<void> {
    if (!this.currentUserId || !this.currentUserName) {
      throw new Error('Chat manager not initialized');
    }

    // Use direct channel broadcast if we have an active channel for this room
    if (this.chatChannel && this.currentRoomId === roomId) {
      await this.chatChannel.send({
        type: 'broadcast',
        event: 'typing-status',
        payload: {
          userId: this.currentUserId,
          userName: this.currentUserName,
          isTyping,
        },
      });
    } else {
      // Fallback to IPC if channel not available (shouldn't happen normally)
      await window.scribeCat.chat.broadcastTyping(
        roomId,
        this.currentUserId,
        this.currentUserName,
        isTyping
      );
    }
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
