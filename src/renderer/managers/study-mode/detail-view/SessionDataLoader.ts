/**
 * SessionDataLoader
 *
 * Handles loading and transforming session data for detail view
 */

import { Session } from '../../../../domain/entities/Session.js';
import { createLogger } from '../../../../shared/logger.js';

const logger = createLogger('SessionDataLoader');

export class SessionDataLoader {
  /**
   * Load child sessions for a multi-session study set
   */
  static async loadChildSessions(multiSession: Session): Promise<Session[]> {
    const childSessionIds = multiSession.getChildSessionIds();

    if (childSessionIds.length === 0) {
      logger.warn('Multi-session study set has no child session IDs');
      return [];
    }

    try {
      // Load all sessions first
      const result = await (window as any).scribeCat.session.list();

      if (result.success && result.sessions) {
        // Find child sessions in order
        const childSessions = childSessionIds
          .map((id: string) => {
            const sessionData = result.sessions.find((s: any) => s.id === id);
            return sessionData ? this.dataToSession(sessionData) : null;
          })
          .filter((s: Session | null): s is Session => s !== null);

        logger.info(`Loaded ${childSessions.length} child sessions`);
        return childSessions;
      }

      return [];
    } catch (error) {
      logger.error('Failed to load child sessions', error);
      return [];
    }
  }

  /**
   * Convert session data to Session object
   */
  static dataToSession(data: any): Session {
    // Use Session.fromJSON to properly reconstruct the session with all methods
    return Session.fromJSON(data);
  }
}
