/**
 * FilterSortManager
 *
 * Manages sorting and filtering for study mode sessions.
 * Integrates with SearchManager to apply filters and sort options.
 */

import type { Session } from '../../../domain/entities/Session.js';
import { SearchFilter } from '../../../domain/search/SearchFilter.js';
import { createLogger } from '../../../shared/logger.js';
import { getIconHTML } from '../../utils/iconMap.js';

const logger = createLogger('FilterSortManager');

export type SortOption = 'newest' | 'oldest' | 'a-z' | 'z-a' | 'longest' | 'shortest';

export interface SortConfig {
  option: SortOption;
  label: string;
  icon: string;
  description: string;
}

// Helper to create sort icons - call at runtime to get HTML
const getSortIcon = (iconName: string): string => getIconHTML(iconName as any, { size: 14 });

export const SORT_OPTIONS: Record<SortOption, SortConfig> = {
  newest: {
    option: 'newest',
    label: 'Newest First',
    icon: 'clock',
    description: 'Most recent sessions first'
  },
  oldest: {
    option: 'oldest',
    label: 'Oldest First',
    icon: 'clockHour',
    description: 'Oldest sessions first'
  },
  'a-z': {
    option: 'a-z',
    label: 'A-Z',
    icon: 'chevronDown',
    description: 'Sort by title (A to Z)'
  },
  'z-a': {
    option: 'z-a',
    label: 'Z-A',
    icon: 'chevronUp',
    description: 'Sort by title (Z to A)'
  },
  longest: {
    option: 'longest',
    label: 'Longest',
    icon: 'timer',
    description: 'Longest duration first'
  },
  shortest: {
    option: 'shortest',
    label: 'Shortest',
    icon: 'timer',
    description: 'Shortest duration first'
  }
};

export interface FilterState {
  hasTranscription?: boolean;
  hasNotes?: boolean;
  hasSummary?: boolean;
  isMultiSession?: boolean;
}

export class FilterSortManager {
  private currentSort: SortOption = 'newest';
  private filterState: FilterState = {};
  private onSortChange: ((sort: SortOption) => void) | null = null;
  private onFilterChange: ((filter: SearchFilter) => void) | null = null;

  constructor() {
    this.loadSavedState();
  }

  /**
   * Get current sort option
   */
  getCurrentSort(): SortOption {
    return this.currentSort;
  }

  /**
   * Set sort option
   */
  setSort(sort: SortOption): void {
    if (this.currentSort === sort) return;

    logger.info(`Changing sort: ${this.currentSort} → ${sort}`);

    this.currentSort = sort;
    this.saveState();

    // Notify listeners
    if (this.onSortChange) {
      this.onSortChange(sort);
    }

    // Show notification
    const notificationTicker = (window as any).notificationTicker;
    if (notificationTicker) {
      const config = SORT_OPTIONS[sort];
      notificationTicker.info(`Sorted by: ${config.label}`, 2000);
    }
  }

  /**
   * Get current filter state
   */
  getFilterState(): FilterState {
    return { ...this.filterState };
  }

  /**
   * Toggle a filter option
   */
  toggleFilter(filterKey: keyof FilterState, checked: boolean): void {
    // Simple two-state toggle: undefined (off) or true (on)
    if (checked) {
      this.filterState[filterKey] = true;
    } else {
      this.filterState[filterKey] = undefined;
    }

    logger.info(`Filter toggled: ${filterKey} = ${this.filterState[filterKey]}`);

    this.saveState();
    this.notifyFilterChange();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.filterState = {};
    this.saveState();
    this.notifyFilterChange();

    const notificationTicker = (window as any).notificationTicker;
    if (notificationTicker) {
      notificationTicker.info('Filters cleared', 2000);
    }
  }

  /**
   * Get count of active filters
   */
  getActiveFilterCount(): number {
    return Object.values(this.filterState).filter(v => v !== undefined).length;
  }

