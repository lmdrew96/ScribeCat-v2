import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermanentlyDeleteSessionUseCase } from './PermanentlyDeleteSessionUseCase';
import { createMockSessionRepository, createMockAudioRepository } from '@test/mocks';
import { createSampleSession } from '@test/fixtures';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import type { IAudioRepository } from '../../domain/repositories/IAudioRepository';

describe('PermanentlyDeleteSessionUseCase', () => {
  let useCase: PermanentlyDeleteSessionUseCase;
  let mockSessionRepository: ISessionRepository;
  let mockAudioRepository: IAudioRepository;
  let mockRemoteRepository: ISessionRepository;

  beforeEach(() => {
    mockSessionRepository = createMockSessionRepository();
    mockAudioRepository = createMockAudioRepository();
    mockRemoteRepository = createMockSessionRepository();
  });

  describe('execute - permanent deletion', () => {
    it('should permanently delete session and audio file', async () => {
      const session = createSampleSession({
        id: 'session-123',
        audioFilePath: '/recordings/test.webm'
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await useCase.execute('session-123');

      expect(mockAudioRepository.deleteAudio).toHaveBeenCalledWith('/recordings/test.webm');
      expect(mockSessionRepository.permanentlyDelete).toHaveBeenCalledWith('session-123');
    });

    it('should delete session even if audio file deletion fails', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);
      vi.mocked(mockAudioRepository.deleteAudio).mockRejectedValue(
        new Error('File not found')
      );

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await useCase.execute('session-123');

      expect(mockSessionRepository.permanentlyDelete).toHaveBeenCalledWith('session-123');
    });

    it('should delete session even if session cannot be loaded', async () => {
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(null);

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await useCase.execute('session-123');

      expect(mockAudioRepository.deleteAudio).not.toHaveBeenCalled();
      expect(mockSessionRepository.permanentlyDelete).toHaveBeenCalledWith('session-123');
    });

    it('should throw error when permanentlyDelete fails', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);
      vi.mocked(mockSessionRepository.permanentlyDelete).mockRejectedValue(
        new Error('Database error')
      );

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await expect(useCase.execute('session-123')).rejects.toThrow(
        'Failed to permanently delete session: Database error'
      );
    });

    it('should not delete exported files', async () => {
      const session = createSampleSession({
        id: 'session-123',
        exportHistory: [
          { format: 'pdf', path: '/exports/session.pdf', exportedAt: new Date() },
          { format: 'docx', path: '/exports/session.docx', exportedAt: new Date() }
        ]
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await useCase.execute('session-123');

      // Only audio file should be deleted, not exported files
      expect(mockAudioRepository.deleteAudio).toHaveBeenCalledTimes(1);
      expect(mockAudioRepository.deleteAudio).toHaveBeenCalledWith(session.recordingPath);
    });
  });

  describe('execute - cloud synchronization', () => {
    it('should delete from cloud when session has cloudId', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456'
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository,
        mockRemoteRepository
      );

      await useCase.execute('session-123');

      expect(mockRemoteRepository.permanentlyDelete).toHaveBeenCalledWith('session-123');
    });

    it('should not delete from cloud when session has no cloudId', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: undefined
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository,
        mockRemoteRepository
      );

      await useCase.execute('session-123');

      expect(mockRemoteRepository.permanentlyDelete).not.toHaveBeenCalled();
    });

    it('should continue when cloud deletion fails', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456'
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);
      vi.mocked(mockRemoteRepository.permanentlyDelete).mockRejectedValue(
        new Error('Network timeout')
      );

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository,
        mockRemoteRepository
      );

      // Should not throw - cloud deletion failure should be logged but not fail operation
      await expect(useCase.execute('session-123')).resolves.toBeUndefined();
      expect(mockSessionRepository.permanentlyDelete).toHaveBeenCalled();
    });

    it('should not attempt cloud deletion when no remote repository provided', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456'
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository,
        undefined // No remote repository
      );

      await useCase.execute('session-123');

      expect(mockSessionRepository.permanentlyDelete).toHaveBeenCalled();
    });
  });

  describe('executeMultiple - batch permanent deletion', () => {
    it('should permanently delete multiple sessions successfully', async () => {
      const session1 = createSampleSession({ id: 'session-1' });
      const session2 = createSampleSession({ id: 'session-2' });
      const session3 = createSampleSession({ id: 'session-3' });

      vi.mocked(mockSessionRepository.findById)
        .mockResolvedValueOnce(session1)
        .mockResolvedValueOnce(session2)
        .mockResolvedValueOnce(session3);

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      const result = await useCase.executeMultiple(['session-1', 'session-2', 'session-3']);

      expect(result.successful).toEqual(['session-1', 'session-2', 'session-3']);
      expect(result.failed).toEqual([]);
      expect(mockSessionRepository.permanentlyDelete).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in batch deletion', async () => {
      const session1 = createSampleSession({ id: 'session-1' });
      const session3 = createSampleSession({ id: 'session-3' });

      vi.mocked(mockSessionRepository.findById)
        .mockResolvedValueOnce(session1)
        .mockResolvedValueOnce(null) // session-2
        .mockResolvedValueOnce(session3);

      vi.mocked(mockSessionRepository.permanentlyDelete)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Deletion failed'))
        .mockResolvedValueOnce(undefined);

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      const result = await useCase.executeMultiple(['session-1', 'session-2', 'session-3']);

      expect(result.successful).toEqual(['session-1', 'session-3']);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe('session-2');
    });

    it('should handle all failures in batch deletion', async () => {
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(null);
      vi.mocked(mockSessionRepository.permanentlyDelete).mockRejectedValue(
        new Error('Database error')
      );

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      const result = await useCase.executeMultiple(['session-1', 'session-2', 'session-3']);

      expect(result.successful).toEqual([]);
      expect(result.failed).toHaveLength(3);
    });

    it('should handle empty array', async () => {
      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      const result = await useCase.executeMultiple([]);

      expect(result.successful).toEqual([]);
      expect(result.failed).toEqual([]);
    });

    it('should continue batch deletion even if one fails', async () => {
      const sessions = [
        createSampleSession({ id: 'session-1' }),
        createSampleSession({ id: 'session-2' }),
        createSampleSession({ id: 'session-3' })
      ];

      vi.mocked(mockSessionRepository.findById)
        .mockResolvedValueOnce(sessions[0])
        .mockResolvedValueOnce(sessions[1])
        .mockResolvedValueOnce(sessions[2]);

      vi.mocked(mockSessionRepository.permanentlyDelete)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      const result = await useCase.executeMultiple(['session-1', 'session-2', 'session-3']);

      expect(result.successful).toEqual(['session-1', 'session-3']);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe('session-2');
    });
  });

  describe('edge cases', () => {
    it('should handle session with special audio file path', async () => {
      const session = createSampleSession({
        id: 'session-123',
        audioFilePath: '/recordings/special-名前-🎵.webm'
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await useCase.execute('session-123');

      expect(mockAudioRepository.deleteAudio).toHaveBeenCalledWith('/recordings/special-名前-🎵.webm');
    });

    it('should handle very long session ID', async () => {
      const longId = 'session-' + 'a'.repeat(1000);
      const session = createSampleSession({ id: longId });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await useCase.execute(longId);

      expect(mockSessionRepository.permanentlyDelete).toHaveBeenCalledWith(longId);
    });

    it('should handle session with missing audio file path', async () => {
      const session = createSampleSession({
        id: 'session-123',
        audioFilePath: ''
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await useCase.execute('session-123');

      expect(mockAudioRepository.deleteAudio).toHaveBeenCalledWith('');
      expect(mockSessionRepository.permanentlyDelete).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete cloud-synced session permanent deletion', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456',
        userId: 'user-789',
        audioFilePath: '/recordings/session-123.webm'
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository,
        mockRemoteRepository
      );

      await useCase.execute('session-123');

      // Should delete audio, local session, and remote session
      expect(mockAudioRepository.deleteAudio).toHaveBeenCalledWith('/recordings/session-123.webm');
      expect(mockSessionRepository.permanentlyDelete).toHaveBeenCalledWith('session-123');
      expect(mockRemoteRepository.permanentlyDelete).toHaveBeenCalledWith('session-123');
    });

    it('should handle local-only session permanent deletion', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: undefined,
        userId: undefined,
        audioFilePath: '/recordings/local-session.webm'
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository,
        mockRemoteRepository
      );

      await useCase.execute('session-123');

      // Should only delete audio and local session
      expect(mockAudioRepository.deleteAudio).toHaveBeenCalledWith('/recordings/local-session.webm');
      expect(mockSessionRepository.permanentlyDelete).toHaveBeenCalledWith('session-123');
      expect(mockRemoteRepository.permanentlyDelete).not.toHaveBeenCalled();
    });

    it('should preserve exported files during deletion', async () => {
      const session = createSampleSession({
        id: 'session-123',
        audioFilePath: '/recordings/session.webm',
        exportHistory: [
          { format: 'pdf', path: '/exports/session-123.pdf', exportedAt: new Date() },
          { format: 'docx', path: '/exports/session-123.docx', exportedAt: new Date() },
          { format: 'txt', path: '/exports/session-123.txt', exportedAt: new Date() }
        ]
      });
      vi.mocked(mockSessionRepository.findById).mockResolvedValue(session);

      useCase = new PermanentlyDeleteSessionUseCase(
        mockSessionRepository,
        mockAudioRepository
      );

      await useCase.execute('session-123');

      // Only audio should be deleted
      expect(mockAudioRepository.deleteAudio).toHaveBeenCalledTimes(1);
      expect(mockAudioRepository.deleteAudio).toHaveBeenCalledWith('/recordings/session.webm');
    });
  });
});
