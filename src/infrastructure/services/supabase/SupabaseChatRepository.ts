/**
 * Supabase Chat Repository
 * Handles chat message operations with Supabase
 */

import { SupabaseClient as SupabaseClientType, RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseClient } from './SupabaseClient.js';
import { IChatRepository, SendMessageParams } from '../../../domain/repositories/IChatRepository.js';
import { ChatMessage, ChatMessageData } from '../../../domain/entities/ChatMessage.js';

interface ChatMessageRow {
  id: string;
  room_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

export class SupabaseChatRepository implements IChatRepository {
  private channels: Map<string, RealtimeChannel> = new Map();

  /**
   * Get a fresh Supabase client with the current session for REST calls
   */
  private getClient(): SupabaseClientType {
    return SupabaseClient.getInstance().getClient();
  }

  /**
   * Get the base Supabase client for Realtime subscriptions
   * This client has setSession() called on it for proper auth context
   */
  private getRealtimeClient(): SupabaseClientType {
    return SupabaseClient.getInstance().getRealtimeClient();
  }

  /**
   * Send a message to a room
   */
  public async sendMessage(params: SendMessageParams): Promise<ChatMessage> {
    const { data, error} = await this.getClient()
      .from('chat_messages')
      .insert({
        room_id: params.roomId,
        user_id: params.userId,
        message: params.message.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to send message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  /**
   * Get recent messages for a room
   */
  public async getRoomMessages(roomId: string, limit: number = 50): Promise<ChatMessage[]> {
    const { data, error } = await this.getClient()
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch messages:', error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return (data || []).map((row) => this.mapToDomain(row));
  }

  /**
   * Delete a message
   */
  public async deleteMessage(messageId: string, userId: string): Promise<void> {
    const { error } = await this.getClient()
      .from('chat_messages')
      .delete()
      .eq('id', messageId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to delete message:', error);
      throw new Error(`Failed to delete message: ${error.message}`);
    }
  }

  /**
   * Subscribe to new messages in a room
   */
  public subscribeToRoom(
    roomId: string,
    onMessage: (message: ChatMessage) => void,
    onTyping?: (userId: string, userName: string, isTyping: boolean) => void
  ): () => void {
    // Create channel for this room
    const channelName = `room-chat:${roomId}`;
    const client = this.getRealtimeClient();

    console.log('📡 Creating Realtime chat subscription for room:', roomId);
    console.log('🔑 Auth token present:', !!SupabaseClient.getInstance().getAccessToken());

    // Remove existing subscription if any (prevents duplicates)
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
      console.log(`Removing existing subscription for room ${roomId}`);
      client.removeChannel(existingChannel);
      this.channels.delete(channelName);
    }

    const channel = client
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
          console.log('New chat message received:', payload);
          const message = this.mapToDomain(payload.new as ChatMessageRow);
          onMessage(message);
        }
      );

    // Subscribe to typing status broadcasts if callback provided
    if (onTyping) {
      channel.on(
        'broadcast',
        { event: 'typing-status' },
        (payload: any) => {
          const { userId, userName, isTyping } = payload.payload;
          onTyping(userId, userName, isTyping);
        }
      );
    }

    channel.subscribe((status) => {
      console.log(`Chat subscription status for room ${roomId}:`, status);
      if (status === 'SUBSCRIBED') {
        console.log(`Successfully subscribed to chat in room ${roomId}`);
      } else if (status === 'TIMED_OUT') {
        console.error(`Chat subscription timed out for room ${roomId}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Chat subscription error for room ${roomId}`);
      }
    });

    this.channels.set(channelName, channel);

    // Return unsubscribe function
    return () => {
      client.removeChannel(channel);
      this.channels.delete(channelName);
      console.log(`Unsubscribed from chat in room ${roomId}`);
    };
  }

  /**
   * Broadcast typing status to other users in the room
   */
  public async broadcastTypingStatus(
    roomId: string,
    userId: string,
    userName: string,
    isTyping: boolean
  ): Promise<void> {
    const channelName = `room-chat:${roomId}`;
    let channel = this.channels.get(channelName);

    // If channel doesn't exist, we can't broadcast
    // (user must be subscribed to broadcast)
    if (!channel) {
      console.warn(`Cannot broadcast typing: not subscribed to room ${roomId}`);
      return;
    }

    await channel.send({
      type: 'broadcast',
      event: 'typing-status',
      payload: { userId, userName, isTyping },
    });
  }

  /**
   * Unsubscribe from all room subscriptions
   */
  public unsubscribeAll(): void {
    const client = this.getClient();
    this.channels.forEach((channel) => {
      client.removeChannel(channel);
    });
    this.channels.clear();
    console.log('Unsubscribed from all chat channels');
  }

  /**
   * Map database row to domain entity
   */
  private mapToDomain(row: ChatMessageRow): ChatMessage {
    const data: ChatMessageData = {
      id: row.id,
      roomId: row.room_id,
      userId: row.user_id,
      message: row.message,
      createdAt: new Date(row.created_at),
    };

    return ChatMessage.create(data);
  }
}
