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

/**
 * Google Drive configuration
 */
export interface GoogleDriveConfig {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

/**
 * Dialog options for save dialog
 */
export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: string[];
}

/**
 * Dialog result
 */
export interface SaveDialogResult {
  success: boolean;
  data?: {
    canceled: boolean;
    filePath?: string;
  };
  error?: string;
}

/**
 * Session list item
 */
export interface SessionListItem {
  id: string;
  title: string;
  date: Date;
  duration: number;
  tags?: string[];
  courseId?: string;
  courseTitle?: string;
  hasNotes: boolean;
  hasTranscription: boolean;
}

/**
 * Session delete result
 */
export interface SessionDeleteResult {
  deleted: number;
  failed: number;
  errors?: string[];
}

/**
 * Export format info
 */
export interface ExportFormat {
  id: string;
  name: string;
  extension: string;
  description?: string;
}

/**
 * Export options
 */
export interface ExportOptions {
  includeTimestamps?: boolean;
  includeNotes?: boolean;
  includeSummary?: boolean;
  formatting?: 'plain' | 'rich' | 'markdown';
  pageSize?: string;
  margins?: { top: number; right: number; bottom: number; left: number };
}

/**
 * Google Drive file item
 */
export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  createdTime: Date;
  modifiedTime: Date;
  size?: number;
}

/**
 * Google Drive upload options
 */
export interface GoogleDriveUploadOptions {
  fileName: string;
  mimeType: string;
  folderId?: string;
}

/**
 * Google Drive upload result
 */
export interface GoogleDriveUploadResult {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  error?: string;
}

/**
 * Google Drive auth result
 */
export interface GoogleDriveAuthResult {
  success: boolean;
  authUrl?: string;
  error?: string;
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
  drive: {
    configure: (config: GoogleDriveConfig) => Promise<IPCResponse<void>>;
    isAuthenticated: () => Promise<IPCResponse<boolean>>;
    getAuthUrl: () => Promise<IPCResponse<GoogleDriveAuthResult>>;
    setCredentials: (config: GoogleDriveConfig) => Promise<IPCResponse<void>>;
    uploadFile: (filePath: string, options: GoogleDriveUploadOptions) => Promise<IPCResponse<GoogleDriveUploadResult>>;
    listFiles: (folderId?: string) => Promise<IPCResponse<DriveFileItem[]>>;
    createFolder: (name: string, parentId?: string) => Promise<IPCResponse<string>>;
  };
}

/**
 * Canvas LMS configuration
 */
export interface CanvasConfig {
  baseUrl: string;
  apiToken: string;
}

/**
 * Canvas course data
 */
export interface CanvasCourse {
  id: string;
  name: string;
  courseCode?: string;
  enrollmentTermId?: string;
}

/**
 * User authentication and account types
 */
export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;
  preferences?: Record<string, any>;
}

export interface AuthSession {
  user: UserProfile;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export interface SignInWithEmailParams {
  email: string;
  password: string;
}

export interface SignUpWithEmailParams {
  email: string;
  password: string;
  fullName?: string;
}

export interface AuthResult {
  success: boolean;
  session?: AuthSession;
  user?: UserProfile;
  error?: string;
}

/**
 * Supabase configuration
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Permission types for sharing
 */
export type PermissionLevel = 'viewer' | 'editor';

export interface SessionShare {
  id: string;
  sessionId: string;
  sharedByUserId: string;
  sharedWithUserId: string;
  sharedWithEmail?: string;
  permissionLevel: PermissionLevel;
  createdAt: Date;
  acceptedAt?: Date;
}

export interface ShareInvitation {
  id: string;
  sessionId: string;
  email: string;
  permissionLevel: PermissionLevel;
  invitationToken: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
}

export interface CreateShareParams {
  sessionId: string;
  email: string;
  permissionLevel: PermissionLevel;
}

export interface ShareResult {
  success: boolean;
  share?: SessionShare;
  invitation?: ShareInvitation;
  error?: string;
}

/**
 * Sync types
 */
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'error';

export interface SyncMetadata {
  cloudId?: string;
  syncStatus: SyncStatus;
  lastSyncedAt?: Date;
  syncError?: string;
}

/**
 * Collaboration types
 */
export interface CollaboratorPresence {
  userId: string;
  userName: string;
  userAvatar?: string;
  cursorPosition?: number;
  isRecording: boolean;
  lastSeenAt: Date;
}
