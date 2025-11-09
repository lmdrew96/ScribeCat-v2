/**
 * DriveUploadManager
 *
 * Manages Google Drive upload operations for exports.
 */

import { Session } from '../../../domain/entities/Session.js';
import { DriveFolderPicker } from '../../components/DriveFolderPicker.js';
import { ExportDialogs } from './ExportDialogs.js';

export class DriveUploadManager {
  private driveFolderPicker: DriveFolderPicker | null = null;

  /**
   * Upload a file to Google Drive
   */
  async uploadFile(filePath: string, sessionTitle: string): Promise<void> {
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
      const uploadingOverlay = ExportDialogs.showUploadingOverlay();

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
  async uploadBulk(
    sessionIds: string[],
    sessions: Session[],
    format: string,
    outputDirectory: string
  ): Promise<void> {
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
      const uploadingOverlay = ExportDialogs.showUploadingOverlay('Uploading files to Google Drive...');

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
        const filePath = `${outputDirectory}/${sanitizedTitle}.${format}`;

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
}
