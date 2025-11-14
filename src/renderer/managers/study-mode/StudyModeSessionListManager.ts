/**
 * StudyModeSessionListManager
 *
 * Handles session list display, filtering, sorting, and bulk selection.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('StudyModeSessionListManager');

export class StudyModeSessionListManager {
  private sessions: Session[] = [];
  private filteredSessions: Session[] = [];
  private sessionListContainer: HTMLElement;

  // Filter state
  private selectedCourse: string = '';
  private searchQuery: string = '';
  private selectedTags: string[] = [];
  private sortOrder: 'newest' | 'oldest' | 'longest' | 'shortest' = 'newest';

  // Filter UI elements
  private searchInput: HTMLInputElement | null = null;
  private courseFilter: HTMLSelectElement | null = null;
  private sortSelect: HTMLSelectElement | null = null;

  // Bulk action state
  private selectedSessionIds: Set<string> = new Set();
  private bulkActionsBar: HTMLElement | null = null;
  private selectAllCheckbox: HTMLInputElement | null = null;
  private selectedCountSpan: HTMLElement | null = null;
  private bulkExportBtn: HTMLButtonElement | null = null;
  private bulkDeleteBtn: HTMLButtonElement | null = null;

  constructor(sessionListContainer: HTMLElement) {
    this.sessionListContainer = sessionListContainer;
    this.initializeFilterControls();
  }

  /**
   * Initialize filter controls
   */
  private initializeFilterControls(): void {
    // Get filter elements
    this.searchInput = document.getElementById('study-search-input') as HTMLInputElement;
    this.courseFilter = document.getElementById('study-course-filter') as HTMLSelectElement;
    this.sortSelect = document.getElementById('study-sort-select') as HTMLSelectElement;

    // Get bulk action elements
    this.bulkActionsBar = document.getElementById('bulk-actions-bar') as HTMLElement;
    this.selectAllCheckbox = document.getElementById('select-all-sessions') as HTMLInputElement;
    this.selectedCountSpan = document.getElementById('selected-count') as HTMLElement;
    this.bulkExportBtn = document.getElementById('bulk-export-btn') as HTMLButtonElement;
    this.bulkDeleteBtn = document.getElementById('bulk-delete-btn') as HTMLButtonElement;

    // Search input
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        this.applyFilters();
        // Phase3Integration handles all rendering
        window.phase3Integration?.refreshCurrentView();
      });
    }

    // Course filter
    if (this.courseFilter) {
      this.courseFilter.addEventListener('change', (e) => {
        this.selectedCourse = (e.target as HTMLSelectElement).value;
        this.applyFilters();
        // Phase3Integration handles all rendering
        window.phase3Integration?.refreshCurrentView();
      });
    }

    // Sort select
    if (this.sortSelect) {
      this.sortSelect.addEventListener('change', (e) => {
        const value = (e.target as HTMLSelectElement).value;
        if (value === 'newest' || value === 'oldest' || value === 'longest' || value === 'shortest') {
          this.sortOrder = value;
        }
        this.applyFilters();
        // Phase3Integration handles all rendering
        window.phase3Integration?.refreshCurrentView();
      });
    }

    // Bulk action handlers
    if (this.selectAllCheckbox) {
      this.selectAllCheckbox.addEventListener('change', (e) => {
        this.handleSelectAll((e.target as HTMLInputElement).checked);
      });
    }
  }

  /**
   * Set sessions data
   */
  setSessions(sessions: Session[]): void {
    this.sessions = sessions;
    this.applyFilters();
  }

  /**
   * Get filtered sessions
   */
  getFilteredSessions(): Session[] {
    return this.filteredSessions;
  }

  /**
   * Apply filters to session list
   */
  private applyFilters(): void {
    this.filteredSessions = this.sessions.filter(session => {
      if (this.selectedCourse) {
        const hasCourse = session.courseTitle?.toLowerCase().includes(this.selectedCourse.toLowerCase()) ||
          session.tags?.some(tag => tag.toLowerCase().includes(this.selectedCourse.toLowerCase()));
        if (!hasCourse) return false;
      }

      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        if (!session.title.toLowerCase().includes(query) &&
            !session.transcription?.fullText.toLowerCase().includes(query) &&
            !session.notes?.toLowerCase().includes(query)) return false;
      }

      if (this.selectedTags.length > 0 && session.tags) {
        if (!this.selectedTags.some(tag => session.tags.includes(tag))) return false;
      }

      return true;
    });

    this.sortSessions();
  }

  /**
   * Sort filtered sessions
   */
  private sortSessions(): void {
    this.filteredSessions.sort((a, b) => {
      switch (this.sortOrder) {
        case 'newest':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'oldest':
          return a.createdAt.getTime() - b.createdAt.getTime();
        case 'longest':
          return b.duration - a.duration;
        case 'shortest':
          return a.duration - b.duration;
        default:
          return 0;
      }
    });
  }

  // Phase 2 renderer removed - Phase3Integration now handles all rendering

  /**
   * Populate course filter dropdown
   */
  populateCourseFilter(): void {
    if (!this.courseFilter) return;

    const courses = new Set<string>();
    this.sessions.forEach(session => {
      if (session.courseTitle?.trim()) {
        courses.add(session.courseTitle);
      } else {
        session.tags?.forEach(tag => {
          if (tag.toLowerCase().includes('course') || tag.toLowerCase().includes('class')) {
            courses.add(tag);
          }
        });
      }
    });

    this.courseFilter.innerHTML = '<option value="">All Courses</option>' +
      Array.from(courses).sort().map(course =>
        `<option value="${course}">${course}</option>`
      ).join('');
  }


  // Phase 2 event handlers removed - Phase3 views handle their own events


  /**
   * Handle session selection
   */
  private handleSessionSelection(sessionId: string, isSelected: boolean): void {
    if (isSelected) {
      this.selectedSessionIds.add(sessionId);
    } else {
      this.selectedSessionIds.delete(sessionId);
    }

    this.updateBulkActionsBar();
    this.updateSessionCardSelection(sessionId, isSelected);
  }

  /**
   * Handle select all checkbox
   */
  private handleSelectAll(isChecked: boolean): void {
    if (isChecked) {
      // Select all filtered sessions
      this.filteredSessions.forEach(session => {
        this.selectedSessionIds.add(session.id);
      });
    } else {
      // Deselect all
      this.selectedSessionIds.clear();
    }

    this.updateBulkActionsBar();
    // Note: Don't call render() here - Phase3Integration handles all rendering
    // Selection state is maintained through Phase3 BulkSelectionManager
  }

  /**
   * Update bulk actions bar visibility and state
   */
  private updateBulkActionsBar(): void {
    const count = this.selectedSessionIds.size;

    if (!this.bulkActionsBar || !this.selectedCountSpan ||
        !this.bulkExportBtn || !this.bulkDeleteBtn || !this.selectAllCheckbox) {
      return;
    }

    // Show/hide bulk actions bar
    if (count > 0) {
      this.bulkActionsBar.classList.remove('hidden');
    } else {
      this.bulkActionsBar.classList.add('hidden');
    }

    // Update count text
    this.selectedCountSpan.textContent = `${count} selected`;

    // Update select all checkbox state
    const allSelected = this.filteredSessions.length > 0 &&
                       count === this.filteredSessions.length;
    this.selectAllCheckbox.checked = allSelected;
    this.selectAllCheckbox.indeterminate = count > 0 && !allSelected;

    // Enable/disable action buttons
    this.bulkExportBtn.disabled = count === 0;
    this.bulkDeleteBtn.disabled = count === 0;
  }

  /**
   * Update session card selection state
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
   * Get selected session IDs
   */
  getSelectedSessionIds(): Set<string> {
    return this.selectedSessionIds;
  }

  /**
   * Clear selected sessions
   */
  clearSelection(): void {
    this.selectedSessionIds.clear();
    this.updateBulkActionsBar();
    // Note: Don't call render() here - Phase3Integration handles all rendering
  }

  /**
   * Register bulk export handler
   */
  onBulkExport(handler: (sessionIds: Set<string>) => void): void {
    if (this.bulkExportBtn) {
      this.bulkExportBtn.addEventListener('click', () => {
        handler(this.selectedSessionIds);
      });
    }
  }

  /**
   * Register bulk delete handler
   */
  onBulkDelete(handler: (sessionIds: Set<string>) => void): void {
    if (this.bulkDeleteBtn) {
      this.bulkDeleteBtn.addEventListener('click', () => {
        handler(this.selectedSessionIds);
      });
    }
  }
}
