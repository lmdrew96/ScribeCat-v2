/**
 * StudyModeDataTransformer
 *
 * Transforms raw session data from various sources into Session entities.
 * Handles shared session data transformation and merging.
 */

import { Session, SyncStatus } from '../../../domain/entities/Session.js';
import { Transcription } from '../../../domain/entities/Transcription.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('StudyModeDataTransformer');

export class StudyModeDataTransformer {
  /**
   * Transform shared session database rows to Session entities
   */
  public transformSharedSessions(sharedWithMeSessions: any[]): Session[] {
    return sharedWithMeSessions
      .map((share: any) => {
        logger.info('Processing share:', {
          shareId: share.id,
          permissionLevel: share.permission_level,
          hasSessionsProperty: 'sessions' in share,
          sessionData: share.sessions
        });
        // Return both the session data AND the permission level
        return {
          sessionData: share.sessions,
          permissionLevel: share.permission_level
        };
      })
      .filter((item: any) => {
        const isValid = item.sessionData != null;
        if (!isValid) {
          logger.warn('Filtered out null/undefined session data');
        }
        return isValid;
      })
      .map((item: any) => this.rowToSession(item.sessionData, item.permissionLevel));
  }

  /**
   * Transform a database row to a Session entity
   * Matches the logic from SupabaseSessionRepository.rowToSession
   */
  private rowToSession(row: any, permissionLevel?: 'viewer' | 'editor'): Session {
    // Create transcription if data exists
    let transcription: Transcription | undefined;
    if (row.transcription_text) {
      try {
        // Parse the JSON and use Transcription.fromJSON() to properly reconstruct
        // This matches the approach used in SupabaseSessionRepository
        const transcriptionData = typeof row.transcription_text === 'string'
          ? JSON.parse(row.transcription_text)
          : row.transcription_text;

        transcription = Transcription.fromJSON(transcriptionData);
      } catch (error) {
        // If JSON parsing fails, create a fallback transcription (backward compatibility)
        logger.debug('Failed to parse transcription JSON, creating fallback transcription', error);

        // Create a single segment from the full text as fallback
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
          'assemblyai', // Must be 'assemblyai' as per Transcription type definition
          row.transcription_timestamp ? new Date(row.transcription_timestamp) : new Date(),
          row.transcription_confidence
        );
      }
    }

    // Use cloud:// path for shared audio files
    const recordingPath = `cloud://${row.user_id}/${row.id}/audio.webm`;

    // Create Session entity using Session.fromJSON for proper method initialization
    const sessionData = {
      id: row.id,
      title: row.title || 'Untitled Session',
      recordingPath: recordingPath,
      notes: row.notes || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      duration: row.duration / 1000, // Convert milliseconds to seconds
      transcription: transcription?.toJSON(),
      tags: row.tags || [],
      exportHistory: [], // Export history not stored in cloud
      courseId: row.course_id,
      courseTitle: row.course_title,
      courseNumber: row.course_number,
      // Cloud sync fields
      userId: row.user_id,
      cloudId: row.id,
      syncStatus: SyncStatus.SYNCED,
      lastSyncedAt: row.updated_at,
      // Permission level for shared sessions
      permissionLevel: permissionLevel,
      // Multi-session study set fields
      type: row.type || 'single',
      childSessionIds: row.child_session_ids,
      sessionOrder: row.session_order
    };

    // Use Session.fromJSON to create proper instance with methods
    const session = Session.fromJSON(sessionData);

    // Add custom properties for shared sessions
    (session as any).isShared = true;
    (session as any).ownerName = row.owner_name;
    (session as any).ownerEmail = row.owner_email;

    return session;
  }

  /**
   * Merge owned sessions with shared sessions
   */
  public mergeSessions(ownedSessions: Session[], sharedSessions: Session[]): Session[] {
    const allSessions = [...ownedSessions, ...sharedSessions];
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
