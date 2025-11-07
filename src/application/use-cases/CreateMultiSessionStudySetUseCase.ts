/**
 * CreateMultiSessionStudySetUseCase
 *
 * Business logic for creating a multi-session study set from multiple existing sessions.
 * Application layer - orchestrates domain entities and repositories.
 */

import { Session } from '../../domain/entities/Session.js';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { MultiSessionMerger } from '../../domain/utils/MultiSessionMerger.js';

export interface CreateMultiSessionStudySetRequest {
  sessionIds: string[];
  title: string;
  userId?: string;
}

export class CreateMultiSessionStudySetUseCase {
  constructor(private sessionRepository: ISessionRepository) {}

  /**
   * Execute the use case to create a multi-session study set
   *
   * @param request - Request containing session IDs, title, and optional user ID
   * @returns The newly created multi-session study set
   * @throws Error if sessions not found, belong to different courses, or save fails
   */
  async execute(request: CreateMultiSessionStudySetRequest): Promise<Session> {
    try {
      const { sessionIds, title, userId } = request;

      // Validate input
      if (!sessionIds || sessionIds.length === 0) {
        throw new Error('Must provide at least one session ID');
      }

      if (!title || title.trim().length === 0) {
        throw new Error('Must provide a title for the study set');
      }

      // Load all sessions
      const sessions = await this.loadSessions(sessionIds);

      // Validate all sessions exist
      if (sessions.length !== sessionIds.length) {
        const foundIds = sessions.map(s => s.id);
        const missingIds = sessionIds.filter(id => !foundIds.includes(id));
        throw new Error(`Sessions not found: ${missingIds.join(', ')}`);
      }

      // Validate all sessions belong to the same course
      const courses = new Set(sessions.map(s => s.courseId).filter(Boolean));
      if (courses.size > 1) {
        throw new Error('Cannot create study set from sessions in different courses');
      }

      // Reorder sessions according to the input order
      const orderedSessions = this.orderSessionsByIds(sessions, sessionIds);

      // Create the multi-session study set
      const multiSessionStudySet = MultiSessionMerger.createMultiSessionStudySet(
        orderedSessions,
        title,
        userId
      );

      // Save the new study set to the repository
      await this.sessionRepository.save(multiSessionStudySet);

      return multiSessionStudySet;
    } catch (error) {
      throw new Error(
        `Failed to create multi-session study set: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Load sessions by their IDs
   * @private
   */
  private async loadSessions(sessionIds: string[]): Promise<Session[]> {
    const loadPromises = sessionIds.map(id => this.sessionRepository.findById(id));
    const results = await Promise.all(loadPromises);

    // Filter out null results (sessions not found)
    return results.filter((session): session is Session => session !== null);
  }

  /**
   * Reorder sessions to match the requested order
   * @private
   */
  private orderSessionsByIds(sessions: Session[], orderedIds: string[]): Session[] {
    const sessionMap = new Map(sessions.map(s => [s.id, s]));
    return orderedIds.map(id => sessionMap.get(id)!).filter(Boolean);
  }
}
