/**
 * EmphasisDetector
 *
 * Detects explicit emphasis markers in transcription:
 * - Exam-related phrases (highest priority): "on the exam", "exam material", etc.
 * - Explicit phrases: "this is important", "remember this", etc.
 * - Structural markers: "in summary", "to conclude", etc.
 * - Repetition markers: "I repeat", "again", "once more"
 *
 * Implements IImportantPointDetector for future AI swap capability.
 */

import { ImportantPoint, EmphasisMatch, IImportantPointDetector, WordTiming } from './types.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('EmphasisDetector');

interface EmphasisPattern {
  pattern: RegExp;
  type: 'explicit' | 'structural' | 'repetition_marker' | 'exam';
  extractContent: (match: RegExpExecArray, fullText: string) => string;
  baseConfidence: number;
}

export class EmphasisDetector implements IImportantPointDetector {
  private processedLength: number = 0;

  /** Emphasis patterns ordered by priority */
  private readonly EMPHASIS_PATTERNS: EmphasisPattern[] = [
    // ===== EXAM-RELATED (HIGHEST PRIORITY - 0.90 confidence) =====
    {
      pattern: /\b(this (?:will be|is going to be|is) on the (?:exam|test|final|midterm|quiz))\b[:\s,]*(.{10,120}?)(?:[.!?]|$)/gi,
      type: 'exam',
      extractContent: (match) => match[2]?.trim() || '',
      baseConfidence: 0.92
    },
    {
      pattern: /\b((?:on|for) the (?:exam|test|final|midterm|quiz))[:\s,]+(.{10,120}?)(?:[.!?]|$)/gi,
      type: 'exam',
      extractContent: (match) => match[2]?.trim() || '',
      baseConfidence: 0.90
    },
    {
      pattern: /\b(exam (?:material|content|question)|test (?:material|content|question))[:\s,]*(.{10,120}?)(?:[.!?]|$)/gi,
      type: 'exam',
      extractContent: (match) => match[2]?.trim() || '',
      baseConfidence: 0.90
    },
    {
      pattern: /\b((?:will be|going to be|is) tested on|study this for the (?:test|exam))[:\s,]*(.{10,120}?)(?:[.!?]|$)/gi,
      type: 'exam',
      extractContent: (match) => match[2]?.trim() || '',
      baseConfidence: 0.90
    },
    {
      pattern: /\b(know this for the (?:exam|test|final)|make sure you know)[:\s,]*(.{10,120}?)(?:[.!?]|$)/gi,
      type: 'exam',
      extractContent: (match) => match[2]?.trim() || '',
      baseConfidence: 0.90
    },
    {
      pattern: /(.{10,100}?)\b((?:will be|is going to be) on the (?:exam|test|final|midterm))\b/gi,
      type: 'exam',
      extractContent: (match) => match[1]?.trim() || '',
      baseConfidence: 0.90
    },

    // ===== EXPLICIT IMPORTANCE MARKERS (0.85 confidence) =====
    {
      pattern: /\b(this is (?:very |really |extremely )?important)[:\s,]*(.{10,120}?)(?:[.!?]|$)/gi,
      type: 'explicit',
      extractContent: (match) => match[2]?.trim() || '',
      baseConfidence: 0.85
    },
    {
      pattern: /\b(remember this|don't forget|pay attention(?: to this)?|take note(?:s)?)[:\s,]*(.{10,120}?)(?:[.!?]|$)/gi,
      type: 'explicit',
      extractContent: (match) => match[2]?.trim() || '',
      baseConfidence: 0.85
    },
    {
      pattern: /\b((?:the )?key (?:point|concept|idea|thing|takeaway)(?: (?:is|here))?)[:\s,]*(.{10,120}?)(?:[.!?]|$)/gi,
      type: 'explicit',
      extractContent: (match) => match[2]?.trim() || '',
      baseConfidence: 0.85
    },
    {
      pattern: /\b((?:the )?(?:main|important|crucial|essential|critical) (?:point|concept|idea|thing)(?: (?:is|here))?)[:\s,]*(.{10,120}?)(?:[.!?]|$)/gi,
      type: 'explicit',
      extractContent: (match) => match[2]?.trim() || '',
      baseConfidence: 0.85
    },
    {
      pattern: /\b(what you (?:really )?need to (?:understand|know|remember)(?: is)?)[:\s,]*(.{10,120}?)(?:[.!?]|$)/gi,
      type: 'explicit',
      extractContent: (match) => match[2]?.trim() || '',
      baseConfidence: 0.85
    },
    {
      pattern: /\b(make sure you (?:understand|know|remember))[:\s,]*(.{10,120}?)(?:[.!?]|$)/gi,
      type: 'explicit',
      extractContent: (match) => match[2]?.trim() || '',
      baseConfidence: 0.85
    },

    // ===== STRUCTURAL MARKERS (0.75 confidence) =====
    {
      pattern: /\b(in summary|to summarize|to sum up|in conclusion|the bottom line is)[:\s,]*(.{10,150}?)(?:[.!?]|$)/gi,
      type: 'structural',
      extractContent: (match) => match[2]?.trim() || '',
      baseConfidence: 0.75
    },
    {
      pattern: /\b(the (?:main|most important) takeaway(?:s)?(?: (?:is|are))?)[:\s,]*(.{10,150}?)(?:[.!?]|$)/gi,
      type: 'structural',
      extractContent: (match) => match[2]?.trim() || '',
      baseConfidence: 0.78
    },
    {
      pattern: /\b(there are (?:three|3|four|4|five|5) (?:main |key )?(?:points|things|concepts))[:\s,]*(.{10,200}?)(?:[.!?]|$)/gi,
      type: 'structural',
      extractContent: (match) => match[2]?.trim() || '',
      baseConfidence: 0.75
    },

    // ===== REPETITION MARKERS (0.80 confidence) =====
    {
      pattern: /(.{10,100}?)\b(i repeat|let me repeat(?: that)?|again|once more|i'll say (?:it|that) again)\b/gi,
      type: 'repetition_marker',
      extractContent: (match) => match[1]?.trim() || '',
      baseConfidence: 0.80
    },
    {
      pattern: /\b(let me emphasize|i want to emphasize|i cannot stress enough)[:\s,]*(.{10,120}?)(?:[.!?]|$)/gi,
      type: 'repetition_marker',
      extractContent: (match) => match[2]?.trim() || '',
      baseConfidence: 0.82
    }
  ];

  /** Stop words for key term extraction */
  private readonly STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'this', 'that', 'it',
    'and', 'but', 'or', 'so', 'if', 'then', 'than', 'very', 'just'
  ]);

