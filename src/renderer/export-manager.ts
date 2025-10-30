/**
 * ExportManager
 * 
 * Handles session export functionality with multiple format support
 */

import { DriveFolderPicker } from './components/DriveFolderPicker.js';

export class ExportManager {
  private exportBtn: HTMLButtonElement | null = null;
  private exportModal: HTMLElement | null = null;
  private currentSessionId: string | null = null;
  private driveFolderPicker: DriveFolderPicker;
  private selectedDriveFolderId: string | null = null;
  private selectedDriveFolderPath: string = 'My Drive (Root)';

  constructor() {
    this.driveFolderPicker = new DriveFolderPicker();
    this.initializeUI();
  }

  /**
   * Initialize export UI elements
   */
  private initializeUI(): void {
    // Get reference to existing export button in the HTML
    this.exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    if (this.exportBtn) {
      this.exportBtn.addEventListener('click', () => this.showExportModal());
    }

    // Create export modal
    this.createExportModal();
  }

  /**
   * Create export modal HTML
   */
  private createExportModal(): void {
    const modal = document.createElement('div');
    modal.id = 'export-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Export Session</h2>
          <button id="close-export-btn" class="close-btn" title="Close">×</button>
        </div>
        
        <div class="modal-body">
          <section class="settings-section">
            <h3>Export Format</h3>
            <div class="format-grid">
              <label class="format-card">
                <input type="radio" name="export-format" value="txt" checked>
                <div class="format-content">
                  <div class="format-icon">📄</div>
                  <div class="format-name">Plain Text</div>
                  <div class="format-desc">Simple .txt file</div>
                </div>
              </label>
              
              <label class="format-card">
                <input type="radio" name="export-format" value="docx">
                <div class="format-content">
                  <div class="format-icon">📝</div>
                  <div class="format-name">Word Document</div>
                  <div class="format-desc">Microsoft Word .docx</div>
                </div>
              </label>
              
              <label class="format-card">
                <input type="radio" name="export-format" value="pdf">
                <div class="format-content">
                  <div class="format-icon">📕</div>
                  <div class="format-name">PDF</div>
                  <div class="format-desc">Portable Document Format</div>
                </div>
              </label>
              
              <label class="format-card">
                <input type="radio" name="export-format" value="html">
                <div class="format-content">
                  <div class="format-icon">🌐</div>
                  <div class="format-name">HTML</div>
                  <div class="format-desc">Web page format</div>
                </div>
              </label>
            </div>
          </section>
          
          <section class="settings-section">
            <h3>Export Options</h3>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" id="export-include-metadata" checked>
                <span>Include metadata (date, duration, etc.)</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="export-include-timestamps" checked>
                <span>Include timestamps</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="export-include-notes" checked>
                <span>Include notes</span>
              </label>
            </div>
          </section>
          
          <section class="settings-section">
            <h3>Save Location</h3>
            <div class="form-group">
              <input 
                type="text" 
                id="export-filename" 
                class="text-input" 
                placeholder="Session_2025-10-28"
                value="Session_2025-10-28"
              >
              <small class="help-text">File extension will be added automatically</small>
            </div>
          </section>
          
          <section class="settings-section">
            <h3>Upload to Google Drive</h3>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" id="export-upload-drive">
                <span>Upload to Google Drive after export</span>
              </label>
            </div>
            <div id="drive-folder-select" class="form-group hidden">
              <label>Folder:</label>
              <div style="display: flex; gap: 10px; align-items: center; margin-top: 8px;">
                <button id="choose-drive-folder-btn" class="secondary-btn" type="button">
                  📁 Choose Folder
                </button>
                <span id="selected-drive-folder-path" style="font-size: 13px; color: var(--text-secondary);">
                  My Drive (Root)
                </span>
              </div>
            </div>
            <div id="drive-not-configured" class="info-message hidden">
              <span>⚠️ Google Drive not configured. Set it up in Settings.</span>
            </div>
          </section>
          
          <div id="export-progress" class="progress-container hidden">
            <div class="progress-bar">
              <div id="export-progress-fill" class="progress-fill"></div>
            </div>
            <div id="export-status" class="progress-status">Exporting...</div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button id="cancel-export-btn" class="secondary-btn">Cancel</button>
          <button id="confirm-export-btn" class="primary-btn">Export</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.exportModal = modal;
    
    // Set up event listeners
    this.setupModalListeners();
  }

