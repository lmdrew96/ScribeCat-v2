/**
 * ImportantPointAnalyzer
 *
 * Main coordinator for important point detection during recording.
 * Combines RepetitionTracker and EmphasisDetector results, checks coverage.
 *
 * Designed for future AI upgrade via interface abstraction - custom detectors
 * can be injected via constructor options.
 */

import { RepetitionTracker } from './RepetitionTracker.js';
import { EmphasisDetector } from './EmphasisDetector.js';
import { CoverageChecker } from './CoverageChecker.js';
import {
  ImportantPoint,
  BookmarkRef,
  WordTiming,
  IImportantPointDetector,
  ICoverageChecker
} from './types.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('ImportantPointAnalyzer');

export interface ImportantPointAnalyzerOptions {
  /** Custom repetition detector (for future AI upgrade) */
  repetitionDetector?: IImportantPointDetector;
  /** Custom emphasis detector (for future AI upgrade) */
  emphasisDetector?: IImportantPointDetector;
  /** Custom coverage checker (for future AI upgrade) */
  coverageChecker?: ICoverageChecker;
}

export class ImportantPointAnalyzer {
  private repetitionTracker: IImportantPointDetector;
  private emphasisDetector: IImportantPointDetector;
  private coverageChecker: ICoverageChecker;

  private importantPoints: ImportantPoint[] = [];
  private lastAnalysisTime: number = 0;

  constructor(options: ImportantPointAnalyzerOptions = {}) {
    // Allow injection of custom detectors for future AI upgrade
    this.repetitionTracker = options.repetitionDetector || new RepetitionTracker();
    this.emphasisDetector = options.emphasisDetector || new EmphasisDetector();
    this.coverageChecker = options.coverageChecker || new CoverageChecker();
  }

  /**
   * Analyze transcription for important points
   */
  analyze(
    transcription: string,
    notes: string,
    bookmarks: BookmarkRef[],
    currentTimestamp: number,
    wordTimings?: WordTiming[]
  ): ImportantPoint[] {
    // Run repetition tracker with word timings for accurate timestamps
    let points = this.repetitionTracker.analyze(
      transcription,
      currentTimestamp,
      this.importantPoints,
      wordTimings
    );

    // Run emphasis detector with word timings for accurate timestamps
    points = this.emphasisDetector.analyze(
      transcription,
      currentTimestamp,
      points,
      wordTimings
    );

    // Deduplicate overlapping points from different detectors
    points = this.deduplicatePoints(points);

    // Check coverage against notes and bookmarks
    points = this.coverageChecker.checkCoverage(points, notes, bookmarks);

    // Sort by confidence (highest first), then by detection method priority
    points.sort((a, b) => {
      // Exam-related points first
      if (a.detectionMethod === 'exam' && b.detectionMethod !== 'exam') return -1;
      if (b.detectionMethod === 'exam' && a.detectionMethod !== 'exam') return 1;

      // Then by confidence
      return b.confidence - a.confidence;
    });

    this.importantPoints = points;
    this.lastAnalysisTime = currentTimestamp;

    logger.debug(
      `Analysis complete: ${points.length} important points ` +
      `(${this.getMissedPoints().length} missed, ${this.getCoveredPoints().length} covered)`
    );

    return points;
  }

  /**
   * Get important points that are NOT covered (missed)
   */
  getMissedPoints(): ImportantPoint[] {
    return this.importantPoints.filter(p => !p.isCovered);
  }

  /**
   * Get important points that ARE covered
   */
  getCoveredPoints(): ImportantPoint[] {
    return this.importantPoints.filter(p => p.isCovered);
  }

  /**
   * Get all important points
   */
  getAllPoints(): ImportantPoint[] {
    return [...this.importantPoints];
  }

  /**
   * Get high-confidence missed points for immediate alerts
   * @param minConfidence Minimum confidence threshold (default 0.75)
   */
  getHighPriorityMissedPoints(minConfidence: number = 0.75): ImportantPoint[] {
    return this.getMissedPoints()
      .filter(p => p.confidence >= minConfidence)
      .sort((a, b) => {
        // Exam-related first
        if (a.detectionMethod === 'exam' && b.detectionMethod !== 'exam') return -1;
        if (b.detectionMethod === 'exam' && a.detectionMethod !== 'exam') return 1;
        // Then by confidence
        return b.confidence - a.confidence;
      });
  }

