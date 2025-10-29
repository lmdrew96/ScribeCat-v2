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
   * @returns true if successful, false otherwise
   */
  async execute(
    sessionId: string,
    updates: {
      title?: string;
      notes?: string;
      tags?: string[];
    }
  ): Promise<boolean> {
    try {
      // Load the session
      const session = await this.sessionRepository.findById(sessionId);
      
      if (!session) {
        console.error(`Session not found: ${sessionId}`);
        return false;
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
