/**
 * Supabase Chat Repository
 * Handles chat message operations with Supabase
 */

import { SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';
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
  /**
   * Get a fresh Supabase client with the current session for REST calls
   */
  private getClient(): SupabaseClientType {
    return SupabaseClient.getInstance().getClient();
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
