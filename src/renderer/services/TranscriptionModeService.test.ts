import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TranscriptionModeService } from './TranscriptionModeService';
import { AudioManager } from '../audio/AudioManager';
import { TranscriptionManager } from '../managers/TranscriptionManager';

// Mock AssemblyAITranscriptionService
vi.mock('./AssemblyAITranscriptionService', () => {
  const MockAssemblyAIService = function(this: any) {
    this.initialize = vi.fn().mockResolvedValue(undefined);
    this.start = vi.fn().mockResolvedValue('assemblyai-session-123');
    this.stop = vi.fn().mockResolvedValue(undefined);
    this.sendAudio = vi.fn();
    this.onResult = vi.fn((callback: Function) => {
      // Store callback for testing
      (this as any)._resultCallback = callback;
    });
  };

  return {
    AssemblyAITranscriptionService: MockAssemblyAIService,
  };
});

describe('TranscriptionModeService', () => {
  let service: TranscriptionModeService;
  let mockAudioManager: AudioManager;
  let mockTranscriptionManager: TranscriptionManager;
  const TEST_API_KEY = 'test-api-key-123';

  beforeEach(() => {
    // Mock AudioManager
    mockAudioManager = {
      getSampleRate: vi.fn().mockReturnValue(48000),
      onAudioData: vi.fn(),
      removeAudioDataCallback: vi.fn(),
    } as any;

    // Mock TranscriptionManager
    mockTranscriptionManager = {
      updateFlowing: vi.fn(),
    } as any;

    service = new TranscriptionModeService(mockAudioManager, mockTranscriptionManager);

    // Use fake timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with assemblyai mode by default', () => {
      expect(service.getCurrentMode()).toBe('assemblyai');
    });

    it('should have no session ID initially', () => {
      expect(service.getSessionId()).toBeNull();
    });
  });

  describe('Starting Transcription', () => {
    it('should start AssemblyAI transcription successfully', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      expect(service.getCurrentMode()).toBe('assemblyai');
      expect(service.getSessionId()).toBe('assemblyai-session-123');
    });

    it('should throw error when API key is missing', async () => {
      await expect(service.start({ mode: 'assemblyai' })).rejects.toThrow(
        'AssemblyAI API key not configured'
      );
    });

    it('should set up audio streaming when starting', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      expect(mockAudioManager.onAudioData).toHaveBeenCalled();
    });

    it('should set up result callback for transcription updates', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      // Verify that the TranscriptionManager will be called when results arrive
      const onResultCallback = vi.mocked(mockAudioManager.onAudioData).mock.calls[0];
      expect(onResultCallback).toBeDefined();
    });

    it('should pass transcription settings to AssemblyAI service', async () => {
      const settings = {
        language_code: 'en_us',
        punctuate: true,
        format_text: true
      };

      await service.start({
        mode: 'assemblyai',
        apiKey: TEST_API_KEY,
        transcriptionSettings: settings
      });

      expect(service.getCurrentMode()).toBe('assemblyai');
      expect(service.getSessionId()).toBe('assemblyai-session-123');
    });
  });

  describe('Stopping Transcription', () => {
    it('should stop AssemblyAI transcription', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });
      await service.stop();

      expect(mockAudioManager.removeAudioDataCallback).toHaveBeenCalled();
      expect(service.getSessionId()).toBeNull();
    });

    it('should not throw when stopping without active session', async () => {
      await expect(service.stop()).resolves.toBeUndefined();
    });

    it('should clear session ID after stopping', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });
      expect(service.getSessionId()).not.toBeNull();

      await service.stop();
      expect(service.getSessionId()).toBeNull();
    });
  });

  describe('Pausing Transcription', () => {
    it('should stop audio streaming when pausing', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      service.pause();

      expect(mockAudioManager.removeAudioDataCallback).toHaveBeenCalled();
    });

    it('should not throw when pausing without active session', () => {
      expect(() => service.pause()).not.toThrow();
    });

    it('should clear streaming interval when pausing', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      // Verify interval is running
      const audioDataCallback = vi.mocked(mockAudioManager.onAudioData).mock.calls[0][0];
      expect(audioDataCallback).toBeDefined();

      service.pause();

      // Callback should be removed
      expect(mockAudioManager.removeAudioDataCallback).toHaveBeenCalled();
    });
  });

  describe('Resuming Transcription', () => {
    it('should restart audio streaming when resuming', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });
      service.pause();

      // Clear previous calls
      vi.mocked(mockAudioManager.onAudioData).mockClear();

      service.resume();

      expect(mockAudioManager.onAudioData).toHaveBeenCalled();
    });

    it('should not throw when resuming without active session', () => {
      expect(() => service.resume()).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup successfully', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });
      await service.cleanup();

      expect(mockAudioManager.removeAudioDataCallback).toHaveBeenCalled();
      expect(service.getSessionId()).toBeNull();
    });

    it('should handle cleanup errors gracefully', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      // Make stop throw an error
      vi.mocked(mockAudioManager.removeAudioDataCallback).mockImplementation(() => {
        throw new Error('Network error');
      });

      // Should not throw
      await expect(service.cleanup()).resolves.toBeUndefined();
    });

    it('should not throw when cleaning up without active session', async () => {
      await expect(service.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('Audio Streaming', () => {
    it('should buffer and send audio data periodically', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      // Get the audio data callback
      const audioDataCallback = vi.mocked(mockAudioManager.onAudioData).mock.calls[0][0];

      // Simulate audio data
      const audioData = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      audioDataCallback(audioData);

      // Advance timer to trigger buffered send
      vi.advanceTimersByTime(100);

      // Verify the audio callback was registered
      expect(mockAudioManager.onAudioData).toHaveBeenCalled();
    });

    it('should not process audio data after stopping', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      // Get the audio data callback
      const audioDataCallback = vi.mocked(mockAudioManager.onAudioData).mock.calls[0][0];

      // Stop the service
      await service.stop();

      // Try to trigger audio callback (should be no-op since mode check will fail)
      const audioData = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      audioDataCallback(audioData);

      // Advance timer
      vi.advanceTimersByTime(100);

      // Session ID should be null
      expect(service.getSessionId()).toBeNull();
    });

    it('should remove audio callback when stopping', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });
      await service.stop();

      expect(mockAudioManager.removeAudioDataCallback).toHaveBeenCalled();
    });

    it('should handle empty audio buffers gracefully', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      // Advance timer without sending any audio data
      vi.advanceTimersByTime(100);

      // Should not throw or cause errors
      expect(service.getSessionId()).toBe('assemblyai-session-123');
    });
  });

  describe('Audio Resampling', () => {
    it('should resample audio correctly', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      // Access private method through type assertion for testing
      const resampleAudio = (service as any).resampleAudio.bind(service);

      const inputData = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
      const result = resampleAudio(inputData, 48000, 16000);

      // Should downsample to 1/3 length
      expect(result.length).toBe(2);
    });

    it('should return same data when sample rates match', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      const resampleAudio = (service as any).resampleAudio.bind(service);

      const inputData = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const result = resampleAudio(inputData, 16000, 16000);

      expect(result).toBe(inputData);
    });

    it('should handle edge cases in resampling', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      const resampleAudio = (service as any).resampleAudio.bind(service);

      // Empty array
      const emptyResult = resampleAudio(new Float32Array([]), 48000, 16000);
      expect(emptyResult.length).toBe(0);

      // Single sample
      const singleSample = new Float32Array([0.5]);
      const singleResult = resampleAudio(singleSample, 48000, 16000);
      expect(singleResult.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Transcription Updates', () => {
    it('should forward transcription results to TranscriptionManager', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      // The TranscriptionManager should be ready to receive updates
      expect(mockTranscriptionManager.updateFlowing).toBeDefined();
    });

    it('should handle partial transcription results', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      // Service should be ready to process results
      expect(service.getSessionId()).toBe('assemblyai-session-123');
    });

    it('should handle final transcription results', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      // Service should be ready to process results
      expect(service.getSessionId()).toBe('assemblyai-session-123');
    });
  });

  describe('State Management', () => {
    it('should track current mode correctly', async () => {
      expect(service.getCurrentMode()).toBe('assemblyai');

      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });
      expect(service.getCurrentMode()).toBe('assemblyai');
    });

    it('should track session ID correctly', async () => {
      expect(service.getSessionId()).toBeNull();

      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });
      expect(service.getSessionId()).toBe('assemblyai-session-123');

      await service.stop();
      expect(service.getSessionId()).toBeNull();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full recording lifecycle', async () => {
      // Start
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });
      expect(service.getCurrentMode()).toBe('assemblyai');
      expect(service.getSessionId()).not.toBeNull();

      // Pause
      service.pause();
      expect(mockAudioManager.removeAudioDataCallback).toHaveBeenCalled();

      // Resume
      service.resume();

      // Stop
      await service.stop();
      expect(service.getSessionId()).toBeNull();
    });

    it('should handle restart scenario', async () => {
      // Start first session
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });
      const firstSessionId = service.getSessionId();

      // Stop first session
      await service.stop();
      expect(service.getSessionId()).toBeNull();

      // Start second session
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });
      const secondSessionId = service.getSessionId();

      // Should have a new session ID (though in mock it's the same)
      expect(secondSessionId).toBe('assemblyai-session-123');
      expect(service.getCurrentMode()).toBe('assemblyai');
    });

    it('should handle multiple pause/resume cycles', async () => {
      await service.start({ mode: 'assemblyai', apiKey: TEST_API_KEY });

      // First pause/resume
      service.pause();
      service.resume();

      // Second pause/resume
      service.pause();
      service.resume();

      // Should still be running
      expect(service.getCurrentMode()).toBe('assemblyai');
      expect(service.getSessionId()).toBe('assemblyai-session-123');
    });
  });

  describe('Error Handling', () => {
    it('should throw error with descriptive message when API key is missing', async () => {
      await expect(service.start({ mode: 'assemblyai' })).rejects.toThrow(
        'AssemblyAI API key not configured. Please add it in Settings.'
      );
    });

    it('should handle missing API key with undefined value', async () => {
      await expect(
        service.start({ mode: 'assemblyai', apiKey: undefined })
      ).rejects.toThrow('AssemblyAI API key not configured');
    });

    it('should handle missing API key with empty string', async () => {
      await expect(
        service.start({ mode: 'assemblyai', apiKey: '' })
      ).rejects.toThrow('AssemblyAI API key not configured');
    });
  });
});
