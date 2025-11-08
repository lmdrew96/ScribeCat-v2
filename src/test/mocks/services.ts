/**
 * Mock implementations of service interfaces for testing
 */

import { vi } from 'vitest';
import type { ITranscriptionService } from '../../domain/services/ITranscriptionService';
import { Transcription } from '../../domain/entities/Transcription';

/**
 * Create a mock TranscriptionService
 */
export const createMockTranscriptionService = (
  overrides: Partial<ITranscriptionService> = {}
): ITranscriptionService => ({
  isAvailable: vi.fn().mockResolvedValue(true),
  transcribe: vi.fn().mockResolvedValue(
    new Transcription(
      'Mock transcription text',
      [
        {
          text: 'Mock transcription text',
          startTime: 0,
          endTime: 5,
          confidence: 0.95
        }
      ],
      'en',
      'assemblyai',
      new Date(),
      0.95
    )
  ),
  getProviderName: vi.fn().mockReturnValue('assemblyai'),
  ...overrides,
});
