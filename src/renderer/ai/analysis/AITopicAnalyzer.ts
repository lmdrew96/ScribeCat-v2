/**
 * AITopicAnalyzer
 *
 * Uses Claude AI to intelligently distinguish between main lecture topics
 * and noteworthy subtopics, generating natural and contextual suggestions.
 *
 * Key features:
 * - Identifies the main/overarching topic of a lecture
 * - Filters out suggestions about the main topic
 * - Generates natural, conversational suggestion messages
 * - Rate-limited to avoid excessive API calls
 */

import { createLogger } from '../../../shared/logger.js';
import type {
  ImportantPoint,
  TopicAnalysis,
  SubtopicEntry,
  TopicAnalysisInput
} from './types.js';
import type { SuggestionTrigger } from '../ContentAnalyzer.js';

const logger = createLogger('AITopicAnalyzer');

// Rate limiting configuration
const MIN_WORDS_BETWEEN_ANALYSIS = 500;
const MIN_TIME_BETWEEN_ANALYSIS_MS = 2 * 60 * 1000; // 2 minutes
const MAX_TRANSCRIPTION_LENGTH = 3000; // Characters to send to AI

export class AITopicAnalyzer {
  private lastAnalysis: TopicAnalysis | null = null;
  private lastAnalysisTime: number = 0;
  private isAnalyzing: boolean = false;
  private analysisQueue: TopicAnalysisInput | null = null;

  /**
   * Check if we should trigger a new AI analysis
   */
  public shouldTriggerAnalysis(currentWordCount: number): boolean {
    // Don't analyze if already in progress
    if (this.isAnalyzing) {
      return false;
    }

    // First analysis - always trigger if we have enough content
    if (!this.lastAnalysis) {
      return currentWordCount >= MIN_WORDS_BETWEEN_ANALYSIS;
    }

    // Check if enough new words have been added
    const wordsSinceLastAnalysis = currentWordCount - this.lastAnalysis.lastAnalyzedWordCount;
    if (wordsSinceLastAnalysis < MIN_WORDS_BETWEEN_ANALYSIS) {
      return false;
    }

    // Check if enough time has passed
    const timeSinceLastAnalysis = Date.now() - this.lastAnalysisTime;
    if (timeSinceLastAnalysis < MIN_TIME_BETWEEN_ANALYSIS_MS) {
      return false;
    }

    return true;
  }

  /**
   * Analyze transcription and important points using Claude AI
   */
  public async analyzeWithAI(input: TopicAnalysisInput): Promise<TopicAnalysis | null> {
    if (this.isAnalyzing) {
      // Queue this request for later
      this.analysisQueue = input;
      return this.lastAnalysis;
    }

    this.isAnalyzing = true;

    try {
      logger.info('Starting AI topic analysis', {
        wordCount: input.currentWordCount,
        pointsCount: input.importantPoints.length
      });

      const analysis = await this.callClaudeForAnalysis(input);

      if (analysis) {
        this.lastAnalysis = analysis;
        this.lastAnalysisTime = Date.now();
        logger.info('AI topic analysis complete', {
          mainTopic: analysis.mainTopic,
          subtopicsCount: analysis.subtopics.length
        });
      }

      return analysis;
    } catch (error) {
      logger.error('AI topic analysis failed', { error });
      return null;
    } finally {
      this.isAnalyzing = false;

      // Process queued request if any
      if (this.analysisQueue) {
        const queued = this.analysisQueue;
        this.analysisQueue = null;
        // Use setTimeout to avoid deep recursion
        setTimeout(() => this.analyzeWithAI(queued), 100);
      }
    }
  }

