/**
 * RealtimeNotificationManager
 *
 * Coordinates realtime notification display for social events.
 * Listens to StudyRoomsManager and FriendsManager for new invitations and friend requests
 * and displays visual notifications via NotificationTicker.
 */

import { createLogger } from '../../shared/logger.js';
import type { StudyRoomsManager } from './social/StudyRoomsManager.js';
import type { FriendsManager } from './social/FriendsManager.js';
import type { NotificationTicker } from './NotificationTicker.js';
import type { RoomInvitationData } from '../../domain/entities/RoomInvitation.js';
import type { FriendRequestData } from '../../domain/entities/FriendRequest.js';

const logger = createLogger('RealtimeNotificationManager');

/**
 * RealtimeNotificationManager - Shows notifications for realtime social events
 */
export class RealtimeNotificationManager {
  private studyRoomsManager: StudyRoomsManager | null = null;
  private friendsManager: FriendsManager | null = null;
  private notificationTicker: NotificationTicker | null = null;

  private currentUserId: string | null = null;
  private previousInvitationIds: Set<string> = new Set();
  private previousRequestIds: Set<string> = new Set();

  constructor() {
    logger.info('RealtimeNotificationManager initialized');
  }

  /**
   * Initialize with manager instances
   */
  initialize(
    studyRoomsManager: StudyRoomsManager,
    friendsManager: FriendsManager,
    notificationTicker: NotificationTicker,
    currentUserId: string
  ): void {
    this.studyRoomsManager = studyRoomsManager;
    this.friendsManager = friendsManager;
    this.notificationTicker = notificationTicker;
    this.currentUserId = currentUserId;

    // Initialize tracking sets with current state
    const currentInvitations = this.studyRoomsManager.getPendingInvitations();
    const currentRequests = this.friendsManager.getIncomingRequests();

    this.previousInvitationIds = new Set(currentInvitations.map(inv => inv.id));
    this.previousRequestIds = new Set(currentRequests.map(req => req.id));

    // Add listeners
    this.studyRoomsManager.addInvitationsListener(this.handleInvitationsChange.bind(this));
    this.friendsManager.addRequestsListener(this.handleRequestsChange.bind(this));

    logger.info('RealtimeNotificationManager initialized for user:', currentUserId);
  }

  /**
   * Clear all data (on sign out)
   */
  clear(): void {
    this.studyRoomsManager = null;
    this.friendsManager = null;
    this.notificationTicker = null;
    this.currentUserId = null;
    this.previousInvitationIds.clear();
    this.previousRequestIds.clear();

    logger.info('RealtimeNotificationManager cleared');
  }

  /**
   * Handle invitations change event
   */
  private handleInvitationsChange(invitations: RoomInvitationData[]): void {
    console.log('🔔 RealtimeNotificationManager: handleInvitationsChange called with', invitations.length, 'invitations');

    if (!this.currentUserId) {
      console.warn('⚠️ RealtimeNotificationManager: No current user ID');
      return;
    }
    if (!this.notificationTicker) {
      console.warn('⚠️ RealtimeNotificationManager: No notification ticker');
      return;
    }

    // Filter to pending invitations for current user
    const pendingInvitations = invitations.filter(
      inv => inv.status === 'pending' && inv.inviteeId === this.currentUserId
    );

    console.log('📋 Filtered to', pendingInvitations.length, 'pending invitations for user', this.currentUserId);
    console.log('📋 Previous invitation IDs:', Array.from(this.previousInvitationIds));

    // Check for new invitations
    for (const invitation of pendingInvitations) {
      if (!this.previousInvitationIds.has(invitation.id)) {
        // New invitation received!
        console.log('🎉 NEW INVITATION DETECTED! ID:', invitation.id, 'Room:', invitation.roomName);
        this.showInvitationNotification(invitation);
        this.previousInvitationIds.add(invitation.id);
      } else {
        console.log('📌 Invitation already known:', invitation.id);
      }
    }

    // Remove invitations that are no longer pending (accepted/declined)
    const currentIds = new Set(pendingInvitations.map(inv => inv.id));
    for (const previousId of this.previousInvitationIds) {
      if (!currentIds.has(previousId)) {
        console.log('🗑️ Removing old invitation ID:', previousId);
        this.previousInvitationIds.delete(previousId);
      }
    }
  }

  /**
   * Handle friend requests change event
   */
  private handleRequestsChange(requests: FriendRequestData[]): void {
    if (!this.currentUserId || !this.notificationTicker) return;

    // Filter to incoming pending requests for current user
    const incomingRequests = requests.filter(
      req => req.status === 'pending' && req.recipientId === this.currentUserId
    );

    // Check for new requests
    for (const request of incomingRequests) {
      if (!this.previousRequestIds.has(request.id)) {
        // New friend request received!
        this.showFriendRequestNotification(request);
        this.previousRequestIds.add(request.id);
      }
    }

    // Remove requests that are no longer pending (accepted/rejected)
    const currentIds = new Set(incomingRequests.map(req => req.id));
    for (const previousId of this.previousRequestIds) {
      if (!currentIds.has(previousId)) {
        this.previousRequestIds.delete(previousId);
      }
    }
  }

  /**
   * Show notification for a new room invitation
   */
  private showInvitationNotification(invitation: RoomInvitationData): void {
    console.log('📢 showInvitationNotification called for invitation:', invitation);

    if (!this.notificationTicker) {
      logger.warn('NotificationTicker not available');
      console.error('❌ NotificationTicker not available in RealtimeNotificationManager');
      return;
    }

    logger.info('Showing invitation notification for:', invitation);

    const inviterName = invitation.inviterFullName || invitation.inviterEmail || 'Someone';
    const roomName = invitation.roomName || 'a study room';

    const message = `${inviterName} invited you to join ${roomName}`;
    logger.info('Notification message:', message);
    console.log('📝 Notification message:', message);

    // Actually show the notification
    const notificationId = this.notificationTicker.info(message, 7000);
    console.log('✅ Notification shown with ID:', notificationId);

    logger.info('Showed invitation notification:', invitation.id);
  }

  /**
   * Show notification for a new friend request
   */
  private showFriendRequestNotification(request: FriendRequestData): void {
    if (!this.notificationTicker) {
      logger.warn('NotificationTicker not available');
      return;
    }

    logger.info('Showing friend request notification for:', request);

    const senderName = request.senderFullName || request.senderEmail || 'Someone';
    const message = `${senderName} sent you a friend request`;
    logger.info('Notification message:', message);

    this.notificationTicker.info(message, 7000);

    logger.info('Showed friend request notification:', request.id);
  }

  /**
   * Get pending invitations count (for badge display)
   */
  getPendingInvitationsCount(): number {
    return this.previousInvitationIds.size;
  }

  /**
   * Get incoming friend requests count (for badge display)
   */
  getIncomingRequestsCount(): number {
    return this.previousRequestIds.size;
  }
}
