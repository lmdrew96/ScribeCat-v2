/**
 * StudyModeDetailViewManager
 *
 * Handles session detail view rendering, audio playback, and transcription display.
 */

import { Session } from '../../../domain/entities/Session.js';
import { SessionPlaybackManager } from '../../services/SessionPlaybackManager.js';
import { createLogger } from '../../../shared/logger.js';
import { formatDuration, formatTimestamp, escapeHtml, formatCourseTitle } from '../../utils/formatting.js';
import { SupabaseStorageService } from '../../../infrastructure/services/supabase/SupabaseStorageService.js';

const logger = createLogger('StudyModeDetailViewManager');

export class StudyModeDetailViewManager {
  private sessionDetailContainer: HTMLElement;
  private sessionPlaybackManager: SessionPlaybackManager;
  private currentSession: Session | null = null;
  private childSessions: Session[] = [];
  private activeTabIndex: number = 0;
  private currentSearchQuery: string = '';
  private currentMatchIndex: number = 0;
  private totalMatches: number = 0;

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
  async render(session: Session, isEditable: boolean = true): Promise<void> {
    this.currentSession = session;

    // Debug logging
    console.log('🔍 StudyModeDetailViewManager.render - Checking session type:', {
      sessionId: session.id,
      sessionTitle: session.title,
      sessionType: session.type,
      hasIsMultiSessionMethod: typeof session.isMultiSessionStudySet,
      isMultiSession: session.isMultiSessionStudySet ? session.isMultiSessionStudySet() : false,
      childSessionIds: session.getChildSessionIds ? session.getChildSessionIds() : 'no method'
    });

    // Check if this is a multi-session study set
    if (session.isMultiSessionStudySet && session.isMultiSessionStudySet()) {
      console.log('✅ Rendering as multi-session study set');
      await this.renderMultiSession(session, isEditable);
      return;
    }

    // Render single session (existing logic)
    console.log('📄 Rendering as single session');
    this.renderSingleSession(session, isEditable);
  }

