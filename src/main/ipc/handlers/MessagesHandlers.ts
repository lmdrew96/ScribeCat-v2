/**
 * MessagesHandlers
 *
 * IPC handlers for direct message operations (Neomail-style).
 * Manages private messages between friends.
 */

import { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import { SupabaseMessagesRepository } from '../../../infrastructure/services/supabase/SupabaseMessagesRepository.js';
import { MessageAttachmentData } from '../../../domain/entities/DirectMessage.js';

export class MessagesHandlers extends BaseHandler {
  private repository: SupabaseMessagesRepository;
  private currentUserId: string | null = null;

  constructor() {
    super();
    this.repository = new SupabaseMessagesRepository();
  }

  /**
   * Set the current user ID (called on auth state change)
   */
  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
  }

  /**
   * Register all message IPC handlers
   */
  register(ipcMain: IpcMain): void {
    // ============================================================================
    // Message Operations
    // ============================================================================

    this.handle(
      ipcMain,
      'messages:send',
      async (
        _event,
        params: {
          recipientId: string;
          subject?: string;
          content: string;
          attachments?: MessageAttachmentData[];
        }
      ) => {
        try {
          if (!this.currentUserId) {
            return { success: false, error: 'Not authenticated' };
          }

          const message = await this.repository.sendMessage({
            senderId: this.currentUserId,
            recipientId: params.recipientId,
            subject: params.subject,
            content: params.content,
            attachments: params.attachments,
          });

          return {
            success: true,
            message: message.toJSON(),
          };
        } catch (error) {
          console.error('[MessagesHandlers] Failed to send message:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send message',
          };
        }
      }
    );

    this.handle(ipcMain, 'messages:getInbox', async (_event, limit?: number) => {
      try {
        if (!this.currentUserId) {
          return { success: false, error: 'Not authenticated' };
        }

        const messages = await this.repository.getInbox(this.currentUserId, limit);

        return {
          success: true,
          messages: messages.map((msg) => msg.toJSON()),
        };
      } catch (error) {
        console.error('[MessagesHandlers] Failed to get inbox:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get inbox',
        };
      }
    });

    this.handle(ipcMain, 'messages:getSent', async (_event, limit?: number) => {
      try {
        if (!this.currentUserId) {
          return { success: false, error: 'Not authenticated' };
        }

        const messages = await this.repository.getSent(this.currentUserId, limit);

        return {
          success: true,
          messages: messages.map((msg) => msg.toJSON()),
        };
      } catch (error) {
        console.error('[MessagesHandlers] Failed to get sent messages:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get sent messages',
        };
      }
    });

    this.handle(
      ipcMain,
      'messages:getConversation',
      async (
        _event,
        params: {
          otherUserId: string;
          limit?: number;
        }
      ) => {
        try {
          if (!this.currentUserId) {
            return { success: false, error: 'Not authenticated' };
          }

          const messages = await this.repository.getConversation({
            userId: this.currentUserId,
            otherUserId: params.otherUserId,
            limit: params.limit,
          });

          return {
            success: true,
            messages: messages.map((msg) => msg.toJSON()),
          };
        } catch (error) {
          console.error('[MessagesHandlers] Failed to get conversation:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get conversation',
          };
        }
      }
    );

    this.handle(ipcMain, 'messages:getMessage', async (_event, messageId: string) => {
      try {
        if (!this.currentUserId) {
          return { success: false, error: 'Not authenticated' };
        }

        const message = await this.repository.getMessage(messageId, this.currentUserId);

        if (!message) {
          return { success: false, error: 'Message not found' };
        }

        return {
          success: true,
          message: message.toJSON(),
        };
      } catch (error) {
        console.error('[MessagesHandlers] Failed to get message:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get message',
        };
      }
    });

    this.handle(ipcMain, 'messages:markAsRead', async (_event, messageId: string) => {
      try {
        if (!this.currentUserId) {
          return { success: false, error: 'Not authenticated' };
        }

        await this.repository.markAsRead(messageId, this.currentUserId);

        return { success: true };
      } catch (error) {
        console.error('[MessagesHandlers] Failed to mark as read:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to mark as read',
        };
      }
    });

    this.handle(ipcMain, 'messages:markConversationAsRead', async (_event, senderId: string) => {
      try {
        if (!this.currentUserId) {
          return { success: false, error: 'Not authenticated' };
        }

        const count = await this.repository.markConversationAsRead(this.currentUserId, senderId);

        return { success: true, count };
      } catch (error) {
        console.error('[MessagesHandlers] Failed to mark conversation as read:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to mark conversation as read',
        };
      }
    });

    this.handle(ipcMain, 'messages:getUnreadCount', async () => {
      try {
        if (!this.currentUserId) {
          return { success: true, count: 0 };
        }

        const count = await this.repository.getUnreadCount(this.currentUserId);

        return { success: true, count };
      } catch (error) {
        console.error('[MessagesHandlers] Failed to get unread count:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get unread count',
        };
      }
    });

    this.handle(ipcMain, 'messages:delete', async (_event, messageId: string) => {
      try {
        if (!this.currentUserId) {
          return { success: false, error: 'Not authenticated' };
        }

        await this.repository.deleteMessage(messageId, this.currentUserId);

        return { success: true };
      } catch (error) {
        console.error('[MessagesHandlers] Failed to delete message:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete message',
        };
      }
    });

    // ============================================================================
    // Attachment Upload
    // ============================================================================

    this.handle(
      ipcMain,
      'messages:uploadAttachment',
      async (
        _event,
        params: {
          data: ArrayBuffer;
          name: string;
          type: string;
        }
      ) => {
        try {
          if (!this.currentUserId) {
            return { success: false, error: 'Not authenticated' };
          }

          const attachment = await this.repository.uploadAttachment({
            userId: this.currentUserId,
            data: params.data,
            name: params.name,
            type: params.type,
          });

          return {
            success: true,
            attachment,
          };
        } catch (error) {
          console.error('[MessagesHandlers] Failed to upload attachment:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to upload attachment',
          };
        }
      }
    );
  }

  /**
   * Cleanup method called on app shutdown
   */
  async cleanup(): Promise<void> {
    console.log('[MessagesHandlers] Cleanup complete');
  }
}
