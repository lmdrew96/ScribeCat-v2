/**
 * DriveFolderPicker
 *
 * A modal component for browsing and selecting Google Drive folders
 */

import { getRandomCatFact } from '../utils/cat-facts.js';
import { escapeHtml } from '../utils/formatting.js';

interface DriveFolder {
  id: string;
  name: string;
  parents?: string[];
}

interface FolderPathEntry {
  name: string;
  id: string | null;
}

export class DriveFolderPicker {
  private modal: HTMLElement | null = null;
  private currentFolderId: string | null = null;
  private selectedFolderId: string | null = null;
  private folderPath: FolderPathEntry[] = [];
  private onSelectCallback: ((folderId: string | null, folderPath: string) => void) | null = null;

  constructor() {
    this.createModal();
  }

  /**
   * Create the folder picker modal
   */
  private createModal(): void {
    const modal = document.createElement('div');
    modal.id = 'drive-folder-picker-modal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content drive-picker-content">
        <div class="modal-header">
          <h2>Select Google Drive Folder</h2>
          <button id="close-folder-picker-btn" class="close-btn" title="Close">×</button>
        </div>
        
        <div class="modal-body">
          <div class="folder-picker-breadcrumb" id="folder-breadcrumb">
            <button class="breadcrumb-item" data-folder-id="">📁 My Drive</button>
          </div>
          
          <div class="folder-picker-search">
            <input 
              type="text" 
              id="folder-search-input" 
              class="text-input" 
              placeholder="Search folders..."
            >
          </div>
          
          <div class="folder-picker-list" id="folder-list">
            <div class="loading-spinner">Loading folders...</div>
          </div>
          
          <div class="folder-picker-actions">
            <button id="create-folder-btn" class="secondary-btn">
              ➕ Create New Folder
            </button>
          </div>
          
          <div class="folder-picker-selected" id="selected-folder-display">
            <strong>Selected:</strong> <span id="selected-folder-name">My Drive (Root)</span>
          </div>
        </div>
        
        <div class="modal-footer">
          <button id="cancel-folder-picker-btn" class="secondary-btn">Cancel</button>
          <button id="confirm-folder-picker-btn" class="primary-btn">Select Folder</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.modal = modal;
    
    this.setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    if (!this.modal) return;

    const closeBtn = this.modal.querySelector('#close-folder-picker-btn');
    const cancelBtn = this.modal.querySelector('#cancel-folder-picker-btn');
    const confirmBtn = this.modal.querySelector('#confirm-folder-picker-btn');
    const createFolderBtn = this.modal.querySelector('#create-folder-btn');
    const searchInput = this.modal.querySelector('#folder-search-input') as HTMLInputElement;
    const overlay = this.modal.querySelector('.modal-overlay');

    closeBtn?.addEventListener('click', () => this.hide());
    cancelBtn?.addEventListener('click', () => this.hide());
    confirmBtn?.addEventListener('click', () => this.confirmSelection());
    createFolderBtn?.addEventListener('click', () => this.showCreateFolderDialog());
    overlay?.addEventListener('click', () => this.hide());
    
    // Debounced search
    let searchTimeout: NodeJS.Timeout;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.filterFolders(searchInput.value);
      }, 300);
    });
  }

  /**
   * Show the folder picker
   */
  public async show(onSelect: (folderId: string | null, folderPath: string) => void): Promise<void> {
    if (!this.modal) return;

    this.onSelectCallback = onSelect;
    this.currentFolderId = null;
    this.selectedFolderId = null;
    this.folderPath = [{ name: 'My Drive', id: null }];
    
    this.modal.classList.remove('hidden');
    
    // Load root folders
    await this.loadFolders();
  }

  /**
   * Hide the folder picker
   */
  private hide(): void {
    if (!this.modal) return;
    this.modal.classList.add('hidden');
  }

  /**
   * Load folders from Google Drive
   */
  private async loadFolders(folderId?: string): Promise<void> {
    if (!this.modal) return;

    const folderList = this.modal.querySelector('#folder-list');
    if (!folderList) return;

    try {
      // Show loading with cat fact
      const catFact = getRandomCatFact();
      folderList.innerHTML = `
        <div class="loading-spinner">Loading folders...</div>
        <div class="loading-cat-fact">${catFact}</div>
      `;

      // Fetch folders from Google Drive
      const result = await window.scribeCat.drive.listFiles(folderId);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to load folders');
      }

      // Filter to only show folders
      const folders = result.data.filter((file: any) => file.mimeType === 'application/vnd.google-apps.folder');

      if (folders.length === 0) {
        folderList.innerHTML = '<div class="empty-state">No folders found</div>';
        return;
      }

      // Render folders
      folderList.innerHTML = folders.map((folder: any) => `
        <div class="folder-item" data-folder-id="${folder.id}" data-folder-name="${folder.name}">
          <span class="folder-icon">📁</span>
          <span class="folder-name">${escapeHtml(folder.name)}</span>
          <button class="folder-select-btn" data-folder-id="${folder.id}">Select</button>
        </div>
      `).join('');

      // Add click handlers
      folderList.querySelectorAll('.folder-item').forEach(item => {
        const folderName = item.getAttribute('data-folder-name');
        const itemFolderId = item.getAttribute('data-folder-id');
        
        // Double-click to navigate into folder
        item.addEventListener('dblclick', () => {
          if (itemFolderId && folderName) {
            this.navigateToFolder(itemFolderId, folderName);
          }
        });

        // Select button
        const selectBtn = item.querySelector('.folder-select-btn');
        selectBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (itemFolderId && folderName) {
            this.selectFolder(itemFolderId, folderName);
          }
        });
      });

    } catch (error) {
      console.error('Failed to load folders:', error);
      folderList.innerHTML = `
        <div class="error-state">
          Failed to load folders: ${error instanceof Error ? error.message : 'Unknown error'}
        </div>
      `;
    }
  }

  /**
   * Navigate to a folder
   */
  private async navigateToFolder(folderId: string, folderName: string): Promise<void> {
    this.currentFolderId = folderId;
    this.folderPath.push({ name: folderName, id: folderId });
    this.updateBreadcrumb();
    await this.loadFolders(folderId);
  }

  /**
   * Select a folder
   */
  private selectFolder(folderId: string, folderName: string): void {
    this.selectedFolderId = folderId;

    // Update selected folder display
    const selectedDisplay = this.modal?.querySelector('#selected-folder-name');
    if (selectedDisplay) {
      const pathNames = this.folderPath.map(entry => entry.name);
      const fullPath = [...pathNames, folderName].join(' / ');
      selectedDisplay.textContent = fullPath;
    }

    // Highlight selected folder
    this.modal?.querySelectorAll('.folder-item').forEach(item => {
      item.classList.remove('selected');
    });
    this.modal?.querySelector(`[data-folder-id="${folderId}"]`)?.classList.add('selected');
  }

  /**
   * Update breadcrumb navigation
   */
  private updateBreadcrumb(): void {
    const breadcrumb = this.modal?.querySelector('#folder-breadcrumb');
    if (!breadcrumb) return;

    breadcrumb.innerHTML = this.folderPath.map((entry, index) => {
      const isLast = index === this.folderPath.length - 1;
      return `
        <button
          class="breadcrumb-item ${isLast ? 'active' : ''}"
          data-depth="${index}"
        >
          ${index === 0 ? '📁' : ''} ${escapeHtml(entry.name)}
        </button>
        ${!isLast ? '<span class="breadcrumb-separator">›</span>' : ''}
      `;
    }).join('');

    // Add click handlers for breadcrumb navigation
    breadcrumb.querySelectorAll('.breadcrumb-item').forEach(item => {
      item.addEventListener('click', () => {
        const depth = parseInt(item.getAttribute('data-depth') || '0');
        this.navigateToDepth(depth);
      });
    });
  }

  /**
   * Navigate to a specific depth in the folder hierarchy
   */
  private async navigateToDepth(depth: number): Promise<void> {
    if (depth === 0) {
      // Navigate to root
      this.currentFolderId = null;
      this.folderPath = [{ name: 'My Drive', id: null }];
      this.updateBreadcrumb();
      await this.loadFolders();
    } else if (depth < this.folderPath.length - 1) {
      // Navigate to parent folder using stored folder ID
      this.folderPath = this.folderPath.slice(0, depth + 1);
      const targetFolderId = this.folderPath[depth].id;
      this.currentFolderId = targetFolderId;
      this.updateBreadcrumb();
      await this.loadFolders(targetFolderId || undefined);
    }
  }

  /**
   * Filter folders by search term
   */
  private filterFolders(searchTerm: string): void {
    if (!this.modal) return;

    const folderItems = this.modal.querySelectorAll('.folder-item');
    const lowerSearch = searchTerm.toLowerCase();

    folderItems.forEach(item => {
      const folderName = item.getAttribute('data-folder-name')?.toLowerCase() || '';
      const matches = folderName.includes(lowerSearch);
      (item as HTMLElement).style.display = matches ? 'flex' : 'none';
    });
  }

  /**
   * Show create folder dialog
   */
  private async showCreateFolderDialog(): Promise<void> {
    // Create a simple input dialog
    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.style.zIndex = '1200'; // Above the folder picker
    dialog.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content modal-small">
        <div class="modal-header">
          <h2>Create New Folder</h2>
          <button class="close-btn" id="close-create-folder">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="new-folder-name">Folder Name:</label>
            <input 
              type="text" 
              id="new-folder-name" 
              class="text-input" 
              placeholder="Enter folder name"
              autofocus
            >
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn" id="cancel-create-folder">Cancel</button>
          <button class="primary-btn" id="confirm-create-folder">Create</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    const input = dialog.querySelector('#new-folder-name') as HTMLInputElement;
    const closeBtn = dialog.querySelector('#close-create-folder');
    const cancelBtn = dialog.querySelector('#cancel-create-folder');
    const confirmBtn = dialog.querySelector('#confirm-create-folder');
    const overlay = dialog.querySelector('.modal-overlay');
    
    const closeDialog = () => dialog.remove();
    
    closeBtn?.addEventListener('click', closeDialog);
    cancelBtn?.addEventListener('click', closeDialog);
    overlay?.addEventListener('click', closeDialog);
    
    // Focus input
    setTimeout(() => input?.focus(), 100);
    
    // Handle Enter key
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        (confirmBtn as HTMLButtonElement)?.click();
      }
    });
    
    confirmBtn?.addEventListener('click', async () => {
      const folderName = input?.value.trim();
      if (!folderName || folderName.length === 0) {
        input?.focus();
        return;
      }
      
      // Disable button during creation
      if (confirmBtn instanceof HTMLButtonElement) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Creating...';
      }
      
      try {
        const result = await window.scribeCat.drive.createFolder(
          folderName,
          this.currentFolderId || undefined
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to create folder');
        }

        // Close dialog
        closeDialog();
        
        // Reload folders to show the new one
        await this.loadFolders(this.currentFolderId === null ? undefined : this.currentFolderId);
        
        // Show success message briefly
        const folderList = this.modal?.querySelector('#folder-list');
        if (folderList) {
          const successMsg = document.createElement('div');
          successMsg.style.cssText = 'padding: 12px; background: rgba(39, 174, 96, 0.2); border-radius: 6px; margin-bottom: 15px; color: #27ae60; text-align: center;';
          successMsg.textContent = `Folder "${folderName}" created successfully!`;
          folderList.parentElement?.insertBefore(successMsg, folderList);
          setTimeout(() => successMsg.remove(), 3000);
        }
      } catch (error) {
        console.error('Failed to create folder:', error);
        
        // Show error in dialog
        const errorMsg = (dialog.querySelector('.error-message') as HTMLElement) || document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.style.cssText = 'color: #e74c3c; font-size: 13px; margin-top: 8px;';
        errorMsg.textContent = `Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`;
        
        const formGroup = dialog.querySelector('.form-group');
        if (formGroup && !dialog.querySelector('.error-message')) {
          formGroup.appendChild(errorMsg);
        }
        
        // Re-enable button
        if (confirmBtn instanceof HTMLButtonElement) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Create';
        }
        
        input?.focus();
      }
    });
  }

  /**
   * Confirm folder selection
   */
  private confirmSelection(): void {
    if (this.onSelectCallback) {
      const pathNames = this.folderPath.map(entry => entry.name);
      const folderPath = this.selectedFolderId
        ? pathNames.join(' / ')
        : 'My Drive (Root)';
      this.onSelectCallback(this.selectedFolderId, folderPath);
    }
    this.hide();
  }

}
