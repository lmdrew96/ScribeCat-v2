/**
 * ExportCoordinator
 *
 * Manages session export operations including single and bulk exports.
 * Coordinates between dialogs, handlers, and Drive upload manager.
 */

import type { Session } from '../../domain/entities/Session.js';
import { ExportDialogs } from './export/ExportDialogs.js';
import { DriveUploadManager } from './export/DriveUploadManager.js';
import { SingleExportHandler } from './export/SingleExportHandler.js';
import { BulkExportHandler } from './export/BulkExportHandler.js';
import { ExportCallbacks } from './export/types.js';

// Re-export types for backwards compatibility
export type { ExportFormat, ExportDestination, ExportOptions, ExportCallbacks } from './export/types.js';

export class ExportCoordinator {
  private driveUploadManager: DriveUploadManager;
  private singleExportHandler: SingleExportHandler;
  private bulkExportHandler: BulkExportHandler;

  constructor() {
    this.driveUploadManager = new DriveUploadManager();
    this.singleExportHandler = new SingleExportHandler(this.driveUploadManager);
    this.bulkExportHandler = new BulkExportHandler(this.driveUploadManager);
  }

  /**
   * Export a single session
   */
  async exportSession(sessionId: string, sessions: Session[]): Promise<void> {
    console.log('Exporting session:', sessionId);

    try {
      // Get the session
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        alert('Session not found');
        return;
      }

      // Show format and destination selection dialog
      const options = await ExportDialogs.showExportOptionsDialog();
      if (!options) {
        return; // User cancelled
      }

      // Delegate to handler
      await this.singleExportHandler.export(sessionId, session, options);
    } catch (error) {
      console.error('Error exporting session:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle bulk export of multiple sessions
   */
  async handleBulkExport(
    selectedSessionIds: Set<string>,
    sessions: Session[],
    bulkExportBtn: HTMLButtonElement | null,
    callbacks?: ExportCallbacks
  ): Promise<void> {
    const sessionIds = Array.from(selectedSessionIds);

    if (sessionIds.length === 0) {
      return;
    }

    try {
      // Show format and destination selection dialog
      const options = await ExportDialogs.showExportOptionsDialog();
      if (!options) {
        return; // User cancelled
      }

      // Delegate to handler
      await this.bulkExportHandler.export(sessionIds, sessions, options, bulkExportBtn, callbacks);
    } catch (error) {
      console.error('Error in bulk export:', error);
      alert(`Bulk export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Restore button state
      if (bulkExportBtn) {
        bulkExportBtn.disabled = false;
        bulkExportBtn.textContent = 'Export Selected';
      }
    }
  }
}
