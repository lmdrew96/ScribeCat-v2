/**
 * MultiSessionRenderer
 *
 * Renders the detailed view for multi-session study sets
 */

import { Session } from '../../../../domain/entities/Session.js';
import { formatDuration, escapeHtml } from '../../../utils/formatting.js';
import { TranscriptionRenderer } from './TranscriptionRenderer.js';

export class MultiSessionRenderer {
  /**
   * Render multi-session study set with tabs
   */
  static render(session: Session, childSessions: Session[], activeTabIndex: number): string {
    const date = new Date(session.createdAt);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Render tabs and current session
    const tabsHtml = this.renderTabs(childSessions, activeTabIndex);
    const activeSession = childSessions[activeTabIndex];

    return `
      <div class="session-detail-container multi-session">
        <!-- Back Button -->
        <button class="back-to-list-btn secondary-btn">
          ← Back to Sessions
        </button>

        <!-- Multi-Session Header -->
        <div class="session-detail-header">
          <div class="session-detail-title-row">
            <span class="multi-session-badge">📚 Study Set</span>
            <h2 class="session-detail-title">${escapeHtml(session.title)}</h2>
          </div>
          <div class="session-detail-meta">
            <span>📅 Created ${formattedDate}</span>
            <span>📑 ${childSessions.length} Sessions</span>
          </div>
          <div class="session-detail-actions">
            <button class="session-action-btn delete-session-detail-btn" data-session-id="${session.id}" title="Delete this study set">
              <span class="action-icon">🗑️</span>
              <span class="action-label">Delete</span>
            </button>
            <div id="collaborators-panel-container"></div>
          </div>
        </div>

        <!-- Two-column layout -->
        <div class="session-detail-columns">
          <!-- Left Column: Session Content -->
          <div class="session-detail-left">
            <!-- Session Tabs -->
            <div class="session-tabs-container">
              ${tabsHtml}
            </div>

            <!-- Active Session Content -->
            <div class="session-tab-content" id="session-tab-content">
              ${this.renderTabContent(activeSession)}
            </div>
          </div>

          <!-- Right Column: AI Study Tools -->
          <div class="session-detail-right">
            <div class="ai-study-tools">
              <h3 class="study-tools-title">🤖 AI Study Tools</h3>

              <!-- AI Study Tools Grid (3x3) -->
              <div class="study-tool-section">
                <h4>AI Study Tools</h4>
                <div class="study-tool-buttons">
                  <!-- Row 1: Content Analysis -->
                  <button class="study-tool-btn" id="generate-summary-btn">
                    <span class="tool-icon">📝</span>
                    <span class="tool-label">Summary</span>
                  </button>
                  <button class="study-tool-btn" id="extract-concepts-btn">
                    <span class="tool-icon">💡</span>
                    <span class="tool-label">Key Concepts</span>
                  </button>
                  <button class="study-tool-btn" id="weak-spots-btn">
                    <span class="tool-icon">🎯</span>
                    <span class="tool-label">Weak Spots</span>
                  </button>

                  <!-- Row 2: Active Learning -->
                  <button class="study-tool-btn" id="generate-flashcards-btn">
                    <span class="tool-icon">🎴</span>
                    <span class="tool-label">Flashcards</span>
                  </button>
                  <button class="study-tool-btn" id="generate-quiz-btn">
                    <span class="tool-icon">❓</span>
                    <span class="tool-label">Quiz</span>
                  </button>
                  <button class="study-tool-btn" id="learn-mode-btn">
                    <span class="tool-icon">📚</span>
                    <span class="tool-label">Learn Mode</span>
                  </button>

                  <!-- Row 3: Advanced Tools -->
                  <button class="study-tool-btn" id="eli5-explainer-btn">
                    <span class="tool-icon">👶</span>
                    <span class="tool-label">ELI5 Explainer</span>
                  </button>
                  <button class="study-tool-btn" id="concept-map-btn">
                    <span class="tool-icon">🗺️</span>
                    <span class="tool-label">Concept Map</span>
                  </button>
                  <button class="study-tool-btn" id="study-plan-btn">
                    <span class="tool-icon">📅</span>
                    <span class="tool-label">Study Plan</span>
                  </button>
                </div>
              </div>

              <!-- Content Area for AI Output -->
              <div class="study-content-area" id="study-content-area">
                <p class="study-tool-placeholder">Select an AI study tool above to get started.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Scroll to Top Button (shows when scrolled down) -->
        <button class="scroll-to-top-btn" id="scroll-to-top-btn" title="Return to top" style="display: none;">
          <span class="scroll-top-icon">↑</span>
        </button>
      </div>
    `;
  }

  /**
   * Render session tabs
   */
  static renderTabs(childSessions: Session[], activeTabIndex: number): string {
    return `
      <div class="session-tabs">
        ${childSessions.map((session, index) => `
          <button
            class="session-tab ${index === activeTabIndex ? 'active' : ''}"
            data-tab-index="${index}"
          >
            <span class="tab-number">${index + 1}</span>
            <span class="tab-title">${escapeHtml(session.title)}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render content for a single tab
   */
  static renderTabContent(session: Session): string {
    const date = new Date(session.createdAt);
    const formattedDate = date.toLocaleDateString();
    const formattedTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const duration = formatDuration(session.duration);

    return `
      <div class="tab-session-info">
        <h3>${escapeHtml(session.title)}</h3>
        <div class="session-meta">
          <span>📅 ${formattedDate} at ${formattedTime}</span>
          <span>⏱️ ${duration}</span>
        </div>
      </div>

      <!-- Audio Player -->
      <div class="audio-player-container">
        <h4>🎧 Recording</h4>
        <div class="audio-player">
          <audio id="session-audio" preload="metadata" style="display: none;" data-recording-path="${session.recordingPath}">
            Your browser does not support the audio element.
          </audio>
          <div class="custom-audio-controls">
            <button class="audio-control-btn play-pause-btn" id="play-pause-btn" title="Play/Pause">
              <span class="play-icon">▶</span>
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
              <span class="volume-icon">🔊</span>
            </button>
          </div>
          <div class="playback-controls">
            <label>Playback Speed:</label>
            <button class="speed-btn" data-speed="0.5">0.5x</button>
            <button class="speed-btn" data-speed="0.75">0.75x</button>
            <button class="speed-btn active" data-speed="1">1x</button>
            <button class="speed-btn" data-speed="1.25">1.25x</button>
            <button class="speed-btn" data-speed="1.5">1.5x</button>
            <button class="speed-btn" data-speed="2">2x</button>
          </div>
        </div>
      </div>

      <!-- Sub-tabs for Transcription and Notes -->
      <div class="session-content-tabs">
        <div class="content-tab-buttons">
          <button class="content-tab-btn active" data-content-tab="transcription">📝 Transcription</button>
          <button class="content-tab-btn" data-content-tab="notes">📓 Notes</button>
        </div>

        <!-- Transcription Tab Content -->
        <div class="content-tab-panel active" data-panel="transcription">
          <div class="transcription-content">
            ${TranscriptionRenderer.renderTranscription(session.transcription)}
          </div>
        </div>

        <!-- Notes Tab Content -->
        <div class="content-tab-panel" data-panel="notes">
          <div class="notes-view-content" id="notes-content">
            ${session.notes || '<p class="no-notes">No notes for this session.</p>'}
          </div>
        </div>
      </div>
    `;
  }
}
