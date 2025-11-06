/**
 * StudyModeDetailViewManager
 *
 * Handles session detail view rendering, audio playback, and transcription display.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { SessionPlaybackManager } from '../../services/SessionPlaybackManager.js';
import { createLogger } from '../../../shared/logger.js';
import { formatDuration, formatTimestamp, escapeHtml, formatCourseTitle } from '../../utils/formatting.js';

const logger = createLogger('StudyModeDetailViewManager');

export class StudyModeDetailViewManager {
  private sessionDetailContainer: HTMLElement;
  private sessionPlaybackManager: SessionPlaybackManager;
  private currentSession: Session | null = null;

  constructor(
    sessionDetailContainer: HTMLElement,
    sessionPlaybackManager: SessionPlaybackManager
  ) {
    this.sessionDetailContainer = sessionDetailContainer;
    this.sessionPlaybackManager = sessionPlaybackManager;
  }

  /**
   * Render session detail view
   */
  render(session: Session, isEditable: boolean = true): void {
    this.currentSession = session;
    console.log('🔍 StudyModeDetailViewManager.render - Session data:', {
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

    const detailHtml = `
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
        </div>

        <!-- Two Column Layout -->
        <div class="session-detail-content">
          <!-- Left Column: Recording & Transcription -->
          <div class="session-detail-left">
            <!-- Audio Player -->
            <div class="audio-player-container">
              <h3>🎧 Recording</h3>
              <div class="audio-player">
                <audio id="session-audio" preload="metadata" style="display: none;">
                  <source src="file://${session.recordingPath}" type="audio/webm">
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
                ${session.transcription
                  ? this.renderTranscriptionSegments(session.transcription)
                  : '<div class="empty-content">No transcription available for this session.</div>'
                }
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

              <!-- Quick Actions -->
              <div class="study-tool-section">
                <h4>Quick Actions</h4>
                <div class="study-tool-buttons">
                  <button class="study-tool-btn" id="generate-summary-btn" data-session-id="${session.id}">
                    <span class="tool-icon">📝</span>
                    <span class="tool-label">Generate Summary</span>
                  </button>
                  <button class="study-tool-btn" id="extract-concepts-btn" data-session-id="${session.id}">
                    <span class="tool-icon">💡</span>
                    <span class="tool-label">Key Concepts</span>
                  </button>
                  <button class="study-tool-btn" id="generate-flashcards-btn" data-session-id="${session.id}">
                    <span class="tool-icon">🎴</span>
                    <span class="tool-label">Create Flashcards</span>
                  </button>
                  <button class="study-tool-btn" id="generate-quiz-btn" data-session-id="${session.id}">
                    <span class="tool-icon">❓</span>
                    <span class="tool-label">Generate Quiz</span>
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

    this.sessionDetailContainer.innerHTML = detailHtml;

    // Attach event handlers
    this.attachEventHandlers(session);

    logger.info(`Rendered detail view for session: ${session.id}`);
  }

  /**
   * Attach event handlers for detail view
   */
  private attachEventHandlers(session: Session): void {
    // Back button
    const backBtn = document.querySelector('.back-to-list-btn');
    backBtn?.addEventListener('click', () => {
      this.sessionDetailContainer.dispatchEvent(new CustomEvent('backToList'));
    });

    // Audio player setup
    const audioElement = document.getElementById('session-audio') as HTMLAudioElement;

    if (audioElement) {
      // Initialize custom audio controls with the session duration
      this.sessionPlaybackManager.initialize(
        audioElement,
        session.duration,
        () => !this.sessionDetailContainer.classList.contains('hidden')
      );

      // Audio player speed controls
      const speedButtons = document.querySelectorAll('.speed-btn');

      speedButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const speed = parseFloat((btn as HTMLElement).dataset.speed || '1');
          if (audioElement) {
            audioElement.playbackRate = speed;
          }

          // Update active state
          speedButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    }

    // Content tabs
    const tabs = document.querySelectorAll('.content-tab');
    const panels = document.querySelectorAll('.session-content-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.tab;

        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update active panel
        panels.forEach(p => {
          const panel = p as HTMLElement;
          if (panel.dataset.panel === tabName) {
            panel.classList.add('active');
          } else {
            panel.classList.remove('active');
          }
        });
      });
    });

    // Share button
    const shareBtn = document.querySelector('.share-session-detail-btn');
    shareBtn?.addEventListener('click', () => {
      this.sessionDetailContainer.dispatchEvent(new CustomEvent('shareSession', { detail: { sessionId: session.id } }));
    });

    // Export button
    const exportBtn = document.querySelector('.export-session-detail-btn');
    exportBtn?.addEventListener('click', () => {
      this.sessionDetailContainer.dispatchEvent(new CustomEvent('exportSession', { detail: { sessionId: session.id } }));
    });

    // Delete button
    const deleteBtn = document.querySelector('.delete-session-detail-btn');
    deleteBtn?.addEventListener('click', () => {
      this.sessionDetailContainer.dispatchEvent(new CustomEvent('deleteSession', { detail: { sessionId: session.id } }));
    });

    // Timestamp click handlers - seek audio to segment time
    const segments = document.querySelectorAll('.transcription-segment');
    segments.forEach(segment => {
      segment.addEventListener('click', () => {
        const startTime = parseFloat((segment as HTMLElement).dataset.startTime || '0');
        if (audioElement && !isNaN(startTime)) {
          audioElement.currentTime = startTime;
          // Auto-play if not already playing
          if (audioElement.paused) {
            audioElement.play().catch(err => logger.error('Playback failed:', err));
          }
        }
      });
    });

    // Title edit handler
    const editTitleBtn = document.querySelector('.edit-title-btn-detail');
    editTitleBtn?.addEventListener('click', () => {
      this.sessionDetailContainer.dispatchEvent(new CustomEvent('startTitleEdit', { detail: { sessionId: session.id } }));
    });

    // Course edit handler
    const editCourseBtn = document.querySelector('.edit-course-btn-detail');
    editCourseBtn?.addEventListener('click', () => {
      this.sessionDetailContainer.dispatchEvent(new CustomEvent('startCourseEdit', { detail: { sessionId: session.id } }));
    });

    // Notes editing handlers
    const editNotesBtn = document.querySelector('.edit-notes-btn');
    editNotesBtn?.addEventListener('click', (e) => {
      const sessionId = (e.target as HTMLElement).dataset.sessionId;
      if (sessionId) {
        this.sessionDetailContainer.dispatchEvent(new CustomEvent('startNotesEdit', {
          detail: { sessionId }
        }));
      }
    });

    const saveNotesBtn = document.querySelector('.save-notes-btn');
    saveNotesBtn?.addEventListener('click', (e) => {
      const sessionId = (e.target as HTMLElement).dataset.sessionId;
      if (sessionId) {
        this.sessionDetailContainer.dispatchEvent(new CustomEvent('saveNotesEdit', {
          detail: { sessionId }
        }));
      }
    });

    const cancelEditNotesBtn = document.querySelector('.cancel-edit-notes-btn');
    cancelEditNotesBtn?.addEventListener('click', () => {
      this.sessionDetailContainer.dispatchEvent(new CustomEvent('cancelNotesEdit'));
    });
  }

  /**
   * Render transcription segments with clickable timestamps
   */
  private renderTranscriptionSegments(transcription: any): string {
    // If no segments, fall back to full text
    if (!transcription.segments || transcription.segments.length === 0) {
      return `<div class="transcription-text">${escapeHtml(transcription.fullText)}</div>`;
    }

    console.log('📝 Rendering transcription segments:', {
      segmentCount: transcription.segments.length,
      firstSegment: transcription.segments[0],
      sampleSegments: transcription.segments.slice(0, 3).map((s: any) => ({
        startTime: s.startTime,
        endTime: s.endTime,
        text: s.text.substring(0, 30)
      }))
    });

    // Render each segment with timestamp
    const segmentsHtml = transcription.segments.map((segment: any, index: number) => {
      const timestamp = formatTimestamp(segment.startTime);
      return `
        <div class="transcription-segment" data-start-time="${segment.startTime}" data-end-time="${segment.endTime}" data-segment-index="${index}">
          <span class="segment-timestamp">[${timestamp}]</span>
          <span class="segment-text">${escapeHtml(segment.text)}</span>
        </div>
      `;
    }).join('');

    return `<div class="transcription-segments">${segmentsHtml}</div>`;
  }

  /**
   * Format timestamp from seconds to MM:SS format
   */




  /**
   * Show detail view
   */
  show(): void {
    this.sessionDetailContainer.classList.remove('hidden');
  }

  /**
   * Hide detail view
   */
  hide(): void {
    this.sessionDetailContainer.classList.add('hidden');
  }

  /**
   * Get current session
   */
  getCurrentSession(): Session | null {
    return this.currentSession;
  }
}
