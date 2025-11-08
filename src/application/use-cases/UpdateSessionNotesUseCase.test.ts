import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateSessionNotesUseCase } from './UpdateSessionNotesUseCase';
import { createMockSessionRepository } from '@test/mocks';
import { createSampleSession } from '@test/fixtures';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';

describe('UpdateSessionNotesUseCase', () => {
  let useCase: UpdateSessionNotesUseCase;
  let mockLocalRepository: ISessionRepository;
  let mockCloudRepository: ISessionRepository;

  beforeEach(() => {
    mockLocalRepository = createMockSessionRepository();
    mockCloudRepository = createMockSessionRepository();

    // Suppress console logs in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('execute - local sessions', () => {
    it('should update notes for local session', async () => {
      const session = createSampleSession({
        id: 'session-123',
        notes: '<p>Old notes</p>',
        cloudId: undefined,
      });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository);

      const result = await useCase.execute('session-123', '<p>New notes</p>');

      expect(result).toBe(true);
      expect(mockLocalRepository.update).toHaveBeenCalled();
      const updatedSession = vi.mocked(mockLocalRepository.update).mock.calls[0][0];
      expect(updatedSession.notes).toBe('<p>New notes</p>');
    });

    it('should update notes with HTML content', async () => {
      const session = createSampleSession({
        id: 'session-123',
        notes: '<p>Old notes</p>',
      });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository);

      const htmlNotes = '<h1>Title</h1><p>Paragraph with <strong>bold</strong> and <em>italic</em></p>';
      const result = await useCase.execute('session-123', htmlNotes);

      expect(result).toBe(true);
      const updatedSession = vi.mocked(mockLocalRepository.update).mock.calls[0][0];
      expect(updatedSession.notes).toBe(htmlNotes);
    });

    it('should update notes to empty string', async () => {
      const session = createSampleSession({
        id: 'session-123',
        notes: '<p>Old notes</p>',
      });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository);

      const result = await useCase.execute('session-123', '');

      expect(result).toBe(true);
      const updatedSession = vi.mocked(mockLocalRepository.update).mock.calls[0][0];
      expect(updatedSession.notes).toBe('');
    });

    it('should update updatedAt timestamp', async () => {
      const oldDate = new Date('2025-01-01');
      const session = createSampleSession({
        id: 'session-123',
        updatedAt: oldDate,
      });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository);

      await useCase.execute('session-123', '<p>New notes</p>');

      const updatedSession = vi.mocked(mockLocalRepository.update).mock.calls[0][0];
      expect(updatedSession.updatedAt.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it('should return false when session not found locally', async () => {
      mockLocalRepository.findById = vi.fn().mockResolvedValue(null);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository);

      const result = await useCase.execute('non-existent', '<p>Notes</p>');

      expect(result).toBe(false);
      expect(mockLocalRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('execute - cloud sessions', () => {
    it('should update notes for cloud session', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456',
        userId: 'user-789',
        notes: '<p>Old notes</p>',
      });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository, mockCloudRepository);

      const result = await useCase.execute('session-123', '<p>New cloud notes</p>');

      expect(result).toBe(true);
      expect(mockCloudRepository.update).toHaveBeenCalled();
      expect(mockLocalRepository.update).not.toHaveBeenCalled();
      const updatedSession = vi.mocked(mockCloudRepository.update).mock.calls[0][0];
      expect(updatedSession.notes).toBe('<p>New cloud notes</p>');
    });

    it('should search cloud repository when not found locally', async () => {
      const cloudSession = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456',
        userId: 'user-789',
      });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(null);
      mockCloudRepository.findById = vi.fn().mockResolvedValue(cloudSession);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository, mockCloudRepository);

      const result = await useCase.execute('session-123', '<p>Cloud notes</p>');

      expect(result).toBe(true);
      expect(mockLocalRepository.findById).toHaveBeenCalled();
      expect(mockCloudRepository.findById).toHaveBeenCalled();
      expect(mockCloudRepository.update).toHaveBeenCalled();
    });

    it('should return false when session not found in either repository', async () => {
      mockLocalRepository.findById = vi.fn().mockResolvedValue(null);
      mockCloudRepository.findById = vi.fn().mockResolvedValue(null);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository, mockCloudRepository);

      const result = await useCase.execute('non-existent', '<p>Notes</p>');

      expect(result).toBe(false);
      expect(mockLocalRepository.update).not.toHaveBeenCalled();
      expect(mockCloudRepository.update).not.toHaveBeenCalled();
    });

    it('should route to local repository for sessions without cloudId', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: undefined,
        userId: 'user-789',
      });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository, mockCloudRepository);

      const result = await useCase.execute('session-123', '<p>Notes</p>');

      expect(result).toBe(true);
      expect(mockLocalRepository.update).toHaveBeenCalled();
      expect(mockCloudRepository.update).not.toHaveBeenCalled();
    });

    it('should not route to cloud if cloud repository not provided', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456',
      });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository, undefined);

      const result = await useCase.execute('session-123', '<p>Notes</p>');

      expect(result).toBe(true);
      expect(mockLocalRepository.update).toHaveBeenCalled();
    });
  });

  describe('execute - error handling', () => {
    it('should throw error when local repository update fails', async () => {
      const session = createSampleSession({ id: 'session-123' });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(session);
      mockLocalRepository.update = vi.fn().mockRejectedValue(
        new Error('Database write failed')
      );

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository);

      await expect(
        useCase.execute('session-123', '<p>Notes</p>')
      ).rejects.toThrow('Database write failed');
    });

    it('should throw error when cloud repository update fails', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456',
      });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(session);
      mockCloudRepository.update = vi.fn().mockRejectedValue(
        new Error('Network timeout')
      );

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository, mockCloudRepository);

      await expect(
        useCase.execute('session-123', '<p>Notes</p>')
      ).rejects.toThrow('Network timeout');
    });

    it('should handle findById errors from local repository', async () => {
      mockLocalRepository.findById = vi.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository);

      await expect(
        useCase.execute('session-123', '<p>Notes</p>')
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle findById errors from cloud repository', async () => {
      mockLocalRepository.findById = vi.fn().mockResolvedValue(null);
      mockCloudRepository.findById = vi.fn().mockRejectedValue(
        new Error('Cloud service unavailable')
      );

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository, mockCloudRepository);

      await expect(
        useCase.execute('session-123', '<p>Notes</p>')
      ).rejects.toThrow('Cloud service unavailable');
    });
  });

  describe('edge cases', () => {
    it('should handle very long notes content', async () => {
      const session = createSampleSession({ id: 'session-123' });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository);

      const longNotes = '<p>' + 'a'.repeat(100000) + '</p>';
      const result = await useCase.execute('session-123', longNotes);

      expect(result).toBe(true);
      const updatedSession = vi.mocked(mockLocalRepository.update).mock.calls[0][0];
      expect(updatedSession.notes).toBe(longNotes);
    });

    it('should handle special characters in notes', async () => {
      const session = createSampleSession({ id: 'session-123' });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository);

      const specialNotes = '<p>Special chars: 特殊字符 🎉 &amp; &lt;tag&gt;</p>';
      const result = await useCase.execute('session-123', specialNotes);

      expect(result).toBe(true);
      const updatedSession = vi.mocked(mockLocalRepository.update).mock.calls[0][0];
      expect(updatedSession.notes).toBe(specialNotes);
    });

    it('should handle notes with newlines and formatting', async () => {
      const session = createSampleSession({ id: 'session-123' });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository);

      const formattedNotes = `<p>Line 1</p>
<p>Line 2</p>
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
</ul>`;
      const result = await useCase.execute('session-123', formattedNotes);

      expect(result).toBe(true);
      const updatedSession = vi.mocked(mockLocalRepository.update).mock.calls[0][0];
      expect(updatedSession.notes).toBe(formattedNotes);
    });

    it('should handle session with no existing notes', async () => {
      const session = createSampleSession({
        id: 'session-123',
        notes: '',
      });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository);

      const result = await useCase.execute('session-123', '<p>First notes</p>');

      expect(result).toBe(true);
      const updatedSession = vi.mocked(mockLocalRepository.update).mock.calls[0][0];
      expect(updatedSession.notes).toBe('<p>First notes</p>');
    });
  });

  describe('integration scenarios', () => {
    it('should update notes for shared cloud session', async () => {
      const sharedSession = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456',
        userId: 'user-789',
        permissionLevel: 'editor',
      });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(sharedSession);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository, mockCloudRepository);

      const result = await useCase.execute('session-123', '<p>Updated shared notes</p>');

      expect(result).toBe(true);
      expect(mockCloudRepository.update).toHaveBeenCalled();
    });

    it('should handle cloud session found only in cloud', async () => {
      const cloudOnlySession = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456',
        userId: 'user-789',
      });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(null);
      mockCloudRepository.findById = vi.fn().mockResolvedValue(cloudOnlySession);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository, mockCloudRepository);

      const result = await useCase.execute('session-123', '<p>Cloud-only notes</p>');

      expect(result).toBe(true);
      expect(mockCloudRepository.update).toHaveBeenCalled();
      expect(mockLocalRepository.update).not.toHaveBeenCalled();
    });

    it('should update notes multiple times for same session', async () => {
      const session = createSampleSession({ id: 'session-123' });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository);

      await useCase.execute('session-123', '<p>Notes v1</p>');
      await useCase.execute('session-123', '<p>Notes v2</p>');
      await useCase.execute('session-123', '<p>Notes v3</p>');

      expect(mockLocalRepository.update).toHaveBeenCalledTimes(3);
    });

    it('should preserve other session properties when updating notes', async () => {
      const session = createSampleSession({
        id: 'session-123',
        title: 'Test Session',
        tags: ['test', 'sample'],
        duration: 300,
      });
      mockLocalRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new UpdateSessionNotesUseCase(mockLocalRepository);

      await useCase.execute('session-123', '<p>Updated notes</p>');

      const updatedSession = vi.mocked(mockLocalRepository.update).mock.calls[0][0];
      expect(updatedSession.title).toBe('Test Session');
      expect(updatedSession.tags).toEqual(['test', 'sample']);
      expect(updatedSession.duration).toBe(300);
    });
  });
});
