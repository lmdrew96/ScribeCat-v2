/**
 * DetailViewEventHandler
 *
 * Handles all event attachment and management for the detail view
 */

import { Session } from '../../../../domain/entities/Session.js';
import { SessionPlaybackManager } from '../../../services/SessionPlaybackManager.js';
import { SupabaseStorageService } from '../../../../infrastructure/services/supabase/SupabaseStorageService.js';
import { createLogger } from '../../../../shared/logger.js';
import { TranscriptionRenderer } from './TranscriptionRenderer.js';

const logger = createLogger('DetailViewEventHandler');

export class DetailViewEventHandler {
  /**
   * Attach all event handlers for single session detail view
   */
  static attachEventHandlers(
    session: Session,
    sessionDetailContainer: HTMLElement,
    sessionPlaybackManager: SessionPlaybackManager,
    searchState: {
      currentSearchQuery: string;
      currentMatchIndex: number;
      totalMatches: number;
    },
    onSearchUpdate: () => void
  ): void {
    // Back button
    const backBtn = document.querySelector('.back-to-list-btn');
    backBtn?.addEventListener('click', () => {
      sessionDetailContainer.dispatchEvent(new CustomEvent('backToList'));
    });

    // Audio player setup
    this.setupAudioPlayer(session, sessionPlaybackManager, sessionDetailContainer);

    // Content tabs
    this.attachContentTabHandlers();

    // Action buttons
    this.attachActionButtons(session, sessionDetailContainer);

    // Edit buttons
    this.attachEditButtons(session, sessionDetailContainer);

    // Notes editing handlers
    this.attachNotesHandlers(sessionDetailContainer);

    // Search functionality
    this.attachSearchHandlers(session, searchState, onSearchUpdate);

    // Scroll to top button
    this.attachScrollToTopHandler();

    // Window resize handler for responsive AI tools panel
    this.attachWindowResizeHandler();
  }

  /**
   * Set up audio player with recording
   */
  private static setupAudioPlayer(
    session: Session,
    sessionPlaybackManager: SessionPlaybackManager,
    sessionDetailContainer: HTMLElement
  ): void {
    const audioElement = document.getElementById('session-audio') as HTMLAudioElement;
    if (!audioElement) return;

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

    // Prepare fallback paths - prioritize session.createdAt (actual recording time) over transcription.createdAt
    const sessionTime = new Date(session.createdAt);
    sessionTime.setUTCSeconds(0, 0);
    fallbackPaths.push(constructLocalPath(sessionTime));
    fallbackPaths.push(constructLocalPath(session.createdAt));

    // Try +/- 5 seconds from session creation time (recording can start before session is created)
    for (let offset = -5; offset <= 5; offset++) {
      if (offset === 0) continue; // Already checked exact time above
      const offsetTime = new Date(session.createdAt);
      offsetTime.setUTCSeconds(offsetTime.getUTCSeconds() + offset);
      fallbackPaths.push(constructLocalPath(offsetTime));
    }

    // Try transcription timestamp as fallback (may be wrong if session was re-transcribed)
    if (session.transcription?.createdAt) {
      const transcriptionTime = new Date(session.transcription.createdAt);
      fallbackPaths.push(constructLocalPath(transcriptionTime));

      const transcriptionMinus1 = new Date(transcriptionTime);
      transcriptionMinus1.setUTCSeconds(transcriptionMinus1.getUTCSeconds() - 1);
      fallbackPaths.push(constructLocalPath(transcriptionMinus1));

      const transcriptionPlus1 = new Date(transcriptionTime);
      transcriptionPlus1.setUTCSeconds(transcriptionPlus1.getUTCSeconds() + 1);
      fallbackPaths.push(constructLocalPath(transcriptionPlus1));
    }

    if (recordingPath.startsWith('cloud://')) {
      // Cloud recording - fetch signed URL
      const storagePath = recordingPath.replace('cloud://', '');
      const storageService = new SupabaseStorageService();

      const tryLocalFallback = async () => {
        if (fallbackAttempt < fallbackPaths.length) {
          const localPath = fallbackPaths[fallbackAttempt];
          fallbackAttempt++;

          const result = await (window as any).scribeCat.dialog.fileExists(localPath);
          if (result.success && result.exists) {
            audioElement.src = `file://${localPath}`;
            logger.info(`Loaded local audio from fallback path: ${localPath}`);
          } else {
            await tryLocalFallback();
          }
        } else {
          logger.error('All local fallback paths exhausted');
        }
      };

      const errorHandler = () => {
        if (audioElement.src.startsWith('file://') && fallbackAttempt < fallbackPaths.length) {
          tryLocalFallback();
        }
      };
      audioElement.addEventListener('error', errorHandler, { once: false });

      storageService.getSignedUrl(storagePath, 7200).then(async result => {
        if (result.success && result.url) {
          audioElement.src = result.url;
          logger.info(`Loaded cloud audio from signed URL: ${storagePath}`);
        } else {
          await tryLocalFallback();
        }
      }).catch(async error => {
        await tryLocalFallback();
      });
    } else if (recordingPath) {
      // Local recording
      audioElement.src = `file://${recordingPath}`;
      logger.info(`Loaded local audio from: ${recordingPath}`);
    }

    // Initialize custom audio controls
    sessionPlaybackManager.initialize(
      audioElement,
      session.duration,
      () => !sessionDetailContainer.classList.contains('hidden')
    );

    // Speed controls
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

    // Timestamp click handlers - seek audio to segment time
    this.attachTranscriptionSegmentClickHandlers();
  }

