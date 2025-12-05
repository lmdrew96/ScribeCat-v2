/**
 * ContentAnalyzer
 *
 * Analyzes session content in real-time to provide insights for proactive AI suggestions.
 * Tracks topics, patterns, confusion indicators, content density, and important points.
 *
 * Important point detection includes:
 * - Repetition tracking (concepts mentioned 3+ times)
 * - Emphasis detection ("this is important", "remember this", etc.)
 * - Exam-related phrases ("on the exam", "exam material", etc.)
 */

import { createLogger } from '../../shared/logger.js';
import { ImportantPointAnalyzer } from './analysis/ImportantPointAnalyzer.js';
import { AITopicAnalyzer } from './analysis/AITopicAnalyzer.js';
import { ImportantPoint, BookmarkRef } from './analysis/types.js';

const logger = createLogger('ContentAnalyzer');

export interface ContentInsights {
  // Topic tracking
  topics: Map<string, number>; // topic -> mention count
  dominantTopics: string[]; // Most frequently mentioned topics

  // Pattern detection
  hasQuestions: boolean;
  questionCount: number;
  confusionIndicators: number; // "wait", "what", "confused", "don't understand"

  // Content characteristics
  wordCount: number;
  sentenceCount: number;
  contentDensity: 'low' | 'medium' | 'high'; // Words per minute

  // Time tracking
  durationMinutes: number;
  lastUpdated: Date;

  // Quality indicators
  hasNotes: boolean;
  notesWordCount: number;
  transcriptionQuality: 'poor' | 'good' | 'excellent';
}

export type ContextMode = 'recording' | 'study';

export interface SuggestionTrigger {
  type: 'topic_density' | 'confusion' | 'duration' | 'content_quality' | 'note_gap' | 'topic_emphasis' | 'important_moment' | 'milestone';
  confidence: number; // 0-1
  reason: string;
  suggestedAction: 'flashcards' | 'quiz' | 'summary' | 'eli5' | 'break' | 'notes' | 'bookmark' | 'highlight' | 'note_prompt' | 'encouragement';
  context?: any;
  mode?: ContextMode; // Which mode this suggestion is for
}

export class ContentAnalyzer {
  private transcriptionText: string = '';
  private notesText: string = '';
  private startTime: Date | null = null;
  private lastAnalysis: ContentInsights | null = null;

  // Important point analysis
  private importantPointAnalyzer: ImportantPointAnalyzer;
  private aiTopicAnalyzer: AITopicAnalyzer;
  private bookmarks: BookmarkRef[] = [];

  // AI analysis state
  private pendingAIAnalysis: boolean = false;

  // Configuration
  private readonly TOPIC_KEYWORDS = new Set([
    // Science
    'mitochondria', 'cell', 'dna', 'rna', 'protein', 'enzyme', 'photosynthesis',
    'evolution', 'species', 'ecosystem', 'molecule', 'atom', 'electron', 'neutron',
    // Math
    'equation', 'derivative', 'integral', 'matrix', 'vector', 'function', 'polynomial',
    'theorem', 'proof', 'geometry', 'algebra', 'calculus', 'trigonometry',
    // History
    'war', 'revolution', 'treaty', 'empire', 'constitution', 'democracy', 'republic',
    // Literature
    'theme', 'metaphor', 'symbolism', 'protagonist', 'narrator', 'plot', 'character',
    // Computer Science
    'algorithm', 'data structure', 'complexity', 'recursion', 'loop', 'variable',
    'function', 'class', 'object', 'database', 'network', 'protocol'
  ]);

  private readonly CONFUSION_PHRASES = [
    'wait', 'what', 'confused', "don't understand", 'not sure', 'unclear',
    'could you explain', 'what does that mean', 'i dont get it', 'lost',
    'can you repeat', 'what was that', 'huh'
  ];

  constructor() {
    this.importantPointAnalyzer = new ImportantPointAnalyzer();
    this.aiTopicAnalyzer = new AITopicAnalyzer();
  }

