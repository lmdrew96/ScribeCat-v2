// Core application types
// Note: SessionData is exported from domain/entities/Session.ts
// Import it from there to maintain single source of truth
export type { SessionData } from '../domain/entities/Session.js';

/**
 * Standard IPC response wrapper for consistent error handling
 */
export interface IPCResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * IPC response for recording operations
 */
export interface RecordingStopResponse {
  sessionId: string;
  filePath: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  assignments: Assignment[];
}

export interface Assignment {
  id: string;
  title: string;
  dueDate: Date;
  description: string;
  points: number;
}

export interface Theme {
  id: string;
  name: string;
  category: 'academic' | 'professional' | 'creative' | 'accessibility';
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    accent: string;
  };
  typography: {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
  };
  spacing: {
    unit: number;
    padding: number;
    margin: number;
  };
}

export interface StudyAid {
  id: string;
  type: 'flashcard' | 'practice_question' | 'summary' | 'outline';
  content: string;
  answer?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  startTime?: Date;
}

export interface RecordingStatus {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  startTime?: Date;
  error?: string;
}

export interface AudioConfig {
  sampleRate: number;
  channelCount: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  format: string;
  codec: string;
}

/**
 * AI-related types
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatOptions {
  transcriptionContext?: string;
  notesContext?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  message: string;
  tokensUsed: number;
}

export interface PolishResult {
  originalText: string;
  polishedText: string;
  changes: string[];
  tokensUsed: number;
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  actionItems?: string[];
  tokensUsed: number;
}

export interface TitleResult {
  title: string;
  alternatives: string[];
  tokensUsed: number;
}

export interface ElectronAPI {
  recording: {
    start: () => Promise<{ success: boolean; error?: string }>;
    stop: (audioData: ArrayBuffer, duration: number) => Promise<{ success: boolean; sessionId?: string; filePath?: string; error?: string }>;
    pause: () => Promise<{ success: boolean; error?: string }>;
    resume: () => Promise<{ success: boolean; error?: string }>;
    getStatus: () => Promise<{ isRecording: boolean; isPaused: boolean; duration: number; audioLevel: number; startTime?: Date; error?: string }>;
  };
  ai: {
    chat: (message: string, history: ChatMessage[], options?: ChatOptions) => Promise<IPCResponse<ChatResponse>>;
    chatStream: (message: string, history: ChatMessage[], options: ChatOptions, onChunk: (chunk: string) => void) => Promise<IPCResponse<void>>;
    polishTranscription: (text: string, options?: { grammar?: boolean; punctuation?: boolean; clarity?: boolean; preserveMeaning?: boolean }) => Promise<IPCResponse<PolishResult>>;
    generateSummary: (transcription: string, notes?: string, options?: { style?: string; maxLength?: number }) => Promise<IPCResponse<SummaryResult>>;
    generateTitle: (transcription: string, notes?: string, options?: { maxLength?: number; format?: string }) => Promise<IPCResponse<TitleResult>>;
    isConfigured: () => Promise<IPCResponse<boolean>>;
    testConnection: () => Promise<IPCResponse<boolean>>;
    setApiKey: (apiKey: string) => Promise<IPCResponse<void>>;
  };
  // TODO: Add these interfaces when features are implemented
  // files?: { ... };
  // themes?: { ... };
  // canvas?: { ... };
}
