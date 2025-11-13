/**
 * DeleteSessionUseCase
 * 
 * Business logic for deleting a session and its related files.
 * Application layer - orchestrates domain entities and repositories.
 */

import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { IAudioRepository } from '../../domain/repositories/IAudioRepository.js';
import { DeletedSessionsTracker } from '../../infrastructure/services/DeletedSessionsTracker.js';
import { SyncOperationQueue, SyncOperationType } from '../../infrastructure/services/sync/SyncOperationQueue.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('DeleteSessionUseCase');

export class DeleteSessionUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private audioRepository: IAudioRepository,
    private remoteRepository?: ISessionRepository,
    private deletedTracker?: DeletedSessionsTracker,
    private syncQueue?: SyncOperationQueue
  ) {}

  /**
   * Execute the use case to delete a session (soft delete)
   * Moves the session to trash. Audio files and session data are kept for 30 days.
   * @param sessionId The ID of the session to delete
   * @throws Error if session not found or deletion fails
   *
   * ROOT CAUSE FIX: Instead of silently failing on cloud/tracker errors,
   * we now queue failed operations for retry with exponential backoff.
   * This ensures eventual consistency between local and cloud.
   */
  async execute(sessionId: string): Promise<void> {
    try {
      // Load the session to verify it exists
      const session = await this.sessionRepository.findById(sessionId);

      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found`);
      }

      // NOTE: We do NOT delete audio files during soft delete
      // Audio files will be kept until the session is permanently deleted (after 30 days in trash)

      // NOTE: We do NOT delete exported files - user wants to keep them permanently

      // Soft delete the session metadata from local repository
      await this.sessionRepository.delete(sessionId);
      logger.info(`Deleted session ${sessionId} locally`);

      // If session was synced to cloud, also delete from remote repository
      if (session.cloudId && this.remoteRepository) {
        try {
          await this.remoteRepository.delete(sessionId);
          logger.info(`Deleted session ${sessionId} from cloud`);
        } catch (cloudError) {
          logger.error(`Failed to delete session from cloud: ${cloudError instanceof Error ? cloudError.message : 'Unknown error'}`);

          // ROOT CAUSE FIX: Queue cloud deletion for retry instead of giving up
          if (this.syncQueue) {
            await this.syncQueue.addOperation(
              SyncOperationType.CLOUD_DELETE,
              sessionId,
              cloudError instanceof Error ? cloudError.message : 'Unknown error'
            );
            logger.info(`Queued cloud deletion for retry`);
          }

          // Don't fail the whole operation - session is deleted locally
          // Cloud deletion will be retried automatically
          logger.warn(`Session deleted locally but cloud deletion failed - will retry automatically`);
        }
      }

      // Mark session as deleted to prevent re-download during sync
      // Do this regardless of whether cloud deletion succeeded
      if (this.deletedTracker) {
        try {
          await this.deletedTracker.markAsDeleted(sessionId);
          logger.info(`Marked session ${sessionId} as deleted in tracker`);
        } catch (trackerError) {
          logger.error(`Failed to mark session as deleted in tracker: ${trackerError instanceof Error ? trackerError.message : 'Unknown error'}`);

          // ROOT CAUSE FIX: Queue tracker operation for retry
          if (this.syncQueue) {
            await this.syncQueue.addOperation(
              SyncOperationType.TRACKER_MARK_DELETED,
              sessionId,
              trackerError instanceof Error ? trackerError.message : 'Unknown error'
            );
            logger.info(`Queued tracker update for retry`);
          }

          // Don't fail the whole operation if tracker fails
          // The session is deleted locally (and potentially in cloud), tracker will be updated via retry
          logger.warn(`Session deleted but tracker update failed - will retry automatically`);
        }
      }

    } catch (error) {
      throw new Error(`Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete multiple sessions
   * @param sessionIds Array of session IDs to delete
   * @returns Object with successful and failed deletions
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
