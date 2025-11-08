/**
 * Mock implementations of repository interfaces for testing
 */

import { vi } from 'vitest';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import type { IAudioRepository } from '../../domain/repositories/IAudioRepository';
import type { Session } from '../../domain/entities/Session';

/**
 * Create a mock SessionRepository
 */
export const createMockSessionRepository = (
  overrides: Partial<ISessionRepository> = {}
): ISessionRepository => ({
  save: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn().mockResolvedValue(null),
  findAll: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false),
  restore: vi.fn().mockResolvedValue(undefined),
  permanentlyDelete: vi.fn().mockResolvedValue(undefined),
  findDeleted: vi.fn().mockResolvedValue([]),
  ...overrides,
});

/**
 * Create a mock AudioRepository
 */
export const createMockAudioRepository = (
  overrides: Partial<IAudioRepository> = {}
): IAudioRepository => ({
  saveAudio: vi.fn().mockResolvedValue('/recordings/test-recording.webm'),
  loadAudio: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
  deleteAudio: vi.fn().mockResolvedValue(undefined),
  audioExists: vi.fn().mockResolvedValue(true),
  getRecordingsDirectory: vi.fn().mockReturnValue('/recordings'),
  ...overrides,
});

/**
 * Helper to create a mock session repository with pre-populated sessions
 */
export const createMockSessionRepositoryWithSessions = (sessions: Session[]): ISessionRepository => {
  const sessionsMap = new Map(sessions.map(s => [s.id, s]));

  return createMockSessionRepository({
    findById: vi.fn().mockImplementation(async (id: string) => sessionsMap.get(id) || null),
    findAll: vi.fn().mockResolvedValue(sessions),
    exists: vi.fn().mockImplementation(async (id: string) => sessionsMap.has(id)),
  });
};
