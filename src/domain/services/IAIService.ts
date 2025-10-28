/**
 * AI Service Interface
 * Defines the contract for AI-powered features using Claude API
 */

/**
 * Represents a message in the AI chat conversation
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * Options for AI chat requests
 */
export interface ChatOptions {
  /** Current transcription text for context */
  transcriptionContext?: string;
  /** Current notes content for context */
  notesContext?: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for response randomness (0-1) */
  temperature?: number;
}

/**
 * Result of a chat request
 */
export interface ChatResponse {
  message: string;
  tokensUsed: number;
}

/**
 * Options for transcription polishing
 */
export interface PolishOptions {
  /** Focus on grammar corrections */
  grammar?: boolean;
  /** Focus on punctuation */
  punctuation?: boolean;
  /** Focus on clarity improvements */
  clarity?: boolean;
  /** Preserve original meaning strictly */
  preserveMeaning?: boolean;
}

/**
 * Result of transcription polishing
 */
export interface PolishResult {
  originalText: string;
  polishedText: string;
  changes: string[];
  tokensUsed: number;
}

/**
 * Options for summary generation
 */
export interface SummaryOptions {
  /** Summary style */
  style?: 'bullet-points' | 'paragraph' | 'key-takeaways' | 'action-items';
  /** Maximum length in words */
  maxLength?: number;
  /** Include timestamps if available */
  includeTimestamps?: boolean;
}

/**
 * Result of summary generation
 */
export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  actionItems?: string[];
  tokensUsed: number;
}

/**
 * Options for title generation
 */
export interface TitleOptions {
  /** Maximum title length in characters */
  maxLength?: number;
  /** Include date in title */
  includeDate?: boolean;
  /** Preferred format */
  format?: 'descriptive' | 'concise' | 'academic';
}

/**
 * Result of title generation
 */
export interface TitleResult {
  title: string;
  alternatives: string[];
  tokensUsed: number;
}

/**
 * AI Service interface for Claude API integration
 */
export interface IAIService {
  /**
   * Send a chat message and get a response
   * @param message User's message
   * @param conversationHistory Previous messages in the conversation
   * @param options Additional options for the chat
   * @returns Promise resolving to the AI's response
   */
  chat(
    message: string,
    conversationHistory: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse>;

  /**
   * Stream a chat response for real-time display
   * @param message User's message
   * @param conversationHistory Previous messages in the conversation
   * @param options Additional options for the chat
   * @param onChunk Callback for each chunk of the response
   * @returns Promise resolving when streaming is complete
   */
  chatStream(
    message: string,
    conversationHistory: ChatMessage[],
    options: ChatOptions,
    onChunk: (chunk: string) => void
  ): Promise<void>;

  /**
   * Polish transcription text to improve quality
   * @param transcriptionText Raw transcription text
   * @param options Polishing options
   * @returns Promise resolving to polished text and changes
   */
  polishTranscription(
    transcriptionText: string,
    options?: PolishOptions
  ): Promise<PolishResult>;

  /**
   * Generate a summary of the session content
   * @param transcriptionText Transcription text
   * @param notesText Optional notes text
   * @param options Summary options
   * @returns Promise resolving to the summary
   */
  generateSummary(
    transcriptionText: string,
    notesText?: string,
    options?: SummaryOptions
  ): Promise<SummaryResult>;

  /**
   * Generate a descriptive title for the session
   * @param transcriptionText Transcription text
   * @param notesText Optional notes text
   * @param options Title generation options
   * @returns Promise resolving to generated title and alternatives
   */
  generateTitle(
    transcriptionText: string,
    notesText?: string,
    options?: TitleOptions
  ): Promise<TitleResult>;

  /**
   * Check if the AI service is properly configured
   * @returns Promise resolving to true if configured
   */
  isConfigured(): Promise<boolean>;

  /**
   * Test the API connection
   * @returns Promise resolving to true if connection is successful
   */
  testConnection(): Promise<boolean>;
}
