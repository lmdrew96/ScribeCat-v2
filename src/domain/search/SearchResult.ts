/**
 * SearchResult Entity
 *
 * Represents a session that matched the search query with relevance score.
 */

import type { Session } from '../entities/Session.js';

export interface MatchLocation {
  field: 'title' | 'notes' | 'transcription' | 'summary' | 'tags' | 'course';
  snippet?: string; // Text snippet showing the match
  highlightedSnippet?: string; // Snippet with <mark> tags
}

export class SearchResult {
  public readonly session: Session;
  public readonly relevanceScore: number; // 0-100
  public readonly matchLocations: MatchLocation[];

  constructor(
    session: Session,
    relevanceScore: number,
    matchLocations: MatchLocation[] = []
  ) {
    this.session = session;
    this.relevanceScore = Math.max(0, Math.min(100, relevanceScore));
    this.matchLocations = matchLocations;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.session.id;
  }

  /**
   * Get best match snippet
   */
  getBestMatchSnippet(): string | undefined {
    if (this.matchLocations.length === 0) return undefined;

    // Prioritize transcription and notes snippets
    const priorityFields = ['transcription', 'notes', 'summary'];
    for (const field of priorityFields) {
      const match = this.matchLocations.find(m => m.field === field && m.snippet);
      if (match?.snippet) return match.snippet;
    }

    // Fallback to any snippet
    return this.matchLocations[0]?.snippet;
  }

  /**
   * Check if result has matches in specific field
   */
  hasMatchIn(field: MatchLocation['field']): boolean {
    return this.matchLocations.some(m => m.field === field);
  }

  /**
   * Get matches for a specific field
   */
  getMatchesFor(field: MatchLocation['field']): MatchLocation[] {
    return this.matchLocations.filter(m => m.field === field);
  }

  /**
   * Sort results by relevance (highest first)
   */
  static sortByRelevance(results: SearchResult[]): SearchResult[] {
    return [...results].sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}
