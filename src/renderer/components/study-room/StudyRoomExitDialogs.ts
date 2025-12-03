/**
 * StudyRoomExitDialogs
 *
 * Handles host/non-host exit dialogs and room leave/close operations.
 */

import type { StudyRoomsManager } from '../../managers/social/StudyRoomsManager.js';
import { ModalDialog } from '../shared/ModalDialog.js';

export class StudyRoomExitDialogs {
  /**
   * Show appropriate exit dialog based on user role
   */
  static show(
    roomId: string,
    currentUserId: string,
    studyRoomsManager: StudyRoomsManager,
    onLeave: () => Promise<void>,
    onClose: () => Promise<void>
  ): void {
    const room = studyRoomsManager.getRoomById(roomId);
    if (!room) return;

    const isHost = room.hostId === currentUserId;

    if (isHost) {
      StudyRoomExitDialogs.showHostDialog(onLeave, onClose);
    } else {
      StudyRoomExitDialogs.showNonHostDialog(onLeave);
    }
  }

  /**
   * Show exit dialog for hosts with 3 options: Cancel, Exit, Exit & Close
   */
  private static showHostDialog(
    onLeave: () => Promise<void>,
    onClose: () => Promise<void>
  ): void {
    const modal = new ModalDialog({
      title: 'Exit Study Room',
      content: 'You are the host. What would you like to do?',
      buttons: [
        {
          text: 'Cancel',
          type: 'secondary',
          onClick: () => { /* Stay in room */ }
        },
        {
          text: 'Exit',
          type: 'secondary',
          onClick: () => onLeave()
        },
        {
          text: 'Exit & Close',
          type: 'danger',
          onClick: () => onClose()
        }
      ],
      closeOnOverlay: false,
      closeOnEscape: true
    });
    modal.show();
  }

  /**
   * Show exit dialog for non-hosts with confirmation
   */
  private static showNonHostDialog(onLeave: () => Promise<void>): void {
    const modal = new ModalDialog({
      title: 'Leave Study Room',
      content: 'Are you sure you want to leave? You can rejoin later without a new invitation.',
      buttons: [
        {
          text: 'Cancel',
          type: 'secondary',
          onClick: () => { /* Stay in room */ }
        },
        {
          text: 'Leave',
          type: 'primary',
          onClick: () => onLeave()
        }
      ],
      closeOnOverlay: true,
      closeOnEscape: true
    });
    modal.show();
  }

  /**
   * Perform leave room operation with retry
   */
  static async performLeaveRoom(
    roomId: string,
    studyRoomsManager: StudyRoomsManager,
    onSuccess: () => void
  ): Promise<void> {
    try {
      await StudyRoomExitDialogs.retryWithBackoff(
        () => studyRoomsManager.leaveRoom(roomId),
        3,
        500
      );
      onSuccess();
    } catch (error) {
      console.error('Failed to leave room after retries:', error);
      ModalDialog.alert('Error', 'Failed to leave room. Please try again.');
    }
  }

  /**
   * Perform close room operation with retry (host only)
   */
  static async performCloseRoom(
    roomId: string,
    studyRoomsManager: StudyRoomsManager,
    onSuccess: () => void
  ): Promise<void> {
    try {
      await StudyRoomExitDialogs.retryWithBackoff(
        () => studyRoomsManager.closeRoom(roomId),
        3,
        500
      );
      onSuccess();
    } catch (error) {
      console.error('Failed to close room after retries:', error);
      ModalDialog.alert('Error', 'Failed to close room. Please try again.');
    }
  }

  /**
   * Retry a function with exponential backoff
   */
  private static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 500
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}
