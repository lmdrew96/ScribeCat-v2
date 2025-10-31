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
   * Set API key
   */
  async setApiKey(apiKey: string): Promise<boolean> {
    try {
      await window.scribeCat.store.set('claude-api-key', apiKey);
      const result = await window.scribeCat.ai.setApiKey(apiKey);
      return result.success;
    } catch (error) {
      console.error('Failed to set API key:', error);
      return false;
    }
  }

  /**
   * Get API key from storage
   */
  async getApiKey(): Promise<string | null> {
    try {
      const apiKey = await window.scribeCat.store.get('claude-api-key');
      return (apiKey && typeof apiKey === 'string') ? apiKey : null;
    } catch (error) {
      console.error('Failed to get API key:', error);
      return null;
    }
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
