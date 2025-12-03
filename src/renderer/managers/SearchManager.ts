/**
 * SearchManager
 *
 * Manages search state and coordinates search functionality across the application.
 * Integrates with StudyModeSessionListManager for enhanced search capabilities.
 */

import type { Session } from '../../domain/entities/Session.js';
import { SearchService, type SearchOptions } from '../../application/search/SearchService.js';
import { SearchFilter } from '../../domain/search/SearchFilter.js';
import type { SearchResult } from '../../domain/search/SearchResult.js';
import type { CourseManager } from './CourseManager.js';
import { createLogger } from '../../shared/logger.js';

const logger = createLogger('SearchManager');

export interface SearchState {
  query: string;
  filter: SearchFilter;
  results: SearchResult[];
  isSearching: boolean;
  recentSearches: string[];
}

export class SearchManager {
  private state: SearchState = {
    query: '',
    filter: SearchFilter.createEmpty(),
    results: [],
    isSearching: false,
    recentSearches: this.loadRecentSearches()
  };

  private sessions: Session[] = [];
  private searchTimeout: number | null = null;
  private onResultsChange: ((results: SearchResult[]) => void) | null = null;
  private courseManager: CourseManager | null = null;

  /**
   * Set sessions to search
   */
  setSessions(sessions: Session[]): void {
    this.sessions = sessions;
  }

  /**
   * Set course manager for natural language course lookup
   */
  setCourseManager(courseManager: CourseManager): void {
    this.courseManager = courseManager;
  }

  /**
   * Perform search with query
   */
  search(query: string, filter?: SearchFilter, options?: SearchOptions): void {
    // Clear any pending search
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Update state
    this.state.query = query;
    if (filter) {
      this.state.filter = filter;
    }
    this.state.isSearching = true;

    // Debounce search (300ms)
    this.searchTimeout = window.setTimeout(() => {
      this.performSearch(options);
    }, 300);
  }

  /**
   * Perform the actual search
   */
  private performSearch(options?: SearchOptions): void {
    try {
      logger.info(`Searching: "${this.state.query}"`);

      // Get courses for natural language lookup
      const courses = this.courseManager?.getCourses() || [];

      const results = SearchService.search(
        this.sessions,
        this.state.query,
        this.state.filter,
        { ...options, courses }
      );

      this.state.results = results;
      this.state.isSearching = false;

      // Save to recent searches if query is not empty
      if (this.state.query.trim().length > 0) {
        this.addRecentSearch(this.state.query);
      }

      // Notify listeners
      if (this.onResultsChange) {
        this.onResultsChange(results);
      }

      logger.info(`Search complete: ${results.length} results`);
    } catch (error) {
      logger.error('Search failed', error);
      this.state.isSearching = false;
      this.state.results = [];
    }
  }

  /**
   * Clear search
   */
  clear(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }

    this.state.query = '';
    this.state.filter = SearchFilter.createEmpty();
    this.state.results = [];
    this.state.isSearching = false;

    // Notify listeners
    if (this.onResultsChange) {
      this.onResultsChange([]);
    }
  }

  /**
   * Set filter
   */
  setFilter(filter: SearchFilter): void {
    this.state.filter = filter;

    // Re-search if we have a query
    if (this.state.query.trim().length > 0) {
      this.search(this.state.query);
    }
  }

  /**
   * Get current search state
   */
  getState(): SearchState {
    return { ...this.state };
  }

  /**
   * Get search results
   */
  getResults(): SearchResult[] {
    return this.state.results;
  }

  /**
   * Get result sessions (just the session entities)
   */
  getResultSessions(): Session[] {
    return this.state.results.map(r => r.session);
  }

  /**
   * Check if currently searching
   */
  isSearching(): boolean {
    return this.state.isSearching;
  }

  /**
   * Set results change callback
   */
  onResults(callback: (results: SearchResult[]) => void): void {
    this.onResultsChange = callback;
  }

  /**
   * Add to recent searches
   */
  private addRecentSearch(query: string): void {
    const normalized = query.trim().toLowerCase();

    // Remove if already exists
    this.state.recentSearches = this.state.recentSearches.filter(
      q => q.toLowerCase() !== normalized
    );

    // Add to front
    this.state.recentSearches.unshift(query.trim());

    // Keep only last 10
    this.state.recentSearches = this.state.recentSearches.slice(0, 10);

    // Save to localStorage
    this.saveRecentSearches();
  }

  /**
   * Get recent searches
   */
  getRecentSearches(): string[] {
    return [...this.state.recentSearches];
  }

  /**
   * Clear recent searches
   */
  clearRecentSearches(): void {
    this.state.recentSearches = [];
    localStorage.removeItem('scribecat-recent-searches');
  }

  /**
   * Load recent searches from localStorage
   */
  private loadRecentSearches(): string[] {
    try {
      const saved = localStorage.getItem('scribecat-recent-searches');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      logger.error('Failed to load recent searches', error);
      return [];
    }
  }

  /**
   * Save recent searches to localStorage
   */
  private saveRecentSearches(): void {
    try {
      localStorage.setItem('scribecat-recent-searches', JSON.stringify(this.state.recentSearches));
    } catch (error) {
      logger.error('Failed to save recent searches', error);
    }
  }
}
