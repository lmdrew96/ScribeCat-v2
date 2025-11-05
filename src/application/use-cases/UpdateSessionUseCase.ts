import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';

/**
 * UpdateSessionUseCase
 * 
 * Updates session properties like title, notes, and tags.
 */
export class UpdateSessionUseCase {
  constructor(private sessionRepository: ISessionRepository) {}

  /**
   * Update session properties
   * @param sessionId - The session ID to update
   * @param updates - Object containing properties to update
   * @param currentUserId - Current user ID for auto-claiming orphaned sessions
   * @returns true if successful, false otherwise
   */
  async execute(
    sessionId: string,
    updates: {
      title?: string;
      notes?: string;
      tags?: string[];
    },
    currentUserId?: string | null
  ): Promise<boolean> {
    try {
      // Load the session
      const session = await this.sessionRepository.findById(sessionId);

      if (!session) {
        console.error(`Session not found: ${sessionId}`);
        return false;
      }

      // Auto-claim orphaned sessions
      // If the session has no userId (orphaned) and we have a current user, claim it
      if (!session.userId && currentUserId) {
        console.log(`Auto-claiming orphaned session ${sessionId} for user ${currentUserId}`);
        session.userId = currentUserId;
      }

      // Apply updates
      if (updates.title !== undefined) {
        session.title = updates.title;
      }

      if (updates.notes !== undefined) {
        session.notes = updates.notes;
      }

      if (updates.tags !== undefined) {
        session.tags = updates.tags;
      }

      // Save the updated session
      await this.sessionRepository.save(session);

      console.log(`Session updated successfully: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('Error updating session:', error);
      return false;
    }
  }
}
