import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranscribeAudioUseCase } from './TranscribeAudioUseCase';
import { createMockSessionRepository, createMockTranscriptionService } from '@test/mocks';
import { createSampleSession, createSampleTranscription } from '@test/fixtures';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import type { ITranscriptionService } from '../../domain/services/ITranscriptionService';
import { Transcription } from '../../domain/entities/Transcription';

describe('TranscribeAudioUseCase', () => {
  let useCase: TranscribeAudioUseCase;
  let mockRepository: ISessionRepository;
  let mockPrimaryService: ITranscriptionService;
  let mockFallbackService: ITranscriptionService;

  beforeEach(() => {
    mockRepository = createMockSessionRepository();
    mockPrimaryService = createMockTranscriptionService();
    mockFallbackService = createMockTranscriptionService({
      getProviderName: vi.fn().mockReturnValue('simulation'),
    });

    // Suppress console logs in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('execute - primary service success', () => {
    it('should transcribe audio using primary service', async () => {
      const session = createSampleSession({
        id: 'session-123',
        audioFilePath: '/recordings/test.webm',
        transcription: undefined,
      });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      const result = await useCase.execute('session-123');

      expect(mockPrimaryService.isAvailable).toHaveBeenCalled();
      expect(mockPrimaryService.transcribe).toHaveBeenCalledWith('/recordings/test.webm', undefined);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.hasTranscription()).toBe(true);
    });

    it('should pass options to transcription service', async () => {
      const session = createSampleSession({
        id: 'session-123',
        transcription: undefined,
      });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      const options = { language: 'es', modelPath: '/models/spanish' };
      await useCase.execute('session-123', options);

      expect(mockPrimaryService.transcribe).toHaveBeenCalledWith(
        session.recordingPath,
        options
      );
    });

    it('should save session after successful transcription', async () => {
      const session = createSampleSession({ id: 'session-123', transcription: undefined });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      await useCase.execute('session-123');

      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.hasTranscription()).toBe(true);
    });

    it('should return session with transcription', async () => {
      const session = createSampleSession({ id: 'session-123', transcription: undefined });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      const mockTranscription = new Transcription(
        'Test transcription',
        [{ text: 'Test transcription', startTime: 0, endTime: 5 }],
        'en',
        'assemblyai',
        new Date(),
        0.95
      );
      mockPrimaryService.transcribe = vi.fn().mockResolvedValue(mockTranscription);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      const result = await useCase.execute('session-123');

      expect(result.transcription).toBeDefined();
      expect(result.transcription?.fullText).toBe('Test transcription');
    });
  });

  describe('execute - already has transcription', () => {
    it('should return existing session if already transcribed', async () => {
      const session = createSampleSession({
        id: 'session-123',
        transcription: createSampleTranscription(),
      });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      const result = await useCase.execute('session-123');

      expect(mockPrimaryService.transcribe).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(result).toBe(session);
    });

    it('should not attempt transcription when session has existing transcription', async () => {
      const session = createSampleSession({
        id: 'session-123',
        transcription: createSampleTranscription({ text: 'Existing transcription' }),
      });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      await useCase.execute('session-123');

      expect(mockPrimaryService.isAvailable).not.toHaveBeenCalled();
      expect(mockPrimaryService.transcribe).not.toHaveBeenCalled();
    });
  });

  describe('execute - fallback service', () => {
    it('should use fallback service when primary is not available', async () => {
      const session = createSampleSession({ id: 'session-123', transcription: undefined });
      mockRepository.findById = vi.fn().mockResolvedValue(session);
      mockPrimaryService.isAvailable = vi.fn().mockResolvedValue(false);

      useCase = new TranscribeAudioUseCase(
        mockRepository,
        mockPrimaryService,
        mockFallbackService
      );

      const result = await useCase.execute('session-123');

      expect(mockFallbackService.isAvailable).toHaveBeenCalled();
      expect(mockFallbackService.transcribe).toHaveBeenCalled();
      expect(result.hasTranscription()).toBe(true);
    });

    it('should use fallback service when primary transcription fails', async () => {
      const session = createSampleSession({ id: 'session-123', transcription: undefined });
      mockRepository.findById = vi.fn().mockResolvedValue(session);
      mockPrimaryService.transcribe = vi.fn().mockRejectedValue(new Error('Primary failed'));

      useCase = new TranscribeAudioUseCase(
        mockRepository,
        mockPrimaryService,
        mockFallbackService
      );

      const result = await useCase.execute('session-123');

      expect(mockFallbackService.isAvailable).toHaveBeenCalled();
      expect(mockFallbackService.transcribe).toHaveBeenCalled();
      expect(result.hasTranscription()).toBe(true);
    });

    it('should log warning when primary fails and fallback is used', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      const session = createSampleSession({ id: 'session-123', transcription: undefined });
      mockRepository.findById = vi.fn().mockResolvedValue(session);
      mockPrimaryService.transcribe = vi.fn().mockRejectedValue(new Error('Network error'));

      useCase = new TranscribeAudioUseCase(
        mockRepository,
        mockPrimaryService,
        mockFallbackService
      );

      await useCase.execute('session-123');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Primary transcription failed')
      );
    });

    it('should throw error when both services fail', async () => {
      const session = createSampleSession({ id: 'session-123', transcription: undefined });
      mockRepository.findById = vi.fn().mockResolvedValue(session);
      mockPrimaryService.transcribe = vi.fn().mockRejectedValue(new Error('Primary failed'));
      mockFallbackService.transcribe = vi.fn().mockRejectedValue(new Error('Fallback failed'));

      useCase = new TranscribeAudioUseCase(
        mockRepository,
        mockPrimaryService,
        mockFallbackService
      );

      await expect(useCase.execute('session-123')).rejects.toThrow(
        'Both transcription services failed'
      );
    });

    it('should throw error when fallback is not available', async () => {
      const session = createSampleSession({ id: 'session-123', transcription: undefined });
      mockRepository.findById = vi.fn().mockResolvedValue(session);
      mockPrimaryService.transcribe = vi.fn().mockRejectedValue(new Error('Primary failed'));
      mockFallbackService.isAvailable = vi.fn().mockResolvedValue(false);

      useCase = new TranscribeAudioUseCase(
        mockRepository,
        mockPrimaryService,
        mockFallbackService
      );

      await expect(useCase.execute('session-123')).rejects.toThrow(
        'Fallback transcription service not available'
      );
    });

    it('should throw error when no fallback service configured', async () => {
      const session = createSampleSession({ id: 'session-123', transcription: undefined });
      mockRepository.findById = vi.fn().mockResolvedValue(session);
      mockPrimaryService.transcribe = vi.fn().mockRejectedValue(new Error('Primary failed'));

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      await expect(useCase.execute('session-123')).rejects.toThrow(
        'Transcription failed and no fallback service configured'
      );
    });
  });

  describe('execute - error handling', () => {
    it('should throw error when session not found', async () => {
      mockRepository.findById = vi.fn().mockResolvedValue(null);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      await expect(useCase.execute('non-existent')).rejects.toThrow(
        'Session with ID non-existent not found'
      );
    });

    it('should throw error with context when transcription fails', async () => {
      const session = createSampleSession({ id: 'session-123', transcription: undefined });
      mockRepository.findById = vi.fn().mockResolvedValue(session);
      mockPrimaryService.transcribe = vi.fn().mockRejectedValue(new Error('Audio file corrupt'));

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      await expect(useCase.execute('session-123')).rejects.toThrow(
        'Failed to transcribe audio'
      );
    });

    it('should handle non-Error exceptions from primary service', async () => {
      const session = createSampleSession({ id: 'session-123', transcription: undefined });
      mockRepository.findById = vi.fn().mockResolvedValue(session);
      mockPrimaryService.transcribe = vi.fn().mockRejectedValue('String error');

      useCase = new TranscribeAudioUseCase(
        mockRepository,
        mockPrimaryService,
        mockFallbackService
      );

      const result = await useCase.execute('session-123');

      // Should fall back to secondary service
      expect(mockFallbackService.transcribe).toHaveBeenCalled();
      expect(result.hasTranscription()).toBe(true);
    });

    it('should not save when transcription fails', async () => {
      const session = createSampleSession({ id: 'session-123', transcription: undefined });
      mockRepository.findById = vi.fn().mockResolvedValue(session);
      mockPrimaryService.transcribe = vi.fn().mockRejectedValue(new Error('Failed'));

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      await expect(useCase.execute('session-123')).rejects.toThrow();

      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('reTranscribe - re-transcription', () => {
    it('should re-transcribe session even if already has transcription', async () => {
      const session = createSampleSession({
        id: 'session-123',
        transcription: createSampleTranscription({ text: 'Old transcription' }),
      });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      const newTranscription = new Transcription(
        'New transcription',
        [{ text: 'New transcription', startTime: 0, endTime: 5 }],
        'en',
        'assemblyai',
        new Date(),
        0.95
      );
      mockPrimaryService.transcribe = vi.fn().mockResolvedValue(newTranscription);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      const result = await useCase.reTranscribe('session-123');

      expect(mockPrimaryService.transcribe).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.transcription?.fullText).toBe('New transcription');
    });

    it('should use fallback service for re-transcription if primary unavailable', async () => {
      const session = createSampleSession({ id: 'session-123' });
      mockRepository.findById = vi.fn().mockResolvedValue(session);
      mockPrimaryService.isAvailable = vi.fn().mockResolvedValue(false);

      useCase = new TranscribeAudioUseCase(
        mockRepository,
        mockPrimaryService,
        mockFallbackService
      );

      const result = await useCase.reTranscribe('session-123');

      expect(mockFallbackService.isAvailable).toHaveBeenCalled();
      expect(mockFallbackService.transcribe).toHaveBeenCalled();
      expect(result.hasTranscription()).toBe(true);
    });

    it('should throw error when session not found for re-transcription', async () => {
      mockRepository.findById = vi.fn().mockResolvedValue(null);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      await expect(useCase.reTranscribe('non-existent')).rejects.toThrow(
        'Session with ID non-existent not found'
      );
    });

    it('should throw error when no service available for re-transcription', async () => {
      const session = createSampleSession({ id: 'session-123' });
      mockRepository.findById = vi.fn().mockResolvedValue(session);
      mockPrimaryService.isAvailable = vi.fn().mockResolvedValue(false);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      await expect(useCase.reTranscribe('session-123')).rejects.toThrow(
        'No transcription service available'
      );
    });

    it('should pass options to transcription service during re-transcribe', async () => {
      const session = createSampleSession({ id: 'session-123' });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      const options = { language: 'fr', modelPath: '/models/french' };
      await useCase.reTranscribe('session-123', options);

      expect(mockPrimaryService.transcribe).toHaveBeenCalledWith(
        session.recordingPath,
        options
      );
    });

    it('should save updated session after re-transcription', async () => {
      const session = createSampleSession({ id: 'session-123' });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      await useCase.reTranscribe('session-123');

      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      const savedSession = vi.mocked(mockRepository.save).mock.calls[0][0];
      expect(savedSession.hasTranscription()).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete transcription workflow', async () => {
      const session = createSampleSession({
        id: 'session-123',
        audioFilePath: '/recordings/lecture.webm',
        duration: 3600,
        transcription: undefined,
      });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      const transcription = new Transcription(
        'Complete lecture transcription',
        [
          { text: 'Introduction', startTime: 0, endTime: 300 },
          { text: 'Main content', startTime: 300, endTime: 3000 },
          { text: 'Conclusion', startTime: 3000, endTime: 3600 },
        ],
        'en',
        'assemblyai',
        new Date(),
        0.92
      );
      mockPrimaryService.transcribe = vi.fn().mockResolvedValue(transcription);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      const result = await useCase.execute('session-123');

      expect(result.hasTranscription()).toBe(true);
      expect(result.transcription?.segments).toHaveLength(3);
      expect(mockRepository.save).toHaveBeenCalledWith(result);
    });

    it('should handle graceful degradation to fallback service', async () => {
      const session = createSampleSession({ id: 'session-123', transcription: undefined });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      // Primary fails, fallback succeeds
      mockPrimaryService.transcribe = vi
        .fn()
        .mockRejectedValue(new Error('Model not loaded'));
      mockFallbackService.transcribe = vi.fn().mockResolvedValue(
        new Transcription(
          'Fallback transcription',
          [{ text: 'Fallback transcription', startTime: 0, endTime: 5 }],
          'en',
          'simulation',
          new Date(),
          0.85
        )
      );

      useCase = new TranscribeAudioUseCase(
        mockRepository,
        mockPrimaryService,
        mockFallbackService
      );

      const result = await useCase.execute('session-123');

      expect(result.transcription?.fullText).toBe('Fallback transcription');
      expect(result.transcription?.provider).toBe('simulation');
    });

    it('should allow re-transcription with different options', async () => {
      const session = createSampleSession({
        id: 'session-123',
        transcription: createSampleTranscription(),
      });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      await useCase.reTranscribe('session-123', { language: 'de' });

      expect(mockPrimaryService.transcribe).toHaveBeenCalledWith(
        session.recordingPath,
        { language: 'de' }
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty audio file path', async () => {
      const session = createSampleSession({
        id: 'session-123',
        audioFilePath: '',
        transcription: undefined,
      });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      await useCase.execute('session-123');

      expect(mockPrimaryService.transcribe).toHaveBeenCalledWith('', undefined);
    });

    it('should handle very long transcription text', async () => {
      const session = createSampleSession({ id: 'session-123', transcription: undefined });
      mockRepository.findById = vi.fn().mockResolvedValue(session);

      const longText = 'A'.repeat(100000);
      const longTranscription = new Transcription(
        longText,
        [{ text: longText, startTime: 0, endTime: 3600 }],
        'en',
        'assemblyai',
        new Date(),
        0.9
      );
      mockPrimaryService.transcribe = vi.fn().mockResolvedValue(longTranscription);

      useCase = new TranscribeAudioUseCase(mockRepository, mockPrimaryService);

      const result = await useCase.execute('session-123');

      expect(result.transcription?.fullText.length).toBe(100000);
    });
  });
});
