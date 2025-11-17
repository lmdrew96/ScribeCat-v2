/**
 * StudyRoomView
 *
 * Full-screen view for an active study room.
 * Shows participants, session content, chat (Phase 3), and room controls.
 */

import type { StudyRoomsManager } from '../managers/social/StudyRoomsManager.js';
import type { FriendsManager } from '../managers/social/FriendsManager.js';
import type { StudyRoomData } from '../../domain/entities/StudyRoom.js';
import type { RoomParticipantData } from '../../domain/entities/RoomParticipant.js';
import { escapeHtml } from '../utils/formatting.js';

export class StudyRoomView {
  private container: HTMLElement | null = null;
  private studyRoomsManager: StudyRoomsManager;
  private friendsManager: FriendsManager;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private onExit?: () => void;

  constructor(studyRoomsManager: StudyRoomsManager, friendsManager: FriendsManager) {
    this.studyRoomsManager = studyRoomsManager;
    this.friendsManager = friendsManager;

    // Listen for participant changes
    this.studyRoomsManager.addParticipantsListener((roomId) => {
      if (roomId === this.currentRoomId) {
        this.renderParticipants();
      }
    });

    // Listen for room changes
    this.studyRoomsManager.addRoomsListener(() => {
      if (this.currentRoomId) {
        this.renderHeader();
      }
    });
  }

  /**
   * Initialize the study room view
   */
  public initialize(): void {
    this.createView();
  }

