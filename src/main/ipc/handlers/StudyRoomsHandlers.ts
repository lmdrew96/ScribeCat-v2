/**
 * StudyRoomsHandlers
 *
 * IPC handlers for study room operations.
 * Manages rooms, participants, and invitations between renderer and main process.
 */

import { IpcMain } from 'electron';
import { BaseHandler } from '../BaseHandler.js';
import { SupabaseStudyRoomsRepository } from '../../../infrastructure/services/supabase/SupabaseStudyRoomsRepository.js';

export class StudyRoomsHandlers extends BaseHandler {
  private currentUserId: string | null = null;
  private repository: SupabaseStudyRoomsRepository;

  constructor() {
    super();
    this.repository = new SupabaseStudyRoomsRepository();
  }

  /**
   * Set current authenticated user ID
   */
  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
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
      sessionId: string;
      maxParticipants: number;
    }) => {
      if (!this.currentUserId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        const room = await this.repository.createRoom({
          name: params.name,
          hostId: this.currentUserId,
          sessionId: params.sessionId,
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
  }
}
