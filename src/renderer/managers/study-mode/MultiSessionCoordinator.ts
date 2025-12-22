/**
 * MultiSessionCoordinator
 *
 * Handles multi-session study set operations:
 * - Creating multi-session study sets
 * - Opening reorder modal for session grouping
 *
 * Extracted from StudyModeManager for better separation of concerns.
 */

import { Session } from '../../../domain/entities/Session.js';
import { SessionReorderModal } from './SessionReorderModal.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('MultiSessionCoordinator');

export class MultiSessionCoordinator {
  constructor(private reorderModal: SessionReorderModal) {}

  /**
   * Open reorder modal for creating multi-session study sets
   *
   * @param sessions - Sessions to include in the study set
   * @param onComplete - Callback after study set creation
   */
  public handleOpenReorderModal(sessions: Session[], onComplete: (sessionIds: string[], title: string) => void): void {
    this.reorderModal.show(sessions, onComplete);
  }

  /**
   * Create a multi-session study set
   *
   * @param sessionIds - Session IDs to include
   * @param title - Title for the study set
   * @param onSuccess - Callback after successful creation with new session ID
   */
  public async createMultiSessionStudySet(
    sessionIds: string[],
    title: string,
    onSuccess: (newSessionId: string) => Promise<void>
  ): Promise<void> {
    try {
      logger.info('Creating multi-session study set', { sessionIds, title });

      // Call IPC to create the study set
      const result = await (window as any).scribeCat.session.createMultiSessionStudySet(sessionIds, title);

      if (result.success) {
        logger.info('Multi-session study set created successfully', result.session);

        // Show success notification
        alert(`Study set "${title}" created successfully!`);

        // Optionally, open the newly created study set
        if (result.session?.id) {
          await onSuccess(result.session.id);
        }
      } else {
        const errorMsg = (result as any).error || 'Unknown error';
        logger.error('Failed to create multi-session study set:', errorMsg);
        alert(`Failed to create study set: ${errorMsg}`);
      }
    } catch (error) {
      logger.error('Error creating multi-session study set', error);
      alert('An error occurred while creating the study set.');
    }
  }
}