  /**
   * Set up modal event listeners
   */
  private setupModalListeners(): void {
    if (!this.exportModal) return;

    const closeBtn = this.exportModal.querySelector('#close-export-btn');
    const cancelBtn = this.exportModal.querySelector('#cancel-export-btn');
    const confirmBtn = this.exportModal.querySelector('#confirm-export-btn');
    const uploadCheckbox = this.exportModal.querySelector('#export-upload-drive') as HTMLInputElement;
    const chooseFolderBtn = this.exportModal.querySelector('#choose-drive-folder-btn');
    const overlay = this.exportModal.querySelector('.modal-overlay');

    closeBtn?.addEventListener('click', () => this.hideExportModal());
    cancelBtn?.addEventListener('click', () => this.hideExportModal());
    confirmBtn?.addEventListener('click', () => this.handleExport());
    overlay?.addEventListener('click', () => this.hideExportModal());
    
    uploadCheckbox?.addEventListener('change', () => {
      const folderSelect = this.exportModal?.querySelector('#drive-folder-select');
      if (folderSelect) {
        folderSelect.classList.toggle('hidden', !uploadCheckbox.checked);
      }
    });

    chooseFolderBtn?.addEventListener('click', () => this.showDriveFolderPicker());
  }

  /**
   * Show Drive folder picker
   */
  private async showDriveFolderPicker(): Promise<void> {
    await this.driveFolderPicker.show((folderId, folderPath) => {
      this.selectedDriveFolderId = folderId;
      this.selectedDriveFolderPath = folderPath;
      
      // Update the displayed folder path
      const folderPathDisplay = this.exportModal?.querySelector('#selected-drive-folder-path');
      if (folderPathDisplay) {
        folderPathDisplay.textContent = folderPath;
      }
    });
  }

  /**
   * Show export modal
   */
  private async showExportModal(): Promise<void> {
    if (!this.exportModal) return;

    // Check Google Drive status
    const driveCheckbox = this.exportModal.querySelector('#export-upload-drive') as HTMLInputElement;
    const driveNotConfigured = this.exportModal.querySelector('#drive-not-configured');
    
    try {
      const result = await window.scribeCat.drive.isAuthenticated();
      const isAuthenticated = result.data || false;
      
      if (driveCheckbox) driveCheckbox.disabled = !isAuthenticated;
      if (driveNotConfigured) {
        driveNotConfigured.classList.toggle('hidden', isAuthenticated);
      }
    } catch (error) {
      console.error('Failed to check Drive status:', error);
      if (driveCheckbox) driveCheckbox.disabled = true;
      if (driveNotConfigured) driveNotConfigured.classList.remove('hidden');
    }

    // Generate default filename
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const defaultFilename = `Session_${dateStr}_${timeStr}`;
    
    const filenameInput = this.exportModal.querySelector('#export-filename') as HTMLInputElement;
    if (filenameInput) {
      filenameInput.value = defaultFilename;
    }

    this.exportModal.classList.remove('hidden');
  }

  /**
   * Hide export modal
   */
  private hideExportModal(): void {
    if (!this.exportModal) return;
    this.exportModal.classList.add('hidden');
    
    // Reset progress
    const progressContainer = this.exportModal.querySelector('#export-progress');
    if (progressContainer) {
      progressContainer.classList.add('hidden');
    }
  }

