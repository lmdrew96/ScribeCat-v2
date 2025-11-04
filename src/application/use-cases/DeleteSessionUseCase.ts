/**
 * DeleteSessionUseCase
 * 
 * Business logic for deleting a session and its related files.
 * Application layer - orchestrates domain entities and repositories.
 */

import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { IAudioRepository } from '../../domain/repositories/IAudioRepository.js';
import { DeletedSessionsTracker } from '../../infrastructure/services/DeletedSessionsTracker.js';

export class DeleteSessionUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private audioRepository: IAudioRepository,
    private remoteRepository?: ISessionRepository,
    private deletedTracker?: DeletedSessionsTracker
  ) {}

  /**
   * Execute the use case to delete a session
   * @param sessionId The ID of the session to delete
   * @throws Error if session not found or deletion fails
   */
  async execute(sessionId: string): Promise<void> {
    try {
      // Load the session to get file paths
      const session = await this.sessionRepository.findById(sessionId);
      
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found`);
      }

      // Delete the audio file
      try {
        await this.audioRepository.deleteAudio(session.recordingPath);
      } catch (error) {
        // Log but don't fail if audio file is already missing
        console.warn(`Failed to delete audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Delete any exported files
      for (const exportRecord of session.exportHistory) {
        try {
          // We'll need to implement file deletion in infrastructure
          // For now, just log the export paths that should be deleted
          console.log(`Should delete export file: ${exportRecord.path}`);
        } catch (error) {
          console.warn(`Failed to delete export file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Delete the session metadata from local repository
      await this.sessionRepository.delete(sessionId);

      // If session was synced to cloud, also delete from remote repository
      if (session.cloudId && this.remoteRepository) {
        try {
          await this.remoteRepository.delete(sessionId);
          console.log(`Deleted session ${sessionId} from cloud`);
        } catch (error) {
          // Log but don't fail if cloud deletion fails (session is already deleted locally)
          console.warn(`Failed to delete session from cloud: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Mark session as deleted to prevent re-download during sync
      // Do this regardless of whether cloud deletion succeeded
      if (this.deletedTracker) {
        try {
          await this.deletedTracker.markAsDeleted(sessionId);
        } catch (error) {
          console.warn(`Failed to mark session as deleted in tracker: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
