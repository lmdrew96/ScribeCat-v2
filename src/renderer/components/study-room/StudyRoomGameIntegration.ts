/**
 * StudyRoomGameIntegration
 *
 * Handles game polling, subscriptions, and join/show game functionality.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import type { StudyRoomsManager } from '../../managers/social/StudyRoomsManager.js';
import type { MultiplayerGamesManager } from '../../managers/social/MultiplayerGamesManager.js';
import type { Session } from '../../../domain/entities/Session.js';
import { RendererSupabaseClient } from '../../services/RendererSupabaseClient.js';
import { GameSelectionModal } from '../GameSelectionModal.js';
import { ErrorModal } from '../../utils/ErrorModal.js';

export class StudyRoomGameIntegration {
  private roomGameChannel: RealtimeChannel | null = null;
  private gamePollingInterval: number | null = null;
  private isGameActive: boolean = false;
  private static readonly GAME_POLLING_INTERVAL_MS = 3000;

  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private studyRoomsManager: StudyRoomsManager;
  private gamesManager: MultiplayerGamesManager;
  private onGameActiveChange: (active: boolean) => void;

  constructor(
    studyRoomsManager: StudyRoomsManager,
    gamesManager: MultiplayerGamesManager,
    onGameActiveChange: (active: boolean) => void
  ) {
    this.studyRoomsManager = studyRoomsManager;
    this.gamesManager = gamesManager;
    this.onGameActiveChange = onGameActiveChange;
  }

  /**
   * Initialize with current room and user
   */
  initialize(roomId: string, userId: string): void {
    this.currentRoomId = roomId;
    this.currentUserId = userId;
  }

  /**
   * Check if game is currently active
   */
  getIsGameActive(): boolean {
    return this.isGameActive;
  }

  /**
   * Handle Start Game button click
   */
  async handleStartGame(currentSession: Session): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId || !currentSession) {
      return;
    }

    const result = await GameSelectionModal.show();
    if (!result) return;

    try {
      console.log('🎮 Starting game creation - lobby will open immediately');

      this.gamesManager.initialize(this.currentUserId);

      // Check for existing active game and cancel it
      const activeGameResult = await window.scribeCat.games.getActiveGameForRoom(this.currentRoomId);
      if (activeGameResult.success && activeGameResult.gameSession) {
        console.log('Cancelling existing active game:', activeGameResult.gameSession.id);
        await window.scribeCat.games.cancelGame(activeGameResult.gameSession.id);
      }

      // Create game session
      const gameSession = await this.gamesManager.createGame(
        this.currentRoomId,
        result.gameType,
        currentSession,
        {
          questionCount: result.questionCount,
          difficulty: result.difficulty,
        }
      );

      const gameParticipants = this.getGameParticipants();

      this.showGameContainer();

      const gameContainer = document.getElementById('multiplayer-game-container');
      if (gameContainer) {
        await this.gamesManager.joinGame(gameSession.id, gameContainer, gameParticipants);
      }

      window.addEventListener('multiplayer-game:closed', () => this.handleGameClosed(), { once: true });
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
   * Get game participants from room participants
   */
  private getGameParticipants(): any[] {
    if (!this.currentRoomId) return [];

    const participants = this.studyRoomsManager.getActiveParticipants(this.currentRoomId);
    const room = this.studyRoomsManager.getRoomById(this.currentRoomId);

    return participants.map((p) => ({
      userId: p.userId,
      userEmail: p.userEmail,
      userFullName: p.userFullName,
      userAvatarUrl: p.userAvatarUrl,
      isHost: p.userId === room?.hostId,
      isCurrentUser: p.userId === this.currentUserId,
    }));
  }

  /**
   * Show game container
   */
  showGameContainer(): void {
    this.isGameActive = true;
    this.stopGamePolling();
    this.onGameActiveChange(true);

    const gameContainer = document.getElementById('multiplayer-game-container');
    const gameBackdrop = document.getElementById('multiplayer-game-backdrop');

    gameBackdrop?.classList.add('active');
    gameContainer?.classList.add('active');
  }

  /**
   * Hide game container
   */
  hideGameContainer(): void {
    this.isGameActive = false;
    this.onGameActiveChange(false);

    const gameContainer = document.getElementById('multiplayer-game-container');
    const gameBackdrop = document.getElementById('multiplayer-game-backdrop');

    gameBackdrop?.classList.remove('active');
    gameContainer?.classList.remove('active');

    if (gameContainer) {
      gameContainer.innerHTML = '';
    }
  }

  /**
   * Handle game closed event
   */
  async handleGameClosed(): Promise<void> {
    this.hideGameContainer();
    await this.gamesManager.cleanup();

    // Restart polling for non-hosts
    const room = this.studyRoomsManager.getRoomById(this.currentRoomId!);
    const isHost = room?.hostId === this.currentUserId;

    if (!isHost && this.currentRoomId) {
      console.log('[StudyRoomGameIntegration] Restarting game polling after game closed');
      this.startGamePolling();
    }
  }

  /**
   * Check for active games when entering a room
   */
  async checkForActiveGame(): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId) return;

    const room = this.studyRoomsManager.getRoomById(this.currentRoomId);
    const isHost = room?.hostId === this.currentUserId;

    if (isHost) {
      console.log('[StudyRoomGameIntegration] Skipping active game check - current user is host');
      return;
    }

    try {
      const activeGameResult = await window.scribeCat.games.getActiveGameForRoom(this.currentRoomId);

      if (activeGameResult.success && activeGameResult.gameSession) {
        const gameSession = activeGameResult.gameSession;
        console.log('[StudyRoomGameIntegration] Found active game:', gameSession.id, 'status:', gameSession.status);

        if (gameSession.status === 'in_progress' || gameSession.status === 'waiting') {
          await this.joinExistingGame(gameSession);
        }
      }
    } catch (error) {
      console.error('[StudyRoomGameIntegration] Failed to check for active game:', error);
    }
  }

  /**
   * Subscribe to room game changes
   */
  subscribeToRoomGames(): void {
    if (!this.currentRoomId) return;

    this.cleanupRoomGameChannel();

    const rendererClient = RendererSupabaseClient.getInstance();
    const client = rendererClient.getClient();

    if (!client) {
      console.error('[StudyRoomGameIntegration] No Supabase client available');
      return;
    }

    console.log(`[StudyRoomGameIntegration] Setting up room games subscription for room: ${this.currentRoomId}`);

    const channelName = `room-games:${this.currentRoomId}`;
    this.roomGameChannel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `room_id=eq.${this.currentRoomId}`,
        },
        async (payload) => {
          const gameSessionData = payload.new as any;
          console.log('[StudyRoomGameIntegration] Room game update:', gameSessionData?.id, 'status:', gameSessionData?.status);

          const room = this.studyRoomsManager.getRoomById(this.currentRoomId!);
          const isHost = room?.hostId === this.currentUserId;

          if (isHost) {
            console.log('[StudyRoomGameIntegration] Ignoring update - current user is host');
            return;
          }

          if (gameSessionData && !this.isGameActive) {
            if (gameSessionData.status === 'in_progress' || gameSessionData.status === 'waiting') {
              await this.joinExistingGame(gameSessionData);
            }
          }

          if (gameSessionData && gameSessionData.status === 'completed') {
            this.hideGameContainer();
          }
        }
      )
      .subscribe((status, err) => {
        console.log(`[StudyRoomGameIntegration] Room games subscription status: ${status}`);
        if (err) {
          console.error('[StudyRoomGameIntegration] Subscription error:', err);
        }
      });
  }

  /**
   * Cleanup room game realtime channel
   */
  cleanupRoomGameChannel(): void {
    if (this.roomGameChannel) {
      console.log('[StudyRoomGameIntegration] Cleaning up room game channel');
      const rendererClient = RendererSupabaseClient.getInstance();
      const client = rendererClient.getClient();
      this.roomGameChannel.unsubscribe();
      if (client) client.removeChannel(this.roomGameChannel);
      this.roomGameChannel = null;
    }
  }

  /**
   * Start polling for active games as fallback
   */
  startGamePolling(): void {
    if (this.gamePollingInterval !== null) return;

    const room = this.studyRoomsManager.getRoomById(this.currentRoomId!);
    const isHost = room?.hostId === this.currentUserId;

    if (isHost) {
      console.log('[StudyRoomGameIntegration] Skipping game polling - current user is host');
      return;
    }

    console.log('[StudyRoomGameIntegration] Starting game polling as fallback');
    this.gamePollingInterval = window.setInterval(async () => {
      if (this.isGameActive || !this.currentRoomId) {
        this.stopGamePolling();
        return;
      }

      await this.checkForActiveGame();
    }, StudyRoomGameIntegration.GAME_POLLING_INTERVAL_MS);
  }

  /**
   * Stop polling for active games
   */
  stopGamePolling(): void {
    if (this.gamePollingInterval !== null) {
      clearInterval(this.gamePollingInterval);
      this.gamePollingInterval = null;
      console.log('[StudyRoomGameIntegration] Stopped game polling');
    }
  }

  /**
   * Join an existing game session
   */
  private async joinExistingGame(gameSessionData: any): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId || this.isGameActive) return;

    try {
      console.log('[StudyRoomGameIntegration] Joining existing game:', gameSessionData.id);

      this.gamesManager.initialize(this.currentUserId);

      const gameParticipants = this.getGameParticipants();

      this.showGameContainer();

      const gameContainer = document.getElementById('multiplayer-game-container');
      if (gameContainer) {
        await this.gamesManager.joinGame(gameSessionData.id, gameContainer, gameParticipants);
      }

      window.addEventListener('multiplayer-game:closed', () => this.handleGameClosed(), { once: true });
    } catch (error) {
      console.error('[StudyRoomGameIntegration] Failed to join existing game:', error);
      this.hideGameContainer();
    }
  }

  /**
   * Cleanup all game-related resources
   */
  cleanup(): void {
    this.cleanupRoomGameChannel();
    this.stopGamePolling();
    this.currentRoomId = null;
    this.currentUserId = null;
  }
}