  /**
   * Render single session detail view (original logic)
   */
  private renderSingleSession(session: Session, isEditable: boolean = true): void {
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
                ${session.transcription
                  ? this.renderTranscriptionWithSearch(session.transcription)
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
   * Render multi-session study set with tabs
   */
  private async renderMultiSession(session: Session, isEditable: boolean = true): Promise<void> {
    logger.info(`Rendering multi-session study set: ${session.id}`);

    // Load child sessions
    await this.loadChildSessions(session);

    if (this.childSessions.length === 0) {
      logger.warn('No child sessions found for multi-session study set');
      this.sessionDetailContainer.innerHTML = '<p>Error: No sessions found in this study set.</p>';
      return;
    }

    const date = new Date(session.createdAt);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Render tabs and current session
    const tabsHtml = this.renderTabs();
    const activeSession = this.childSessions[this.activeTabIndex];

    const detailHtml = `
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
            <span>📑 ${this.childSessions.length} Sessions</span>
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
              ${this.renderTabContent(activeSession, isEditable)}
            </div>
          </div>

          <!-- Right Column: AI Study Tools -->
          <div class="session-detail-right">
            <div class="ai-study-tools">
              <h3 class="study-tools-title">🤖 AI Study Tools</h3>

              <!-- Quick Actions -->
              <div class="study-tool-section">
                <h4>Quick Actions</h4>
                <div class="study-tool-buttons">
                  <button class="study-tool-btn" id="generate-summary-btn">📝 Summary</button>
                  <button class="study-tool-btn" id="extract-concepts-btn">💡 Key Concepts</button>
                  <button class="study-tool-btn" id="generate-flashcards-btn">🃏 Flashcards</button>
                  <button class="study-tool-btn" id="generate-quiz-btn">📋 Quiz</button>
                </div>
              </div>

              <!-- Content Area for AI Output -->
              <div class="study-content-area" id="study-content-area">
                <p class="study-tool-placeholder">Select an AI study tool above to get started.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.sessionDetailContainer.innerHTML = detailHtml;
    this.attachMultiSessionHandlers(session, isEditable);

    logger.info(`Rendered multi-session study set with ${this.childSessions.length} sessions`);
  }

  /**
   * Load child sessions for a multi-session study set
   */
  private async loadChildSessions(multiSession: Session): Promise<void> {
    const childSessionIds = multiSession.getChildSessionIds();

    if (childSessionIds.length === 0) {
      logger.warn('Multi-session study set has no child session IDs');
      return;
    }

    try {
      // Load all sessions first
      const result = await (window as any).scribeCat.session.list();

      if (result.success && result.sessions) {
        // Find child sessions in order
        this.childSessions = childSessionIds
          .map((id: string) => {
            const sessionData = result.sessions.find((s: any) => s.id === id);
            return sessionData ? this.dataToSession(sessionData) : null;
          })
          .filter((s: Session | null): s is Session => s !== null);

        logger.info(`Loaded ${this.childSessions.length} child sessions`);
      }
    } catch (error) {
      logger.error('Failed to load child sessions', error);
      this.childSessions = [];
    }
  }

  /**
   * Convert session data to Session object
   */
  private dataToSession(data: any): Session {
    // Use Session.fromJSON to properly reconstruct the session with all methods
    return Session.fromJSON(data);
  }

  /**
   * Render session tabs
   */
  private renderTabs(): string {
    return `
      <div class="session-tabs">
        ${this.childSessions.map((session, index) => `
          <button
            class="session-tab ${index === this.activeTabIndex ? 'active' : ''}"
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
  private renderTabContent(session: Session, isEditable: boolean): string {
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
            ${this.renderTranscription(session)}
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

  /**
   * Render transcription for a session
   */
  private renderTranscription(session: Session): string {
    if (!session.transcription) {
      return '<p class="no-transcription">No transcription available for this session.</p>';
    }

    const segments = session.transcription.segments || [];
    if (segments.length === 0) {
      return `<p>${escapeHtml(session.transcription.fullText)}</p>`;
    }

    return segments.map(segment => `
      <p class="transcription-segment" data-start="${segment.startTime}">
        <span class="timestamp clickable">[${formatTimestamp(segment.startTime)}]</span>
        ${escapeHtml(segment.text)}
      </p>
    `).join('');
  }

  /**
   * Attach event handlers for multi-session view
   */
  private attachMultiSessionHandlers(session: Session, isEditable: boolean): void {
    // Back button
    const backBtn = document.querySelector('.back-to-list-btn');
    backBtn?.addEventListener('click', () => {
      this.sessionDetailContainer.dispatchEvent(new CustomEvent('backToList'));
    });

    // Tab click handlers
    const tabs = document.querySelectorAll('.session-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const index = parseInt((tab as HTMLElement).dataset.tabIndex || '0');
        this.switchTab(index, isEditable);
      });
    });

    // Sub-tab click handlers (Transcription/Notes)
    this.attachContentTabHandlers();

    // Setup audio player for active session
    const activeSession = this.childSessions[this.activeTabIndex];
    this.attachEventHandlers(activeSession);
  }

  /**
   * Attach event handlers for content sub-tabs (Transcription/Notes)
   */
  private attachContentTabHandlers(): void {
    const contentTabBtns = document.querySelectorAll('.content-tab-btn');
    contentTabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = (btn as HTMLElement).dataset.contentTab;

        // Update button active states
        contentTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update panel visibility
        const panels = document.querySelectorAll('.content-tab-panel');
        panels.forEach((panel) => {
          const panelElement = panel as HTMLElement;
          if (panelElement.dataset.panel === targetTab) {
            panelElement.classList.add('active');
          } else {
            panelElement.classList.remove('active');
          }
        });
      });
    });
  }

  /**
   * Switch to a different tab
   */
  private switchTab(index: number, isEditable: boolean): void {
    if (index < 0 || index >= this.childSessions.length) return;

    this.activeTabIndex = index;
    const activeSession = this.childSessions[index];

    // Update tab active state
    const tabs = document.querySelectorAll('.session-tab');
    tabs.forEach((tab, i) => {
      if (i === index) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update tab content
    const tabContent = document.getElementById('session-tab-content');
    if (tabContent) {
      tabContent.innerHTML = this.renderTabContent(activeSession, isEditable);
      this.attachEventHandlers(activeSession);
      // Re-attach content tab handlers after re-rendering
      this.attachContentTabHandlers();
    }

    logger.info(`Switched to tab ${index}: ${activeSession.title}`);
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
      // Set audio source based on recording path
      const recordingPath = audioElement.dataset.recordingPath || '';

      // Helper function to construct local file path from timestamp
      const constructLocalPath = (timestamp: Date): string => {
        const year = timestamp.getUTCFullYear();
        const month = String(timestamp.getUTCMonth() + 1).padStart(2, '0');
        const day = String(timestamp.getUTCDate()).padStart(2, '0');
        const hours = String(timestamp.getUTCHours()).padStart(2, '0');
        const minutes = String(timestamp.getUTCMinutes()).padStart(2, '0');
        const seconds = String(timestamp.getUTCSeconds()).padStart(2, '0');
        const timestampStr = `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
        return `/Users/nae/Library/Application Support/scribecat-v2/recordings/recording-${timestampStr}.webm`;
      };

      // Track which fallback path we're trying
      let fallbackAttempt = 0;
      const fallbackPaths: string[] = [];

      // Prepare fallback paths: try transcription.createdAt first (if exists), then session.createdAt variations
      if (session.transcription?.createdAt) {
        const transcriptionTime = new Date(session.transcription.createdAt);
        fallbackPaths.push(constructLocalPath(transcriptionTime));

        // Try ±1 second variations (recordings may be off by a second)
        const transcriptionMinus1 = new Date(transcriptionTime);
        transcriptionMinus1.setUTCSeconds(transcriptionMinus1.getUTCSeconds() - 1);
        fallbackPaths.push(constructLocalPath(transcriptionMinus1));

        const transcriptionPlus1 = new Date(transcriptionTime);
        transcriptionPlus1.setUTCSeconds(transcriptionPlus1.getUTCSeconds() + 1);
        fallbackPaths.push(constructLocalPath(transcriptionPlus1));
      }

      // Try session.createdAt with seconds rounded down to :00
      const sessionTime = new Date(session.createdAt);
      sessionTime.setUTCSeconds(0, 0);
      fallbackPaths.push(constructLocalPath(sessionTime));

      // Also try exact session.createdAt
      fallbackPaths.push(constructLocalPath(session.createdAt));

      if (recordingPath.startsWith('cloud://')) {
        // Cloud recording - fetch signed URL from Supabase Storage
        const storagePath = recordingPath.replace('cloud://', '');
        const storageService = new SupabaseStorageService();

        const tryLocalFallback = async () => {
          if (fallbackAttempt < fallbackPaths.length) {
            const localPath = fallbackPaths[fallbackAttempt];
            fallbackAttempt++;

            // Check if file exists before trying to load it (prevents browser console errors)
            const result = await (window as any).scribeCat.dialog.fileExists(localPath);
            if (result.success && result.exists) {
              audioElement.src = `file://${localPath}`;
              logger.info(`Loaded local audio from fallback path: ${localPath}`);
            } else {
              // File doesn't exist, try next path silently
              await tryLocalFallback();
            }
          } else {
            logger.error('All local fallback paths exhausted');
          }
        };

        // Set up error handler for fallback retries (in case file exists but is corrupted/unreadable)
        const errorHandler = () => {
          if (audioElement.src.startsWith('file://') && fallbackAttempt < fallbackPaths.length) {
            // Silently try next fallback path (expected behavior during retry)
            tryLocalFallback();
          }
        };
        audioElement.addEventListener('error', errorHandler, { once: false });

        storageService.getSignedUrl(storagePath, 7200).then(async result => {
          if (result.success && result.url) {
            audioElement.src = result.url;
            logger.info(`Loaded cloud audio from signed URL: ${storagePath}`);
          } else {
            // Silently fallback to local file (expected for legacy synced sessions)
            await tryLocalFallback();
          }
        }).catch(async error => {
          // Silently fallback to local file (expected for legacy synced sessions)
          await tryLocalFallback();
        });
      } else if (recordingPath) {
        // Local recording - use file:// protocol
        audioElement.src = `file://${recordingPath}`;
        logger.info(`Loaded local audio from: ${recordingPath}`);
      }

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

    // Search functionality handlers
    this.attachSearchHandlers(session);
  }

  /**
   * Attach search event handlers
   */
  private attachSearchHandlers(session: Session): void {
    const searchInput = document.querySelector('.transcription-search-input') as HTMLInputElement;
    const clearBtn = document.querySelector('.search-clear-btn');
    const prevBtn = document.querySelector('.search-prev-btn');
    const nextBtn = document.querySelector('.search-next-btn');

    if (!searchInput) return;

    // Search input handler (real-time search)
    searchInput.addEventListener('input', () => {
      this.currentSearchQuery = searchInput.value;
      this.currentMatchIndex = 0; // Reset to first match
      this.updateTranscriptionView(session);
      this.scrollToCurrentMatch();
    });

    // Clear search button
    clearBtn?.addEventListener('click', () => {
      this.currentSearchQuery = '';
      this.currentMatchIndex = 0;
      this.totalMatches = 0;
      searchInput.value = ''; // Reset input value
      this.updateTranscriptionView(session);
      searchInput.focus(); // Keep focus on search input
    });

    // Navigate to previous match
    prevBtn?.addEventListener('click', () => {
      if (this.totalMatches > 0) {
        this.currentMatchIndex = (this.currentMatchIndex - 1 + this.totalMatches) % this.totalMatches;
        this.updateTranscriptionView(session);
        this.scrollToCurrentMatch();
      }
    });

    // Navigate to next match
    nextBtn?.addEventListener('click', () => {
      if (this.totalMatches > 0) {
        this.currentMatchIndex = (this.currentMatchIndex + 1) % this.totalMatches;
        this.updateTranscriptionView(session);
        this.scrollToCurrentMatch();
      }
    });

    // Keyboard shortcuts for navigation
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Enter: Previous match
          prevBtn?.click();
        } else {
          // Enter: Next match
          nextBtn?.click();
        }
      } else if (e.key === 'Escape') {
        // Escape: Clear search
        clearBtn?.dispatchEvent(new Event('click'));
        searchInput.blur();
      }
    });
  }

  /**
   * Update transcription view after search changes
   */
  private updateTranscriptionView(session: Session): void {
    if (!session.transcription) return;

    // Update search UI elements (counter, buttons) without re-rendering input
    const resultsInfo = document.querySelector('.search-results-info');
    const clearBtn = document.querySelector('.search-clear-btn');
    const matchCounter = document.querySelector('.search-match-counter');
    const prevBtn = document.querySelector('.search-prev-btn') as HTMLButtonElement;
    const nextBtn = document.querySelector('.search-next-btn') as HTMLButtonElement;

    if (this.currentSearchQuery) {
      resultsInfo?.classList.remove('hidden');
      clearBtn?.classList.remove('hidden');

      if (matchCounter) {
        matchCounter.innerHTML = this.totalMatches > 0
          ? `<span class="current-match">${this.currentMatchIndex + 1}</span> of <span class="total-matches">${this.totalMatches}</span>`
          : 'No matches';
      }

      if (prevBtn) prevBtn.disabled = this.totalMatches <= 1;
      if (nextBtn) nextBtn.disabled = this.totalMatches <= 1;
    } else {
      resultsInfo?.classList.add('hidden');
      clearBtn?.classList.add('hidden');
    }

    // Only update the segments container, not the search bar
    const segmentsContainer = document.querySelector('.transcription-segments');
    if (segmentsContainer) {
      segmentsContainer.outerHTML = this.renderTranscriptionSegments(session.transcription);

      // Re-attach click handlers for the new segments
      const audioElement = document.getElementById('session-audio') as HTMLAudioElement;
      const segments = document.querySelectorAll('.transcription-segment');
      segments.forEach(segment => {
        segment.addEventListener('click', () => {
          const startTime = parseFloat((segment as HTMLElement).dataset.startTime || '0');
          if (audioElement && !isNaN(startTime)) {
            audioElement.currentTime = startTime;
            if (audioElement.paused) {
              audioElement.play().catch(err => logger.error('Playback failed:', err));
            }
          }
        });
      });
    }
  }

  /**
   * Scroll to the current match
   */
  private scrollToCurrentMatch(): void {
    setTimeout(() => {
      const currentMatch = document.querySelector('.transcription-segment.current-match');
      if (currentMatch) {
        currentMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }

  /**
   * Render transcription with search bar
   */
  private renderTranscriptionWithSearch(transcription: any): string {
    const searchBarHtml = `
      <div class="transcription-search-bar">
        <div class="search-input-container">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            class="transcription-search-input"
            placeholder="Search transcription..."
            value="${escapeHtml(this.currentSearchQuery)}"
          />
          <button class="search-clear-btn ${this.currentSearchQuery ? '' : 'hidden'}" title="Clear search">✕</button>
        </div>
        <div class="search-results-info ${this.currentSearchQuery ? '' : 'hidden'}">
          <span class="search-match-counter">
            ${this.totalMatches > 0
              ? `<span class="current-match">${this.currentMatchIndex + 1}</span> of <span class="total-matches">${this.totalMatches}</span>`
              : 'No matches'}
          </span>
          <div class="search-navigation">
            <button class="search-nav-btn search-prev-btn" title="Previous match" ${this.totalMatches <= 1 ? 'disabled' : ''}>↑</button>
            <button class="search-nav-btn search-next-btn" title="Next match" ${this.totalMatches <= 1 ? 'disabled' : ''}>↓</button>
          </div>
        </div>
      </div>
    `;

    return searchBarHtml + this.renderTranscriptionSegments(transcription);
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

    // Filter segments based on search query
    let filteredSegments = transcription.segments;
    let matchIndexMap = new Map<number, number>(); // Maps segment index to match index

    if (this.currentSearchQuery) {
      const query = this.currentSearchQuery.toLowerCase();
      let matchCounter = 0;

      filteredSegments = transcription.segments.filter((segment: any, index: number) => {
        const matches = segment.text.toLowerCase().includes(query);
        if (matches) {
          matchIndexMap.set(index, matchCounter);
          matchCounter++;
        }
        return matches;
      });

      this.totalMatches = filteredSegments.length;

      // Ensure currentMatchIndex is valid
      if (this.currentMatchIndex >= this.totalMatches) {
        this.currentMatchIndex = Math.max(0, this.totalMatches - 1);
      }
    } else {
      this.totalMatches = 0;
      this.currentMatchIndex = 0;
    }

    // Render each segment with timestamp
    const segmentsHtml = filteredSegments.map((segment: any, filteredIndex: number) => {
      const timestamp = formatTimestamp(segment.startTime);
      const originalIndex = transcription.segments.indexOf(segment);
      const matchIndex = matchIndexMap.get(originalIndex) ?? -1;
      const isCurrentMatch = matchIndex === this.currentMatchIndex;

      // Highlight search query in text
      let segmentText = escapeHtml(segment.text);
      if (this.currentSearchQuery) {
        const query = this.currentSearchQuery;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        segmentText = segmentText.replace(regex, '<mark class="search-highlight">$1</mark>');
      }

      return `
        <div class="transcription-segment ${isCurrentMatch ? 'current-match' : ''}" data-start-time="${segment.startTime}" data-end-time="${segment.endTime}" data-segment-index="${originalIndex}" data-match-index="${matchIndex}">
          <span class="segment-timestamp">[${timestamp}]</span>
          <span class="segment-text">${segmentText}</span>
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
