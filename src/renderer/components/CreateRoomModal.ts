/**
 * CreateRoomModal
 *
 * Modal component for creating a new study room.
 * Allows user to name the room, select a session to share, and set max participants.
 */

import type { StudyRoomsManager } from '../managers/social/StudyRoomsManager.js';
import type { FriendsManager } from '../managers/social/FriendsManager.js';
import type { FriendData } from '../../domain/entities/Friend.js';
import { escapeHtml } from '../utils/formatting.js';
import { getIconHTML } from '../utils/iconMap.js';

export class CreateRoomModal {
  private modal: HTMLElement | null = null;
  private studyRoomsManager: StudyRoomsManager;
  private friendsManager: FriendsManager;
  private sessions: any[] = [];
  private friends: FriendData[] = [];
  private selectedFriendIds: Set<string> = new Set();
  private onSuccess?: (roomId: string) => void;

  constructor(studyRoomsManager: StudyRoomsManager, friendsManager: FriendsManager) {
    this.studyRoomsManager = studyRoomsManager;
    this.friendsManager = friendsManager;
  }

  /**
   * Initialize the create room modal
   */
  public initialize(): void {
    this.createModal();
  }

  /**
   * Create the modal structure
   */
  private createModal(): void {
    const modalHTML = `
      <div id="create-room-modal" class="modal" style="display: none;">
        <div class="modal-overlay" data-close-modal></div>
        <div class="modal-content create-room-modal-content">
          <div class="modal-header">
            <h2>Create Study Room</h2>
            <button class="modal-close" data-close-modal aria-label="Close">×</button>
          </div>

          <div class="modal-body">
            <form id="create-room-form">
              <div class="form-group">
                <label for="room-name">Room Name *</label>
                <input
                  type="text"
                  id="room-name"
                  placeholder="e.g., Chemistry Study Session"
                  maxlength="100"
                  required
                />
                <small>Give your study room a descriptive name</small>
              </div>

              <div class="form-group">
                <label for="room-session">Session to Share (Optional)</label>
                <select id="room-session">
                  <option value="">No session (just chat and collaborate)</option>
                </select>
                <small>Optional: Share a session for friends to study together</small>
              </div>

              <div class="form-group invite-friends-section">
                <div class="invite-friends-header">
                  <label>Invite Friends (Optional)</label>
                  <button type="button" id="toggle-invite-section" class="toggle-btn">
                    <span id="toggle-icon">${getIconHTML('chevronRight', { size: 14 })}</span>
                  </button>
                </div>
                <small>Select friends to invite to this room</small>

                <div id="invite-friends-content" class="invite-friends-content" style="display: none;">
                  <div class="invite-friends-actions">
                    <button type="button" id="select-all-friends" class="btn-link">Select All</button>
                    <span class="divider">|</span>
                    <button type="button" id="clear-all-friends" class="btn-link">Clear</button>
                    <span id="selected-count" class="selected-count">0 selected</span>
                  </div>

                  <div id="friends-list" class="friends-checkbox-list">
                    <div class="loading">Loading friends...</div>
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label for="room-max-participants">
                  Max Participants: <span id="max-participants-value">4</span>
                </label>
                <input
                  type="range"
                  id="room-max-participants"
                  min="2"
                  max="8"
                  value="4"
                  step="1"
                />
                <small>How many people can join (including you)</small>
              </div>

              <div id="create-room-message" class="message" style="display: none;"></div>

              <div class="modal-actions">
                <button type="button" class="btn-secondary" data-close-modal>
                  Cancel
                </button>
                <button type="submit" class="btn-primary" id="create-room-btn">
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('create-room-modal');

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

    // Slider value display
    const slider = document.getElementById('room-max-participants') as HTMLInputElement;
    const valueDisplay = document.getElementById('max-participants-value');
    slider?.addEventListener('input', () => {
      if (valueDisplay) {
        valueDisplay.textContent = slider.value;
      }
    });

    // Toggle invite friends section
    const toggleBtn = document.getElementById('toggle-invite-section');
    toggleBtn?.addEventListener('click', () => this.toggleInviteSection());

    // Select all friends
    const selectAllBtn = document.getElementById('select-all-friends');
    selectAllBtn?.addEventListener('click', () => this.selectAllFriends());

    // Clear all friends
    const clearAllBtn = document.getElementById('clear-all-friends');
    clearAllBtn?.addEventListener('click', () => this.clearAllFriends());

    // Form submission
    const form = document.getElementById('create-room-form') as HTMLFormElement;
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleCreateRoom();
    });
  }

  /**
   * Show the modal
   */
  public async show(onSuccess?: (roomId: string) => void): Promise<void> {
    if (!this.modal) return;

    this.onSuccess = onSuccess;
    this.modal.style.display = 'flex';

    // Load sessions and friends
    await this.loadSessions();
    this.loadFriends();

    // Reset form
    const form = document.getElementById('create-room-form') as HTMLFormElement;
    form?.reset();

    // Reset create button
    const createBtn = document.getElementById('create-room-btn') as HTMLButtonElement;
    if (createBtn) {
      createBtn.disabled = false;
      createBtn.textContent = 'Create Room';
    }

    // Reset slider value display
    const valueDisplay = document.getElementById('max-participants-value');
    if (valueDisplay) {
      valueDisplay.textContent = '4';
    }

    // Reset friend selection
    this.selectedFriendIds.clear();
    this.updateSelectedCount();

    // Uncheck all friend checkboxes
    document.querySelectorAll('#friends-list input[type="checkbox"]').forEach(checkbox => {
      (checkbox as HTMLInputElement).checked = false;
    });

    // Collapse invite section
    const inviteContent = document.getElementById('invite-friends-content');
    const toggleIcon = document.getElementById('toggle-icon');
    if (inviteContent) inviteContent.style.display = 'none';
    if (toggleIcon) toggleIcon.innerHTML = getIconHTML('chevronRight', { size: 14 });

    // Hide message
    this.hideMessage();

    // Focus on room name input
    const nameInput = document.getElementById('room-name') as HTMLInputElement;
    setTimeout(() => nameInput?.focus(), 100);
  }

  /**
   * Close the modal
   */
  public close(): void {
    if (!this.modal) return;
    this.modal.style.display = 'none';
    this.hideMessage();
  }

  /**
   * Load user's sessions
   */
  private async loadSessions(): Promise<void> {
    try {
      const sessionSelect = document.getElementById('room-session') as HTMLSelectElement;
      if (!sessionSelect) return;

      // Show loading
      sessionSelect.innerHTML = '<option value="">Loading sessions...</option>';

      // Fetch sessions
      const result = await window.scribeCat.session.list();
      this.sessions = result?.sessions || [];

      // Populate dropdown with "No session" option + available sessions
      const noSessionOption = '<option value="">No session (just chat and collaborate)</option>';

      if (this.sessions.length === 0) {
        sessionSelect.innerHTML = noSessionOption;
        return;
      }

      const sessionOptions = this.sessions.map(session => {
        const title = escapeHtml(session.title || 'Untitled Session');
        const courseCode = session.course_code ? escapeHtml(session.course_code) : '';
        const date = new Date(session.recorded_at).toLocaleDateString();

        return `<option value="${session.id}">${courseCode ? `[${courseCode}] ` : ''}${title} (${date})</option>`;
      }).join('');

      sessionSelect.innerHTML = noSessionOption + sessionOptions;
    } catch (error) {
      console.error('Failed to load sessions:', error);
      this.showMessage('Failed to load sessions. Please try again.', 'error');
    }
  }

  /**
   * Load friends list
   */
  private loadFriends(): void {
    this.friends = this.friendsManager.getFriends();
    this.renderFriendsList();
  }

  /**
   * Render friends list with checkboxes
   */
  private renderFriendsList(): void {
    const container = document.getElementById('friends-list');
    if (!container) return;

    if (this.friends.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>You don't have any friends to invite yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.friends
      .map(friend => this.renderFriendCheckbox(friend))
      .join('');

    // Attach checkbox listeners
    this.attachFriendCheckboxListeners();
  }

  /**
   * Render a single friend checkbox item
   */
  private renderFriendCheckbox(friend: FriendData): string {
    const displayName = friend.friendFullName || friend.friendEmail;
    const username = friend.friendUsername ? `@${friend.friendUsername}` : '';
    const initials = this.getInitials(displayName);
    const isOnline = friend.isOnline ?? false;
    const statusClass = isOnline ? 'online' : 'offline';
    const isChecked = this.selectedFriendIds.has(friend.friendId);

    return `
      <div class="friend-checkbox-item">
        <input
          type="checkbox"
          id="friend-${friend.friendId}"
          data-friend-id="${friend.friendId}"
          ${isChecked ? 'checked' : ''}
        />
        <label for="friend-${friend.friendId}">
          <div class="friend-avatar-container">
            <div class="friend-avatar">${initials}</div>
            <span class="status-indicator ${statusClass}"></span>
          </div>
          <div class="friend-info">
            <p class="friend-name">${escapeHtml(displayName)}</p>
            <p class="friend-username">${escapeHtml(username || friend.friendEmail)}</p>
          </div>
        </label>
      </div>
    `;
  }

  /**
   * Get initials from name
   */
  private getInitials(name: string): string {
    if (!name || name.trim().length === 0) return '??';
    const trimmed = name.trim();
    const parts = trimmed.split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return trimmed.substring(0, Math.min(2, trimmed.length)).toUpperCase();
  }

  /**
   * Attach checkbox listeners
   */
  private attachFriendCheckboxListeners(): void {
    document.querySelectorAll('#friends-list input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const friendId = target.dataset.friendId;
        if (!friendId) return;

        if (target.checked) {
          this.selectedFriendIds.add(friendId);
        } else {
          this.selectedFriendIds.delete(friendId);
        }

        this.updateSelectedCount();
      });
    });
  }

  /**
   * Toggle invite friends section
   */
  private toggleInviteSection(): void {
    const content = document.getElementById('invite-friends-content');
    const icon = document.getElementById('toggle-icon');

    if (!content || !icon) return;

    const isVisible = content.style.display !== 'none';
    content.style.display = isVisible ? 'none' : 'block';
    icon.innerHTML = isVisible
      ? getIconHTML('chevronRight', { size: 14 })
      : getIconHTML('chevronDown', { size: 14 });
  }

  /**
   * Select all friends
   */
  private selectAllFriends(): void {
    this.friends.forEach(friend => {
      this.selectedFriendIds.add(friend.friendId);
    });

    // Update all checkboxes
    document.querySelectorAll('#friends-list input[type="checkbox"]').forEach(checkbox => {
      (checkbox as HTMLInputElement).checked = true;
    });

    this.updateSelectedCount();
  }

  /**
   * Clear all friend selections
   */
  private clearAllFriends(): void {
    this.selectedFriendIds.clear();

    // Update all checkboxes
    document.querySelectorAll('#friends-list input[type="checkbox"]').forEach(checkbox => {
      (checkbox as HTMLInputElement).checked = false;
    });

    this.updateSelectedCount();
  }

  /**
   * Update selected count display
   */
  private updateSelectedCount(): void {
    const countEl = document.getElementById('selected-count');
    if (!countEl) return;

    const count = this.selectedFriendIds.size;
    countEl.textContent = `${count} selected`;
  }

  /**
   * Send invitations to selected friends
   */
  private async sendInvitations(roomId: string): Promise<void> {
    const friendIds = Array.from(this.selectedFriendIds);
    const results = { succeeded: 0, failed: 0 };

    console.log(`Sending invitations to ${friendIds.length} friends for room ${roomId}`);

    // Send invitations sequentially (could be parallel with Promise.all but sequential is safer)
    for (const friendId of friendIds) {
      try {
        console.log(`Sending invitation to friend: ${friendId}`);
        await this.studyRoomsManager.sendInvitation(roomId, friendId);
        results.succeeded++;
        console.log(`Successfully sent invitation to friend: ${friendId}`);
      } catch (error) {
        console.error(`Failed to invite friend ${friendId}:`, error);
        results.failed++;
      }
    }

    console.log(`Invitation results: ${results.succeeded} succeeded, ${results.failed} failed`);

    // Show feedback if there were any failures
    if (results.failed > 0 && results.succeeded === 0) {
      // All failed
      this.showMessage(
        `Room created but failed to send invitations (${results.failed} failed)`,
        'error'
      );
    } else if (results.failed > 0) {
      // Some failed
      this.showMessage(
        `Room created! Invited ${results.succeeded} friend${results.succeeded !== 1 ? 's' : ''}, ${results.failed} failed`,
        'success'
      );
    } else if (results.succeeded > 0) {
      // All succeeded - show success message
      this.showMessage(
        `Room created! Invited ${results.succeeded} friend${results.succeeded !== 1 ? 's' : ''}`,
        'success'
      );
    }
  }

  /**
   * Handle room creation
   */
  private async handleCreateRoom(): Promise<void> {
    const nameInput = document.getElementById('room-name') as HTMLInputElement;
    const sessionSelect = document.getElementById('room-session') as HTMLSelectElement;
    const participantsSlider = document.getElementById('room-max-participants') as HTMLInputElement;
    const createBtn = document.getElementById('create-room-btn') as HTMLButtonElement;

    if (!nameInput || !sessionSelect || !participantsSlider || !createBtn) return;

    // Validate
    const roomName = nameInput.value.trim();
    const sessionId = sessionSelect.value;
    const maxParticipants = parseInt(participantsSlider.value, 10);

    if (!roomName) {
      this.showMessage('Please enter a room name', 'error');
      nameInput.focus();
      return;
    }

    // Session is now optional - can create room without a session

    // Disable button
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';

    try {
      // Create room with optional session
      // TODO: In Phase 3, implement session copying to Supabase
      // For now, session_id is nullable - rooms can be created without sessions

      const room = await this.studyRoomsManager.createRoom({
        name: roomName,
        sessionId: sessionId || null, // null if no session selected
        maxParticipants: maxParticipants,
      });

      // Send invitations if any friends were selected
      if (this.selectedFriendIds.size > 0) {
        createBtn.textContent = 'Inviting friends...';
        await this.sendInvitations(room.id);
      }

      this.showMessage('Room created successfully!', 'success');

      // Call success callback if provided
      if (this.onSuccess) {
        setTimeout(() => {
          this.onSuccess?.(room.id);
          this.close();
        }, 1000);
      } else {
        setTimeout(() => this.close(), 1500);
      }
    } catch (error) {
      console.error('Failed to create room:', error);
      this.showMessage(
        error instanceof Error ? error.message : 'Failed to create room. Please try again.',
        'error'
      );
      createBtn.disabled = false;
      createBtn.textContent = 'Create Room';
    }
  }

  /**
   * Show message to user
   */
  private showMessage(text: string, type: 'success' | 'error'): void {
    const messageEl = document.getElementById('create-room-message');
    if (!messageEl) return;

    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
  }

  /**
   * Hide message
   */
  private hideMessage(): void {
    const messageEl = document.getElementById('create-room-message');
    if (!messageEl) return;

    messageEl.style.display = 'none';
  }
}
