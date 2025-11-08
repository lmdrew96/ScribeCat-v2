import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateSessionUseCase } from './UpdateSessionUseCase';
import { createMockSessionRepository } from '@test/mocks';
import { createSampleSession } from '@test/fixtures';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';

describe('UpdateSessionUseCase', () => {
  let useCase: UpdateSessionUseCase;
  let mockLocalRepository: ISessionRepository;
  let mockCloudRepository: ISessionRepository;

  beforeEach(() => {
    mockLocalRepository = createMockSessionRepository();
    mockCloudRepository = createMockSessionRepository();
  });

  describe('execute - basic updates', () => {
    it('should update session title successfully', async () => {
      const session = createSampleSession({ id: 'session-123', title: 'Old Title' });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(session);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      const result = await useCase.execute('session-123', { title: 'New Title' });

      expect(result).toBe(true);
      expect(mockLocalRepository.save).toHaveBeenCalled();
      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.title).toBe('New Title');
    });

    it('should update session notes successfully', async () => {
      const session = createSampleSession({ id: 'session-123', notes: '<p>Old notes</p>' });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(session);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      const result = await useCase.execute('session-123', { notes: '<p>New notes</p>' });

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.notes).toBe('<p>New notes</p>');
    });

    it('should update session tags successfully', async () => {
      const session = createSampleSession({ id: 'session-123', tags: ['old', 'tags'] });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(session);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      const result = await useCase.execute('session-123', { tags: ['new', 'tags', 'updated'] });

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.tags).toEqual(['new', 'tags', 'updated']);
    });

    it('should update multiple properties at once', async () => {
      const session = createSampleSession({
        id: 'session-123',
        title: 'Old Title',
        notes: '<p>Old notes</p>',
        tags: ['old']
      });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(session);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      const result = await useCase.execute('session-123', {
        title: 'New Title',
        notes: '<p>New notes</p>',
        tags: ['new', 'tags']
      });

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.title).toBe('New Title');
      expect(savedSession.notes).toBe('<p>New notes</p>');
      expect(savedSession.tags).toEqual(['new', 'tags']);
    });

    it('should update updatedAt timestamp', async () => {
      const oldDate = new Date('2025-01-01T00:00:00Z');
      const session = createSampleSession({ id: 'session-123', updatedAt: oldDate });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(session);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      await useCase.execute('session-123', { title: 'New Title' });

      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.updatedAt.getTime()).toBeGreaterThan(oldDate.getTime());
    });
  });

  describe('execute - course information', () => {
    it('should update course information', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(session);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      const result = await useCase.execute('session-123', {
        courseId: 'course-456',
        courseTitle: 'Introduction to Computer Science',
        courseNumber: 'CS 101'
      });

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.courseId).toBe('course-456');
      expect(savedSession.courseTitle).toBe('Introduction to Computer Science');
      expect(savedSession.courseNumber).toBe('CS 101');
    });

    it('should update only courseId when other fields not provided', async () => {
      const session = createSampleSession({
        id: 'session-123',
        courseTitle: 'Existing Title',
        courseNumber: 'CS 101'
      });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(session);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      await useCase.execute('session-123', { courseId: 'new-course-id' });

      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.courseId).toBe('new-course-id');
      expect(savedSession.courseTitle).toBe('Existing Title');
      expect(savedSession.courseNumber).toBe('CS 101');
    });

    it('should preserve existing course information when undefined passed', async () => {
      const session = createSampleSession({
        id: 'session-123',
        courseId: 'old-course',
        courseTitle: 'Old Course',
        courseNumber: 'OLD 101'
      });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(session);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      // Passing undefined preserves existing values
      await useCase.execute('session-123', {
        courseId: undefined,
        courseTitle: undefined,
        courseNumber: undefined
      });

      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      // Values should be preserved, not cleared
      expect(savedSession.courseId).toBe('old-course');
      expect(savedSession.courseTitle).toBe('Old Course');
      expect(savedSession.courseNumber).toBe('OLD 101');
    });
  });

  describe('execute - session not found', () => {
    it('should return false when session not found in local repository', async () => {
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(null);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      const result = await useCase.execute('non-existent', { title: 'New Title' });

      expect(result).toBe(false);
      expect(mockLocalRepository.save).not.toHaveBeenCalled();
    });

    it('should search cloud repository when not found locally', async () => {
      const cloudSession = createSampleSession({ id: 'session-123', cloudId: 'cloud-456' });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(null);
      vi.mocked(mockCloudRepository.findById).mockResolvedValue(cloudSession);

      useCase = new UpdateSessionUseCase(mockLocalRepository, mockCloudRepository);

      const result = await useCase.execute('session-123', { title: 'New Title' });

      expect(result).toBe(true);
      expect(mockLocalRepository.findById).toHaveBeenCalled();
      expect(mockCloudRepository.findById).toHaveBeenCalled();
    });

    it('should return false when session not found in both repositories', async () => {
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(null);
      vi.mocked(mockCloudRepository.findById).mockResolvedValue(null);

      useCase = new UpdateSessionUseCase(mockLocalRepository, mockCloudRepository);

      const result = await useCase.execute('non-existent', { title: 'New Title' });

      expect(result).toBe(false);
    });
  });

  describe('execute - cloud vs local storage', () => {
    it('should save to cloud repository when session has cloudId', async () => {
      const cloudSession = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456',
        userId: 'user-789'
      });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(cloudSession);

      useCase = new UpdateSessionUseCase(mockLocalRepository, mockCloudRepository);

      await useCase.execute('session-123', { title: 'New Title' });

      expect(mockCloudRepository.update).toHaveBeenCalled();
      expect(mockLocalRepository.save).not.toHaveBeenCalled();
    });

    it('should save to local repository when session has no cloudId', async () => {
      const localSession = createSampleSession({
        id: 'session-123',
        cloudId: undefined
      });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(localSession);

      useCase = new UpdateSessionUseCase(mockLocalRepository, mockCloudRepository);

      await useCase.execute('session-123', { title: 'New Title' });

      expect(mockLocalRepository.save).toHaveBeenCalled();
      expect(mockCloudRepository.update).not.toHaveBeenCalled();
    });

    it('should save to local repository when no cloud repository provided', async () => {
      const session = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456' // Has cloudId but no cloud repo
      });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(session);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      await useCase.execute('session-123', { title: 'New Title' });

      expect(mockLocalRepository.save).toHaveBeenCalled();
    });

    it('should use update() for cloud sessions instead of save()', async () => {
      const cloudSession = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456',
        userId: 'user-789'
      });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(cloudSession);

      useCase = new UpdateSessionUseCase(mockLocalRepository, mockCloudRepository);

      await useCase.execute('session-123', { title: 'New Title' });

      // Should call update(), not save(), to respect RLS policies
      expect(mockCloudRepository.update).toHaveBeenCalled();
      expect(mockCloudRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('execute - auto-claiming orphaned sessions', () => {
    it('should auto-claim orphaned session for current user', async () => {
      const orphanedSession = createSampleSession({
        id: 'session-123',
        userId: undefined
      });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(orphanedSession);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      await useCase.execute('session-123', { title: 'New Title' }, 'current-user-id');

      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.userId).toBe('current-user-id');
    });

    it('should not claim session that already has a user', async () => {
      const ownedSession = createSampleSession({
        id: 'session-123',
        userId: 'original-user'
      });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(ownedSession);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      await useCase.execute('session-123', { title: 'New Title' }, 'different-user');

      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.userId).toBe('original-user');
    });

    it('should not claim session when no current user provided', async () => {
      const orphanedSession = createSampleSession({
        id: 'session-123',
        userId: undefined
      });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(orphanedSession);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      await useCase.execute('session-123', { title: 'New Title' });

      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.userId).toBeUndefined();
    });

    it('should not claim session when currentUserId is null', async () => {
      const orphanedSession = createSampleSession({
        id: 'session-123',
        userId: undefined
      });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(orphanedSession);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      await useCase.execute('session-123', { title: 'New Title' }, null);

      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.userId).toBeUndefined();
    });
  });

  describe('execute - error handling', () => {
    it('should return false when repository save fails', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(session);
      vi.mocked(mockLocalRepository.save).mockRejectedValue(new Error('Save failed'));

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      const result = await useCase.execute('session-123', { title: 'New Title' });

      expect(result).toBe(false);
    });

    it('should return false when cloud repository update fails', async () => {
      const cloudSession = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456'
      });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(cloudSession);
      vi.mocked(mockCloudRepository.update).mockRejectedValue(new Error('Update failed'));

      useCase = new UpdateSessionUseCase(mockLocalRepository, mockCloudRepository);

      const result = await useCase.execute('session-123', { title: 'New Title' });

      expect(result).toBe(false);
    });

    it('should return false when findById throws error', async () => {
      vi.mocked(mockLocalRepository.findById).mockRejectedValue(new Error('Database error'));

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      const result = await useCase.execute('session-123', { title: 'New Title' });

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty updates object', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(session);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      const result = await useCase.execute('session-123', {});

      expect(result).toBe(true);
      expect(mockLocalRepository.save).toHaveBeenCalled();
    });

    it('should handle very long title', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(session);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      const longTitle = 'a'.repeat(10000);
      await useCase.execute('session-123', { title: longTitle });

      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.title).toBe(longTitle);
    });

    it('should handle empty notes', async () => {
      const session = createSampleSession({ id: 'session-123', notes: '<p>Old notes</p>' });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(session);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      await useCase.execute('session-123', { notes: '' });

      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.notes).toBe('');
    });

    it('should handle empty tags array', async () => {
      const session = createSampleSession({ id: 'session-123', tags: ['tag1', 'tag2'] });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(session);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      await useCase.execute('session-123', { tags: [] });

      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.tags).toEqual([]);
    });

    it('should handle special characters in updates', async () => {
      const session = createSampleSession({ id: 'session-123' });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(session);

      useCase = new UpdateSessionUseCase(mockLocalRepository);

      await useCase.execute('session-123', {
        title: 'Title with 特殊字符 and emoji 🎉',
        notes: '<p>Notes with <strong>HTML</strong> & special chars: © ® ™</p>'
      });

      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.title).toContain('特殊字符');
      expect(savedSession.title).toContain('🎉');
      expect(savedSession.notes).toContain('©');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete cloud session update workflow', async () => {
      const cloudSession = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456',
        userId: 'user-789',
        title: 'Old Title',
        notes: '<p>Old notes</p>',
        tags: ['old']
      });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(cloudSession);

      useCase = new UpdateSessionUseCase(mockLocalRepository, mockCloudRepository);

      const result = await useCase.execute('session-123', {
        title: 'New Title',
        notes: '<p>New notes</p>',
        tags: ['new', 'updated'],
        courseId: 'course-101',
        courseTitle: 'Computer Science',
        courseNumber: 'CS 101'
      }, 'user-789');

      expect(result).toBe(true);
      expect(mockCloudRepository.update).toHaveBeenCalled();

      const updatedSession = vi.mocked(mockCloudRepository.update).mock.calls[0][0];
      expect(updatedSession.title).toBe('New Title');
      expect(updatedSession.notes).toBe('<p>New notes</p>');
      expect(updatedSession.tags).toEqual(['new', 'updated']);
      expect(updatedSession.courseId).toBe('course-101');
      expect(updatedSession.userId).toBe('user-789');
    });

    it('should handle session found in cloud and updated to cloud', async () => {
      const cloudSession = createSampleSession({
        id: 'session-123',
        cloudId: 'cloud-456',
        userId: 'user-789'
      });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(null);
      vi.mocked(mockCloudRepository.findById).mockResolvedValue(cloudSession);

      useCase = new UpdateSessionUseCase(mockLocalRepository, mockCloudRepository);

      const result = await useCase.execute('session-123', { title: 'New Title' });

      expect(result).toBe(true);
      expect(mockCloudRepository.update).toHaveBeenCalled();
      expect(mockLocalRepository.save).not.toHaveBeenCalled();
    });

    it('should handle orphaned session auto-claim and save to local', async () => {
      const orphanedSession = createSampleSession({
        id: 'session-123',
        userId: undefined,
        cloudId: undefined
      });
      vi.mocked(mockLocalRepository.findById).mockResolvedValue(orphanedSession);

      useCase = new UpdateSessionUseCase(mockLocalRepository, mockCloudRepository);

      const result = await useCase.execute('session-123', {
        title: 'Claimed Session',
        tags: ['claimed']
      }, 'new-user-123');

      expect(result).toBe(true);
      expect(mockLocalRepository.save).toHaveBeenCalled();

      const savedSession = vi.mocked(mockLocalRepository.save).mock.calls[0][0];
      expect(savedSession.userId).toBe('new-user-123');
      expect(savedSession.title).toBe('Claimed Session');
    });
  });
});
