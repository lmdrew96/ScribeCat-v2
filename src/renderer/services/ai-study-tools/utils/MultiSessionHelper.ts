/**
 * MultiSessionHelper
 *
 * Utilities for working with multi-session study sets
 */

import type { Session } from '../../../../domain/entities/Session.js';

export class MultiSessionHelper {
  /**
   * Load child sessions for a multi-session study set
   */
  static async loadChildSessions(multiSession: Session): Promise<Session[]> {
    const childSessionIds = multiSession.childSessionIds || [];
    console.log(`🔍 loadChildSessions - Looking for child session IDs:`, childSessionIds);

    if (childSessionIds.length === 0) {
      console.warn('⚠️ No child session IDs found in multi-session study set');
      return [];
    }

    try {
      const result = await (window as any).scribeCat.session.list();

      if (result.success && result.sessions) {
        console.log(`📋 Loaded ${result.sessions.length} total sessions from IPC`);
        const childSessionData = childSessionIds
          .map((id: string) => result.sessions.find((s: any) => s.id === id))
          .filter((s: any) => s !== null && s !== undefined);

        // Import Session class for reconstruction
        const { Session: SessionClass } = await import('../../../../domain/entities/Session.js');

        // Convert plain JSON objects to Session instances with methods
        const childSessions = childSessionData.map((data: any) => SessionClass.fromJSON(data));

        console.log(`✅ Found ${childSessions.length} child sessions out of ${childSessionIds.length} IDs`);
        return childSessions;
      }

      console.error('❌ IPC session.list failed or returned no sessions');
      return [];
    } catch (error) {
      console.error('Failed to load child sessions:', error);
      return [];
    }
  }

  /**
   * Merge transcriptions from child sessions dynamically
   */
  static mergeTranscriptions(childSessions: Session[]): string {
    const transcriptionParts: string[] = [];

    childSessions.forEach((session, index) => {
      // Add session header
      transcriptionParts.push(
        `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `SESSION ${index + 1}: ${session.title}\n` +
        `Date: ${new Date(session.createdAt).toLocaleDateString()}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
      );

      // Add transcription content
      if (session.transcription && session.transcription.fullText) {
        transcriptionParts.push(session.transcription.fullText);
      } else {
        transcriptionParts.push('(No transcription available for this session)');
      }
    });

    return transcriptionParts.join('\n');
  }
}
