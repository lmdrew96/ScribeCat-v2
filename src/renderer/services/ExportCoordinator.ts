/**
 * ExportCoordinator
 *
 * Manages session export operations including single and bulk exports.
 * Handles format selection dialogs, file saving, and progress feedback.
 */

import type { Session } from '../../domain/entities/Session.js';
import { DriveFolderPicker } from '../components/DriveFolderPicker.js';

export type ExportFormat = 'txt' | 'pdf' | 'docx' | 'html';
export type ExportDestination = 'local' | 'drive' | 'both';

export interface ExportOptions {
  format: ExportFormat;
  destination: ExportDestination;
}

export interface ExportCallbacks {
  onBulkExportComplete?: () => void;
}

export class ExportCoordinator {
  private driveFolderPicker: DriveFolderPicker | null = null;
  /**
   * Export a single session
   */
  async exportSession(sessionId: string, sessions: Session[]): Promise<void> {
    console.log('Exporting session:', sessionId);

    try {
      // Get the session to use its title for the filename
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        alert('Session not found');
        return;
      }

      // Show format and destination selection dialog
      const options = await this.showExportOptionsDialog();
      if (!options) {
        return; // User cancelled
      }

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

      // Handle different destinations
      if (options.destination === 'local' || options.destination === 'both') {
        // Show save dialog for local save
        const result = await window.scribeCat.dialog.showSaveDialog({
          title: 'Export Session',
          defaultPath: defaultFilename,
          filters: [
            { name: this.getFormatName(options.format), extensions: [options.format] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (!result.success || !result.data || result.data.canceled || !result.data.filePath) {
          // Restore button state
          if (exportButton) {
            exportButton.disabled = false;
            exportButton.textContent = originalText;
          }
          return; // User cancelled or error
        }

        filePath = result.data.filePath;

        // Perform the export
        exportResult = await window.scribeCat.session.exportWithDefaults(
          sessionId,
          options.format,
          filePath
        );

        if (!exportResult.success) {
          // Restore button state
          if (exportButton) {
            exportButton.disabled = false;
            exportButton.textContent = originalText;
          }
          alert(`Export failed: ${exportResult.error || 'Unknown error'}`);
          return;
        }
      } else if (options.destination === 'drive') {
        // Export to temp file for Drive-only export
        const tempPathResult = await window.scribeCat.dialog.getTempPath();
        if (!tempPathResult.success || !tempPathResult.data) {
          // Restore button state
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
          // Restore button state
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
        await this.uploadToDrive(filePath!, session.title);

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
      const options = await this.showExportOptionsDialog();
      if (!options) {
        return; // User cancelled
      }

      let outputDirectory: string = '';

      // For local or both destinations, let user choose the location
      if (options.destination === 'local' || options.destination === 'both') {
        const firstSession = sessions.find(s => s.id === sessionIds[0]);
        if (!firstSession) {
          alert('Session not found');
          return;
        }

        const sanitizedTitle = firstSession.title.replace(/[^a-z0-9]/gi, '_');
        const defaultFilename = `${sanitizedTitle}.${options.format}`;

        const result = await window.scribeCat.dialog.showSaveDialog({
          title: 'Export Sessions - Choose Location',
          defaultPath: defaultFilename,
          filters: [
            { name: this.getFormatName(options.format), extensions: [options.format] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (!result.success || !result.data || result.data.canceled || !result.data.filePath) {
          return; // User cancelled or error
        }

        // Get the directory from the first file path
        outputDirectory = result.data.filePath.substring(0, result.data.filePath.lastIndexOf('/'));
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
        const outputPath = `${outputDirectory}/${sanitizedTitle}.${options.format}`;

        // Export the session
        try {
          const exportResult = await window.scribeCat.session.exportWithDefaults(
            sessionId,
            options.format,
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

      // Restore button state
      if (bulkExportBtn) {
        bulkExportBtn.disabled = false;
        bulkExportBtn.textContent = 'Export Selected';
      }

      // Handle Drive upload if requested
      if (successCount > 0 && (options.destination === 'drive' || options.destination === 'both')) {
        await this.uploadBulkToDrive(sessionIds, sessions, options.format, outputDirectory);

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
   * Show a dialog to select export format and destination
   */
  async showExportOptionsDialog(): Promise<ExportOptions | null> {
    return new Promise(async (resolve) => {
      // First, check if Drive is connected
      const driveConnected = await this.isDriveConnected();

      // Create dialog overlay
      const overlay = document.createElement('div');
      overlay.className = 'export-dialog-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const dialog = document.createElement('div');
      dialog.className = 'export-dialog';
      dialog.style.cssText = `
        background: var(--background-color, #1e1e1e);
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 90%;
      `;

      dialog.innerHTML = `
        <h3 style="margin-top: 0; color: var(--text-color, #fff);">Export Session</h3>

        <h4 style="margin-top: 1.5rem; margin-bottom: 0.75rem; color: var(--text-color, #fff); font-size: 0.9rem;">Select Format:</h4>
        <div class="format-selection" style="display: flex; flex-direction: column; gap: 0.5rem;">
          <button class="format-btn" data-format="txt" style="padding: 0.75rem; background: var(--secondary-color, #2a2a2a); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: pointer; text-align: left;">
            📄 Plain Text (.txt)
          </button>
          <button class="format-btn" data-format="pdf" style="padding: 0.75rem; background: var(--secondary-color, #2a2a2a); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: pointer; text-align: left;">
            📕 PDF Document (.pdf)
          </button>
          <button class="format-btn" data-format="docx" style="padding: 0.75rem; background: var(--secondary-color, #2a2a2a); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: pointer; text-align: left;">
            📘 Word Document (.docx)
          </button>
          <button class="format-btn" data-format="html" style="padding: 0.75rem; background: var(--secondary-color, #2a2a2a); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: pointer; text-align: left;">
            🌐 HTML Page (.html)
          </button>
        </div>

        <h4 style="margin-top: 1.5rem; margin-bottom: 0.75rem; color: var(--text-color, #fff); font-size: 0.9rem;">Select Destination:</h4>
        <div class="destination-selection" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;">
          <button class="dest-btn" data-destination="local" style="padding: 0.75rem; background: var(--secondary-color, #2a2a2a); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: pointer; text-align: left;">
            💾 Save to Computer
          </button>
          <button class="dest-btn" data-destination="drive" ${!driveConnected ? 'disabled' : ''} style="padding: 0.75rem; background: var(--secondary-color, #2a2a2a); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: ${driveConnected ? 'pointer' : 'not-allowed'}; text-align: left; opacity: ${driveConnected ? '1' : '0.5'};">
            ☁️ Upload to Google Drive${!driveConnected ? ' (Not Connected)' : ''}
          </button>
          <button class="dest-btn" data-destination="both" ${!driveConnected ? 'disabled' : ''} style="padding: 0.75rem; background: var(--secondary-color, #2a2a2a); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: ${driveConnected ? 'pointer' : 'not-allowed'}; text-align: left; opacity: ${driveConnected ? '1' : '0.5'};">
            💾☁️ Save & Upload to Drive${!driveConnected ? ' (Not Connected)' : ''}
          </button>
        </div>

        <button class="cancel-btn" style="padding: 0.5rem 1rem; background: transparent; border: 1px solid var(--border-color, #444); border-radius: 4px; color: var(--text-color, #fff); cursor: pointer; width: 100%;">
          Cancel
        </button>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      let selectedFormat: ExportFormat | null = null;
      let selectedDestination: ExportDestination | null = null;

      const updateButtonStates = () => {
        const formatButtons = dialog.querySelectorAll('.format-btn');
        const destButtons = dialog.querySelectorAll('.dest-btn');

        formatButtons.forEach(btn => {
          const format = btn.getAttribute('data-format');
          if (format === selectedFormat) {
            (btn as HTMLElement).style.background = 'var(--primary-color, #007acc)';
            (btn as HTMLElement).style.borderLeft = '4px solid var(--accent-color, #00ff00)';
          } else {
            (btn as HTMLElement).style.background = 'var(--secondary-color, #2a2a2a)';
            (btn as HTMLElement).style.borderLeft = 'none';
          }
        });

        destButtons.forEach(btn => {
          const destination = btn.getAttribute('data-destination');
          const isDisabled = (btn as HTMLButtonElement).disabled;
          if (!isDisabled && destination === selectedDestination) {
            (btn as HTMLElement).style.background = 'var(--primary-color, #007acc)';
            (btn as HTMLElement).style.borderLeft = '4px solid var(--accent-color, #00ff00)';
          } else if (!isDisabled) {
            (btn as HTMLElement).style.background = 'var(--secondary-color, #2a2a2a)';
            (btn as HTMLElement).style.borderLeft = 'none';
          }
        });

        // If both are selected, automatically close and resolve
        if (selectedFormat && selectedDestination) {
          setTimeout(() => {
            document.body.removeChild(overlay);
            resolve({ format: selectedFormat!, destination: selectedDestination! });
          }, 200);
        }
      };

      // Add hover effects and click handlers for format buttons
      const formatButtons = dialog.querySelectorAll('.format-btn');
      formatButtons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
          if (btn.getAttribute('data-format') !== selectedFormat) {
            (btn as HTMLElement).style.background = 'var(--primary-color, #007acc)';
          }
        });
        btn.addEventListener('mouseleave', () => {
          if (btn.getAttribute('data-format') !== selectedFormat) {
            (btn as HTMLElement).style.background = 'var(--secondary-color, #2a2a2a)';
          }
        });
        btn.addEventListener('click', () => {
          selectedFormat = btn.getAttribute('data-format') as ExportFormat;
          updateButtonStates();
        });
      });

      // Add hover effects and click handlers for destination buttons
      const destButtons = dialog.querySelectorAll('.dest-btn');
      destButtons.forEach(btn => {
        const isDisabled = (btn as HTMLButtonElement).disabled;
        if (!isDisabled) {
          btn.addEventListener('mouseenter', () => {
            if (btn.getAttribute('data-destination') !== selectedDestination) {
              (btn as HTMLElement).style.background = 'var(--primary-color, #007acc)';
            }
          });
          btn.addEventListener('mouseleave', () => {
            if (btn.getAttribute('data-destination') !== selectedDestination) {
              (btn as HTMLElement).style.background = 'var(--secondary-color, #2a2a2a)';
            }
          });
          btn.addEventListener('click', () => {
            selectedDestination = btn.getAttribute('data-destination') as ExportDestination;
            updateButtonStates();
          });
        }
      });

      // Cancel button
      const cancelBtn = dialog.querySelector('.cancel-btn');
      cancelBtn?.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(null);
      });

      // Click outside to cancel
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(null);
        }
      });
    });
  }

  /**
   * Check if Google Drive is connected
   */
  private async isDriveConnected(): Promise<boolean> {
    try {
      const result = await window.scribeCat.drive.isAuthenticated();
      return result.data || false;
    } catch (error) {
      console.error('Error checking Drive connection:', error);
      return false;
    }
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

  /**
   * Prompt user if they want to upload to Google Drive
   */
  private async promptForDriveUpload(): Promise<boolean> {
    try {
      // Check if Google Drive is connected
      const authResult = await window.scribeCat.drive.isAuthenticated();
      if (!authResult.data) {
        return false; // Not connected, don't prompt
      }

      // Show prompt dialog
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'export-dialog-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        `;

        const dialog = document.createElement('div');
        dialog.className = 'export-dialog';
        dialog.style.cssText = `
          background: var(--background-color, #1e1e1e);
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
          max-width: 400px;
          width: 90%;
        `;

        dialog.innerHTML = `
          <h3 style="margin-top: 0; color: var(--text-color, #fff);">Upload to Google Drive?</h3>
          <p style="color: var(--text-color, #ccc); margin: 1rem 0;">
            Would you like to upload this file to Google Drive?
          </p>
          <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
            <button class="no-btn" style="flex: 1; padding: 0.75rem; background: var(--secondary-color, #2a2a2a); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: pointer;">
              No, Save Locally Only
            </button>
            <button class="yes-btn" style="flex: 1; padding: 0.75rem; background: var(--primary-color, #007acc); border: none; border-radius: 4px; color: var(--text-color, #fff); cursor: pointer; font-weight: bold;">
              Yes, Upload to Drive
            </button>
          </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const yesBtn = dialog.querySelector('.yes-btn');
        const noBtn = dialog.querySelector('.no-btn');

        yesBtn?.addEventListener('click', () => {
          document.body.removeChild(overlay);
          resolve(true);
        });

        noBtn?.addEventListener('click', () => {
          document.body.removeChild(overlay);
          resolve(false);
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            document.body.removeChild(overlay);
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error('Error checking Drive connection:', error);
      return false;
    }
  }

  /**
   * Upload a file to Google Drive
   */
  private async uploadToDrive(filePath: string, sessionTitle: string): Promise<void> {
    try {
      // Initialize folder picker if needed
      if (!this.driveFolderPicker) {
        this.driveFolderPicker = new DriveFolderPicker();
      }

      // Show folder picker
      const folderSelection = await new Promise<{ folderId: string | null; folderPath: string } | null>((resolve) => {
        this.driveFolderPicker!.show((folderId, folderPath) => {
          resolve({ folderId, folderPath });
        });
      });

      if (!folderSelection) {
        alert('Upload cancelled');
        return;
      }

      // Show uploading indicator
      const uploadingOverlay = this.showUploadingOverlay();

      // Upload file
      const uploadResult = await window.scribeCat.drive.uploadFile(filePath, {
        folderId: folderSelection.folderId || undefined
      });

      // Hide uploading indicator
      document.body.removeChild(uploadingOverlay);

      if (uploadResult.success) {
        alert(`✓ File exported locally and uploaded to Google Drive:\n${folderSelection.folderPath}\n\nLocal file: ${filePath}`);
      } else {
        alert(`File exported locally to:\n${filePath}\n\nGoogle Drive upload failed: ${uploadResult.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error uploading to Drive:', error);
      alert(`File exported locally to:\n${filePath}\n\nGoogle Drive upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload multiple files to Google Drive
   */
  private async uploadBulkToDrive(sessionIds: string[], sessions: Session[], format: string, outputDirectory: string): Promise<void> {
    try {
      // Initialize folder picker if needed
      if (!this.driveFolderPicker) {
        this.driveFolderPicker = new DriveFolderPicker();
      }

      // Show folder picker
      const folderSelection = await new Promise<{ folderId: string | null; folderPath: string } | null>((resolve) => {
        this.driveFolderPicker!.show((folderId, folderPath) => {
          resolve({ folderId, folderPath });
        });
      });

      if (!folderSelection) {
        alert('Upload cancelled');
        return;
      }

      // Show uploading indicator
      const uploadingOverlay = this.showUploadingOverlay('Uploading files to Google Drive...');

      let successCount = 0;
      let errorCount = 0;

      // Upload all files
      for (let i = 0; i < sessionIds.length; i++) {
        const sessionId = sessionIds[i];
        const session = sessions.find(s => s.id === sessionId);

        if (!session) {
          errorCount++;
          continue;
        }

        const sanitizedTitle = session.title.replace(/[^a-z0-9]/gi, '_');
        const filePath = i === 0
          ? `${outputDirectory}/${sanitizedTitle}.${format}` // First file path from dialog
          : `${outputDirectory}/${sanitizedTitle}.${format}`;

        try {
          const uploadResult = await window.scribeCat.drive.uploadFile(filePath, {
            folderId: folderSelection.folderId || undefined
          });

          if (uploadResult.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`Error uploading ${filePath}:`, error);
        }

        // Update progress
        const progressText = uploadingOverlay.querySelector('.upload-progress');
        if (progressText) {
          progressText.textContent = `Uploading files to Google Drive... (${i + 1}/${sessionIds.length})`;
        }
      }

      // Hide uploading indicator
      document.body.removeChild(uploadingOverlay);

      // Show results
      const message = successCount > 0
        ? `✓ ${successCount} file${successCount > 1 ? 's' : ''} uploaded to Google Drive:\n${folderSelection.folderPath}\n\n${errorCount > 0 ? `${errorCount} file${errorCount > 1 ? 's' : ''} failed to upload.` : ''}\n\nLocal files: ${outputDirectory}`
        : `Files saved locally but upload failed for all sessions.\n\nLocal files: ${outputDirectory}`;

      alert(message);
    } catch (error) {
      console.error('Error uploading to Drive:', error);
      alert(`Files saved locally to:\n${outputDirectory}\n\nGoogle Drive upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Show uploading overlay
   */
  private showUploadingOverlay(message: string = 'Uploading to Google Drive...'): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'export-dialog-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: var(--background-color, #1e1e1e);
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
      text-align: center;
    `;

    dialog.innerHTML = `
      <div class="upload-progress" style="color: var(--text-color, #fff); font-size: 1.1rem;">
        ${message}
      </div>
      <div style="margin-top: 1rem; color: var(--text-color, #ccc);">
        Please wait...
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    return overlay;
  }
}
