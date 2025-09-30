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