  /**
   * Call Claude AI to analyze the transcription
   */
  private async callClaudeForAnalysis(input: TopicAnalysisInput): Promise<TopicAnalysis | null> {
    const prompt = this.buildAnalysisPrompt(input);

    try {
      const result = await window.scribeCat.ai.chat(prompt, [], {
        systemPrompt: this.getSystemPrompt(),
        temperature: 0.3,
        maxTokens: 1000
      });

      if (!result.success || !result.data) {
        logger.warn('AI chat returned unsuccessful result', { error: result.error });
        return null;
      }

      // result.data is a ChatResponse object with { message: string, tokensUsed: number }
      const responseMessage = typeof result.data === 'string' ? result.data : result.data.message;
      if (!responseMessage) {
        logger.warn('AI chat returned empty message');
        return null;
      }

      return this.parseAnalysisResponse(responseMessage, input.currentWordCount);
    } catch (error) {
      logger.error('Failed to call Claude for topic analysis', { error });
      return null;
    }
  }

  /**
   * Get the system prompt for topic analysis
   */
  private getSystemPrompt(): string {
    return `You are an intelligent lecture analysis assistant helping students take effective notes. Your job is to:

1. Identify the MAIN TOPIC (the overarching subject the entire lecture is about)
2. Identify SUBTOPICS that are specific, noteworthy points worth highlighting to the student
3. Generate friendly, natural suggestion messages for each subtopic

Key principles:
- The main topic should NOT be suggested to the student (they already know what the lecture is about)
- Subtopics should be specific concepts, people, events, or terms that deserve special attention
- Suggestion messages should be conversational, encouraging, and mention the context

You MUST respond with valid JSON only. No additional text.`;
  }

  /**
   * Build the analysis prompt with transcription and detected points
   */
  private buildAnalysisPrompt(input: TopicAnalysisInput): string {
    // Truncate transcription to last N characters for efficiency
    const recentTranscription = input.transcription.length > MAX_TRANSCRIPTION_LENGTH
      ? '...' + input.transcription.slice(-MAX_TRANSCRIPTION_LENGTH)
      : input.transcription;

    // Format important points for the prompt
    const pointsSummary = input.importantPoints
      .slice(0, 10) // Limit to top 10 points
      .map(p => {
        const countInfo = p.detectionMethod === 'repetition'
          ? ` (mentioned ${p.repetitionCount}x)`
          : '';
        const examInfo = p.detectionMethod === 'exam' ? ' [EXAM MATERIAL]' : '';
        const emphasisInfo = p.detectionMethod === 'emphasis' ? ' [EMPHASIZED]' : '';
        return `- "${p.text}"${countInfo}${examInfo}${emphasisInfo}`;
      })
      .join('\n');

    return `Analyze this lecture transcription and detected phrases.

TRANSCRIPTION (recent excerpt):
"""
${recentTranscription}
"""

DETECTED REPEATED/EMPHASIZED PHRASES:
${pointsSummary || '(none detected yet)'}

Respond with JSON in this exact format:
{
  "mainTopic": "The overall subject (e.g., 'World War II', 'Cell Biology', 'Shakespeare')",
  "mainTopicKeywords": ["keyword1", "keyword2", "keyword3"],
  "subtopics": [
    {
      "topic": "Specific subtopic name",
      "importance": "exam|emphasized|repeated",
      "suggestedMessage": "A friendly, natural message like: 'It looks like the role of Kamikaze pilots has been mentioned a lot! Be sure to get some notes!'"
    }
  ]
}

Guidelines for suggestedMessage:
- For exam material: "It seems like [topic] is important for the exam! Be sure to pay attention and take notes!"
- For emphasized content: "The speaker is emphasizing [topic]! This seems really important - make sure you capture the key points!"
- For repeated content: "It looks like [topic] has been mentioned a lot! Be sure to get some notes!"
- Always be encouraging and specific
- Reference the main topic when relevant (e.g., "[topic]'s role in [mainTopic]")`;
  }

