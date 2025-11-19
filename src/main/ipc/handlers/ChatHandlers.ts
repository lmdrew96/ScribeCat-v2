/**
 * ChatHandlers
 *
 * IPC handlers for chat operations.
 * Manages chat messages and real-time subscriptions between renderer and main process.
 */

import { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import { SupabaseChatRepository } from '../../../infrastructure/services/supabase/SupabaseChatRepository.js';

export class ChatHandlers extends BaseHandler {
  private repository: SupabaseChatRepository;
  private subscriptions: Map<string, () => void> = new Map();

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

    // ============================================================================
    // Real-time Subscriptions
    // ============================================================================

    this.handle(ipcMain, 'chat:subscribeToRoom', async (event, roomId: string) => {
      try {
        // Create a unique key for this subscription (room + sender)
        const subscriptionKey = `${roomId}-${event.sender.id}`;

        // Unsubscribe from previous subscription if exists
        const existingUnsubscribe = this.subscriptions.get(subscriptionKey);
        if (existingUnsubscribe) {
          console.log(`[ChatHandlers] Unsubscribing from previous subscription: ${subscriptionKey}`);
          existingUnsubscribe();
          this.subscriptions.delete(subscriptionKey);
        }

        // Subscribe and send new messages and typing events to renderer
        const unsubscribe = this.repository.subscribeToRoom(
          roomId,
          (message) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send('chat:newMessage', {
                roomId,
                message: message.toJSON(),
              });
            }
          },
          (userId, userName, isTyping) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send('chat:typingStatus', {
                roomId,
                userId,
                userName,
                isTyping,
              });
            }
          }
        );

        // Store the unsubscribe function
        this.subscriptions.set(subscriptionKey, unsubscribe);

        // Clean up when window is closed
        event.sender.on('destroyed', () => {
          const storedUnsubscribe = this.subscriptions.get(subscriptionKey);
          if (storedUnsubscribe) {
            console.log(`[ChatHandlers] Cleaning up subscription on window close: ${subscriptionKey}`);
            storedUnsubscribe();
            this.subscriptions.delete(subscriptionKey);
          }
        });

        return { success: true };
      } catch (error) {
        console.error('[ChatHandlers] Failed to subscribe to room:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to subscribe',
        };
      }
    });

    this.handle(ipcMain, 'chat:broadcastTyping', async (_event, params: {
      roomId: string;
      userId: string;
      userName: string;
      isTyping: boolean;
    }) => {
      try {
        await this.repository.broadcastTypingStatus(
          params.roomId,
          params.userId,
          params.userName,
          params.isTyping
        );

        return { success: true };
      } catch (error) {
        console.error('[ChatHandlers] Failed to broadcast typing:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to broadcast typing',
        };
      }
    });

    this.handle(ipcMain, 'chat:unsubscribeAll', async () => {
      try {
        // Call all stored unsubscribe functions
        this.subscriptions.forEach((unsubscribe, key) => {
          console.log(`[ChatHandlers] Unsubscribing: ${key}`);
          unsubscribe();
        });
        this.subscriptions.clear();

        // Also call repository unsubscribeAll as a fallback
        this.repository.unsubscribeAll();

        return { success: true };
      } catch (error) {
        console.error('[ChatHandlers] Failed to unsubscribe:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to unsubscribe',
        };
      }
    });
  }
}
