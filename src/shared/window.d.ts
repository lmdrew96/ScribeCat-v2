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
      app: {
        getVersion: () => Promise<string>;
      };
      shell: {
        openExternal: (url: string) => Promise<void>;
      };
      dialog: {
        showSaveDialog: (options: SaveDialogOptions) => Promise<SaveDialogResult>;
      };
      recording: {
        start: () => Promise<{ success: boolean; error?: string }>;
        stop: (audioData: ArrayBuffer, duration: number, courseData?: { courseId?: string; courseTitle?: string; courseNumber?: string }, userId?: string | null, transcription?: string) => Promise<{ success: boolean; sessionId?: string; filePath?: string; error?: string }>;
        pause: () => Promise<{ success: boolean; error?: string }>;
        resume: () => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{ isRecording: boolean; isPaused: boolean; duration: number; audioLevel: number; startTime?: Date; error?: string }>;
      };
      audio: {
        saveFile: (audioData: number[], fileName: string, folderPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
        getMetadata: (filePath: string) => Promise<{ success: boolean; data?: { duration: number; bitrate?: number; sampleRate?: number; numberOfChannels?: number; codec?: string }; error?: string }>;
      };
      transcription: {
        assemblyai: {
          start: (apiKey: string) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
          processAudio: (sessionId: string, audioData: number[]) => Promise<{ success: boolean; error?: string }>;
          stop: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
          onResult: (callback: (result: TranscriptionResult) => void) => void;
          removeResultListener: () => void;
          getToken: (apiKey: string) => Promise<{ success: boolean; token?: string; error?: string }>;
          batchTranscribe: (apiKey: string, audioFilePath: string) => Promise<{ success: boolean; transcription?: any; error?: string }>;
        };
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
        updateTranscription: (sessionId: string, transcriptionText: string, provider?: string, timestampedEntries?: Array<{ startTime: number; endTime: number; text: string }>) => Promise<IPCResponse<void>>;
        updateNotes: (sessionId: string, notes: string) => Promise<IPCResponse<void>>;
        updateSummary: (sessionId: string, summary: string) => Promise<IPCResponse<void>>;
        createDraft: () => Promise<IPCResponse<{ sessionId: string }>>;
        addStudyModeTime: (sessionId: string, seconds: number) => Promise<IPCResponse<void>>;
        incrementAIToolUsage: (sessionId: string) => Promise<IPCResponse<void>>;
        incrementAIChatMessages: (sessionId: string, count: number) => Promise<IPCResponse<void>>;
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
      auth: {
        signInWithEmail: (params: { email: string; password: string }) => Promise<IPCResponse<any>>;
        signUpWithEmail: (params: { email: string; password: string; fullName?: string }) => Promise<IPCResponse<any>>;
        signInWithGoogle: (codeChallenge: string) => Promise<IPCResponse<any>>;
        openOAuthWindow: (authUrl: string) => Promise<IPCResponse<{ code: string }>>;
        signOut: () => Promise<IPCResponse<void>>;
        getCurrentUser: () => Promise<IPCResponse<any>>;
        isAuthenticated: () => Promise<IPCResponse<boolean>>;
        sessionChanged: (data: { userId: string | null; accessToken?: string; refreshToken?: string }) => Promise<IPCResponse<void>>;
        showOAuthWaitingWindow: () => Promise<IPCResponse<void>>;
        closeOAuthWaitingWindow: () => Promise<IPCResponse<void>>;
        onOAuthCodeReceived: (callback: (code: string) => void) => void;
        onOAuthCancelled: (callback: () => void) => void;
        removeOAuthListeners: () => void;
      };
      sync: {
        uploadSession: (sessionId: string) => Promise<IPCResponse<void>>;
        getStatus: (sessionId: string) => Promise<IPCResponse<any>>;
        retrySync: (sessionId: string) => Promise<IPCResponse<void>>;
        syncAllFromCloud: () => Promise<IPCResponse<void>>;
      };
      share: {
        create: (params: { sessionId: string; email: string; permissionLevel: 'viewer' | 'editor' }) => Promise<IPCResponse<any>>;
        remove: (params: { shareId?: string; invitationId?: string }) => Promise<IPCResponse<void>>;
        updatePermission: (params: { shareId: string; permissionLevel: 'viewer' | 'editor' }) => Promise<IPCResponse<void>>;
        getSessionShares: (sessionId: string) => Promise<IPCResponse<any[]>>;
        getSharedWithMe: () => Promise<IPCResponse<any[]>>;
        acceptInvitation: (token: string) => Promise<IPCResponse<any>>;
      };
      friends: {
        getFriends: () => Promise<IPCResponse<any[]>>;
        getFriendsCount: () => Promise<IPCResponse<number>>;
        removeFriend: (friendId: string) => Promise<IPCResponse<void>>;
        areFriends: (userId: string) => Promise<IPCResponse<boolean>>;
        getMutualFriendsCount: (userId: string) => Promise<IPCResponse<number>>;
        getFriendRequests: () => Promise<IPCResponse<any[]>>;
        getIncomingRequests: () => Promise<IPCResponse<any[]>>;
        getOutgoingRequests: () => Promise<IPCResponse<any[]>>;
        getIncomingRequestsCount: () => Promise<IPCResponse<number>>;
        sendRequest: (recipientId: string) => Promise<IPCResponse<any>>;
        acceptRequest: (requestId: string) => Promise<IPCResponse<void>>;
        rejectRequest: (requestId: string) => Promise<IPCResponse<void>>;
        cancelRequest: (requestId: string) => Promise<IPCResponse<void>>;
        searchUsers: (searchEmail: string, limit?: number) => Promise<IPCResponse<any[]>>;
        getUserProfile: (userId: string) => Promise<IPCResponse<any>>;
      };
      studyRooms: {
        // Room operations
        createRoom: (params: { name: string; sessionId: string; maxParticipants: number }) => Promise<IPCResponse<any>>;
        getUserRooms: () => Promise<IPCResponse<any[]>>;
        getRoomById: (roomId: string) => Promise<IPCResponse<any>>;
        closeRoom: (roomId: string) => Promise<IPCResponse<void>>;
        updateRoom: (params: { roomId: string; name?: string; maxParticipants?: number }) => Promise<IPCResponse<void>>;
        // Participant operations
        getRoomParticipants: (roomId: string) => Promise<IPCResponse<any[]>>;
        getParticipantCount: (roomId: string) => Promise<IPCResponse<number>>;
        joinRoom: (roomId: string) => Promise<IPCResponse<any>>;
        leaveRoom: (roomId: string) => Promise<IPCResponse<void>>;
        removeParticipant: (params: { roomId: string; participantId: string }) => Promise<IPCResponse<void>>;
        isUserInRoom: (roomId: string) => Promise<IPCResponse<boolean>>;
        // Invitation operations
        sendInvitation: (params: { roomId: string; inviteeId: string }) => Promise<IPCResponse<any>>;
        getUserInvitations: () => Promise<IPCResponse<any[]>>;
        getPendingInvitations: () => Promise<IPCResponse<any[]>>;
        acceptInvitation: (invitationId: string) => Promise<IPCResponse<void>>;
        declineInvitation: (invitationId: string) => Promise<IPCResponse<void>>;
        cancelInvitation: (invitationId: string) => Promise<IPCResponse<void>>;
      };
      chat: {
        sendMessage: (params: { roomId: string; userId: string; message: string }) => Promise<IPCResponse<any>>;
        getRoomMessages: (roomId: string, limit?: number) => Promise<IPCResponse<any[]>>;
        deleteMessage: (messageId: string, userId: string) => Promise<IPCResponse<void>>;
        subscribeToRoom: (
          roomId: string,
          onMessage: (messageData: any) => void,
          onTyping?: (userId: string, userName: string, isTyping: boolean) => void
        ) => () => void;
        broadcastTyping: (roomId: string, userId: string, userName: string, isTyping: boolean) => Promise<IPCResponse<void>>;
        unsubscribeAll: () => Promise<IPCResponse<void>>;
      };
      games: {
        createGameSession: (params: { roomId: string; gameType: string; config: any }) => Promise<IPCResponse<any>>;
        getGameSession: (gameSessionId: string) => Promise<IPCResponse<any>>;
        getActiveGameForRoom: (roomId: string) => Promise<IPCResponse<any>>;
        startGame: (gameSessionId: string) => Promise<IPCResponse<any>>;
        completeGame: (gameSessionId: string) => Promise<IPCResponse<any>>;
        cancelGame: (gameSessionId: string) => Promise<IPCResponse<any>>;
        nextQuestion: (gameSessionId: string) => Promise<IPCResponse<any>>;
        createGameQuestions: (questions: any[]) => Promise<IPCResponse<any[]>>;
        getCurrentQuestion: (gameSessionId: string) => Promise<IPCResponse<any>>;
        getGameQuestions: (gameSessionId: string, includeAnswers: boolean) => Promise<IPCResponse<any[]>>;
        getCorrectAnswer: (params: { gameSessionId: string; questionId: string; userId: string }) => Promise<IPCResponse<{ correctAnswerIndex: number; explanation?: string } | null>>;
        submitAnswer: (params: { gameSessionId: string; userId: string; questionId: string; answer: string; timeTakenMs: number }) => Promise<IPCResponse<any>>;
        getGameLeaderboard: (gameSessionId: string) => Promise<IPCResponse<any[]>>;
        getPlayerScores: (gameSessionId: string, userId: string) => Promise<IPCResponse<any[]>>;
        subscribeToGameSession: (gameSessionId: string, onUpdate: (sessionData: any) => void) => () => void;
        subscribeToGameQuestions: (gameSessionId: string, onQuestion: (questionData: any) => void) => () => void;
        subscribeToGameScores: (gameSessionId: string, onScore: (scoreData: any) => void) => () => void;
        subscribeToRoomGames: (roomId: string, onGameSession: (sessionData: any) => void) => () => void;
        unsubscribeAll: () => Promise<IPCResponse<void>>;
      };
      sharing: {
        checkAccess: (sessionId: string) => Promise<IPCResponse<any>>;
        shareSession: (params: { sessionId: string; sharedWithEmail: string; permissionLevel: 'viewer' | 'editor' }) => Promise<IPCResponse<any>>;
        getSessionShares: (sessionId: string) => Promise<IPCResponse<any[]>>;
        getSharedWithMe: () => Promise<IPCResponse<any[]>>;
        updatePermission: (params: { shareId: string; permissionLevel: 'viewer' | 'editor' }) => Promise<IPCResponse<void>>;
        revokeAccess: (shareId: string) => Promise<IPCResponse<void>>;
      };
      dev: {
        onHotReloadNotification: (callback: (message: string) => void) => void;
        removeHotReloadListener: () => void;
      };
    };
    // Global manager instances (set in app.ts)
    courseManager?: import('./types').CourseManager;
    aiManager?: import('../renderer/managers/AIManager').AIManager;
    authManager?: import('../renderer/managers/AuthManager').AuthManager;
    studyModeManager?: import('../renderer/managers/StudyModeManager').StudyModeManager;
    friendsManager?: import('../renderer/managers/social/FriendsManager').FriendsManager;
    studyRoomsManager?: import('../renderer/managers/social/StudyRoomsManager').StudyRoomsManager;
    TutorialManager?: typeof import('../renderer/utils/TutorialManager').TutorialManager;
    FocusManager?: any;
    WelcomeModal?: any;
    SoundManager?: any;
    BreakReminders?: any;
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
 * Transcription result from transcription service
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
