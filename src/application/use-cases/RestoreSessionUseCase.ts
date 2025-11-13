/**
 * RestoreSessionUseCase
 *
 * Business logic for restoring a soft-deleted session from trash.
 * Application layer - orchestrates domain entities and repositories.
 */

import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { DeletedSessionsTracker } from '../../infrastructure/services/DeletedSessionsTracker.js';
import { SyncOperationQueue, SyncOperationType } from '../../infrastructure/services/sync/SyncOperationQueue.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('RestoreSessionUseCase');

export class RestoreSessionUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private remoteRepository?: ISessionRepository,
    private deletedTracker?: DeletedSessionsTracker,
    private syncQueue?: SyncOperationQueue
  ) {}

  /**
   * Execute the use case to restore a session from trash
   * @param sessionId The ID of the session to restore
   * @throws Error if session not found or restoration fails
   *
   * ROOT CAUSE FIX: Instead of silently failing on cloud/tracker errors,
   * we now queue failed operations for retry with exponential backoff.
   * This ensures eventual consistency between local and cloud.
   */
  async execute(sessionId: string): Promise<void> {
    try {
      // Restore the session in local repository first
      await this.sessionRepository.restore(sessionId);

      // If session was synced to cloud, also restore in remote repository
      if (this.remoteRepository) {
        try {
          await this.remoteRepository.restore(sessionId);
          logger.info(`Restored session ${sessionId} in cloud`);
        } catch (cloudError) {
          logger.error(`Cloud restore failed: ${cloudError instanceof Error ? cloudError.message : 'Unknown error'}`);

          // ROOT CAUSE FIX: Add to retry queue instead of giving up
          if (this.syncQueue) {
            await this.syncQueue.addOperation(
              SyncOperationType.CLOUD_RESTORE,
              sessionId,
              cloudError instanceof Error ? cloudError.message : 'Unknown error'
            );
            logger.info(`Queued cloud restore for retry`);
          }

          // Roll back local restore to maintain consistency
          // If rollback fails, that's a critical error we can't recover from
          try {
            await this.sessionRepository.delete(sessionId);
            logger.info(`Rolled back local restore`);
          } catch (rollbackError) {
            const rollbackMsg = rollbackError instanceof Error ? rollbackError.message : 'Unknown error';
            logger.error(`CRITICAL: Failed to roll back local restore: ${rollbackMsg}`);
            // Log this as a critical inconsistency that needs manual intervention
            throw new Error(`Critical data inconsistency: Local restore succeeded but cloud failed, and rollback failed. Session ${sessionId} may be in inconsistent state.`);
          }

          // Re-throw to let user know the restore failed
          throw new Error(`Cloud restore failed and will be retried automatically: ${cloudError instanceof Error ? cloudError.message : 'Unknown error'}`);
        }
      }

      // Remove from deleted tracker only if both local and cloud restore succeeded
      if (this.deletedTracker) {
        try {
          await this.deletedTracker.remove(sessionId);
          logger.info(`Removed session ${sessionId} from deleted tracker`);
        } catch (trackerError) {
          logger.error(`Failed to remove from deleted tracker: ${trackerError instanceof Error ? trackerError.message : 'Unknown error'}`);

          // ROOT CAUSE FIX: Queue tracker operation for retry
          if (this.syncQueue) {
            await this.syncQueue.addOperation(
              SyncOperationType.TRACKER_REMOVE_DELETED,
              sessionId,
              trackerError instanceof Error ? trackerError.message : 'Unknown error'
            );
            logger.info(`Queued tracker update for retry`);
          }

          // Don't fail the whole operation if tracker fails
          // The session is restored locally and in cloud, tracker will be updated via retry
          logger.warn(`Session restored but tracker update failed - will retry automatically`);
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