  /**
   * Parse the AI response into a TopicAnalysis object
   */
  private parseAnalysisResponse(response: string, wordCount: number): TopicAnalysis | null {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('No JSON found in AI response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.mainTopic || !Array.isArray(parsed.subtopics)) {
        logger.warn('Invalid AI response structure', { parsed });
        return null;
      }

      // Transform subtopics to our format
      const subtopics: SubtopicEntry[] = parsed.subtopics.map((s: any) => ({
        topic: s.topic || '',
        relatedKeywords: s.relatedKeywords || [],
        importance: this.normalizeImportance(s.importance),
        suggestedMessage: s.suggestedMessage || '',
        confidence: this.calculateSubtopicConfidence(s.importance),
        hasBeenSuggested: false
      }));

      return {
        mainTopic: parsed.mainTopic,
        mainTopicKeywords: parsed.mainTopicKeywords || [],
        subtopics: subtopics.filter(s => s.topic && s.suggestedMessage),
        lastAnalyzedWordCount: wordCount,
        analyzedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to parse AI response', { error, response: response.slice(0, 200) });
      return null;
    }
  }

  /**
   * Normalize importance value
   */
  private normalizeImportance(importance: string): 'exam' | 'emphasized' | 'repeated' {
    const normalized = importance?.toLowerCase();
    if (normalized === 'exam') return 'exam';
    if (normalized === 'emphasized') return 'emphasized';
    return 'repeated';
  }

  /**
   * Calculate confidence based on importance
   */
  private calculateSubtopicConfidence(importance: string): number {
    switch (importance?.toLowerCase()) {
      case 'exam': return 0.92;
      case 'emphasized': return 0.85;
      default: return 0.75;
    }
  }

  /**
   * Check if a text matches the main topic
   */
  public isMainTopic(text: string): boolean {
    if (!this.lastAnalysis) return false;

    const normalizedText = text.toLowerCase().trim();
    const mainTopic = this.lastAnalysis.mainTopic.toLowerCase();

    // Direct match
    if (normalizedText === mainTopic || mainTopic.includes(normalizedText)) {
      return true;
    }

    // Check against main topic keywords
    for (const keyword of this.lastAnalysis.mainTopicKeywords) {
      if (normalizedText === keyword.toLowerCase() ||
          normalizedText.includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes(normalizedText)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Filter important points to remove those that match the main topic
   */
  public filterAgainstMainTopic(points: ImportantPoint[]): ImportantPoint[] {
    if (!this.lastAnalysis) return points;

    return points.filter(point => !this.isMainTopic(point.text));
  }

  /**
   * Get unshown subtopics as suggestion triggers
   */
  public getSubtopicSuggestions(): SuggestionTrigger[] {
    if (!this.lastAnalysis) return [];

    return this.lastAnalysis.subtopics
      .filter(s => !s.hasBeenSuggested)
      .slice(0, 2) // Limit to 2 suggestions at a time
      .map(subtopic => this.subtopicToTrigger(subtopic));
  }

  /**
   * Convert a subtopic to a suggestion trigger
   */
  private subtopicToTrigger(subtopic: SubtopicEntry): SuggestionTrigger {
    return {
      type: subtopic.importance === 'exam' ? 'important_moment' : 'topic_emphasis',
      confidence: subtopic.confidence,
      reason: subtopic.suggestedMessage,
      suggestedAction: subtopic.importance === 'exam' ? 'bookmark' : 'note_prompt',
      mode: 'recording',
      context: {
        topic: subtopic.topic,
        importance: subtopic.importance,
        isAIGenerated: true
      }
    };
  }

  /**
   * Mark a subtopic as suggested (so it won't be shown again)
   */
  public markSubtopicSuggested(topic: string): void {
    if (!this.lastAnalysis) return;

    const subtopic = this.lastAnalysis.subtopics.find(
      s => s.topic.toLowerCase() === topic.toLowerCase()
    );
    if (subtopic) {
      subtopic.hasBeenSuggested = true;
    }
  }

  /**
   * Get the current analysis result
   */
  public getLastAnalysis(): TopicAnalysis | null {
    return this.lastAnalysis;
  }

  /**
   * Check if AI analysis is available
   */
  public hasAnalysis(): boolean {
    return this.lastAnalysis !== null;
  }

  /**
   * Reset the analyzer state
   */
  public reset(): void {
    this.lastAnalysis = null;
    this.lastAnalysisTime = 0;
    this.isAnalyzing = false;
    this.analysisQueue = null;
  }
}
