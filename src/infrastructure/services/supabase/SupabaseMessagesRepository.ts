/**
 * Supabase Messages Repository
 * Handles direct message operations with Supabase (Neomail-style)
 */

import { SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';
import { SupabaseClient } from './SupabaseClient.js';
import {
  IMessagesRepository,
  SendMessageParams,
  GetConversationParams,
  UploadAttachmentParams,
} from '../../../domain/repositories/IMessagesRepository.js';
import { DirectMessage, MessageAttachmentData } from '../../../domain/entities/DirectMessage.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('SupabaseMessagesRepository');

interface DirectMessageRow {
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
}

export class SupabaseMessagesRepository implements IMessagesRepository {
  /**
   * Get a fresh Supabase client with the current session for REST calls
   */
  private getClient(): SupabaseClientType {
    return SupabaseClient.getInstance().getClient();
  }

  /**
   * Send a message to a friend
   */
  public async sendMessage(params: SendMessageParams): Promise<DirectMessage> {
    const { data, error } = await this.getClient()
      .from('direct_messages')
      .insert({
        sender_id: params.senderId,
        recipient_id: params.recipientId,
        subject: params.subject?.trim() || null,
        content: params.content.trim(),
        attachments: params.attachments || [],
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to send message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }

    // Fetch with profile info
    return this.getMessage(data.id, params.senderId) as Promise<DirectMessage>;
  }

  /**
   * Get inbox messages (received)
   */
  public async getInbox(userId: string, limit: number = 50): Promise<DirectMessage[]> {
    const { data, error } = await this.getClient().rpc('get_inbox_messages', {
      p_user_id: userId,
      p_limit: limit,
    });

    if (error) {
      logger.error('Failed to fetch inbox:', error);
      throw new Error(`Failed to fetch inbox: ${error.message}`);
    }

    return (data || []).map((row: DirectMessageRow) => DirectMessage.fromDatabase(row));
  }

  /**
   * Get sent messages
   */
  public async getSent(userId: string, limit: number = 50): Promise<DirectMessage[]> {
    const { data, error } = await this.getClient().rpc('get_sent_messages', {
      p_user_id: userId,
      p_limit: limit,
    });

    if (error) {
      logger.error('Failed to fetch sent messages:', error);
      throw new Error(`Failed to fetch sent messages: ${error.message}`);
    }

    return (data || []).map((row: DirectMessageRow) => DirectMessage.fromDatabase(row));
  }

  /**
   * Get conversation between two users
   */
  public async getConversation(params: GetConversationParams): Promise<DirectMessage[]> {
    const { data, error } = await this.getClient().rpc('get_conversation_messages', {
      p_user_id: params.userId,
      p_other_user_id: params.otherUserId,
      p_limit: params.limit || 50,
    });

    if (error) {
      logger.error('Failed to fetch conversation:', error);
      throw new Error(`Failed to fetch conversation: ${error.message}`);
    }

    return (data || []).map((row: DirectMessageRow) => DirectMessage.fromDatabase(row));
  }

  /**
   * Get a single message by ID
   */
  public async getMessage(messageId: string, userId: string): Promise<DirectMessage | null> {
    // Fetch the message
    const { data: message, error: messageError } = await this.getClient()
      .from('direct_messages')
      .select('*')
      .eq('id', messageId)
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .single();

    if (messageError) {
      if (messageError.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error('Failed to fetch message:', messageError);
      throw new Error(`Failed to fetch message: ${messageError.message}`);
    }

    if (!message) return null;

    // Fetch sender and recipient profiles separately
    const profileIds = [message.sender_id, message.recipient_id];
    const { data: profiles } = await this.getClient()
      .from('user_profiles')
      .select('id, email, username, full_name, avatar_url')
      .in('id', profileIds);

    const senderProfile = profiles?.find((p) => p.id === message.sender_id);
    const recipientProfile = profiles?.find((p) => p.id === message.recipient_id);

    // Map to flat structure
    const row: DirectMessageRow = {
      id: message.id,
      sender_id: message.sender_id,
      recipient_id: message.recipient_id,
      subject: message.subject,
      content: message.content,
      attachments: message.attachments,
      read_at: message.read_at,
      created_at: message.created_at,
      sender_email: senderProfile?.email,
      sender_username: senderProfile?.username,
      sender_full_name: senderProfile?.full_name,
      sender_avatar_url: senderProfile?.avatar_url,
      recipient_email: recipientProfile?.email,
      recipient_username: recipientProfile?.username,
      recipient_full_name: recipientProfile?.full_name,
      recipient_avatar_url: recipientProfile?.avatar_url,
    };

    return DirectMessage.fromDatabase(row);
  }

  /**
   * Mark a message as read
   */
  public async markAsRead(messageId: string, userId: string): Promise<void> {
    const { error } = await this.getClient()
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('recipient_id', userId)
      .is('read_at', null);

    if (error) {
      logger.error('Failed to mark message as read:', error);
      throw new Error(`Failed to mark message as read: ${error.message}`);
    }
  }

  /**
   * Mark all messages from a sender as read
   */
  public async markConversationAsRead(userId: string, senderId: string): Promise<number> {
    const { data, error } = await this.getClient().rpc('mark_conversation_as_read', {
      p_user_id: userId,
      p_sender_id: senderId,
    });

    if (error) {
      logger.error('Failed to mark conversation as read:', error);
      throw new Error(`Failed to mark conversation as read: ${error.message}`);
    }

    return data || 0;
  }

  /**
   * Get count of unread messages
   */
  public async getUnreadCount(userId: string): Promise<number> {
    const { data, error } = await this.getClient().rpc('get_unread_message_count', {
      p_user_id: userId,
    });

    if (error) {
      logger.error('Failed to get unread count:', error);
      throw new Error(`Failed to get unread count: ${error.message}`);
    }

    return data || 0;
  }

  /**
   * Delete a message (soft delete for current user)
   * Uses SECURITY DEFINER function to bypass RLS
   */
  public async deleteMessage(messageId: string, userId: string): Promise<void> {
    const { data, error } = await this.getClient().rpc('delete_message_for_user', {
      p_message_id: messageId,
      p_user_id: userId,
    });

    if (error) {
      logger.error('Failed to delete message:', error);
      throw new Error(`Failed to delete message: ${error.message}`);
    }

    // Check the result from the function
    const result = data as { success: boolean; error?: string; deleted_for?: string };
    if (!result.success) {
      logger.error('Delete message failed:', result.error);
      throw new Error(result.error || 'Failed to delete message');
    }

    logger.info('Message deleted for:', result.deleted_for);
  }

  /**
   * Upload an attachment to storage
   */
  public async uploadAttachment(params: UploadAttachmentParams): Promise<MessageAttachmentData> {
    const { userId, data, name, type } = params;

    // Generate unique filename
    const ext = name.split('.').pop() || 'bin';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `${userId}/${uniqueName}`;

    // Upload to storage
    const { error: uploadError } = await this.getClient().storage
      .from('message-attachments')
      .upload(path, data, {
        contentType: type,
        upsert: false,
      });

    if (uploadError) {
      logger.error('Failed to upload attachment:', uploadError);
      throw new Error(`Failed to upload attachment: ${uploadError.message}`);
    }

    // Get signed URL (valid for 1 year)
    const { data: urlData, error: urlError } = await this.getClient().storage
      .from('message-attachments')
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    if (urlError) {
      logger.error('Failed to get attachment URL:', urlError);
      throw new Error(`Failed to get attachment URL: ${urlError.message}`);
    }

    // Determine attachment type
    const isImage = type.startsWith('image/');
    const attachmentType: 'image' | 'file' = isImage ? 'image' : 'file';

    return {
      type: attachmentType,
      url: urlData.signedUrl,
      name: name,
      size: data.byteLength,
      mimeType: type,
    };
  }
}
