/**
 * MultiplayerGame (Abstract Base Class)
 *
 * Base class for all multiplayer game components.
 * Provides common functionality for game initialization, state management, and rendering.
 */

import { GameSession } from '../../../domain/entities/GameSession.js';
import { GameQuestion } from '../../../domain/entities/GameQuestion.js';
import { PlayerScore, LeaderboardEntry } from '../../../domain/entities/PlayerScore.js';

export interface GameParticipant {
  userId: string;
  userEmail: string;
  userFullName?: string;
  userAvatarUrl?: string;
  isHost: boolean;
  isCurrentUser: boolean;
}

export interface GameState {
  session: GameSession;
  currentQuestion: GameQuestion | null;
  participants: GameParticipant[];
  scores: PlayerScore[];
  leaderboard: LeaderboardEntry[];
  currentUserId: string;
  hasAnswered: boolean;
  gameStarted: boolean;
  gameEnded: boolean;
  questionStartedAt?: number; // Timestamp when current question started (for late joiner sync)
}

/**
 * Abstract base class for multiplayer games
 */
export abstract class MultiplayerGame {
  protected container: HTMLElement;
  protected state: GameState;
  protected unsubscribers: Array<() => Promise<void>> = [];

  constructor(container: HTMLElement, initialState: GameState) {
    this.container = container;
    this.state = initialState;
  }

  /**
   * Initialize the game (called once when game is created)
   */
  public async initialize(): Promise<void> {
    this.render();
  }

  /**
   * Update game state
   */
  public updateState(updates: Partial<GameState>): void {
    this.state = {
      ...this.state,
      ...updates,
    };
    this.render();
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    // Unsubscribe from all real-time subscriptions
    for (const unsubscribe of this.unsubscribers) {
      await unsubscribe();
    }
    this.unsubscribers = [];

    // Clear container
    this.container.innerHTML = '';
  }

  // ============================================================================
  // Abstract methods (must be implemented by subclasses)
  // ============================================================================

  /**
   * Render the game UI
   */
  protected abstract render(): void;

  /**
   * Handle player answer submission
   */
  protected abstract handleAnswer(answer: string): Promise<void>;

  /**
   * Get game-specific instructions
   */
  protected abstract getInstructions(): string;

  // ============================================================================
  // Common UI Components
  // ============================================================================

  /**
   * Render game header with title, status, and score
   */
  protected renderHeader(): string {
    const { session, currentUserId, leaderboard } = this.state;
    const currentUserEntry = leaderboard.find((e) => e.userId === currentUserId);
    const currentUserScore = currentUserEntry?.totalScore || 0;

    return `
      <div class="multiplayer-game-header">
        <div class="game-title">
          <span class="game-icon">${this.getGameIcon()}</span>
          <h3>${session.getGameTypeName()}</h3>
          <span class="game-status ${session.status}">${session.getStatusText()}</span>
        </div>
        <div class="game-header-actions">
          <div class="game-score">
            <span class="score-label">Your Score:</span>
            <span class="score-value">${currentUserScore}</span>
          </div>
          ${this.renderExitButton()}
        </div>
      </div>
    `;
  }

  /**
   * Render exit button (for mid-game exit)
   */
  protected renderExitButton(): string {
    return `
      <button class="btn-exit exit-game-btn" id="exit-game-btn" title="Exit Game">
        ✕
      </button>
    `;
  }

  /**
   * Render game progress bar
   */
  protected renderProgress(): string {
    const { session } = this.state;
    const progress = session.getProgressPercentage();
    const current = session.currentQuestionIndex + 1;
    const total = session.getTotalQuestions();

    return `
      <div class="game-progress-container">
        <div class="game-progress-info">
          <span>Question ${current} of ${total}</span>
          <span>${progress}%</span>
        </div>
        <div class="game-progress-bar">
          <div class="game-progress-fill" style="width: ${progress}%"></div>
        </div>
      </div>
    `;
  }