  /**
   * Start tracking a new session
   */
  public startSession(): void {
    this.startTime = new Date();
    this.transcriptionText = '';
    this.notesText = '';
    this.lastAnalysis = null;
    this.bookmarks = [];
    this.importantPointAnalyzer.reset();
  }

  /**
   * Update content and reanalyze
   */
  public updateContent(transcription: string, notes: string): ContentInsights {
    // Defensive: Ensure we have valid strings
    this.transcriptionText = typeof transcription === 'string' ? transcription : '';
    this.notesText = typeof notes === 'string' ? notes : '';

    const insights = this.analyze();
    this.lastAnalysis = insights;

    // Run important point analysis
    const currentTimestamp = this.getDurationMinutes() * 60; // Convert to seconds
    this.importantPointAnalyzer.analyze(
      this.transcriptionText,
      this.notesText,
      this.bookmarks,
      currentTimestamp
    );

    // Trigger AI topic analysis asynchronously (non-blocking)
    this.triggerAIAnalysisIfNeeded(insights.wordCount);

    return insights;
  }

  /**
   * Trigger AI topic analysis if conditions are met (async, non-blocking)
   */
  private triggerAIAnalysisIfNeeded(wordCount: number): void {
    // Don't trigger if already pending
    if (this.pendingAIAnalysis) return;

    // Check if we should analyze
    if (!this.aiTopicAnalyzer.shouldTriggerAnalysis(wordCount)) return;

    // Mark as pending and trigger analysis
    this.pendingAIAnalysis = true;

    const importantPoints = this.importantPointAnalyzer.getAllPoints();

    // Run asynchronously without blocking
    this.aiTopicAnalyzer.analyzeWithAI({
      transcription: this.transcriptionText,
      importantPoints,
      currentWordCount: wordCount
    }).then(() => {
      this.pendingAIAnalysis = false;
      logger.debug('AI topic analysis completed');
    }).catch(error => {
      this.pendingAIAnalysis = false;
      logger.warn('AI topic analysis failed', { error });
    });
  }

  /**
   * Update bookmarks for coverage checking
   */
  public updateBookmarks(bookmarks: BookmarkRef[]): void {
    this.bookmarks = bookmarks;
  }

  /**
   * Get all important points detected
   */
  public getImportantPoints(): ImportantPoint[] {
    return this.importantPointAnalyzer.getAllPoints();
  }

  /**
   * Get important points that are NOT covered (missed)
   */
  public getMissedImportantPoints(): ImportantPoint[] {
    return this.importantPointAnalyzer.getMissedPoints();
  }

  /**
   * Get high-priority missed points for immediate alerts
   */
  public getHighPriorityMissedPoints(minConfidence: number = 0.75): ImportantPoint[] {
    return this.importantPointAnalyzer.getHighPriorityMissedPoints(minConfidence);
  }

  /**
   * Mark an important point as covered
   */
  public markPointCovered(pointId: string, coverageType: 'notes' | 'bookmark'): void {
    this.importantPointAnalyzer.markAsCovered(pointId, coverageType);
  }

  /**
   * Get statistics about important points
   */
  public getImportantPointStats() {
    return this.importantPointAnalyzer.getStats();
  }

  /**
   * Perform comprehensive content analysis
   */
  private analyze(): ContentInsights {
    // Defensive: Ensure we have valid strings before calling toLowerCase()
    const transcriptionLower = (typeof this.transcriptionText === 'string' ? this.transcriptionText : '').toLowerCase();
    const notesLower = (typeof this.notesText === 'string' ? this.notesText : '').toLowerCase();

    // Topic extraction
    const topics = this.extractTopics(transcriptionLower);
    const dominantTopics = this.getDominantTopics(topics, 3);

    // Pattern detection
    const hasQuestions = this.containsQuestions(transcriptionLower);
    const questionCount = this.countQuestions(transcriptionLower);
    const confusionIndicators = this.countConfusionIndicators(transcriptionLower);

    // Content metrics
    const wordCount = this.countWords(this.transcriptionText);
    const sentenceCount = this.countSentences(this.transcriptionText);
    const durationMinutes = this.getDurationMinutes();
    const contentDensity = this.calculateContentDensity(wordCount, durationMinutes);

    // Notes metrics
    const hasNotes = this.notesText.trim().length > 0;
    const notesWordCount = this.countWords(this.notesText);

    // Quality assessment
    const transcriptionQuality = this.assessTranscriptionQuality(wordCount, durationMinutes);

    return {
      topics,
      dominantTopics,
      hasQuestions,
      questionCount,
      confusionIndicators,
      wordCount,
      sentenceCount,
      contentDensity,
      durationMinutes,
      lastUpdated: new Date(),
      hasNotes,
      notesWordCount,
      transcriptionQuality
    };
  }

