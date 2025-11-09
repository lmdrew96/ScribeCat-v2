/**
 * SingleSessionRenderer
 *
 * Renders the detailed view for a single session
 */

import { Session } from '../../../../domain/entities/Session.js';
import { formatDuration, escapeHtml, formatCourseTitle } from '../../../utils/formatting.js';
import { TranscriptionRenderer } from './TranscriptionRenderer.js';

export class SingleSessionRenderer {
  /**
   * Render single session detail view
   */
  static render(
    session: Session,
    isEditable: boolean,
    currentSearchQuery: string,
    currentMatchIndex: number,
    totalMatches: number
  ): string {
    console.log('🔍 SingleSessionRenderer.render - Session data:', {
      id: session.id,
      title: session.title,
      hasTranscription: !!session.transcription,
      transcription: session.transcription,
      transcriptionType: typeof session.transcription,
      transcriptionKeys: session.transcription ? Object.keys(session.transcription) : []
    });

    const date = new Date(session.createdAt);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    const duration = formatDuration(session.duration);

    // Get course information from dedicated fields first, fall back to tags
    let courseTagsHtml = '';
    if (session.courseTitle && session.courseTitle.trim()) {
      const fullTitle = session.courseTitle.trim();
      const displayTitle = formatCourseTitle(fullTitle);
      courseTagsHtml = `<span class="course-badge" data-tooltip="${escapeHtml(fullTitle)}"><span class="course-badge-text">${escapeHtml(displayTitle)}</span></span>`;
    } else {
      // Fall back to tag-based search if dedicated fields are empty
      const courseTags = session.tags?.filter(tag =>
        tag.includes('course') || tag.includes('class')
      ) || [];
      courseTagsHtml = courseTags.length > 0
        ? courseTags.map(tag => {
            const fullTitle = tag.trim();
            const displayTitle = formatCourseTitle(fullTitle);
            return `<span class="course-badge" data-tooltip="${escapeHtml(fullTitle)}"><span class="course-badge-text">${escapeHtml(displayTitle)}</span></span>`;
          }).join('')
        : '';
    }

    const transcriptionHtml = session.transcription
      ? TranscriptionRenderer.renderTranscriptionWithSearch(
          session.transcription,
          currentSearchQuery,
          currentMatchIndex,
          totalMatches
        )
      : '<div class="empty-content">No transcription available for this session.</div>';

    return `
      <div class="session-detail-container">
        <!-- Back Button -->
        <button class="back-to-list-btn secondary-btn">
          ← Back to Sessions
        </button>

        <!-- Session Header -->
        <div class="session-detail-header">
          <div class="session-detail-title-row">
            <h2 class="session-detail-title" data-session-id="${session.id}">${escapeHtml(session.title)}</h2>
            ${isEditable ? `<button class="edit-title-btn-detail" data-session-id="${session.id}" title="Edit title">✏️</button>` : ''}
            <div class="course-badge-container">
              ${courseTagsHtml || '<span class="course-badge no-course">No Course</span>'}
              ${isEditable ? `<button class="edit-course-btn-detail" data-session-id="${session.id}" title="Edit course">✏️</button>` : ''}
            </div>
          </div>
          <div class="session-detail-meta">
            <span>📅 ${formattedDate} at ${formattedTime}</span>
            <span>⏱️ ${duration}</span>
          </div>
          ${isEditable ? `
          <div class="session-detail-actions">
            <button class="session-action-btn share-session-btn" data-session-id="${session.id}" title="Share this session">
              <span class="action-icon">👥</span>
              <span class="action-label">Share</span>
            </button>
            <div id="collaborators-panel-container"></div>
          </div>
          ` : ''}
        </div>

        <!-- Two Column Layout -->
        <div class="session-detail-content">
          <!-- Left Column: Recording & Transcription -->
          <div class="session-detail-left">
            <!-- Audio Player -->
            <div class="audio-player-container">
              <h3>🎧 Recording</h3>
              <div class="audio-player">
                <audio id="session-audio" preload="metadata" style="display: none;" data-recording-path="${session.recordingPath}">
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

            <!-- Content Tabs -->
            <div class="session-content-tabs">
              <button class="content-tab active" data-tab="transcription">📝 Transcription</button>
              <button class="content-tab" data-tab="notes">✍️ Notes</button>
            </div>

            <!-- Transcription Content -->
            <div class="session-content-panel active" data-panel="transcription">
              <div class="content-panel-inner">
                ${transcriptionHtml}
              </div>
            </div>

            <!-- Notes Content (managed by StudyModeNotesEditorManager) -->
            <div class="session-content-panel" data-panel="notes">
              ${isEditable ? `
              <div class="notes-edit-controls">
                <button class="edit-notes-btn secondary-btn" data-session-id="${session.id}">
                  ✏️ Edit Notes
                </button>
                <div class="notes-edit-actions hidden">
                  <button class="save-notes-btn primary-btn" data-session-id="${session.id}">
                    💾 Save
                  </button>
                  <button class="cancel-edit-notes-btn secondary-btn" data-session-id="${session.id}">
                    ✖️ Cancel
                  </button>
                </div>
              </div>
              ` : ''}
              <div class="content-panel-inner notes-view-content">
                ${session.notes
                  ? session.notes
                  : '<div class="empty-content">No notes available for this session.</div>'
                }
              </div>
              <div class="content-panel-inner notes-edit-content hidden">
                <!-- Notes editor will be injected here by StudyModeNotesEditorManager -->
              </div>
            </div>
          </div>

          <!-- Right Column: AI Study Tools (managed by StudyModeAIToolsManager) -->
          <div class="session-detail-right">
            <div class="ai-study-tools">
              <h3 class="study-tools-title">🤖 AI Study Tools</h3>

              <!-- AI Study Tools Grid (3x3) -->
              <div class="study-tool-section">
                <h4>AI Study Tools</h4>
                <div class="study-tool-buttons">
                  <!-- Row 1: Content Analysis -->
                  <button class="study-tool-btn" id="generate-summary-btn" data-session-id="${session.id}">
                    <span class="tool-icon">📝</span>
                    <span class="tool-label">Summary</span>
                  </button>
                  <button class="study-tool-btn" id="extract-concepts-btn" data-session-id="${session.id}">
                    <span class="tool-icon">💡</span>
                    <span class="tool-label">Key Concepts</span>
                  </button>
                  <button class="study-tool-btn" id="weak-spots-btn" data-session-id="${session.id}">
                    <span class="tool-icon">🎯</span>
                    <span class="tool-label">Weak Spots</span>
                  </button>

                  <!-- Row 2: Active Learning -->
                  <button class="study-tool-btn" id="generate-flashcards-btn" data-session-id="${session.id}">
                    <span class="tool-icon">🎴</span>
                    <span class="tool-label">Flashcards</span>
                  </button>
                  <button class="study-tool-btn" id="generate-quiz-btn" data-session-id="${session.id}">
                    <span class="tool-icon">❓</span>
                    <span class="tool-label">Quiz</span>
                  </button>
                  <button class="study-tool-btn" id="learn-mode-btn" data-session-id="${session.id}">
                    <span class="tool-icon">📚</span>
                    <span class="tool-label">Learn Mode</span>
                  </button>

                  <!-- Row 3: Advanced Tools -->
                  <button class="study-tool-btn" id="eli5-explainer-btn" data-session-id="${session.id}">
                    <span class="tool-icon">👶</span>
                    <span class="tool-label">ELI5 Explainer</span>
                  </button>
                  <button class="study-tool-btn" id="concept-map-btn" data-session-id="${session.id}">
                    <span class="tool-icon">🗺️</span>
                    <span class="tool-label">Concept Map</span>
                  </button>
                  <button class="study-tool-btn" id="study-plan-btn" data-session-id="${session.id}">
                    <span class="tool-icon">📅</span>
                    <span class="tool-label">Study Plan</span>
                  </button>
                </div>
              </div>

              <!-- Study Content Area -->
              <div class="study-content-area" id="study-content-area">
                <div class="study-placeholder">
                  <div class="placeholder-icon">🎓</div>
                  <p>Select a study tool above to get started</p>
                  <p class="placeholder-hint">AI-powered tools help you learn and retain information better</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="session-detail-actions">
          <button class="action-btn share-session-detail-btn" data-session-id="${session.id}">
            👥 Share Session
          </button>
          <button class="action-btn export-session-detail-btn" data-session-id="${session.id}">
            📤 Export Session
          </button>
          <button class="action-btn delete-session-detail-btn" data-session-id="${session.id}">
            🗑️ Delete Session
          </button>
        </div>
      </div>
    `;
  }
}
