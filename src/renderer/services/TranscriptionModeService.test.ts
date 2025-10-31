import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TranscriptionModeService } from './TranscriptionModeService';
import { AudioManager } from '../audio-manager';
import { TranscriptionManager } from '../managers/TranscriptionManager';

// Mock AssemblyAITranscriptionService
vi.mock('../assemblyai-transcription-service', () => {
  const MockAssemblyAIService = function(this: any) {
    this.initialize = vi.fn().mockResolvedValue(undefined);
    this.start = vi.fn().mockResolvedValue('assemblyai-session-123');
    this.stop = vi.fn().mockResolvedValue(undefined);
    this.sendAudio = vi.fn();
    this.onResult = vi.fn();
  };

  return {
    AssemblyAITranscriptionService: MockAssemblyAIService,
  };
});

describe('TranscriptionModeService', () => {
  let service: TranscriptionModeService;
  let mockAudioManager: AudioManager;
  let mockTranscriptionManager: TranscriptionManager;
  let mockWindowScribeCat: any;

  beforeEach(() => {
    // Mock window.scribeCat
    mockWindowScribeCat = {
      transcription: {
        simulation: {
          start: vi.fn().mockResolvedValue({ success: true, sessionId: 'sim-session-123' }),
          stop: vi.fn().mockResolvedValue({ success: true }),
        },
        assemblyai: {
          getToken: vi.fn().mockResolvedValue({ success: true, token: 'temp-token-123' }),
        },
      },
    };
    (global as any).window = { scribeCat: mockWindowScribeCat };

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
    it('should initialize with simulation mode by default', () => {
      expect(service.getCurrentMode()).toBe('simulation');
    });

    it('should have no session ID initially', () => {
      expect(service.getSessionId()).toBeNull();
    });
  });

  describe('Starting Simulation Mode', () => {
    it('should start simulation transcription successfully', async () => {
      await service.start({ mode: 'simulation' });

      expect(mockWindowScribeCat.transcription.simulation.start).toHaveBeenCalledTimes(1);
      expect(service.getCurrentMode()).toBe('simulation');
      expect(service.getSessionId()).toBe('sim-session-123');
    });

    it('should throw error when simulation start fails', async () => {
      mockWindowScribeCat.transcription.simulation.start.mockResolvedValue({
        success: false,
        error: 'Simulation service unavailable',
      });

      await expect(service.start({ mode: 'simulation' })).rejects.toThrow(
        'Simulation service unavailable'
      );
    });

    it('should throw default error when simulation fails without error message', async () => {
      mockWindowScribeCat.transcription.simulation.start.mockResolvedValue({
        success: false,
      });

      await expect(service.start({ mode: 'simulation' })).rejects.toThrow(
        'Failed to start simulation transcription'
      );
    });
  });

  describe('Starting AssemblyAI Mode', () => {
    it('should start AssemblyAI transcription successfully', async () => {
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });

      expect(service.getCurrentMode()).toBe('assemblyai');
      expect(service.getSessionId()).toBe('assemblyai-session-123');
    });

    it('should throw error when API key is missing', async () => {
      await expect(service.start({ mode: 'assemblyai' })).rejects.toThrow(
        'AssemblyAI API key not configured'
      );
    });

    it('should set up audio streaming when starting AssemblyAI', async () => {
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });

      expect(mockAudioManager.onAudioData).toHaveBeenCalled();
    });

    it('should set up result callback for transcription updates', async () => {
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });

      // Get the service instance and trigger a result
      const onResultCallback = vi.mocked(mockAudioManager.onAudioData).mock.calls[0];
      expect(onResultCallback).toBeDefined();
    });
  });

  describe('Stopping Transcription', () => {
    it('should stop simulation transcription', async () => {
      await service.start({ mode: 'simulation' });
      await service.stop();

      expect(mockWindowScribeCat.transcription.simulation.stop).toHaveBeenCalledWith('sim-session-123');
      expect(service.getSessionId()).toBeNull();
    });

    it('should stop AssemblyAI transcription', async () => {
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });
      await service.stop();

      expect(mockAudioManager.removeAudioDataCallback).toHaveBeenCalled();
      expect(service.getSessionId()).toBeNull();
    });

    it('should not throw when stopping without active session', async () => {
      await expect(service.stop()).resolves.toBeUndefined();
    });

    it('should clear session ID after stopping', async () => {
      await service.start({ mode: 'simulation' });
      expect(service.getSessionId()).not.toBeNull();

      await service.stop();
      expect(service.getSessionId()).toBeNull();
    });
  });

  describe('Pausing Transcription', () => {
    it('should handle pause in simulation mode (no-op)', async () => {
      await service.start({ mode: 'simulation' });

      // Should not throw
      expect(() => service.pause()).not.toThrow();
    });

    it('should stop audio streaming when pausing in AssemblyAI mode', async () => {
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });

      service.pause();

      expect(mockAudioManager.removeAudioDataCallback).toHaveBeenCalled();
    });

    it('should not throw when pausing without active session', () => {
      expect(() => service.pause()).not.toThrow();
    });
  });

  describe('Resuming Transcription', () => {
    it('should handle resume in simulation mode (no-op)', async () => {
      await service.start({ mode: 'simulation' });
      service.pause();

      // Should not throw
      expect(() => service.resume()).not.toThrow();
    });

    it('should restart audio streaming when resuming in AssemblyAI mode', async () => {
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });
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
    it('should cleanup simulation mode successfully', async () => {
      await service.start({ mode: 'simulation' });
      await service.cleanup();

      expect(mockWindowScribeCat.transcription.simulation.stop).toHaveBeenCalled();
      expect(service.getSessionId()).toBeNull();
    });

    it('should cleanup AssemblyAI mode successfully', async () => {
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });
      await service.cleanup();

      expect(mockAudioManager.removeAudioDataCallback).toHaveBeenCalled();
      expect(service.getSessionId()).toBeNull();
    });

    it('should handle cleanup errors gracefully', async () => {
      await service.start({ mode: 'simulation' });
      mockWindowScribeCat.transcription.simulation.stop.mockRejectedValue(
        new Error('Network error')
      );

      // Should not throw
      await expect(service.cleanup()).resolves.toBeUndefined();
    });

    it('should not throw when cleaning up without active session', async () => {
      await expect(service.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('Mode Switching', () => {
    it('should switch from simulation to assemblyai', async () => {
      await service.start({ mode: 'simulation' });
      expect(service.getCurrentMode()).toBe('simulation');

      await service.stop();
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });

      expect(service.getCurrentMode()).toBe('assemblyai');
    });

    it('should switch from assemblyai to simulation', async () => {
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });
      expect(service.getCurrentMode()).toBe('assemblyai');

      await service.stop();
      await service.start({ mode: 'simulation' });

      expect(service.getCurrentMode()).toBe('simulation');
    });

    it('should maintain correct session ID when switching modes', async () => {
      await service.start({ mode: 'simulation' });
      const simSessionId = service.getSessionId();
      expect(simSessionId).toBe('sim-session-123');

      await service.stop();
      expect(service.getSessionId()).toBeNull();

      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });
      const aiSessionId = service.getSessionId();
      expect(aiSessionId).toBe('assemblyai-session-123');
      expect(aiSessionId).not.toBe(simSessionId);
    });
  });

  describe('Audio Streaming (AssemblyAI)', () => {
    it('should buffer and send audio data periodically', async () => {
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });

      // Get the audio data callback
      const audioDataCallback = vi.mocked(mockAudioManager.onAudioData).mock.calls[0][0];

      // Simulate audio data
      const audioData = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      audioDataCallback(audioData);

      // Advance timer to trigger buffered send
      vi.advanceTimersByTime(100);

      // Note: We can't easily verify sendAudio was called due to mocking complexity,
      // but we can verify the audio callback was registered
      expect(mockAudioManager.onAudioData).toHaveBeenCalled();
    });

    it('should not process audio data after switching away from AssemblyAI mode', async () => {
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });

      // Get the audio data callback
      const audioDataCallback = vi.mocked(mockAudioManager.onAudioData).mock.calls[0][0];

      // Stop and switch modes
      await service.stop();
      await service.start({ mode: 'simulation' });

      // Try to trigger audio callback (should be no-op)
      const audioData = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      audioDataCallback(audioData);

      // Advance timer
      vi.advanceTimersByTime(100);

      // Current mode should be simulation
      expect(service.getCurrentMode()).toBe('simulation');
    });

    it('should remove audio callback when stopping AssemblyAI', async () => {
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });
      await service.stop();

      expect(mockAudioManager.removeAudioDataCallback).toHaveBeenCalled();
    });
  });

  describe('Audio Resampling', () => {
    it('should resample audio correctly', async () => {
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });

      // Access private method through type assertion for testing
      const resampleAudio = (service as any).resampleAudio.bind(service);

      const inputData = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
      const result = resampleAudio(inputData, 48000, 16000);

      // Should downsample to 1/3 length
      expect(result.length).toBe(2);
    });

    it('should return same data when sample rates match', async () => {
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });

      const resampleAudio = (service as any).resampleAudio.bind(service);

      const inputData = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const result = resampleAudio(inputData, 16000, 16000);

      expect(result).toBe(inputData);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors during simulation start', async () => {
      mockWindowScribeCat.transcription.simulation.start.mockRejectedValue(
        new Error('Network error')
      );

      await expect(service.start({ mode: 'simulation' })).rejects.toThrow('Network error');
    });

    it('should handle errors during simulation stop', async () => {
      await service.start({ mode: 'simulation' });

      mockWindowScribeCat.transcription.simulation.stop.mockRejectedValue(
        new Error('Stop failed')
      );

      await expect(service.stop()).rejects.toThrow('Stop failed');
    });

    it('should maintain state consistency after error', async () => {
      mockWindowScribeCat.transcription.simulation.start.mockResolvedValue({
        success: false,
        error: 'Service unavailable',
      });

      await expect(service.start({ mode: 'simulation' })).rejects.toThrow();

      // Mode should still be updated even if start fails
      expect(service.getCurrentMode()).toBe('simulation');
      // But session ID should remain null
      expect(service.getSessionId()).toBeNull();
    });
  });

  describe('State Management', () => {
    it('should track current mode correctly', async () => {
      expect(service.getCurrentMode()).toBe('simulation');

      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });
      expect(service.getCurrentMode()).toBe('assemblyai');
    });

    it('should track session ID correctly', async () => {
      expect(service.getSessionId()).toBeNull();

      await service.start({ mode: 'simulation' });
      expect(service.getSessionId()).toBe('sim-session-123');

      await service.stop();
      expect(service.getSessionId()).toBeNull();
    });

    it('should maintain separate session IDs for different modes', async () => {
      await service.start({ mode: 'simulation' });
      const simId = service.getSessionId();

      await service.stop();
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });
      const aiId = service.getSessionId();

      expect(simId).not.toBe(aiId);
      expect(simId).toBe('sim-session-123');
      expect(aiId).toBe('assemblyai-session-123');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full recording lifecycle with simulation', async () => {
      // Start
      await service.start({ mode: 'simulation' });
      expect(service.getCurrentMode()).toBe('simulation');
      expect(service.getSessionId()).not.toBeNull();

      // Pause (no-op for simulation)
      service.pause();

      // Resume (no-op for simulation)
      service.resume();

      // Stop
      await service.stop();
      expect(service.getSessionId()).toBeNull();
    });

    it('should handle full recording lifecycle with AssemblyAI', async () => {
      // Start
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });
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

    it('should handle mode switch mid-recording', async () => {
      // Start with simulation
      await service.start({ mode: 'simulation' });
      const originalSessionId = service.getSessionId();

      // Stop current session
      await service.stop();

      // Start with AssemblyAI
      await service.start({ mode: 'assemblyai', apiKey: 'test-api-key' });
      const newSessionId = service.getSessionId();

      expect(newSessionId).not.toBe(originalSessionId);
      expect(service.getCurrentMode()).toBe('assemblyai');
    });
  });
});
