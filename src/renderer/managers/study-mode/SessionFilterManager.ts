/**
 * SessionFilterManager
 *
 * Handles filtering and sorting of sessions.
 */

import type { Session } from '../../../domain/entities/Session.js';

export class SessionFilterManager {
  private sessions: Session[] = [];
  private filteredSessions: Session[] = [];

  private selectedCourse: string = '';
  private searchQuery: string = '';
  private selectedTags: string[] = [];
  private sortOrder: 'newest' | 'oldest' | 'longest' | 'shortest' = 'newest';
  private sharingFilter: 'all' | 'my-sessions' | 'shared-with-me' | 'shared-by-me' = 'all';

  private searchInput: HTMLInputElement | null = null;
  private courseFilter: HTMLSelectElement | null = null;
  private sortSelect: HTMLSelectElement | null = null;
  private sharingFilterSelect: HTMLSelectElement | null = null;

  private onFilterChange: (() => void) | null = null;

  constructor() {
    this.initializeControls();
  }

  /**
   * Initialize filter controls
   */
  private initializeControls(): void {
    this.searchInput = document.getElementById('study-search-input') as HTMLInputElement;
    this.courseFilter = document.getElementById('study-course-filter') as HTMLSelectElement;
    this.sortSelect = document.getElementById('study-sort-select') as HTMLSelectElement;
    this.sharingFilterSelect = document.getElementById('study-sharing-filter') as HTMLSelectElement;

    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        this.applyFilters();
        if (this.onFilterChange) this.onFilterChange();
      });
    }

    if (this.courseFilter) {
      this.courseFilter.addEventListener('change', (e) => {
        this.selectedCourse = (e.target as HTMLSelectElement).value;
        this.applyFilters();
        if (this.onFilterChange) this.onFilterChange();
      });
    }

    if (this.sortSelect) {
      this.sortSelect.addEventListener('change', (e) => {
        const value = (e.target as HTMLSelectElement).value;
        if (value === 'newest' || value === 'oldest' || value === 'longest' || value === 'shortest') {
          this.sortOrder = value;
        }
        this.applyFilters();
        if (this.onFilterChange) this.onFilterChange();
      });
    }

    if (this.sharingFilterSelect) {
      this.sharingFilterSelect.addEventListener('change', (e) => {
        const value = (e.target as HTMLSelectElement).value;
        if (value === 'all' || value === 'my-sessions' || value === 'shared-with-me' || value === 'shared-by-me') {
          this.sharingFilter = value;
        }
        this.applyFilters();
        if (this.onFilterChange) this.onFilterChange();
      });
    }
  }

  /**
   * Set filter change callback
   */
  public setOnFilterChange(callback: () => void): void {
    this.onFilterChange = callback;
  }

  /**
   * Set sessions to filter
   */
  public setSessions(sessions: Session[]): void {
    this.sessions = sessions;
    this.applyFilters();
  }

  /**
   * Get filtered sessions
   */
  public getFilteredSessions(): Session[] {
    return this.filteredSessions;
  }

  /**
   * Apply current filters
   */
  private applyFilters(): void {
    let filtered = [...this.sessions];

    // Sharing filter
    if (this.sharingFilter !== 'all') {
      filtered = filtered.filter(s => {
        const isShared = s.permissionLevel !== undefined;
        const isOwner = s.permissionLevel === 'owner';
        const isSharedWithMe = isShared && !isOwner;

        switch (this.sharingFilter) {
          case 'my-sessions':
            return !isShared;
          case 'shared-with-me':
            return isSharedWithMe;
          case 'shared-by-me':
            return isOwner;
          default:
            return true;
        }
      });
    }

    // Course filter
    if (this.selectedCourse) {
      filtered = filtered.filter(s => s.courseId === this.selectedCourse);
    }

    // Search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(s => {
        return (
          s.title.toLowerCase().includes(query) ||
          s.courseTitle?.toLowerCase().includes(query) ||
          s.courseNumber?.toLowerCase().includes(query) ||
          s.tags.some(tag => tag.toLowerCase().includes(query))
        );
      });
    }

    // Tag filter
    if (this.selectedTags.length > 0) {
      filtered = filtered.filter(s => {
        return this.selectedTags.every(tag => s.tags.includes(tag));
      });
    }

    this.filteredSessions = filtered;
    this.sortSessions();
  }

  /**
   * Sort sessions according to current sort order
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
   * Populate course filter dropdown
   */
  public populateCourseFilter(): void {
    if (!this.courseFilter) return;

    const courses = new Map<string, { id: string; title: string; number: string }>();

    this.sessions.forEach(session => {
      if (session.courseId) {
        courses.set(session.courseId, {
          id: session.courseId,
          title: session.courseTitle || 'Untitled',
          number: session.courseNumber || ''
        });
      }
    });

    this.courseFilter.innerHTML = '<option value="">All Courses</option>';

    Array.from(courses.values())
      .sort((a, b) => a.number.localeCompare(b.number))
      .forEach(course => {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = course.number ? `${course.number} - ${course.title}` : course.title;
        this.courseFilter!.appendChild(option);
      });

    if (this.selectedCourse) {
      this.courseFilter.value = this.selectedCourse;
    }
  }
}
