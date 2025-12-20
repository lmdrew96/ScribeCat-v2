/**
 * RepetitionTracker
 *
 * Tracks N-gram frequency (2-4 word phrases) to identify
 * frequently repeated concepts. Filters out common filler phrases.
 *
 * Implements IImportantPointDetector for future AI swap capability.
 */

import { ImportantPoint, NGramEntry, IImportantPointDetector, WordTiming } from './types.js';
import { createLogger } from '../../../shared/logger.js';

const logger = createLogger('RepetitionTracker');

export class RepetitionTracker implements IImportantPointDetector {
  private ngramMap: Map<string, NGramEntry> = new Map();
  private processedLength: number = 0;

  /** Minimum times a phrase must be repeated to be considered important */
  private readonly MIN_REPETITION_COUNT = 3;

  /** N-gram sizes to track */
  private readonly NGRAM_SIZES = [2, 3, 4];

  /** Common filler phrases to ignore */
  private readonly FILLER_PHRASES = new Set([
    'you know', 'i mean', 'kind of', 'sort of', 'like a',
    'and then', 'so that', 'and so', 'but then', 'just like',
    'right now', 'i think', 'you see', 'in the', 'of the',
    'to the', 'on the', 'for the', 'at the', 'is the',
    'is a', 'is an', 'are the', 'was the', 'were the',
    'it is', 'it was', 'there is', 'there are', 'this is',
    'that is', 'which is', 'what is', 'going to', 'want to',
    'need to', 'have to', 'got to', 'able to', 'supposed to',
    'a lot', 'lot of', 'lots of', 'more than', 'less than',
    'as well', 'such as', 'due to', 'in order', 'order to',
    'um', 'uh', 'ah', 'oh', 'yeah', 'okay', 'ok', 'so um',
    'you guys', 'all right', 'alright'
  ]);

