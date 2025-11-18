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
import { ChatManager } from '../managers/social/ChatManager.js';
import { ChatPanel } from './ChatPanel.js';
import { InviteFriendsModal } from './InviteFriendsModal.js';
import { escapeHtml, formatTimestamp } from '../utils/formatting.js';
import { SupabaseClient } from '../../infrastructure/services/supabase/SupabaseClient.js';
import { Editor } from '@tiptap/core';
import { CollaborationAdapter } from '../tiptap/CollaborationAdapter.js';
import { EditorConfigService } from '../tiptap/EditorConfigService.js';

export class StudyRoomView {
  private container: HTMLElement | null = null;
  private studyRoomsManager: StudyRoomsManager;
  private friendsManager: FriendsManager;
  private chatManager: ChatManager;
  private chatPanel: ChatPanel | null = null;
  private inviteFriendsModal: InviteFriendsModal;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private currentUserEmail: string | null = null;
  private currentUserName: string | null = null;
  private onExit?: () => void;

  // Collaborative editor
  private notesEditor: Editor | null = null;
  private collaborationAdapter: CollaborationAdapter;

  constructor(studyRoomsManager: StudyRoomsManager, friendsManager: FriendsManager) {
    this.studyRoomsManager = studyRoomsManager;
    this.friendsManager = friendsManager;
    this.chatManager = new ChatManager();
    this.inviteFriendsModal = new InviteFriendsModal(friendsManager, studyRoomsManager);
    this.collaborationAdapter = new CollaborationAdapter();

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
   * Set current user info for collaboration
   */
  public setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
    if (userId) {
      this.chatManager.initialize(userId);
    }
  }

  /**
   * Set current user info (needed for collaboration)
   */
  public setCurrentUserInfo(userId: string, email: string, name: string): void {
    this.currentUserId = userId;
    this.currentUserEmail = email;
    this.currentUserName = name;
    this.chatManager.initialize(userId);
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
            </div>

            <!-- Content Tabs (same structure as individual session view) -->
            <div class="session-content-tabs">
              <button class="content-tab active" data-tab="notes">✍️ Notes</button>
              <button class="content-tab" data-tab="transcription">📝 Transcription</button>
            </div>

            <!-- Notes Panel -->
            <div class="session-content-panel active" data-panel="notes">
              <div class="content-panel-inner" id="session-notes">
                <p class="empty-state">Loading session notes...</p>
              </div>
            </div>

            <!-- Transcription Panel -->
            <div class="session-content-panel" data-panel="transcription">
              <div class="content-panel-inner" id="session-transcript">
                <p class="empty-state">Loading transcript...</p>
              </div>
            </div>
          </div>

          <!-- Chat Panel (Phase 3 - Placeholder) -->
          <div class="study-room-chat" id="study-room-chat-container">
            <!-- Chat panel will be initialized here -->
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

    // Cleanup chat panel
    if (this.chatPanel) {
      this.chatPanel.destroy();
      this.chatPanel = null;
    }

    // Cleanup editor and collaboration
    if (this.notesEditor) {
      this.notesEditor.destroy();
      this.notesEditor = null;
    }

    this.collaborationAdapter.disable();

    this.container.style.display = 'none';
    this.currentRoomId = null;
  }

