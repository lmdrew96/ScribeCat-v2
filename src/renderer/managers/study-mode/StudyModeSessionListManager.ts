/**
 * StudyModeSessionListManager
 *
 * Handles session list display, filtering, sorting, and bulk selection.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { SyncStatus } from '../../../domain/entities/Session.js';
import { createLogger } from '../../../shared/logger.js';
import { formatDuration, escapeHtml, formatCourseTitle } from '../../utils/formatting.js';

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
        this.render();
      });
    }

    // Course filter
    if (this.courseFilter) {
      this.courseFilter.addEventListener('change', (e) => {
        this.selectedCourse = (e.target as HTMLSelectElement).value;
        this.applyFilters();
        this.render();
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
        this.render();
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
    logger.info(`Loaded ${sessions.length} sessions`);
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
      // Course filter - check courseTitle field first, then tags
      if (this.selectedCourse) {
        let hasCourse = false;

        // Check dedicated courseTitle field
        if (session.courseTitle && session.courseTitle.trim()) {
          hasCourse = session.courseTitle.toLowerCase().includes(this.selectedCourse.toLowerCase());
        }

        // Fall back to tags if courseTitle doesn't match
        if (!hasCourse && session.tags) {
          hasCourse = session.tags.some(tag =>
            tag.toLowerCase().includes(this.selectedCourse.toLowerCase())
          );
        }

        if (!hasCourse) return false;
      }

      // Search filter (searches title, transcription, and notes)
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        const matchesTitle = session.title.toLowerCase().includes(query);
        const matchesTranscription = session.transcription?.fullText.toLowerCase().includes(query);
        const matchesNotes = session.notes?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesTranscription && !matchesNotes) return false;
      }

      // Tag filter
      if (this.selectedTags.length > 0 && session.tags) {
        const hasTag = this.selectedTags.some(tag =>
          session.tags.includes(tag)
        );
        if (!hasTag) return false;
      }

      return true;
    });

    // Apply sorting
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
      this.createSessionCard(session)
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

    if (hasFilters) {
      this.sessionListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>No sessions found</h3>
          <p>Try adjusting your filters or search query</p>
        </div>
      `;
    } else {
      this.sessionListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📚</div>
          <h3>No recording sessions yet</h3>
          <p>Start recording to create your first session!</p>
          <button id="start-recording-prompt" class="primary-btn">Start Recording</button>
        </div>
      `;

      // Add handler for start recording button
      const startBtn = document.getElementById('start-recording-prompt');
      startBtn?.addEventListener('click', () => {
        // Emit event to hide study mode
        this.sessionListContainer.dispatchEvent(new CustomEvent('hideStudyMode'));
      });
    }
  }

  /**
   * Populate course filter dropdown
   */
  populateCourseFilter(): void {
    if (!this.courseFilter) return;

    // Get unique courses from sessions
    const courses = new Set<string>();
    this.sessions.forEach(session => {
      // Prioritize dedicated courseTitle field
      if (session.courseTitle && session.courseTitle.trim()) {
        courses.add(session.courseTitle);
      } else if (session.tags) {
        // Fall back to tag-based search if courseTitle is not set
        session.tags.forEach(tag => {
          if (tag.toLowerCase().includes('course') || tag.toLowerCase().includes('class')) {
            courses.add(tag);
          }
        });
      }
    });

    // Clear and populate dropdown
    this.courseFilter.innerHTML = '<option value="">All Courses</option>';
    Array.from(courses).sort().forEach(course => {
      const option = document.createElement('option');
      option.value = course;
      option.textContent = course;
      this.courseFilter!.appendChild(option);
    });
  }

  /**
   * Create HTML for a session card
   */
  private createSessionCard(session: Session): string {
    const date = new Date(session.createdAt);
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    const duration = formatDuration(session.duration);

    // Check if this is a multi-session study set
    const isStudySet = session.isMultiSessionStudySet();

    // Get preview content based on session type
    let previewContent = '';
    if (isStudySet) {
      // For study sets, show badge with session count
      const sessionCount = session.getChildSessionIds().length;
      previewContent = `<span class="multi-session-badge">📚 Study Set • ${sessionCount} session${sessionCount !== 1 ? 's' : ''}</span>`;
    } else {
      // For regular sessions, show summary (or transcription preview as fallback)
      const summaryPreview = session.summary
        ? session.summary.substring(0, 150) + (session.summary.length > 150 ? '...' : '')
        : session.transcription
        ? session.transcription.fullText.substring(0, 150) + '...'
        : 'No summary or transcription available';
      previewContent = escapeHtml(summaryPreview);
    }

    // Get course information from dedicated fields first, fall back to tags
    let courseTag = '';
    if (session.courseTitle && session.courseTitle.trim()) {
      const fullTitle = session.courseTitle.trim();
      const displayTitle = formatCourseTitle(fullTitle);
      courseTag = `<span class="course-badge" data-tooltip="${escapeHtml(fullTitle)}"><span class="course-badge-text">${escapeHtml(displayTitle)}</span></span>`;
    } else {
      // Fall back to tag-based search if dedicated fields are empty
      const courseTags = session.tags?.filter(tag =>
        tag.includes('course') || tag.includes('class')
      ) || [];
      if (courseTags.length > 0) {
        const fullTitle = courseTags[0].trim();
        const displayTitle = formatCourseTitle(fullTitle);
        courseTag = `<span class="course-badge" data-tooltip="${escapeHtml(fullTitle)}"><span class="course-badge-text">${escapeHtml(displayTitle)}</span></span>`;
      }
    }

    // Status indicators
    const hasTranscription = session.transcription ? '✓ Transcribed' : '';
    const hasNotes = session.notes ? '✓ Notes' : '';
    const syncStatus = isStudySet ? '' : this.getSyncStatusIndicator(session);

    // Generate shared badge with owner's name if available
    let sharedBadge = '';
    if ((session as any).isShared) {
      const ownerName = (session as any).ownerName;
      const ownerEmail = (session as any).ownerEmail;
      if (ownerName) {
        sharedBadge = `<span class="shared-badge" title="Shared by ${escapeHtml(ownerName)} (${escapeHtml(ownerEmail || '')})">👥 Shared by ${escapeHtml(ownerName)}</span>`;
      } else if (ownerEmail) {
        sharedBadge = `<span class="shared-badge" title="Shared by ${escapeHtml(ownerEmail)}">👥 Shared by ${escapeHtml(ownerEmail)}</span>`;
      } else {
        sharedBadge = '<span class="shared-badge" title="Shared with you">👥 Shared</span>';
      }
    }

    const indicators = [hasTranscription, hasNotes, syncStatus, sharedBadge].filter(Boolean).join(' • ');
    const indicatorsWithCourse = [indicators, courseTag].filter(Boolean).join(' • ');

    // Check if selected
    const isSelected = this.selectedSessionIds.has(session.id);

    return `
      <div class="session-card ${isSelected ? 'selected' : ''}" data-session-id="${session.id}">
        <input type="checkbox" class="session-card-checkbox" data-session-id="${session.id}" ${isSelected ? 'checked' : ''}>
        <div class="session-card-header">
          <h3 class="session-title" data-session-id="${session.id}">${escapeHtml(session.title)}</h3>
          <button class="edit-title-btn" data-session-id="${session.id}" title="Edit title">✏️</button>
        </div>

        <div class="session-meta">
          <span class="session-date">📅 ${formattedDate} at ${formattedTime}</span>
          <span class="session-duration">⏱️ ${duration}</span>
        </div>

        <div class="session-preview">
          ${previewContent}
        </div>

        ${indicatorsWithCourse ? `<div class="session-indicators">${indicatorsWithCourse}</div>` : ''}

        <div class="session-actions">
          ${(session as any).isShared ? `
            <button class="action-btn export-session-btn" data-session-id="${session.id}">
              Export
            </button>
            <button class="action-btn leave-session-btn" data-session-id="${session.id}">
              👋 Leave
            </button>
          ` : isStudySet ? `
            <button class="action-btn delete-session-btn" data-session-id="${session.id}">
              🗑️ Delete
            </button>
          ` : `
            <button class="action-btn share-session-btn" data-session-id="${session.id}">
              🔗 Share
            </button>
            <button class="action-btn export-session-btn" data-session-id="${session.id}">
              Export
            </button>
            <button class="action-btn delete-session-btn" data-session-id="${session.id}">
              🗑️ Delete
            </button>
          `}
        </div>
      </div>
    `;
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
   * Format duration in MM:SS format
   */

  /**
   * Get sync status indicator HTML
   */
  private getSyncStatusIndicator(session: Session): string {
    if (!session.userId) {
      // Not authenticated - no sync indicator
      return '';
    }

    switch (session.syncStatus) {
      case SyncStatus.SYNCED:
        return '<span class="sync-indicator synced" title="Synced to cloud">☁️ ✓</span>';
      case SyncStatus.SYNCING:
        return '<span class="sync-indicator syncing" title="Syncing...">☁️ ↑</span>';
      case SyncStatus.FAILED:
        return '<span class="sync-indicator failed" title="Sync failed">☁️ ✗</span>';
      case SyncStatus.NOT_SYNCED:
        return '<span class="sync-indicator not-synced" title="Not synced">☁️ •</span>';
      case SyncStatus.CONFLICT:
        return '<span class="sync-indicator conflict" title="Sync conflict">☁️ ⚠</span>';
      default:
        return '';
    }
  }

  /**
   * Escape HTML to prevent XSS
   */


  /**
   * Check if a session can be selected
   */
  private canSelectSession(sessionId: string): boolean {
    // Allow all sessions to be selected for bulk actions
    // Course validation is done at the action level (e.g., study set creation)
    return true;
  }

  /**
   * Show a temporary notification message
   */
  private showNotification(message: string, type: 'success' | 'warning' | 'error' = 'success'): void {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#ef4444'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      animation: slideInRight 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
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
      this.showNotification('Please select at least 2 sessions to create a study set', 'warning');
      return;
    }

    // Get selected sessions in order
    const selectedSessions = Array.from(this.selectedSessionIds)
      .map(id => this.sessions.find(s => s.id === id))
      .filter((s): s is Session => s !== undefined);

    // Validate that all selected sessions are from the same course
    const courseIds = selectedSessions.map(s => s.courseId);
    const uniqueCourseIds = new Set(courseIds);

    if (uniqueCourseIds.size > 1) {
      this.showNotification('Cannot create study set: all sessions must be from the same course', 'warning');
      return;
    }

    // Open reorder modal
    this.openReorderModal(selectedSessions);
  }

  /**
   * Open the reorder modal for session ordering
   */
  private openReorderModal(sessions: Session[]): void {
    // Emit event to parent manager to handle modal display
    this.sessionListContainer.dispatchEvent(
      new CustomEvent('openReorderModal', {
        detail: { sessions }
      })
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
