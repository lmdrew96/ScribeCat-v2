/**
 * RestoreSessionUseCase
 *
 * Business logic for restoring a soft-deleted session from trash.
 * Application layer - orchestrates domain entities and repositories.
 */

import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { DeletedSessionsTracker } from '../../infrastructure/services/DeletedSessionsTracker.js';

export class RestoreSessionUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private remoteRepository?: ISessionRepository,
    private deletedTracker?: DeletedSessionsTracker
  ) {}

  /**
   * Execute the use case to restore a session from trash
   * @param sessionId The ID of the session to restore
   * @throws Error if session not found or restoration fails
   */
  async execute(sessionId: string): Promise<void> {
    try {
      // Restore the session in local repository
      await this.sessionRepository.restore(sessionId);

      // If session was synced to cloud, also restore in remote repository
      // CRITICAL: Don't catch errors - if cloud restore fails, we need to know about it
      if (this.remoteRepository) {
        try {
          await this.remoteRepository.restore(sessionId);
          console.log(`Restored session ${sessionId} in cloud`);
        } catch (cloudError) {
          // Cloud restore failed - roll back local restore
          console.error(`Cloud restore failed, rolling back local restore: ${cloudError instanceof Error ? cloudError.message : 'Unknown error'}`);
          try {
            await this.sessionRepository.delete(sessionId);
          } catch (rollbackError) {
            console.error(`Failed to roll back local restore: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown error'}`);
          }
          throw cloudError; // Re-throw the original error
        }
      }

      // Remove from deleted tracker only if both local and cloud restore succeeded
      if (this.deletedTracker) {
        try {
          await this.deletedTracker.remove(sessionId);
        } catch (error) {
          console.warn(`Failed to remove session from deleted tracker: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      throw new Error(`Failed to restore session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore multiple sessions
   * @param sessionIds Array of session IDs to restore
   * @returns Object with successful and failed restorations
   */
  async executeMultiple(sessionIds: string[]): Promise<{
    successful: string[];
    failed: Array<{ id: string; error: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const sessionId of sessionIds) {
      try {
        await this.execute(sessionId);
        successful.push(sessionId);
      } catch (error) {
        failed.push({
          id: sessionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { successful, failed };
  }
}
