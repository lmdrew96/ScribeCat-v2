import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ListSessionsUseCase } from './ListSessionsUseCase';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { Session } from '../../domain/entities/Session';

describe('ListSessionsUseCase', () => {
  let useCase: ListSessionsUseCase;
  let mockRepository: ISessionRepository;
  let testSessions: Session[];

  beforeEach(() => {
    // Create test sessions with different dates
    const now = new Date('2025-01-15T00:00:00Z');
    const yesterday = new Date('2025-01-14T00:00:00Z');
    const lastWeek = new Date('2025-01-08T00:00:00Z');

    testSessions = [
      new Session(
        'session-1',
        'Newest Session',
        '/path/session-1.webm',
        'notes',
        now,
        now,
        300,
        undefined,
        ['important', 'work']
      ),
      new Session(
        'session-2',
        'Middle Session',
        '/path/session-2.webm',
        'notes',
        yesterday,
        yesterday,
        200,
        undefined,
        ['personal']
      ),
      new Session(
        'session-3',
        'Oldest Session',
        '/path/session-3.webm',
        'notes',
        lastWeek,
        lastWeek,
        150,
        undefined,
        ['work', 'project']
      ),
    ];

    // Create mock repository
    mockRepository = {
      findAll: vi.fn().mockResolvedValue([...testSessions]),
      save: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    };

    useCase = new ListSessionsUseCase(mockRepository);
  });

  describe('execute', () => {
    describe('Sorting', () => {
      it('should return sessions sorted by newest first (desc) by default', async () => {
        const result = await useCase.execute();

        expect(result).toHaveLength(3);
        expect(result[0].id).toBe('session-1'); // Newest
        expect(result[1].id).toBe('session-2'); // Middle
        expect(result[2].id).toBe('session-3'); // Oldest
      });

      it('should return sessions sorted by newest first when desc specified', async () => {
        const result = await useCase.execute('desc');

        expect(result).toHaveLength(3);
        expect(result[0].id).toBe('session-1');
        expect(result[1].id).toBe('session-2');
        expect(result[2].id).toBe('session-3');
      });

      it('should return sessions sorted by oldest first when asc specified', async () => {
        const result = await useCase.execute('asc');

        expect(result).toHaveLength(3);
        expect(result[0].id).toBe('session-3'); // Oldest
        expect(result[1].id).toBe('session-2'); // Middle
        expect(result[2].id).toBe('session-1'); // Newest
      });

      it('should handle sessions with same creation date', async () => {
        const sameDate = new Date('2025-01-15T00:00:00Z');
        const sessionsWithSameDate = [
          new Session('s1', 'Session 1', '/path/s1.webm', '', sameDate, sameDate, 100),
          new Session('s2', 'Session 2', '/path/s2.webm', '', sameDate, sameDate, 100),
        ];

        mockRepository.findAll = vi.fn().mockResolvedValue(sessionsWithSameDate);

        const result = await useCase.execute();

        expect(result).toHaveLength(2);
        // Order should be stable for same dates
      });
    });

    describe('Repository Interaction', () => {
      it('should call repository.findAll', async () => {
        await useCase.execute();

        expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
      });

      it('should return empty array when no sessions exist', async () => {
        mockRepository.findAll = vi.fn().mockResolvedValue([]);

        const result = await useCase.execute();

        expect(result).toEqual([]);
      });

      it('should return single session', async () => {
        mockRepository.findAll = vi.fn().mockResolvedValue([testSessions[0]]);

        const result = await useCase.execute();

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('session-1');
      });
    });

    describe('Error Handling', () => {
      it('should throw error with message when repository fails', async () => {
        const repositoryError = new Error('Database connection failed');
        mockRepository.findAll = vi.fn().mockRejectedValue(repositoryError);

        await expect(useCase.execute()).rejects.toThrow(
          'Failed to list sessions: Database connection failed'
        );
      });

      it('should handle non-Error rejections', async () => {
        mockRepository.findAll = vi.fn().mockRejectedValue('String error');

        await expect(useCase.execute()).rejects.toThrow(
          'Failed to list sessions: Unknown error'
        );
      });
    });
  });

  describe('executeWithTags', () => {
    describe('Tag Filtering', () => {
      it('should return sessions with matching tags', async () => {
        const result = await useCase.executeWithTags(['work']);

        expect(result).toHaveLength(2);
        expect(result.map(s => s.id)).toContain('session-1');
        expect(result.map(s => s.id)).toContain('session-3');
      });

      it('should return sessions matching any of multiple tags', async () => {
        const result = await useCase.executeWithTags(['work', 'personal']);

        expect(result).toHaveLength(3); // All sessions have at least one of these tags
      });

      it('should return empty array when no sessions match tags', async () => {
        const result = await useCase.executeWithTags(['nonexistent']);

        expect(result).toEqual([]);
      });

      it('should return all sessions when tags array is empty', async () => {
        const result = await useCase.executeWithTags([]);

        expect(result).toHaveLength(3);
      });

      it('should normalize tags for comparison (case insensitive)', async () => {
        const result = await useCase.executeWithTags(['WORK', 'Personal']);

        expect(result).toHaveLength(3); // Should match despite case differences
      });

      it('should trim whitespace from tags', async () => {
        const result = await useCase.executeWithTags(['  work  ', ' personal ']);

        expect(result).toHaveLength(3);
      });

      it('should handle sessions with no tags', async () => {
        const sessionWithoutTags = new Session(
          'session-no-tags',
          'No Tags',
          '/path/no-tags.webm',
          '',
          new Date(),
          new Date(),
          100,
          undefined,
          [] // No tags
        );

        mockRepository.findAll = vi.fn().mockResolvedValue([sessionWithoutTags]);

        const result = await useCase.executeWithTags(['work']);

        expect(result).toEqual([]);
      });
    });

    describe('Sorting with Tag Filtering', () => {
      it('should return filtered sessions sorted by newest first by default', async () => {
        const result = await useCase.executeWithTags(['work']);

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('session-1'); // Newest with 'work' tag
        expect(result[1].id).toBe('session-3'); // Oldest with 'work' tag
      });

      it('should return filtered sessions sorted by oldest first when asc', async () => {
        const result = await useCase.executeWithTags(['work'], 'asc');

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('session-3'); // Oldest with 'work' tag
        expect(result[1].id).toBe('session-1'); // Newest with 'work' tag
      });
    });

    describe('Repository Interaction', () => {
      it('should call repository through execute method', async () => {
        await useCase.executeWithTags(['work']);

        expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
      });

      it('should not call repository multiple times for same tags', async () => {
        await useCase.executeWithTags(['work', 'personal']);

        expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
      });
    });

    describe('Error Handling', () => {
      it('should throw error with message when repository fails', async () => {
        const repositoryError = new Error('Database error');
        mockRepository.findAll = vi.fn().mockRejectedValue(repositoryError);

        await expect(useCase.executeWithTags(['work'])).rejects.toThrow(
          'Failed to list sessions with tags'
        );
        await expect(useCase.executeWithTags(['work'])).rejects.toThrow(
          'Database error'
        );
      });

      it('should handle non-Error rejections', async () => {
        mockRepository.findAll = vi.fn().mockRejectedValue('String error');

        await expect(useCase.executeWithTags(['work'])).rejects.toThrow(
          'Failed to list sessions with tags'
        );
        await expect(useCase.executeWithTags(['work'])).rejects.toThrow(
          'Unknown error'
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large number of sessions', async () => {
      const largeSessions = Array.from({ length: 1000 }, (_, i) =>
        new Session(
          `session-${i}`,
          `Session ${i}`,
          `/path/session-${i}.webm`,
          '',
          new Date(2025, 0, 1, 0, 0, i),
          new Date(2025, 0, 1, 0, 0, i),
          100
        )
      );

      mockRepository.findAll = vi.fn().mockResolvedValue(largeSessions);

      const result = await useCase.execute();

      expect(result).toHaveLength(1000);
      // Should be sorted correctly
      expect(result[0].createdAt.getTime()).toBeGreaterThan(
        result[999].createdAt.getTime()
      );
    });

    it('should handle sessions with null/undefined optional fields', async () => {
      const minimalSession = new Session(
        'minimal',
        'Minimal',
        '/path/minimal.webm',
        '',
        new Date(),
        new Date(),
        100
      );

      mockRepository.findAll = vi.fn().mockResolvedValue([minimalSession]);

      const result = await useCase.execute();

      expect(result).toHaveLength(1);
      expect(result[0].transcription).toBeUndefined();
    });
  });
});
