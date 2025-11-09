/**
 * SessionFilterService
 *
 * Applies search filters to session lists.
 * Pure application logic with no external dependencies.
 */

import type { Session } from '../../domain/entities/Session.js';
import type { SearchFilter } from '../../domain/search/SearchFilter.js';

export class SessionFilterService {
  /**
   * Filter sessions based on SearchFilter criteria
   */
  static filter(sessions: Session[], filter: SearchFilter): Session[] {
    if (filter.isEmpty()) {
      return sessions;
    }

    return sessions.filter(session => this.sessionMatchesFilter(session, filter));
  }

  /**
   * Check if a session matches the filter criteria
   */
  private static sessionMatchesFilter(session: Session, filter: SearchFilter): boolean {
    // Course filter
    if (filter.courseId && session.courseId !== filter.courseId) {
      return false;
    }

    // Tags filter (all tags must be present)
    if (filter.tags.length > 0) {
      const hasAllTags = filter.tags.every(tag => session.tags.includes(tag));
      if (!hasAllTags) return false;
    }

    // Date range filter
    if (filter.dateRange) {
      if (filter.dateRange.start && session.createdAt < filter.dateRange.start) {
        return false;
      }
      if (filter.dateRange.end && session.createdAt > filter.dateRange.end) {
        return false;
      }
    }

    // Duration range filter
    if (filter.durationRange) {
      if (filter.durationRange.min !== undefined && session.duration < filter.durationRange.min) {
        return false;
      }
      if (filter.durationRange.max !== undefined && session.duration > filter.durationRange.max) {
        return false;
      }
    }

    // Has transcription filter
    if (filter.hasTranscription !== undefined) {
      const hasTranscription = session.hasTranscription();
      if (filter.hasTranscription !== hasTranscription) {
        return false;
      }
    }

    // Has notes filter
    if (filter.hasNotes !== undefined) {
      const hasNotes = session.notes && session.notes.trim().length > 0;
      if (filter.hasNotes !== hasNotes) {
        return false;
      }
    }

    // Has summary filter
    if (filter.hasSummary !== undefined) {
      const hasSummary = session.summary && session.summary.trim().length > 0;
      if (filter.hasSummary !== hasSummary) {
        return false;
      }
    }

    // Is multi-session filter
    if (filter.isMultiSession !== undefined) {
      const isMultiSession = session.isMultiSessionStudySet();
      if (filter.isMultiSession !== isMultiSession) {
        return false;
      }
    }

    // Is synced filter
    if (filter.isSynced !== undefined) {
      const isSynced = session.isSynced();
      if (filter.isSynced !== isSynced) {
        return false;
      }
    }

    return true;
  }
}
