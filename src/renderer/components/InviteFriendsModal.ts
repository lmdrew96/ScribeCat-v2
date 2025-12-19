/**
 * Invite Friends Modal
 * Simple modal to invite friends to a study room
 */

import type { FriendsManager } from '../managers/social/FriendsManager.js';
import type { StudyRoomsManager } from '../managers/social/StudyRoomsManager.js';
import type { FriendData } from '../../domain/entities/Friend.js';
import { escapeHtml } from '../utils/formatting.js';

export class InviteFriendsModal {
  private modal: HTMLElement | null = null;
  private friendsManager: FriendsManager;
  private studyRoomsManager: StudyRoomsManager;
  private currentRoomId: string | null = null;

  constructor(friendsManager: FriendsManager, studyRoomsManager: StudyRoomsManager) {
    this.friendsManager = friendsManager;
    this.studyRoomsManager = studyRoomsManager;
  }

  /**
   * Show the invite friends modal
   */
  public show(roomId: string): void {
    this.currentRoomId = roomId;
    this.createModal();
    this.renderFriendsList();
  }

  /**
   * Hide and destroy the modal
   */
  public hide(): void {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    this.currentRoomId = null;
  }

  /**
   * Create modal structure
   */
  private createModal(): void {
    const modalHTML = `
      <div class="modal-overlay" id="invite-friends-modal" style="display: flex !important; align-items: center; justify-content: center; position: fixed !important; z-index: 10300 !important;">
        <div class="modal-content invite-modal">
          <div class="modal-header">
            <h2>Invite Friends to Study Room</h2>
            <button class="btn-close" id="close-invite-modal">×</button>
          </div>

          <div class="modal-body">
            <div id="invite-friends-list" class="invite-friends-list">
              <div class="loading">Loading friends...</div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" id="cancel-invite-btn">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('invite-friends-modal');

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.modal) return;

    // Close button
    const closeBtn = document.getElementById('close-invite-modal');
    closeBtn?.addEventListener('click', () => this.hide());

    // Cancel button
    const cancelBtn = document.getElementById('cancel-invite-btn');
    cancelBtn?.addEventListener('click', () => this.hide());

    // Click outside to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // ESC to close
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  /**
   * Render friends list
   */
  private renderFriendsList(): void {
    const container = document.getElementById('invite-friends-list');
    if (!container || !this.currentRoomId) return;

    const friends = this.friendsManager.getFriends();

    if (friends.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>You don't have any friends to invite yet.</p>
          <p>Add some friends first!</p>
        </div>
      `;
      return;
    }

    // Get room participants to filter out already-in-room friends
    const participants = this.studyRoomsManager.getRoomParticipants(this.currentRoomId);
    const participantIds = new Set(participants.map(p => p.userId));

    // Filter out friends already in the room
    const invitableFriends = friends.filter(f => !participantIds.has(f.friendId));

    if (invitableFriends.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>All your friends are already in this room!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = invitableFriends
      .map(friend => this.renderFriendItem(friend))
      .join('');

    // Attach invite listeners
    this.attachInviteListeners();
  }

  /**
   * Render a friend item
   */
  private renderFriendItem(friend: FriendData): string {
    const displayName = friend.friendFullName || friend.friendEmail;
    const initials = this.getInitials(displayName);
    const statusClass = friend.isOnline ? 'online' : 'offline';

    return `
      <div class="invite-friend-item" data-friend-id="${friend.friendId}">
        <div class="friend-avatar-container">
          <div class="friend-avatar">${initials}</div>
          <span class="status-indicator ${statusClass}"></span>
        </div>
        <div class="friend-info">
          <p class="friend-name">${escapeHtml(displayName)}</p>
          <p class="friend-email">${escapeHtml(friend.friendEmail)}</p>
        </div>
        <button
          class="btn-primary btn-sm invite-btn"
          data-friend-id="${friend.friendId}"
          data-friend-name="${escapeHtml(displayName)}"
        >
          Invite
        </button>
      </div>
    `;
  }

  /**
   * Attach invite button listeners
   */
  private attachInviteListeners(): void {
    document.querySelectorAll('.invite-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const friendId = target.dataset.friendId;
        const friendName = target.dataset.friendName;

        if (!friendId || !this.currentRoomId) return;

        // Disable button
        (target as HTMLButtonElement).disabled = true;
        target.textContent = 'Sending...';

        try {
          await this.studyRoomsManager.sendInvitation(this.currentRoomId, friendId);

          // Show success
          target.textContent = 'Invited!';
          target.classList.remove('btn-primary');
          target.classList.add('btn-success');

          // Auto-close after 1 second
          setTimeout(() => this.hide(), 1000);
        } catch (error) {
          console.error('Failed to send invitation:', error);

          // Show error
          target.textContent = 'Failed';
          target.classList.add('btn-error');

          // Re-enable after 2 seconds
          setTimeout(() => {
            (target as HTMLButtonElement).disabled = false;
            target.textContent = 'Invite';
            target.classList.remove('btn-error');
            target.classList.add('btn-primary');
          }, 2000);
        }
      });
    });
  }

  /**
   * Get initials from name
   */
  private getInitials(name: string): string {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
}