  analyze(
    transcription: string,
    currentTimestamp: number,
    existingPoints: ImportantPoint[],
    wordTimings?: WordTiming[]
  ): ImportantPoint[] {
    // Only analyze new text
    const textToAnalyze = transcription.slice(this.processedLength);
    if (!textToAnalyze || textToAnalyze.trim().length < 20) {
      return existingPoints;
    }

    // Pass the offset so we can calculate absolute character positions
    const matches = this.detectEmphasis(textToAnalyze, currentTimestamp, this.processedLength, wordTimings);
    this.processedLength = transcription.length;

    // Convert matches to important points
    const points = [...existingPoints];
    const existingTexts = new Set(
      points
        .filter(p => p.detectionMethod === 'emphasis' || p.detectionMethod === 'exam')
        .map(p => p.normalizedText)
    );

    for (const match of matches) {
      if (!match.emphasizedContent || match.emphasizedContent.length < 10) continue;

      const normalized = match.emphasizedContent.toLowerCase().trim();

      // Skip if we already have this content (but boost confidence if re-emphasized)
      if (existingTexts.has(normalized)) {
        const existing = points.find(p => p.normalizedText === normalized);
        if (existing) {
          existing.confidence = Math.min(0.95, existing.confidence + 0.05);
          existing.occurrences.push(match.timestamp);
        }
        continue;
      }

      // Check for significant overlap with existing points
      const hasOverlap = this.hasSignificantOverlap(normalized, existingTexts);
      if (hasOverlap) continue;

      const detectionMethod = match.emphasisType === 'exam' ? 'exam' : 'emphasis';

      points.push({
        id: this.generateId(),
        text: match.emphasizedContent,
        normalizedText: normalized,
        keyTerms: this.extractKeyTerms(match.emphasizedContent),
        detectionMethod,
        firstOccurrence: match.timestamp,
        occurrences: [match.timestamp],
        repetitionCount: 1,
        confidence: match.confidence,
        isCovered: false,
        lastCheckedAt: new Date()
      });

      existingTexts.add(normalized);
    }

    return points;
  }

  reset(): void {
    this.processedLength = 0;
  }