  /**
   * Get points by detection method
   */
  getPointsByMethod(method: 'repetition' | 'emphasis' | 'exam'): ImportantPoint[] {
    return this.importantPoints.filter(p => p.detectionMethod === method);
  }

  /**
   * Reset analyzer state (e.g., for new recording)
   */
  reset(): void {
    this.importantPoints = [];
    this.lastAnalysisTime = 0;
    this.repetitionTracker.reset();
    this.emphasisDetector.reset();
    logger.debug('ImportantPointAnalyzer reset');
  }

  /**
   * Manually mark a point as covered (e.g., when user acts on suggestion)
   */
  markAsCovered(pointId: string, coverageType: 'notes' | 'bookmark'): void {
    const point = this.importantPoints.find(p => p.id === pointId);
    if (point) {
      const previousType = point.coverageType;
      point.isCovered = true;
      point.coverageType = previousType
        ? 'both'
        : coverageType;
      point.lastCheckedAt = new Date();

      logger.debug(
        `Marked point "${point.text.slice(0, 30)}..." as covered (${point.coverageType})`
      );
    }
  }

  /**
   * Get statistics about detected points
   */
  getStats(): {
    total: number;
    covered: number;
    missed: number;
    byMethod: Record<string, number>;
    highPriority: number;
  } {
    const byMethod: Record<string, number> = {
      repetition: 0,
      emphasis: 0,
      exam: 0
    };

    for (const point of this.importantPoints) {
      byMethod[point.detectionMethod]++;
    }

    return {
      total: this.importantPoints.length,
      covered: this.getCoveredPoints().length,
      missed: this.getMissedPoints().length,
      byMethod,
      highPriority: this.getHighPriorityMissedPoints().length
    };
  }

  /**
   * Deduplicate overlapping points from different detectors
   * Points with 70%+ key term overlap are considered the same concept
   */
  private deduplicatePoints(points: ImportantPoint[]): ImportantPoint[] {
    const uniquePoints: ImportantPoint[] = [];
    const processedIds = new Set<string>();

    // Sort by confidence to keep higher confidence versions
    const sorted = [...points].sort((a, b) => {
      // Exam method gets priority
      if (a.detectionMethod === 'exam' && b.detectionMethod !== 'exam') return -1;
      if (b.detectionMethod === 'exam' && a.detectionMethod !== 'exam') return 1;
      // Then by confidence
      return b.confidence - a.confidence;
    });

    for (const point of sorted) {
      if (processedIds.has(point.id)) continue;

      // Check for significant overlap with existing points
      let merged = false;

      for (const existing of uniquePoints) {
        if (this.hasSignificantOverlap(point, existing)) {
          // Merge: update the existing point with best attributes
          this.mergePoints(existing, point);
          merged = true;
          break;
        }
      }

      if (!merged) {
        uniquePoints.push({ ...point });
      }

      processedIds.add(point.id);
    }

    return uniquePoints;
  }

  /**
   * Check if two points have significant key term overlap
   */
  private hasSignificantOverlap(a: ImportantPoint, b: ImportantPoint): boolean {
    // Exact text match
    if (a.normalizedText === b.normalizedText) return true;

    // Check key term overlap
    const aTerms = new Set(a.keyTerms);
    const bTerms = new Set(b.keyTerms);

    if (aTerms.size === 0 || bTerms.size === 0) return false;

    const intersection = [...aTerms].filter(t => bTerms.has(t));
    const overlapRatio = intersection.length / Math.min(aTerms.size, bTerms.size);

    return overlapRatio >= 0.7; // 70% key term overlap = same concept
  }

  /**
   * Merge attributes from source point into target point
   */
  private mergePoints(target: ImportantPoint, source: ImportantPoint): void {
    // Keep higher confidence
    if (source.confidence > target.confidence) {
      target.confidence = source.confidence;
    }

    // Prefer exam detection method
    if (source.detectionMethod === 'exam' && target.detectionMethod !== 'exam') {
      target.detectionMethod = 'exam';
      target.text = source.text;
      target.normalizedText = source.normalizedText;
    }

    // Combine occurrences
    const allOccurrences = [...new Set([...target.occurrences, ...source.occurrences])];
    target.occurrences = allOccurrences.sort((a, b) => a - b);

    // Update repetition count
    target.repetitionCount = Math.max(target.repetitionCount, source.repetitionCount);

    // Merge key terms
    const mergedTerms = [...new Set([...target.keyTerms, ...source.keyTerms])];
    target.keyTerms = mergedTerms;
  }
}
