/**
 * BulkSelectionManager
 *
 * Manages bulk selection and actions for session lists.
 */

import type { Session } from '../../../domain/entities/Session.js';

export class BulkSelectionManager {
  private selectedSessionIds: Set<string> = new Set();
  private bulkActionsBar: HTMLElement | null = null;
  private selectAllCheckbox: HTMLInputElement | null = null;
  private selectedCountSpan: HTMLElement | null = null;
  private createStudySetBtn: HTMLButtonElement | null = null;
  private bulkExportBtn: HTMLButtonElement | null = null;
  private bulkDeleteBtn: HTMLButtonElement | null = null;

  // Callbacks
  private onBulkExportCallback: ((sessionIds: Set<string>) => void) | null = null;
  private onBulkDeleteCallback: ((sessionIds: Set<string>) => void) | null = null;
  private onCreateStudySetCallback: (() => void) | null = null;

  constructor() {
    this.initializeElements();
    this.initializeEventListeners();
  }

  /**
   * Initialize bulk action elements
   */
  private initializeElements(): void {
    this.bulkActionsBar = document.getElementById('bulk-actions-bar') as HTMLElement;
    this.selectAllCheckbox = document.getElementById('select-all-sessions') as HTMLInputElement;
    this.selectedCountSpan = document.getElementById('selected-count') as HTMLElement;
    this.createStudySetBtn = document.getElementById('create-study-set-btn') as HTMLButtonElement;
    this.bulkExportBtn = document.getElementById('bulk-export-btn') as HTMLButtonElement;
    this.bulkDeleteBtn = document.getElementById('bulk-delete-btn') as HTMLButtonElement;
  }

  /**
   * Initialize event listeners
   */
  private initializeEventListeners(): void {
    if (this.selectAllCheckbox) {
      this.selectAllCheckbox.addEventListener('change', (e) => {
        this.handleSelectAll((e.target as HTMLInputElement).checked);
      });
    }

    if (this.createStudySetBtn) {
      this.createStudySetBtn.addEventListener('click', () => {
        if (this.onCreateStudySetCallback) {
          this.onCreateStudySetCallback();
        }
      });
    }
  }

  /**
   * Set callback for bulk export
   */
  public onBulkExport(callback: (sessionIds: Set<string>) => void): void {
    this.onBulkExportCallback = callback;
    if (this.bulkExportBtn) {
      this.bulkExportBtn.addEventListener('click', () => {
        callback(this.selectedSessionIds);
      });
    }
  }

  /**
   * Set callback for bulk delete
   */
  public onBulkDelete(callback: (sessionIds: Set<string>) => void): void {
    this.onBulkDeleteCallback = callback;
    if (this.bulkDeleteBtn) {
      this.bulkDeleteBtn.addEventListener('click', () => {
        callback(this.selectedSessionIds);
      });
    }
  }

  /**
   * Set callback for create study set
   */
  public onCreateStudySet(callback: () => void): void {
    this.onCreateStudySetCallback = callback;
  }

  /**
   * Handle select all checkbox
   */
  private handleSelectAll(isChecked: boolean): void {
    if (isChecked) {
      // Select all visible selectable sessions
      const checkboxes = document.querySelectorAll<HTMLInputElement>('.session-checkbox:not([disabled])');
      checkboxes.forEach(checkbox => {
        const sessionId = checkbox.dataset.sessionId;
        if (sessionId) {
          this.selectedSessionIds.add(sessionId);
          checkbox.checked = true;
          this.updateSessionCardSelection(sessionId, true);
        }
      });
    } else {
      // Deselect all
      this.selectedSessionIds.forEach(sessionId => {
        this.updateSessionCardSelection(sessionId, false);
      });
      this.selectedSessionIds.clear();

      const checkboxes = document.querySelectorAll<HTMLInputElement>('.session-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = false;
      });
    }

    this.updateBulkActionsBar();
  }

  /**
   * Handle individual session selection
   */
  public handleSessionSelection(sessionId: string, isSelected: boolean): void {
    if (isSelected) {
      this.selectedSessionIds.add(sessionId);
    } else {
      this.selectedSessionIds.delete(sessionId);
    }

    this.updateSessionCardSelection(sessionId, isSelected);
    this.updateBulkActionsBar();

    // Update select-all checkbox state
    if (this.selectAllCheckbox) {
      const totalCheckboxes = document.querySelectorAll<HTMLInputElement>('.session-checkbox:not([disabled])').length;
      this.selectAllCheckbox.checked = this.selectedSessionIds.size === totalCheckboxes && totalCheckboxes > 0;
      this.selectAllCheckbox.indeterminate = this.selectedSessionIds.size > 0 && this.selectedSessionIds.size < totalCheckboxes;
    }
  }

  /**
   * Update bulk actions bar visibility and count
   */
  private updateBulkActionsBar(): void {
    const count = this.selectedSessionIds.size;

    if (this.bulkActionsBar) {
      if (count > 0) {
        this.bulkActionsBar.classList.remove('hidden');
      } else {
        this.bulkActionsBar.classList.add('hidden');
      }
    }

    if (this.selectedCountSpan) {
      this.selectedCountSpan.textContent = count.toString();
    }

    // Enable/disable create study set button (requires 2+ sessions)
    if (this.createStudySetBtn) {
      this.createStudySetBtn.disabled = count < 2;
    }

    // Enable/disable bulk action buttons
    if (this.bulkExportBtn) {
      this.bulkExportBtn.disabled = count === 0;
    }
    if (this.bulkDeleteBtn) {
      this.bulkDeleteBtn.disabled = count === 0;
    }
  }

  /**
   * Update session card selection visual state
   */
  private updateSessionCardSelection(sessionId: string, isSelected: boolean): void {
    const card = document.querySelector(`.session-card[data-session-id="${sessionId}"]`);
    if (card) {
      if (isSelected) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    }
  }

  /**
   * Clear all selections
   */
  public clearSelection(): void {
    this.selectedSessionIds.forEach(sessionId => {
      this.updateSessionCardSelection(sessionId, false);
    });
    this.selectedSessionIds.clear();

    const checkboxes = document.querySelectorAll<HTMLInputElement>('.session-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });

    if (this.selectAllCheckbox) {
      this.selectAllCheckbox.checked = false;
      this.selectAllCheckbox.indeterminate = false;
    }

    this.updateBulkActionsBar();
  }

  /**
   * Get selected session IDs
   */
  public getSelectedSessionIds(): Set<string> {
    return this.selectedSessionIds;
  }

  /**
   * Get selected sessions count
   */
  public getSelectedCount(): number {
    return this.selectedSessionIds.size;
  }

  /**
   * Check if a session can be selected (not a shared non-owner session)
   */
  public canSelectSession(sessions: Session[], sessionId: string): boolean {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      return false;
    }

    // Can't select shared sessions unless you're the owner
    if (session.permissionLevel !== undefined && session.permissionLevel !== 'owner') {
      return false;
    }

    return true;
  }
}
