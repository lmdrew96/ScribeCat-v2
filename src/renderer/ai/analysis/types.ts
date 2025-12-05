/**
 * Types for the Important Point Analysis system
 *
 * Detects and tracks important lecture points through repetition
 * and explicit emphasis markers, checking coverage against user notes/bookmarks.
 */

/**
 * How an important point was detected
 */
export type DetectionMethod = 'repetition' | 'emphasis' | 'exam';

/**
 * An important point detected in the transcription
 */
export interface ImportantPoint {
  id: string;
  /** The actual text/phrase that was identified as important */
  text: string;
  /** Normalized version for comparison (lowercase, trimmed) */
  normalizedText: string;
  /** Key terms extracted from the text (non-stop-words) */
  keyTerms: string[];
  /** How it was detected */
  detectionMethod: DetectionMethod;
  /** Timestamp in seconds when first detected */
  firstOccurrence: number;
  /** All timestamps where this was mentioned */
  occurrences: number[];
  /** How many times it was repeated (for repetition type) */
  repetitionCount: number;
  /** Confidence score 0-1 */
  confidence: number;
  /** Whether this point is covered (in notes or bookmarked) */
  isCovered: boolean;
  /** How it was covered (if covered) */
  coverageType?: 'notes' | 'bookmark' | 'both';
  /** When the coverage status was last checked */
  lastCheckedAt: Date;
}

/**
 * N-gram frequency tracking entry
 */
export interface NGramEntry {
  phrase: string;
  normalizedPhrase: string;
  count: number;
  timestamps: number[];
  lastSeen: number;
}

/**
 * Emphasis detection result
 */
export interface EmphasisMatch {
  matchedPhrase: string;
  emphasisType: 'explicit' | 'structural' | 'repetition_marker' | 'exam';
  /** The content that was emphasized */
  emphasizedContent: string;
  timestamp: number;
  confidence: number;
}

/**
 * Bookmark reference for coverage checking
 */
export interface BookmarkRef {
  timestamp: number;
  label?: string;
}

/**
 * Interface for swappable analysis strategy (for future AI upgrade)
 */
export interface IImportantPointDetector {
  /**
   * Analyze text and return detected important points
   */
  analyze(
    transcription: string,
    currentTimestamp: number,
    existingPoints: ImportantPoint[]
  ): ImportantPoint[];

  /**
   * Reset the detector state
   */
  reset(): void;
}

/**
 * Interface for swappable coverage checker (for future AI upgrade)
 */
export interface ICoverageChecker {
  /**
   * Check if important points are covered in notes/bookmarks
   */
  checkCoverage(
    points: ImportantPoint[],
    notes: string,
    bookmarks: BookmarkRef[]
  ): ImportantPoint[];
}

// ============================================================================
// AI Topic Analysis Types
// ============================================================================

/**
 * Importance level of a subtopic
 */
export type SubtopicImportance = 'exam' | 'emphasized' | 'repeated';

/**
 * A subtopic identified by AI analysis
 */
export interface SubtopicEntry {
  /** The subtopic text */
  topic: string;
  /** Related keywords for matching */
  relatedKeywords: string[];
  /** How the importance was detected */
  importance: SubtopicImportance;
  /** AI-generated natural suggestion message */
  suggestedMessage: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Whether this subtopic has been shown as a suggestion */
  hasBeenSuggested: boolean;
}

/**
 * Result of AI topic analysis
 */
export interface TopicAnalysis {
  /** The main/overarching topic of the lecture */
  mainTopic: string;
  /** Keywords that refer to the main topic */
  mainTopicKeywords: string[];
  /** Noteworthy subtopics worth suggesting */
  subtopics: SubtopicEntry[];
  /** Word count when this analysis was performed */
  lastAnalyzedWordCount: number;
  /** Timestamp when analysis was performed */
  analyzedAt: Date;
}

/**
 * Input to the AI topic analyzer
 */
export interface TopicAnalysisInput {
  /** The transcription text (may be truncated) */
  transcription: string;
  /** Detected important points from rule-based analysis */
  importantPoints: ImportantPoint[];
  /** Current word count of full transcription */
  currentWordCount: number;
}
