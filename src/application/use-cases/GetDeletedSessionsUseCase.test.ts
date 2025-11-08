import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetDeletedSessionsUseCase } from './GetDeletedSessionsUseCase';
import { createMockSessionRepository } from '@test/mocks';
import { createSampleSession } from '@test/fixtures';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';

describe('GetDeletedSessionsUseCase', () => {
  let useCase: GetDeletedSessionsUseCase;
  let mockLocalRepository: ISessionRepository;
  let mockRemoteRepository: ISessionRepository;

  beforeEach(() => {
    mockLocalRepository = createMockSessionRepository();
    mockRemoteRepository = createMockSessionRepository();
  });

  describe('execute - local only', () => {
    it('should get deleted sessions from local repository', async () => {
      const deletedSessions = [
        createSampleSession({ id: 'session-1', deletedAt: new Date('2025-01-15') }),
        createSampleSession({ id: 'session-2', deletedAt: new Date('2025-01-14') }),
      ];
      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue(deletedSessions);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository);

      const result = await useCase.execute();

      expect(result).toHaveLength(2);
      expect(mockLocalRepository.findDeleted).toHaveBeenCalledWith(undefined);
    });

    it('should return empty array when no deleted sessions exist', async () => {
      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue([]);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository);

      const result = await useCase.execute();

      expect(result).toEqual([]);
    });

    it('should pass userId to repository when provided', async () => {
      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue([]);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository);

      await useCase.execute('user-123');

      expect(mockLocalRepository.findDeleted).toHaveBeenCalledWith('user-123');
    });

    it('should return all deleted sessions', async () => {
      const deletedSessions = [
        createSampleSession({ id: 'session-1', deletedAt: new Date('2025-01-10') }),
        createSampleSession({ id: 'session-2', deletedAt: new Date('2025-01-15') }),
        createSampleSession({ id: 'session-3', deletedAt: new Date('2025-01-12') }),
      ];
      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue(deletedSessions);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository);

      const result = await useCase.execute();

      expect(result).toHaveLength(3);
      expect(result.some(s => s.id === 'session-1')).toBe(true);
      expect(result.some(s => s.id === 'session-2')).toBe(true);
      expect(result.some(s => s.id === 'session-3')).toBe(true);
    });

    it('should handle sessions without deletedAt', async () => {
      const deletedSessions = [
        createSampleSession({ id: 'session-1', deletedAt: new Date('2025-01-15') }),
        createSampleSession({ id: 'session-2', deletedAt: undefined }),
        createSampleSession({ id: 'session-3', deletedAt: new Date('2025-01-10') }),
      ];
      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue(deletedSessions);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository);

      const result = await useCase.execute();

      expect(result).toHaveLength(3);
      // Sessions with deletedAt should be sorted, session without deletedAt can be anywhere
      expect(result[0].deletedAt).toBeDefined();
    });
  });

  describe('execute - with remote repository', () => {
    it('should merge sessions from local and remote repositories', async () => {
      const localSessions = [
        createSampleSession({ id: 'session-1', deletedAt: new Date('2025-01-15') }),
        createSampleSession({ id: 'session-2', deletedAt: new Date('2025-01-14') }),
      ];
      const remoteSessions = [
        createSampleSession({ id: 'session-3', deletedAt: new Date('2025-01-13') }),
        createSampleSession({ id: 'session-4', deletedAt: new Date('2025-01-12') }),
      ];

      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue(localSessions);
      mockRemoteRepository.findDeleted = vi.fn().mockResolvedValue(remoteSessions);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository, mockRemoteRepository);

      const result = await useCase.execute();

      expect(result).toHaveLength(4);
      expect(mockLocalRepository.findDeleted).toHaveBeenCalled();
      expect(mockRemoteRepository.findDeleted).toHaveBeenCalled();
    });

    it('should prefer remote version when session exists in both repositories', async () => {
      const localSession = createSampleSession({
        id: 'session-1',
        title: 'Local Version',
        deletedAt: new Date('2025-01-15'),
      });
      const remoteSession = createSampleSession({
        id: 'session-1',
        title: 'Remote Version',
        deletedAt: new Date('2025-01-15'),
      });

      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue([localSession]);
      mockRemoteRepository.findDeleted = vi.fn().mockResolvedValue([remoteSession]);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository, mockRemoteRepository);

      const result = await useCase.execute();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Remote Version');
    });

    it('should continue when remote repository fails', async () => {
      const localSessions = [
        createSampleSession({ id: 'session-1', deletedAt: new Date('2025-01-15') }),
      ];
      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue(localSessions);
      mockRemoteRepository.findDeleted = vi.fn().mockRejectedValue(
        new Error('Network timeout')
      );

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository, mockRemoteRepository);

      const result = await useCase.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-1');
    });

    it('should merge sessions from both repositories', async () => {
      const localSessions = [
        createSampleSession({ id: 'session-1', deletedAt: new Date('2025-01-10') }),
        createSampleSession({ id: 'session-2', deletedAt: new Date('2025-01-15') }),
      ];
      const remoteSessions = [
        createSampleSession({ id: 'session-3', deletedAt: new Date('2025-01-12') }),
        createSampleSession({ id: 'session-4', deletedAt: new Date('2025-01-18') }),
      ];

      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue(localSessions);
      mockRemoteRepository.findDeleted = vi.fn().mockResolvedValue(remoteSessions);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository, mockRemoteRepository);

      const result = await useCase.execute();

      expect(result).toHaveLength(4);
      expect(result.some(s => s.id === 'session-1')).toBe(true);
      expect(result.some(s => s.id === 'session-2')).toBe(true);
      expect(result.some(s => s.id === 'session-3')).toBe(true);
      expect(result.some(s => s.id === 'session-4')).toBe(true);
    });

    it('should pass userId to both repositories', async () => {
      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue([]);
      mockRemoteRepository.findDeleted = vi.fn().mockResolvedValue([]);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository, mockRemoteRepository);

      await useCase.execute('user-456');

      expect(mockLocalRepository.findDeleted).toHaveBeenCalledWith('user-456');
      expect(mockRemoteRepository.findDeleted).toHaveBeenCalledWith('user-456');
    });
  });

  describe('execute - error handling', () => {
    it('should throw error when local repository fails', async () => {
      mockLocalRepository.findDeleted = vi.fn().mockRejectedValue(
        new Error('Database error')
      );

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository);

      await expect(useCase.execute()).rejects.toThrow(
        'Failed to get deleted sessions: Database error'
      );
    });

    it('should handle non-Error exceptions from local repository', async () => {
      mockLocalRepository.findDeleted = vi.fn().mockRejectedValue('String error');

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository);

      await expect(useCase.execute()).rejects.toThrow(
        'Failed to get deleted sessions: Unknown error'
      );
    });

    it('should log warning when remote repository fails but continue', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const localSessions = [createSampleSession({ id: 'session-1' })];
      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue(localSessions);
      mockRemoteRepository.findDeleted = vi.fn().mockRejectedValue(
        new Error('Cloud error')
      );

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository, mockRemoteRepository);

      const result = await useCase.execute();

      expect(result).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch deleted sessions from cloud')
      );

      consoleSpy.mockRestore();
    });

    it('should handle non-Error exceptions from remote repository', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const localSessions = [createSampleSession({ id: 'session-1' })];
      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue(localSessions);
      mockRemoteRepository.findDeleted = vi.fn().mockRejectedValue('String error');

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository, mockRemoteRepository);

      const result = await useCase.execute();

      expect(result).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown error')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle large number of deleted sessions', async () => {
      const deletedSessions = Array.from({ length: 100 }, (_, i) =>
        createSampleSession({
          id: `session-${i}`,
          deletedAt: new Date(2025, 0, i + 1),
        })
      );
      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue(deletedSessions);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository);

      const result = await useCase.execute();

      expect(result).toHaveLength(100);
      expect(result[0].id).toBeDefined();
      expect(result[99].id).toBeDefined();
    });

    it('should deduplicate when same session exists in both repos', async () => {
      const sessionId = 'duplicate-session';
      const localSession = createSampleSession({ id: sessionId, title: 'Local' });
      const remoteSession = createSampleSession({ id: sessionId, title: 'Remote' });

      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue([localSession]);
      mockRemoteRepository.findDeleted = vi.fn().mockResolvedValue([remoteSession]);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository, mockRemoteRepository);

      const result = await useCase.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(sessionId);
    });

    it('should handle sessions with same deletion timestamp', async () => {
      const sameDate = new Date('2025-01-15T12:00:00Z');
      const deletedSessions = [
        createSampleSession({ id: 'session-1', deletedAt: sameDate }),
        createSampleSession({ id: 'session-2', deletedAt: sameDate }),
        createSampleSession({ id: 'session-3', deletedAt: sameDate }),
      ];
      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue(deletedSessions);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository);

      const result = await useCase.execute();

      expect(result).toHaveLength(3);
      expect(result.some(s => s.id === 'session-1')).toBe(true);
      expect(result.some(s => s.id === 'session-2')).toBe(true);
      expect(result.some(s => s.id === 'session-3')).toBe(true);
    });

    it('should handle mixed local and remote sessions with duplicates', async () => {
      const localSessions = [
        createSampleSession({ id: 'session-1', title: 'Local 1', deletedAt: new Date('2025-01-15') }),
        createSampleSession({ id: 'session-2', title: 'Local 2', deletedAt: new Date('2025-01-14') }),
        createSampleSession({ id: 'session-3', title: 'Local 3', deletedAt: new Date('2025-01-13') }),
      ];
      const remoteSessions = [
        createSampleSession({ id: 'session-2', title: 'Remote 2', deletedAt: new Date('2025-01-14') }), // Duplicate
        createSampleSession({ id: 'session-4', title: 'Remote 4', deletedAt: new Date('2025-01-12') }),
      ];

      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue(localSessions);
      mockRemoteRepository.findDeleted = vi.fn().mockResolvedValue(remoteSessions);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository, mockRemoteRepository);

      const result = await useCase.execute();

      expect(result).toHaveLength(4); // 3 local + 1 remote (session-2 is duplicate)
      expect(result.find(s => s.id === 'session-2')?.title).toBe('Remote 2'); // Remote version preferred
    });
  });

  describe('integration scenarios', () => {
    it('should get deleted sessions for specific user', async () => {
      const userSessions = [
        createSampleSession({ id: 'session-1', userId: 'user-123', deletedAt: new Date('2025-01-15') }),
        createSampleSession({ id: 'session-2', userId: 'user-123', deletedAt: new Date('2025-01-14') }),
      ];
      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue(userSessions);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository);

      const result = await useCase.execute('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user-123');
      expect(result[1].userId).toBe('user-123');
    });

    it('should handle cloud-synced deleted sessions', async () => {
      const localSessions = [
        createSampleSession({
          id: 'session-1',
          cloudId: 'cloud-1',
          deletedAt: new Date('2025-01-15'),
        }),
      ];
      const remoteSessions = [
        createSampleSession({
          id: 'session-1',
          cloudId: 'cloud-1',
          deletedAt: new Date('2025-01-15'),
        }),
      ];

      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue(localSessions);
      mockRemoteRepository.findDeleted = vi.fn().mockResolvedValue(remoteSessions);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository, mockRemoteRepository);

      const result = await useCase.execute();

      expect(result).toHaveLength(1);
      expect(result[0].cloudId).toBe('cloud-1');
    });

    it('should work with no remote repository configured', async () => {
      const localSessions = [
        createSampleSession({ id: 'session-1', deletedAt: new Date('2025-01-15') }),
      ];
      mockLocalRepository.findDeleted = vi.fn().mockResolvedValue(localSessions);

      useCase = new GetDeletedSessionsUseCase(mockLocalRepository, undefined);

      const result = await useCase.execute();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-1');
    });
  });
});
