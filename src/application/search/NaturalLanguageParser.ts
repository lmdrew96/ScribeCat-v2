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

/**
 * Course data for natural language lookup
 */
export interface CourseData {
  id: string;
  code?: string;         // e.g., "CISC 108", "CS-101"
  courseNumber?: string; // Alternative field name from browser extension
  title?: string;        // e.g., "Introduction to Computer Science"
  courseTitle?: string;  // Alternative field name from browser extension
}

export class NaturalLanguageParser {
  /**
   * Parse natural language query into filter + text query
   * @param query - The natural language search query
   * @param courses - Available courses for lookup (optional)
   */
  static parse(query: string, courses: CourseData[] = []): { filter: SearchFilter; textQuery: string } {
    const lowerQuery = query.toLowerCase();

    // Extract filters from natural language
    const courseMatch = this.extractCourse(lowerQuery, courses);
    const dateRange = this.extractDateRange(lowerQuery);
    const durationRange = this.extractDurationRange(lowerQuery);
    const hasTranscription = this.extractHasTranscription(lowerQuery);
    const hasNotes = this.extractHasNotes(lowerQuery);
    const hasSummary = this.extractHasSummary(lowerQuery);

    // Build filter
    const filter = new SearchFilter({
      courseId: courseMatch?.id,
      dateRange,
      durationRange,
      hasTranscription,
      hasNotes,
      hasSummary
    });

    // Remove filter phrases from query to get clean text search
    const textQuery = this.cleanTextQuery(query, courseMatch?.matchedText);

    return { filter, textQuery };
  }

  /**
   * Extract course mentions from query by matching against available courses
   * @returns Course ID and the matched text, or undefined if no match
   */
  private static extractCourse(
    query: string,
    courses: CourseData[]
  ): { id: string; matchedText: string } | undefined {
    if (courses.length === 0) return undefined;

    // Normalize courses for matching
    const normalizedCourses = courses.map(course => ({
      id: course.id,
      code: (course.code || course.courseNumber || '').toLowerCase().replace(/[-\s]/g, ''),
      codeOriginal: course.code || course.courseNumber || '',
      title: (course.title || course.courseTitle || '').toLowerCase()
    }));

    // 1. Try to match course codes (e.g., "CISC 108", "CS-101", "PHYS201")
    // Pattern matches: 2-6 letters followed by optional separator and 3-4 digits
    const codeMatch = query.match(/\b([a-z]{2,6})\s*[-]?\s*(\d{3,4}[a-z]?)\b/i);
    if (codeMatch) {
      const matchedCode = (codeMatch[1] + codeMatch[2]).toLowerCase();
      const course = normalizedCourses.find(c => c.code === matchedCode);
      if (course) {
        return { id: course.id, matchedText: codeMatch[0] };
      }
    }

    // 2. Try to match course titles/subjects
    // Common subject keywords to look for
    const subjectKeywords = [
      'physics', 'chemistry', 'biology', 'math', 'mathematics', 'calculus',
      'computer science', 'programming', 'psychology', 'history', 'english',
      'economics', 'accounting', 'statistics', 'sociology', 'philosophy',
      'art', 'music', 'theatre', 'engineering', 'science'
    ];

    for (const keyword of subjectKeywords) {
      if (query.includes(keyword)) {
        // Find a course whose title contains this keyword
        const course = normalizedCourses.find(c => c.title.includes(keyword));
        if (course) {
          return { id: course.id, matchedText: keyword };
        }
      }
    }

    // 3. Try to match any word against course titles (more lenient)
    // Split query into words and check if any match a course title
    const words = query.split(/\s+/).filter(w => w.length > 3); // Only words > 3 chars
    for (const word of words) {
      const course = normalizedCourses.find(c =>
        c.title.includes(word) &&
        // Avoid matching common words that might be in titles
        !['with', 'from', 'last', 'this', 'that', 'have', 'sessions', 'notes', 'lecture'].includes(word)
      );
      if (course) {
        return { id: course.id, matchedText: word };
      }
    }

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
   * @param query - The original query
   * @param matchedCourseText - The course text that was matched (to be removed)
   */
  private static cleanTextQuery(query: string, matchedCourseText?: string): string {
    let cleaned = query;

    // Remove matched course text
    if (matchedCourseText) {
      // Escape special regex characters in the matched text
      const escaped = matchedCourseText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(escaped, 'gi'), '');
    }

    // Remove course code patterns that may have been entered but didn't match
    // (e.g., user typed "CS 101" but we have "CS-101" - both should be cleaned)
    cleaned = cleaned.replace(/\b[a-z]{2,6}\s*[-]?\s*\d{3,4}[a-z]?\b/gi, '');

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
