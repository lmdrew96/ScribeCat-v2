/**
 * ListSessionsUseCase
 * 
 * Business logic for retrieving all sessions sorted by date.
 * Application layer - orchestrates domain entities and repositories.
 */

import { Session } from '../../domain/entities/Session.js';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';

export class ListSessionsUseCase {
  constructor(private sessionRepository: ISessionRepository) {}

  /**
   * Execute the use case to list all sessions
   * @param sortOrder 'asc' for oldest first, 'desc' for newest first
   * @returns Array of sessions sorted by creation date
   */
  async execute(sortOrder: 'asc' | 'desc' = 'desc'): Promise<Session[]> {
    try {
      // Get all sessions from repository
      const sessions = await this.sessionRepository.findAll();

      // Sort by creation date
      const sorted = sessions.sort((a, b) => {
        const dateA = a.createdAt.getTime();
        const dateB = b.createdAt.getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });

      return sorted;
    } catch (error) {
      throw new Error(`Failed to list sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List sessions filtered by tags
   * @param tags Array of tags to filter by
   * @param sortOrder Sort order for results
   * @returns Sessions that have any of the specified tags
   */
  async executeWithTags(tags: string[], sortOrder: 'asc' | 'desc' = 'desc'): Promise<Session[]> {
    try {
      const allSessions = await this.execute(sortOrder);
      
      if (tags.length === 0) {
        return allSessions;
      }

      // Normalize tags for comparison
      const normalizedTags = tags.map(tag => tag.trim().toLowerCase());

      // Filter sessions that have at least one matching tag
      return allSessions.filter(session => 
        session.getTags().some(tag => normalizedTags.includes(tag))
      );
    } catch (error) {
      throw new Error(`Failed to list sessions with tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