  /**
   * Handle export action
   */
  private async handleExport(): Promise<void> {
    if (!this.exportModal || !this.currentSessionId) return;

    const format = (this.exportModal.querySelector('input[name="export-format"]:checked') as HTMLInputElement)?.value || 'txt';
    const filename = (this.exportModal.querySelector('#export-filename') as HTMLInputElement)?.value || 'Session';
    const includeMetadata = (this.exportModal.querySelector('#export-include-metadata') as HTMLInputElement)?.checked ?? true;
    const includeTimestamps = (this.exportModal.querySelector('#export-include-timestamps') as HTMLInputElement)?.checked ?? true;
    const includeNotes = (this.exportModal.querySelector('#export-include-notes') as HTMLInputElement)?.checked ?? true;
    const uploadToDrive = (this.exportModal.querySelector('#export-upload-drive') as HTMLInputElement)?.checked ?? false;

    // Show save dialog to let user choose location
    const saveDialogResult = await window.scribeCat.dialog.showSaveDialog({
      title: 'Save Export',
      defaultPath: `${filename}.${format}`,
      filters: [
        { name: this.getFormatName(format), extensions: [format] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    // Check if user cancelled
    if (!saveDialogResult.success || saveDialogResult.data?.canceled || !saveDialogResult.data?.filePath) {
      return;
    }

    const outputPath = saveDialogResult.data.filePath;

    // Show progress
    const progressContainer = this.exportModal.querySelector('#export-progress');
    const progressFill = this.exportModal.querySelector('#export-progress-fill') as HTMLElement;
    const progressStatus = this.exportModal.querySelector('#export-status');
    const confirmBtn = this.exportModal.querySelector('#confirm-export-btn') as HTMLButtonElement;
    
    if (progressContainer) progressContainer.classList.remove('hidden');
    if (confirmBtn) confirmBtn.disabled = true;

    try {
      // Update progress
      if (progressStatus) progressStatus.textContent = 'Exporting...';
      if (progressFill) progressFill.style.width = '30%';

      const result = await window.scribeCat.session.export(
        this.currentSessionId,
        format,
        outputPath,
        {
          includeMetadata,
          includeTimestamps,
          includeNotes
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Export failed');
      }

      if (progressFill) progressFill.style.width = '60%';

      // Upload to Drive if requested
      if (uploadToDrive && result.filePath) {
        if (progressStatus) progressStatus.textContent = 'Uploading to Google Drive...';
        
        const uploadOptions: any = {
          fileName: `${filename}.${format}`,
          mimeType: this.getMimeType(format)
        };
        
        // Add folder ID if a specific folder was selected
        if (this.selectedDriveFolderId) {
          uploadOptions.folderId = this.selectedDriveFolderId;
        }
        
        const uploadResult = await window.scribeCat.drive.uploadFile(
          result.filePath,
          uploadOptions
        );

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Upload to Google Drive failed');
        }

        if (progressFill) progressFill.style.width = '100%';
        if (progressStatus) progressStatus.textContent = 'Uploaded successfully!';
        
        // Show success with Drive link
        setTimeout(() => {
          this.hideExportModal();
          const message = uploadResult.webViewLink 
            ? `File uploaded to Google Drive!\n\nView at: ${uploadResult.webViewLink}`
            : 'File uploaded to Google Drive successfully!';
          alert(message);
        }, 1500);
      } else {
        if (progressFill) progressFill.style.width = '100%';
        if (progressStatus) progressStatus.textContent = 'Export complete!';
        
        // Show success with local path
        setTimeout(() => {
          this.hideExportModal();
          alert(`Export successful! File saved to: ${result.filePath}`);
        }, 1500);
      }

    } catch (error) {
      console.error('Export failed:', error);
      if (progressStatus) {
        progressStatus.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        (progressStatus as HTMLElement).style.color = '#ff4444';
      }
      if (confirmBtn) confirmBtn.disabled = false;
    }
  }

  /**
   * Get format name for save dialog
   */
  private getFormatName(format: string): string {
    const formatNames: Record<string, string> = {
      txt: 'Plain Text',
      docx: 'Word Document',
      pdf: 'PDF Document',
      html: 'HTML Document'
    };
    return formatNames[format] || 'Document';
  }

  /**
   * Get MIME type for format
   */
  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      txt: 'text/plain',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pdf: 'application/pdf',
      html: 'text/html'
    };
    return mimeTypes[format] || 'application/octet-stream';
  }

  /**
   * Enable export button when session is available
   */
  public enableExport(sessionId: string): void {
    this.currentSessionId = sessionId;
    if (this.exportBtn) {
      this.exportBtn.disabled = false;
    }
  }

  /**
   * Disable export button
   */
  public disableExport(): void {
    this.currentSessionId = null;
    if (this.exportBtn) {
      this.exportBtn.disabled = true;
    }
  }
}
