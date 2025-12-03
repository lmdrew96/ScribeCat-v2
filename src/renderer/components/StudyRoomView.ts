/**
 * StudyRoomView
 *
 * Full-screen view for an active study room.
 * Orchestrates sub-modules for participants, games, session content, and exit dialogs.
 */

import type { StudyRoomsManager } from '../managers/social/StudyRoomsManager.js';
import type { FriendsManager } from '../managers/social/FriendsManager.js';
import { ChatManager } from '../managers/social/ChatManager.js';
import { ChatPanel } from './ChatPanel.js';
import { InviteFriendsModal } from './InviteFriendsModal.js';
import { ErrorModal } from '../utils/ErrorModal.js';
import { Editor } from '@tiptap/core';
import { CollaborationAdapter } from '../tiptap/CollaborationAdapter.js';
import { StudyModeEditorToolbar } from '../tiptap/StudyModeEditorToolbar.js';
import { MultiplayerGamesManager } from '../managers/social/MultiplayerGamesManager.js';
import { Session } from '../../domain/entities/Session.js';
import {
  StudyRoomParticipants,
  StudyRoomExitDialogs,
  StudyRoomGameIntegration,
  StudyRoomSessionContent,
  StudyRoomAudioPlayer,
  StudyRoomTemplate,
} from './study-room/index.js';

export class StudyRoomView {
  private container: HTMLElement | null = null;
  private studyRoomsManager: StudyRoomsManager;
  private friendsManager: FriendsManager;
  private chatManager: ChatManager;
  private chatPanel: ChatPanel | null = null;
  private inviteFriendsModal: InviteFriendsModal;
  private gamesManager: MultiplayerGamesManager;
  private gameIntegration: StudyRoomGameIntegration;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private currentUserEmail: string | null = null;
  private currentUserName: string | null = null;
  private onExit?: () => void;
  private currentSession: Session | null = null;
  private previousView: 'recording' | 'study-mode' = 'recording';
  private isLeavingVoluntarily: boolean = false;

  // Collaborative editor
  private notesEditor: Editor | null = null;
  private collaborationAdapter: CollaborationAdapter;
  private editorToolbar: StudyModeEditorToolbar | null = null;

  // Audio playback
  private audioPlayer: StudyRoomAudioPlayer;

  constructor(studyRoomsManager: StudyRoomsManager, friendsManager: FriendsManager) {
    this.studyRoomsManager = studyRoomsManager;
    this.friendsManager = friendsManager;
    this.chatManager = new ChatManager();
    this.inviteFriendsModal = new InviteFriendsModal(friendsManager, studyRoomsManager);
    this.collaborationAdapter = new CollaborationAdapter();
    this.audioPlayer = new StudyRoomAudioPlayer();
    this.gamesManager = new MultiplayerGamesManager();
    this.gamesManager.setChatManager(this.chatManager);

    // Initialize game integration
    this.gameIntegration = new StudyRoomGameIntegration(
      studyRoomsManager,
      this.gamesManager,
      (active) => this.renderHeader()
    );

    // Listen for participant changes
    this.studyRoomsManager.addParticipantsListener((roomId) => {
      if (roomId === this.currentRoomId) {
        if (this.currentUserId && this.isVisible() && !this.isLeavingVoluntarily) {
          const activeParticipants = this.studyRoomsManager.getActiveParticipants(roomId);
          const isStillInRoom = activeParticipants.some(p => p.userId === this.currentUserId);

          if (!isStillInRoom) {
            this.handleForcedExit();
            return;
          }
        }

        this.renderParticipants();
        this.updateChatParticipants().catch(err =>
          console.error('Failed to update chat participants:', err)
        );
      }
    });

    // Listen for room changes
    this.studyRoomsManager.addRoomsListener(() => {
      if (this.currentRoomId && this.isVisible() && !this.isLeavingVoluntarily) {
        const room = this.studyRoomsManager.getRoomById(this.currentRoomId);
        if (!room || !room.isActive) {
          this.handleForcedExit();
          return;
        }
        this.renderHeader();
      }
    });
  }

  public initialize(): void {
    this.createView();
  }

