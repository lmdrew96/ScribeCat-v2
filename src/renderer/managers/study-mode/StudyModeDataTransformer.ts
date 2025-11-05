/**
 * StudyModeDataTransformer
 *
 * Transforms raw session data from various sources into Session entities.
 * Handles shared session data transformation and merging.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { SyncStatus } from '../../../domain/entities/Session.js';
import { Transcription } from '../../../domain/entities/Transcription.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('StudyModeDataTransformer');

export class StudyModeDataTransformer {
  /**
   * Transform shared session database rows to Session entities
   */
  public transformSharedSessions(sharedWithMeSessions: any[]): Session[] {
    logger.info(`Transforming ${sharedWithMeSessions.length} shared sessions`);

    return sharedWithMeSessions
      .map((share: any) => {
        logger.info('Processing share:', {
          shareId: share.id,
          hasSessionsProperty: 'sessions' in share,
          sessionData: share.sessions
        });
        return share.sessions;
      })
      .filter((sessionData: any) => {
        const isValid = sessionData != null;
        if (!isValid) {
          logger.warn('Filtered out null/undefined session data');
        }
        return isValid;
      })
      .map((row: any) => this.rowToSession(row));
  }

  /**
   * Transform a database row to a Session entity
   * Matches the logic from SupabaseSessionRepository.rowToSession
   */
  private rowToSession(row: any): Session {
    // Create transcription if data exists
    let transcription: Transcription | undefined;
    if (row.transcription_text) {
      // Create a single segment from the full text
      const segments = [{
        text: row.transcription_text,
        startTime: 0,
        endTime: row.duration / 1000, // Convert to seconds
        confidence: row.transcription_confidence
      }];

      transcription = new Transcription(
        row.transcription_text,
        segments,
        row.transcription_language || 'en',
        (row.transcription_provider as 'assemblyai' | 'simulation') || 'simulation',
        row.transcription_timestamp ? new Date(row.transcription_timestamp) : new Date(),
        row.transcription_confidence
      );
    }

    // Use cloud:// path for shared audio files
    const recordingPath = `cloud://${row.user_id}/${row.id}/audio.webm`;

    // Create Session entity matching the structure from SupabaseSessionRepository
    const session: any = {
      id: row.id,
      title: row.title || 'Untitled Session',
      recordingPath: recordingPath,
      notes: row.notes || '',
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      duration: row.duration / 1000, // Convert milliseconds to seconds
      transcription: transcription,
      tags: row.tags || [],
      exportHistory: [], // Export history not stored in cloud
      courseId: row.course_id,
      courseTitle: row.course_title,
      courseNumber: row.course_number,
      // Cloud sync fields
      userId: row.user_id,
      cloudId: row.id,
      syncStatus: SyncStatus.SYNCED,
      lastSyncedAt: new Date(row.updated_at),
      // Mark as shared so we can show a badge
      isShared: true
    };

    return session as Session;
  }

  /**
   * Merge owned sessions with shared sessions
   */
  public mergeSessions(ownedSessions: Session[], sharedSessions: Session[]): Session[] {
    const allSessions = [...ownedSessions, ...sharedSessions];
    logger.info(
      `Merged sessions - Owned: ${ownedSessions.length}, Shared: ${sharedSessions.length}, Total: ${allSessions.length}`
    );
    return allSessions;
  }

  /**
   * Filter sessions to only include shared ones
   */
  public filterSharedOnly(sessions: Session[]): Session[] {
    const sharedOnly = sessions.filter((s: any) => s.isShared === true);
    logger.info(`Filtered ${sharedOnly.length} shared sessions out of ${sessions.length} total`);
    return sharedOnly;
  }
}
