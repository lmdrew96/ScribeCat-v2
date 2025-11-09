/**
 * NaturalLanguageParser
 *
 * Parses natural language search queries into structured filters.
 * Examples:
 * - "physics sessions from last week" → course filter + date range
 * - "sessions longer than 30 minutes with notes" → duration + has notes
 * - "all biology lectures with transcription" → course + has transcription
 */

import { SearchFilter, type DateRange, type DurationRange } from '../../domain/search/SearchFilter.js';

export class NaturalLanguageParser {
  /**
   * Parse natural language query into filter + text query
   */
  static parse(query: string): { filter: SearchFilter; textQuery: string } {
    const lowerQuery = query.toLowerCase();

    // Extract filters from natural language
    const courseId = this.extractCourse(lowerQuery);
    const dateRange = this.extractDateRange(lowerQuery);
    const durationRange = this.extractDurationRange(lowerQuery);
    const hasTranscription = this.extractHasTranscription(lowerQuery);
    const hasNotes = this.extractHasNotes(lowerQuery);
    const hasSummary = this.extractHasSummary(lowerQuery);

    // Build filter
    const filter = new SearchFilter({
      courseId,
      dateRange,
      durationRange,
      hasTranscription,
      hasNotes,
      hasSummary
    });

    // Remove filter phrases from query to get clean text search
    const textQuery = this.cleanTextQuery(query);

    return { filter, textQuery };
  }

  /**
   * Extract course mentions
   * TODO: In a real implementation, this would lookup course IDs from a database
   */
  private static extractCourse(query: string): string | undefined {
    // For now, just detect course-like patterns
    // Real implementation would need course database lookup
    return undefined;
  }

  /**
   * Extract date range from natural language
   */
  private static extractDateRange(query: string): DateRange | undefined {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // "from last week" or "last week"
    if (query.includes('last week')) {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      return { start, end: today };
    }

    // "this week"
    if (query.includes('this week')) {
      const start = new Date(today);
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek); // Start of week (Sunday)
      return { start, end: today };
    }

    // "last month"
    if (query.includes('last month')) {
      const start = new Date(today);
      start.setMonth(start.getMonth() - 1);
      return { start, end: today };
    }

    // "this month"
    if (query.includes('this month')) {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start, end: today };
    }

    // "today"
    if (query.includes('today')) {
      return { start: today, end: today };
    }

    // "yesterday"
    if (query.includes('yesterday')) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: yesterday };
    }

    return undefined;
  }

  /**
   * Extract duration range from natural language
   */
  private static extractDurationRange(query: string): DurationRange | undefined {
    // "longer than X minutes"
    const longerThanMatch = query.match(/longer than (\d+)\s*(min|minute|minutes|hour|hours)/i);
    if (longerThanMatch) {
      const value = parseInt(longerThanMatch[1], 10);
      const unit = longerThanMatch[2].toLowerCase();
      const seconds = unit.startsWith('hour') ? value * 3600 : value * 60;
      return { min: seconds };
    }

    // "shorter than X minutes"
    const shorterThanMatch = query.match(/shorter than (\d+)\s*(min|minute|minutes|hour|hours)/i);
    if (shorterThanMatch) {
      const value = parseInt(shorterThanMatch[1], 10);
      const unit = shorterThanMatch[2].toLowerCase();
      const seconds = unit.startsWith('hour') ? value * 3600 : value * 60;
      return { max: seconds };
    }

    // "between X and Y minutes"
    const betweenMatch = query.match(/between (\d+) and (\d+)\s*(min|minute|minutes|hour|hours)/i);
    if (betweenMatch) {
      const min = parseInt(betweenMatch[1], 10);
      const max = parseInt(betweenMatch[2], 10);
      const unit = betweenMatch[3].toLowerCase();
      const minSeconds = unit.startsWith('hour') ? min * 3600 : min * 60;
      const maxSeconds = unit.startsWith('hour') ? max * 3600 : max * 60;
      return { min: minSeconds, max: maxSeconds };
    }

    return undefined;
  }

  /**
   * Detect "with transcription" or "has transcription"
   */
  private static extractHasTranscription(query: string): boolean | undefined {
    if (query.includes('with transcription') || query.includes('has transcription') || query.includes('transcribed')) {
      return true;
    }
    if (query.includes('without transcription') || query.includes('no transcription') || query.includes('not transcribed')) {
      return false;
    }
    return undefined;
  }

  /**
   * Detect "with notes" or "has notes"
   */
  private static extractHasNotes(query: string): boolean | undefined {
    if (query.includes('with notes') || query.includes('has notes')) {
      return true;
    }
    if (query.includes('without notes') || query.includes('no notes')) {
      return false;
    }
    return undefined;
  }

  /**
   * Detect "with summary" or "has summary"
   */
  private static extractHasSummary(query: string): boolean | undefined {
    if (query.includes('with summary') || query.includes('has summary') || query.includes('summarized')) {
      return true;
    }
    return undefined;
  }

  /**
   * Remove filter phrases from query to get clean text search
   */
  private static cleanTextQuery(query: string): string {
    let cleaned = query;

    // Remove date phrases
    cleaned = cleaned.replace(/(from |in |during )?(last|this|next) (week|month|year)/gi, '');
    cleaned = cleaned.replace(/(today|yesterday|tomorrow)/gi, '');

    // Remove duration phrases
    cleaned = cleaned.replace(/longer than \d+\s*(min|minute|minutes|hour|hours)/gi, '');
    cleaned = cleaned.replace(/shorter than \d+\s*(min|minute|minutes|hour|hours)/gi, '');
    cleaned = cleaned.replace(/between \d+ and \d+\s*(min|minute|minutes|hour|hours)/gi, '');

    // Remove has/with phrases
    cleaned = cleaned.replace(/with(out)? (transcription|notes|summary)/gi, '');
    cleaned = cleaned.replace(/has (transcription|notes|summary)/gi, '');
    cleaned = cleaned.replace(/(not )?transcribed/gi, '');
    cleaned = cleaned.replace(/(not )?summarized/gi, '');

    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }
}