  /**
   * Generate suggestion triggers based on current insights
   */
  public getSuggestionTriggers(mode: ContextMode = 'study'): SuggestionTrigger[] {
    if (!this.lastAnalysis) return [];

    const triggers: SuggestionTrigger[] = [];
    const insights = this.lastAnalysis;

    // ===== RECORDING MODE: Passive, non-intrusive suggestions =====
    if (mode === 'recording') {
      // Trigger 1: Confusion detected (prompt to add notes)
      if (insights.confusionIndicators >= 2) {
        triggers.push({
          type: 'confusion',
          confidence: Math.min(0.9, insights.confusionIndicators / 4),
          reason: `Detected unclear points in the lecture`,
          suggestedAction: 'note_prompt',
          mode: 'recording',
          context: { confusionCount: insights.confusionIndicators }
        });
      }

      // Trigger 2: Note gap (gentle reminder to take notes)
      // Lowered threshold from 500 to 250 words to trigger more frequently
      if (insights.wordCount > 250 && insights.notesWordCount < insights.wordCount * 0.1) {
        triggers.push({
          type: 'note_gap',
          confidence: 0.65,
          reason: 'Remember to jot down key points',
          suggestedAction: 'note_prompt',
          mode: 'recording',
          context: {
            transcriptionWords: insights.wordCount,
            notesWords: insights.notesWordCount
          }
        });
      }

      // Trigger 3: 5-minute milestone (encouragement)
      if (insights.durationMinutes >= 5 && insights.durationMinutes < 6) {
        triggers.push({
          type: 'milestone',
          confidence: 0.8,
          reason: "You've been recording for 5 minutes - great start!",
          suggestedAction: 'encouragement',
          mode: 'recording',
          context: { duration: insights.durationMinutes }
        });
      }

      // Trigger 4: 10-minute milestone (progress check)
      if (insights.durationMinutes >= 10 && insights.durationMinutes < 11) {
        triggers.push({
          type: 'milestone',
          confidence: 0.8,
          reason: '10 minutes of content captured - keep up the good work!',
          suggestedAction: 'encouragement',
          mode: 'recording',
          context: { duration: insights.durationMinutes }
        });
      }

      // ===== IMPORTANT POINT TRIGGERS =====
      // Check if AI topic analysis is available for intelligent suggestions
      if (this.aiTopicAnalyzer.hasAnalysis()) {
        // Use AI-generated subtopic suggestions (more natural and contextual)
        const aiSuggestions = this.aiTopicAnalyzer.getSubtopicSuggestions();
        for (const suggestion of aiSuggestions) {
          triggers.push(suggestion);
          // Mark as suggested so it won't be shown again
          if (suggestion.context?.topic) {
            this.aiTopicAnalyzer.markSubtopicSuggested(suggestion.context.topic);
          }
        }

        // Also include any high-priority points that aren't the main topic
        const missedPoints = this.importantPointAnalyzer.getHighPriorityMissedPoints(0.75);
        const filteredPoints = this.aiTopicAnalyzer.filterAgainstMainTopic(missedPoints);

        // Only add rule-based triggers if AI didn't generate enough
        if (aiSuggestions.length < 2) {
          for (const point of filteredPoints.slice(0, 2 - aiSuggestions.length)) {
            triggers.push(this.createPointTrigger(point));
          }
        }
      } else {
        // Fallback: Use rule-based detection when AI is not available
        const missedPoints = this.importantPointAnalyzer.getHighPriorityMissedPoints(0.75);

        // Limit to top 2 most important missed points at a time
        for (const point of missedPoints.slice(0, 2)) {
          triggers.push(this.createPointTrigger(point));
        }
      }
    }

    // ===== STUDY MODE: Active AI tools for reviewing content =====
    if (mode === 'study') {
      // Trigger 1: High topic density (great for flashcards)
      if (insights.dominantTopics.length >= 3 && insights.wordCount > 500) {
        triggers.push({
          type: 'topic_density',
          confidence: Math.min(0.9, insights.dominantTopics.length / 5),
          reason: `I noticed you've covered ${insights.dominantTopics.length} main topics: ${insights.dominantTopics.slice(0, 3).join(', ')}`,
          suggestedAction: 'flashcards',
          mode: 'study',
          context: { topics: insights.dominantTopics }
        });
      }

      // Trigger 2: Confusion detected (offer ELI5)
      if (insights.confusionIndicators >= 2) {
        triggers.push({
          type: 'confusion',
          confidence: Math.min(0.95, insights.confusionIndicators / 5),
          reason: `I detected some confusion in the transcription`,
          suggestedAction: 'eli5',
          mode: 'study',
          context: { confusionCount: insights.confusionIndicators }
        });
      }

      // Trigger 3: Long session (suggest break or summary)
      if (insights.durationMinutes > 45) {
        triggers.push({
          type: 'duration',
          confidence: 0.8,
          reason: `You've been studying for ${Math.round(insights.durationMinutes)} minutes`,
          suggestedAction: insights.wordCount > 1000 ? 'summary' : 'break',
          mode: 'study',
          context: { durationMinutes: insights.durationMinutes }
        });
      }

      // Trigger 4: Good content for quiz (questions + substantial content)
      if (insights.hasQuestions && insights.questionCount >= 3 && insights.wordCount > 800) {
        triggers.push({
          type: 'content_quality',
          confidence: 0.85,
          reason: `Your session has ${insights.questionCount} questions discussed`,
          suggestedAction: 'quiz',
          mode: 'study',
          context: { questionCount: insights.questionCount }
        });
      }

      // Trigger 5: Summary opportunity (substantial content)
      if (insights.wordCount > 1000 && insights.dominantTopics.length >= 2) {
        triggers.push({
          type: 'content_quality',
          confidence: 0.8,
          reason: 'You have substantial content to review',
          suggestedAction: 'summary',
          mode: 'study',
          context: { wordCount: insights.wordCount }
        });
      }

      // Trigger 6: Note gap (suggest extracting key concepts)
      if (insights.wordCount > 500 && insights.notesWordCount < insights.wordCount * 0.1) {
        triggers.push({
          type: 'note_gap',
          confidence: 0.7,
          reason: 'You have a lot of transcription but few notes',
          suggestedAction: 'notes',
          mode: 'study',
          context: {
            transcriptionWords: insights.wordCount,
            notesWords: insights.notesWordCount
          }
        });
      }
    }

    // Log what triggers were generated (or not)
    if (triggers.length > 0) {
      logger.debug(`Generated ${triggers.length} suggestion trigger(s) for ${mode} mode:`,
        triggers.map(t => ({ type: t.type, confidence: t.confidence, reason: t.reason }))
      );
    } else {
      logger.debug(`No suggestion triggers generated for ${mode} mode`);
    }

    // Sort by confidence (highest first)
    return triggers.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Extract topics from text
   */
  private extractTopics(text: string): Map<string, number> {
    const topics = new Map<string, number>();

    for (const keyword of this.TOPIC_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        topics.set(keyword, matches.length);
      }
    }

    return topics;
  }

