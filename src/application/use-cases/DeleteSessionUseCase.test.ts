import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeleteSessionUseCase } from './DeleteSessionUseCase';
import { createMockSessionRepository, createMockAudioRepository } from '@test/mocks';
import { createSampleSession } from '@test/fixtures';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import type { IAudioRepository } from '../../domain/repositories/IAudioRepository';
import type { DeletedSessionsTracker } from '../../infrastructure/services/DeletedSessionsTracker';

describe('DeleteSessionUseCase', () => {
  let useCase: DeleteSessionUseCase;
  let mockSessionRepository: ISessionRepository;
  let mockAudioRepository: IAudioRepository;
  let mockRemoteRepository: ISessionRepository;
  let mockDeletedTracker: DeletedSessionsTracker;

  beforeEach(() => {
    mockSessionRepository = createMockSessionRepository();
    mockAudioRepository = createMockAudioRepository();
    mockRemoteRepository = createMockSessionRepository();
    mockDeletedTracker = {
      markAsDeleted: vi.fn().mockResolvedValue(undefined),
      isDeleted: vi.fn().mockResolvedValue(false),
      clearDeleted: vi.fn().mockResolvedValue(undefined),
    } as any;
  });

  describe('execute - single session deletion', () => {
    it('should soft delete a session successfully', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await useCase.execute('session-123');

      expect(mockSessionRepository.findById).toHaveBeenCalledWith('session-123');
      expect(mockSessionRepository.delete).toHaveBeenCalledWith('session-123');
    });

    it('should throw error when session not found', async () => {
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(null);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await expect(useCase.execute('non-existent'))
        .rejects.toThrow('Session with ID non-existent not found');

      expect(mockSessionRepository.delete).not.toHaveBeenCalled();
    });

    it('should not delete audio files during soft delete', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await useCase.execute('session-123');

      // Audio repository should not be called during soft delete
      expect(mockAudioRepository.deleteAudio).not.toHaveBeenCalled();
    });

    it('should handle repository delete failure', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);
      vi.mocked(mockSessionRepository.delete).mockRejectedValue(
        new Error('Database connection failed')
      );

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await expect(useCase.execute('session-123'))
        .rejects.toThrow('Failed to delete session: Database connection failed');
    });
  });

  describe('execute - cloud synchronization', () => {
    it('should delete from cloud when session has cloudId', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-id-456',
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository,
        mockRemoteRepository,
        mockDeletedTracker
      );

      await useCase.execute('session-123');

      expect(mockRemoteRepository.delete).toHaveBeenCalledWith('session-123');
      expect(mockDeletedTracker.markAsDeleted).toHaveBeenCalledWith('session-123');
    });

    it('should not delete from cloud when session has no cloudId', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: undefined,
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository,
        mockRemoteRepository,
        mockDeletedTracker
      );

      await useCase.execute('session-123');

      expect(mockRemoteRepository.delete).not.toHaveBeenCalled();
    });

    it('should continue when cloud deletion fails', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-id-456',
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);
      vi.mocked(mockRemoteRepository.delete).mockRejectedValue(
        new Error('Network timeout')
      );

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository,
        mockRemoteRepository,
        mockDeletedTracker
      );

      // Should not throw - cloud deletion failure should be logged but not fail the operation
      await expect(useCase.execute('session-123')).resolves.toBeUndefined();

      expect(mockSessionRepository.delete).toHaveBeenCalled();
      expect(mockDeletedTracker.markAsDeleted).toHaveBeenCalled();
    });

    it('should not attempt cloud deletion when no remote repository provided', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-id-456',
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository,
        undefined, // No remote repository
        mockDeletedTracker
      );

      await useCase.execute('session-123');

      expect(mockSessionRepository.delete).toHaveBeenCalled();
    });
  });

  describe('execute - deleted sessions tracker', () => {
    it('should mark session as deleted in tracker', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-id-456',
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository,
        mockRemoteRepository,
        mockDeletedTracker
      );

      await useCase.execute('session-123');

      expect(mockDeletedTracker.markAsDeleted).toHaveBeenCalledWith('session-123');
    });

    it('should continue when tracker marking fails', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);
      vi.mocked(mockDeletedTracker.markAsDeleted).mockRejectedValue(
        new Error('Tracker error')
      );

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository,
        mockRemoteRepository,
        mockDeletedTracker
      );

      // Should not throw - tracker failure should be logged but not fail the operation
      await expect(useCase.execute('session-123')).resolves.toBeUndefined();

      expect(mockSessionRepository.delete).toHaveBeenCalled();
    });

    it('should not call tracker when not provided', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository,
        undefined,
        undefined // No tracker
      );

      await useCase.execute('session-123');

      expect(mockSessionRepository.delete).toHaveBeenCalled();
    });
  });

  describe('executeMultiple - batch deletion', () => {
    it('should delete multiple sessions successfully', async () => {
      const session1 = createSampleSession({ id: 'session-1' });
      const session2 = createSampleSession({ id: 'session-2' });
      const session3 = createSampleSession({ id: 'session-3' });

      vi.mocked(mockSessionRepository.findById)
        .mockResolvedValueOnce(session1)
        .mockResolvedValueOnce(session2)
        .mockResolvedValueOnce(session3);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      const result = await useCase.executeMultiple(['session-1', 'session-2', 'session-3']);

      expect(result.successful).toEqual(['session-1', 'session-2', 'session-3']);
      expect(result.failed).toEqual([]);
      expect(mockSessionRepository.delete).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in batch deletion', async () => {
      const session1 = createSampleSession({ id: 'session-1' });
      const session3 = createSampleSession({ id: 'session-3' });

      vi.mocked(mockSessionRepository.findById)
        .mockResolvedValueOnce(session1)
        .mockResolvedValueOnce(null) // session-2 not found
        .mockResolvedValueOnce(session3);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      const result = await useCase.executeMultiple(['session-1', 'session-2', 'session-3']);

      expect(result.successful).toEqual(['session-1', 'session-3']);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe('session-2');
      expect(result.failed[0].error).toContain('not found');
    });

    it('should handle all failures in batch deletion', async () => {
      vi.mocked(mockSessionRepository.findById)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      const result = await useCase.executeMultiple(['session-1', 'session-2', 'session-3']);

      expect(result.successful).toEqual([]);
      expect(result.failed).toHaveLength(3);
      expect(mockSessionRepository.delete).not.toHaveBeenCalled();
    });

    it('should handle empty array', async () => {
      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      const result = await useCase.executeMultiple([]);

      expect(result.successful).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(mockSessionRepository.delete).not.toHaveBeenCalled();
    });

    it('should continue batch deletion even if one fails', async () => {
      const session1 = createSampleSession({ id: 'session-1' });
      const session2 = createSampleSession({ id: 'session-2' });
      const session3 = createSampleSession({ id: 'session-3' });

      vi.mocked(mockSessionRepository.findById)
        .mockResolvedValueOnce(session1)
        .mockResolvedValueOnce(session2)
        .mockResolvedValueOnce(session3);

      vi.mocked(mockSessionRepository.delete)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce(undefined);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      const result = await useCase.executeMultiple(['session-1', 'session-2', 'session-3']);

      expect(result.successful).toEqual(['session-1', 'session-3']);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe('session-2');
      expect(result.failed[0].error).toContain('Database error');
    });
  });

  describe('edge cases', () => {
    it('should handle session with missing properties', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: undefined,
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await expect(useCase.execute('session-123')).resolves.toBeUndefined();
    });

    it('should handle very long session IDs', async () => {
      const longId = 'a'.repeat(1000);
      const session = createSampleSession({ id: longId });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await useCase.execute(longId);

      expect(mockSessionRepository.findById).toHaveBeenCalledWith(longId);
      expect(mockSessionRepository.delete).toHaveBeenCalledWith(longId);
    });

    it('should handle special characters in session ID', async () => {
      const specialId = 'session-with-特殊字符-emoji-🎉';
      const session = createSampleSession({ id: specialId });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await useCase.execute(specialId);

      expect(mockSessionRepository.delete).toHaveBeenCalledWith(specialId);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete cloud-synced session deletion', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-id-456',
        userId: 'user-789',
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository,
        mockRemoteRepository,
        mockDeletedTracker
      );

      await useCase.execute('session-123');

      // Should delete from both local and remote
      expect(mockSessionRepository.delete).toHaveBeenCalledWith('session-123');
      expect(mockRemoteRepository.delete).toHaveBeenCalledWith('session-123');
      expect(mockDeletedTracker.markAsDeleted).toHaveBeenCalledWith('session-123');
    });

    it('should handle local-only session deletion', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: undefined,
        userId: undefined,
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new DeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository,
        mockRemoteRepository,
        mockDeletedTracker
      );

      await useCase.execute('session-123');

      // Should only delete locally
      expect(mockSessionRepository.delete).toHaveBeenCalledWith('session-123');
      expect(mockRemoteRepository.delete).not.toHaveBeenCalled();
      expect(mockDeletedTracker.markAsDeleted).toHaveBeenCalledWith('session-123');
    });
  });
});
