/**
 * BulkExportHandler
 *
 * Handles bulk session export operations.
 */

import { Session } from '../../../domain/entities/Session.js';
import { ExportOptions, ExportCallbacks } from './types.js';
import { DriveUploadManager } from './DriveUploadManager.js';

export class BulkExportHandler {
  constructor(private driveUploadManager: DriveUploadManager) {}

  /**
   * Handle bulk export of multiple sessions
   */
  async export(
    sessionIds: string[],
    sessions: Session[],
    options: ExportOptions,
    bulkExportBtn: HTMLButtonElement | null,
    callbacks?: ExportCallbacks
  ): Promise<void> {
    if (sessionIds.length === 0) {
      return;
    }

    try {
      let outputDirectory: string = '';

      // For local or both destinations, let user choose the location
      if (options.destination === 'local' || options.destination === 'both') {
        outputDirectory = await this.selectOutputDirectory(sessionIds, sessions, options.format);
        if (!outputDirectory) {
          return; // User cancelled or error
        }
      } else {
        // For Drive-only, use temp directory
        const tempPathResult = await window.scribeCat.dialog.getTempPath();
        if (!tempPathResult.success || !tempPathResult.data) {
          alert('Failed to get temp directory');
          return;
        }
        outputDirectory = `${tempPathResult.data}/scribecat_bulk_${Date.now()}`;
      }

      // Disable export button during process
      if (bulkExportBtn) {
        bulkExportBtn.disabled = true;
        bulkExportBtn.textContent = 'Exporting...';
      }

      // Export all sessions
      const { successCount, errorCount, exportedFiles } = await this.exportAllSessions(
        sessionIds,
        sessions,
        options.format,
        outputDirectory,
        bulkExportBtn
      );

      // Restore button state
      if (bulkExportBtn) {
        bulkExportBtn.disabled = false;
        bulkExportBtn.textContent = 'Export Selected';
      }

      // Handle Drive upload if requested
      if (successCount > 0 && (options.destination === 'drive' || options.destination === 'both')) {
        await this.driveUploadManager.uploadBulk(sessionIds, sessions, options.format, outputDirectory);

        // Clean up temp files if Drive-only
        if (options.destination === 'drive') {
          for (const filePath of exportedFiles) {
            try {
              await window.scribeCat.dialog.deleteFile(filePath);
            } catch (error) {
              console.error('Failed to delete temp file:', error);
            }
          }
        }
      } else if (options.destination === 'local') {
        // Show results for local-only export
        const message = successCount > 0
          ? `Successfully exported ${successCount} session${successCount > 1 ? 's' : ''} to:\n${outputDirectory}\n\n${errorCount > 0 ? `${errorCount} session${errorCount > 1 ? 's' : ''} failed.` : ''}`
          : `Export failed for all sessions.`;

        alert(message);
      }

      // Notify completion
      if (callbacks?.onBulkExportComplete) {
        callbacks.onBulkExportComplete();
      }
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

  /**
   * Select output directory for bulk export
   */
  private async selectOutputDirectory(
    sessionIds: string[],
    sessions: Session[],
    format: string
  ): Promise<string> {
    const firstSession = sessions.find(s => s.id === sessionIds[0]);
    if (!firstSession) {
      alert('Session not found');
      return '';
    }

    const sanitizedTitle = firstSession.title.replace(/[^a-z0-9]/gi, '_');
    const defaultFilename = `${sanitizedTitle}.${format}`;

    const result = await window.scribeCat.dialog.showSaveDialog({
      title: 'Export Sessions - Choose Location',
      defaultPath: defaultFilename,
      filters: [
        { name: this.getFormatName(format), extensions: [format] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.success || !result.data || result.data.canceled || !result.data.filePath) {
      return ''; // User cancelled or error
    }

    // Get the directory from the first file path
    return result.data.filePath.substring(0, result.data.filePath.lastIndexOf('/'));
  }

  /**
   * Export all sessions to files
   */
  private async exportAllSessions(
    sessionIds: string[],
    sessions: Session[],
    format: string,
    outputDirectory: string,
    bulkExportBtn: HTMLButtonElement | null
  ): Promise<{ successCount: number; errorCount: number; exportedFiles: string[] }> {
    let successCount = 0;
    let errorCount = 0;
    const exportedFiles: string[] = [];

    for (let i = 0; i < sessionIds.length; i++) {
      const sessionId = sessionIds[i];
      const session = sessions.find(s => s.id === sessionId);

      if (!session) {
        errorCount++;
        continue;
      }

      // Generate output path
      const sanitizedTitle = session.title.replace(/[^a-z0-9]/gi, '_');
      const outputPath = `${outputDirectory}/${sanitizedTitle}.${format}`;

      // Export the session
      try {
        const exportResult = await window.scribeCat.session.exportWithDefaults(
          sessionId,
          format,
          outputPath
        );

        if (exportResult.success) {
          successCount++;
          exportedFiles.push(outputPath);
        } else {
          errorCount++;
          console.error(`Failed to export session ${sessionId}:`, exportResult.error);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error exporting session ${sessionId}:`, error);
      }

      // Update button text with progress
      if (bulkExportBtn) {
        bulkExportBtn.textContent = `Exporting... (${i + 1}/${sessionIds.length})`;
      }
    }

    return { successCount, errorCount, exportedFiles };
  }

  /**
   * Get human-readable format name
   */
  private getFormatName(format: string): string {
    const names: Record<string, string> = {
      txt: 'Plain Text',
      pdf: 'PDF Document',
      docx: 'Word Document',
      html: 'HTML Page'
    };
    return names[format] || format.toUpperCase();
  }
}