  /**
   * Get top N most mentioned topics
   */
  private getDominantTopics(topics: Map<string, number>, n: number): string[] {
    return Array.from(topics.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([topic]) => topic);
  }

  /**
   * Check if text contains questions
   */
  private containsQuestions(text: string): boolean {
    return text.includes('?') || /\b(what|why|how|when|where|who)\b/i.test(text);
  }

  /**
   * Count questions in text
   */
  private countQuestions(text: string): number {
    const questionMarks = (text.match(/\?/g) || []).length;
    const questionWords = (text.match(/\b(what|why|how|when|where|who)\b/gi) || []).length;
    return Math.max(questionMarks, Math.floor(questionWords / 2));
  }

  /**
   * Count confusion indicators
   */
  private countConfusionIndicators(text: string): number {
    let count = 0;
    for (const phrase of this.CONFUSION_PHRASES) {
      const regex = new RegExp(phrase, 'gi');
      const matches = text.match(regex);
      if (matches) {
        count += matches.length;
      }
    }
    return count;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  /**
   * Count sentences in text
   */
  private countSentences(text: string): number {
    return (text.match(/[.!?]+/g) || []).length;
  }

  /**
   * Get session duration in minutes
   */
  private getDurationMinutes(): number {
    if (!this.startTime) return 0;
    const now = new Date();
    const diffMs = now.getTime() - this.startTime.getTime();
    return diffMs / (1000 * 60);
  }

  /**
   * Calculate content density (words per minute)
   */
  private calculateContentDensity(wordCount: number, durationMinutes: number): 'low' | 'medium' | 'high' {
    if (durationMinutes === 0) return 'low';

    const wordsPerMinute = wordCount / durationMinutes;

    if (wordsPerMinute < 50) return 'low';
    if (wordsPerMinute < 100) return 'medium';
    return 'high';
  }

  /**
   * Assess transcription quality
   */
  private assessTranscriptionQuality(wordCount: number, durationMinutes: number): 'poor' | 'good' | 'excellent' {
    if (durationMinutes === 0) return 'poor';

    const wordsPerMinute = wordCount / durationMinutes;

    if (wordsPerMinute < 30) return 'poor';
    if (wordsPerMinute < 80) return 'good';
    return 'excellent';
  }

  /**
   * Get last analysis results
   */
  public getLastAnalysis(): ContentInsights | null {
    return this.lastAnalysis;
  }

  /**
   * Reset analyzer
   */
  public reset(): void {
    this.transcriptionText = '';
    this.notesText = '';
    this.startTime = null;
    this.lastAnalysis = null;
    this.bookmarks = [];
    this.pendingAIAnalysis = false;
    this.importantPointAnalyzer.reset();
    this.aiTopicAnalyzer.reset();
  }

  /**
   * Create a suggestion trigger from an important point
   */
  private createPointTrigger(point: ImportantPoint): SuggestionTrigger {
    if (point.detectionMethod === 'exam') {
      // Exam-related content - highest priority
      return {
        type: 'important_moment',
        confidence: point.confidence,
        reason: `Exam material: "${this.truncateText(point.text, 60)}"`,
        suggestedAction: 'bookmark',
        mode: 'recording',
        context: {
          importantPointId: point.id,
          text: point.text,
          detectionMethod: point.detectionMethod,
          timestamp: point.firstOccurrence
        }
      };
    } else if (point.detectionMethod === 'emphasis') {
      // Explicitly emphasized content
      return {
        type: 'important_moment',
        confidence: point.confidence,
        reason: `The speaker emphasized: "${this.truncateText(point.text, 55)}"`,
        suggestedAction: 'bookmark',
        mode: 'recording',
        context: {
          importantPointId: point.id,
          text: point.text,
          detectionMethod: point.detectionMethod,
          timestamp: point.firstOccurrence
        }
      };
    } else {
      // Frequently repeated content
      return {
        type: 'topic_emphasis',
        confidence: point.confidence,
        reason: `Frequently mentioned (${point.repetitionCount}x): "${this.truncateText(point.text, 50)}"`,
        suggestedAction: 'note_prompt',
        mode: 'recording',
        context: {
          importantPointId: point.id,
          text: point.text,
          repetitionCount: point.repetitionCount,
          detectionMethod: point.detectionMethod
        }
      };
    }
  }

  /**
   * Truncate text for display in suggestions
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }
}
