/**
 * StudyRoomTemplate
 *
 * Generates the HTML template for the study room view.
 */

import { getIconHTML } from '../../utils/iconMap.js';

export class StudyRoomTemplate {
  /**
   * Generate the complete study room view HTML
   */
  static getHTML(): string {
    return `
      <div class="study-room-header">
        <button class="btn-icon back-btn" id="exit-room-btn" title="Exit Room">
          ${getIconHTML('arrowLeft', { size: 18 })}
        </button>
        <div class="room-title-info">
          <h2 id="room-title">Study Room</h2>
          <p id="room-subtitle">Loading...</p>
        </div>
        <div class="room-actions">
          <button class="btn-primary btn-sm" id="start-game-btn" style="display: none;">
            ${getIconHTML('gamepad', { size: 16 })} Start Game
          </button>
          <button class="btn-secondary btn-sm" id="invite-friends-btn">Invite Friends</button>
          <button class="btn-secondary btn-sm" id="room-settings-btn">Settings</button>
        </div>
      </div>

      <div class="study-room-main">
        <div class="study-room-chat" id="study-room-chat-container"></div>

        <div class="study-room-content">
          <div class="content-header"><h3>Shared Session</h3></div>

          ${StudyRoomTemplate.getSessionInfoBarHTML()}
          ${StudyRoomTemplate.getAudioPlayerHTML()}
          ${StudyRoomTemplate.getContentTabsHTML()}
        </div>

        ${StudyRoomTemplate.getSidebarHTML()}
      </div>
    `;
  }

  /**
   * Get session info bar HTML
   */
  private static getSessionInfoBarHTML(): string {
    return `
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
    `;
  }

  /**
   * Get audio player HTML
   */
  private static getAudioPlayerHTML(): string {
    return `
      <div class="audio-player-container" id="audio-player-container" style="display: none;">
        <div class="audio-player">
          <audio id="session-audio" preload="metadata" style="display: none;"></audio>
          <div class="custom-audio-controls">
            <button class="audio-control-btn play-pause-btn" id="play-pause-btn" title="Play/Pause">
              <span class="play-icon">${getIconHTML('play', { size: 16 })}</span>
            </button>
            <div class="audio-time-display">
              <span id="current-time">0:00</span>
              <span class="time-separator">/</span>
              <span id="total-duration">0:00</span>
            </div>
            <div class="audio-progress-container" id="audio-progress-container">
              <div class="audio-progress-bar">
                <div class="audio-progress-buffered" id="audio-progress-buffered"></div>
                <div class="audio-progress-played" id="audio-progress-played"></div>
                <div class="audio-progress-handle" id="audio-progress-handle"></div>
              </div>
            </div>
            <button class="audio-control-btn volume-btn" id="volume-btn" title="Mute/Unmute">
              <span class="volume-icon">${getIconHTML('volume', { size: 16 })}</span>
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
    `;
  }

  /**
   * Get content tabs HTML
   */
  private static getContentTabsHTML(): string {
    return `
      <div class="session-content-tabs">
        <button class="content-tab active" data-tab="notes">${getIconHTML('pencil', { size: 14 })} Notes</button>
        <button class="content-tab" data-tab="transcription">${getIconHTML('file', { size: 14 })} Transcription</button>
      </div>

      <div class="session-content-panel active" data-panel="notes">
        <div class="content-panel-inner" id="session-notes">
          <p class="empty-state">Loading session notes...</p>
        </div>
      </div>

      <div class="session-content-panel" data-panel="transcription">
        <div class="content-panel-inner" id="session-transcript">
          <p class="empty-state">Loading transcript...</p>
        </div>
      </div>
    `;
  }

  /**
   * Get sidebar HTML
   */
  private static getSidebarHTML(): string {
    return `
      <div class="study-room-sidebar">
        <div class="sidebar-header">
          <h3>Participants</h3>
          <span id="participants-count" class="count-badge">0</span>
        </div>
        <div id="participants-list" class="participants-list">
          <div class="loading">Loading participants...</div>
        </div>
      </div>
    `;
  }
}
