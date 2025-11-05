/**
 * AIClient
 * Handles API communication with Claude AI service
 */

import type { ChatMessage } from '../../shared/types.js';

export class AIClient {
  /**
   * Test connection to AI service
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.scribeCat.ai.testConnection();
      return {
        success: result.success && result.data,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Set API key (deprecated - API keys are now configured via environment)
   */
  async setApiKey(apiKey: string): Promise<boolean> {
    console.warn('⚠️ setApiKey is deprecated - API keys are now configured via environment');
    return true;
  }

  /**
   * Get API key from storage (deprecated - API keys are now configured via environment)
   */
  async getApiKey(): Promise<string | null> {
    console.warn('⚠️ getApiKey is deprecated - API keys are now configured via environment');
    return null;
  }

  /**
   * Send chat message with streaming
   */
  async chatStream(
    message: string,
    history: ChatMessage[],
    options: any,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    await window.scribeCat.ai.chatStream(message, history, options, onChunk);
  }

  /**
   * Polish transcription
   */
  async polishTranscription(text: string, options?: any): Promise<any> {
    return await window.scribeCat.ai.polishTranscription(text, options);
  }

  /**
   * Generate summary
   */
  async generateSummary(transcription: string, notes?: string, options?: any): Promise<any> {
    return await window.scribeCat.ai.generateSummary(transcription, notes, options);
  }

  /**
   * Generate title
   */
  async generateTitle(transcription: string, notes?: string, options?: any): Promise<any> {
    return await window.scribeCat.ai.generateTitle(transcription, notes, options);
  }
}
