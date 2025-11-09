/**
 * SessionDeletionManager
 *
 * Handles all session deletion operations:
 * - Single session deletion with trash/restore
 * - Bulk session deletion
 * - Leaving shared sessions
 *
 * Extracted from StudyModeManager for better separation of concerns.
 */

import { Session } from '../../../domain/entities/Session.js';
import { SessionSharingManager } from '../SessionSharingManager.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('SessionDeletionManager');

export class SessionDeletionManager {
  constructor(private sessionSharingManager: SessionSharingManager) {}

  /**
   * Delete a single session (moves to trash)
   *
   * @param session - Session to delete
   * @param onComplete - Callback after successful deletion
   */
  public async deleteSession(session: Session, onComplete: () => void): Promise<void> {
    // Show confirmation dialog
    const confirmed = confirm(
      `Delete "${session.title}"?\n\n` +
      `This will move the session to trash where it will be kept for 30 days.\n` +
      `You can restore it from trash before it's permanently deleted.`
    );

    if (!confirmed) {
      return;
    }

    try {
      // Delete via IPC
      const result = await window.scribeCat.session.delete(session.id);

      if (result.success) {
        logger.info('Session deleted successfully');
        onComplete();
      } else {
        logger.error('Failed to delete session', result.error);
        alert(`Failed to delete session: ${result.error}`);
      }
    } catch (error) {
      logger.error('Error deleting session', error);
      alert('An error occurred while deleting the session.');
    }
  }

  /**
   * Leave a shared session (remove yourself as recipient)
   *
   * @param session - Session to leave
   * @param sharedWithMeSessions - Array of shares received by current user
   * @param onComplete - Callback after successfully leaving
   */
  public async leaveSession(
    session: Session,
    sharedWithMeSessions: any[],
    onComplete: () => void
  ): Promise<void> {
    // Find the share ID for this session
    const share = sharedWithMeSessions.find((s: any) => s.sessions?.id === session.id);
    if (!share) {
      logger.error('Share not found for session', session.id);
      alert('Could not find share information for this session.');
      return;
    }

    // Show confirmation dialog
    const confirmed = confirm(
      `Leave "${session.title}"?\n\n` +
      `This session will be removed from your list. The owner can share it with you again later.`
    );

    if (!confirmed) {
      return;
    }

    try {
      // Revoke access via IPC
      const result = await this.sessionSharingManager.revokeAccess(share.id);

      if (result.success) {
        logger.info('Left shared session successfully');
        onComplete();
      } else {
        logger.error('Failed to leave session', result.error);
        alert(`Failed to leave session: ${result.error}`);
      }
    } catch (error) {
      logger.error('Error leaving session', error);
      alert('An error occurred while leaving the session.');
    }
  }

  /**
   * Delete multiple sessions in bulk (moves to trash)
   *
   * @param sessionIds - Set of session IDs to delete
   * @param onComplete - Callback after bulk deletion completes
   */
  public async handleBulkDelete(sessionIds: Set<string>, onComplete: () => void): Promise<void> {
    const sessionIdsArray = Array.from(sessionIds);

    if (sessionIdsArray.length === 0) {
      return;
    }

    const confirmed = confirm(
      `Delete ${sessionIdsArray.length} session${sessionIdsArray.length > 1 ? 's' : ''}?\n\n` +
      `This will move the sessions to trash where they will be kept for 30 days.\n` +
      `You can restore them from trash before they're permanently deleted.`
    );

    if (!confirmed) {
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      // Delete each session
      for (const sessionId of sessionIdsArray) {
        try {
          const result = await window.scribeCat.session.delete(sessionId);
          if (result.success) {
            successCount++;
          } else {
            failCount++;
            logger.error(`Failed to delete session ${sessionId}`, result.error);
          }
        } catch (error) {
          failCount++;
          logger.error(`Error deleting session ${sessionId}`, error);
        }
      }

      // Show result
      if (failCount === 0) {
        logger.info(`Successfully deleted ${successCount} session(s)`);
      } else {
        alert(`Deleted ${successCount} session(s).\nFailed to delete ${failCount} session(s).`);
      }

      onComplete();

    } catch (error) {
      logger.error('Error during bulk delete', error);
      alert('An error occurred during bulk delete.');
    }
  }
}
