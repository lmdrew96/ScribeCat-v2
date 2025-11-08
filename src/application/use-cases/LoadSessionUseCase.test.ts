import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoadSessionUseCase } from './LoadSessionUseCase';
import { createMockSessionRepository } from '@test/mocks';
import { createSampleSession, createSampleSessionList } from '@test/fixtures';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';

describe('LoadSessionUseCase', () => {
  let useCase: LoadSessionUseCase;
  let mockRepository: ISessionRepository;

  beforeEach(() => {
    mockRepository = createMockSessionRepository();
    useCase = new LoadSessionUseCase(mockRepository);
  });

  describe('execute - load single session', () => {
    it('should load a session by ID successfully', async () => {
      const session = createSampleSession({ id: 'session-123', title: 'Test Session' });
      vi.mocked(mockRepository.findById).mockResolvedValue(session);

      const result = await useCase.execute('session-123');

      expect(result).toBe(session);
      expect(mockRepository.findById).toHaveBeenCalledWith('session-123');
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('should return null when session not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      const result = await useCase.execute('non-existent');

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith('non-existent');
    });

    it('should load session with all properties intact', async () => {
      const session = createSampleSession({
        id: 'session-123',
        title: 'Complete Session',
        notes: '<p>Session notes with <strong>formatting</strong></p>',
        tags: ['tag1', 'tag2', 'tag3'],
        courseId: 'course-456',
        courseTitle: 'Computer Science',
        courseNumber: 'CS 101',
        userId: 'user-789',
        cloudId: 'cloud-abc',
        duration: 3600
      });
      vi.mocked(mockRepository.findById).mockResolvedValue(session);

      const result = await useCase.execute('session-123');

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Complete Session');
      expect(result?.notes).toContain('formatting');
      expect(result?.tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(result?.courseId).toBe('course-456');
      expect(result?.userId).toBe('user-789');
      expect(result?.cloudId).toBe('cloud-abc');
      expect(result?.duration).toBe(3600);
    });

    it('should load session with transcription', async () => {
      const session = createSampleSession({
        id: 'session-123',
        transcription: {
          text: 'This is the transcribed text',
          language: 'en',
          confidence: 0.95,
          wordTimestamps: [
            { word: 'This', startTime: 0, endTime: 0.5, confidence: 0.98 }
          ]
        } as any
      });
      vi.mocked(mockRepository.findById).mockResolvedValue(session);

      const result = await useCase.execute('session-123');

      expect(result?.transcription).toBeDefined();
      expect(result?.transcription?.text).toBe('This is the transcribed text');
      expect(result?.transcription?.language).toBe('en');
      expect(result?.transcription?.confidence).toBe(0.95);
    });

    it('should handle session without optional fields', async () => {
      const session = createSampleSession({
        id: 'session-123',
        courseId: undefined,
        courseTitle: undefined,
        courseNumber: undefined,
        userId: undefined,
        cloudId: undefined
      });
      vi.mocked(mockRepository.findById).mockResolvedValue(session);

      const result = await useCase.execute('session-123');

      expect(result).not.toBeNull();
      expect(result?.courseId).toBeUndefined();
      expect(result?.userId).toBeUndefined();
      expect(result?.cloudId).toBeUndefined();
    });
  });

  describe('execute - error handling', () => {
    it('should propagate repository errors', async () => {
      vi.mocked(mockRepository.findById).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(useCase.execute('session-123')).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle repository timeout errors', async () => {
      vi.mocked(mockRepository.findById).mockRejectedValue(
        new Error('Query timeout')
      );

      await expect(useCase.execute('session-123')).rejects.toThrow('Query timeout');
    });

    it('should handle malformed session ID', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      const result = await useCase.execute('');

      expect(result).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledWith('');
    });
  });

  describe('execute - special session IDs', () => {
    it('should handle UUID format session IDs', async () => {
      const session = createSampleSession({ id: '550e8400-e29b-41d4-a716-446655440000' });
      vi.mocked(mockRepository.findById).mockResolvedValue(session);

      const result = await useCase.execute('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toBe(session);
    });

    it('should handle very long session IDs', async () => {
      const longId = 'session-' + 'a'.repeat(1000);
      const session = createSampleSession({ id: longId });
      vi.mocked(mockRepository.findById).mockResolvedValue(session);

      const result = await useCase.execute(longId);

      expect(result).toBe(session);
    });

    it('should handle session IDs with special characters', async () => {
      const specialId = 'session-特殊-字符-🎉';
      const session = createSampleSession({ id: specialId });
      vi.mocked(mockRepository.findById).mockResolvedValue(session);

      const result = await useCase.execute(specialId);

      expect(result).toBe(session);
    });
  });

  describe('loadAll - load all sessions', () => {
    it('should load all sessions successfully', async () => {
      const sessions = createSampleSessionList(5);
      vi.mocked(mockRepository.findAll).mockResolvedValue(sessions);

      const result = await useCase.loadAll();

      expect(result).toBe(sessions);
      expect(result).toHaveLength(5);
      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no sessions exist', async () => {
      vi.mocked(mockRepository.findAll).mockResolvedValue([]);

      const result = await useCase.loadAll();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should load large number of sessions', async () => {
      const sessions = createSampleSessionList(100);
      vi.mocked(mockRepository.findAll).mockResolvedValue(sessions);

      const result = await useCase.loadAll();

      expect(result).toHaveLength(100);
      expect(result[0].id).toBe('session-1');
      expect(result[99].id).toBe('session-100');
    });

    it('should load sessions with mixed properties', async () => {
      const sessions = [
        createSampleSession({ id: 'session-1', userId: 'user-1', cloudId: 'cloud-1' }),
        createSampleSession({ id: 'session-2', userId: undefined, cloudId: undefined }),
        createSampleSession({ id: 'session-3', userId: 'user-2', cloudId: undefined }),
      ];
      vi.mocked(mockRepository.findAll).mockResolvedValue(sessions);

      const result = await useCase.loadAll();

      expect(result).toHaveLength(3);
      expect(result[0].userId).toBe('user-1');
      expect(result[1].userId).toBeUndefined();
      expect(result[2].userId).toBe('user-2');
    });

    it('should preserve session order from repository', async () => {
      const sessions = [
        createSampleSession({ id: 'session-3', createdAt: new Date('2025-01-03') }),
        createSampleSession({ id: 'session-1', createdAt: new Date('2025-01-01') }),
        createSampleSession({ id: 'session-2', createdAt: new Date('2025-01-02') }),
      ];
      vi.mocked(mockRepository.findAll).mockResolvedValue(sessions);

      const result = await useCase.loadAll();

      expect(result[0].id).toBe('session-3');
      expect(result[1].id).toBe('session-1');
      expect(result[2].id).toBe('session-2');
    });
  });

  describe('loadAll - error handling', () => {
    it('should propagate repository errors', async () => {
      vi.mocked(mockRepository.findAll).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(useCase.loadAll()).rejects.toThrow('Database connection failed');
    });

    it('should handle repository timeout errors', async () => {
      vi.mocked(mockRepository.findAll).mockRejectedValue(
        new Error('Query timeout exceeded')
      );

      await expect(useCase.loadAll()).rejects.toThrow('Query timeout exceeded');
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent execute calls', async () => {
      const session1 = createSampleSession({ id: 'session-1' });
      const session2 = createSampleSession({ id: 'session-2' });

      vi.mocked(mockRepository.findById)
        .mockResolvedValueOnce(session1)
        .mockResolvedValueOnce(session2);

      const [result1, result2] = await Promise.all([
        useCase.execute('session-1'),
        useCase.execute('session-2')
      ]);

      expect(result1?.id).toBe('session-1');
      expect(result2?.id).toBe('session-2');
      expect(mockRepository.findById).toHaveBeenCalledTimes(2);
    });

    it('should handle execute and loadAll called together', async () => {
      const session = createSampleSession({ id: 'session-1' });
      const allSessions = createSampleSessionList(3);

      vi.mocked(mockRepository.findById).mockResolvedValue(session);
      vi.mocked(mockRepository.findAll).mockResolvedValue(allSessions);

      const [singleResult, allResult] = await Promise.all([
        useCase.execute('session-1'),
        useCase.loadAll()
      ]);

      expect(singleResult?.id).toBe('session-1');
      expect(allResult).toHaveLength(3);
    });

    it('should handle multiple loadAll calls', async () => {
      const sessions = createSampleSessionList(5);
      vi.mocked(mockRepository.findAll).mockResolvedValue(sessions);

      const result1 = await useCase.loadAll();
      const result2 = await useCase.loadAll();

      expect(result1).toHaveLength(5);
      expect(result2).toHaveLength(5);
      expect(mockRepository.findAll).toHaveBeenCalledTimes(2);
    });
  });

  describe('integration scenarios', () => {
    it('should load session with complete metadata', async () => {
      const session = createSampleSession({
        id: 'integration-session',
        title: 'Complete Integration Session',
        notes: '<p>Full <strong>HTML</strong> notes</p>',
        tags: ['integration', 'test', 'complete'],
        duration: 3600,
        courseId: 'course-123',
        courseTitle: 'Advanced Testing',
        courseNumber: 'TEST 301',
        userId: 'user-456',
        cloudId: 'cloud-789',
        createdAt: new Date('2025-01-15T10:00:00Z'),
        updatedAt: new Date('2025-01-15T11:00:00Z')
      });
      vi.mocked(mockRepository.findById).mockResolvedValue(session);

      const result = await useCase.execute('integration-session');

      expect(result).toMatchObject({
        id: 'integration-session',
        title: 'Complete Integration Session',
        tags: ['integration', 'test', 'complete'],
        duration: 3600,
        courseId: 'course-123',
        userId: 'user-456',
        cloudId: 'cloud-789'
      });
    });

    it('should load multiple sessions with varying data', async () => {
      const sessions = [
        createSampleSession({ id: 'local-only', cloudId: undefined, userId: undefined }),
        createSampleSession({ id: 'cloud-synced', cloudId: 'cloud-1', userId: 'user-1' }),
        createSampleSession({ id: 'with-course', courseId: 'course-1', courseTitle: 'CS 101' }),
        createSampleSession({ id: 'with-transcription', transcription: { text: 'Test' } as any }),
      ];
      vi.mocked(mockRepository.findAll).mockResolvedValue(sessions);

      const result = await useCase.loadAll();

      expect(result).toHaveLength(4);
      expect(result.find(s => s.id === 'local-only')?.cloudId).toBeUndefined();
      expect(result.find(s => s.id === 'cloud-synced')?.cloudId).toBe('cloud-1');
      expect(result.find(s => s.id === 'with-course')?.courseId).toBe('course-1');
      expect(result.find(s => s.id === 'with-transcription')?.transcription).toBeDefined();
    });
  });
});
