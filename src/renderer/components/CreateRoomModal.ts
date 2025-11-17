/**
 * CreateRoomModal
 *
 * Modal component for creating a new study room.
 * Allows user to name the room, select a session to share, and set max participants.
 */

import type { StudyRoomsManager } from '../managers/social/StudyRoomsManager.js';
import { escapeHtml } from '../utils/formatting.js';

export class CreateRoomModal {
  private modal: HTMLElement | null = null;
  private studyRoomsManager: StudyRoomsManager;
  private sessions: any[] = [];
  private onSuccess?: (roomId: string) => void;

  constructor(studyRoomsManager: StudyRoomsManager) {
    this.studyRoomsManager = studyRoomsManager;
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

    // Load sessions
    await this.loadSessions();

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
