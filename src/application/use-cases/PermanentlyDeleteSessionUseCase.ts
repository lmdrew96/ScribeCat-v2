/**
 * PermanentlyDeleteSessionUseCase
 *
 * Business logic for permanently deleting a session and its related files.
 * This is a hard delete that removes everything except exported files.
 * Application layer - orchestrates domain entities and repositories.
 */

import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { IAudioRepository } from '../../domain/repositories/IAudioRepository.js';

export class PermanentlyDeleteSessionUseCase {
  constructor(
    private sessionRepository: ISessionRepository,
    private audioRepository: IAudioRepository,
    private remoteRepository?: ISessionRepository
  ) {}

  /**
   * Execute the use case to permanently delete a session
   * @param sessionId The ID of the session to permanently delete
   * @throws Error if deletion fails
   */
  async execute(sessionId: string): Promise<void> {
    try {
      // Try to load the session to get file paths for cleanup
      // Note: findById excludes deleted sessions, so this may return null for trashed sessions
      let session;
      try {
        session = await this.sessionRepository.findById(sessionId);
      } catch (error) {
        console.warn('Could not load session metadata, will proceed with deletion');
      }

      // Delete the audio file if we have the session metadata
      if (session) {
        try {
          await this.audioRepository.deleteAudio(session.recordingPath);
        } catch (error) {
          // Log but don't fail if audio file is already missing
          console.warn(`Failed to delete audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // NOTE: We do NOT delete exported files - user wants to keep them

      // Delete from remote repository FIRST (if available)
      // CRITICAL: Always try to delete from cloud, even if findById returned null
      // Trashed sessions won't be found by findById but still exist in cloud
      if (this.remoteRepository) {
        try {
          await this.remoteRepository.permanentlyDelete(sessionId);
          console.log(`Permanently deleted session ${sessionId} from cloud`);
        } catch (cloudError) {
          // Check if error is because session doesn't exist (already deleted)
          const errorMessage = cloudError instanceof Error ? cloudError.message : 'Unknown error';
          if (errorMessage.includes('not found') || errorMessage.includes('already been deleted')) {
            console.warn(`Session ${sessionId} not found in cloud (may have been auto-deleted), continuing with local deletion`);
          } else {
            // Other errors should fail the operation
            console.error(`Failed to delete session from cloud: ${errorMessage}`);
            throw cloudError;
          }
        }
      }

      // Permanently delete the session metadata from local repository
      // This will remove the JSON file even if it has deletedAt set
      await this.sessionRepository.permanentlyDelete(sessionId);

    } catch (error) {
      throw new Error(`Failed to permanently delete session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Permanently delete multiple sessions
   * @param sessionIds Array of session IDs to permanently delete
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
