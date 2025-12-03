/**
 * ChatHandlers
 *
 * IPC handlers for chat message operations (send, get, delete).
 * Real-time subscriptions are handled directly in ChatManager (renderer).
 */

import { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import { SupabaseChatRepository } from '../../../infrastructure/services/supabase/SupabaseChatRepository.js';

export class ChatHandlers extends BaseHandler {
  private repository: SupabaseChatRepository;

  constructor() {
    super();
    this.repository = new SupabaseChatRepository();
  }

  /**
   * Register all chat IPC handlers
   */
  register(ipcMain: IpcMain): void {
    // ============================================================================
    // Message Operations
    // ============================================================================

    this.handle(ipcMain, 'chat:sendMessage', async (_event, params: {
      roomId: string;
      userId: string;
      message: string;
    }) => {
      try {
        const chatMessage = await this.repository.sendMessage({
          roomId: params.roomId,
          userId: params.userId,
          message: params.message,
        });

        return {
          success: true,
          message: chatMessage.toJSON(),
        };
      } catch (error) {
        console.error('[ChatHandlers] Failed to send message:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send message',
        };
      }
    });

    this.handle(ipcMain, 'chat:getRoomMessages', async (_event, roomId: string, limit?: number) => {
      try {
        const messages = await this.repository.getRoomMessages(roomId, limit);

        return {
          success: true,
          messages: messages.map((msg) => msg.toJSON()),
        };
      } catch (error) {
        console.error('[ChatHandlers] Failed to get messages:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get messages',
        };
      }
    });

    this.handle(ipcMain, 'chat:deleteMessage', async (_event, messageId: string, userId: string) => {
      try {
        await this.repository.deleteMessage(messageId, userId);

        return { success: true };
      } catch (error) {
        console.error('[ChatHandlers] Failed to delete message:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete message',
        };
      }
    });
  }
}