  /**
   * Detect emphasis patterns in text
   * @param text - Text to analyze (may be a slice of full transcription)
   * @param fallbackTimestamp - Fallback timestamp if word timings not available
   * @param textOffset - Character offset of this text within the full transcription
   * @param wordTimings - Word-level timing data for accurate timestamps
   */
  private detectEmphasis(
    text: string,
    fallbackTimestamp: number,
    textOffset: number,
    wordTimings?: WordTiming[]
  ): EmphasisMatch[] {
    const matches: EmphasisMatch[] = [];

    for (const { pattern, type, extractContent, baseConfidence } of this.EMPHASIS_PATTERNS) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const emphasizedContent = extractContent(match, text);

        if (emphasizedContent && emphasizedContent.length >= 10) {
          // Clean up the content
          const cleanContent = this.cleanContent(emphasizedContent);
          if (cleanContent.length >= 10) {
            // Calculate the actual timestamp from word timings if available
            // The match.index is relative to text, add textOffset for absolute position
            const absolutePosition = textOffset + match.index;
            const timestamp = this.findTimestampForPosition(absolutePosition, wordTimings) ?? fallbackTimestamp;
            
            matches.push({
              matchedPhrase: match[1] || match[0],
              emphasisType: type,
              emphasizedContent: cleanContent,
              timestamp,
              confidence: this.calculateConfidence(baseConfidence, cleanContent)
            });
          }
        }
      }
    }

    // Sort by confidence (highest first) and deduplicate
    return this.deduplicateMatches(
      matches.sort((a, b) => b.confidence - a.confidence)
    );
  }

  /**
   * Find timestamp for a character position using word timings (binary search)
   */
  private findTimestampForPosition(charPosition: number, wordTimings?: WordTiming[]): number | undefined {
    if (!wordTimings || wordTimings.length === 0) return undefined;

    // Binary search for the word containing or closest to this position
    let left = 0;
    let right = wordTimings.length - 1;
    let bestMatch: WordTiming | undefined;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const word = wordTimings[mid];

      if (charPosition >= word.charStart && charPosition <= word.charEnd) {
        return word.start;
      } else if (charPosition < word.charStart) {
        right = mid - 1;
      } else {
        bestMatch = word;
        left = mid + 1;
      }
    }

    return bestMatch?.start;
  }

  /**
   * Clean extracted content
   */
  private cleanContent(content: string): string {
    return content
      .replace(/^[,:\s]+/, '') // Remove leading punctuation
      .replace(/[,:\s]+$/, '') // Remove trailing punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Deduplicate matches that have significant overlap
   */
  private deduplicateMatches(matches: EmphasisMatch[]): EmphasisMatch[] {
    const unique: EmphasisMatch[] = [];
    const seenContent = new Set<string>();

    for (const match of matches) {
      const normalized = match.emphasizedContent.toLowerCase();
      if (seenContent.has(normalized)) continue;

      // Check for significant overlap with already-added matches
      let hasOverlap = false;
      for (const existing of unique) {
        const existingNorm = existing.emphasizedContent.toLowerCase();
        if (this.contentOverlaps(normalized, existingNorm)) {
          hasOverlap = true;
          break;
        }
      }

      if (!hasOverlap) {
        unique.push(match);
        seenContent.add(normalized);
      }
    }

    return unique;
  }

  /**
   * Check if two content strings have significant word overlap
   */
  private contentOverlaps(a: string, b: string): boolean {
    const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 3));
    const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 3));

    if (wordsA.size === 0 || wordsB.size === 0) return false;

    const intersection = [...wordsA].filter(w => wordsB.has(w));
    const overlapRatio = intersection.length / Math.min(wordsA.size, wordsB.size);

    return overlapRatio >= 0.6;
  }

  /**
   * Check if normalized text overlaps significantly with existing texts
   */
  private hasSignificantOverlap(normalized: string, existingTexts: Set<string>): boolean {
    const words = new Set(normalized.split(/\s+/).filter(w => w.length > 3));
    if (words.size === 0) return false;

    for (const existing of existingTexts) {
      const existingWords = new Set(existing.split(/\s+/).filter(w => w.length > 3));
      if (existingWords.size === 0) continue;

      const intersection = [...words].filter(w => existingWords.has(w));
      const overlapRatio = intersection.length / Math.min(words.size, existingWords.size);

      if (overlapRatio >= 0.6) return true;
    }

    return false;
  }

  /**
   * Extract key terms from content
   */
  private extractKeyTerms(content: string): string[] {
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => !this.STOP_WORDS.has(w) && w.length > 2);
  }

  /**
   * Calculate confidence based on type and content quality
   */
  private calculateConfidence(baseConfidence: number, content: string): number {
    // Longer content = more context = slightly higher confidence
    const lengthBonus = Math.min(0.05, content.length / 1000);

    // More key terms = more specific = higher confidence
    const keyTerms = this.extractKeyTerms(content);
    const termBonus = Math.min(0.03, keyTerms.length * 0.005);

    return Math.min(0.95, baseConfidence + lengthBonus + termBonus);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `emp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
