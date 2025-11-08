import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RestoreSessionUseCase } from './RestoreSessionUseCase';
import { createMockSessionRepository } from '@test/mocks';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import type { DeletedSessionsTracker } from '../../infrastructure/services/DeletedSessionsTracker';

describe('RestoreSessionUseCase', () => {
  let useCase: RestoreSessionUseCase;
  let mockLocalRepository: ISessionRepository;
  let mockRemoteRepository: ISessionRepository;
  let mockDeletedTracker: DeletedSessionsTracker;

  beforeEach(() => {
    mockLocalRepository = createMockSessionRepository();
    mockRemoteRepository = createMockSessionRepository();
    mockDeletedTracker = {
      markAsDeleted: vi.fn().mockResolvedValue(undefined),
      isDeleted: vi.fn().mockResolvedValue(false),
      remove: vi.fn().mockResolvedValue(undefined),
      clearDeleted: vi.fn().mockResolvedValue(undefined),
    } as any;
  });

  describe('execute - restore session', () => {
    it('should restore session successfully', async () => {
      useCase = new RestoreSessionUseCase(mockLocalRepository);

      await useCase.execute('session-123');

      expect(mockLocalRepository.restore).toHaveBeenCalledWith('session-123');
    });

    it('should throw error when restore fails', async () => {
      vi.mocked(mockLocalRepository.restore).mockRejectedValue(
        new Error('Session not found in trash')
      );

      useCase = new RestoreSessionUseCase(mockLocalRepository);

      await expect(useCase.execute('session-123')).rejects.toThrow(
        'Failed to restore session: Session not found in trash'
      );
    });

    it('should handle database errors', async () => {
      vi.mocked(mockLocalRepository.restore).mockRejectedValue(
        new Error('Database connection failed')
      );

      useCase = new RestoreSessionUseCase(mockLocalRepository);

      await expect(useCase.execute('session-123')).rejects.toThrow(
        'Failed to restore session: Database connection failed'
      );
    });
  });

  describe('execute - cloud synchronization', () => {
    it('should restore session in cloud when remote repository provided', async () => {
      useCase = new RestoreSessionUseCase(
        mockLocalRepository,
        mockRemoteRepository
      );

      await useCase.execute('session-123');

      expect(mockLocalRepository.restore).toHaveBeenCalledWith('session-123');
      expect(mockRemoteRepository.restore).toHaveBeenCalledWith('session-123');
    });

    it('should continue when cloud restoration fails', async () => {
      vi.mocked(mockRemoteRepository.restore).mockRejectedValue(
        new Error('Network timeout')
      );

      useCase = new RestoreSessionUseCase(
        mockLocalRepository,
        mockRemoteRepository
      );

      // Should not throw - cloud restoration failure should be logged but not fail operation
      await expect(useCase.execute('session-123')).resolves.toBeUndefined();
      expect(mockLocalRepository.restore).toHaveBeenCalled();
    });

    it('should not attempt cloud restoration when no remote repository provided', async () => {
      useCase = new RestoreSessionUseCase(
        mockLocalRepository,
        undefined // No remote repository
      );

      await useCase.execute('session-123');

      expect(mockLocalRepository.restore).toHaveBeenCalled();
    });
  });

  describe('execute - deleted sessions tracker', () => {
    it('should remove session from deleted tracker', async () => {
      useCase = new RestoreSessionUseCase(
        mockLocalRepository,
        undefined,
        mockDeletedTracker
      );

      await useCase.execute('session-123');

      expect(mockDeletedTracker.remove).toHaveBeenCalledWith('session-123');
    });

    it('should continue when tracker removal fails', async () => {
      vi.mocked(mockDeletedTracker.remove).mockRejectedValue(
        new Error('Tracker error')
      );

      useCase = new RestoreSessionUseCase(
        mockLocalRepository,
        undefined,
        mockDeletedTracker
      );

      // Should not throw - tracker failure should be logged but not fail operation
      await expect(useCase.execute('session-123')).resolves.toBeUndefined();
      expect(mockLocalRepository.restore).toHaveBeenCalled();
    });

    it('should not call tracker when not provided', async () => {
      useCase = new RestoreSessionUseCase(
        mockLocalRepository,
        undefined,
        undefined // No tracker
      );

      await useCase.execute('session-123');

      expect(mockLocalRepository.restore).toHaveBeenCalled();
    });
  });

  describe('executeMultiple - batch restoration', () => {
    it('should restore multiple sessions successfully', async () => {
      useCase = new RestoreSessionUseCase(mockLocalRepository);

      const result = await useCase.executeMultiple(['session-1', 'session-2', 'session-3']);

      expect(result.successful).toEqual(['session-1', 'session-2', 'session-3']);
      expect(result.failed).toEqual([]);
      expect(mockLocalRepository.restore).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in batch restoration', async () => {
      vi.mocked(mockLocalRepository.restore)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Session not found'))
        .mockResolvedValueOnce(undefined);

      useCase = new RestoreSessionUseCase(mockLocalRepository);

      const result = await useCase.executeMultiple(['session-1', 'session-2', 'session-3']);

      expect(result.successful).toEqual(['session-1', 'session-3']);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe('session-2');
      expect(result.failed[0].error).toContain('Session not found');
    });

    it('should handle all failures in batch restoration', async () => {
      vi.mocked(mockLocalRepository.restore).mockRejectedValue(
        new Error('Database error')
      );

      useCase = new RestoreSessionUseCase(mockLocalRepository);

      const result = await useCase.executeMultiple(['session-1', 'session-2', 'session-3']);

      expect(result.successful).toEqual([]);
      expect(result.failed).toHaveLength(3);
    });

    it('should handle empty array', async () => {
      useCase = new RestoreSessionUseCase(mockLocalRepository);

      const result = await useCase.executeMultiple([]);

      expect(result.successful).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(mockLocalRepository.restore).not.toHaveBeenCalled();
    });

    it('should continue batch restoration even if one fails', async () => {
      vi.mocked(mockLocalRepository.restore)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Restore failed'))
        .mockResolvedValueOnce(undefined);

      useCase = new RestoreSessionUseCase(mockLocalRepository);

      const result = await useCase.executeMultiple(['session-1', 'session-2', 'session-3']);

      expect(result.successful).toEqual(['session-1', 'session-3']);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe('session-2');
      expect(result.failed[0].error).toContain('Restore failed');
    });
  });

  describe('edge cases', () => {
    it('should handle very long session ID', async () => {
      const longId = 'session-' + 'a'.repeat(1000);

      useCase = new RestoreSessionUseCase(mockLocalRepository);

      await useCase.execute(longId);

      expect(mockLocalRepository.restore).toHaveBeenCalledWith(longId);
    });

    it('should handle special characters in session ID', async () => {
      const specialId = 'session-特殊-字符-🎉';

      useCase = new RestoreSessionUseCase(mockLocalRepository);

      await useCase.execute(specialId);

      expect(mockLocalRepository.restore).toHaveBeenCalledWith(specialId);
    });

    it('should handle UUID format session IDs', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';

      useCase = new RestoreSessionUseCase(mockLocalRepository);

      await useCase.execute(uuid);

      expect(mockLocalRepository.restore).toHaveBeenCalledWith(uuid);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete cloud-synced session restoration', async () => {
      useCase = new RestoreSessionUseCase(
        mockLocalRepository,
        mockRemoteRepository,
        mockDeletedTracker
      );

      await useCase.execute('session-123');

      // Should restore locally, in cloud, and remove from tracker
      expect(mockLocalRepository.restore).toHaveBeenCalledWith('session-123');
      expect(mockRemoteRepository.restore).toHaveBeenCalledWith('session-123');
      expect(mockDeletedTracker.remove).toHaveBeenCalledWith('session-123');
    });

    it('should handle local-only session restoration', async () => {
      useCase = new RestoreSessionUseCase(
        mockLocalRepository,
        undefined,
        mockDeletedTracker
      );

      await useCase.execute('session-123');

      // Should only restore locally and remove from tracker
      expect(mockLocalRepository.restore).toHaveBeenCalledWith('session-123');
      expect(mockDeletedTracker.remove).toHaveBeenCalledWith('session-123');
    });

    it('should handle restoration with cloud failure but tracker success', async () => {
      vi.mocked(mockRemoteRepository.restore).mockRejectedValue(
        new Error('Cloud error')
      );

      useCase = new RestoreSessionUseCase(
        mockLocalRepository,
        mockRemoteRepository,
        mockDeletedTracker
      );

      await useCase.execute('session-123');

      // Should continue despite cloud failure
      expect(mockLocalRepository.restore).toHaveBeenCalled();
      expect(mockDeletedTracker.remove).toHaveBeenCalled();
    });

    it('should handle restoration with tracker failure but restore success', async () => {
      vi.mocked(mockDeletedTracker.remove).mockRejectedValue(
        new Error('Tracker error')
      );

      useCase = new RestoreSessionUseCase(
        mockLocalRepository,
        mockRemoteRepository,
        mockDeletedTracker
      );

      await useCase.execute('session-123');

      // Should continue despite tracker failure
      expect(mockLocalRepository.restore).toHaveBeenCalled();
      expect(mockRemoteRepository.restore).toHaveBeenCalled();
    });

    it('should handle batch restoration with mixed success/failure', async () => {
      vi.mocked(mockLocalRepository.restore)
        .mockResolvedValueOnce(undefined) // session-1 success
        .mockRejectedValueOnce(new Error('Not in trash')) // session-2 fail
        .mockResolvedValueOnce(undefined) // session-3 success
        .mockRejectedValueOnce(new Error('Database error')) // session-4 fail
        .mockResolvedValueOnce(undefined); // session-5 success

      useCase = new RestoreSessionUseCase(
        mockLocalRepository,
        mockRemoteRepository,
        mockDeletedTracker
      );

      const result = await useCase.executeMultiple([
        'session-1',
        'session-2',
        'session-3',
        'session-4',
        'session-5'
      ]);

      expect(result.successful).toEqual(['session-1', 'session-3', 'session-5']);
      expect(result.failed).toHaveLength(2);
      expect(result.failed[0].id).toBe('session-2');
      expect(result.failed[1].id).toBe('session-4');
    });

    it('should remove all successful restorations from tracker in batch operation', async () => {
      useCase = new RestoreSessionUseCase(
        mockLocalRepository,
        mockRemoteRepository,
        mockDeletedTracker
      );

      await useCase.executeMultiple(['session-1', 'session-2', 'session-3']);

      // Tracker remove should be called for each successful restoration
      expect(mockDeletedTracker.remove).toHaveBeenCalledTimes(3);
      expect(mockDeletedTracker.remove).toHaveBeenCalledWith('session-1');
      expect(mockDeletedTracker.remove).toHaveBeenCalledWith('session-2');
      expect(mockDeletedTracker.remove).toHaveBeenCalledWith('session-3');
    });
  });
});
