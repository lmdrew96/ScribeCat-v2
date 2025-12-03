/**
 * StudyRoomSessionContent
 *
 * Handles session loading, metadata display, and content tabs.
 */

import type { StudyRoomsManager } from '../../managers/social/StudyRoomsManager.js';
import { RendererSupabaseClient } from '../../services/RendererSupabaseClient.js';
import { Session } from '../../../domain/entities/Session.js';
import { escapeHtml, formatTimestamp } from '../../utils/formatting.js';

export interface SessionLoadResult {
  session: Session | null;
  sessionData: any | null;
  error?: string;
}

export class StudyRoomSessionContent {
  /**
   * Load session content from Supabase
   */
  static async loadSession(
    roomId: string,
    studyRoomsManager: StudyRoomsManager
  ): Promise<SessionLoadResult> {
    const room = studyRoomsManager.getRoomById(roomId);
    if (!room) {
      return { session: null, sessionData: null, error: 'Room not found' };
    }

    if (!room.sessionId) {
      return { session: null, sessionData: null };
    }

    const supabase = RendererSupabaseClient.getInstance().getClient();
    const { data: sessionData, error } = await supabase
      .from('sessions')
      .select('id, title, notes, transcription_text, course_title, course_number, duration, created_at, user_id, source_session_id, source_user_id')
      .eq('id', room.sessionId)
      .single();

    if (error) {
      console.error('Failed to load session from Supabase:', error);
      return { session: null, sessionData: null, error: 'Failed to load session' };
    }

    if (!sessionData) {
      return { session: null, sessionData: null, error: 'Session not found' };
    }

    // Parse transcription and build Session entity
    let transcription = undefined;
    if (sessionData.transcription_text) {
      const transcriptionData = JSON.parse(sessionData.transcription_text);

      if (!transcriptionData.fullText && transcriptionData.segments) {
        transcriptionData.fullText = transcriptionData.segments
          .map((seg: any) => seg.text)
          .join(' ');
      }

      if (transcriptionData.fullText && transcriptionData.segments) {
        transcription = {
          fullText: transcriptionData.fullText,
          segments: transcriptionData.segments,
          language: transcriptionData.language || 'en',
          provider: 'assemblyai',
          createdAt: new Date(sessionData.created_at),
          averageConfidence: transcriptionData.averageConfidence
        };
      }
    }

    const sessionForEntity = {
      ...sessionData,
      recordingPath: '',
      transcription,
      createdAt: new Date(sessionData.created_at),
      updatedAt: new Date(sessionData.created_at),
    };

    const session = Session.fromJSON(sessionForEntity);

    return { session, sessionData };
  }

  /**
   * Render session metadata bar
   */
  static renderMetadata(sessionData: any): void {
    const sessionInfoBar = document.getElementById('session-info-bar');
    const courseBadge = document.getElementById('session-course-badge');
    const sessionTitle = document.getElementById('session-title-display');
    const sessionDate = document.getElementById('session-date-display');
    const sessionDuration = document.getElementById('session-duration-display');

    if (!sessionInfoBar) return;

    sessionInfoBar.style.display = 'block';

    if (courseBadge) {
      if (sessionData.course_title) {
        courseBadge.textContent = sessionData.course_number
          ? `${sessionData.course_number}: ${sessionData.course_title}`
          : sessionData.course_title;
      } else {
        courseBadge.textContent = 'No Course';
      }
    }

    if (sessionTitle) {
      sessionTitle.textContent = sessionData.title || 'Untitled Session';
    }

    if (sessionDate && sessionData.created_at) {
      const date = new Date(sessionData.created_at);
      sessionDate.textContent = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    if (sessionDuration && sessionData.duration) {
      const hours = Math.floor(sessionData.duration / 3600);
      const minutes = Math.floor((sessionData.duration % 3600) / 60);
      const seconds = Math.floor(sessionData.duration % 60);

      if (hours > 0) {
        sessionDuration.textContent = `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        sessionDuration.textContent = `${minutes}m ${seconds}s`;
      } else {
        sessionDuration.textContent = `${seconds}s`;
      }
    }
  }

  /**
   * Render transcript content
   */
  static renderTranscript(sessionData: any): void {
    const transcriptContainer = document.getElementById('session-transcript');
    if (!transcriptContainer) return;

    if (sessionData.transcription_text) {
      try {
        const transcription = JSON.parse(sessionData.transcription_text);
        if (transcription && transcription.segments && Array.isArray(transcription.segments)) {
          const segments = transcription.segments
            .map((segment: any) => {
              const timestamp = formatTimestamp(segment.startTime || 0);
              const text = escapeHtml(segment.text || '');
              return `<p class="transcription-segment" data-start="${segment.startTime}"><span class="timestamp clickable">[${timestamp}]</span> ${text}</p>`;
            })
            .join('');
          transcriptContainer.innerHTML = `<div class="transcript-content">${segments}</div>`;
        } else {
          transcriptContainer.innerHTML = '<p class="empty-state">No transcript available</p>';
        }
      } catch (parseError) {
        console.error('Failed to parse transcription:', parseError);
        transcriptContainer.innerHTML = '<p class="empty-state">Transcription format error</p>';
      }
    } else {
      transcriptContainer.innerHTML = '<p class="empty-state">No transcription available</p>';
    }
  }

  /**
   * Render empty state when no session is attached
   */
  static renderEmptyState(): void {
    const notesContainer = document.getElementById('session-notes');
    const transcriptContainer = document.getElementById('session-transcript');

    if (notesContainer) {
      notesContainer.innerHTML = '<p class="empty-state">No session attached to this room.<br>Use the chat to collaborate!</p>';
    }
    if (transcriptContainer) {
      transcriptContainer.innerHTML = '<p class="empty-state">No session attached</p>';
    }
  }

  /**
   * Render error state
   */
  static renderErrorState(error: string): void {
    const notesContainer = document.getElementById('session-notes');
    const transcriptContainer = document.getElementById('session-transcript');

    if (notesContainer) {
      notesContainer.innerHTML = `<p class="empty-state error">${escapeHtml(error)}</p>`;
    }
    if (transcriptContainer) {
      transcriptContainer.innerHTML = `<p class="empty-state error">${escapeHtml(error)}</p>`;
    }
  }

  /**
   * Switch content tabs
   */
  static switchTab(container: HTMLElement, tabName: string): void {
    container.querySelectorAll('.content-tab').forEach(tab => {
      if (tab.getAttribute('data-tab') === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    container.querySelectorAll('.session-content-panel').forEach(panel => {
      const panelTab = panel.getAttribute('data-panel');
      if (panelTab === tabName) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });
  }

  /**
   * Get audio recording path for session
   */
  static getAudioRecordingPath(sessionData: any): string | null {
    const audioUserId = sessionData.source_user_id || sessionData.user_id;
    const audioSessionId = sessionData.source_session_id || sessionData.id;

    if (audioUserId && audioSessionId) {
      return `cloud://${audioUserId}/${audioSessionId}/audio.webm`;
    }

    return null;
  }
}
