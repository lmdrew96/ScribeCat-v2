/**
 * LectureContextService
 * Sonnet-powered understanding layer for real-time lecture comprehension.
 * Extracts themes, current topic, definitions, and structure hints.
 * Called every ~2 minutes to update context for Haiku note generation.
 */

import type { AIClient } from './AIClient.js';

/**
 * Structured context representing lecture understanding
 */
export interface LectureContext {
  /** Main themes/topics identified in the lecture */
  themes: string[];
  /** Current topic being discussed */
  currentTopic: string;
  /** Key definitions/terms explained */
  definitions: string[];
  /** Hint about lecture structure (e.g., "giving examples after theory") */
  structureHint: string;
}

/**
 * Configuration for LectureContextService
 */
export interface LectureContextConfig {
  /** Minimum words before triggering update (default: 200) */
  minWordsForUpdate?: number;
  /** Minimum interval between updates in ms (default: 120000 = 2 min) */
  minIntervalMs?: number;
}

const DEFAULT_CONFIG: Required<LectureContextConfig> = {
  minWordsForUpdate: 200,
  minIntervalMs: 120000, // 2 minutes
};

const EMPTY_CONTEXT: LectureContext = {
  themes: [],
  currentTopic: '',
  definitions: [],
  structureHint: '',
};

/**
 * Service for extracting and maintaining lecture context using Sonnet 4.5
 */
export class LectureContextService {
  private context: LectureContext = { ...EMPTY_CONTEXT };
  private lastUpdateTime = 0;
  private wordsSinceLastUpdate = 0;
  private config: Required<LectureContextConfig>;

  constructor(
    private aiClient: AIClient,
    config?: LectureContextConfig
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get current lecture context
   */
  getContext(): LectureContext {
    return { ...this.context };
  }

  /**
   * Check if context update should be triggered
   */
  shouldUpdate(transcriptChunk: string): boolean {
    const wordCount = transcriptChunk.trim().split(/\s+/).filter(w => w.length > 0).length;
    this.wordsSinceLastUpdate += wordCount;

    const timeSinceLastUpdate = Date.now() - this.lastUpdateTime;
    const enoughTime = timeSinceLastUpdate >= this.config.minIntervalMs;
    const enoughWords = this.wordsSinceLastUpdate >= this.config.minWordsForUpdate;

    return enoughTime && enoughWords;
  }

  /**
   * Update context based on recent transcript
   * Uses Sonnet 4.5 for deep understanding
   * @param transcriptBuffer Last ~3 minutes of transcript
   * @returns Updated context or current context if update fails
   */
  async updateContext(transcriptBuffer: string): Promise<LectureContext> {
    try {
      const prompt = this.buildPrompt(transcriptBuffer);
      
      let response = '';
      await this.aiClient.chatStream(
        prompt,
        [],
        { 
          maxTokens: 300,
          temperature: 0.2,
          model: 'claude-sonnet-4-5-20250929'
        },
        (chunk) => { response += chunk; }
      );

      // Debug: log raw response length
      console.log(`📚 LectureContext raw response: ${response.length} chars`);

      const parsed = this.parseResponse(response);
      if (parsed) {
        this.context = parsed;
        this.lastUpdateTime = Date.now();
        this.wordsSinceLastUpdate = 0;
        console.log('📚 LectureContext updated:', this.context.currentTopic);
      } else {
        console.log('📚 LectureContext parsing failed, keeping stale context');
      }

      return this.getContext();
    } catch (error) {
      // Graceful degradation: return stale context on error
      console.warn('⚠️ LectureContextService update failed, using stale context:', error);
      return this.getContext();
    }
  }

  /**
   * Build the prompt for Sonnet context extraction
   */
  private buildPrompt(transcript: string): string {
    const prevContext = JSON.stringify(this.context);
    
    return `Analyze this lecture transcript and extract structured context. Be very concise.

PREVIOUS CONTEXT:
${prevContext}

RECENT TRANSCRIPT:
"${transcript.slice(-1500)}"

Return ONLY valid JSON (no markdown, no explanation):
{"themes":["theme1","theme2"],"currentTopic":"topic being discussed now","definitions":["term: definition"],"structureHint":"brief note about lecture flow"}`;
  }

  /**
   * Parse Sonnet's JSON response
   */
  private parseResponse(response: string): LectureContext | null {
    // Check for empty response first
    if (!response || response.trim().length === 0) {
      console.warn('⚠️ Empty response from LectureContext API');
      return null;
    }

    try {
      // Try to extract JSON from response (handle potential markdown wrapping)
      let jsonStr = response.trim();
      
      // Remove markdown code blocks if present
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      // Find JSON object boundaries
      const startIdx = jsonStr.indexOf('{');
      const endIdx = jsonStr.lastIndexOf('}');
      if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        console.warn('⚠️ No valid JSON object found in response:', response.slice(0, 100));
        return null;
      }
      jsonStr = jsonStr.slice(startIdx, endIdx + 1);

      const parsed = JSON.parse(jsonStr);
      
      // Validate structure
      if (
        Array.isArray(parsed.themes) &&
        typeof parsed.currentTopic === 'string' &&
        Array.isArray(parsed.definitions) &&
        typeof parsed.structureHint === 'string'
      ) {
        return {
          themes: parsed.themes.slice(0, 5), // Limit to 5 themes
          currentTopic: parsed.currentTopic.slice(0, 100), // Limit length
          definitions: parsed.definitions.slice(0, 5), // Limit to 5 definitions
          structureHint: parsed.structureHint.slice(0, 100), // Limit length
        };
      }
      
      console.warn('⚠️ LectureContext response missing required fields');
      return null;
    } catch (error) {
      console.warn('⚠️ Failed to parse LectureContext response:', error);
      return null;
    }
  }

  /**
   * Reset context for new session
   */
  reset(): void {
    this.context = { ...EMPTY_CONTEXT };
    this.lastUpdateTime = 0;
    this.wordsSinceLastUpdate = 0;
    console.log('🔄 LectureContextService reset');
  }
}
