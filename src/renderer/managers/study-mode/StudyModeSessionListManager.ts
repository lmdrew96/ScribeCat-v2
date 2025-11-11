/**
 * StudyModeSessionListManager
 *
 * Handles session list display, filtering, sorting, and bulk selection.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { createLogger } from '../../../shared/logger.js';
import { SessionCardRenderer } from './SessionCardRenderer.js';

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
  private createStudySetBtn: HTMLButtonElement | null = null;
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
    this.createStudySetBtn = document.getElementById('create-study-set-btn') as HTMLButtonElement;
    this.bulkExportBtn = document.getElementById('bulk-export-btn') as HTMLButtonElement;
    this.bulkDeleteBtn = document.getElementById('bulk-delete-btn') as HTMLButtonElement;

    // Search input
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        this.applyFilters();
        // Use Phase3Integration to prevent dual rendering system conflicts
        if (window.phase3Integration) {
          window.phase3Integration.refreshCurrentView();
        } else {
          this.render();
        }
      });
    }

    // Course filter
    if (this.courseFilter) {
      this.courseFilter.addEventListener('change', (e) => {
        this.selectedCourse = (e.target as HTMLSelectElement).value;
        this.applyFilters();
        // Use Phase3Integration to prevent dual rendering system conflicts
        if (window.phase3Integration) {
          window.phase3Integration.refreshCurrentView();
        } else {
          this.render();
        }
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
        // Use Phase3Integration to prevent dual rendering system conflicts
        if (window.phase3Integration) {
          window.phase3Integration.refreshCurrentView();
        } else {
          this.render();
        }
      });
    }

    // Bulk action handlers
    if (this.selectAllCheckbox) {
      this.selectAllCheckbox.addEventListener('change', (e) => {
        this.handleSelectAll((e.target as HTMLInputElement).checked);
      });
    }

    // Create Study Set button handler
    if (this.createStudySetBtn) {
      this.createStudySetBtn.addEventListener('click', () => {
        this.handleCreateStudySet();
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

  /**
   * Render the session list
   */
  render(): void {
    if (this.filteredSessions.length === 0) {
      this.renderEmptyState();
      return;
    }

    const sessionCards = this.filteredSessions.map(session =>
      SessionCardRenderer.createSessionCard(session, this.selectedSessionIds.has(session.id))
    ).join('');

    this.sessionListContainer.innerHTML = sessionCards;

    // Add click handlers to session cards
    this.attachSessionCardHandlers();

    // Add title edit handlers
    this.attachTitleEditHandlers();
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): void {
    const hasFilters = this.selectedCourse || this.searchQuery || this.selectedTags.length > 0;

    this.sessionListContainer.innerHTML = hasFilters
      ? `<div class="empty-state"><div class="empty-icon">🔍</div><h3>No sessions found</h3><p>Try adjusting your filters or search query</p></div>`
      : `<div class="empty-state"><div class="empty-icon">📚</div><h3>No recording sessions yet</h3><p>Start recording to create your first session!</p><button id="start-recording-prompt" class="primary-btn">Start Recording</button></div>`;

    if (!hasFilters) {
      document.getElementById('start-recording-prompt')?.addEventListener('click', () => {
        this.sessionListContainer.dispatchEvent(new CustomEvent('hideStudyMode'));
      });
    }
  }

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


  /**
   * Attach event handlers to session cards
   */
  private attachSessionCardHandlers(): void {
    // Checkbox handlers
    const checkboxes = document.querySelectorAll('.session-card-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const sessionId = (checkbox as HTMLElement).dataset.sessionId;
        const isChecked = (checkbox as HTMLInputElement).checked;

        if (sessionId) {
          this.handleSessionSelection(sessionId, isChecked);
        }
      });
    });

    // Share session buttons
    const shareButtons = document.querySelectorAll('.share-session-btn');
    shareButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.sessionListContainer.dispatchEvent(new CustomEvent('shareSession', { detail: { sessionId } }));
        }
      });
    });

    // Export session buttons
    const exportButtons = document.querySelectorAll('.export-session-btn');
    exportButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.sessionListContainer.dispatchEvent(new CustomEvent('exportSession', { detail: { sessionId } }));
        }
      });
    });

    // Delete session buttons
    const deleteButtons = document.querySelectorAll('.delete-session-btn');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.sessionListContainer.dispatchEvent(new CustomEvent('deleteSession', { detail: { sessionId } }));
        }
      });
    });

    // Leave button handlers (for shared sessions)
    const leaveButtons = document.querySelectorAll('.leave-session-btn');
    leaveButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.sessionListContainer.dispatchEvent(new CustomEvent('leaveSession', { detail: { sessionId } }));
        }
      });
    });

    // Card click (same as view button)
    const cards = document.querySelectorAll('.session-card');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking on buttons, title, or checkbox
        const target = e.target as HTMLElement;
        if (target.closest('.action-btn') || target.closest('.edit-title-btn') ||
            target.closest('.session-title') || target.closest('.session-card-checkbox')) {
          return;
        }

        const sessionId = (card as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.sessionListContainer.dispatchEvent(new CustomEvent('openSessionDetail', { detail: { sessionId } }));
        }
      });
    });
  }

  /**
   * Attach title edit handlers
   */
  private attachTitleEditHandlers(): void {
    // Edit buttons
    const editButtons = document.querySelectorAll('.edit-title-btn');
    editButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.sessionListContainer.dispatchEvent(new CustomEvent('startTitleEdit', { detail: { sessionId } }));
        }
      });
    });

    // Title click to open session details
    const titles = document.querySelectorAll('.session-title');
    titles.forEach(title => {
      title.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = (title as HTMLElement).dataset.sessionId;
        if (sessionId) {
          this.sessionListContainer.dispatchEvent(new CustomEvent('openSessionDetail', { detail: { sessionId } }));
        }
      });
    });
  }


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
    this.render();
  }

  /**
   * Handle create study set button click
   */
  private async handleCreateStudySet(): Promise<void> {
    if (this.selectedSessionIds.size < 2) {
      alert('Please select at least 2 sessions to create a study set');
      return;
    }

    const selectedSessions = Array.from(this.selectedSessionIds)
      .map(id => this.sessions.find(s => s.id === id))
      .filter((s): s is Session => s !== undefined);

    const courseIds = selectedSessions.map(s => s.courseId);
    const uniqueCourseIds = new Set(courseIds);

    if (uniqueCourseIds.size > 1) {
      alert('Cannot create study set: all sessions must be from the same course');
      return;
    }

    this.sessionListContainer.dispatchEvent(
      new CustomEvent('openReorderModal', { detail: { sessions: selectedSessions } })
    );
  }

  /**
   * Update bulk actions bar visibility and state
   */
  private updateBulkActionsBar(): void {
    const count = this.selectedSessionIds.size;

    if (!this.bulkActionsBar || !this.selectedCountSpan ||
        !this.bulkExportBtn || !this.bulkDeleteBtn || !this.selectAllCheckbox ||
        !this.createStudySetBtn) {
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
    this.createStudySetBtn.disabled = count < 2; // Need at least 2 sessions for a study set
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
    this.render();
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
