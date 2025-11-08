import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateSessionTranscriptionUseCase } from './UpdateSessionTranscriptionUseCase';
import { createMockSessionRepository } from '@test/mocks';
import { createSampleSession } from '@test/fixtures';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';

describe('UpdateSessionTranscriptionUseCase', () => {
  let useCase: UpdateSessionTranscriptionUseCase;
  let mockRepository: ISessionRepository;

  beforeEach(() => {
    mockRepository = createMockSessionRepository();
    useCase = new UpdateSessionTranscriptionUseCase(mockRepository);

    // Suppress console logs in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('execute - basic transcription', () => {
    it('should update session with transcription text', async () => {
      const session = createSampleSession({ id: 'session-123', duration: 300 });
      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(session); // For reload verification

      const result = await useCase.execute(
        'session-123',
        'This is the transcribed text from the recording.'
      );

      expect(result).toBe(true);
      expect(mockRepository.save).toHaveBeenCalled();
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.transcription).toBeDefined();
      expect(savedSession.transcription?.fullText).toBe('This is the transcribed text from the recording.');
    });

    it('should return false when session not found', async () => {
      mockRepository.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute('non-existent', 'Transcription text');

      expect(result).toBe(false);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should skip empty transcription', async () => {
      const session = createSampleSession({ id: 'session-123' });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      const result = await useCase.execute('session-123', '');

      expect(result).toBe(true);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should skip whitespace-only transcription', async () => {
      const session = createSampleSession({ id: 'session-123' });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      const result = await useCase.execute('session-123', '   \n\t   ');

      expect(result).toBe(true);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should trim transcription text', async () => {
      const session = createSampleSession({ id: 'session-123', duration: 300 });
      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(session);

      const result = await useCase.execute(
        'session-123',
        '  Transcription with spaces.  '
      );

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.transcription?.fullText).toBe('Transcription with spaces.');
    });
  });

  describe('execute - timestamped entries', () => {
    it('should create segments from timestamped entries', async () => {
      const session = createSampleSession({ id: 'session-123', duration: 300 });
      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(session);

      const timestampedEntries = [
        { startTime: 0, endTime: 5, text: 'First segment.' },
        { startTime: 5, endTime: 10, text: 'Second segment.' },
        { startTime: 10, endTime: 15, text: 'Third segment.' },
      ];

      const result = await useCase.execute(
        'session-123',
        'First segment. Second segment. Third segment.',
        'assemblyai',
        timestampedEntries
      );

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.transcription?.segments).toHaveLength(3);
      expect(savedSession.transcription?.segments[0].text).toBe('First segment.');
      expect(savedSession.transcription?.segments[0].startTime).toBe(0);
      expect(savedSession.transcription?.segments[0].endTime).toBe(5);
    });

    it('should clamp segment end time to session duration', async () => {
      const session = createSampleSession({ id: 'session-123', duration: 100 });
      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(session);

      const timestampedEntries = [
        { startTime: 90, endTime: 150, text: 'Segment exceeds duration.' }, // endTime > duration
      ];

      const result = await useCase.execute(
        'session-123',
        'Segment exceeds duration.',
        'assemblyai',
        timestampedEntries
      );

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.transcription?.segments[0].endTime).toBe(100); // Clamped to duration
    });

    it('should handle invalid end time before start time', async () => {
      const session = createSampleSession({ id: 'session-123', duration: 100 });
      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(session);

      const timestampedEntries = [
        { startTime: 10, endTime: 5, text: 'Invalid timing.' }, // endTime < startTime
        { startTime: 20, endTime: 25, text: 'Valid segment.' },
      ];

      const result = await useCase.execute(
        'session-123',
        'Invalid timing. Valid segment.',
        'assemblyai',
        timestampedEntries
      );

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      // Should use next segment's start time
      expect(savedSession.transcription?.segments[0].endTime).toBe(20);
    });
  });

  describe('execute - text-based segmentation', () => {
    it('should create segments from sentence endings', async () => {
      const session = createSampleSession({ id: 'session-123', duration: 300 });
      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(session);

      // Text must be >= 100 chars for sentence splitting (otherwise uses chunk splitting)
      const text = 'First sentence with enough words to exceed the minimum length. Second sentence also has enough content! Third sentence completes the test?';

      const result = await useCase.execute('session-123', text);

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.transcription?.segments.length).toBeGreaterThan(1);
    });

    it('should create chunk segments for short text', async () => {
      const session = createSampleSession({ id: 'session-123', duration: 100 });
      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(session);

      const text = 'Short text without punctuation';

      const result = await useCase.execute('session-123', text);

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.transcription?.segments.length).toBeGreaterThan(0);
    });

    it('should distribute time evenly across segments', async () => {
      const session = createSampleSession({ id: 'session-123', duration: 300 });
      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(session);

      const text = 'Sentence one. Sentence two. Sentence three.';

      const result = await useCase.execute('session-123', text);

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      const segments = savedSession.transcription?.segments || [];

      // Each segment should have start < end
      segments.forEach(segment => {
        expect(segment.startTime).toBeLessThan(segment.endTime);
      });

      // Last segment should end at session duration
      if (segments.length > 0) {
        expect(segments[segments.length - 1].endTime).toBeCloseTo(300, 1);
      }
    });
  });

  describe('execute - provider handling', () => {
    it('should use assemblyai as default provider', async () => {
      const session = createSampleSession({ id: 'session-123', duration: 100 });
      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(session);

      const result = await useCase.execute('session-123', 'Text');

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.transcription?.provider).toBe('assemblyai');
    });

    it('should accept assemblyai provider explicitly', async () => {
      const session = createSampleSession({ id: 'session-123', duration: 100 });
      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(session);

      const result = await useCase.execute('session-123', 'Text', 'assemblyai');

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.transcription?.provider).toBe('assemblyai');
    });
  });

  describe('execute - error handling', () => {
    it('should return false when save fails', async () => {
      const session = createSampleSession({ id: 'session-123', duration: 100 });
      mockRepository.findById = vi.fn().mockResolvedValue(session);
      mockRepository.save = vi.fn().mockRejectedValue(new Error('Save failed'));

      const result = await useCase.execute('session-123', 'Transcription');

      expect(result).toBe(false);
    });

    it('should return false when findById throws error', async () => {
      mockRepository.findById = vi.fn().mockRejectedValue(new Error('Database error'));

      const result = await useCase.execute('session-123', 'Transcription');

      expect(result).toBe(false);
    });

    it('should handle very long transcription text', async () => {
      const session = createSampleSession({ id: 'session-123', duration: 3600 });
      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(session);

      const longText = Array(1000).fill('This is a sentence.').join(' ');

      const result = await useCase.execute('session-123', longText);

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.transcription?.fullText.length).toBeGreaterThan(10000);
    });
  });

  describe('integration scenarios', () => {
    it('should update existing transcription', async () => {
      const session = createSampleSession({
        id: 'session-123',
        duration: 100,
        transcription: {
          fullText: 'Old transcription',
          segments: [],
          language: 'en',
          provider: 'assemblyai',
          createdAt: new Date(),
        } as any,
      });
      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(session);

      const result = await useCase.execute('session-123', 'New transcription.');

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.transcription?.fullText).toBe('New transcription.');
    });

    it('should handle mixed timestamped and generated segments', async () => {
      const session = createSampleSession({ id: 'session-123', duration: 300 });
      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(session);

      const timestampedEntries = [
        { startTime: 0, endTime: 100, text: 'First part from AssemblyAI.' },
        { startTime: 100, endTime: 200, text: 'Second part.' },
      ];

      const result = await useCase.execute(
        'session-123',
        'First part from AssemblyAI. Second part.',
        'assemblyai',
        timestampedEntries
      );

      expect(result).toBe(true);
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.transcription?.segments).toHaveLength(2);
    });

    it('should verify save by reloading session', async () => {
      const session = createSampleSession({ id: 'session-123', duration: 100 });
      const reloadedSession = createSampleSession({
        id: 'session-123',
        duration: 100,
        transcription: {
          fullText: 'Saved transcription',
          segments: [],
        } as any,
      });

      mockRepository.findById = vi.fn()
        .mockResolvedValueOnce(session) // Initial load
        .mockResolvedValueOnce(reloadedSession); // Reload verification

      const result = await useCase.execute('session-123', 'Saved transcription');

      expect(result).toBe(true);
      expect(mockRepository.findById).toHaveBeenCalledTimes(2);
    });
  });
});
