/**
 * StudyModeSessionOperations
 *
 * Coordinates session operations like editing, deletion, sharing, and export.
 */

import { Session } from '../../../domain/entities/Session.js';
import { SessionEditingManager } from './SessionEditingManager.js';
import { SessionDeletionManager } from './SessionDeletionManager.js';
import { SessionNavigationManager } from './SessionNavigationManager.js';
import { SessionDataLoader } from './SessionDataLoader.js';
import { NotesEditCoordinator } from './NotesEditCoordinator.js';
import { StudyModeNotesEditorManager } from './StudyModeNotesEditorManager.js';
import { StudyModeDetailViewManager } from './StudyModeDetailViewManager.js';
import { ExportCoordinator } from '../../services/ExportCoordinator.js';
import { ShareModal } from '../../components/ShareModal.js';
import { BulkSelectionManager } from './BulkSelectionManager.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('StudyModeSessionOperations');

export interface SessionOperationsCallbacks {
  getSessions: () => Session[];
  loadSessions: () => Promise<void>;
  updateSessions: (sessions: Session[]) => void;
  backToSessionList: () => void;
  isInDetailView: () => boolean;
}

export class StudyModeSessionOperations {
  private sessionEditingManager: SessionEditingManager;
  private sessionDeletionManager: SessionDeletionManager;
  private sessionNavigationManager: SessionNavigationManager;
  private sessionDataLoader: SessionDataLoader;
  private notesEditCoordinator: NotesEditCoordinator;
  private notesEditorManager: StudyModeNotesEditorManager;
  private detailViewManager: StudyModeDetailViewManager;
  private exportCoordinator: ExportCoordinator;
  private shareModal: ShareModal;
  private bulkSelectionManager: BulkSelectionManager;
  private callbacks: SessionOperationsCallbacks;

  constructor(
    sessionEditingManager: SessionEditingManager,
    sessionDeletionManager: SessionDeletionManager,
    sessionNavigationManager: SessionNavigationManager,
    sessionDataLoader: SessionDataLoader,
    notesEditCoordinator: NotesEditCoordinator,
    notesEditorManager: StudyModeNotesEditorManager,
    detailViewManager: StudyModeDetailViewManager,
    exportCoordinator: ExportCoordinator,
    shareModal: ShareModal,
    bulkSelectionManager: BulkSelectionManager,
    callbacks: SessionOperationsCallbacks
  ) {
    this.sessionEditingManager = sessionEditingManager;
    this.sessionDeletionManager = sessionDeletionManager;
    this.sessionNavigationManager = sessionNavigationManager;
    this.sessionDataLoader = sessionDataLoader;
    this.notesEditCoordinator = notesEditCoordinator;
    this.notesEditorManager = notesEditorManager;
    this.detailViewManager = detailViewManager;
    this.exportCoordinator = exportCoordinator;
    this.shareModal = shareModal;
    this.bulkSelectionManager = bulkSelectionManager;
    this.callbacks = callbacks;
  }

  /**
   * Start editing a session title (list view)
   */
  startTitleEdit(sessionId: string): void {
    const session = this.callbacks.getSessions().find(s => s.id === sessionId);
    if (!session) return;

    this.sessionEditingManager.startTitleEdit(session, 'list', () => {
      this.callbacks.updateSessions(this.callbacks.getSessions());
    });
  }

  /**
   * Start editing title in detail view
   */
  startDetailTitleEdit(sessionId: string): void {
    const session = this.callbacks.getSessions().find(s => s.id === sessionId);
    if (!session) return;

    this.sessionEditingManager.startTitleEdit(session, 'detail', () => {
      const isEditable = this.sessionNavigationManager.isSessionEditable(session);
      this.detailViewManager.render(session, isEditable);
      this.callbacks.updateSessions(this.callbacks.getSessions());
    });
  }

  /**
   * Start course editing for detail view
   */
  async startCourseEdit(sessionId: string): Promise<void> {
    const session = this.callbacks.getSessions().find(s => s.id === sessionId);
    if (!session) return;

    await this.sessionEditingManager.startCourseEdit(session, () => {
      const isEditable = this.sessionNavigationManager.isSessionEditable(session);
      this.detailViewManager.render(session, isEditable);
      this.callbacks.updateSessions(this.callbacks.getSessions());
    });
  }

  /**
   * Start editing notes
   */
  startNotesEdit(sessionId: string): void {
    this.notesEditCoordinator.startNotesEdit(
      this.callbacks.getSessions().find(s => s.id === sessionId)
    );
  }

  /**
   * Save edited notes
   */
  async saveNotesEdit(sessionId: string): Promise<void> {
    await this.notesEditCoordinator.saveNotesEdit(
      this.callbacks.getSessions().find(s => s.id === sessionId)
    );
  }

  /**
   * Cancel notes editing
   */
  cancelNotesEdit(): void {
    const sessionId = this.notesEditorManager.getCurrentEditingSessionId();
    this.notesEditCoordinator.cancelNotesEdit(
      sessionId ? this.callbacks.getSessions().find(s => s.id === sessionId) : undefined
    );
  }

  /**
   * Export a session
   */
  exportSession(sessionId: string): void {
    this.exportCoordinator.exportSession(sessionId, this.callbacks.getSessions());
  }

  /**
   * Delete a session with confirmation
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = this.callbacks.getSessions().find(s => s.id === sessionId);
    if (!session) {
      logger.error('Session not found', sessionId);
      return;
    }

    await this.sessionDeletionManager.deleteSession(session, async () => {
      if (this.callbacks.isInDetailView()) {
        this.callbacks.backToSessionList();
      }
      await this.callbacks.loadSessions();
      this.bulkSelectionManager.clearSelection();
    });
  }

  /**
   * Leave a shared session
   */
  async leaveSession(sessionId: string): Promise<void> {
    const session = this.callbacks.getSessions().find(s => s.id === sessionId);
    if (!session) {
      logger.error('Session not found', sessionId);
      return;
    }

    await this.sessionDeletionManager.leaveSession(
      session,
      this.sessionDataLoader.getSharedWithMeSessions(),
      async () => {
        if (this.callbacks.isInDetailView()) {
          this.callbacks.backToSessionList();
        }
        await this.callbacks.loadSessions();
        this.bulkSelectionManager.clearSelection();
      }
    );
  }

  /**
   * Open share modal
   */
  openShareModal(sessionId: string): void {
    if (this.shareModal) {
      this.shareModal.open(sessionId);
    } else {
      logger.error('ShareModal not available');
      alert('Share feature is not available');
    }
  }

  /**
   * Handle bulk export
   */
  handleBulkExport(sessionIds: Set<string>): void {
    const bulkExportBtn = document.getElementById('bulk-export-btn') as HTMLButtonElement;
    this.exportCoordinator.handleBulkExport(
      sessionIds,
      this.callbacks.getSessions(),
      bulkExportBtn,
      {
        onBulkExportComplete: () => {
          this.bulkSelectionManager.clearSelection();
        }
      }
    );
  }

  /**
   * Handle bulk delete
   */
  async handleBulkDelete(sessionIds: Set<string>): Promise<void> {
    await this.sessionDeletionManager.handleBulkDelete(sessionIds, async () => {
      this.bulkSelectionManager.clearSelection();
      await this.callbacks.loadSessions();
    });
  }
}