  /**
   * Render leaderboard
   */
  protected renderLeaderboard(): string {
    const { leaderboard, currentUserId } = this.state;

    if (leaderboard.length === 0) {
      return '<div class="game-leaderboard-empty">No scores yet</div>';
    }

    const leaderboardItems = leaderboard
      .map((entry, index) => {
        const isCurrentUser = entry.userId === currentUserId;
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';

        return `
        <div class="leaderboard-item ${isCurrentUser ? 'current-user' : ''}">
          <span class="leaderboard-rank">${medal || `#${rank}`}</span>
          <span class="leaderboard-name">
            ${entry.userFullName || entry.userEmail?.split('@')[0] || 'Player'}
            ${isCurrentUser ? ' (You)' : ''}
          </span>
          <span class="leaderboard-stats">
            <span class="leaderboard-score">${entry.totalScore} pts</span>
            <span class="leaderboard-accuracy">${entry.correctAnswers}/${entry.totalAnswers}</span>
          </span>
        </div>
      `;
      })
      .join('');

    return `
      <div class="game-leaderboard">
        <h4>Leaderboard</h4>
        <div class="leaderboard-list">
          ${leaderboardItems}
        </div>
      </div>
    `;
  }

  /**
   * Render waiting screen (before game starts)
   */
  protected renderWaitingScreen(): string {
    const { participants, session } = this.state;
    const isHost = this.isCurrentUserHost();

    const participantsList = participants
      .map(
        (p) => `
        <div class="waiting-participant">
          <div class="participant-avatar">
            ${p.userAvatarUrl ? `<img src="${p.userAvatarUrl}" alt="${p.userFullName || p.userEmail}">` : this.getInitials(p)}
          </div>
          <div class="participant-name">
            ${p.userFullName || p.userEmail.split('@')[0]}
            ${p.isHost ? '<span class="host-badge">Host</span>' : ''}
            ${p.isCurrentUser ? ' (You)' : ''}
          </div>
        </div>
      `
      )
      .join('');

    return `
      <div class="game-waiting-screen">
        <div class="waiting-header">
          <div class="waiting-header-content">
            <div class="waiting-icon">⏳</div>
            <div>
              <h3>Waiting for game to start...</h3>
              <p class="waiting-subtitle">${this.getInstructions()}</p>
            </div>
          </div>
          ${this.renderExitButton()}
        </div>

        <div class="waiting-participants">
          <h4>Players (${participants.length})</h4>
          <div class="participants-grid">
            ${participantsList}
          </div>
        </div>

        ${
          isHost
            ? `
          <button class="btn-primary start-game-btn" id="start-game-btn">
            Start Game
          </button>
        `
            : '<p class="waiting-message">Waiting for host to start the game...</p>'
        }
      </div>
    `;
  }

  /**
   * Render game complete screen
   */
  protected renderGameComplete(): string {
    const { leaderboard, currentUserId } = this.state;
    const currentUserEntry = leaderboard.find((e) => e.userId === currentUserId);
    const rank = currentUserEntry?.rank || 0;
    const totalScore = currentUserEntry?.totalScore || 0;

    let message = '';
    let icon = '';

    if (rank === 1) {
      message = 'You won! Excellent work!';
      icon = '🏆';
    } else if (rank === 2) {
      message = '2nd place! Great job!';
      icon = '🥈';
    } else if (rank === 3) {
      message = '3rd place! Well done!';
      icon = '🥉';
    } else {
      message = 'Thanks for playing!';
      icon = '🎮';
    }

    return `
      <div class="game-complete-screen">
        <div class="complete-icon">${icon}</div>
        <h2>Game Complete!</h2>
        <p class="complete-message">${message}</p>
        <div class="complete-stats">
          <div class="stat-item">
            <span class="stat-label">Final Score</span>
            <span class="stat-value">${totalScore}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Rank</span>
            <span class="stat-value">#${rank}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Correct Answers</span>
            <span class="stat-value">${currentUserEntry?.correctAnswers || 0}/${currentUserEntry?.totalAnswers || 0}</span>
          </div>
        </div>

        ${this.renderLeaderboard()}

        <button class="btn-secondary close-game-btn" id="close-game-btn">
          Close Game
        </button>
      </div>
    `;
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  /**
   * Check if current user is the host
   */
  protected isCurrentUserHost(): boolean {
    return this.state.participants.some((p) => p.isCurrentUser && p.isHost);
  }

  /**
   * Get user initials for avatar
   */
  protected getInitials(participant: GameParticipant): string {
    if (participant.userFullName) {
      const parts = participant.userFullName.split(' ');
      if (parts.length >= 2) {
        return parts[0][0] + parts[1][0];
      }
      return participant.userFullName.substring(0, 2).toUpperCase();
    }
    return participant.userEmail.substring(0, 2).toUpperCase();
  }

  /**
   * Get game icon emoji
   */
  protected getGameIcon(): string {
    const icons: Record<string, string> = {
      quiz_battle: '⚡',
      jeopardy: '🎯',
      bingo: '🎲',
      flashcards: '🃏',
    };
    return icons[this.state.session.gameType] || '🎮';
  }

  /**
   * Escape HTML to prevent XSS
   */
  protected escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format time in MM:SS format
   */
  protected formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
