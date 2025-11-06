/**
 * GetDeletedSessionsUseCase
 *
 * Business logic for retrieving soft-deleted sessions from trash.
 * Application layer - orchestrates domain entities and repositories.
 */

import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { Session } from '../../domain/entities/Session.js';

export class GetDeletedSessionsUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private remoteRepository?: ISessionRepository
  ) {}

  /**
   * Execute the use case to get all deleted sessions
   * Merges sessions from both local and remote repositories
   * @param userId Optional user ID for cloud repositories
   * @returns Array of deleted sessions sorted by deletion date
   */
  async execute(userId?: string): Promise<Session[]> {
    try {
      // Get deleted sessions from local repository
      const localSessions = await this.sessionRepository.findDeleted(userId);

      // If no remote repository, return local sessions only
      if (!this.remoteRepository) {
        return localSessions;
      }

      // Get deleted sessions from remote repository
      let remoteSessions: Session[] = [];
      try {
        remoteSessions = await this.remoteRepository.findDeleted(userId);
      } catch (error) {
        console.warn(`Failed to fetch deleted sessions from cloud: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Continue with local sessions only
      }

      // Merge sessions from both repositories
      // Use a Map to deduplicate by session ID (prefer cloud version if exists in both)
      const sessionsMap = new Map<string, Session>();

      // Add local sessions first
      for (const session of localSessions) {
        sessionsMap.set(session.id, session);
      }

      // Add/override with remote sessions
      for (const session of remoteSessions) {
        sessionsMap.set(session.id, session);
      }

      // Convert map back to array and sort by deletion date
      const allSessions = Array.from(sessionsMap.values());
      return allSessions.sort((a, b) => {
        if (!a.deletedAt || !b.deletedAt) return 0;
        return b.deletedAt.getTime() - a.deletedAt.getTime();
      });

    } catch (error) {
      throw new Error(`Failed to get deleted sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
