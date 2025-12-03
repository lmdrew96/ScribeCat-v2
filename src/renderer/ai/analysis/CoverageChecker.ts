/**
 * CoverageChecker
 *
 * Compares important points against user's notes and bookmarks
 * to determine if they've been captured.
 *
 * Coverage criteria (either/both):
 * - Notes: 50%+ of key terms appear in user's notes
 * - Bookmark: Any bookmark within 30 seconds of the important point's timestamp
 *
 * Implements ICoverageChecker for future AI swap capability.
 */

import { ImportantPoint, BookmarkRef, ICoverageChecker } from './types.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('CoverageChecker');

export class CoverageChecker implements ICoverageChecker {
  /** How close a bookmark must be to a point's timestamp (in seconds) */
  private readonly BOOKMARK_PROXIMITY_THRESHOLD = 30;

  /** Minimum percentage of key terms that must appear in notes */
  private readonly KEY_TERM_MATCH_THRESHOLD = 0.5;

  checkCoverage(
    points: ImportantPoint[],
    notes: string,
    bookmarks: BookmarkRef[]
  ): ImportantPoint[] {
    // Prepare notes for matching
    const normalizedNotes = notes.toLowerCase();
    const noteWords = this.extractNoteWords(normalizedNotes);

    return points.map(point => {
      const inNotes = this.checkNoteCoverage(point, normalizedNotes, noteWords);
      const inBookmarks = this.checkBookmarkCoverage(point, bookmarks);

      let coverageType: 'notes' | 'bookmark' | 'both' | undefined;
      if (inNotes && inBookmarks) {
        coverageType = 'both';
      } else if (inNotes) {
        coverageType = 'notes';
      } else if (inBookmarks) {
        coverageType = 'bookmark';
      }

      return {
        ...point,
        isCovered: inNotes || inBookmarks,
        coverageType,
        lastCheckedAt: new Date()
      };
    });
  }

  /**
   * Extract words from notes for matching
   */
  private extractNoteWords(normalizedNotes: string): Set<string> {
    return new Set(
      normalizedNotes
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2)
    );
  }

  /**
   * Check if important point's key terms appear in notes
   */
  private checkNoteCoverage(
    point: ImportantPoint,
    normalizedNotes: string,
    noteWords: Set<string>
  ): boolean {
    if (!point.keyTerms.length) return false;

    // Check how many key terms appear in notes
    const matchedTerms = point.keyTerms.filter(term => {
      // Exact word match
      if (noteWords.has(term)) return true;

      // Substring match for compound words or when term is part of larger word
      if (normalizedNotes.includes(term)) return true;

      // Stemming approximation: check if a similar word exists
      // This handles cases like "mitochondria" vs "mitochondrial"
      const termRoot = term.slice(0, Math.max(4, term.length - 3));
      if (termRoot.length >= 4) {
        for (const word of noteWords) {
          if (word.startsWith(termRoot) && word.length >= termRoot.length) {
            return true;
          }
        }
      }

      return false;
    });

    const matchRatio = matchedTerms.length / point.keyTerms.length;

    // Log for debugging
    if (matchedTerms.length > 0) {
      logger.debug(
        `Coverage check for "${point.text.slice(0, 30)}...": ` +
        `${matchedTerms.length}/${point.keyTerms.length} terms matched ` +
        `(${(matchRatio * 100).toFixed(0)}%)`
      );
    }

    return matchRatio >= this.KEY_TERM_MATCH_THRESHOLD;
  }

  /**
   * Check if a bookmark exists near the point's timestamp
   */
  private checkBookmarkCoverage(
    point: ImportantPoint,
    bookmarks: BookmarkRef[]
  ): boolean {
    if (bookmarks.length === 0) return false;

    // Check against all occurrences of this point
    for (const occurrence of point.occurrences) {
      for (const bookmark of bookmarks) {
        const timeDiff = Math.abs(bookmark.timestamp - occurrence);
        if (timeDiff <= this.BOOKMARK_PROXIMITY_THRESHOLD) {
          logger.debug(
            `Bookmark coverage found for "${point.text.slice(0, 30)}...": ` +
            `bookmark at ${bookmark.timestamp}s within ${timeDiff}s of occurrence at ${occurrence}s`
          );
          return true;
        }
      }
    }

    return false;
  }
}
