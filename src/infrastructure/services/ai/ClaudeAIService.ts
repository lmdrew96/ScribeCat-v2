/**
 * Claude AI Service Implementation
 * Implements IAIService using Anthropic's Claude API
 * Runs in main process for security (API key never exposed to renderer)
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  IAIService,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  PolishOptions,
  PolishResult,
  SummaryOptions,
  SummaryResult,
  TitleOptions,
  TitleResult,
} from '../../../domain/services/IAIService.js';

/**
 * Configuration for Claude AI Service
 */
export interface ClaudeConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
}

/**
 * Claude AI Service implementation
 */
export class ClaudeAIService implements IAIService {
  private client: Anthropic | null = null;
  private config: ClaudeConfig;
  private readonly defaultModel = 'claude-sonnet-4-5-20250929';
  private readonly maxTokens = 4096;

  constructor(config: ClaudeConfig) {
    this.config = {
      model: this.defaultModel,
      maxRetries: 3,
      ...config,
    };

    if (this.config.apiKey) {
      this.initializeClient();
    }
  }

  /**
   * Initialize the Anthropic client
   */
  private initializeClient(): void {
    this.client = new Anthropic({
      apiKey: this.config.apiKey,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * Update the API key and reinitialize client
   */
  public updateApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.initializeClient();
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(options?: ChatOptions): string {
    let systemPrompt = 'You are a helpful AI assistant integrated into ScribeCat, a note-taking and transcription app. ';
    systemPrompt += 'You help users understand their recordings and notes better. ';
    systemPrompt += 'Be concise, clear, and helpful. ';

    if (options?.transcriptionContext || options?.notesContext) {
      systemPrompt += '\n\nContext from current session:\n';
      
      if (options.transcriptionContext) {
        systemPrompt += `\nTranscription:\n${options.transcriptionContext}\n`;
      }
      
      if (options.notesContext) {
        systemPrompt += `\nNotes:\n${options.notesContext}\n`;
      }
    }

    return systemPrompt;
  }

  /**
   * Convert chat history to Anthropic message format
   */
  private convertChatHistory(history: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
    return history.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Send a chat message and get a response
   */
  async chat(
    message: string,
    conversationHistory: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    if (!this.client) {
      throw new Error('AI service not configured. Please set an API key.');
    }

    try {
      const messages = [
        ...this.convertChatHistory(conversationHistory),
        { role: 'user' as const, content: message },
      ];

      const response = await this.client.messages.create({
        model: options?.model || this.config.model || this.defaultModel,
        max_tokens: options?.maxTokens || this.maxTokens,
        temperature: options?.temperature || 0.7,
        system: this.buildSystemPrompt(options),
        messages,
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      return {
        message: content.text,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AI chat failed: ${error.message}`);
      }
      throw new Error('AI chat failed with unknown error');
    }
  }

  /**
   * Stream a chat response for real-time display
   */
  async chatStream(
    message: string,
    conversationHistory: ChatMessage[],
    options: ChatOptions,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    if (!this.client) {
      throw new Error('AI service not configured. Please set an API key.');
    }

    try {
      const messages = [
        ...this.convertChatHistory(conversationHistory),
        { role: 'user' as const, content: message },
      ];

      const stream = await this.client.messages.create({
        model: options?.model || this.config.model || this.defaultModel,
        max_tokens: options?.maxTokens || this.maxTokens,
        temperature: options?.temperature || 0.7,
        system: this.buildSystemPrompt(options),
        messages,
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          onChunk(event.delta.text);
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AI chat stream failed: ${error.message}`);
      }
      throw new Error('AI chat stream failed with unknown error');
    }
  }

  /**
   * Polish transcription text to improve quality
   */
  async polishTranscription(
    transcriptionText: string,
    options?: PolishOptions
  ): Promise<PolishResult> {
    if (!this.client) {
      throw new Error('AI service not configured. Please set an API key.');
    }

    const focusAreas: string[] = [];
    if (options?.grammar !== false) focusAreas.push('grammar');
    if (options?.punctuation !== false) focusAreas.push('punctuation');
    if (options?.clarity) focusAreas.push('clarity and readability');

    const prompt = `Please polish the following transcription text. Focus on ${focusAreas.join(', ')}.
${options?.preserveMeaning !== false ? 'Preserve the original meaning exactly.' : ''}

Original transcription:
${transcriptionText}

Provide:
1. The polished version
2. A brief list of key changes made

Format your response as:
POLISHED:
[polished text here]

CHANGES:
- [change 1]
- [change 2]
...`;

    try {
      const response = await this.client.messages.create({
        model: this.config.model || this.defaultModel,
        max_tokens: this.maxTokens,
        temperature: 0.3, // Lower temperature for more consistent polishing
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      const responseText = content.text;
      const polishedMatch = responseText.match(/POLISHED:\s*([\s\S]*?)(?=CHANGES:|$)/);
      const changesMatch = responseText.match(/CHANGES:\s*([\s\S]*?)$/);

      const polishedText = polishedMatch ? polishedMatch[1].trim() : transcriptionText;
      const changesText = changesMatch ? changesMatch[1].trim() : '';
      const changes = changesText
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim());

      return {
        originalText: transcriptionText,
        polishedText,
        changes,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Transcription polishing failed: ${error.message}`);
      }
      throw new Error('Transcription polishing failed with unknown error');
    }
  }

  /**
   * Generate a summary of the session content
   */
  async generateSummary(
    transcriptionText: string,
    notesText?: string,
    options?: SummaryOptions
  ): Promise<SummaryResult> {
    if (!this.client) {
      throw new Error('AI service not configured. Please set an API key.');
    }

    const style = options?.style || 'bullet-points';
    const maxLength = options?.maxLength || 300;

    let prompt = `Please create a ${style} summary of the following content. Keep it under ${maxLength} words.\n\n`;
    
    prompt += `Transcription:\n${transcriptionText}\n\n`;
    
    if (notesText) {
      prompt += `Notes:\n${notesText}\n\n`;
    }

    prompt += `Provide:
1. A ${style} summary
2. Key points (3-5 bullet points)
${style === 'action-items' ? '3. Action items if any are mentioned' : ''}

Format your response as:
SUMMARY:
[summary here]

KEY POINTS:
- [point 1]
- [point 2]
...

${style === 'action-items' ? 'ACTION ITEMS:\n- [item 1]\n- [item 2]\n...' : ''}`;

    try {
      const response = await this.client.messages.create({
        model: this.config.model || this.defaultModel,
        max_tokens: this.maxTokens,
        temperature: 0.5,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      const responseText = content.text;
      const summaryMatch = responseText.match(/SUMMARY:\s*([\s\S]*?)(?=KEY POINTS:|$)/);
      const keyPointsMatch = responseText.match(/KEY POINTS:\s*([\s\S]*?)(?=ACTION ITEMS:|$)/);
      const actionItemsMatch = responseText.match(/ACTION ITEMS:\s*([\s\S]*?)$/);

      const summary = summaryMatch ? summaryMatch[1].trim() : '';
      const keyPointsText = keyPointsMatch ? keyPointsMatch[1].trim() : '';
      const keyPoints = keyPointsText
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim());

      let actionItems: string[] | undefined;
      if (actionItemsMatch) {
        const actionItemsText = actionItemsMatch[1].trim();
        actionItems = actionItemsText
          .split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.replace(/^-\s*/, '').trim());
      }

      return {
        summary,
        keyPoints,
        actionItems,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Summary generation failed: ${error.message}`);
      }
      throw new Error('Summary generation failed with unknown error');
    }
  }

  /**
   * Generate a descriptive title for the session
   */
  async generateTitle(
    transcriptionText: string,
    notesText?: string,
    options?: TitleOptions
  ): Promise<TitleResult> {
    if (!this.client) {
      throw new Error('AI service not configured. Please set an API key.');
    }

    const maxLength = options?.maxLength || 60;
    const format = options?.format || 'descriptive';

    let prompt = `Based on the following content, generate a ${format} title for this recording session. `;
    prompt += `Keep it under ${maxLength} characters.\n\n`;
    
    prompt += `Transcription:\n${transcriptionText.substring(0, 1000)}...\n\n`;
    
    if (notesText) {
      prompt += `Notes:\n${notesText.substring(0, 500)}...\n\n`;
    }

    prompt += `Provide:
1. A main title
2. 2-3 alternative titles

Format your response as:
TITLE:
[main title]

ALTERNATIVES:
- [alternative 1]
- [alternative 2]
- [alternative 3]`;

    try {
      const response = await this.client.messages.create({
        model: this.config.model || this.defaultModel,
        max_tokens: 500,
        temperature: 0.7,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      const responseText = content.text;
      const titleMatch = responseText.match(/TITLE:\s*(.*?)(?=\n|$)/);
      const alternativesMatch = responseText.match(/ALTERNATIVES:\s*([\s\S]*?)$/);

      const title = titleMatch ? titleMatch[1].trim() : 'Untitled Session';
      const alternativesText = alternativesMatch ? alternativesMatch[1].trim() : '';
      const alternatives = alternativesText
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(alt => alt.length > 0);

      return {
        title,
        alternatives,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Title generation failed: ${error.message}`);
      }
      throw new Error('Title generation failed with unknown error');
    }
  }

  /**
   * Check if the AI service is properly configured
   */
  async isConfigured(): Promise<boolean> {
    return this.client !== null && this.config.apiKey.length > 0;
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.client) {
      console.error('AI connection test failed: Client not initialized');
      return false;
    }

    try {
      console.log('Testing connection with model:', this.config.model || this.defaultModel);
      const response = await this.client.messages.create({
        model: this.config.model || this.defaultModel,
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Hello' }],
      });

      console.log('Connection test successful');
      return response.content.length > 0;
    } catch (error) {
      console.error('AI connection test failed:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      return false;
    }
  }
}
