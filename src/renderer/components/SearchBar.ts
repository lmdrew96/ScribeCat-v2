/**
 * SearchBar Component
 *
 * Advanced search input with:
 * - Real-time search-as-you-type
 * - Recent searches dropdown
 * - Filter indicator chips
 * - Clear button
 * - Keyboard navigation
 */

import type { SearchManager } from '../managers/SearchManager.js';
import type { SearchFilter } from '../../domain/search/SearchFilter.js';

export class SearchBar {
  private searchManager: SearchManager;
  private container: HTMLElement;
  private input: HTMLInputElement | null = null;
  private clearBtn: HTMLElement | null = null;
  private filterChips: HTMLElement | null = null;
  private suggestionsDropdown: HTMLElement | null = null;
  private isDropdownVisible: boolean = false;

  constructor(searchManager: SearchManager, containerId: string) {
    this.searchManager = searchManager;

    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`SearchBar container not found: ${containerId}`);
    }

    this.container = container;
    this.initialize();
  }

  /**
   * Initialize search bar
   */
  private initialize(): void {
    this.renderSearchBar();
    this.setupEventListeners();
    this.renderFilterChips();
  }

  /**
   * Render search bar HTML
   */
  private renderSearchBar(): void {
    this.container.innerHTML = `
      <div class="search-bar-container">
        <div class="search-input-wrapper">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
          </svg>
          <input
            type="text"
            id="advanced-search-input"
            class="search-input"
            placeholder="Search sessions... (try 'last week with notes')"
            autocomplete="off"
          >
          <button id="search-clear-btn" class="search-clear-btn" style="display: none;">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
            </svg>
          </button>
        </div>
        <div id="search-suggestions" class="search-suggestions" style="display: none;"></div>
        <div id="search-filter-chips" class="search-filter-chips"></div>
      </div>
    `;

    this.input = document.getElementById('advanced-search-input') as HTMLInputElement;
    this.clearBtn = document.getElementById('search-clear-btn');
    this.filterChips = document.getElementById('search-filter-chips');
    this.suggestionsDropdown = document.getElementById('search-suggestions');
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Input change
    this.input?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
      this.handleInput(query);
    });

    // Focus - show recent searches
    this.input?.addEventListener('focus', () => {
      if (!this.input!.value.trim()) {
        this.showRecentSearches();
      }
    });

    // Clear button
    this.clearBtn?.addEventListener('click', () => {
      this.clear();
    });

    // Click outside to close dropdown
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target as Node)) {
        this.hideDropdown();
      }
    });

    // Keyboard navigation
    this.input?.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });
  }

  /**
   * Handle input change
   */
  private handleInput(query: string): void {
    // Show/hide clear button
    if (this.clearBtn) {
      this.clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
    }

    // Trigger search
    this.searchManager.search(query);

    // Update suggestions
    if (query.trim().length === 0) {
      this.showRecentSearches();
    } else {
      this.hideDropdown();
    }
  }

  /**
   * Handle keyboard events
   */
  private handleKeyboard(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.clear();
    } else if (e.key === 'ArrowDown' && this.isDropdownVisible) {
      e.preventDefault();
      this.navigateDropdown('down');
    } else if (e.key === 'ArrowUp' && this.isDropdownVisible) {
      e.preventDefault();
      this.navigateDropdown('up');
    } else if (e.key === 'Enter' && this.isDropdownVisible) {
      e.preventDefault();
      this.selectActiveDropdownItem();
    }
  }

  /**
   * Show recent searches dropdown
   */
  private showRecentSearches(): void {
    if (!this.suggestionsDropdown) return;

    const recentSearches = this.searchManager.getRecentSearches();

    if (recentSearches.length === 0) {
      this.hideDropdown();
      return;
    }

    this.suggestionsDropdown.innerHTML = `
      <div class="search-suggestions-header">
        Recent Searches
        <button id="clear-recent-searches" class="clear-recent-btn">Clear</button>
      </div>
      ${recentSearches.map((search, index) => `
        <div class="search-suggestion-item" data-index="${index}" data-query="${this.escapeHtml(search)}">
          <svg class="suggestion-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11 2a1 1 0 011 1v1h.5A1.5 1.5 0 0114 5.5v8a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 13.5v-8A1.5 1.5 0 013.5 4H4V3a1 1 0 012 0v1h4V3a1 1 0 011-1z"/>
          </svg>
          <span class="suggestion-text">${this.escapeHtml(search)}</span>
        </div>
      `).join('')}
    `;

    this.suggestionsDropdown.style.display = 'block';
    this.isDropdownVisible = true;

    // Set up click handlers
    this.suggestionsDropdown.querySelectorAll('.search-suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const query = item.getAttribute('data-query');
        if (query && this.input) {
          this.input.value = query;
          this.handleInput(query);
          this.hideDropdown();
        }
      });
    });

    // Clear recent button
    const clearBtn = document.getElementById('clear-recent-searches');
    clearBtn?.addEventListener('click', () => {
      this.searchManager.clearRecentSearches();
      this.hideDropdown();
    });
  }

  /**
   * Hide dropdown
   */
  private hideDropdown(): void {
    if (this.suggestionsDropdown) {
      this.suggestionsDropdown.style.display = 'none';
      this.isDropdownVisible = false;
    }
  }

  /**
   * Navigate dropdown with arrow keys
   */
  private navigateDropdown(direction: 'up' | 'down'): void {
    if (!this.suggestionsDropdown) return;

    const items = this.suggestionsDropdown.querySelectorAll('.search-suggestion-item');
    if (items.length === 0) return;

    const activeItem = this.suggestionsDropdown.querySelector('.search-suggestion-item.active');
    let nextIndex = 0;

    if (activeItem) {
      const currentIndex = parseInt(activeItem.getAttribute('data-index') || '0', 10);
      nextIndex = direction === 'down'
        ? Math.min(currentIndex + 1, items.length - 1)
        : Math.max(currentIndex - 1, 0);

      activeItem.classList.remove('active');
    }

    items[nextIndex].classList.add('active');
  }

  /**
   * Select active dropdown item
   */
  private selectActiveDropdownItem(): void {
    if (!this.suggestionsDropdown) return;

    const activeItem = this.suggestionsDropdown.querySelector('.search-suggestion-item.active');
    if (activeItem && this.input) {
      const query = activeItem.getAttribute('data-query');
      if (query) {
        this.input.value = query;
        this.handleInput(query);
        this.hideDropdown();
      }
    }
  }

  /**
   * Render filter chips
   */
  private renderFilterChips(): void {
    if (!this.filterChips) return;

    const filter = this.searchManager.getState().filter;
    const chips: string[] = [];

    if (filter.courseId) {
      chips.push(`Course: ${filter.courseId}`);
    }

    if (filter.tags.length > 0) {
      chips.push(`Tags: ${filter.tags.join(', ')}`);
    }

    if (filter.dateRange) {
      chips.push('Date filter active');
    }

    if (filter.durationRange) {
      chips.push('Duration filter active');
    }

    if (chips.length === 0) {
      this.filterChips.innerHTML = '';
      return;
    }

    this.filterChips.innerHTML = chips.map(chip => `
      <div class="filter-chip">
        ${chip}
        <button class="filter-chip-remove">×</button>
      </div>
    `).join('');
  }

  /**
   * Clear search
   */
  clear(): void {
    if (this.input) {
      this.input.value = '';
    }

    if (this.clearBtn) {
      this.clearBtn.style.display = 'none';
    }

    this.searchManager.clear();
    this.hideDropdown();
  }

  /**
   * Focus input
   */
  focus(): void {
    this.input?.focus();
  }

  /**
   * Escape HTML for safe rendering
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