  /**
   * Attach click handlers to transcription segments for audio seeking
   * Handles both data-start-time and data-start attributes for compatibility
   */
  private static attachTranscriptionSegmentClickHandlers(): void {
    const audioElement = document.getElementById('session-audio') as HTMLAudioElement;
    if (!audioElement) return;

    const segments = document.querySelectorAll('.transcription-segment');
    segments.forEach(segment => {
      segment.addEventListener('click', () => {
        // Check both data-start-time (single session) and data-start (multi-session) attributes
        const startTime = parseFloat(
          (segment as HTMLElement).dataset.startTime ||
          (segment as HTMLElement).dataset.start ||
          '0'
        );
        if (audioElement && !isNaN(startTime)) {
          audioElement.currentTime = startTime;
          if (audioElement.paused) {
            audioElement.play().catch(err => logger.error('Playback failed:', err));
          }
        }
      });
    });
  }

  /**
   * Attach content tab switching handlers
   */
  private static attachContentTabHandlers(): void {
    const tabs = document.querySelectorAll('.content-tab');
    const panels = document.querySelectorAll('.session-content-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.tab;

        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

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
  }

  /**
   * Attach action button handlers
   */
  private static attachActionButtons(session: Session, sessionDetailContainer: HTMLElement): void {
    const shareBtn = document.querySelector('.share-session-btn');
    shareBtn?.addEventListener('click', () => {
      sessionDetailContainer.dispatchEvent(new CustomEvent('shareSession', { detail: { sessionId: session.id } }));
    });

    const exportBtn = document.querySelector('.export-session-detail-btn');
    exportBtn?.addEventListener('click', () => {
      sessionDetailContainer.dispatchEvent(new CustomEvent('exportSession', { detail: { sessionId: session.id } }));
    });

    const deleteBtn = document.querySelector('.delete-session-detail-btn');
    deleteBtn?.addEventListener('click', () => {
      sessionDetailContainer.dispatchEvent(new CustomEvent('deleteSession', { detail: { sessionId: session.id } }));
    });

    const retranscribeBtn = document.querySelector('.retranscribe-session-btn');
    retranscribeBtn?.addEventListener('click', () => {
      sessionDetailContainer.dispatchEvent(new CustomEvent('retranscribeSession', { detail: { sessionId: session.id } }));
    });
  }

  /**
   * Attach edit button handlers
   */
  private static attachEditButtons(session: Session, sessionDetailContainer: HTMLElement): void {
    const editTitleBtn = document.querySelector('.edit-title-btn-detail');
    editTitleBtn?.addEventListener('click', () => {
      sessionDetailContainer.dispatchEvent(new CustomEvent('startTitleEdit', { detail: { sessionId: session.id } }));
    });

    const editCourseBtn = document.querySelector('.edit-course-btn-detail');
    editCourseBtn?.addEventListener('click', () => {
      sessionDetailContainer.dispatchEvent(new CustomEvent('startCourseEdit', { detail: { sessionId: session.id } }));
    });
  }

  /**
   * Attach notes editing handlers
   */
  private static attachNotesHandlers(sessionDetailContainer: HTMLElement): void {
    const editNotesBtn = document.querySelector('.edit-notes-btn');
    editNotesBtn?.addEventListener('click', (e) => {
      const sessionId = (e.target as HTMLElement).dataset.sessionId;
      if (sessionId) {
        sessionDetailContainer.dispatchEvent(new CustomEvent('startNotesEdit', { detail: { sessionId } }));
      }
    });

    const saveNotesBtn = document.querySelector('.save-notes-btn');
    saveNotesBtn?.addEventListener('click', (e) => {
      const sessionId = (e.target as HTMLElement).dataset.sessionId;
      if (sessionId) {
        sessionDetailContainer.dispatchEvent(new CustomEvent('saveNotesEdit', { detail: { sessionId } }));
      }
    });

    const cancelEditNotesBtn = document.querySelector('.cancel-edit-notes-btn');
    cancelEditNotesBtn?.addEventListener('click', () => {
      sessionDetailContainer.dispatchEvent(new CustomEvent('cancelNotesEdit'));
    });
  }

  /**
   * Attach search event handlers
   */
  private static attachSearchHandlers(
    session: Session,
    searchState: { currentSearchQuery: string; currentMatchIndex: number; totalMatches: number },
    onSearchUpdate: () => void
  ): void {
    const searchInput = document.querySelector('.transcription-search-input') as HTMLInputElement;
    const clearBtn = document.querySelector('.search-clear-btn');
    const prevBtn = document.querySelector('.search-prev-btn');
    const nextBtn = document.querySelector('.search-next-btn');

    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
      searchState.currentSearchQuery = searchInput.value;
      searchState.currentMatchIndex = 0;
      onSearchUpdate();
    });

