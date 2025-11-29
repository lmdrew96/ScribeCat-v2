/**
 * StudyRoomView
 *
 * Full-screen view for an active study room.
 * Shows participants, session content, chat (Phase 3), and room controls.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import type { StudyRoomsManager } from '../managers/social/StudyRoomsManager.js';
import type { FriendsManager } from '../managers/social/FriendsManager.js';
import type { StudyRoomData } from '../../domain/entities/StudyRoom.js';
import type { RoomParticipantData } from '../../domain/entities/RoomParticipant.js';
import { ChatManager } from '../managers/social/ChatManager.js';
import { ChatPanel } from './ChatPanel.js';
import { InviteFriendsModal } from './InviteFriendsModal.js';
import { escapeHtml, formatTimestamp } from '../utils/formatting.js';
import { ErrorModal } from '../utils/ErrorModal.js';
import { SupabaseClient } from '../../infrastructure/services/supabase/SupabaseClient.js';
import { RendererSupabaseClient } from '../services/RendererSupabaseClient.js';
import { Editor } from '@tiptap/core';
import { CollaborationAdapter } from '../tiptap/CollaborationAdapter.js';
import { EditorConfigService } from '../tiptap/EditorConfigService.js';
import { StudyModeEditorToolbar } from '../tiptap/StudyModeEditorToolbar.js';
import { SessionPlaybackManager } from '../services/SessionPlaybackManager.js';
import { SupabaseStorageService } from '../../infrastructure/services/supabase/SupabaseStorageService.js';
import { MultiplayerGamesManager } from '../managers/social/MultiplayerGamesManager.js';
import { GameSelectionModal } from './GameSelectionModal.js';
import { Session } from '../../domain/entities/Session.js';

export class StudyRoomView {
  private container: HTMLElement | null = null;
  private studyRoomsManager: StudyRoomsManager;
  private friendsManager: FriendsManager;
  private chatManager: ChatManager;
  private chatPanel: ChatPanel | null = null;
  private inviteFriendsModal: InviteFriendsModal;
  private gamesManager: MultiplayerGamesManager;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private currentUserEmail: string | null = null;
  private currentUserName: string | null = null;
  private onExit?: () => void;
  private currentSession: Session | null = null;
  private isGameActive: boolean = false;
  private roomGameChannel: RealtimeChannel | null = null;
  private gamePollingInterval: number | null = null;
  private participantTimeInterval: ReturnType<typeof setInterval> | null = null;
  private static readonly GAME_POLLING_INTERVAL_MS = 3000; // Poll every 3 seconds
  private static readonly PARTICIPANT_TIME_UPDATE_MS = 30000; // Update participant times every 30 seconds

  // Track which view user came from (for returning after exit)
  private previousView: 'recording' | 'study-mode' = 'recording';

  // Collaborative editor
  private notesEditor: Editor | null = null;
  private collaborationAdapter: CollaborationAdapter;
  private editorToolbar: StudyModeEditorToolbar | null = null;

  // Audio playback
  private sessionPlaybackManager: SessionPlaybackManager;

  constructor(studyRoomsManager: StudyRoomsManager, friendsManager: FriendsManager) {
    this.studyRoomsManager = studyRoomsManager;
    this.friendsManager = friendsManager;
    this.chatManager = new ChatManager();
    this.inviteFriendsModal = new InviteFriendsModal(friendsManager, studyRoomsManager);
    this.collaborationAdapter = new CollaborationAdapter();
    this.sessionPlaybackManager = new SessionPlaybackManager();
    this.gamesManager = new MultiplayerGamesManager();
    this.gamesManager.setChatManager(this.chatManager);

    // Listen for participant changes
    this.studyRoomsManager.addParticipantsListener((roomId) => {
      if (roomId === this.currentRoomId) {
        this.renderParticipants();
        // Update chat panel with new participants (fixes "Unknown" user names)
        this.updateChatParticipants().catch(err =>
          console.error('Failed to update chat participants:', err)
        );
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
   * Get current room ID (for cleanup purposes)
   */
  public getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  /**
   * Set current user info for collaboration
   */
  public setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
    if (userId && this.currentUserName) {
      this.chatManager.initialize(userId, this.currentUserName);
    }
  }

  /**
   * Set current user info (needed for collaboration)
   */
  public setCurrentUserInfo(userId: string, email: string, name: string): void {
    this.currentUserId = userId;
    this.currentUserEmail = email;
    this.currentUserName = name;
    this.chatManager.initialize(userId, name);
  }

  /**
   * Create the view structure
   */
  private createView(): void {
    // Get the existing static container from index.html
    this.container = document.getElementById('study-room-view');

    if (!this.container) {
      console.error('StudyRoomView: Container #study-room-view not found in DOM');
      return;
    }

    // Populate the container with the view structure
    this.container.innerHTML = `
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
          <button class="btn-primary btn-sm" id="start-game-btn" style="display: none;">
            🎮 Start Game
          </button>
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
        <!-- Chat Panel -->
        <div class="study-room-chat" id="study-room-chat-container">
          <!-- Chat panel will be initialized here -->
        </div>

        <!-- Session Content -->
        <div class="study-room-content">
          <div class="content-header">
            <h3>Shared Session</h3>
          </div>

          <!-- Session Info Bar -->
          <div class="session-info-bar" id="session-info-bar" style="display: none;">
            <div class="session-info-content">
              <span class="session-course-badge" id="session-course-badge">No Course</span>
              <span class="session-title" id="session-title-display">Session Title</span>
              <span class="session-meta-separator">•</span>
              <span class="session-date" id="session-date-display">Date</span>
              <span class="session-meta-separator">•</span>
              <span class="session-duration" id="session-duration-display">Duration</span>
            </div>
          </div>

          <!-- Audio Player -->
          <div class="audio-player-container" id="audio-player-container" style="display: none;">
            <div class="audio-player">
              <audio id="session-audio" preload="metadata" style="display: none;">
                Your browser does not support the audio element.
              </audio>

              <!-- Custom Audio Controls -->
              <div class="custom-audio-controls">
                <!-- Play/Pause Button -->
                <button class="audio-control-btn play-pause-btn" id="play-pause-btn" title="Play/Pause">
                  <span class="play-icon">▶</span>
                </button>

                <!-- Time Display -->
                <div class="audio-time-display">
                  <span id="current-time">0:00</span>
                  <span class="time-separator">/</span>
                  <span id="total-duration">0:00</span>
                </div>

                <!-- Progress Bar -->
                <div class="audio-progress-container" id="audio-progress-container">
                  <div class="audio-progress-bar">
                    <div class="audio-progress-buffered" id="audio-progress-buffered"></div>
                    <div class="audio-progress-played" id="audio-progress-played"></div>
                    <div class="audio-progress-handle" id="audio-progress-handle"></div>
                  </div>
                </div>

                <!-- Volume Control -->
                <button class="audio-control-btn volume-btn" id="volume-btn" title="Mute/Unmute">
                  <span class="volume-icon">🔊</span>
                </button>
              </div>

              <div class="playback-controls">
                <label>Speed:</label>
                <button class="speed-btn" data-speed="0.5">0.5x</button>
                <button class="speed-btn" data-speed="0.75">0.75x</button>
                <button class="speed-btn active" data-speed="1">1x</button>
                <button class="speed-btn" data-speed="1.25">1.25x</button>
                <button class="speed-btn" data-speed="1.5">1.5x</button>
                <button class="speed-btn" data-speed="2">2x</button>
              </div>
            </div>
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
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.container) return;

    // Exit room button
    const exitBtn = document.getElementById('exit-room-btn');
    if (exitBtn) {
      exitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exitRoom();
      });
    } else {
      console.error('Exit button not found');
    }

    // Start game button
    const startGameBtn = document.getElementById('start-game-btn');
    startGameBtn?.addEventListener('click', () => this.handleStartGame());

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
    if (!this.container) {
      console.error('StudyRoomView: No container');
      return;
    }

    this.currentRoomId = roomId;
    this.onExit = onExit;

    // Track which view user came from (for returning after exit)
    const studyModeView = document.getElementById('study-mode-view');
    const mainContent = document.querySelector('.main-content') as HTMLElement;

    this.previousView = studyModeView && !studyModeView.classList.contains('hidden')
      ? 'study-mode'
      : 'recording';

    // Check if user is in room
    const isInRoom = await this.studyRoomsManager.isUserInRoom(roomId);

    if (!isInRoom) {
      // User is not in room, join first
      try {
        await this.studyRoomsManager.joinRoom(roomId);
      } catch (error) {
        console.error('Failed to join room:', error);
        ErrorModal.show(
          'Failed to Join Room',
          'Could not join the study room. Please check your connection and try again.'
        );
        if (this.onExit) this.onExit();
        return;
      }
    }

    // Hide both main-content and study-mode-view, show study room view
    mainContent?.classList.add('hidden');
    studyModeView?.classList.add('hidden');
    this.container.classList.remove('hidden');

    // Load room data
    await this.loadRoomData();

    // Check for active games (important for non-host participants)
    await this.checkForActiveGame();

    // Subscribe to room game changes for real-time game detection
    this.subscribeToRoomGames();

    // Start polling as fallback for game detection (non-hosts only)
    this.startGamePolling();
  }

  /**
   * Hide the study room view
   */
  public hide(): void {
    if (!this.container) return;

    // Cleanup room game subscription and polling
    this.cleanupRoomGameChannel();
    this.stopGamePolling();

    // Cleanup participant time interval
    this.stopParticipantTimeInterval();

    // Cleanup chat panel
    if (this.chatPanel) {
      this.chatPanel.destroy();
      this.chatPanel = null;
    }

    // Cleanup editor and collaboration
    if (this.editorToolbar) {
      this.editorToolbar.cleanup();
      this.editorToolbar = null;
    }

    if (this.notesEditor) {
      this.notesEditor.destroy();
      this.notesEditor = null;
    }

    this.collaborationAdapter.disable();

    // Hide study room view using class toggle
    this.container.classList.add('hidden');

    // Restore previous view
    const studyModeView = document.getElementById('study-mode-view');
    const mainContent = document.querySelector('.main-content') as HTMLElement;

    if (this.previousView === 'study-mode') {
      studyModeView?.classList.remove('hidden');
      mainContent?.classList.add('hidden');
    } else {
      mainContent?.classList.remove('hidden');
      studyModeView?.classList.add('hidden');
    }

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

      // Start participant time update interval
      this.startParticipantTimeInterval();

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
    const startGameBtn = document.getElementById('start-game-btn');

    if (titleEl) {
      titleEl.textContent = room.name;
    }

    if (subtitleEl) {
      const isHost = this.currentUserId === room.hostId;
      const hostText = isHost ? 'You (Host)' : `Host: ${room.hostFullName || room.hostEmail}`;
      const status = room.isActive ? 'Active' : 'Closed';
      subtitleEl.textContent = `${hostText} • ${status}`;
    }

    // Show "Start Game" button only for host when no game is active and session exists
    if (startGameBtn) {
      const isHost = this.currentUserId === room.hostId;
      const showButton = isHost && !this.isGameActive && this.currentSession !== null;
      startGameBtn.style.display = showButton ? 'inline-block' : 'none';
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
    const joinedAtISO = new Date(participant.joinedAt).toISOString();

    return `
      <div class="participant-item ${isCurrentUser ? 'current-user' : ''}" data-user-id="${participant.userId}" data-joined-at="${joinedAtISO}">
        <div class="participant-avatar">${initials}</div>
        <div class="participant-info">
          <p class="participant-name">
            ${escapeHtml(displayName)}
            ${isHost ? '<span class="badge-host">Host</span>' : ''}
            ${isCurrentUser ? '<span class="badge-you">You</span>' : ''}
          </p>
          <p class="participant-status">
            <span class="status-indicator active"></span>
            Active • <span class="participant-time">${this.getTimeInRoom(participant.joinedAt)}</span>
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
            ErrorModal.show(
              'Failed to Remove Participant',
              'Could not remove the participant from the room. Please try again.'
            );
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

      // Load session from Supabase (use renderer client for auth context)
      const supabase = RendererSupabaseClient.getInstance().getClient();
      const { data: sessionData, error } = await supabase
        .from('sessions')
        .select('id, title, notes, transcription_text, course_title, course_number, duration, created_at, user_id, source_session_id, source_user_id')
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

      // Store the session for game generation
      // Need to transform sessionData to match Session.fromJSON expected format
      console.log('Session data from database:', {
        hasTranscriptionText: !!sessionData.transcription_text,
        transcriptionTextType: typeof sessionData.transcription_text,
        transcriptionTextLength: sessionData.transcription_text?.length,
        hasNotes: !!sessionData.notes,
        notesLength: sessionData.notes?.length
      });

      let transcription = undefined;
      if (sessionData.transcription_text) {
        const transcriptionData = JSON.parse(sessionData.transcription_text);
        console.log('Parsed transcription data:', {
          hasFullText: !!transcriptionData.fullText,
          hasSegments: !!transcriptionData.segments,
          segmentsCount: transcriptionData.segments?.length
        });

        // Ensure it has fullText - if not, build it from segments
        if (!transcriptionData.fullText && transcriptionData.segments) {
          transcriptionData.fullText = transcriptionData.segments
            .map((seg: any) => seg.text)
            .join(' ');
          console.log('Built fullText from segments, length:', transcriptionData.fullText.length);
        }

        // Ensure it has required fields for Transcription entity
        if (transcriptionData.fullText && transcriptionData.segments) {
          transcription = {
            fullText: transcriptionData.fullText,
            segments: transcriptionData.segments,
            language: transcriptionData.language || 'en',
            provider: 'assemblyai',
            createdAt: new Date(sessionData.created_at),
            averageConfidence: transcriptionData.averageConfidence
          };
          console.log('Created transcription object with fullText length:', transcription.fullText.length);
        } else {
          console.warn('Transcription data missing fullText or segments');
        }
      }

      const sessionForEntity = {
        ...sessionData,
        recordingPath: '', // Study room sessions may not have recording files
        transcription,
        createdAt: new Date(sessionData.created_at),
        updatedAt: new Date(sessionData.created_at), // Use created_at as fallback
      };
      this.currentSession = Session.fromJSON(sessionForEntity);

      console.log('Final session for games:', {
        hasTranscription: !!this.currentSession.transcription,
        hasFullText: !!this.currentSession.transcription?.fullText,
        fullTextLength: this.currentSession.transcription?.fullText?.length,
        hasNotes: !!this.currentSession.notes,
        notesLength: this.currentSession.notes?.length
      });

      // Update header to show Start Game button if user is host
      this.renderHeader();

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

      // Render session metadata
      this.renderSessionMetadata(sessionData);

      // Setup audio player - construct recording path from user_id and session_id
      // For copied sessions (study rooms), use the source session's audio file
      // Audio files are stored in Supabase Storage, not in the database
      const audioUserId = sessionData.source_user_id || sessionData.user_id;
      const audioSessionId = sessionData.source_session_id || sessionData.id;

      if (audioUserId && audioSessionId) {
        const recordingPath = `cloud://${audioUserId}/${audioSessionId}/audio.webm`;
        await this.setupAudioPlayer(sessionData, recordingPath);
      }
    } catch (error) {
      console.error('Failed to load session content:', error);
    }
  }

  /**
   * Render session metadata (title, course, date, duration)
   */
  private renderSessionMetadata(sessionData: any): void {
    const sessionInfoBar = document.getElementById('session-info-bar');
    const courseBadge = document.getElementById('session-course-badge');
    const sessionTitle = document.getElementById('session-title-display');
    const sessionDate = document.getElementById('session-date-display');
    const sessionDuration = document.getElementById('session-duration-display');

    if (!sessionInfoBar) return;

    // Show the info bar
    sessionInfoBar.style.display = 'block';

    // Set course badge
    if (courseBadge) {
      if (sessionData.course_title) {
        courseBadge.textContent = sessionData.course_number
          ? `${sessionData.course_number}: ${sessionData.course_title}`
          : sessionData.course_title;
      } else {
        courseBadge.textContent = 'No Course';
      }
    }

    // Set session title
    if (sessionTitle) {
      sessionTitle.textContent = sessionData.title || 'Untitled Session';
    }

    // Set session date
    if (sessionDate && sessionData.created_at) {
      const date = new Date(sessionData.created_at);
      sessionDate.textContent = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    // Set session duration
    if (sessionDuration && sessionData.duration) {
      const hours = Math.floor(sessionData.duration / 3600);
      const minutes = Math.floor((sessionData.duration % 3600) / 60);
      const seconds = Math.floor(sessionData.duration % 60);

      if (hours > 0) {
        sessionDuration.textContent = `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        sessionDuration.textContent = `${minutes}m ${seconds}s`;
      } else {
        sessionDuration.textContent = `${seconds}s`;
      }
    }
  }

  /**
   * Setup audio player with recording
   */
  private async setupAudioPlayer(sessionData: any, recordingPath: string): Promise<void> {
    const audioPlayerContainer = document.getElementById('audio-player-container');
    const audioElement = document.getElementById('session-audio') as HTMLAudioElement;

    if (!audioPlayerContainer || !audioElement || !recordingPath) return;

    try {
      // Show the audio player
      audioPlayerContainer.style.display = 'block';

      // Handle cloud vs local recordings
      if (recordingPath.startsWith('cloud://')) {
        // Cloud recording - fetch signed URL
        const storagePath = recordingPath.replace('cloud://', '');
        const storageService = new SupabaseStorageService();

        const result = await storageService.getSignedUrl(storagePath, 7200);

        if (result.success && result.url) {
          audioElement.src = result.url;
        } else {
          console.warn('Audio file not found in storage:', storagePath, result.error);
          audioPlayerContainer.style.display = 'none';
          return;
        }
      } else if (recordingPath) {
        // Local recording
        audioElement.src = `file://${recordingPath}`;
      }

      // Initialize custom audio controls with session ID for tracking
      this.sessionPlaybackManager.initialize(
        audioElement,
        sessionData.duration || 0,
        () => audioPlayerContainer.style.display !== 'none',
        sessionData.id
      );

      // Setup speed controls
      const speedButtons = document.querySelectorAll('.speed-btn');
      speedButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const speed = parseFloat((btn as HTMLElement).dataset.speed || '1');
          if (audioElement) {
            audioElement.playbackRate = speed;
          }
          speedButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    } catch (error) {
      console.error('Failed to setup audio player:', error);
      audioPlayerContainer.style.display = 'none';
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

      // Create toolbar + editor container
      this.editorToolbar = new StudyModeEditorToolbar();
      container.innerHTML = this.editorToolbar.getHTML() + `
        <p class="editor-hint" style="margin-top: 12px; font-size: 0.9em; color: var(--text-secondary);">
          ✨ Collaborative editing enabled - changes sync in real-time!
        </p>
      `;

      const editorElement = document.getElementById('study-notes-editor');
      if (!editorElement) {
        console.error('Editor element not found');
        return;
      }

      // Enable collaboration and create editor
      const userName = this.currentUserName || this.currentUserEmail.split('@')[0];

      this.notesEditor = await this.collaborationAdapter.enable(
        {
          sessionId,
          userId: this.currentUserId,
          userName,
          userEmail: this.currentUserEmail,
        },
        this.notesEditor,
        editorElement as HTMLElement,
        (editor) => {
          // Setup toolbar after editor is created
          if (this.editorToolbar) {
            this.editorToolbar.setup(editor);
          }
        },
        initialContent // Pass the initial notes content from database
      );
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
      ErrorModal.show(
        'Permission Denied',
        'Only the room host can invite friends to the room.'
      );
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
   * Retry a function with exponential backoff
   * @param fn Function to retry
   * @param maxRetries Maximum number of retries
   * @param baseDelay Base delay in milliseconds (will be doubled each retry)
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 500
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error;
        }

        // Calculate exponential backoff delay
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`);

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Exit room with retry logic
   */
  private async exitRoom(): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId) {
      console.error('Cannot exit - missing roomId or userId');
      return;
    }

    const room = this.studyRoomsManager.getRoomById(this.currentRoomId);
    if (!room) {
      console.error('Cannot exit - room not found');
      return;
    }

    const isHost = room.hostId === this.currentUserId;

    if (isHost) {
      const confirmClose = confirm(
        'You are the host. Close the room for everyone?\n\n(OK = Close room for all | Cancel = Leave room open and exit)'
      );

      if (confirmClose === null) return; // Cancelled

      if (confirmClose) {
        // Close room with retry logic
        try {
          await this.retryWithBackoff(
            () => this.studyRoomsManager.closeRoom(this.currentRoomId!),
            3,
            500
          );
        } catch (error) {
          console.error('Failed to close room after retries:', error);
          alert('Failed to close room after multiple attempts. Please try again.');
          return;
        }
      } else {
        // Leave room with retry logic
        try {
          await this.retryWithBackoff(
            () => this.studyRoomsManager.leaveRoom(this.currentRoomId!),
            3,
            500
          );
        } catch (error) {
          console.error('Failed to leave room after retries:', error);
          alert('Failed to leave room after multiple attempts. Please try again.');
          return;
        }
      }
    } else {
      // Leave room with retry logic
      try {
        await this.retryWithBackoff(
          () => this.studyRoomsManager.leaveRoom(this.currentRoomId!),
          3,
          500
        );
      } catch (error) {
        console.error('Failed to leave room after retries:', error);
        alert('Failed to leave room after multiple attempts. Please try again.');
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
   * Update participant time displays without full re-render
   * Called by interval to keep times current
   */
  private updateParticipantTimes(): void {
    const participantItems = document.querySelectorAll('.participant-item[data-joined-at]');
    participantItems.forEach(item => {
      const joinedAt = item.getAttribute('data-joined-at');
      if (joinedAt) {
        const timeSpan = item.querySelector('.participant-time');
        if (timeSpan) {
          timeSpan.textContent = this.getTimeInRoom(new Date(joinedAt));
        }
      }
    });
  }

  /**
   * Start the participant time update interval
   */
  private startParticipantTimeInterval(): void {
    // Clear any existing interval
    this.stopParticipantTimeInterval();

    this.participantTimeInterval = setInterval(() => {
      this.updateParticipantTimes();
    }, StudyRoomView.PARTICIPANT_TIME_UPDATE_MS);
  }

  /**
   * Stop the participant time update interval
   */
  private stopParticipantTimeInterval(): void {
    if (this.participantTimeInterval) {
      clearInterval(this.participantTimeInterval);
      this.participantTimeInterval = null;
    }
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

  // ============================================================================
  // Multiplayer Games
  // ============================================================================

  /**
   * Handle Start Game button click
   */
  private async handleStartGame(): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId || !this.currentSession) {
      return;
    }

    // Show game selection modal
    const result = await GameSelectionModal.show();
    if (!result) return;

    try {
      console.log('🎮 Starting game creation - lobby will open immediately');
      console.log('⏱️ Questions will generate in background (30-60 seconds)');

      // Initialize games manager
      this.gamesManager.initialize(this.currentUserId);

      // Check for existing active game and cancel it
      const activeGameResult = await window.scribeCat.games.getActiveGameForRoom(this.currentRoomId);
      if (activeGameResult.success && activeGameResult.gameSession) {
        console.log('Cancelling existing active game:', activeGameResult.gameSession.id);
        await window.scribeCat.games.cancelGame(activeGameResult.gameSession.id);
      }

      // Create game session (lobby opens immediately, questions generate in background)
      const gameSession = await this.gamesManager.createGame(
        this.currentRoomId,
        result.gameType,
        this.currentSession,
        {
          questionCount: result.questionCount,
          difficulty: result.difficulty,
        }
      );

      // Get participants for game
      const participants = this.studyRoomsManager.getActiveParticipants(this.currentRoomId);
      const room = this.studyRoomsManager.getRoomById(this.currentRoomId);

      const gameParticipants = participants.map((p) => ({
        userId: p.userId,
        userEmail: p.userEmail,
        userFullName: p.userFullName,
        userAvatarUrl: p.userAvatarUrl,
        isHost: p.userId === room?.hostId,
        isCurrentUser: p.userId === this.currentUserId,
      }));

      // Show game container
      this.showGameContainer();

      // Join the game in waiting mode (don't start yet - let host click "Start Game" button)
      const gameContainer = document.getElementById('multiplayer-game-container');
      if (gameContainer) {
        await this.gamesManager.joinGame(gameSession.id, gameContainer, gameParticipants);
      }

      // Listen for game close event
      window.addEventListener('multiplayer-game:closed', this.handleGameClosed.bind(this), { once: true });
    } catch (error) {
      console.error('❌ Failed to start game:', error);
      ErrorModal.show(
        'Failed to Start Game',
        error instanceof Error ? error.message : 'An unknown error occurred while starting the game.'
      );
      this.hideGameContainer();
    }
  }

  /**
   * Show game modal (overlays study room)
   */
  private showGameContainer(): void {
    this.isGameActive = true;
    this.stopGamePolling(); // Stop polling once game is detected

    const gameContainer = document.getElementById('multiplayer-game-container');
    const gameBackdrop = document.getElementById('multiplayer-game-backdrop');

    gameBackdrop?.classList.add('active');
    gameContainer?.classList.add('active');

    this.renderHeader();
  }

  /**
   * Hide game modal
   */
  private hideGameContainer(): void {
    this.isGameActive = false;

    const gameContainer = document.getElementById('multiplayer-game-container');
    const gameBackdrop = document.getElementById('multiplayer-game-backdrop');

    gameBackdrop?.classList.remove('active');
    gameContainer?.classList.remove('active');

    if (gameContainer) {
      gameContainer.innerHTML = '';
    }

    this.renderHeader();
  }

  /**
   * Handle game closed event
   */
  private async handleGameClosed(): Promise<void> {
    this.hideGameContainer();
    await this.gamesManager.cleanup();

    // Restart game polling for non-host participants so they can detect future games
    const room = this.studyRoomsManager.getRoomById(this.currentRoomId!);
    const isHost = room?.hostId === this.currentUserId;

    if (!isHost && this.currentRoomId) {
      console.log('[StudyRoomView] Restarting game polling after game closed');
      this.startGamePolling();
    }
  }

  /**
   * Check for active games when entering a room
   * This allows non-host participants to join games already in progress
   * NOTE: Hosts don't auto-join - they create/start games via handleStartGame()
   */
  private async checkForActiveGame(): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId) return;

    // Check if current user is the host - hosts don't auto-join games
    const room = this.studyRoomsManager.getRoomById(this.currentRoomId);
    const isHost = room?.hostId === this.currentUserId;

    if (isHost) {
      console.log('[StudyRoomView] Skipping active game check - current user is host');
      return;
    }

    try {
      const activeGameResult = await window.scribeCat.games.getActiveGameForRoom(this.currentRoomId);

      if (activeGameResult.success && activeGameResult.gameSession) {
        const gameSession = activeGameResult.gameSession;
        console.log('[StudyRoomView] Found active game:', gameSession.id, 'status:', gameSession.status);

        // Only join if game is in progress (not waiting or ended)
        if (gameSession.status === 'in_progress' || gameSession.status === 'waiting') {
          await this.joinExistingGame(gameSession);
        }
      }
    } catch (error) {
      console.error('[StudyRoomView] Failed to check for active game:', error);
    }
  }

  /**
   * Subscribe to room game changes to detect when host starts a new game
   * NOTE: This is primarily for non-host participants to detect when a game starts
   * Uses direct Supabase Realtime in renderer (WebSockets don't work in main process)
   */
  private subscribeToRoomGames(): void {
    if (!this.currentRoomId) return;

    // Cleanup any existing subscription
    this.cleanupRoomGameChannel();

    const rendererClient = RendererSupabaseClient.getInstance();
    const client = rendererClient.getClient();

    if (!client) {
      console.error('[StudyRoomView] No Supabase client available for room games subscription');
      return;
    }

    console.log(`[StudyRoomView] Setting up direct room games subscription for room: ${this.currentRoomId}`);

    const channelName = `room-games:${this.currentRoomId}`;
    this.roomGameChannel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT and UPDATE
          schema: 'public',
          table: 'game_sessions',
          filter: `room_id=eq.${this.currentRoomId}`,
        },
        async (payload) => {
          const gameSessionData = payload.new as any;
          console.log('[StudyRoomView] Room game update via Realtime:', gameSessionData?.id, 'status:', gameSessionData?.status);

          // Check if current user is the host - hosts don't join via subscription
          // They create/start games via handleStartGame()
          const room = this.studyRoomsManager.getRoomById(this.currentRoomId!);
          const isHost = room?.hostId === this.currentUserId;

          if (isHost) {
            console.log('[StudyRoomView] Ignoring room game update - current user is host');
            return;
          }

          // If a game started and we're not already in one, join it
          if (gameSessionData && !this.isGameActive) {
            if (gameSessionData.status === 'in_progress' || gameSessionData.status === 'waiting') {
              await this.joinExistingGame(gameSessionData);
            }
          }

          // If game ended, hide the game container
          if (gameSessionData && gameSessionData.status === 'completed') {
            this.hideGameContainer();
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[StudyRoomView] Room games subscription status: ${status}`);
        if (err) {
          console.error('[StudyRoomView] Room games subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log(`[StudyRoomView] Room games subscription active for room: ${this.currentRoomId}`);
        }
      });
  }

  /**
   * Cleanup room game realtime channel
   */
  private cleanupRoomGameChannel(): void {
    if (this.roomGameChannel) {
      console.log('[StudyRoomView] Cleaning up room game channel');
      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();
      this.roomGameChannel.unsubscribe();
      if (client) client.removeChannel(this.roomGameChannel);
      this.roomGameChannel = null;
    }
  }

  /**
   * Start polling for active games as a fallback mechanism
   * This ensures non-host participants can detect games even if Realtime subscription fails
   */
  private startGamePolling(): void {
    // Don't start if already polling or if user is host
    if (this.gamePollingInterval !== null) return;

    const room = this.studyRoomsManager.getRoomById(this.currentRoomId!);
    const isHost = room?.hostId === this.currentUserId;

    if (isHost) {
      console.log('[StudyRoomView] Skipping game polling - current user is host');
      return;
    }

    console.log('[StudyRoomView] Starting game polling as fallback');
    this.gamePollingInterval = window.setInterval(async () => {
      // Stop polling if game is already active or we left the room
      if (this.isGameActive || !this.currentRoomId) {
        this.stopGamePolling();
        return;
      }

      await this.checkForActiveGame();
    }, StudyRoomView.GAME_POLLING_INTERVAL_MS);
  }

  /**
   * Stop polling for active games
   */
  private stopGamePolling(): void {
    if (this.gamePollingInterval !== null) {
      clearInterval(this.gamePollingInterval);
      this.gamePollingInterval = null;
      console.log('[StudyRoomView] Stopped game polling');
    }
  }

  /**
   * Join an existing game session (for non-host participants)
   */
  private async joinExistingGame(gameSessionData: any): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId || this.isGameActive) return;

    try {
      console.log('[StudyRoomView] Joining existing game:', gameSessionData.id);

      // Initialize games manager
      this.gamesManager.initialize(this.currentUserId);

      // Get participants for game
      const participants = this.studyRoomsManager.getActiveParticipants(this.currentRoomId);
      const room = this.studyRoomsManager.getRoomById(this.currentRoomId);

      const gameParticipants = participants.map((p) => ({
        userId: p.userId,
        userEmail: p.userEmail,
        userFullName: p.userFullName,
        userAvatarUrl: p.userAvatarUrl,
        isHost: p.userId === room?.hostId,
        isCurrentUser: p.userId === this.currentUserId,
      }));

      // Show game container
      this.showGameContainer();

      // Join the game (not create) - use joinGame instead of startGame to avoid updating status
      const gameContainer = document.getElementById('multiplayer-game-container');
      if (gameContainer) {
        await this.gamesManager.joinGame(gameSessionData.id, gameContainer, gameParticipants);
      }

      // Listen for game close event
      window.addEventListener('multiplayer-game:closed', this.handleGameClosed.bind(this), { once: true });
    } catch (error) {
      console.error('[StudyRoomView] Failed to join existing game:', error);
      this.hideGameContainer();
    }
  }
}
