// Core application types
export interface SessionData {
  id: string;
  title: string;
  courseId?: string;
  courseTitle?: string;
  assignmentId?: string;
  recordingPath?: string;
  transcription?: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  duration?: number;
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

export interface ElectronAPI {
  recording: {
    start: () => Promise<{ success: boolean; error?: string }>;
    stop: (audioData: ArrayBuffer, duration: number) => Promise<{ success: boolean; sessionId?: string; filePath?: string; error?: string }>;
    pause: () => Promise<{ success: boolean; error?: string }>;
    resume: () => Promise<{ success: boolean; error?: string }>;
    getStatus: () => Promise<{ isRecording: boolean; isPaused: boolean; duration: number; audioLevel: number; startTime?: Date; error?: string }>;
    onAudioLevel: (callback: (level: number) => void) => void;
  };
  files: {
    save: (data: any) => Promise<void>;
    load: (filename: string) => Promise<any>;
    list: () => Promise<string[]>;
  };
  themes: {
    getAvailable: () => Promise<string[]>;
    setActive: (themeId: string) => Promise<void>;
    getActive: () => Promise<string>;
  };
  ai: {
    enhanceTranscription: (text: string) => Promise<string>;
    generateSummary: (notes: string) => Promise<string>;
    createStudyAids: (content: string) => Promise<any[]>;
  };
  canvas: {
    importCourses: () => Promise<any[]>;
    linkToAssignment: (recordingId: string, assignmentId: string) => Promise<void>;
    exportToCanvas: (sessionId: string, assignmentId: string) => Promise<void>;
  };
}