  public getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  public setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
    if (userId && this.currentUserName) {
      this.chatManager.initialize(userId, this.currentUserName);
    }
  }

  public setCurrentUserInfo(userId: string, email: string, name: string): void {
    this.currentUserId = userId;
    this.currentUserEmail = email;
    this.currentUserName = name;
    this.chatManager.initialize(userId, name);
  }

  private createView(): void {
    this.container = document.getElementById('study-room-view');
    if (!this.container) {
      console.error('StudyRoomView: Container #study-room-view not found');
      return;
    }

    this.container.innerHTML = StudyRoomTemplate.getHTML();
    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    if (!this.container) return;

    document.getElementById('exit-room-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.exitRoom();
    });

    document.getElementById('start-game-btn')?.addEventListener('click', () => {
      if (this.currentSession) {
        this.gameIntegration.handleStartGame(this.currentSession);
      }
    });

    document.getElementById('invite-friends-btn')?.addEventListener('click', () => this.showInviteFriends());
    document.getElementById('room-settings-btn')?.addEventListener('click', () => this.showRoomSettings());

    this.container.querySelectorAll('.content-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tabName = target.dataset.tab;
        if (tabName && this.container) {
          StudyRoomSessionContent.switchTab(this.container, tabName);
        }
      });
    });
  }

  public async show(roomId: string, onExit?: () => void): Promise<void> {
    if (!this.container) return;

    this.currentRoomId = roomId;
    this.onExit = onExit;
    this.isLeavingVoluntarily = false;

    const studyModeView = document.getElementById('study-mode-view');
    const mainContent = document.querySelector('.main-content') as HTMLElement;

    this.previousView = studyModeView && !studyModeView.classList.contains('hidden')
      ? 'study-mode' : 'recording';

    const isInRoom = await this.studyRoomsManager.isUserInRoom(roomId);
    if (!isInRoom) {
      try {
        await this.studyRoomsManager.joinRoom(roomId);
      } catch (error) {
        console.error('Failed to join room:', error);
        ErrorModal.show('Failed to Join Room', 'Could not join the study room. Please check your connection.');
        if (this.onExit) this.onExit();
        return;
      }
    }

    mainContent?.classList.add('hidden');
    studyModeView?.classList.add('hidden');
    this.container.classList.remove('hidden');

    // Initialize game integration
    if (this.currentUserId) {
      this.gameIntegration.initialize(roomId, this.currentUserId);
    }

    await this.loadRoomData();
    await this.gameIntegration.checkForActiveGame();
    this.gameIntegration.subscribeToRoomGames();
    this.gameIntegration.startGamePolling();
  }

  public hide(): void {
    if (!this.container) return;

    this.gameIntegration.cleanup();
    StudyRoomParticipants.stopTimeInterval();

    if (this.chatPanel) {
      this.chatPanel.destroy();
      this.chatPanel = null;
    }

    if (this.editorToolbar) {
      this.editorToolbar.cleanup();
      this.editorToolbar = null;
    }

    if (this.notesEditor) {
      this.notesEditor.destroy();
      this.notesEditor = null;
    }

    this.collaborationAdapter.disable();
    this.container.classList.add('hidden');

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

  private isVisible(): boolean {
    return this.container !== null && !this.container.classList.contains('hidden');
  }

  private handleForcedExit(): void {
    if (typeof window !== 'undefined' && window.notificationTicker) {
      window.notificationTicker.info('The host has closed this study room', 5000);
    }
    this.hide();
    if (this.onExit) this.onExit();
  }

  private async loadRoomData(): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId) return;

    try {
      this.renderHeader();
      this.renderParticipants();
      StudyRoomParticipants.startTimeInterval();
      await this.loadSessionContent();
      await this.initializeChatPanel();
    } catch (error) {
      console.error('Failed to load room data:', error);
    }
  }

  private renderHeader(): void {
    if (!this.currentRoomId) return;

    const room = this.studyRoomsManager.getRoomById(this.currentRoomId);
    if (!room) return;

    const titleEl = document.getElementById('room-title');
    const subtitleEl = document.getElementById('room-subtitle');
    const startGameBtn = document.getElementById('start-game-btn');

    if (titleEl) titleEl.textContent = room.name;

    if (subtitleEl) {
      const isHost = this.currentUserId === room.hostId;
      const hostText = isHost ? 'You (Host)' : `Host: ${room.hostFullName || room.hostEmail}`;
      subtitleEl.textContent = `${hostText} • ${room.isActive ? 'Active' : 'Closed'}`;
    }

    if (startGameBtn) {
      const isHost = this.currentUserId === room.hostId;
      const showButton = isHost && !this.gameIntegration.getIsGameActive() && this.currentSession !== null;
      startGameBtn.style.display = showButton ? 'inline-block' : 'none';
    }
  }

  private renderParticipants(): void {
    if (!this.currentRoomId || !this.currentUserId) return;
    StudyRoomParticipants.render(this.currentRoomId, this.currentUserId, this.studyRoomsManager);
    StudyRoomParticipants.attachKickListeners(this.currentRoomId, this.studyRoomsManager);
  }

  private async initializeChatPanel(): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId) return;

    const chatContainer = document.getElementById('study-room-chat-container');
    if (!chatContainer) return;

    try {
      const participants = this.studyRoomsManager.getRoomParticipants(this.currentRoomId);
      const participantsWithNames = await Promise.all(
        participants.map(async (p) => ({
          userId: p.userId,
          userName: await StudyRoomParticipants.getUserName(p.userId, this.currentRoomId!, this.studyRoomsManager),
        }))
      );

      this.chatPanel = new ChatPanel(this.chatManager);
      await this.chatPanel.init(chatContainer, this.currentRoomId, this.currentUserId, participantsWithNames);
    } catch (error) {
      console.error('Failed to initialize chat panel:', error);
    }
  }

  private async updateChatParticipants(): Promise<void> {
    if (!this.chatPanel || !this.currentRoomId) return;

    const participants = this.studyRoomsManager.getRoomParticipants(this.currentRoomId);
    for (const p of participants) {
      const userName = await StudyRoomParticipants.getUserName(p.userId, this.currentRoomId, this.studyRoomsManager);
      this.chatPanel.addParticipant(p.userId, userName);
    }
  }

  private async loadSessionContent(): Promise<void> {
    if (!this.currentRoomId) return;

    const room = this.studyRoomsManager.getRoomById(this.currentRoomId);
    if (!room?.sessionId) {
      StudyRoomSessionContent.renderEmptyState();
      return;
    }

    const result = await StudyRoomSessionContent.loadSession(this.currentRoomId, this.studyRoomsManager);

    if (result.error) {
      StudyRoomSessionContent.renderErrorState(result.error);
      return;
    }

    if (!result.session || !result.sessionData) {
      StudyRoomSessionContent.renderEmptyState();
      return;
    }

    this.currentSession = result.session;
    this.renderHeader();

    const notesContainer = document.getElementById('session-notes');
    if (notesContainer) {
      await this.initializeCollaborativeEditor(notesContainer, room.sessionId, result.sessionData.notes || '');
    }

    StudyRoomSessionContent.renderTranscript(result.sessionData);
    StudyRoomSessionContent.renderMetadata(result.sessionData);

    const recordingPath = StudyRoomSessionContent.getAudioRecordingPath(result.sessionData);
    if (recordingPath) {
      await this.audioPlayer.setup(result.sessionData, recordingPath);
    }
  }

  private async initializeCollaborativeEditor(
    container: HTMLElement,
    sessionId: string,
    initialContent: string
  ): Promise<void> {
    try {
      if (!this.currentUserId || !this.currentUserEmail) {
        container.innerHTML = '<p class="empty-state error">Unable to load editor (missing user info)</p>';
        return;
      }

      this.editorToolbar = new StudyModeEditorToolbar();
      container.innerHTML = this.editorToolbar.getHTML() + `
        <p class="editor-hint" style="margin-top: 12px; font-size: 0.9em; color: var(--text-secondary);">
          ✨ Collaborative editing enabled - changes sync in real-time!
        </p>
      `;

      const editorElement = document.getElementById('study-notes-editor');
      if (!editorElement) return;

      const userName = this.currentUserName || this.currentUserEmail.split('@')[0];

      this.notesEditor = await this.collaborationAdapter.enable(
        {
          sessionId,
          userId: this.currentUserId,
          userName,
          userEmail: this.currentUserEmail,
        },
        this.notesEditor,
        editorElement,
        (editor) => {
          if (this.editorToolbar) this.editorToolbar.setup(editor);
        },
        initialContent
      );
    } catch (error) {
      console.error('Failed to initialize collaborative editor:', error);
      container.innerHTML = `<p class="empty-state error">Failed to initialize collaborative editor</p>`;
    }
  }

  private async showInviteFriends(): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId) return;

    const room = this.studyRoomsManager.getRoomById(this.currentRoomId);
    if (!room) return;

    if (room.hostId !== this.currentUserId) {
      ErrorModal.show('Permission Denied', 'Only the room host can invite friends.');
      return;
    }

    this.inviteFriendsModal.show(this.currentRoomId);
  }

  private async showRoomSettings(): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId) return;

    const room = this.studyRoomsManager.getRoomById(this.currentRoomId);
    if (!room || room.hostId !== this.currentUserId) {
      alert('Only the host can change room settings.');
      return;
    }

    const newName = prompt('Enter new room name:', room.name);
    if (newName && newName !== room.name) {
      try {
        await this.studyRoomsManager.updateRoom({ roomId: this.currentRoomId, name: newName });
        this.renderHeader();
      } catch (error) {
        alert('Failed to update room settings.');
      }
    }
  }

  private async exitRoom(): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId) return;

    this.isLeavingVoluntarily = true;

    StudyRoomExitDialogs.show(
      this.currentRoomId,
      this.currentUserId,
      this.studyRoomsManager,
      async () => {
        await StudyRoomExitDialogs.performLeaveRoom(
          this.currentRoomId!,
          this.studyRoomsManager,
          () => {
            this.hide();
            if (this.onExit) this.onExit();
          }
        );
        this.isLeavingVoluntarily = false;
      },
      async () => {
        await StudyRoomExitDialogs.performCloseRoom(
          this.currentRoomId!,
          this.studyRoomsManager,
          () => {
            this.hide();
            if (this.onExit) this.onExit();
          }
        );
        this.isLeavingVoluntarily = false;
      }
    );
  }
}
