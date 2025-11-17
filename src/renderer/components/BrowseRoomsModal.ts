/**
 * BrowseRoomsModal
 *
 * Modal component for browsing and joining study rooms.
 * Features tabs for: My Rooms, Invitations, and Active rooms.
 */

import type { StudyRoomsManager } from '../managers/social/StudyRoomsManager.js';
import type { StudyRoomData } from '../../domain/entities/StudyRoom.js';
import type { RoomInvitationData } from '../../domain/entities/RoomInvitation.js';
import { escapeHtml } from '../utils/formatting.js';

type TabType = 'my-rooms' | 'invitations' | 'active';

export class BrowseRoomsModal {
  private modal: HTMLElement | null = null;
  private studyRoomsManager: StudyRoomsManager;
  private currentTab: TabType = 'my-rooms';
  private currentUserId: string | null = null;
  private onJoinRoom?: (roomId: string) => void;

  constructor(studyRoomsManager: StudyRoomsManager) {
    this.studyRoomsManager = studyRoomsManager;

    // Listen for changes
    this.studyRoomsManager.addRoomsListener(() => this.refreshCurrentTab());
    this.studyRoomsManager.addInvitationsListener(() => this.refreshCurrentTab());
  }

  /**
   * Initialize the browse rooms modal
   */
  public initialize(): void {
    this.createModal();
  }

