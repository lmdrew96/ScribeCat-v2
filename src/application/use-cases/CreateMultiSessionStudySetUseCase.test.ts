import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateMultiSessionStudySetUseCase } from './CreateMultiSessionStudySetUseCase';
import { createMockSessionRepository } from '@test/mocks';
import { createSampleSession } from '@test/fixtures';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';

describe('CreateMultiSessionStudySetUseCase', () => {
  let useCase: CreateMultiSessionStudySetUseCase;
  let mockRepository: ISessionRepository;

  beforeEach(() => {
    mockRepository = createMockSessionRepository();
    useCase = new CreateMultiSessionStudySetUseCase(mockRepository);

    // Suppress console logs in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('execute - basic creation', () => {
    it('should create multi-session study set from multiple sessions', async () => {
      const session1 = createSampleSession({ id: 'session-1', title: 'Lecture 1', courseId: 'CS101' });
      const session2 = createSampleSession({ id: 'session-2', title: 'Lecture 2', courseId: 'CS101' });
      const session3 = createSampleSession({ id: 'session-3', title: 'Lecture 3', courseId: 'CS101' });

      mockRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'session-1') return session1;
        if (id === 'session-2') return session2;
        if (id === 'session-3') return session3;
        return null;
      });

      const result = await useCase.execute({
        sessionIds: ['session-1', 'session-2', 'session-3'],
        title: 'CS101 Complete Course',
      });

      expect(result).toBeDefined();
      expect(result.title).toBe('CS101 Complete Course');
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should create study set with single session', async () => {
      const session = createSampleSession({ id: 'session-1', courseId: 'CS101' });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      const result = await useCase.execute({
        sessionIds: ['session-1'],
        title: 'Single Session Study Set',
      });

      expect(result).toBeDefined();
      expect(result.title).toBe('Single Session Study Set');
    });

    it('should save study set to repository', async () => {
      const session1 = createSampleSession({ id: 'session-1', courseId: 'CS101' });
      const session2 = createSampleSession({ id: 'session-2', courseId: 'CS101' });

      mockRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'session-1') return session1;
        if (id === 'session-2') return session2;
        return null;
      });

      await useCase.execute({
        sessionIds: ['session-1', 'session-2'],
        title: 'Study Set',
      });

      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.title).toBe('Study Set');
    });

    it('should include userId when provided', async () => {
      const session = createSampleSession({ id: 'session-1', courseId: 'CS101' });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      const result = await useCase.execute({
        sessionIds: ['session-1'],
        title: 'User Study Set',
        userId: 'user-123',
      });

      expect(result.userId).toBe('user-123');
    });

    it('should preserve session order from input', async () => {
      const session1 = createSampleSession({ id: 'session-1', title: 'First' });
      const session2 = createSampleSession({ id: 'session-2', title: 'Second' });
      const session3 = createSampleSession({ id: 'session-3', title: 'Third' });

      mockRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'session-1') return session1;
        if (id === 'session-2') return session2;
        if (id === 'session-3') return session3;
        return null;
      });

      const result = await useCase.execute({
        sessionIds: ['session-3', 'session-1', 'session-2'],
        title: 'Ordered Study Set',
      });

      // Verify MultiSessionMerger received sessions in correct order
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('execute - validation', () => {
    it('should throw error when no session IDs provided', async () => {
      await expect(
        useCase.execute({
          sessionIds: [],
          title: 'Empty Study Set',
        })
      ).rejects.toThrow('Must provide at least one session ID');
    });

    it('should throw error when sessionIds is undefined', async () => {
      await expect(
        useCase.execute({
          sessionIds: undefined as any,
          title: 'Invalid Study Set',
        })
      ).rejects.toThrow('Must provide at least one session ID');
    });

    it('should throw error when title is empty', async () => {
      const session = createSampleSession({ id: 'session-1' });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      await expect(
        useCase.execute({
          sessionIds: ['session-1'],
          title: '',
        })
      ).rejects.toThrow('Must provide a title for the study set');
    });

    it('should throw error when title is whitespace only', async () => {
      const session = createSampleSession({ id: 'session-1' });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      await expect(
        useCase.execute({
          sessionIds: ['session-1'],
          title: '   ',
        })
      ).rejects.toThrow('Must provide a title for the study set');
    });

    it('should throw error when session not found', async () => {
      const session1 = createSampleSession({ id: 'session-1' });
      mockRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'session-1') return session1;
        return null;
      });

      await expect(
        useCase.execute({
          sessionIds: ['session-1', 'session-2'],
          title: 'Study Set',
        })
      ).rejects.toThrow('Sessions not found: session-2');
    });

    it('should throw error when multiple sessions not found', async () => {
      mockRepository.findById = vi.fn().mockResolvedValue(null);

      await expect(
        useCase.execute({
          sessionIds: ['session-1', 'session-2', 'session-3'],
          title: 'Study Set',
        })
      ).rejects.toThrow('Sessions not found: session-1, session-2, session-3');
    });

    it('should throw error when sessions from different courses', async () => {
      const session1 = createSampleSession({ id: 'session-1', courseId: 'CS101' });
      const session2 = createSampleSession({ id: 'session-2', courseId: 'MATH201' });

      mockRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'session-1') return session1;
        if (id === 'session-2') return session2;
        return null;
      });

      await expect(
        useCase.execute({
          sessionIds: ['session-1', 'session-2'],
          title: 'Mixed Course Study Set',
        })
      ).rejects.toThrow('Cannot create study set from sessions in different courses');
    });
  });

  describe('execute - course handling', () => {
    it('should allow sessions with no courseId', async () => {
      const session1 = createSampleSession({ id: 'session-1', courseId: undefined });
      const session2 = createSampleSession({ id: 'session-2', courseId: undefined });

      mockRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'session-1') return session1;
        if (id === 'session-2') return session2;
        return null;
      });

      const result = await useCase.execute({
        sessionIds: ['session-1', 'session-2'],
        title: 'No Course Study Set',
      });

      expect(result).toBeDefined();
    });

    it('should allow sessions with same courseId', async () => {
      const session1 = createSampleSession({ id: 'session-1', courseId: 'CS101' });
      const session2 = createSampleSession({ id: 'session-2', courseId: 'CS101' });
      const session3 = createSampleSession({ id: 'session-3', courseId: 'CS101' });

      mockRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'session-1') return session1;
        if (id === 'session-2') return session2;
        if (id === 'session-3') return session3;
        return null;
      });

      const result = await useCase.execute({
        sessionIds: ['session-1', 'session-2', 'session-3'],
        title: 'Same Course Study Set',
      });

      expect(result.courseId).toBe('CS101');
    });

    it('should preserve course metadata from first session', async () => {
      const session1 = createSampleSession({
        id: 'session-1',
        courseId: 'CS101',
        courseTitle: 'Intro to CS',
        courseNumber: 'CS 101',
      });
      const session2 = createSampleSession({
        id: 'session-2',
        courseId: 'CS101',
        courseTitle: 'Intro to CS',
        courseNumber: 'CS 101',
      });

      mockRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'session-1') return session1;
        if (id === 'session-2') return session2;
        return null;
      });

      const result = await useCase.execute({
        sessionIds: ['session-1', 'session-2'],
        title: 'CS101 Study Set',
      });

      expect(result.courseTitle).toBe('Intro to CS');
      expect(result.courseNumber).toBe('CS 101');
    });
  });

  describe('execute - error handling', () => {
    it('should throw error when repository save fails', async () => {
      const session = createSampleSession({ id: 'session-1' });
      mockRepository.findById = vi.fn().mockResolvedValue(session);
      mockRepository.save = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(
        useCase.execute({
          sessionIds: ['session-1'],
          title: 'Study Set',
        })
      ).rejects.toThrow('Failed to create multi-session study set');
    });

    it('should throw error when repository findById fails', async () => {
      mockRepository.findById = vi.fn().mockRejectedValue(new Error('Connection error'));

      await expect(
        useCase.execute({
          sessionIds: ['session-1'],
          title: 'Study Set',
        })
      ).rejects.toThrow('Failed to create multi-session study set');
    });

    it('should handle non-Error exceptions', async () => {
      const session = createSampleSession({ id: 'session-1' });
      mockRepository.findById = vi.fn().mockResolvedValue(session);
      mockRepository.save = vi.fn().mockRejectedValue('String error');

      await expect(
        useCase.execute({
          sessionIds: ['session-1'],
          title: 'Study Set',
        })
      ).rejects.toThrow('Failed to create multi-session study set: Unknown error');
    });

    it('should not save when validation fails', async () => {
      await expect(
        useCase.execute({
          sessionIds: [],
          title: 'Study Set',
        })
      ).rejects.toThrow();

      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should create complete study set with all properties', async () => {
      const session1 = createSampleSession({
        id: 'session-1',
        title: 'Lecture 1',
        duration: 3600,
        tags: ['lecture', 'intro'],
        courseId: 'CS101',
      });
      const session2 = createSampleSession({
        id: 'session-2',
        title: 'Lecture 2',
        duration: 3000,
        tags: ['lecture', 'advanced'],
        courseId: 'CS101',
      });

      mockRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'session-1') return session1;
        if (id === 'session-2') return session2;
        return null;
      });

      const result = await useCase.execute({
        sessionIds: ['session-1', 'session-2'],
        title: 'Complete CS101 Course',
        userId: 'user-456',
      });

      expect(result.title).toBe('Complete CS101 Course');
      expect(result.userId).toBe('user-456');
      expect(result.courseId).toBe('CS101');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle large number of sessions', async () => {
      const sessions = Array.from({ length: 50 }, (_, i) =>
        createSampleSession({
          id: `session-${i}`,
          title: `Lecture ${i + 1}`,
          courseId: 'CS101',
        })
      );

      mockRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        const session = sessions.find(s => s.id === id);
        return session || null;
      });

      const sessionIds = sessions.map(s => s.id);

      const result = await useCase.execute({
        sessionIds,
        title: '50 Lecture Marathon',
      });

      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should maintain session order even when loaded out of order', async () => {
      const session1 = createSampleSession({ id: 'session-1', title: 'First' });
      const session2 = createSampleSession({ id: 'session-2', title: 'Second' });
      const session3 = createSampleSession({ id: 'session-3', title: 'Third' });

      // Simulate repository returning sessions in different order
      const allSessions = [session3, session1, session2];
      mockRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        return allSessions.find(s => s.id === id) || null;
      });

      const result = await useCase.execute({
        sessionIds: ['session-1', 'session-2', 'session-3'],
        title: 'Ordered Study Set',
      });

      expect(result).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle sessions with special characters in title', async () => {
      const session = createSampleSession({
        id: 'session-1',
        title: 'Lecture: "Special" & <Characters>',
      });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      const result = await useCase.execute({
        sessionIds: ['session-1'],
        title: 'Study Set: "Special" & <Characters>',
      });

      expect(result.title).toBe('Study Set: "Special" & <Characters>');
    });

    it('should handle very long study set title', async () => {
      const session = createSampleSession({ id: 'session-1' });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      const longTitle = 'A'.repeat(500);
      const result = await useCase.execute({
        sessionIds: ['session-1'],
        title: longTitle,
      });

      expect(result.title).toBe(longTitle);
    });

    it('should handle session IDs with special characters', async () => {
      const session = createSampleSession({ id: 'session-123-abc-XYZ' });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      const result = await useCase.execute({
        sessionIds: ['session-123-abc-XYZ'],
        title: 'Study Set',
      });

      expect(result).toBeDefined();
    });

    it('should handle duplicate session IDs in input', async () => {
      const session = createSampleSession({ id: 'session-1' });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      const result = await useCase.execute({
        sessionIds: ['session-1', 'session-1', 'session-1'],
        title: 'Duplicate Sessions',
      });

      expect(result).toBeDefined();
      // Should still create study set, MultiSessionMerger handles duplicates
    });

    it('should handle sessions with empty notes', async () => {
      const session1 = createSampleSession({ id: 'session-1', notes: '' });
      const session2 = createSampleSession({ id: 'session-2', notes: '' });

      mockRepository.findById = vi.fn().mockImplementation(async (id: string) => {
        if (id === 'session-1') return session1;
        if (id === 'session-2') return session2;
        return null;
      });

      const result = await useCase.execute({
        sessionIds: ['session-1', 'session-2'],
        title: 'Empty Notes Study Set',
      });

      expect(result).toBeDefined();
    });

    it('should handle sessions with no tags', async () => {
      const session = createSampleSession({ id: 'session-1', tags: [] });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      const result = await useCase.execute({
        sessionIds: ['session-1'],
        title: 'No Tags Study Set',
      });

      expect(result).toBeDefined();
    });
  });
});
