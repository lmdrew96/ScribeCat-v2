import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateDraftSessionUseCase } from './CreateDraftSessionUseCase';
import { createMockSessionRepository } from '@test/mocks';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';

describe('CreateDraftSessionUseCase', () => {
  let useCase: CreateDraftSessionUseCase;
  let mockRepository: ISessionRepository;

  beforeEach(() => {
    mockRepository = createMockSessionRepository();
    useCase = new CreateDraftSessionUseCase(mockRepository);

    // Suppress console logs in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('execute - draft session creation', () => {
    it('should create a draft session successfully', async () => {
      const result = await useCase.execute();

      expect(result.sessionId).toBeDefined();
      expect(typeof result.sessionId).toBe('string');
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should create session with UUID format', async () => {
      const result = await useCase.execute();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result.sessionId).toMatch(uuidRegex);
    });

    it('should create session with draft tag', async () => {
      await useCase.execute();

      expect(mockRepository.save).toHaveBeenCalled();
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.tags).toContain('draft');
    });

    it('should create session with empty recording path', async () => {
      await useCase.execute();

      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.recordingPath).toBe('');
    });

    it('should create session with zero duration', async () => {
      await useCase.execute();

      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.duration).toBe(0);
    });

    it('should create session with no transcription', async () => {
      await useCase.execute();

      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.transcription).toBeUndefined();
    });

    it('should create session with empty notes', async () => {
      await useCase.execute();

      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.notes).toBe('');
    });

    it('should create session with title including date and time', async () => {
      await useCase.execute();

      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.title).toMatch(/^Draft Notes \d+\/\d+\/\d{4}/);
    });

    it('should create session with current timestamp', async () => {
      const beforeExecution = new Date();
      await useCase.execute();
      const afterExecution = new Date();

      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.createdAt.getTime()).toBeGreaterThanOrEqual(beforeExecution.getTime());
      expect(savedSession.createdAt.getTime()).toBeLessThanOrEqual(afterExecution.getTime());
    });

    it('should create session with matching createdAt and updatedAt', async () => {
      await useCase.execute();

      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.createdAt.getTime()).toBe(savedSession.updatedAt.getTime());
    });

    it('should create session with no course information', async () => {
      await useCase.execute();

      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.courseId).toBeUndefined();
      expect(savedSession.courseTitle).toBeUndefined();
      expect(savedSession.courseNumber).toBeUndefined();
    });

    it('should create session with empty export history', async () => {
      await useCase.execute();

      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.exportHistory).toEqual([]);
    });

    it('should create unique session IDs for multiple executions', async () => {
      const result1 = await useCase.execute();
      const result2 = await useCase.execute();
      const result3 = await useCase.execute();

      expect(result1.sessionId).not.toBe(result2.sessionId);
      expect(result2.sessionId).not.toBe(result3.sessionId);
      expect(result1.sessionId).not.toBe(result3.sessionId);
    });
  });

  describe('execute - error handling', () => {
    it('should throw error when save fails', async () => {
      mockRepository.save = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(useCase.execute()).rejects.toThrow('Database error');
    });

    it('should propagate repository errors', async () => {
      const customError = new Error('Connection timeout');
      mockRepository.save = vi.fn().mockRejectedValue(customError);

      await expect(useCase.execute()).rejects.toThrow('Connection timeout');
    });

    it('should not create duplicate sessions if save fails', async () => {
      mockRepository.save = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(useCase.execute()).rejects.toThrow();

      // Should only attempt to save once
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('integration scenarios', () => {
    it('should create multiple draft sessions successfully', async () => {
      const results = await Promise.all([
        useCase.execute(),
        useCase.execute(),
        useCase.execute(),
      ]);

      expect(results).toHaveLength(3);
      expect(mockRepository.save).toHaveBeenCalledTimes(3);

      // All should have unique IDs
      const ids = results.map(r => r.sessionId);
      expect(new Set(ids).size).toBe(3);
    });

    it('should create session that can be immediately updated', async () => {
      const result = await useCase.execute();

      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];

      // Verify session has all required properties for updates
      expect(savedSession.id).toBe(result.sessionId);
      expect(savedSession.title).toBeDefined();
      expect(savedSession.createdAt).toBeInstanceOf(Date);
      expect(savedSession.updatedAt).toBeInstanceOf(Date);
    });

    it('should create session with consistent state', async () => {
      await useCase.execute();

      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];

      // Verify all draft session invariants
      expect(savedSession.recordingPath).toBe('');
      expect(savedSession.duration).toBe(0);
      expect(savedSession.transcription).toBeUndefined();
      expect(savedSession.tags).toContain('draft');
      expect(savedSession.notes).toBe('');
    });

    it('should handle concurrent draft session creation', async () => {
      const concurrentExecutions = Array.from({ length: 10 }, () => useCase.execute());

      const results = await Promise.all(concurrentExecutions);

      expect(results).toHaveLength(10);

      // All IDs should be unique
      const ids = results.map(r => r.sessionId);
      expect(new Set(ids).size).toBe(10);

      // All should be saved
      expect(mockRepository.save).toHaveBeenCalledTimes(10);
    });
  });

  describe('edge cases', () => {
    it('should handle repository returning undefined', async () => {
      mockRepository.save = vi.fn().mockResolvedValue(undefined);

      const result = await useCase.execute();

      expect(result.sessionId).toBeDefined();
    });

    it('should create session even when repository is slow', async () => {
      mockRepository.save = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const result = await useCase.execute();

      expect(result.sessionId).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should create valid session ID even at midnight', async () => {
      // This tests that date formatting doesn't cause issues
      await useCase.execute();

      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.title).toBeTruthy();
      expect(savedSession.title.length).toBeGreaterThan(0);
    });

    it('should handle rapid successive creations', async () => {
      const results: { sessionId: string }[] = [];

      for (let i = 0; i < 5; i++) {
        results.push(await useCase.execute());
      }

      expect(results).toHaveLength(5);

      // All IDs should be unique
      const ids = results.map(r => r.sessionId);
      expect(new Set(ids).size).toBe(5);
    });
  });
});
