import { Session, SessionType } from '../entities/Session.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Metadata about a session within a multi-session study set
 */
export interface SessionMetadata {
  sessionId: string;
  title: string;
  createdAt: Date;
  order: number;
}

/**
 * Result of merging multiple sessions
 */
export interface MergedSessionData {
  combinedTranscription: string;
  combinedNotes: string;
  sessionMetadata: SessionMetadata[];
  totalDuration: number;
  combinedTags: string[];
}

/**
 * Utility class for merging multiple sessions into a multi-session study set
 */
export class MultiSessionMerger {
  /**
   * Merge multiple sessions into a combined format suitable for AI processing
   *
   * @param sessions - Array of sessions to merge, in the desired order
   * @returns Merged session data with clear session indicators
   */
  static merge(sessions: Session[]): MergedSessionData {
    if (sessions.length === 0) {
      throw new Error('Cannot merge empty session array');
    }

    // Validate all sessions belong to the same course
    const courseId = sessions[0].courseId;
    const allSameCourse = sessions.every(s => s.courseId === courseId);
    if (!allSameCourse) {
      throw new Error('Cannot merge sessions from different courses');
    }

    const sessionMetadata: SessionMetadata[] = sessions.map((session, index) => ({
      sessionId: session.id,
      title: session.title,
      createdAt: session.createdAt,
      order: index
    }));

    // Combine transcriptions with clear session headers
    const combinedTranscription = this.mergeTranscriptions(sessions, sessionMetadata);

    // Combine notes with session separators
    const combinedNotes = this.mergeNotes(sessions, sessionMetadata);

    // Calculate total duration
    const totalDuration = sessions.reduce((sum, session) => sum + session.duration, 0);

    // Combine unique tags
    const allTags = sessions.flatMap(session => session.tags);
    const combinedTags = Array.from(new Set(allTags));

    return {
      combinedTranscription,
      combinedNotes,
      sessionMetadata,
      totalDuration,
      combinedTags
    };
  }

  /**
   * Create a new multi-session study set entity from merged data
   *
   * @param sessions - Array of sessions to merge
   * @param title - Title for the multi-session study set
   * @param userId - User ID for cloud sync (optional)
   * @returns New Session entity of type MULTI_SESSION_STUDY_SET
   */
  static createMultiSessionStudySet(
    sessions: Session[],
    title: string,
    userId?: string
  ): Session {
    const mergedData = this.merge(sessions);

    const courseId = sessions[0].courseId;
    const courseTitle = sessions[0].courseTitle;
    const courseNumber = sessions[0].courseNumber;

    const now = new Date();

    // Multi-session study sets are pure metadata containers
    // No transcription - child sessions are loaded dynamically when needed
    return new Session(
      uuidv4(), // New unique ID
      title,
      '', // No recording path for multi-session study sets
      mergedData.combinedNotes,
      now,
      now,
      mergedData.totalDuration,
      undefined, // No transcription - child sessions loaded dynamically
      mergedData.combinedTags,
      [], // No export history yet
      courseId,
      courseTitle,
      courseNumber,
      userId,
      undefined, // No cloudId yet
      undefined, // Default sync status
      undefined, // No lastSyncedAt
      undefined, // No permission level
      undefined, // Not deleted
      SessionType.MULTI_SESSION_STUDY_SET, // Multi-session type
      sessions.map(s => s.id), // Store child session IDs
      undefined // No session order for the parent
    );
  }

  /**
   * Merge transcriptions from multiple sessions with clear headers
   */
  private static mergeTranscriptions(
    sessions: Session[],
    metadata: SessionMetadata[]
  ): string {
    const transcriptionParts: string[] = [];

    sessions.forEach((session, index) => {
      const meta = metadata[index];

      // Add session header
      transcriptionParts.push(
        `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `SESSION ${index + 1}: ${meta.title}\n` +
        `Date: ${meta.createdAt.toLocaleDateString()}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
      );

      // Add transcription content
      if (session.transcription) {
        transcriptionParts.push(session.transcription.fullText);
      } else {
        transcriptionParts.push('(No transcription available for this session)');
      }
    });

    return transcriptionParts.join('\n');
  }

  /**
   * Merge notes from multiple sessions with clear separators
   */
  private static mergeNotes(
    sessions: Session[],
    metadata: SessionMetadata[]
  ): string {
    const notesParts: string[] = [];

    sessions.forEach((session, index) => {
      const meta = metadata[index];

      // Add session header in HTML format (since notes are HTML)
      notesParts.push(
        `<div class="multi-session-separator" data-session-id="${meta.sessionId}">` +
        `<h2>Session ${index + 1}: ${meta.title}</h2>` +
        `<p class="session-date">${meta.createdAt.toLocaleDateString()}</p>` +
        `</div>`
      );

      // Add notes content
      if (session.notes && session.notes.trim()) {
        notesParts.push(session.notes);
      } else {
        notesParts.push('<p><em>(No notes for this session)</em></p>');
      }
    });

    return notesParts.join('\n');
  }

  /**
   * Extract session metadata from a multi-session study set
   *
   * @param multiSession - The multi-session study set
   * @returns Array of session metadata
   */
  static extractSessionMetadata(multiSession: Session): SessionMetadata[] {
    if (!multiSession.isMultiSessionStudySet()) {
      throw new Error('Session is not a multi-session study set');
    }

    // This is a simplified version - in practice, you might need to
    // load the child sessions to get their full metadata
    return multiSession.getChildSessionIds().map((id, index) => ({
      sessionId: id,
      title: `Session ${index + 1}`, // Placeholder
      createdAt: multiSession.createdAt,
      order: index
    }));
  }
}