  /**
   * Convert filter state to SearchFilter
   */
  toSearchFilter(): SearchFilter {
    return new SearchFilter({
      hasTranscription: this.filterState.hasTranscription,
      hasNotes: this.filterState.hasNotes,
      hasSummary: this.filterState.hasSummary,
      isMultiSession: this.filterState.isMultiSession
    });
  }

  /**
   * Sort sessions based on current sort option
   */
  sortSessions(sessions: Session[]): Session[] {
    const sorted = [...sessions];

    switch (this.currentSort) {
      case 'newest':
        return sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      case 'oldest':
        return sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      case 'a-z':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));

      case 'z-a':
        return sorted.sort((a, b) => b.title.localeCompare(a.title));

      case 'longest':
        return sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0));

      case 'shortest':
        return sorted.sort((a, b) => (a.duration || 0) - (b.duration || 0));

      default:
        return sorted;
    }
  }

  /**
   * Set sort change callback
   */
  onSort(callback: (sort: SortOption) => void): void {
    this.onSortChange = callback;
  }

  /**
   * Set filter change callback
   */
  onFilter(callback: (filter: SearchFilter) => void): void {
    this.onFilterChange = callback;
  }

  /**
   * Get all sort options
   */
  getAllSortOptions(): SortConfig[] {
    return Object.values(SORT_OPTIONS);
  }

  /**
   * Create filter/sort UI controls
   */
  createControls(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) {
      logger.error(`Filter/sort container not found: ${containerId}`);
      return;
    }

    const activeCount = this.getActiveFilterCount();
    const badgeHtml = activeCount > 0 ? `<span class="filter-badge">${activeCount}</span>` : '';

    container.innerHTML = `
      <div class="filter-sort-controls">
        <!-- Sort Dropdown -->
        <div class="dropdown-container">
          <button class="control-btn sort-btn" id="sort-dropdown-btn">
            <span class="btn-icon">${getIconHTML('chart', { size: 14 })}</span>
            <span class="btn-label">Sort</span>
            <span class="dropdown-arrow">${getIconHTML('chevronDown', { size: 12 })}</span>
          </button>
          <div class="dropdown-menu" id="sort-dropdown-menu" style="display: none;">
            ${this.getAllSortOptions().map(config => `
              <button
                class="dropdown-item ${config.option === this.currentSort ? 'active' : ''}"
                data-sort="${config.option}"
              >
                <span class="item-icon">${getSortIcon(config.icon)}</span>
                <span class="item-label">${config.label}</span>
                ${config.option === this.currentSort ? `<span class="check-mark">${getIconHTML('check', { size: 12 })}</span>` : ''}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Filter Dropdown -->
        <div class="dropdown-container">
          <button class="control-btn filter-btn" id="filter-dropdown-btn">
            <span class="btn-icon">${getIconHTML('search', { size: 14 })}</span>
            <span class="btn-label">Filter</span>
            ${badgeHtml}
            <span class="dropdown-arrow">${getIconHTML('chevronDown', { size: 12 })}</span>
          </button>
          <div class="dropdown-menu" id="filter-dropdown-menu" style="display: none;">
            <div class="dropdown-section">
              <div class="section-label">Content</div>
              ${this.createFilterCheckbox('hasTranscription', `${getIconHTML('file', { size: 12 })} Has Transcription`)}
              ${this.createFilterCheckbox('hasNotes', `${getIconHTML('pencil', { size: 12 })} Has Notes`)}
              ${this.createFilterCheckbox('hasSummary', `${getIconHTML('clipboard', { size: 12 })} Has Summary`)}
            </div>
            <div class="dropdown-section">
              <div class="section-label">Type</div>
              ${this.createFilterCheckbox('isMultiSession', `${getIconHTML('library', { size: 12 })} Study Sets Only`)}
            </div>
            ${activeCount > 0 ? `
              <div class="dropdown-divider"></div>
              <button class="dropdown-item clear-filters-btn" id="clear-filters-btn">
                <span class="item-icon">${getIconHTML('trash', { size: 14 })}</span>
                <span class="item-label">Clear All Filters</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners(container);
  }

  /**
   * Create a filter checkbox item
   */
  private createFilterCheckbox(key: keyof FilterState, label: string): string {
    const value = this.filterState[key];
    const checked = value === true ? 'checked' : '';

    return `
      <label class="filter-checkbox">
        <input
          type="checkbox"
          data-filter="${key}"
          ${checked}
        />
        <span class="checkbox-label">${label}</span>
      </label>
    `;
  }

  /**
   * Attach event listeners to controls
   */
  private attachEventListeners(container: HTMLElement): void {
    // Sort dropdown toggle
    const sortBtn = container.querySelector('#sort-dropdown-btn');
    const sortMenu = container.querySelector('#sort-dropdown-menu');

    sortBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown(sortMenu as HTMLElement);
      // Close filter menu
      const filterMenu = container.querySelector('#filter-dropdown-menu') as HTMLElement;
      if (filterMenu) filterMenu.style.display = 'none';
    });

    // Sort option clicks
    container.querySelectorAll('[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sort = btn.getAttribute('data-sort') as SortOption;
        this.setSort(sort);
        this.updateControlsUI(container);
        if (sortMenu) sortMenu.style.display = 'none';
      });
    });

    // Filter dropdown toggle
    const filterBtn = container.querySelector('#filter-dropdown-btn');
    const filterMenu = container.querySelector('#filter-dropdown-menu');

    filterBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown(filterMenu as HTMLElement);
      // Close sort menu
      if (sortMenu) sortMenu.style.display = 'none';
    });

    // Filter checkbox clicks
    container.querySelectorAll('[data-filter]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const input = checkbox as HTMLInputElement;
        const filterKey = input.getAttribute('data-filter') as keyof FilterState;
        this.toggleFilter(filterKey, input.checked);
        this.updateControlsUI(container);
      });
    });

    // Clear filters button
    const clearBtn = container.querySelector('#clear-filters-btn');
    clearBtn?.addEventListener('click', () => {
      this.clearFilters();
      this.updateControlsUI(container);
      if (filterMenu) filterMenu.style.display = 'none';
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
      if (sortMenu) sortMenu.style.display = 'none';
      if (filterMenu) filterMenu.style.display = 'none';
    });
  }

  /**
   * Toggle dropdown visibility
   */
  private toggleDropdown(menu: HTMLElement): void {
    if (menu.style.display === 'none') {
      menu.style.display = 'block';
    } else {
      menu.style.display = 'none';
    }
  }

  /**
   * Update controls UI to reflect current state
   */
  private updateControlsUI(container: HTMLElement): void {
    // Recreate the controls to update checkboxes and badge
    this.createControls(container.id);
  }

  /**
   * Notify filter change listeners
   */
  private notifyFilterChange(): void {
    if (this.onFilterChange) {
      this.onFilterChange(this.toSearchFilter());
    }
  }

  /**
   * Save current state to localStorage
   */
  private saveState(): void {
    try {
      const state = {
        sort: this.currentSort,
        filter: this.filterState
      };
      localStorage.setItem('scribecat-filter-sort-state', JSON.stringify(state));
    } catch (error) {
      logger.error('Failed to save filter/sort state', error);
    }
  }

  /**
   * Load saved state from localStorage
   */
  private loadSavedState(): void {
    try {
      const saved = localStorage.getItem('scribecat-filter-sort-state');
      if (saved) {
        const state = JSON.parse(saved);
        if (state.sort && state.sort in SORT_OPTIONS) {
          this.currentSort = state.sort;
        }
        if (state.filter) {
          this.filterState = state.filter;
        }
      }
    } catch (error) {
      logger.error('Failed to load filter/sort state', error);
    }
  }
}
