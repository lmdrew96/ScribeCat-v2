import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';

/**
 * UpdateSessionUseCase
 *
 * Updates session properties like title, notes, tags, and course information.
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
      courseId?: string;
      courseTitle?: string;
      courseNumber?: string;
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

      // Update course information if any course field is provided
      if (updates.courseId !== undefined || updates.courseTitle !== undefined || updates.courseNumber !== undefined) {
        session.updateCourse(
          updates.courseId !== undefined ? updates.courseId : session.courseId,
          updates.courseTitle !== undefined ? updates.courseTitle : session.courseTitle,
          updates.courseNumber !== undefined ? updates.courseNumber : session.courseNumber
        );
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