  /**
   * Load room data
   */
  private async loadRoomData(): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId) return;

    try {
      // Render header and participants
      this.renderHeader();
      this.renderParticipants();

      // Load session content
      await this.loadSessionContent();

      // Initialize chat panel
      await this.initializeChatPanel();
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
   * Initialize chat panel
   */
  private async initializeChatPanel(): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId) return;

    const chatContainer = document.getElementById('study-room-chat-container');
    if (!chatContainer) {
      console.error('Chat container not found');
      return;
    }

    try {
      // Get participants for chat
      const participants = this.studyRoomsManager.getRoomParticipants(this.currentRoomId);
      const participantsWithNames = await Promise.all(
        participants.map(async (p) => ({
          userId: p.userId,
          userName: await this.getUserName(p.userId),
        }))
      );

      // Initialize chat panel
      this.chatPanel = new ChatPanel(this.chatManager);
      await this.chatPanel.init(
        chatContainer,
        this.currentRoomId,
        this.currentUserId,
        participantsWithNames
      );

      console.log('Chat panel initialized successfully');
    } catch (error) {
      console.error('Failed to initialize chat panel:', error);
    }
  }

  /**
   * Update chat panel with current participants
   */
  private async updateChatParticipants(): Promise<void> {
    if (!this.chatPanel || !this.currentRoomId) return;

    const participants = this.studyRoomsManager.getRoomParticipants(this.currentRoomId);
    for (const p of participants) {
      const userName = await this.getUserName(p.userId);
      this.chatPanel.addParticipant(p.userId, userName);
    }
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
   * Load session content from Supabase
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

      // Load session from Supabase
      console.log(`Loading session ${room.sessionId} for room ${this.currentRoomId}`);

      const supabase = SupabaseClient.getInstance().getClient();
      const { data: sessionData, error } = await supabase
        .from('sessions')
        .select('id, title, notes, transcription_text')
        .eq('id', room.sessionId)
        .single();

      if (error) {
        console.error('Failed to load session from Supabase:', error);
        if (notesContainer) {
          notesContainer.innerHTML = '<p class="empty-state error">Failed to load session content</p>';
        }
        if (transcriptContainer) {
          transcriptContainer.innerHTML = '<p class="empty-state error">Failed to load session content</p>';
        }
        return;
      }

      if (!sessionData) {
        console.warn('Session not found:', room.sessionId);
        if (notesContainer) {
          notesContainer.innerHTML = '<p class="empty-state">Session not found</p>';
        }
        if (transcriptContainer) {
          transcriptContainer.innerHTML = '<p class="empty-state">Session not found</p>';
        }
        return;
      }

      // Initialize collaborative editor
      if (notesContainer) {
        await this.initializeCollaborativeEditor(notesContainer, room.sessionId, sessionData.notes || '');
      }

      // Display transcript (match TranscriptionRenderer format)
      if (transcriptContainer) {
        if (sessionData.transcription_text) {
          try {
            const transcription = JSON.parse(sessionData.transcription_text);
            if (transcription && transcription.segments && Array.isArray(transcription.segments)) {
              const segments = transcription.segments
                .map((segment: any) => {
                  const timestamp = formatTimestamp(segment.startTime || 0);
                  const text = escapeHtml(segment.text || '');
                  return `<p class="transcription-segment" data-start="${segment.startTime}"><span class="timestamp clickable">[${timestamp}]</span> ${text}</p>`;
                })
                .join('');
              transcriptContainer.innerHTML = `<div class="transcript-content">${segments}</div>`;
            } else {
              transcriptContainer.innerHTML = '<p class="empty-state">No transcript available</p>';
            }
          } catch (parseError) {
            console.error('Failed to parse transcription:', parseError);
            transcriptContainer.innerHTML = '<p class="empty-state">Transcription format error</p>';
          }
        } else {
          transcriptContainer.innerHTML = '<p class="empty-state">No transcription available</p>';
        }
      }

      console.log('Session content loaded successfully');
    } catch (error) {
      console.error('Failed to load session content:', error);
    }
  }

  /**
   * Initialize collaborative editor for session notes
   */
  private async initializeCollaborativeEditor(
    container: HTMLElement,
    sessionId: string,
    initialContent: string
  ): Promise<void> {
    try {
      if (!this.currentUserId || !this.currentUserEmail) {
        console.error('Cannot initialize collaborative editor: missing user info');
        container.innerHTML = '<p class="empty-state error">Unable to load editor (missing user info)</p>';
        return;
      }

      // Create editor container (inside content-panel-inner structure)
      container.innerHTML = `
        <div id="room-notes-editor" class="tiptap-content"></div>
        <p class="editor-hint" style="margin-top: 12px; font-size: 0.9em; color: var(--text-secondary);">
          ✨ Collaborative editing enabled - changes sync in real-time!
        </p>
      `;

      const editorElement = document.getElementById('room-notes-editor');
      if (!editorElement) {
        console.error('Editor element not found');
        return;
      }

      // Enable collaboration and create editor
      const userName = this.currentUserName || this.currentUserEmail.split('@')[0];

      console.log(`Initializing collaborative editor for session ${sessionId}`);

      this.notesEditor = await this.collaborationAdapter.enable(
        {
          sessionId,
          userId: this.currentUserId,
          userName,
          userEmail: this.currentUserEmail,
        },
        this.notesEditor,
        editorElement as HTMLElement,
        undefined, // onEditorRecreated callback
        initialContent // Pass the initial notes content from database
      );

      console.log('Collaborative editor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize collaborative editor:', error);
      container.innerHTML = `
        <p class="empty-state error">Failed to initialize collaborative editor</p>
        <p class="empty-state">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
      `;
    }
  }

  /**
   * Switch content tabs (matches individual session view pattern)
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

    // Update content panels (use session-content-panel to match study mode)
    this.container.querySelectorAll('.session-content-panel').forEach(panel => {
      const panelTab = panel.getAttribute('data-panel');
      if (panelTab === tabName) {
        panel.classList.add('active');
      } else {
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

    // Show invite friends modal
    this.inviteFriendsModal.show(this.currentRoomId);
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
        'You are the host. Close the room for everyone?\n\n(OK = Close room for all | Cancel = Leave room open and exit)'
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

  /**
   * Get user name from user ID
   */
  private async getUserName(userId: string): Promise<string> {
    if (!this.currentRoomId) return 'Unknown User';

    const participants = this.studyRoomsManager.getRoomParticipants(this.currentRoomId);
    const participant = participants.find(p => p.userId === userId);

    if (participant) {
      return participant.userFullName || participant.userEmail;
    }

    return 'Unknown User';
  }
}
