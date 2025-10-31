// Global type declarations for window.scribeCat API
// This file is referenced by both preload and renderer

declare global {
  interface Window {
    scribeCat: {
      dialog: {
        showSaveDialog: (options: any) => Promise<{ success: boolean; data?: { canceled: boolean; filePath?: string }; error?: string }>;
      };
      recording: {
        start: () => Promise<{ success: boolean; error?: string }>;
        stop: (audioData: ArrayBuffer, duration: number, courseData?: { courseId?: string; courseTitle?: string; courseNumber?: string }) => Promise<{ success: boolean; sessionId?: string; filePath?: string; error?: string }>;
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
        chat: (message: string, history: any[], options?: any) => Promise<any>;
        chatStream: (message: string, history: any[], options: any, onChunk: (chunk: string) => void) => Promise<any>;
        polishTranscription: (text: string, options?: any) => Promise<any>;
        generateSummary: (transcription: string, notes?: string, options?: any) => Promise<any>;
        generateTitle: (transcription: string, notes?: string, options?: any) => Promise<any>;
        isConfigured: () => Promise<any>;
        testConnection: () => Promise<any>;
        setApiKey: (apiKey: string) => Promise<any>;
        removeChatStreamListener: () => void;
      };
      session: {
        list: (sortOrder?: 'asc' | 'desc') => Promise<{ success: boolean; data?: any[]; sessions?: any[]; error?: string }>;
        listWithTags: (tags: string[], sortOrder?: 'asc' | 'desc') => Promise<{ success: boolean; data?: any[]; sessions?: any[]; error?: string }>;
        delete: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
        deleteMultiple: (sessionIds: string[]) => Promise<{ success: boolean; result?: any; error?: string }>;
        update: (sessionId: string, updates: { title?: string; notes?: string; tags?: string[] }) => Promise<{ success: boolean; error?: string }>;
        export: (sessionId: string, format: string, outputPath: string, options?: any) => Promise<{ success: boolean; filePath?: string; format?: string; error?: string }>;
        exportWithDefaults: (sessionId: string, format: string, outputPath: string) => Promise<{ success: boolean; filePath?: string; format?: string; error?: string }>;
        updateTranscription: (sessionId: string, transcriptionText: string, provider?: string) => Promise<{ success: boolean; error?: string }>;
        updateNotes: (sessionId: string, notes: string) => Promise<{ success: boolean; error?: string }>;
        createDraft: () => Promise<{ success: boolean; sessionId?: string; error?: string }>;
        getAvailableFormats: () => Promise<{ success: boolean; formats?: string[]; error?: string }>;
      };
      drive: {
        configure: (config: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        isAuthenticated: () => Promise<{ success: boolean; data?: boolean; error?: string }>;
        getAuthUrl: () => Promise<{ success: boolean; data?: any; error?: string }>;
        exchangeCodeForTokens: (code: string) => Promise<{ success: boolean; email?: string; error?: string }>;
        setCredentials: (config: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        getUserEmail: () => Promise<{ success: boolean; data?: string; error?: string }>;
        disconnect: () => Promise<{ success: boolean; error?: string }>;
        uploadFile: (filePath: string, options: any) => Promise<{ success: boolean; fileId?: string; webViewLink?: string; error?: string }>;
        listFiles: (folderId?: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
        createFolder: (name: string, parentId?: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      };
    canvas: {
      configure: (config: { baseUrl: string; apiToken: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
      testConnection: () => Promise<{ success: boolean; data?: any; error?: string }>;
      getCourses: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
      isConfigured: () => Promise<{ success: boolean; data?: { configured: boolean }; error?: string }>;
      getConfig: () => Promise<{ success: boolean; data?: { baseUrl: string }; error?: string }>;
      disconnect: () => Promise<{ success: boolean; error?: string }>;
      importCourses: (jsonData: string) => Promise<{ success: boolean; data?: { count: number }; error?: string }>;
      getImportedCourses: () => Promise<{ success: boolean; data?: any[]; error?: string }>;
      deleteImportedCourse: (courseId: string) => Promise<{ success: boolean; error?: string }>;
    };
      // TODO: Add type declarations when features are implemented
      // files?: { ... };
      // themes?: { ... };
    };
    // Global manager instances (set in app.ts)
    courseManager?: any; // CourseManager instance
  }
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
