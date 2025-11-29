/**
 * StudyRoomsHandlers
 *
 * IPC handlers for study room operations.
 * Manages rooms, participants, and invitations between renderer and main process.
 */

import { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import { SupabaseStudyRoomsRepository } from '../../../infrastructure/services/supabase/SupabaseStudyRoomsRepository.js';
import { SupabaseSessionRepository } from '../../../infrastructure/repositories/SupabaseSessionRepository.js';

export class StudyRoomsHandlers extends BaseHandler {
  private currentUserId: string | null = null;
  private repository: SupabaseStudyRoomsRepository;
  private sessionRepository: SupabaseSessionRepository;
  private subscriptions: Map<string, () => void> = new Map();

  constructor() {
    super();
    this.repository = new SupabaseStudyRoomsRepository();
    this.sessionRepository = new SupabaseSessionRepository();
  }

  /**
   * Set current authenticated user ID
   */
  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
    this.sessionRepository.setUserId(userId);
  }

  /**
   * Register all study room IPC handlers
   */
  register(ipcMain: IpcMain): void {
    // ============================================================================
    // Room Operations
    // ============================================================================

    this.handle(ipcMain, 'rooms:createRoom', async (_event, params: {
      name: string;
      sessionId: string | null;
      maxParticipants: number;
    }) => {
      if (!this.currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        // If a session is provided, create a copy for the room
        let sessionIdForRoom: string | null = null;

        if (params.sessionId) {
          console.log(`Creating session copy for room: ${params.sessionId}`);

          try {
            sessionIdForRoom = await this.sessionRepository.copySessionForRoom(
              params.sessionId,
              this.currentUserId,
              '[Room] '
            );

            console.log(`Session copied successfully: ${params.sessionId} -> ${sessionIdForRoom}`);
          } catch (copyError) {
            console.error('Error copying session for room:', copyError);
            return {
              success: false,
              error: `Failed to copy session: ${copyError instanceof Error ? copyError.message : 'Unknown error'}`,
            };
          }
        }

        const room = await this.repository.createRoom({
          name: params.name,
          hostId: this.currentUserId,
          sessionId: sessionIdForRoom || params.sessionId,
          maxParticipants: params.maxParticipants,
        });

        return {
          success: true,
          room: room.toJSON(),
        };
      } catch (error) {
        console.error('Error creating room:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    this.handle(ipcMain, 'rooms:getUserRooms', async (_event) => {
      if (!this.currentUserId) {
        return { success: false, rooms: [], error: 'Not authenticated' };
      }

      try {
        const rooms = await this.repository.getUserRooms(this.currentUserId);

        return {
          success: true,
          rooms: rooms.map(r => r.toJSON()),
        };
      } catch (error) {
        console.error('Error fetching rooms:', error);
        return {
          success: false,
          rooms: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    this.handle(ipcMain, 'rooms:getRejoinableRooms', async (_event) => {
      if (!this.currentUserId) {
        return { success: false, rooms: [], error: 'Not authenticated' };
      }

      try {
        const rooms = await this.repository.getRejoinableRooms(this.currentUserId);

        return {
          success: true,
          rooms: rooms.map(r => r.toJSON()),
        };
      } catch (error) {
        console.error('Error fetching rejoinable rooms:', error);
        return {
          success: false,
          rooms: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    this.handle(ipcMain, 'rooms:getRoomById', async (_event, roomId: string) => {
      if (!this.currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        const room = await this.repository.getRoomById(roomId);

        if (!room) {
          return {
            success: false,
            error: 'Room not found',
          };
        }

        return {
          success: true,
          room: room.toJSON(),
        };
      } catch (error) {
        console.error('Error fetching room:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    this.handle(ipcMain, 'rooms:closeRoom', async (_event, roomId: string) => {
      if (!this.currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        await this.repository.closeRoom(roomId, this.currentUserId);

        return { success: true };
      } catch (error) {
        console.error('Error closing room:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    this.handle(ipcMain, 'rooms:updateRoom', async (_event, params: {
      roomId: string;
      name?: string;
      maxParticipants?: number;
    }) => {
      if (!this.currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        await this.repository.updateRoom(params.roomId, this.currentUserId, {
          name: params.name,
          maxParticipants: params.maxParticipants,
        });

        return { success: true };
      } catch (error) {
        console.error('Error updating room:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // ============================================================================
    // Participant Operations
    // ============================================================================

    this.handle(ipcMain, 'rooms:getRoomParticipants', async (_event, roomId: string) => {
      if (!this.currentUserId) {
        return { success: false, participants: [], error: 'Not authenticated' };
      }

      try {
        const participants = await this.repository.getRoomParticipants(roomId);

        return {
          success: true,
          participants: participants.map(p => p.toJSON()),
        };
      } catch (error) {
        console.error('Error fetching participants:', error);
        return {
          success: false,
          participants: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    this.handle(ipcMain, 'rooms:getParticipantCount', async (_event, roomId: string) => {
      if (!this.currentUserId) {
        return { success: false, count: 0, error: 'Not authenticated' };
      }

      try {
        const count = await this.repository.getActiveParticipantCount(roomId);

        return {
          success: true,
          count,
        };
      } catch (error) {
        console.error('Error counting participants:', error);
        return {
          success: false,
          count: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    this.handle(ipcMain, 'rooms:joinRoom', async (_event, roomId: string) => {
      if (!this.currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        const participant = await this.repository.joinRoom(roomId, this.currentUserId);

        return {
          success: true,
          participant: participant.toJSON(),
        };
      } catch (error) {
        console.error('Error joining room:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    this.handle(ipcMain, 'rooms:leaveRoom', async (_event, roomId: string) => {
      if (!this.currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        await this.repository.leaveRoom(roomId, this.currentUserId);

        return { success: true };
      } catch (error) {
        console.error('Error leaving room:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    this.handle(ipcMain, 'rooms:removeParticipant', async (_event, params: {
      roomId: string;
      participantId: string;
    }) => {
      if (!this.currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        await this.repository.removeParticipant(
          params.roomId,
          params.participantId,
          this.currentUserId
        );

        return { success: true };
      } catch (error) {
        console.error('Error removing participant:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    this.handle(ipcMain, 'rooms:isUserInRoom', async (_event, roomId: string) => {
      if (!this.currentUserId) {
        return { success: false, isInRoom: false, error: 'Not authenticated' };
      }

      try {
        const isInRoom = await this.repository.isUserInRoom(roomId, this.currentUserId);

        return {
          success: true,
          isInRoom,
        };
      } catch (error) {
        console.error('Error checking if user is in room:', error);
        return {
          success: false,
          isInRoom: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // ============================================================================
    // Invitation Operations
    // ============================================================================

    this.handle(ipcMain, 'rooms:sendInvitation', async (_event, params: {
      roomId: string;
      inviteeId: string;
    }) => {
      if (!this.currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        const invitation = await this.repository.sendInvitation({
          roomId: params.roomId,
          inviterId: this.currentUserId,
          inviteeId: params.inviteeId,
        });

        return {
          success: true,
          invitation: invitation.toJSON(),
        };
      } catch (error) {
        console.error('Error sending invitation:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    this.handle(ipcMain, 'rooms:getUserInvitations', async (_event) => {
      if (!this.currentUserId) {
        return { success: false, invitations: [], error: 'Not authenticated' };
      }

      try {
        const invitations = await this.repository.getUserInvitations(this.currentUserId);

        return {
          success: true,
          invitations: invitations.map(inv => inv.toJSON()),
        };
      } catch (error) {
        console.error('Error fetching invitations:', error);
        return {
          success: false,
          invitations: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    this.handle(ipcMain, 'rooms:getPendingInvitations', async (_event) => {
      if (!this.currentUserId) {
        return { success: false, invitations: [], error: 'Not authenticated' };
      }

      try {
        const invitations = await this.repository.getPendingInvitations(this.currentUserId);

        return {
          success: true,
          invitations: invitations.map(inv => inv.toJSON()),
        };
      } catch (error) {
        console.error('Error fetching pending invitations:', error);
        return {
          success: false,
          invitations: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    this.handle(ipcMain, 'rooms:acceptInvitation', async (_event, invitationId: string) => {
      if (!this.currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        await this.repository.acceptInvitation(invitationId, this.currentUserId);

        return { success: true };
      } catch (error) {
        console.error('Error accepting invitation:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    this.handle(ipcMain, 'rooms:declineInvitation', async (_event, invitationId: string) => {
      if (!this.currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        await this.repository.declineInvitation(invitationId, this.currentUserId);

        return { success: true };
      } catch (error) {
        console.error('Error declining invitation:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    this.handle(ipcMain, 'rooms:cancelInvitation', async (_event, invitationId: string) => {
      if (!this.currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        await this.repository.cancelInvitation(invitationId, this.currentUserId);

        return { success: true };
      } catch (error) {
        console.error('Error cancelling invitation:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // ============================================================================
    // Realtime Subscriptions
    // ============================================================================

    this.handle(ipcMain, 'rooms:subscribeToInvitations', async (event) => {
      if (!this.currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        // Create a unique key for this subscription (user + sender)
        const subscriptionKey = `invitations-${this.currentUserId}-${event.sender.id}`;

        // Unsubscribe from previous subscription if exists
        const existingUnsubscribe = this.subscriptions.get(subscriptionKey);
        if (existingUnsubscribe) {
          console.log(`[StudyRoomsHandlers] Unsubscribing from previous subscription: ${subscriptionKey}`);
          existingUnsubscribe();
          this.subscriptions.delete(subscriptionKey);
        }

        // Subscribe and send invitation events to renderer
        const unsubscribe = this.repository.subscribeToUserInvitations(
          this.currentUserId,
          (invitation, eventType) => {
            console.log(`🎯 [StudyRoomsHandlers] Invitation event received in IPC handler:`, {
              eventType,
              invitationId: invitation.id,
              inviteeId: invitation.inviteeId,
              inviterId: invitation.inviterId,
              roomName: invitation.roomName,
            });
            if (!event.sender.isDestroyed()) {
              console.log(`📤 [StudyRoomsHandlers] Forwarding invitation to renderer`);
              event.sender.send('rooms:invitationReceived', {
                invitation: invitation.toJSON(),
                eventType,
              });
            } else {
              console.warn(`⚠️ [StudyRoomsHandlers] Cannot forward - renderer is destroyed`);
            }
          }
        );

        // Store the unsubscribe function
        this.subscriptions.set(subscriptionKey, unsubscribe);

        // Clean up when window is closed
        event.sender.on('destroyed', () => {
          const storedUnsubscribe = this.subscriptions.get(subscriptionKey);
          if (storedUnsubscribe) {
            console.log(`[StudyRoomsHandlers] Cleaning up subscription on window close: ${subscriptionKey}`);
            // Fire and forget - window is already destroyed so we can't await
            storedUnsubscribe().catch(err =>
              console.error(`[StudyRoomsHandlers] Error during cleanup: ${err}`)
            );
            this.subscriptions.delete(subscriptionKey);
          }
        });

        return { success: true };
      } catch (error) {
        console.error('[StudyRoomsHandlers] Failed to subscribe to invitations:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to subscribe',
        };
      }
    });

    this.handle(ipcMain, 'rooms:unsubscribeFromInvitations', async () => {
      try {
        // Call all stored unsubscribe functions
        const unsubscribePromises = Array.from(this.subscriptions.entries()).map(([key, unsubscribe]) => {
          console.log(`[StudyRoomsHandlers] Unsubscribing: ${key}`);
          return unsubscribe();
        });
        await Promise.all(unsubscribePromises);
        this.subscriptions.clear();

        // Also call repository unsubscribeAll as a fallback
        await this.repository.unsubscribeAll();

        return { success: true };
      } catch (error) {
        console.error('[StudyRoomsHandlers] Failed to unsubscribe:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to unsubscribe',
        };
      }
    });
  }

  /**
   * Cleanup all subscriptions (called on app quit)
   */
  public async cleanup(): Promise<void> {
    console.log('[StudyRoomsHandlers] Cleaning up all subscriptions on app quit');

    // Unsubscribe all active subscriptions
    const unsubscribePromises = Array.from(this.subscriptions.values()).map(unsubscribe =>
      unsubscribe()
    );
    await Promise.all(unsubscribePromises);
    this.subscriptions.clear();

    // Also cleanup repository channels
    await this.repository.unsubscribeAll();

    console.log('[StudyRoomsHandlers] All subscriptions cleaned up');
  }
}
