// Global type declarations for window.scribeCat API
// This file is referenced by both preload and renderer

import type {
  SaveDialogOptions,
  SaveDialogResult,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  PolishResult,
  SummaryResult,
  TitleResult,
  SessionListItem,
  SessionDeleteResult,
  ExportFormat,
  ExportOptions,
  GoogleDriveConfig,
  GoogleDriveUploadOptions,
  GoogleDriveUploadResult,
  DriveFileItem,
  CanvasConfig,
  CanvasCourse,
  IPCResponse
} from './types';

declare global {
  interface Window {
    scribeCat: {
      dialog: {
        showSaveDialog: (options: SaveDialogOptions) => Promise<SaveDialogResult>;
      };
      recording: {
        start: () => Promise<{ success: boolean; error?: string }>;
        stop: (audioData: ArrayBuffer, duration: number, courseData?: { courseId?: string; courseTitle?: string; courseNumber?: string }, userId?: string | null) => Promise<{ success: boolean; sessionId?: string; filePath?: string; error?: string }>;
        pause: () => Promise<{ success: boolean; error?: string }>;
        resume: () => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{ isRecording: boolean; isPaused: boolean; duration: number; audioLevel: number; startTime?: Date; error?: string }>;
      };
      audio: {
        saveFile: (audioData: number[], fileName: string, folderPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
        getMetadata: (filePath: string) => Promise<{ success: boolean; data?: { duration: number; bitrate?: number; sampleRate?: number; numberOfChannels?: number; codec?: string }; error?: string }>;
      };
      transcription: {
        simulation: {
          start: () => Promise<{ success: boolean; sessionId?: string; error?: string }>;
          stop: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
          onResult: (callback: (result: TranscriptionResult) => void) => void;
          removeResultListener: () => void;
        };
        assemblyai: {
          start: (apiKey: string) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
          processAudio: (sessionId: string, audioData: number[]) => Promise<{ success: boolean; error?: string }>;
          stop: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
          onResult: (callback: (result: TranscriptionResult) => void) => void;
          removeResultListener: () => void;
          getToken: (apiKey: string) => Promise<{ success: boolean; token?: string; error?: string }>;
        };
      };
      settings: {
        getSimulationMode: () => Promise<{ success: boolean; simulationMode?: boolean; error?: string }>;
        setSimulationMode: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
      };
      store: {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<void>;
      };
      ai: {
        chat: (message: string, history: ChatMessage[], options?: ChatOptions) => Promise<IPCResponse<ChatResponse>>;
        chatStream: (message: string, history: ChatMessage[], options: ChatOptions, onChunk: (chunk: string) => void) => Promise<IPCResponse<void>>;
        polishTranscription: (text: string, options?: Partial<{ grammar: boolean; punctuation: boolean; clarity: boolean; preserveMeaning: boolean }>) => Promise<IPCResponse<PolishResult>>;
        generateSummary: (transcription: string, notes?: string, options?: Partial<{ style: string; maxLength: number }>) => Promise<IPCResponse<SummaryResult>>;
        generateTitle: (transcription: string, notes?: string, options?: Partial<{ maxLength: number; format: string }>) => Promise<IPCResponse<TitleResult>>;
        isConfigured: () => Promise<IPCResponse<boolean>>;
        testConnection: () => Promise<IPCResponse<boolean>>;
        setApiKey: (apiKey: string) => Promise<IPCResponse<void>>;
        removeChatStreamListener: () => void;
      };
      session: {
        list: (sortOrder?: 'asc' | 'desc') => Promise<IPCResponse<SessionListItem[]>>;
        listWithTags: (tags: string[], sortOrder?: 'asc' | 'desc') => Promise<IPCResponse<SessionListItem[]>>;
        delete: (sessionId: string) => Promise<IPCResponse<void>>;
        deleteMultiple: (sessionIds: string[]) => Promise<IPCResponse<SessionDeleteResult>>;
        update: (sessionId: string, updates: { title?: string; notes?: string; tags?: string[] }) => Promise<IPCResponse<void>>;
        export: (sessionId: string, format: string, outputPath: string, options?: ExportOptions) => Promise<IPCResponse<{ filePath: string; format: string }>>;
        exportWithDefaults: (sessionId: string, format: string, outputPath: string) => Promise<IPCResponse<{ filePath: string; format: string }>>;
        updateTranscription: (sessionId: string, transcriptionText: string, provider?: string) => Promise<IPCResponse<void>>;
        updateNotes: (sessionId: string, notes: string) => Promise<IPCResponse<void>>;
        createDraft: () => Promise<IPCResponse<{ sessionId: string }>>;
        getAvailableFormats: () => Promise<IPCResponse<ExportFormat[]>>;
      };
      drive: {
        configure: (config: GoogleDriveConfig) => Promise<IPCResponse<void>>;
        isAuthenticated: () => Promise<IPCResponse<boolean>>;
        getAuthUrl: () => Promise<IPCResponse<{ authUrl: string }>>;
        exchangeCodeForTokens: (code: string) => Promise<IPCResponse<{ email: string }>>;
        setCredentials: (config: GoogleDriveConfig) => Promise<IPCResponse<void>>;
        getUserEmail: () => Promise<IPCResponse<string>>;
        disconnect: () => Promise<IPCResponse<void>>;
        uploadFile: (filePath: string, options: GoogleDriveUploadOptions) => Promise<IPCResponse<GoogleDriveUploadResult>>;
        listFiles: (folderId?: string) => Promise<IPCResponse<DriveFileItem[]>>;
        createFolder: (name: string, parentId?: string) => Promise<IPCResponse<string>>;
      };
    canvas: {
      configure: (config: CanvasConfig) => Promise<IPCResponse<void>>;
      testConnection: () => Promise<IPCResponse<{ connected: boolean }>>;
      getCourses: () => Promise<IPCResponse<CanvasCourse[]>>;
      isConfigured: () => Promise<IPCResponse<{ configured: boolean }>>;
      getConfig: () => Promise<IPCResponse<{ baseUrl: string }>>;
      disconnect: () => Promise<IPCResponse<void>>;
      importCourses: (jsonData: string) => Promise<IPCResponse<{ count: number }>>;
      getImportedCourses: () => Promise<IPCResponse<CanvasCourse[]>>;
      deleteImportedCourse: (courseId: string) => Promise<IPCResponse<void>>;
    };
      // TODO: Add type declarations when features are implemented
      // files?: { ... };
      // themes?: { ... };
    };
    // Global manager instances (set in app.ts)
    courseManager?: import('./types').CourseManager;
    aiManager?: import('../renderer/managers/AIManager').AIManager;
    authManager?: import('../renderer/managers/AuthManager').AuthManager;
  }
}

/**
 * Course manager interface
 */
export interface CourseManager {
  loadCourses(): Promise<void>;
  getCourse(courseId: string): import('./types').Course | undefined;
  getAllCourses(): import('./types').Course[];
}

/**
 * Transcription result from simulation or real transcription service
 */
interface TranscriptionResult {
  /** The transcribed text */
  text: string;
  
  /** Timestamp in seconds from start of transcription */
  timestamp: number;
  
  /** Whether this is a final result (true) or partial/interim (false) */
  isFinal: boolean;
}

export {};
