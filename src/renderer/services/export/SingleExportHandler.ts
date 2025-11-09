/**
 * SingleExportHandler
 *
 * Handles single session export operations.
 */

import { Session } from '../../../domain/entities/Session.js';
import { ExportOptions } from './types.js';
import { DriveUploadManager } from './DriveUploadManager.js';

export class SingleExportHandler {
  constructor(private driveUploadManager: DriveUploadManager) {}

  /**
   * Export a single session
   */
  async export(sessionId: string, session: Session, options: ExportOptions): Promise<void> {
    // Sanitize the session title for use in filename
    const sanitizedTitle = session.title.replace(/[^a-z0-9]/gi, '_');
    const defaultFilename = `${sanitizedTitle}.${options.format}`;

    // Show exporting indicator
    const exportButton = document.querySelector(`[data-session-id="${sessionId}"].export-session-btn`) as HTMLButtonElement;
    const originalText = exportButton?.textContent || 'Export';
    if (exportButton) {
      exportButton.disabled = true;
      exportButton.textContent = 'Exporting...';
    }

    let filePath: string | null = null;
    let exportResult: any = null;

    try {
      // Handle different destinations
      if (options.destination === 'local' || options.destination === 'both') {
        filePath = await this.exportToLocal(sessionId, defaultFilename, options.format);
        if (!filePath) {
          // User cancelled or error
          if (exportButton) {
            exportButton.disabled = false;
            exportButton.textContent = originalText;
          }
          return;
        }
      } else if (options.destination === 'drive') {
        // Export to temp file for Drive-only export
        const tempPathResult = await window.scribeCat.dialog.getTempPath();
        if (!tempPathResult.success || !tempPathResult.data) {
          if (exportButton) {
            exportButton.disabled = false;
            exportButton.textContent = originalText;
          }
          alert('Failed to get temp directory');
          return;
        }

        const tempPath = `${tempPathResult.data}/scribecat_temp_${Date.now()}.${options.format}`;

        exportResult = await window.scribeCat.session.exportWithDefaults(
          sessionId,
          options.format,
          tempPath
        );

        if (!exportResult.success) {
          if (exportButton) {
            exportButton.disabled = false;
            exportButton.textContent = originalText;
          }
          alert(`Export failed: ${exportResult.error || 'Unknown error'}`);
          return;
        }

        filePath = tempPath;
      }

      // Handle Drive upload
      if (options.destination === 'drive' || options.destination === 'both') {
        await this.driveUploadManager.uploadFile(filePath!, session.title);

        // Clean up temp file if Drive-only
        if (options.destination === 'drive' && filePath) {
          try {
            await window.scribeCat.dialog.deleteFile(filePath);
          } catch (error) {
            console.error('Failed to delete temp file:', error);
          }
        }
      } else {
        // Local-only export
        alert(`Session exported successfully to:\n${filePath}`);
      }

      // Restore button state
      if (exportButton) {
        exportButton.disabled = false;
        exportButton.textContent = originalText;
      }
    } catch (error) {
      console.error('Error exporting session:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Restore button state
      if (exportButton) {
        exportButton.disabled = false;
        exportButton.textContent = originalText;
      }
    }
  }

  /**
   * Export to local file system
   */
  private async exportToLocal(sessionId: string, defaultFilename: string, format: string): Promise<string | null> {
    // Show save dialog for local save
    const result = await window.scribeCat.dialog.showSaveDialog({
      title: 'Export Session',
      defaultPath: defaultFilename,
      filters: [
        { name: this.getFormatName(format), extensions: [format] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.success || !result.data || result.data.canceled || !result.data.filePath) {
      return null; // User cancelled or error
    }

    const filePath = result.data.filePath;

    // Perform the export
    const exportResult = await window.scribeCat.session.exportWithDefaults(
      sessionId,
      format,
      filePath
    );

    if (!exportResult.success) {
      alert(`Export failed: ${exportResult.error || 'Unknown error'}`);
      return null;
    }

    return filePath;
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
