/**
 * SessionDataLoader
 *
 * Handles loading session data from local storage and cloud:
 * - Load owned sessions
 * - Load shared sessions
 * - Merge and transform session data
 *
 * Extracted from StudyModeManager for better separation of concerns.
 */

import { Session } from '../../../domain/entities/Session.js';
import { SessionSharingManager } from '../SessionSharingManager.js';
import { StudyModeDataTransformer } from './StudyModeDataTransformer.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('SessionDataLoader');

export class SessionDataLoader {
  private sharedWithMeSessions: any[] = [];

  constructor(
    private sessionSharingManager: SessionSharingManager,
    private dataTransformer: StudyModeDataTransformer
  ) {}

  /**
   * Load all sessions (owned + shared)
   *
   * @returns Combined array of owned and shared sessions
   */
  public async loadAllSessions(): Promise<Session[]> {
    try {
      // Load owned sessions
      const ownedSessions = await this.loadOwnedSessions();

      // Load shared sessions
      await this.loadSharedSessions();

      // Merge owned and shared sessions
      const sharedSessionsData = this.dataTransformer.transformSharedSessions(this.sharedWithMeSessions);
      const allSessions = this.dataTransformer.mergeSessions(ownedSessions, sharedSessionsData);

      return allSessions;
    } catch (error) {
      logger.error('Error loading all sessions', error);
      return [];
    }
  }

  /**
   * Load sessions owned by the current user
   */
  private async loadOwnedSessions(): Promise<Session[]> {
    try {
      const result = await window.scribeCat.session.list();

      if (result.success) {
        // Handle both 'data' and 'sessions' response formats
        const sessionsData = result.data || result.sessions || [];

        // Convert JSON data to Session instances with methods
        const sessions = sessionsData.map((data: any) => Session.fromJSON(data));

        return sessions;
      } else {
        logger.error('Failed to load owned sessions', result.error);
        return [];
      }
    } catch (error) {
      logger.error('Error loading owned sessions', error);
      return [];
    }
  }

  /**
   * Load sessions shared with the current user
   */
  private async loadSharedSessions(): Promise<void> {
    try {
      const result = await this.sessionSharingManager.getSharedWithMe();

      if (result.success && result.sessions) {
        this.sharedWithMeSessions = result.sessions;
      } else {
        logger.warn('No shared sessions data or unsuccessful result:', {
          success: result.success,
          error: result.error,
          sessionsLength: result.sessions?.length
        });
        this.sharedWithMeSessions = [];
      }
    } catch (error) {
      logger.error('Error loading shared sessions:', error);
      this.sharedWithMeSessions = [];
    }
  }

  /**
   * Get shared sessions list (for leave operations)
   */
  public getSharedWithMeSessions(): any[] {
    return this.sharedWithMeSessions;
  }
}