  /**
   * Set current user ID
   */
  public setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
  }

  /**
   * Create the modal structure
   */
  private createModal(): void {
    const modalHTML = `
      <div id="browse-rooms-modal" class="modal" style="display: none;">
        <div class="modal-overlay" data-close-modal></div>
        <div class="modal-content browse-rooms-modal-content">
          <div class="modal-header">
            <h2>Study Rooms</h2>
            <button class="modal-close" data-close-modal aria-label="Close">×</button>
          </div>

          <!-- Tabs -->
          <div class="rooms-tabs">
            <button class="rooms-tab active" data-tab="my-rooms">
              <span>My Rooms</span>
              <span class="rooms-tab-badge" id="my-rooms-count-badge">0</span>
            </button>
            <button class="rooms-tab" data-tab="invitations">
              <span>Invitations</span>
              <span class="rooms-tab-badge" id="invitations-count-badge" style="display: none;">0</span>
            </button>
            <button class="rooms-tab" data-tab="active">
              <span>Active</span>
              <span class="rooms-tab-badge" id="active-rooms-count-badge">0</span>
            </button>
          </div>

          <div class="modal-body">
            <!-- My Rooms Tab -->
            <div class="rooms-tab-content" data-tab-content="my-rooms">
              <div class="tab-header">
                <p class="tab-description">Rooms you've created or joined</p>
                <button class="btn-primary btn-sm" id="create-room-btn">
                  + Create Room
                </button>
              </div>
              <div id="my-rooms-container" class="rooms-container">
                <div class="loading">Loading rooms...</div>
              </div>
            </div>

            <!-- Invitations Tab -->
            <div class="rooms-tab-content" data-tab-content="invitations" style="display: none;">
              <div class="tab-header">
                <p class="tab-description">Friends have invited you to join these rooms</p>
              </div>
              <div id="invitations-container" class="invitations-container">
                <p class="empty-state">No pending invitations</p>
              </div>
            </div>

            <!-- Active Rooms Tab -->
            <div class="rooms-tab-content" data-tab-content="active" style="display: none;">
              <div class="tab-header">
                <p class="tab-description">Currently active study rooms</p>
              </div>
              <div id="active-rooms-container" class="rooms-container">
                <p class="empty-state">No active rooms right now</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('browse-rooms-modal');

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.modal) return;

    // Close modal
    this.modal.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', () => this.close());
    });

    // Tab switching
    this.modal.querySelectorAll('.rooms-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tabName = target.dataset.tab as TabType;
        this.switchTab(tabName);
      });
    });

    // Create room button
    const createBtn = document.getElementById('create-room-btn');
    createBtn?.addEventListener('click', () => {
      this.close();
      // Trigger create room modal (will be wired up by app.ts)
      window.dispatchEvent(new CustomEvent('show-create-room-modal'));
    });
  }

  /**
   * Show the modal
   */
  public async show(onJoinRoom?: (roomId: string) => void): Promise<void> {
    if (!this.modal) return;

    this.onJoinRoom = onJoinRoom;
    this.modal.style.display = 'flex';

    // Refresh all data
    await this.studyRoomsManager.refresh();

    // Show default tab
    this.switchTab('my-rooms');
  }

  /**
   * Close the modal
   */
  public close(): void {
    if (!this.modal) return;
    this.modal.style.display = 'none';
  }

  /**
   * Switch tabs
   */
  private switchTab(tabName: TabType): void {
    if (!this.modal) return;

    this.currentTab = tabName;

    // Update tab buttons
    this.modal.querySelectorAll('.rooms-tab').forEach(tab => {
      if (tab.getAttribute('data-tab') === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update tab content visibility
    this.modal.querySelectorAll('.rooms-tab-content').forEach(content => {
      const contentTab = content.getAttribute('data-tab-content');
      if (contentTab === tabName) {
        (content as HTMLElement).style.display = 'block';
      } else {
        (content as HTMLElement).style.display = 'none';
      }
    });

    // Render current tab
    this.refreshCurrentTab();
  }

  /**
   * Refresh current tab content
   */
  private refreshCurrentTab(): void {
    switch (this.currentTab) {
      case 'my-rooms':
        this.renderMyRooms();
        break;
      case 'invitations':
        this.renderInvitations();
        break;
      case 'active':
        this.renderActiveRooms();
        break;
    }
  }

  /**
   * Render My Rooms tab
   */
  private renderMyRooms(): void {
    const container = document.getElementById('my-rooms-container');
    if (!container) return;

    const rooms = this.studyRoomsManager.getRooms();

    // Update badge
    const badge = document.getElementById('my-rooms-count-badge');
    if (badge) {
      badge.textContent = rooms.length.toString();
      badge.style.display = rooms.length > 0 ? 'inline-block' : 'none';
    }

    if (rooms.length === 0) {
      container.innerHTML = `
        <p class="empty-state">
          You haven't created or joined any rooms yet.<br>
          Click "Create Room" to get started!
        </p>
      `;
      return;
    }

    container.innerHTML = rooms.map(room => this.renderRoomCard(room)).join('');

    // Attach card action listeners
    this.attachRoomCardListeners();
  }

  /**
   * Render Invitations tab
   */
  private renderInvitations(): void {
    const container = document.getElementById('invitations-container');
    if (!container) return;

    const invitations = this.studyRoomsManager.getPendingInvitations();

    // Update badge
    const badge = document.getElementById('invitations-count-badge');
    if (badge) {
      badge.textContent = invitations.length.toString();
      badge.style.display = invitations.length > 0 ? 'inline-block' : 'none';
    }

    if (invitations.length === 0) {
      container.innerHTML = '<p class="empty-state">No pending invitations</p>';
      return;
    }

    container.innerHTML = invitations.map(inv => this.renderInvitationCard(inv)).join('');

    // Attach invitation action listeners
    this.attachInvitationListeners();
  }

  /**
   * Render Active Rooms tab
   */
  private renderActiveRooms(): void {
    const container = document.getElementById('active-rooms-container');
    if (!container) return;

    const rooms = this.studyRoomsManager.getActiveRooms();

    // Update badge
    const badge = document.getElementById('active-rooms-count-badge');
    if (badge) {
      badge.textContent = rooms.length.toString();
      badge.style.display = rooms.length > 0 ? 'inline-block' : 'none';
    }

    if (rooms.length === 0) {
      container.innerHTML = '<p class="empty-state">No active rooms right now</p>';
      return;
    }

    container.innerHTML = rooms.map(room => this.renderRoomCard(room, true)).join('');

    // Attach card action listeners
    this.attachRoomCardListeners();
  }

  /**
   * Render a room card
   */
  private renderRoomCard(room: StudyRoomData, showJoinButton: boolean = false): string {
    const isHost = this.currentUserId === room.hostId;
    const participantCount = room.participantCount || 0;
    const isFull = participantCount >= room.maxParticipants;
    const status = room.isActive ? (isFull ? 'Full' : 'Open') : 'Closed';
    const statusClass = room.isActive ? (isFull ? 'status-full' : 'status-open') : 'status-closed';

    return `
      <div class="room-card" data-room-id="${room.id}">
        <div class="room-card-header">
          <div class="room-info">
            <h3>${escapeHtml(room.name)}</h3>
            <p class="room-host">
              ${isHost ? 'You (Host)' : `Host: ${escapeHtml(room.hostFullName || room.hostEmail)}`}
            </p>
          </div>
          <div class="room-status">
            <span class="status-badge ${statusClass}">${status}</span>
          </div>
        </div>
        <div class="room-card-body">
          <div class="room-details">
            <span class="room-detail">
              <i class="icon-users"></i>
              ${participantCount}/${room.maxParticipants} participants
            </span>
            <span class="room-detail">
              <i class="icon-clock"></i>
              Created ${this.getTimeAgo(room.createdAt)}
            </span>
          </div>
        </div>
        <div class="room-card-actions">
          ${room.isActive ? `
            <button class="btn-primary btn-sm" data-action="enter" data-room-id="${room.id}">
              Enter Room
            </button>
            ${isHost ? `
              <button class="btn-secondary btn-sm" data-action="close" data-room-id="${room.id}">
                Close Room
              </button>
            ` : `
              <button class="btn-secondary btn-sm" data-action="leave" data-room-id="${room.id}">
                Leave Room
              </button>
            `}
          ` : `
            <span class="text-muted">Room closed</span>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Render an invitation card
   */
  private renderInvitationCard(invitation: RoomInvitationData): string {
    const inviterName = invitation.inviterFullName || invitation.inviterEmail;
    const roomName = invitation.roomName || 'Study Room';

    return `
      <div class="invitation-card" data-invitation-id="${invitation.id}">
        <div class="invitation-header">
          <div class="invitation-avatar">
            ${this.getInitials(inviterName)}
          </div>
          <div class="invitation-info">
            <h4>${escapeHtml(inviterName)}</h4>
            <p>invited you to join <strong>${escapeHtml(roomName)}</strong></p>
            <span class="invitation-time">${this.getTimeAgo(invitation.createdAt)}</span>
          </div>
        </div>
        <div class="invitation-actions">
          <button class="btn-primary btn-sm" data-action="accept" data-invitation-id="${invitation.id}">
            Accept
          </button>
          <button class="btn-secondary btn-sm" data-action="decline" data-invitation-id="${invitation.id}">
            Decline
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Attach room card action listeners
   */
  private attachRoomCardListeners(): void {
    // Enter room
    document.querySelectorAll('[data-action="enter"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const roomId = (e.target as HTMLElement).dataset.roomId;
        if (roomId && this.onJoinRoom) {
          this.close();
          this.onJoinRoom(roomId);
        }
      });
    });

    // Leave room
    document.querySelectorAll('[data-action="leave"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const roomId = (e.target as HTMLElement).dataset.roomId;
        if (roomId && confirm('Are you sure you want to leave this room?')) {
          try {
            await this.studyRoomsManager.leaveRoom(roomId);
          } catch (error) {
            alert('Failed to leave room. Please try again.');
          }
        }
      });
    });

    // Close room
    document.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const roomId = (e.target as HTMLElement).dataset.roomId;
        if (roomId && confirm('Are you sure you want to close this room? All participants will be removed.')) {
          try {
            await this.studyRoomsManager.closeRoom(roomId);
          } catch (error) {
            alert('Failed to close room. Please try again.');
          }
        }
      });
    });
  }

  /**
   * Attach invitation action listeners
   */
  private attachInvitationListeners(): void {
    // Accept invitation
    document.querySelectorAll('[data-action="accept"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const invitationId = (e.target as HTMLElement).dataset.invitationId;
        if (!invitationId) return;

        try {
          (e.target as HTMLButtonElement).disabled = true;
          (e.target as HTMLButtonElement).textContent = 'Accepting...';

          await this.studyRoomsManager.acceptInvitation(invitationId);

          // Show success message
          alert('Invitation accepted! You can now enter the room.');

          // Refresh rooms
          await this.studyRoomsManager.refresh();
          this.switchTab('my-rooms');
        } catch (error) {
          alert('Failed to accept invitation. Please try again.');
          (e.target as HTMLButtonElement).disabled = false;
          (e.target as HTMLButtonElement).textContent = 'Accept';
        }
      });
    });

    // Decline invitation
    document.querySelectorAll('[data-action="decline"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const invitationId = (e.target as HTMLElement).dataset.invitationId;
        if (!invitationId) return;

        try {
          (e.target as HTMLButtonElement).disabled = true;
          await this.studyRoomsManager.declineInvitation(invitationId);
        } catch (error) {
          alert('Failed to decline invitation. Please try again.');
          (e.target as HTMLButtonElement).disabled = false;
        }
      });
    });
  }

  /**
   * Get time ago string
   */
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    return 'Just now';
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