  /** Stop words to filter from key terms */
  private readonly STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'shall',
    'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
    'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'then', 'once',
    'here', 'there', 'when', 'where', 'why', 'how', 'all',
    'each', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because',
    'until', 'while', 'although', 'though', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'me',
    'him', 'us', 'them', 'who', 'whom', 'which', 'what', 'whose'
  ]);

  analyze(
    transcription: string,
    currentTimestamp: number,
    existingPoints: ImportantPoint[],
    wordTimings?: WordTiming[]
  ): ImportantPoint[] {
    // Find new text since last analysis
    const newText = this.getNewText(transcription);
    if (!newText || newText.trim().length < 10) {
      return existingPoints;
    }

    // Extract n-grams from new text, using character offset for timestamp lookup
    this.extractNGrams(newText, currentTimestamp, this.processedLength, wordTimings);

    // Update processed length
    this.processedLength = transcription.length;

    // Convert frequent n-grams to important points
    return this.generateImportantPoints(existingPoints);
  }

  reset(): void {
    this.ngramMap.clear();
    this.processedLength = 0;
  }

  /**
   * Get text that hasn't been processed yet
   */
  private getNewText(transcription: string): string {
    if (this.processedLength === 0) return transcription;
    if (transcription.length <= this.processedLength) return '';
    return transcription.slice(this.processedLength);
  }

  /**
   * Extract n-grams from text and update frequency map
   * @param text - Text to extract n-grams from
   * @param fallbackTimestamp - Fallback timestamp if word timings unavailable
   * @param textOffset - Character offset of this text within full transcription
   * @param wordTimings - Word-level timing data for accurate timestamps
   */
  private extractNGrams(
    text: string,
    fallbackTimestamp: number,
    textOffset: number,
    wordTimings?: WordTiming[]
  ): void {
    const words = this.tokenize(text);
    
    // Build a map of word positions in the text for character offset lookup
    const wordPositions: number[] = [];
    let pos = 0;
    for (const word of words) {
      const idx = text.indexOf(word, pos);
      wordPositions.push(idx >= 0 ? idx : pos);
      pos = idx >= 0 ? idx + word.length : pos + word.length;
    }

    for (const n of this.NGRAM_SIZES) {
      for (let i = 0; i <= words.length - n; i++) {
        const phraseWords = words.slice(i, i + n);
        const phrase = phraseWords.join(' ');
        const normalized = phrase.toLowerCase();

        // Skip filler phrases
        if (this.FILLER_PHRASES.has(normalized)) continue;

        // Skip phrases that are mostly stop words
        const nonStopWords = phraseWords.filter(
          w => !this.STOP_WORDS.has(w.toLowerCase())
        );
        if (nonStopWords.length < Math.ceil(n / 2)) continue;

        // Skip very short content words
        if (nonStopWords.every(w => w.length <= 2)) continue;

        // Calculate the actual timestamp from word timings if available
        const localCharPosition = wordPositions[i];
        const absolutePosition = textOffset + localCharPosition;
        const timestamp = this.findTimestampForPosition(absolutePosition, wordTimings) ?? fallbackTimestamp;

        // Update or create entry
        const existing = this.ngramMap.get(normalized);
        if (existing) {
          existing.count++;
          existing.timestamps.push(timestamp);
          existing.lastSeen = timestamp;
        } else {
          this.ngramMap.set(normalized, {
            phrase,
            normalizedPhrase: normalized,
            count: 1,
            timestamps: [timestamp],
            lastSeen: timestamp
          });
        }
      }
    }
  }

  /**
   * Find timestamp for a character position using word timings (binary search)
   */
  private findTimestampForPosition(charPosition: number, wordTimings?: WordTiming[]): number | undefined {
    if (!wordTimings || wordTimings.length === 0) return undefined;

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
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s'-]/g, ' ') // Keep apostrophes and hyphens
      .split(/\s+/)
      .filter(w => w.length > 1);
  }

  /**
   * Generate important points from frequent n-grams
   */
  private generateImportantPoints(
    existingPoints: ImportantPoint[]
  ): ImportantPoint[] {
    const points = [...existingPoints];
    const existingTexts = new Set(
      points
        .filter(p => p.detectionMethod === 'repetition')
        .map(p => p.normalizedText)
    );

    for (const [normalized, entry] of this.ngramMap) {
      if (entry.count < this.MIN_REPETITION_COUNT) continue;

      if (existingTexts.has(normalized)) {
        // Update existing point
        const point = points.find(
          p => p.normalizedText === normalized && p.detectionMethod === 'repetition'
        );
        if (point) {
          point.repetitionCount = entry.count;
          point.occurrences = [...entry.timestamps];
          point.confidence = this.calculateConfidence(entry);
        }
        continue;
      }

      // Create new important point
      const keyTerms = this.extractKeyTerms(entry.phrase);

      // Only create if we have meaningful key terms
      if (keyTerms.length === 0) continue;

      points.push({
        id: this.generateId(),
        text: entry.phrase,
        normalizedText: normalized,
        keyTerms,
        detectionMethod: 'repetition',
        firstOccurrence: entry.timestamps[0],
        occurrences: [...entry.timestamps],
        repetitionCount: entry.count,
        confidence: this.calculateConfidence(entry),
        isCovered: false,
        lastCheckedAt: new Date()
      });

      existingTexts.add(normalized);
    }

    return points;
  }

  /**
   * Extract key terms from a phrase (non-stop words)
   */
  private extractKeyTerms(phrase: string): string[] {
    return phrase
      .toLowerCase()
      .split(/\s+/)
      .filter(w => !this.STOP_WORDS.has(w) && w.length > 2);
  }

  /**
   * Calculate confidence based on repetition count and content quality
   */
  private calculateConfidence(entry: NGramEntry): number {
    // Base confidence from repetition count (0.6 - 0.85)
    const repConfidence = Math.min(
      0.85,
      0.6 + (entry.count - this.MIN_REPETITION_COUNT) * 0.05
    );

    // Boost for phrases with more content words
    const words = entry.phrase.split(' ');
    const contentWords = words.filter(
      w => !this.STOP_WORDS.has(w.toLowerCase())
    );
    const contentWordRatio = contentWords.length / words.length;

    return Math.min(0.90, repConfidence * (0.85 + contentWordRatio * 0.15));
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `rep_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
