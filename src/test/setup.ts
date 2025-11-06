/**
 * Test Setup
 * Global test configuration and utilities
 */

import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/dom';

// Cleanup DOM after each test
afterEach(() => {
  cleanup();
});

// Mock window.scribeCat API for renderer tests
export const mockWindowScribeCat = () => {
  const mockApi = {
    dialog: {
      showSaveDialog: vi.fn(),
    },
    recording: {
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getStatus: vi.fn(),
    },
    audio: {
      saveFile: vi.fn(),
      getMetadata: vi.fn(),
    },
    transcription: {
      assemblyai: {
        start: vi.fn(),
        processAudio: vi.fn(),
        stop: vi.fn(),
        onResult: vi.fn(),
        removeResultListener: vi.fn(),
        getToken: vi.fn(),
      },
    },
    store: {
      get: vi.fn(),
      set: vi.fn(),
    },
    ai: {
      chat: vi.fn(),
      chatStream: vi.fn(),
      polishTranscription: vi.fn(),
      generateSummary: vi.fn(),
      generateTitle: vi.fn(),
      isConfigured: vi.fn(),
      testConnection: vi.fn(),
      setApiKey: vi.fn(),
      removeChatStreamListener: vi.fn(),
    },
    session: {
      list: vi.fn(),
      listWithTags: vi.fn(),
      delete: vi.fn(),
      deleteMultiple: vi.fn(),
      update: vi.fn(),
      export: vi.fn(),
      exportWithDefaults: vi.fn(),
      updateTranscription: vi.fn(),
      updateNotes: vi.fn(),
      getAvailableFormats: vi.fn(),
    },
    drive: {
      configure: vi.fn(),
      isAuthenticated: vi.fn(),
      getAuthUrl: vi.fn(),
      exchangeCodeForTokens: vi.fn(),
      setCredentials: vi.fn(),
      getUserEmail: vi.fn(),
      disconnect: vi.fn(),
      uploadFile: vi.fn(),
      listFiles: vi.fn(),
      createFolder: vi.fn(),
    },
    canvas: {
      configure: vi.fn(),
      testConnection: vi.fn(),
      getCourses: vi.fn(),
      isConfigured: vi.fn(),
      getConfig: vi.fn(),
      disconnect: vi.fn(),
      importCourses: vi.fn(),
      getImportedCourses: vi.fn(),
      deleteImportedCourse: vi.fn(),
    },
  };

  (global as any).window = {
    ...global.window,
    scribeCat: mockApi,
  };

  return mockApi;
};

// Mock AudioContext for audio tests
export const mockAudioContext = () => {
  const mockContext = {
    state: 'running',
    sampleRate: 48000,
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createAnalyser: vi.fn().mockReturnValue({
      fftSize: 256,
      frequencyBinCount: 128,
      smoothingTimeConstant: 0.8,
      getByteFrequencyData: vi.fn(),
      connect: vi.fn(),
    }),
    createMediaStreamSource: vi.fn().mockReturnValue({
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createGain: vi.fn().mockReturnValue({
      gain: { value: 1 },
      connect: vi.fn(),
    }),
    createScriptProcessor: vi.fn().mockReturnValue({
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null,
    }),
  };

  (global as any).AudioContext = vi.fn(() => mockContext);
  (global as any).webkitAudioContext = vi.fn(() => mockContext);

  return mockContext;
};

// Mock MediaStream for audio tests
export const mockMediaStream = () => {
  const mockStream = {
    id: 'test-stream',
    active: true,
    getTracks: vi.fn().mockReturnValue([]),
    getAudioTracks: vi.fn().mockReturnValue([
      {
        id: 'audio-track',
        kind: 'audio',
        label: 'Test Microphone',
        enabled: true,
        stop: vi.fn(),
      },
    ]),
    getVideoTracks: vi.fn().mockReturnValue([]),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    clone: vi.fn().mockReturnThis(),
  };

  return mockStream;
};

// Helper to create mock session data
export const createMockSession = (overrides: any = {}) => ({
  id: 'test-session-id',
  title: 'Test Session',
  audioFilePath: '/path/to/audio.webm',
  transcription: 'Test transcription text',
  notes: '<p>Test notes</p>',
  duration: 300,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  tags: [],
  courseId: null,
  courseTitle: null,
  courseNumber: null,
  ...overrides,
});

// Helper to create mock course data
export const createMockCourse = (overrides: any = {}) => ({
  id: 'test-course-id',
  code: 'CS101',
  title: 'Introduction to Computer Science',
  term: 'Fall 2025',
  ...overrides,
});

export { expect, vi };