  /**
   * Set current user ID
   */
  public setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
  }

  /**
   * Create the view structure
   */
  private createView(): void {
    const viewHTML = `
      <div id="study-room-view" class="study-room-view" style="display: none;">
        <!-- Header -->
        <div class="study-room-header">
          <button class="btn-icon back-btn" id="exit-room-btn" title="Exit Room">
            ←
          </button>
          <div class="room-title-info">
            <h2 id="room-title">Study Room</h2>
            <p id="room-subtitle">Loading...</p>
          </div>
          <div class="room-actions">
            <button class="btn-secondary btn-sm" id="invite-friends-btn">
              Invite Friends
            </button>
            <button class="btn-secondary btn-sm" id="room-settings-btn">
              Settings
            </button>
          </div>
        </div>

        <!-- Main Content -->
        <div class="study-room-main">
          <!-- Sidebar (Participants) -->
          <div class="study-room-sidebar">
            <div class="sidebar-header">
              <h3>Participants</h3>
              <span id="participants-count" class="count-badge">0</span>
            </div>
            <div id="participants-list" class="participants-list">
              <div class="loading">Loading participants...</div>
            </div>
          </div>

          <!-- Session Content -->
          <div class="study-room-content">
            <div class="content-header">
              <h3>Shared Session</h3>
              <div class="content-tabs">
                <button class="content-tab active" data-tab="notes">Notes</button>
                <button class="content-tab" data-tab="transcript">Transcript</button>
              </div>
            </div>

            <div class="content-body">
              <!-- Notes Tab -->
              <div class="content-tab-panel active" data-panel="notes">
                <div id="session-notes" class="session-content">
                  <p class="empty-state">Loading session notes...</p>
                </div>
              </div>

              <!-- Transcript Tab -->
              <div class="content-tab-panel" data-panel="transcript" style="display: none;">
                <div id="session-transcript" class="session-content">
                  <p class="empty-state">Loading transcript...</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Chat Panel (Phase 3 - Placeholder) -->
          <div class="study-room-chat">
            <div class="chat-header">
              <h3>Chat</h3>
              <span class="badge-coming-soon">Phase 3</span>
            </div>
            <div class="chat-body">
              <p class="empty-state">
                Real-time chat coming in Phase 3!<br>
                For now, use your session notes to collaborate.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', viewHTML);
    this.container = document.getElementById('study-room-view');

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.container) return;

    // Exit room button - multiple approaches for maximum reliability
    const exitBtn = document.getElementById('exit-room-btn');
    console.log('Exit button found?', !!exitBtn, exitBtn);

    if (exitBtn) {
      // Approach 1: Direct click listener
      exitBtn.addEventListener('click', (e) => {
        console.log('EXIT BUTTON CLICKED (direct)!', e);
        e.stopPropagation();
        this.exitRoom();
      });

      // Approach 2: Click with capture
      exitBtn.addEventListener('click', (e) => {
        console.log('EXIT BUTTON CLICKED (capture)!', e);
        this.exitRoom();
      }, { capture: true });

      // Approach 3: Mousedown for debugging with capture
      exitBtn.addEventListener('mousedown', (e) => {
        console.log('EXIT BUTTON MOUSEDOWN! Button:', e.button);
        console.log('LEFT CLICK DETECTED ON BUTTON!', e);
        if (e.button === 0) {
          console.log('⚠️ LEFT CLICK ON EXIT BUTTON - calling exitRoom()');
          this.exitRoom();
        }
      }, { capture: true });

      console.log('Exit button listeners attached (3 methods)');
    } else {
      console.error('Exit button not found!');
    }

    // Approach 4: Event delegation from header
    const header = document.querySelector('.study-room-header');
    if (header) {
      header.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        console.log('Header clicked, target:', target.id, target.className);
        if (target.id === 'exit-room-btn' || target.closest('#exit-room-btn')) {
          console.log('EXIT via delegation!');
          this.exitRoom();
        }
      });
      console.log('Header delegation listener attached');
    }

    // DEBUG: Window-level mousedown to catch ALL clicks first
    const windowMousedownHandler = (e: MouseEvent) => {
      console.log('🌍 WINDOW MOUSEDOWN - Button:', e.button, 'Target:', (e.target as HTMLElement)?.id || (e.target as HTMLElement)?.className);
      if (e.button === 0) {
        const exitBtn = document.getElementById('exit-room-btn');
        if (exitBtn && exitBtn.contains(e.target as Node)) {
          console.log('🌍 LEFT CLICK ON EXIT BUTTON DETECTED AT WINDOW LEVEL!');
        }
      }
    };
    window.addEventListener('mousedown', windowMousedownHandler, true);
    console.log('🌍 Window-level mousedown listener attached');

    // DEBUG: Global click listener to see what's covering the button
    const debugClickHandler = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      const elementAtPoint = document.elementFromPoint(x, y);
      console.log('🔍 CLICK DEBUG - Position:', { x, y });
      console.log('🔍 Element at click point:', elementAtPoint);
      console.log('🔍 Element tag:', elementAtPoint?.tagName);
      console.log('🔍 Element id:', (elementAtPoint as HTMLElement)?.id);
      console.log('🔍 Element class:', (elementAtPoint as HTMLElement)?.className);
      console.log('🔍 Element z-index:', window.getComputedStyle(elementAtPoint as Element).zIndex);
    };
    document.addEventListener('click', debugClickHandler, true);
    console.log('🔍 Global debug click listener attached');

    // Invite friends button
    const inviteBtn = document.getElementById('invite-friends-btn');
    inviteBtn?.addEventListener('click', () => this.showInviteFriends());

    // Room settings button
    const settingsBtn = document.getElementById('room-settings-btn');
    settingsBtn?.addEventListener('click', () => this.showRoomSettings());

    // Content tabs
    this.container.querySelectorAll('.content-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tabName = target.dataset.tab;
        this.switchContentTab(tabName || 'notes');
      });
    });
  }

  /**
   * Show the study room view
   */
  public async show(roomId: string, onExit?: () => void): Promise<void> {
    console.log('StudyRoomView.show() called with roomId:', roomId);
    console.log('Container exists?', !!this.container);

    if (!this.container) {
      console.error('StudyRoomView: No container, returning early');
      return;
    }

    this.currentRoomId = roomId;
    this.onExit = onExit;

    // Check if user is in room
    console.log('Checking if user is in room...');
    const isInRoom = await this.studyRoomsManager.isUserInRoom(roomId);
    console.log('Is user in room?', isInRoom);

    if (!isInRoom) {
      // User is not in room, join first
      console.log('User not in room, attempting to join...');
      try {
        await this.studyRoomsManager.joinRoom(roomId);
        console.log('Successfully joined room');
      } catch (error) {
        console.error('Failed to join room:', error);
        alert('Failed to join room. Please try again.');
        if (this.onExit) this.onExit();
        return;
      }
    }

    // Show view
    console.log('Setting container display to flex');
    console.log('Container before:', this.container.style.display);
    this.container.style.display = 'flex';
    console.log('Container after:', this.container.style.display);
    console.log('Container element:', this.container);

    // Load room data
    console.log('Loading room data...');
    await this.loadRoomData();
    console.log('StudyRoomView.show() complete');
  }

  /**
   * Hide the study room view
   */
  public hide(): void {
    if (!this.container) return;
    this.container.style.display = 'none';
    this.currentRoomId = null;
  }

  /**
   * Load room data
   */
  private async loadRoomData(): Promise<void> {
    if (!this.currentRoomId) return;

    try {
      // Render header and participants
      this.renderHeader();
      this.renderParticipants();

      // Load session content
      await this.loadSessionContent();
    } catch (error) {
      console.error('Failed to load room data:', error);
    }
  }

  /**
   * Render room header
   */
  private renderHeader(): void {
    if (!this.currentRoomId) return;

    const room = this.studyRoomsManager.getRoomById(this.currentRoomId);
    if (!room) return;

    const titleEl = document.getElementById('room-title');
    const subtitleEl = document.getElementById('room-subtitle');

    if (titleEl) {
      titleEl.textContent = room.name;
    }

    if (subtitleEl) {
      const isHost = this.currentUserId === room.hostId;
      const hostText = isHost ? 'You (Host)' : `Host: ${room.hostFullName || room.hostEmail}`;
      const status = room.isActive ? 'Active' : 'Closed';
      subtitleEl.textContent = `${hostText} • ${status}`;
    }
  }

  /**
   * Render participants list
   */
  private renderParticipants(): void {
    if (!this.currentRoomId) return;

    const container = document.getElementById('participants-list');
    const countBadge = document.getElementById('participants-count');
    if (!container) return;

    const participants = this.studyRoomsManager.getActiveParticipants(this.currentRoomId);

    // Update count
    if (countBadge) {
      countBadge.textContent = participants.length.toString();
    }

    if (participants.length === 0) {
      container.innerHTML = '<p class="empty-state">No participants</p>';
      return;
    }

    container.innerHTML = participants.map(p => this.renderParticipantItem(p)).join('');

    // Attach kick listeners if user is host
    this.attachParticipantActions();
  }

  /**
   * Render a participant item
   */
  private renderParticipantItem(participant: RoomParticipantData): string {
    const isCurrentUser = this.currentUserId === participant.userId;
    const displayName = participant.userFullName || participant.userEmail;
    const initials = this.getInitials(displayName);
    const isHost = this.isParticipantHost(participant.userId);

    return `
      <div class="participant-item ${isCurrentUser ? 'current-user' : ''}" data-user-id="${participant.userId}">
        <div class="participant-avatar">${initials}</div>
        <div class="participant-info">
          <p class="participant-name">
            ${escapeHtml(displayName)}
            ${isHost ? '<span class="badge-host">Host</span>' : ''}
            ${isCurrentUser ? '<span class="badge-you">You</span>' : ''}
          </p>
          <p class="participant-status">
            <span class="status-indicator active"></span>
            Active • ${this.getTimeInRoom(participant.joinedAt)}
          </p>
        </div>
        ${this.canKickParticipant(participant.userId) ? `
          <button
            class="btn-icon btn-kick"
            data-action="kick"
            data-user-id="${participant.userId}"
            title="Remove from room"
          >
            ×
          </button>
        ` : ''}
      </div>
    `;
  }

  /**
   * Check if participant is host
   */
  private isParticipantHost(userId: string): boolean {
    if (!this.currentRoomId) return false;
    const room = this.studyRoomsManager.getRoomById(this.currentRoomId);
    return room?.hostId === userId;
  }

  /**
   * Check if current user can kick a participant
   */
  private canKickParticipant(userId: string): boolean {
    if (!this.currentRoomId || !this.currentUserId) return false;
    if (userId === this.currentUserId) return false; // Can't kick self

    const room = this.studyRoomsManager.getRoomById(this.currentRoomId);
    return room?.hostId === this.currentUserId; // Only host can kick
  }

  /**
   * Attach participant action listeners
   */
  private attachParticipantActions(): void {
    document.querySelectorAll('[data-action="kick"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = (e.target as HTMLElement).dataset.userId;
        if (!userId || !this.currentRoomId) return;

        const participant = this.studyRoomsManager
          .getRoomParticipants(this.currentRoomId)
          .find(p => p.userId === userId);

        if (!participant) return;

        const displayName = participant.userFullName || participant.userEmail;
        if (confirm(`Remove ${displayName} from the room?`)) {
          try {
            await this.studyRoomsManager.removeParticipant(this.currentRoomId, userId);
          } catch (error) {
            alert('Failed to remove participant. Please try again.');
          }
        }
      });
    });
  }

  /**
   * Load session content
   */
  private async loadSessionContent(): Promise<void> {
    if (!this.currentRoomId) return;

    try {
      const room = this.studyRoomsManager.getRoomById(this.currentRoomId);
      if (!room) return;

      const notesContainer = document.getElementById('session-notes');
      const transcriptContainer = document.getElementById('session-transcript');

      // Check if room has a session
      if (!room.sessionId) {
        // No session attached - show empty state
        if (notesContainer) {
          notesContainer.innerHTML = '<p class="empty-state">No session attached to this room.<br>Use the chat to collaborate!</p>';
        }
        if (transcriptContainer) {
          transcriptContainer.innerHTML = '<p class="empty-state">No session attached</p>';
        }
        return;
      }

      // Load session data (TODO: Replace with Supabase session in Phase 3)
      // For now, this won't work because local sessions aren't in Supabase
      // This will be implemented when we add session copying
      if (notesContainer) {
        notesContainer.innerHTML = '<p class="empty-state">Session content will be available in Phase 3<br>Use the chat to collaborate!</p>';
      }
      if (transcriptContainer) {
        transcriptContainer.innerHTML = '<p class="empty-state">Session content coming in Phase 3</p>';
      }
    } catch (error) {
      console.error('Failed to load session content:', error);
    }
  }

  /**
   * Switch content tabs
   */
  private switchContentTab(tabName: string): void {
    if (!this.container) return;

    // Update tab buttons
    this.container.querySelectorAll('.content-tab').forEach(tab => {
      if (tab.getAttribute('data-tab') === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update tab panels
    this.container.querySelectorAll('.content-tab-panel').forEach(panel => {
      const panelTab = panel.getAttribute('data-panel');
      if (panelTab === tabName) {
        (panel as HTMLElement).style.display = 'block';
        panel.classList.add('active');
      } else {
        (panel as HTMLElement).style.display = 'none';
        panel.classList.remove('active');
      }
    });
  }

  /**
   * Show invite friends dialog
   */
  private async showInviteFriends(): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId) return;

    const room = this.studyRoomsManager.getRoomById(this.currentRoomId);
    if (!room) return;

    // Only host can invite
    if (room.hostId !== this.currentUserId) {
      alert('Only the host can invite friends to the room.');
      return;
    }

    // Get friends list
    const friends = this.friendsManager.getFriends();

    if (friends.length === 0) {
      alert('You don\'t have any friends to invite yet. Add some friends first!');
      return;
    }

    // Simple prompt for now (TODO: Build proper InviteFriendsModal in Phase 3)
    const friendsList = friends.map((f, i) => `${i + 1}. ${f.friendFullName || f.friendEmail}`).join('\n');
    const selection = prompt(`Select a friend to invite (enter number):\n\n${friendsList}`);

    if (selection) {
      const index = parseInt(selection, 10) - 1;
      if (index >= 0 && index < friends.length) {
        try {
          await this.studyRoomsManager.sendInvitation(this.currentRoomId, friends[index].friendId);
          alert('Invitation sent!');
        } catch (error) {
          alert('Failed to send invitation. Please try again.');
        }
      }
    }
  }

  /**
   * Show room settings dialog
   */
  private async showRoomSettings(): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId) return;

    const room = this.studyRoomsManager.getRoomById(this.currentRoomId);
    if (!room) return;

    // Only host can edit settings
    if (room.hostId !== this.currentUserId) {
      alert('Only the host can change room settings.');
      return;
    }

    // Simple prompt for now (TODO: Build proper RoomSettingsModal in Phase 3)
    const newName = prompt('Enter new room name:', room.name);
    if (newName && newName !== room.name) {
      try {
        await this.studyRoomsManager.updateRoom({
          roomId: this.currentRoomId,
          name: newName,
        });
        this.renderHeader();
      } catch (error) {
        alert('Failed to update room settings. Please try again.');
      }
    }
  }

  /**
   * Exit room
   */
  private async exitRoom(): Promise<void> {
    console.log('exitRoom() called');
    console.log('  currentRoomId:', this.currentRoomId);
    console.log('  currentUserId:', this.currentUserId);

    if (!this.currentRoomId || !this.currentUserId) {
      console.error('Cannot exit - missing roomId or userId');
      return;
    }

    const room = this.studyRoomsManager.getRoomById(this.currentRoomId);
    console.log('  room:', room);
    if (!room) {
      console.error('Cannot exit - room not found');
      return;
    }

    const isHost = room.hostId === this.currentUserId;
    console.log('  isHost:', isHost);

    if (isHost) {
      const confirmClose = confirm(
        'You are the host. Do you want to close the room for everyone, or just leave?'
      );

      if (confirmClose === null) return; // Cancelled

      if (confirmClose) {
        // Close room
        try {
          await this.studyRoomsManager.closeRoom(this.currentRoomId);
        } catch (error) {
          alert('Failed to close room. Please try again.');
          return;
        }
      } else {
        // Just leave
        try {
          await this.studyRoomsManager.leaveRoom(this.currentRoomId);
        } catch (error) {
          alert('Failed to leave room. Please try again.');
          return;
        }
      }
    } else {
      // Leave room
      try {
        await this.studyRoomsManager.leaveRoom(this.currentRoomId);
      } catch (error) {
        alert('Failed to leave room. Please try again.');
        return;
      }
    }

    // Hide view
    this.hide();

    // Call exit callback
    if (this.onExit) {
      this.onExit();
    }
  }

  /**
   * Get time in room
   */
  private getTimeInRoom(joinedAt: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(joinedAt).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffHours > 0) {
      const remainingMins = diffMins % 60;
      return `${diffHours}h ${remainingMins}m`;
    }
    return `${diffMins}m`;
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
