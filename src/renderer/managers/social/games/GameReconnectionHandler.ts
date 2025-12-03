/**
 * GameReconnectionHandler
 *
 * Handles reconnection logic with exponential backoff and UI overlays.
 */

import { GameSession } from '../../../../domain/entities/GameSession.js';
import { GameQuestion } from '../../../../domain/entities/GameQuestion.js';
import { MultiplayerGame } from '../../../components/games/MultiplayerGame.js';

export class GameReconnectionHandler {
  private reconnectAttempts: number = 0;
  private reconnectTimeout: number | null = null;
  private isReconnecting: boolean = false;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  /**
   * Check for and reconnect to active games
   */
  async checkAndReconnectActiveGame(
    currentUserId: string | null,
    currentGame: MultiplayerGame | null
  ): Promise<void> {
    if (!currentUserId || currentGame) {
      return; // Already have a game or not initialized
    }

    // Query for active game sessions where user is a participant
    // This would require a new IPC method - for now, skip
    console.log('[GameReconnectionHandler] Checking for active games...');
  }

  /**
   * Attempt to reconnect to game after disconnection
   */
  async attemptReconnect(
    gameSessionId: string,
    subscribeToGameUpdates: (id: string) => void,
    refreshGameState: (id: string) => Promise<void>,
    container: HTMLElement | null
  ): Promise<void> {
    if (this.isReconnecting || this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('[GameReconnectionHandler] Max reconnection attempts reached');
      this.showConnectionError(container);
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);

    console.log(`[GameReconnectionHandler] Reconnecting in ${backoffMs}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);

    this.showReconnectingUI(container);

    this.reconnectTimeout = window.setTimeout(async () => {
      try {
        // Resubscribe to game updates
        subscribeToGameUpdates(gameSessionId);

        // Refresh game state
        await refreshGameState(gameSessionId);

        // Success!
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.hideReconnectingUI(container);
        console.log('[GameReconnectionHandler] Reconnected successfully');
      } catch (error) {
        console.error('[GameReconnectionHandler] Reconnection failed:', error);
        this.isReconnecting = false;
        // Try again
        await this.attemptReconnect(gameSessionId, subscribeToGameUpdates, refreshGameState, container);
      }
    }, backoffMs);
  }

  /**
   * Refresh game state from server
   */
  async refreshGameState(
    gameSessionId: string,
    currentGame: MultiplayerGame | null,
    setGameSession: (session: GameSession) => void
  ): Promise<void> {
    if (!currentGame) return;

    // Reload game session
    const sessionResult = await window.scribeCat.games.getGameSession(gameSessionId);
    let gameSession: GameSession | null = null;
    if (sessionResult.success && sessionResult.gameSession) {
      gameSession = GameSession.fromJSON(sessionResult.gameSession);
      setGameSession(gameSession);
    }

    // Reload current question
    const questionResult = await window.scribeCat.games.getCurrentQuestion(gameSessionId);
    const currentQuestion = questionResult.success && questionResult.question
      ? GameQuestion.fromJSON(questionResult.question)
      : null;

    // Reload leaderboard
    const leaderboardResult = await window.scribeCat.games.getGameLeaderboard(gameSessionId);
    const leaderboard = leaderboardResult.success ? leaderboardResult.leaderboard || [] : [];

    // Update game state
    currentGame.updateState({
      session: gameSession,
      currentQuestion,
      leaderboard,
      gameEnded: gameSession?.hasEnded() || false,
    });
  }

  /**
   * Show reconnecting UI overlay
   */
  showReconnectingUI(container: HTMLElement | null): void {
    if (!container) return;

    const existing = container.querySelector('.reconnecting-overlay');
    if (existing) return; // Already showing

    const overlay = document.createElement('div');
    overlay.className = 'reconnecting-overlay';
    overlay.innerHTML = `
      <div class="reconnecting-content">
        <div class="loading-spinner"></div>
        <h3>Reconnecting to game...</h3>
        <p>Attempt ${this.reconnectAttempts} of ${this.MAX_RECONNECT_ATTEMPTS}</p>
      </div>
    `;
    container.appendChild(overlay);
  }

  /**
   * Hide reconnecting UI overlay
   */
  hideReconnectingUI(container: HTMLElement | null): void {
    if (!container) return;

    const overlay = container.querySelector('.reconnecting-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * Show connection error UI
   */
  showConnectionError(container: HTMLElement | null, onClose?: () => void): void {
    if (!container) return;

    const overlay = document.createElement('div');
    overlay.className = 'connection-error-overlay';
    overlay.innerHTML = `
      <div class="error-content">
        <h3>Connection Lost</h3>
        <p>Unable to reconnect to the game. Please check your internet connection and refresh the page.</p>
        <button class="close-game-btn">Close Game</button>
      </div>
    `;

    const closeBtn = overlay.querySelector('.close-game-btn');
    closeBtn?.addEventListener('click', () => {
      if (onClose) onClose();
    });

    container.appendChild(overlay);
  }

  /**
   * Reset reconnection state
   */
  reset(): void {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
  }

  /**
   * Check if currently reconnecting
   */
  getIsReconnecting(): boolean {
    return this.isReconnecting;
  }
}
