/**
 * NotesEditCoordinator
 *
 * Coordinates notes editing operations:
 * - Starting notes edit mode
 * - Saving edited notes
 * - Canceling edit mode
 *
 * Extracted from StudyModeManager for better separation of concerns.
 */

import { Session } from '../../../domain/entities/Session.js';
import { StudyModeNotesEditorManager } from './StudyModeNotesEditorManager.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('NotesEditCoordinator');

export class NotesEditCoordinator {
  constructor(private notesEditorManager: StudyModeNotesEditorManager) {}

  /**
   * Start editing notes for a session
   *
   * @param session - Session to edit
   */
  public startNotesEdit(session: Session | undefined): void {
    if (session) {
      this.notesEditorManager.startNotesEdit(session.id, session.notes || '');
    }
  }

  /**
   * Save edited notes
   *
   * @param session - Session being edited
   */
  public async saveNotesEdit(session: Session | undefined): Promise<void> {
    if (!this.notesEditorManager.isEditing() || !session) {
      return;
    }

    const updatedNotes = this.notesEditorManager.getNotesHTML();

    try {
      // Update session notes via IPC
      const result = await window.scribeCat.session.update(session.id, { notes: updatedNotes });

      if (result.success) {
        // Update local session
        session.notes = updatedNotes;

        logger.info('Notes updated successfully');

        // Exit edit mode and update view
        this.notesEditorManager.updateNotesView(updatedNotes);
      } else {
        logger.error('Failed to update notes', result.error);
        alert(`Failed to save notes: ${result.error}`);
      }
    } catch (error) {
      logger.error('Error updating notes', error);
      alert('An error occurred while saving notes.');
    }
  }

  /**
   * Cancel notes editing
   *
   * @param session - Session being edited
   */
  public cancelNotesEdit(session: Session | undefined): void {
    if (confirm('Discard your changes?')) {
      if (session) {
        this.notesEditorManager.updateNotesView(session.notes || '');
      }
    }
  }
}
