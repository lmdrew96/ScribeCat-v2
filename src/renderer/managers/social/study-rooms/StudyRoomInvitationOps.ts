/**
 * StudyRoomInvitationOps
 *
 * Handles invitation operations: send, accept, decline, cancel.
 */

import { createLogger } from '../../../../shared/logger.js';
import type { RoomInvitationData } from '../../../../domain/entities/RoomInvitation.js';

const logger = createLogger('StudyRoomInvitationOps');

export type InvitationsChangeNotifier = () => void;
export type RoomsReloader = () => Promise<void>;

export interface InvitationOpsDependencies {
  getCurrentUserId: () => string | null;
  getInvitations: () => RoomInvitationData[];
  setInvitations: (invitations: RoomInvitationData[]) => void;
  notifyInvitationsListeners: InvitationsChangeNotifier;
  loadRooms: RoomsReloader;
}

export class StudyRoomInvitationOps {
  private deps: InvitationOpsDependencies;

  constructor(deps: InvitationOpsDependencies) {
    this.deps = deps;
  }

  /**
   * Load invitations from the server
   */
  async loadInvitations(): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.getUserInvitations();

      if (result.success) {
        this.deps.setInvitations(result.invitations || []);
        this.deps.notifyInvitationsListeners();
        logger.info(`Loaded ${(result.invitations || []).length} invitations`);
      } else {
        logger.error('Failed to load invitations:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception loading invitations:', error);
      throw error;
    }
  }

  /**
   * Get pending invitations (received by current user)
   */
  getPendingInvitations(): RoomInvitationData[] {
    const currentUserId = this.deps.getCurrentUserId();
    if (!currentUserId) return [];

    return this.deps.getInvitations().filter(
      inv => inv.status === 'pending' && inv.inviteeId === currentUserId
    );
  }

  /**
   * Get sent invitations (sent by current user)
   */
  getSentInvitations(): RoomInvitationData[] {
    const currentUserId = this.deps.getCurrentUserId();
    if (!currentUserId) return [];

    return this.deps.getInvitations().filter(
      inv => inv.status === 'pending' && inv.inviterId === currentUserId
    );
  }

  /**
   * Get pending invitations count
   */
  getPendingInvitationsCount(): number {
    return this.getPendingInvitations().length;
  }

  /**
   * Send an invitation to join a room
   */
  async sendInvitation(roomId: string, inviteeId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.sendInvitation({
        roomId,
        inviteeId,
      });

      if (result.success && result.invitation) {
        const invitations = this.deps.getInvitations();
        invitations.push(result.invitation);
        this.deps.setInvitations(invitations);
        this.deps.notifyInvitationsListeners();

        logger.info('Invitation sent to:', inviteeId);
      } else {
        logger.error('Failed to send invitation:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception sending invitation:', error);
      throw error;
    }
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(invitationId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.acceptInvitation(invitationId);

      if (result.success) {
        const invitations = this.deps.getInvitations();
        const invitation = invitations.find(inv => inv.id === invitationId);
        if (invitation) {
          invitation.status = 'accepted';
          this.deps.setInvitations(invitations);
          this.deps.notifyInvitationsListeners();

          // Reload rooms to include the new room
          await this.deps.loadRooms();
        }

        logger.info('Invitation accepted:', invitationId);
      } else {
        logger.error('Failed to accept invitation:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception accepting invitation:', error);
      throw error;
    }
  }

  /**
   * Decline an invitation
   */
  async declineInvitation(invitationId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.declineInvitation(invitationId);

      if (result.success) {
        const invitations = this.deps.getInvitations();
        const invitation = invitations.find(inv => inv.id === invitationId);
        if (invitation) {
          invitation.status = 'declined';
          this.deps.setInvitations(invitations);
          this.deps.notifyInvitationsListeners();
        }

        logger.info('Invitation declined:', invitationId);
      } else {
        logger.error('Failed to decline invitation:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception declining invitation:', error);
      throw error;
    }
  }

  /**
   * Cancel an invitation (sender only)
   */
  async cancelInvitation(invitationId: string): Promise<void> {
    try {
      const result = await window.scribeCat.studyRooms.cancelInvitation(invitationId);

      if (result.success) {
        const invitations = this.deps.getInvitations().filter(inv => inv.id !== invitationId);
        this.deps.setInvitations(invitations);
        this.deps.notifyInvitationsListeners();

        logger.info('Invitation cancelled:', invitationId);
      } else {
        logger.error('Failed to cancel invitation:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Exception cancelling invitation:', error);
      throw error;
    }
  }

  /**
   * Handle real-time invitation change events
   */
  handleInvitationChange(invitation: RoomInvitationData, eventType: 'INSERT' | 'UPDATE'): void {
    try {
      logger.info('📨 Invitation change event:', eventType, invitation);
      console.log(`📨 handleInvitationChange called: ${eventType}`, invitation);

      const invitations = this.deps.getInvitations();

      if (eventType === 'INSERT') {
        const existingIndex = invitations.findIndex(inv => inv.id === invitation.id);
        if (existingIndex === -1) {
          invitations.push(invitation);
          console.log('➕ Added new invitation to local state. Total invitations:', invitations.length);
        } else {
          console.log('⚠️ Invitation already exists in local state');
        }
      } else if (eventType === 'UPDATE') {
        const existingIndex = invitations.findIndex(inv => inv.id === invitation.id);
        if (existingIndex !== -1) {
          invitations[existingIndex] = invitation;
          console.log('📝 Updated existing invitation in local state');
        } else {
          console.log('⚠️ Tried to update non-existent invitation');
        }
      }

      this.deps.setInvitations(invitations);
      console.log('🔔 Notifying invitation listeners');
      this.deps.notifyInvitationsListeners();
    } catch (error) {
      logger.error('Error handling invitation change:', error);
    }
  }
}
