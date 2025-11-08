import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SaveRecordingUseCase, SaveRecordingInput } from './SaveRecordingUseCase';
import { IAudioRepository } from '../../domain/repositories/IAudioRepository';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository';

describe('SaveRecordingUseCase', () => {
  let useCase: SaveRecordingUseCase;
  let mockAudioRepository: IAudioRepository;
  let mockSessionRepository: ISessionRepository;
  let testAudioData: ArrayBuffer;

  beforeEach(() => {
    // Create test audio data
    testAudioData = new ArrayBuffer(1024);

    // Mock audio repository
    mockAudioRepository = {
      saveAudio: vi.fn().mockResolvedValue('/recordings/recording-2025-01-15T12-00-00.webm'),
      loadAudio: vi.fn(),
      deleteAudio: vi.fn(),
      audioExists: vi.fn(),
      getRecordingsDirectory: vi.fn().mockReturnValue('/recordings'),
    };

    // Mock session repository
    mockSessionRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    };

    useCase = new SaveRecordingUseCase(mockAudioRepository, mockSessionRepository);

    // Mock Date.now() for consistent session ID generation
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('execute', () => {
    describe('Successful Saving', () => {
      it('should save audio and create session with default title', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        const result = await useCase.execute(input);

        // Should return session ID (UUID format) and file path
        expect(result.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(result.filePath).toBe('/recordings/recording-2025-01-15T12-00-00.webm');

        // Should have called audio repository
        expect(mockAudioRepository.saveAudio).toHaveBeenCalledTimes(1);
        expect(mockAudioRepository.saveAudio).toHaveBeenCalledWith(
          testAudioData,
          expect.stringMatching(/^recording-.*\.webm$/)
        );

        // Should have called session repository
        expect(mockSessionRepository.save).toHaveBeenCalledTimes(1);
        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.title).toBe('Recording 1/15/2025');
        expect(savedSession.duration).toBe(300);
      });

      it('should use custom title when provided', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
          title: 'My Custom Recording',
        };

        await useCase.execute(input);

        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.title).toBe('My Custom Recording');
      });

      it('should include course information when provided', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
          courseId: 'course-123',
          courseTitle: 'Computer Science 101',
          courseNumber: 'CS101',
        };

        await useCase.execute(input);

        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.courseId).toBe('course-123');
        expect(savedSession.courseTitle).toBe('Computer Science 101');
        expect(savedSession.courseNumber).toBe('CS101');
      });

      it('should create session with empty notes initially', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        await useCase.execute(input);

        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.notes).toBe('');
      });

      it('should create session with no transcription initially', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        await useCase.execute(input);

        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.transcription).toBeUndefined();
      });

      it('should create session with empty tags initially', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        await useCase.execute(input);

        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.tags).toEqual([]);
      });

      it('should create session with empty export history', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        await useCase.execute(input);

        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.exportHistory).toEqual([]);
      });
    });

    describe('Filename Generation', () => {
      it('should generate filename with timestamp', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        await useCase.execute(input);

        expect(mockAudioRepository.saveAudio).toHaveBeenCalledWith(
          testAudioData,
          'recording-2025-01-15T12-00-00.webm'
        );
      });

      it('should replace colons in timestamp', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        await useCase.execute(input);

        const filename = (mockAudioRepository.saveAudio as any).mock.calls[0][1];
        expect(filename).not.toContain(':');
        expect(filename).toContain('-');
      });

      it('should use .webm extension', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        await useCase.execute(input);

        const filename = (mockAudioRepository.saveAudio as any).mock.calls[0][1];
        expect(filename.endsWith('.webm')).toBe(true);
      });
    });

    describe('Session ID Generation', () => {
      it('should generate unique session ID in UUID format', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        const result = await useCase.execute(input);

        // Should be a valid UUID (v4 format)
        expect(result.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(result.sessionId).toHaveLength(36); // UUID length with dashes
      });

      it('should generate different IDs for multiple calls', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        const result1 = await useCase.execute(input);

        // Advance time slightly
        vi.advanceTimersByTime(10);

        const result2 = await useCase.execute(input);

        expect(result1.sessionId).not.toBe(result2.sessionId);
      });
    });

    describe('Timestamps', () => {
      it('should set createdAt to current time', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        const beforeExecution = new Date();
        await useCase.execute(input);

        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.createdAt).toEqual(beforeExecution);
      });

      it('should set updatedAt to current time', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        const beforeExecution = new Date();
        await useCase.execute(input);

        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.updatedAt).toEqual(beforeExecution);
      });

      it('should have createdAt equal to updatedAt', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        await useCase.execute(input);

        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.createdAt).toEqual(savedSession.updatedAt);
      });
    });

    describe('Error Handling', () => {
      it('should throw error when audio repository fails', async () => {
        const audioError = new Error('Failed to write file');
        mockAudioRepository.saveAudio = vi.fn().mockRejectedValue(audioError);

        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        await expect(useCase.execute(input)).rejects.toThrow('Failed to write file');
      });

      it('should throw error when session repository fails', async () => {
        const sessionError = new Error('Database error');
        mockSessionRepository.save = vi.fn().mockRejectedValue(sessionError);

        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        await expect(useCase.execute(input)).rejects.toThrow('Database error');
      });

      it('should not save session if audio save fails', async () => {
        const audioError = new Error('Disk full');
        mockAudioRepository.saveAudio = vi.fn().mockRejectedValue(audioError);

        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
        };

        await expect(useCase.execute(input)).rejects.toThrow();

        // Session should not be saved
        expect(mockSessionRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('Duration Handling', () => {
      it('should save duration in session', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 456.789,
        };

        await useCase.execute(input);

        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.duration).toBe(456.789);
      });

      it('should handle zero duration', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 0,
        };

        await useCase.execute(input);

        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.duration).toBe(0);
      });

      it('should handle very long duration', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 10000, // ~2.7 hours
        };

        await useCase.execute(input);

        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.duration).toBe(10000);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty audio data', async () => {
        const emptyAudioData = new ArrayBuffer(0);
        const input: SaveRecordingInput = {
          audioData: emptyAudioData,
          duration: 0,
        };

        await useCase.execute(input);

        expect(mockAudioRepository.saveAudio).toHaveBeenCalledWith(
          emptyAudioData,
          expect.any(String)
        );
      });

      it('should handle very large audio data', async () => {
        const largeAudioData = new ArrayBuffer(100 * 1024 * 1024); // 100MB
        const input: SaveRecordingInput = {
          audioData: largeAudioData,
          duration: 3600,
        };

        await useCase.execute(input);

        expect(mockAudioRepository.saveAudio).toHaveBeenCalledWith(
          largeAudioData,
          expect.any(String)
        );
      });

      it('should handle special characters in title', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
          title: 'Recording with "quotes" and <tags>',
        };

        await useCase.execute(input);

        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.title).toBe('Recording with "quotes" and <tags>');
      });

      it('should handle Unicode characters in title', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
          title: 'Recording 日本語 🎤',
        };

        await useCase.execute(input);

        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.title).toBe('Recording 日本語 🎤');
      });

      it('should handle partial course information', async () => {
        const input: SaveRecordingInput = {
          audioData: testAudioData,
          duration: 300,
          courseId: 'course-123',
          // courseTitle and courseNumber omitted
        };

        await useCase.execute(input);

        const savedSession = (mockSessionRepository.save as any).mock.calls[0][0];
        expect(savedSession.courseId).toBe('course-123');
        expect(savedSession.courseTitle).toBeUndefined();
        expect(savedSession.courseNumber).toBeUndefined();
      });
    });
  });
});
