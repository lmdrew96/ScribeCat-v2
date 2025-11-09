/**
 * StudyModeDetailViewManager
 *
 * Coordinates the session detail view rendering, audio playback, and transcription display.
 * Delegates to specialized modules for rendering and event handling.
 */

import { Session } from '../../../domain/entities/Session.js';
import { SessionPlaybackManager } from '../../services/SessionPlaybackManager.js';
import { createLogger } from '../../../shared/logger.js';
import { SessionDataLoader } from './detail-view/SessionDataLoader.js';
import { SingleSessionRenderer } from './detail-view/SingleSessionRenderer.js';
import { MultiSessionRenderer } from './detail-view/MultiSessionRenderer.js';
import { TranscriptionRenderer } from './detail-view/TranscriptionRenderer.js';
import { DetailViewEventHandler } from './detail-view/DetailViewEventHandler.js';

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
      await this.renderMultiSession(session);
      return;
    }

    // Render single session
    console.log('📄 Rendering as single session');
    this.renderSingleSession(session, isEditable);
  }

  /**
   * Render single session detail view
   */
  private renderSingleSession(session: Session, isEditable: boolean = true): void {
    const detailHtml = SingleSessionRenderer.render(
      session,
      isEditable,
      this.currentSearchQuery,
      this.currentMatchIndex,
      this.totalMatches
    );

    this.sessionDetailContainer.innerHTML = detailHtml;

    // Attach event handlers
    DetailViewEventHandler.attachEventHandlers(
      session,
      this.sessionDetailContainer,
      this.sessionPlaybackManager,
      {
        currentSearchQuery: this.currentSearchQuery,
        currentMatchIndex: this.currentMatchIndex,
        totalMatches: this.totalMatches
      },
      () => this.updateTranscriptionView(session)
    );

    logger.info(`Rendered detail view for session: ${session.id}`);
  }

  /**
   * Render multi-session study set with tabs
   */
  private async renderMultiSession(session: Session): Promise<void> {
    logger.info(`Rendering multi-session study set: ${session.id}`);

    // Load child sessions
    this.childSessions = await SessionDataLoader.loadChildSessions(session);

    if (this.childSessions.length === 0) {
      logger.warn('No child sessions found for multi-session study set');
      this.sessionDetailContainer.innerHTML = '<p>Error: No sessions found in this study set.</p>';
      return;
    }

    const detailHtml = MultiSessionRenderer.render(session, this.childSessions, this.activeTabIndex);

    this.sessionDetailContainer.innerHTML = detailHtml;

    // Attach event handlers
    DetailViewEventHandler.attachMultiSessionHandlers(
      session,
      this.childSessions,
      this.sessionDetailContainer,
      this.sessionPlaybackManager,
      this.activeTabIndex,
      (index) => this.switchTab(index)
    );

    logger.info(`Rendered multi-session study set with ${this.childSessions.length} sessions`);
  }

  /**
   * Switch to a different tab
   */
  private switchTab(index: number): void {
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
      tabContent.innerHTML = MultiSessionRenderer.renderTabContent(activeSession);

      // Re-attach event handlers
      DetailViewEventHandler.attachMultiSessionHandlers(
        this.currentSession!,
        this.childSessions,
        this.sessionDetailContainer,
        this.sessionPlaybackManager,
        this.activeTabIndex,
        (idx) => this.switchTab(idx)
      );
    }

    logger.info(`Switched to tab ${index}: ${activeSession.title}`);
  }

  /**
   * Update transcription view after search changes
   */
  private updateTranscriptionView(session: Session): void {
    if (!session.transcription) return;

    // Update search UI elements
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

    // Re-render segments
    const segmentsContainer = document.querySelector('.transcription-segments');
    if (segmentsContainer) {
      const renderResult = TranscriptionRenderer.renderTranscriptionSegments(
        session.transcription,
        this.currentSearchQuery,
        this.currentMatchIndex
      );

      this.totalMatches = renderResult.totalMatches;
      segmentsContainer.outerHTML = renderResult.html;

      // Re-attach click handlers for segments
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

      // Scroll to current match
      this.scrollToCurrentMatch();
    }
  }

  /**
   * Scroll to the current search match
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
