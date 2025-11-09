/**
 * SearchService
 *
 * Main search orchestration service.
 * Combines natural language parsing, filtering, and relevance scoring.
 */

import type { Session } from '../../domain/entities/Session.js';
import { SearchQuery } from '../../domain/search/SearchQuery.js';
import { SearchFilter } from '../../domain/search/SearchFilter.js';
import { SearchResult, type MatchLocation } from '../../domain/search/SearchResult.js';
import { NaturalLanguageParser } from './NaturalLanguageParser.js';
import { SessionFilterService } from './SessionFilterService.js';

export interface SearchOptions {
  maxResults?: number;
  includeNaturalLanguage?: boolean; // Parse natural language queries
}

export class SearchService {
  /**
   * Search sessions with query and filters
   */
  static search(
    sessions: Session[],
    queryString: string,
    filter: SearchFilter = SearchFilter.createEmpty(),
    options: SearchOptions = {}
  ): SearchResult[] {
    const { maxResults, includeNaturalLanguage = true } = options;

    // Parse natural language if enabled
    let textQuery = queryString;
    let combinedFilter = filter;

    if (includeNaturalLanguage && queryString.trim().length > 0) {
      const { filter: nlFilter, textQuery: cleanQuery } = NaturalLanguageParser.parse(queryString);

      // Merge filters (NL filter takes precedence if both exist)
      combinedFilter = this.mergeFilters(filter, nlFilter);
      textQuery = cleanQuery;
    }

    // Apply filters first to narrow down results
    let filteredSessions = SessionFilterService.filter(sessions, combinedFilter);

    // If text query exists, filter and score by text match
    const query = new SearchQuery(textQuery);
    if (!query.isEmpty()) {
      const results = filteredSessions
        .map(session => this.scoreSession(session, query))
        .filter(result => result.relevanceScore > 0); // Only include matches

      // Sort by relevance
      const sorted = SearchResult.sortByRelevance(results);

      // Limit results if specified
      return maxResults ? sorted.slice(0, maxResults) : sorted;
    }

    // No text query - return all filtered sessions with default score
    const results = filteredSessions.map(session => new SearchResult(session, 50, []));

    // Limit results if specified
    return maxResults ? results.slice(0, maxResults) : results;
  }

  /**
   * Score a session against the search query
   */
  private static scoreSession(session: Session, query: SearchQuery): SearchResult {
    let score = 0;
    const matchLocations: MatchLocation[] = [];

    // Title match (highest weight: 40 points)
    if (query.matches(session.title)) {
      score += 40;
      matchLocations.push({
        field: 'title',
        snippet: this.getSnippet(session.title, query),
        highlightedSnippet: query.highlightIn(session.title)
      });
    }

    // Summary match (high weight: 25 points)
    if (session.summary && query.matches(session.summary)) {
      score += 25;
      matchLocations.push({
        field: 'summary',
        snippet: this.getSnippet(session.summary, query),
        highlightedSnippet: query.highlightIn(this.getSnippet(session.summary, query))
      });
    }

    // Notes match (medium weight: 20 points)
    if (session.notes && query.matches(session.notes)) {
      score += 20;
      matchLocations.push({
        field: 'notes',
        snippet: this.getSnippet(session.notes, query),
        highlightedSnippet: query.highlightIn(this.getSnippet(session.notes, query))
      });
    }

    // Transcription match (medium weight: 20 points)
    if (session.transcription?.fullText && query.matches(session.transcription.fullText)) {
      score += 20;
      matchLocations.push({
        field: 'transcription',
        snippet: this.getSnippet(session.transcription.fullText, query),
        highlightedSnippet: query.highlightIn(this.getSnippet(session.transcription.fullText, query))
      });
    }

    // Course match (low weight: 10 points)
    const courseText = `${session.courseTitle || ''} ${session.courseNumber || ''}`.trim();
    if (courseText && query.matches(courseText)) {
      score += 10;
      matchLocations.push({
        field: 'course',
        snippet: courseText
      });
    }

    // Tags match (low weight: 10 points)
    const matchingTags = session.tags.filter(tag => query.matches(tag));
    if (matchingTags.length > 0) {
      score += 10;
      matchLocations.push({
        field: 'tags',
        snippet: matchingTags.join(', ')
      });
    }

    return new SearchResult(session, score, matchLocations);
  }

  /**
   * Get context snippet around the query match
   */
  private static getSnippet(text: string, query: SearchQuery, maxLength: number = 150): string {
    if (!text || text.length <= maxLength) {
      return text;
    }

    // Find the first occurrence of the query
    const lowerText = text.toLowerCase();
    const matchIndex = lowerText.indexOf(query.normalizedQuery);

    if (matchIndex === -1) {
      // No exact match, return start of text
      return text.substring(0, maxLength) + '...';
    }

    // Calculate snippet boundaries
    const halfLength = Math.floor(maxLength / 2);
    let start = Math.max(0, matchIndex - halfLength);
    let end = Math.min(text.length, start + maxLength);

    // Adjust start if we're near the end
    if (end === text.length) {
      start = Math.max(0, end - maxLength);
    }

    // Try to break at word boundaries
    if (start > 0) {
      const spaceIndex = text.indexOf(' ', start);
      if (spaceIndex !== -1 && spaceIndex < start + 20) {
        start = spaceIndex + 1;
      }
    }

    if (end < text.length) {
      const spaceIndex = text.lastIndexOf(' ', end);
      if (spaceIndex !== -1 && spaceIndex > end - 20) {
        end = spaceIndex;
      }
    }

    let snippet = text.substring(start, end);

    // Add ellipsis
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
  }

  /**
   * Merge two filters (nlFilter takes precedence)
   */
  private static mergeFilters(baseFilter: SearchFilter, nlFilter: SearchFilter): SearchFilter {
    if (nlFilter.isEmpty()) return baseFilter;
    if (baseFilter.isEmpty()) return nlFilter;

    // NL filter takes precedence where defined
    return new SearchFilter({
      courseId: nlFilter.courseId || baseFilter.courseId,
      tags: nlFilter.tags.length > 0 ? nlFilter.tags : baseFilter.tags,
      dateRange: nlFilter.dateRange || baseFilter.dateRange,
      durationRange: nlFilter.durationRange || baseFilter.durationRange,
      hasTranscription: nlFilter.hasTranscription ?? baseFilter.hasTranscription,
      hasNotes: nlFilter.hasNotes ?? baseFilter.hasNotes,
      hasSummary: nlFilter.hasSummary ?? baseFilter.hasSummary,
      isMultiSession: nlFilter.isMultiSession ?? baseFilter.isMultiSession,
      isSynced: nlFilter.isSynced ?? baseFilter.isSynced
    });
  }
}