    clearBtn?.addEventListener('click', () => {
      searchState.currentSearchQuery = '';
      searchState.currentMatchIndex = 0;
      searchState.totalMatches = 0;
      searchInput.value = '';
      onSearchUpdate();
      searchInput.focus();
    });

    prevBtn?.addEventListener('click', () => {
      if (searchState.totalMatches > 0) {
        searchState.currentMatchIndex = (searchState.currentMatchIndex - 1 + searchState.totalMatches) % searchState.totalMatches;
        onSearchUpdate();
      }
    });

    nextBtn?.addEventListener('click', () => {
      if (searchState.totalMatches > 0) {
        searchState.currentMatchIndex = (searchState.currentMatchIndex + 1) % searchState.totalMatches;
        onSearchUpdate();
      }
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          prevBtn?.click();
        } else {
          nextBtn?.click();
        }
      } else if (e.key === 'Escape') {
        clearBtn?.dispatchEvent(new Event('click'));
        searchInput.blur();
      }
    });
  }

  /**
   * Attach scroll-to-top button handler
   */
  private static attachScrollToTopHandler(): void {
    const scrollToTopBtn = document.getElementById('scroll-to-top-btn');
    if (!scrollToTopBtn) return;

    // Get the scrollable container (session detail view)
    const sessionDetailContainer = document.getElementById('session-detail') as HTMLElement;
    if (!sessionDetailContainer) return;

    // Show/hide button based on scroll position
    const handleScroll = () => {
      if (sessionDetailContainer.scrollTop > 300) {
        scrollToTopBtn.classList.add('visible');
        scrollToTopBtn.style.display = 'flex';
      } else {
        scrollToTopBtn.classList.remove('visible');
        // Keep display flex while animating out, then hide after transition
        if (!scrollToTopBtn.classList.contains('visible')) {
          setTimeout(() => {
            if (!scrollToTopBtn.classList.contains('visible')) {
              scrollToTopBtn.style.display = 'none';
            }
          }, 300); // Match CSS transition duration
        }
      }
    };

    // Attach scroll listener
    sessionDetailContainer.addEventListener('scroll', handleScroll);

    // Handle click to scroll to top
    scrollToTopBtn.addEventListener('click', () => {
      sessionDetailContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });

    // Initial check
    handleScroll();
  }

  /**
   * Attach window resize handler to manage AI tools panel visibility
   */
  private static attachWindowResizeHandler(): void {
    const handleResize = () => {
      const aiToolsPanel = document.querySelector('.session-content-panel.ai-tools-panel') as HTMLElement;
      const contentTabs = document.querySelectorAll('.content-tab');

      if (!aiToolsPanel) return;

      // If window width > 968px (large screen mode)
      if (window.innerWidth > 968) {
        // Hide AI tools panel and switch back to transcription tab
        if (aiToolsPanel.classList.contains('active')) {
          aiToolsPanel.classList.remove('active');

          // Activate transcription tab instead
          const transcriptionTab = document.querySelector('.content-tab[data-tab="transcription"]');
          const transcriptionPanel = document.querySelector('.session-content-panel[data-panel="transcription"]');

          if (transcriptionTab && transcriptionPanel) {
            // Remove active from all tabs and panels
            contentTabs.forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.session-content-panel').forEach(panel => panel.classList.remove('active'));

            // Activate transcription
            transcriptionTab.classList.add('active');
            transcriptionPanel.classList.add('active');
          }
        }
      }
    };

    // Attach resize listener
    window.addEventListener('resize', handleResize);

    // Initial check
    handleResize();
  }

  /**
   * Attach event handlers for multi-session view
   */
  static attachMultiSessionHandlers(
    session: Session,
    childSessions: Session[],
    sessionDetailContainer: HTMLElement,
    sessionPlaybackManager: SessionPlaybackManager,
    activeTabIndex: number,
    onTabSwitch: (index: number) => void
  ): void {
    // Back button
    const backBtn = document.querySelector('.back-to-list-btn');
    backBtn?.addEventListener('click', () => {
      sessionDetailContainer.dispatchEvent(new CustomEvent('backToList'));
    });

    // Tab click handlers
    const tabs = document.querySelectorAll('.session-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const index = parseInt((tab as HTMLElement).dataset.tabIndex || '0');
        onTabSwitch(index);
      });
    });

    // Sub-tab click handlers (Transcription/Notes)
    this.attachMultiSessionContentTabHandlers();

    // Setup audio player for active session
    const activeSession = childSessions[activeTabIndex];
    this.setupAudioPlayer(activeSession, sessionPlaybackManager, sessionDetailContainer);

    // Attach timestamp click handlers for multi-session transcription segments
    // This ensures click handlers work even if segments use different data attributes
    this.attachTranscriptionSegmentClickHandlers();

    // Scroll to top button
    this.attachScrollToTopHandler();
  }

  /**
   * Attach content tab handlers for multi-session sub-tabs
   */
  private static attachMultiSessionContentTabHandlers(): void {
    const contentTabBtns = document.querySelectorAll('.content-tab-btn');
    contentTabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = (btn as HTMLElement).dataset.contentTab;

        contentTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

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
}
