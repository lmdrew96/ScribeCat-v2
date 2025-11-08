/**
 * Test fixtures for Session entities
 */

import { Session } from '../../domain/entities/Session';
import { Transcription } from '../../domain/entities/Transcription';

/**
 * Create a sample session for testing
 */
export const createSampleSession = (overrides: Partial<{
  id: string;
  title: string;
  audioFilePath: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  duration: number;
  transcription: Transcription;
  tags: string[];
  exportHistory: any[];
  courseId: string | undefined;
  courseTitle: string | undefined;
  courseNumber: string | undefined;
  userId: string | undefined;
  lastSyncedAt: Date | undefined;
  isDeleted: boolean;
  cloudId: string | undefined;
  deletedAt: Date | undefined;
}> = {}): Session => {
  const defaults = {
    id: 'test-session-id-123',
    title: 'Test Session',
    audioFilePath: '/recordings/test-recording.webm',
    notes: '<p>Test notes</p>',
    createdAt: new Date('2025-01-15T12:00:00Z'),
    updatedAt: new Date('2025-01-15T12:00:00Z'),
    duration: 300, // 5 minutes
    transcription: createSampleTranscription(),
    tags: ['test', 'sample'],
    exportHistory: [],
    courseId: undefined,
    courseTitle: undefined,
    courseNumber: undefined,
    userId: undefined,
    cloudId: undefined,
    lastSyncedAt: undefined,
    isDeleted: false,
    deletedAt: undefined,
  };

  const merged = { ...defaults, ...overrides };

  return new Session(
    merged.id,
    merged.title,
    merged.audioFilePath, // recordingPath
    merged.notes,
    merged.createdAt,
    merged.updatedAt,
    merged.duration,
    merged.transcription,
    merged.tags,
    merged.exportHistory,
    merged.courseId,
    merged.courseTitle,
    merged.courseNumber,
    merged.userId,
    merged.cloudId,
    undefined, // syncStatus - defaults to NOT_SYNCED
    merged.lastSyncedAt,
    undefined, // permissionLevel
    merged.isDeleted,
    merged.deletedAt
  );
};

/**
 * Create a sample transcription for testing
 */
export const createSampleTranscription = (overrides: Partial<{
  text: string;
  language: string;
  confidence: number | undefined;
  wordTimestamps: any[];
}> = {}): Transcription => {
  const defaults = {
    text: 'This is a sample transcription text for testing purposes.',
    language: 'en',
    confidence: 0.95,
    wordTimestamps: [
      { word: 'This', startTime: 0, endTime: 0.5, confidence: 0.98 },
      { word: 'is', startTime: 0.5, endTime: 0.8, confidence: 0.96 },
      { word: 'a', startTime: 0.8, endTime: 1.0, confidence: 0.94 },
      { word: 'sample', startTime: 1.0, endTime: 1.5, confidence: 0.97 },
    ],
  };

  const merged = { ...defaults, ...overrides };

  return new Transcription(
    merged.text,
    merged.language,
    merged.confidence,
    merged.wordTimestamps
  );
};

/**
 * Create multiple sample sessions for list testing
 */
export const createSampleSessionList = (count: number = 5): Session[] => {
  return Array.from({ length: count }, (_, i) =>
    createSampleSession({
      id: `session-${i + 1}`,
      title: `Session ${i + 1}`,
      createdAt: new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000), // Spread across days
      duration: 120 + i * 60, // Varying durations
      tags: i % 2 === 0 ? ['even', 'test'] : ['odd', 'test'],
    })
  );
};

/**
 * Create a session with course information
 */
export const createCourseSession = (overrides = {}): Session => {
  return createSampleSession({
    courseId: 'course-cs101',
    courseTitle: 'Introduction to Computer Science',
    courseNumber: 'CS 101',
    tags: ['lecture', 'cs101'],
    ...overrides,
  });
};

/**
 * Create a session associated with a user (cloud sync)
 */
export const createUserSession = (userId: string, overrides = {}): Session => {
  return createSampleSession({
    userId,
    lastSyncedAt: new Date(),
    ...overrides,
  });
};
