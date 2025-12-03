/**
 * MessagesManager
 *
 * Manages direct messages (Neomail-style private messaging) in the renderer process.
 * Handles inbox/sent messages, unread counts, and real-time notifications.
 *
 * Real-time subscriptions happen directly in the renderer (like FriendsManager)
 * using RendererSupabaseClient for proper WebSocket support.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { createLogger } from '../../../shared/logger.js';
import { RendererSupabaseClient } from '../../services/RendererSupabaseClient.js';

const logger = createLogger('MessagesManager');

export interface MessageData {
  id: string;
  senderId: string;
  recipientId: string;
  subject?: string;
  content: string;
  attachments: MessageAttachment[];
  readAt?: string;
  createdAt: string;
  senderEmail?: string;
  senderUsername?: string;
  senderFullName?: string;
  senderAvatarUrl?: string;
  recipientEmail?: string;
  recipientUsername?: string;
  recipientFullName?: string;
  recipientAvatarUrl?: string;
}

export interface MessageAttachment {
  type: 'image' | 'file' | 'session_link';
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
  thumbnailUrl?: string;
}

export type UnreadCountListener = (count: number) => void;
export type NewMessageListener = (message: MessageData) => void;
export type MessagesChangeListener = () => void;

export class MessagesManager {
  private currentUserId: string | null = null;
  private unreadCount: number = 0;
  private inboxMessages: MessageData[] = [];
  private sentMessages: MessageData[] = [];
  private conversationCache: Map<string, MessageData[]> = new Map();

  private unreadCountListeners: Set<UnreadCountListener> = new Set();
  private newMessageListeners: Set<NewMessageListener> = new Set();
  private messagesChangeListeners: Set<MessagesChangeListener> = new Set();

  // Real-time subscription channel (renderer-side, like FriendsManager)
  private messagesChannel: RealtimeChannel | null = null;

  constructor() {
    logger.info('MessagesManager created');
  }

  /**
   * Initialize the manager with the current user
   */
  async initialize(userId: string): Promise<void> {
    this.currentUserId = userId;
    logger.info('Initializing MessagesManager for user:', userId);

    // Subscribe to real-time messages directly in renderer (like FriendsManager)
    this.subscribeToMessages();

    // Load initial data
    await this.loadUnreadCount();

    logger.info('MessagesManager initialized');
  }

  /**
   * Subscribe to real-time message updates directly in renderer
   * Uses RendererSupabaseClient for proper WebSocket support
   */
  private subscribeToMessages(): void {
    if (!this.currentUserId) {
      logger.warn('Cannot subscribe to messages: no current user');
      return;
    }

    // Clean up existing subscription
    if (this.messagesChannel) {
      logger.info('Cleaning up existing messages subscription');
      this.messagesChannel.unsubscribe();
      this.messagesChannel = null;
    }

    const client = RendererSupabaseClient.getInstance().getClient();
    const channelName = `messages-${this.currentUserId}`;

    logger.info('🔔 Subscribing to messages channel:', channelName);

    this.messagesChannel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `recipient_id=eq.${this.currentUserId}`,
        },
        (payload) => {
          logger.info('🔥 New message received via realtime:', payload);

          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as {
              id: string;
              sender_id: string;
              recipient_id: string;
              subject?: string;
              content: string;
              attachments: MessageAttachment[];
              read_at?: string;
              created_at: string;
            };

            // Convert to MessageData format
            const message: MessageData = {
              id: newMsg.id,
              senderId: newMsg.sender_id,
              recipientId: newMsg.recipient_id,
              subject: newMsg.subject,
              content: newMsg.content,
              attachments: newMsg.attachments || [],
              readAt: newMsg.read_at,
              createdAt: newMsg.created_at,
            };

            // Fetch sender profile info for display
            this.fetchSenderProfile(message);
          }
        }
      )
      .subscribe((status) => {
        logger.info('📡 Messages channel status:', status);
      });
  }

  /**
   * Fetch sender profile and then handle the new message
   */
  private async fetchSenderProfile(message: MessageData): Promise<void> {
    try {
      const client = RendererSupabaseClient.getInstance().getClient();
      const { data: profile } = await client
        .from('user_profiles')
        .select('email, username, full_name, avatar_url')
        .eq('id', message.senderId)
        .single();

      if (profile) {
        message.senderEmail = profile.email;
        message.senderUsername = profile.username;
        message.senderFullName = profile.full_name;
        message.senderAvatarUrl = profile.avatar_url;
      }
    } catch (err) {
      logger.warn('Failed to fetch sender profile:', err);
    }

    // Handle the message regardless of profile fetch success
    this.handleNewMessage(message);
  }

  /**
   * Clear state and unsubscribe on logout
   */
  async clear(): Promise<void> {
    logger.info('Clearing MessagesManager');

    // Unsubscribe from real-time channel
    if (this.messagesChannel) {
      logger.info('Unsubscribing from messages channel');
      await this.messagesChannel.unsubscribe();
      this.messagesChannel = null;
    }

    // Clear state
    this.currentUserId = null;
    this.unreadCount = 0;
    this.inboxMessages = [];
    this.sentMessages = [];
    this.conversationCache.clear();

    // Notify listeners
    this.notifyUnreadCountListeners();
    this.notifyMessagesChangeListeners();

    logger.info('MessagesManager cleared');
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  /**
   * Send a message to a friend
   */
  async sendMessage(
    recipientId: string,
    content: string,
    subject?: string,
    attachments?: MessageAttachment[]
  ): Promise<MessageData> {
    logger.info('Sending message to:', recipientId);

    const result = await window.scribeCat.messages.send({
      recipientId,
      subject,
      content,
      attachments,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to send message');
    }

    // Add to sent messages
    const message = result.message as MessageData;
    this.sentMessages.unshift(message);

    // Update conversation cache
    const conversationKey = this.getConversationKey(recipientId);
    const cached = this.conversationCache.get(conversationKey);
    if (cached) {
      cached.unshift(message);
    }

    this.notifyMessagesChangeListeners();

    return message;
  }

  /**
   * Load inbox messages
   */
  async loadInbox(limit?: number): Promise<MessageData[]> {
    logger.info('Loading inbox');

    const result = await window.scribeCat.messages.getInbox(limit);

    if (!result.success) {
      throw new Error(result.error || 'Failed to load inbox');
    }

    this.inboxMessages = (result.messages || []) as MessageData[];
    this.notifyMessagesChangeListeners();

    return this.inboxMessages;
  }

  /**
   * Load sent messages
   */
  async loadSent(limit?: number): Promise<MessageData[]> {
    logger.info('Loading sent messages');

    const result = await window.scribeCat.messages.getSent(limit);

    if (!result.success) {
      throw new Error(result.error || 'Failed to load sent messages');
    }

    this.sentMessages = (result.messages || []) as MessageData[];
    this.notifyMessagesChangeListeners();

    return this.sentMessages;
  }

  /**
   * Load conversation with a specific friend
   */
  async loadConversation(friendId: string, limit?: number): Promise<MessageData[]> {
    logger.info('Loading conversation with:', friendId);

    const result = await window.scribeCat.messages.getConversation({
      otherUserId: friendId,
      limit,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to load conversation');
    }

    const messages = (result.messages || []) as MessageData[];
    const conversationKey = this.getConversationKey(friendId);
    this.conversationCache.set(conversationKey, messages);

    return messages;
  }

  /**
   * Get a single message by ID
   */
  async getMessage(messageId: string): Promise<MessageData | null> {
    const result = await window.scribeCat.messages.getMessage(messageId);

    if (!result.success) {
      if (result.error === 'Message not found') {
        return null;
      }
      throw new Error(result.error || 'Failed to get message');
    }

    return result.message as MessageData;
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    logger.info('Marking message as read:', messageId);

    const result = await window.scribeCat.messages.markAsRead(messageId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to mark message as read');
    }

    // Update local state
    const message = this.inboxMessages.find((m) => m.id === messageId);
    if (message && !message.readAt) {
      message.readAt = new Date().toISOString();
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.notifyUnreadCountListeners();
      this.notifyMessagesChangeListeners();
    }
  }

  /**
   * Mark all messages from a sender as read
   */
  async markConversationAsRead(senderId: string): Promise<number> {
    logger.info('Marking conversation as read with:', senderId);

    const result = await window.scribeCat.messages.markConversationAsRead(senderId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to mark conversation as read');
    }

    const count = (result as { success: boolean; count?: number }).count || 0;

    // Reload unread count
    await this.loadUnreadCount();
    this.notifyMessagesChangeListeners();

    return count;
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    logger.info('Deleting message:', messageId);

    const result = await window.scribeCat.messages.delete(messageId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete message');
    }

    // Remove from local caches
    this.inboxMessages = this.inboxMessages.filter((m) => m.id !== messageId);
    this.sentMessages = this.sentMessages.filter((m) => m.id !== messageId);

    // Remove from conversation caches
    this.conversationCache.forEach((messages, key) => {
      const filtered = messages.filter((m) => m.id !== messageId);
      if (filtered.length !== messages.length) {
        this.conversationCache.set(key, filtered);
      }
    });

    this.notifyMessagesChangeListeners();
  }

  /**
   * Upload an attachment
   */
  async uploadAttachment(file: File): Promise<MessageAttachment> {
    logger.info('Uploading attachment:', file.name);

    const arrayBuffer = await file.arrayBuffer();

    const result = await window.scribeCat.messages.uploadAttachment({
      data: arrayBuffer,
      name: file.name,
      type: file.type,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to upload attachment');
    }

    return result.attachment as MessageAttachment;
  }

  // ============================================================================
  // Unread Count
  // ============================================================================

  /**
   * Get current unread count
   */
  getUnreadCount(): number {
    return this.unreadCount;
  }

  /**
   * Load unread count from server
   */
  async loadUnreadCount(): Promise<number> {
    const result = await window.scribeCat.messages.getUnreadCount();

    if (result.success) {
      this.unreadCount = (result as { success: boolean; count?: number }).count || 0;
      this.notifyUnreadCountListeners();
    }

    return this.unreadCount;
  }

  // ============================================================================
  // Cached Data Access
  // ============================================================================

  /**
   * Get cached inbox messages
   */
  getInboxMessages(): MessageData[] {
    return [...this.inboxMessages];
  }

  /**
   * Get cached sent messages
   */
  getSentMessages(): MessageData[] {
    return [...this.sentMessages];
  }

  /**
   * Get cached conversation
   */
  getCachedConversation(friendId: string): MessageData[] | undefined {
    const key = this.getConversationKey(friendId);
    const cached = this.conversationCache.get(key);
    return cached ? [...cached] : undefined;
  }

  // ============================================================================
  // Listeners
  // ============================================================================

  /**
   * Add unread count listener
   */
  addUnreadCountListener(listener: UnreadCountListener): void {
    this.unreadCountListeners.add(listener);
  }

  /**
   * Remove unread count listener
   */
  removeUnreadCountListener(listener: UnreadCountListener): void {
    this.unreadCountListeners.delete(listener);
  }

  /**
   * Add new message listener
   */
  addNewMessageListener(listener: NewMessageListener): void {
    this.newMessageListeners.add(listener);
  }

  /**
   * Remove new message listener
   */
  removeNewMessageListener(listener: NewMessageListener): void {
    this.newMessageListeners.delete(listener);
  }

  /**
   * Add messages change listener
   */
  addMessagesChangeListener(listener: MessagesChangeListener): void {
    this.messagesChangeListeners.add(listener);
  }

  /**
   * Remove messages change listener
   */
  removeMessagesChangeListener(listener: MessagesChangeListener): void {
    this.messagesChangeListeners.delete(listener);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handleNewMessage(message: MessageData): void {
    logger.info('New message received:', message.id);

    // Add to inbox
    this.inboxMessages.unshift(message);

    // Update conversation cache
    const conversationKey = this.getConversationKey(message.senderId);
    const cached = this.conversationCache.get(conversationKey);
    if (cached) {
      cached.unshift(message);
    }

    // Increment unread count
    this.unreadCount++;
    this.notifyUnreadCountListeners();

    // Play notification sound
    this.playNotificationSound();

    // Notify listeners
    this.notifyNewMessageListeners(message);
    this.notifyMessagesChangeListeners();
  }

  private playNotificationSound(): void {
    try {
      // Use one of the existing cat sounds
      const audio = new Audio('assets/Cat Sounds/cat-meow-1-fx-323465.mp3');
      audio.volume = 0.3;
      audio.play().catch((err) => {
        logger.warn('Failed to play notification sound:', err);
      });
    } catch (err) {
      logger.warn('Error creating audio for notification:', err);
    }
  }

  private getConversationKey(otherUserId: string): string {
    if (!this.currentUserId) return otherUserId;
    // Use consistent ordering for key
    const ids = [this.currentUserId, otherUserId].sort();
    return `${ids[0]}-${ids[1]}`;
  }

  private notifyUnreadCountListeners(): void {
    for (const listener of this.unreadCountListeners) {
      try {
        listener(this.unreadCount);
      } catch (err) {
        logger.error('Error in unread count listener:', err);
      }
    }
  }

  private notifyNewMessageListeners(message: MessageData): void {
    for (const listener of this.newMessageListeners) {
      try {
        listener(message);
      } catch (err) {
        logger.error('Error in new message listener:', err);
      }
    }
  }

  private notifyMessagesChangeListeners(): void {
    for (const listener of this.messagesChangeListeners) {
      try {
        listener();
      } catch (err) {
        logger.error('Error in messages change listener:', err);
      }
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get display name for a message sender
   */
  static getSenderDisplayName(message: MessageData): string {
    if (message.senderUsername) {
      return `@${message.senderUsername}`;
    }
    return message.senderEmail?.split('@')[0] || 'Unknown';
  }

  /**
   * Get display name for a message recipient
   */
  static getRecipientDisplayName(message: MessageData): string {
    if (message.recipientUsername) {
      return `@${message.recipientUsername}`;
    }
    return message.recipientEmail?.split('@')[0] || 'Unknown';
  }

  /**
   * Get relative time string for a message
   */
  static getRelativeTime(createdAt: string): string {
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  /**
   * Get content preview (truncated)
   */
  static getContentPreview(content: string, maxLength = 100): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.slice(0, maxLength).trim() + '...';
  }
}
