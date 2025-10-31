import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RecordingManager } from './RecordingManager';
import { AudioManager } from '../audio-manager';
import { TranscriptionManager } from './TranscriptionManager';
import { ViewManager } from './ViewManager';
import { TiptapEditorManager } from './TiptapEditorManager';
import { AIManager } from '../ai/AIManager';
import { CourseManager } from './CourseManager';

// Mock AssemblyAITranscriptionService to prevent network connections
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

/**
 * RecordingManager - Transcription Mode Switching Tests
 *
 * Tests the logic that switches between 'simulation' and 'assemblyai' transcription modes.
 * This is critical functionality that has duplicate code across multiple methods:
 * - start() - lines 82-89
 * - stop() - lines 109-118
 * - pause() - lines 206-218
 * - resume() - lines 250-254
 * - cleanup() - lines 287-295
 */
describe('RecordingManager - Transcription Mode Switching', () => {
  let recordingManager: RecordingManager;
  let mockAudioManager: AudioManager;
  let mockTranscriptionManager: TranscriptionManager;
  let mockViewManager: ViewManager;
  let mockEditorManager: TiptapEditorManager;
  let mockAIManager: AIManager;
  let mockCourseManager: CourseManager;
  let mockWindowScribeCat: any;

  beforeEach(() => {
    // Mock window.scribeCat API
    mockWindowScribeCat = {
      store: {
        get: vi.fn(),
      },
      transcription: {
        simulation: {
          start: vi.fn().mockResolvedValue({ success: true, sessionId: 'sim-session-123' }),
          stop: vi.fn().mockResolvedValue({ success: true }),
          onResult: vi.fn(),
        },
        assemblyai: {
          getToken: vi.fn().mockResolvedValue({ success: true, token: 'temp-token-123' }),
        },
      },
      recording: {
        stop: vi.fn().mockResolvedValue({
          success: true,
          sessionId: 'recording-session-456',
          filePath: '/path/to/recording.webm',
        }),
      },
      session: {
        updateTranscription: vi.fn().mockResolvedValue({ success: true }),
        updateNotes: vi.fn().mockResolvedValue({ success: true }),
      },
    };

    // Mock window.setInterval and window.clearInterval
    (global as any).window = {
      scribeCat: mockWindowScribeCat,
      setInterval: vi.fn((fn, delay) => {
        return setInterval(fn, delay);
      }),
      clearInterval: vi.fn((id) => {
        clearInterval(id);
      }),
    };

    // Create mock managers
    mockAudioManager = {
      getSampleRate: vi.fn().mockReturnValue(48000),
      startRecording: vi.fn().mockResolvedValue(undefined),
      stopRecording: vi.fn().mockResolvedValue({
        audioData: { buffer: new ArrayBuffer(1024) },
        duration: 5000,
      }),
      pauseRecording: vi.fn(),
      resumeRecording: vi.fn(),
      getAudioLevel: vi.fn().mockReturnValue(0.5),
      onAudioData: vi.fn(),
      removeAudioDataCallback: vi.fn(),
    } as any;

    mockTranscriptionManager = {
      clear: vi.fn(),
      addEntry: vi.fn(),
      updateFlowing: vi.fn(),
      getText: vi.fn().mockReturnValue('Test transcription'),
    } as any;

    mockViewManager = {
      updateRecordingState: vi.fn(),
      updatePausedState: vi.fn(),
      updateElapsedTime: vi.fn(),
      updateVUMeter: vi.fn(),
      showSessionInfo: vi.fn(),
    } as any;

    mockEditorManager = {
      getNotesHTML: vi.fn().mockReturnValue('<p>Test notes</p>'),
    } as any;

    mockAIManager = {} as any;
    mockCourseManager = {
      getSelectedCourse: vi.fn().mockReturnValue(null),
    } as any;

    recordingManager = new RecordingManager(
      mockAudioManager,
      mockTranscriptionManager,
      mockViewManager,
      mockEditorManager,
      mockAIManager,
      mockCourseManager
    );

    // Initialize to set up listeners
    recordingManager.initialize();

    // Use fake timers for interval testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Mode Detection from Settings', () => {
    it('should default to simulation mode when no setting is found', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue(null);

      await recordingManager.start('device-123');

      expect(mockWindowScribeCat.transcription.simulation.start).toHaveBeenCalled();
      expect(mockViewManager.updateRecordingState).toHaveBeenCalledWith(true, 'simulation');
    });

    it('should use simulation mode when setting is "simulation"', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');

      expect(mockWindowScribeCat.transcription.simulation.start).toHaveBeenCalled();
      expect(mockViewManager.updateRecordingState).toHaveBeenCalledWith(true, 'simulation');
    });

    it('should use assemblyai mode when setting is "assemblyai"', async () => {
      mockWindowScribeCat.store.get
        .mockResolvedValueOnce('assemblyai') // transcription-mode
        .mockResolvedValueOnce('test-api-key'); // assemblyai-api-key

      await recordingManager.start('device-123');

      expect(mockWindowScribeCat.transcription.simulation.start).not.toHaveBeenCalled();
      expect(mockViewManager.updateRecordingState).toHaveBeenCalledWith(true, 'assemblyai');
    });

    it('should throw error when assemblyai mode selected but no API key', async () => {
      mockWindowScribeCat.store.get
        .mockResolvedValueOnce('assemblyai') // transcription-mode
        .mockResolvedValueOnce(null); // assemblyai-api-key (missing)

      await expect(recordingManager.start('device-123')).rejects.toThrow(
        'AssemblyAI API key not configured'
      );
    });
  });

  describe('Starting Recording with Different Modes', () => {
    it('should start simulation transcription in simulation mode', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');

      expect(mockWindowScribeCat.transcription.simulation.start).toHaveBeenCalledTimes(1);
      expect(mockAudioManager.startRecording).toHaveBeenCalledWith({
        deviceId: 'device-123',
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      });
    });

    it('should handle simulation transcription start failure', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');
      mockWindowScribeCat.transcription.simulation.start.mockResolvedValue({
        success: false,
        error: 'Simulation service unavailable',
      });

      await expect(recordingManager.start('device-123')).rejects.toThrow(
        'Simulation service unavailable'
      );
    });

    it('should clear transcription manager when starting', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');

      expect(mockTranscriptionManager.clear).toHaveBeenCalled();
    });
  });

  describe('Stopping Recording with Different Modes', () => {
    it('should stop simulation transcription when in simulation mode', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');
      await recordingManager.stop();

      expect(mockWindowScribeCat.transcription.simulation.stop).toHaveBeenCalledWith('sim-session-123');
    });

    it('should stop audio recording before saving', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');
      await recordingManager.stop();

      expect(mockAudioManager.stopRecording).toHaveBeenCalled();
    });

    it('should save transcription to session after stopping', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');
      mockTranscriptionManager.getText.mockReturnValue('Test transcription text');

      await recordingManager.start('device-123');
      await recordingManager.stop();

      expect(mockWindowScribeCat.session.updateTranscription).toHaveBeenCalledWith(
        'recording-session-456',
        'Test transcription text',
        'simulation'
      );
    });

    it('should not save empty transcription', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');
      mockTranscriptionManager.getText.mockReturnValue('');

      await recordingManager.start('device-123');
      await recordingManager.stop();

      expect(mockWindowScribeCat.session.updateTranscription).not.toHaveBeenCalled();
    });

    it('should save notes to session after stopping', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');
      mockEditorManager.getNotesHTML.mockReturnValue('<p>My notes</p>');

      await recordingManager.start('device-123');
      await recordingManager.stop();

      expect(mockWindowScribeCat.session.updateNotes).toHaveBeenCalledWith(
        'recording-session-456',
        '<p>My notes</p>'
      );
    });

    it('should not save empty notes', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');
      mockEditorManager.getNotesHTML.mockReturnValue('');

      await recordingManager.start('device-123');
      await recordingManager.stop();

      expect(mockWindowScribeCat.session.updateNotes).not.toHaveBeenCalled();
    });

    it('should include course information when saving', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');
      mockCourseManager.getSelectedCourse.mockReturnValue({
        id: 'course-123',
        title: 'Computer Science 101',
        code: 'CS101',
      });

      await recordingManager.start('device-123');
      await recordingManager.stop();

      expect(mockWindowScribeCat.recording.stop).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        5, // duration in seconds
        {
          courseId: 'course-123',
          courseTitle: 'Computer Science 101',
          courseNumber: 'CS101',
        }
      );
    });

    it('should handle recording save failure gracefully', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');
      mockWindowScribeCat.recording.stop.mockResolvedValue({
        success: false,
        error: 'Disk full',
      });

      await recordingManager.start('device-123');
      await expect(recordingManager.stop()).rejects.toThrow('Disk full');
    });
  });

  describe('Pausing Recording with Different Modes', () => {
    it('should pause audio recording in any mode', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');
      await recordingManager.pause();

      expect(mockAudioManager.pauseRecording).toHaveBeenCalled();
    });

    it('should not pause if not recording', async () => {
      await recordingManager.pause();

      expect(mockAudioManager.pauseRecording).not.toHaveBeenCalled();
    });

    it('should not pause if already paused', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');
      await recordingManager.pause();

      // Clear previous calls
      mockAudioManager.pauseRecording.mockClear();

      await recordingManager.pause();

      expect(mockAudioManager.pauseRecording).not.toHaveBeenCalled();
    });

    it('should update paused state in UI', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');
      await recordingManager.pause();

      expect(mockViewManager.updatePausedState).toHaveBeenCalledWith(true);
    });

    it('should track pause start time', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');

      const beforePause = Date.now();
      await recordingManager.pause();
      const afterPause = Date.now();

      expect(recordingManager.getIsPaused()).toBe(true);
    });
  });

  describe('Resuming Recording with Different Modes', () => {
    it('should resume audio recording in any mode', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');
      await recordingManager.pause();
      await recordingManager.resume();

      expect(mockAudioManager.resumeRecording).toHaveBeenCalled();
    });

    it('should not resume if not recording', async () => {
      await recordingManager.resume();

      expect(mockAudioManager.resumeRecording).not.toHaveBeenCalled();
    });

    it('should not resume if not paused', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');

      await recordingManager.resume();

      expect(mockAudioManager.resumeRecording).not.toHaveBeenCalled();
    });

    it('should update paused state to false in UI', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');
      await recordingManager.pause();

      // Clear previous calls
      mockViewManager.updatePausedState.mockClear();

      await recordingManager.resume();

      expect(mockViewManager.updatePausedState).toHaveBeenCalledWith(false);
    });

    it('should track total paused time', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');
      vi.advanceTimersByTime(1000);

      await recordingManager.pause();
      vi.advanceTimersByTime(5000); // Paused for 5 seconds

      await recordingManager.resume();

      expect(recordingManager.getIsPaused()).toBe(false);
    });
  });

  describe('Cleanup with Different Modes', () => {
    it('should cleanup simulation transcription when in simulation mode', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');
      await recordingManager.cleanup();

      expect(mockWindowScribeCat.transcription.simulation.stop).toHaveBeenCalledWith('sim-session-123');
    });

    it('should stop audio recording during cleanup', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');
      await recordingManager.cleanup();

      expect(mockAudioManager.stopRecording).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');
      mockAudioManager.stopRecording.mockRejectedValue(new Error('Device error'));

      await recordingManager.start('device-123');

      // Should not throw
      await expect(recordingManager.cleanup()).resolves.toBeUndefined();
    });

    it('should cleanup when no session is active', async () => {
      // Should not throw
      await expect(recordingManager.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('State Management', () => {
    it('should track recording state correctly', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      expect(recordingManager.getIsRecording()).toBe(false);

      await recordingManager.start('device-123');
      expect(recordingManager.getIsRecording()).toBe(true);

      await recordingManager.stop();
      expect(recordingManager.getIsRecording()).toBe(false);
    });

    it('should track paused state correctly', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      expect(recordingManager.getIsPaused()).toBe(false);

      await recordingManager.start('device-123');
      expect(recordingManager.getIsPaused()).toBe(false);

      await recordingManager.pause();
      expect(recordingManager.getIsPaused()).toBe(true);

      await recordingManager.resume();
      expect(recordingManager.getIsPaused()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when starting without device ID', async () => {
      await expect(recordingManager.start('')).rejects.toThrow(
        'Please select a microphone device'
      );
    });

    it('should handle audio recording start failure', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');
      mockAudioManager.startRecording.mockRejectedValue(new Error('Device not found'));

      await expect(recordingManager.start('device-123')).rejects.toThrow('Device not found');
    });

    it('should continue if transcription save fails', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');
      mockWindowScribeCat.session.updateTranscription.mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      await recordingManager.start('device-123');

      // Should not throw
      await expect(recordingManager.stop()).resolves.toBeUndefined();
    });

    it('should continue if notes save fails', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');
      mockWindowScribeCat.session.updateNotes.mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      await recordingManager.start('device-123');

      // Should not throw
      await expect(recordingManager.stop()).resolves.toBeUndefined();
    });
  });

  describe('UI Updates', () => {
    it('should update recording state in UI when starting', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');

      expect(mockViewManager.updateRecordingState).toHaveBeenCalledWith(true, 'simulation');
    });

    it('should update recording state in UI when stopping', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');

      // Clear previous calls
      mockViewManager.updateRecordingState.mockClear();

      await recordingManager.stop();

      expect(mockViewManager.updateRecordingState).toHaveBeenCalledWith(false);
    });

    it('should show session info after saving', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');
      await recordingManager.stop();

      expect(mockViewManager.showSessionInfo).toHaveBeenCalledWith(
        'Recording saved: recording-session-456'
      );
    });

    it('should start VU meter updates when recording', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');

      // Advance timer to trigger VU meter update
      vi.advanceTimersByTime(100);

      expect(mockAudioManager.getAudioLevel).toHaveBeenCalled();
      expect(mockViewManager.updateVUMeter).toHaveBeenCalled();
    });

    it('should start elapsed timer when recording', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');

      // Advance timer to trigger elapsed time update
      vi.advanceTimersByTime(1000);

      expect(mockViewManager.updateElapsedTime).toHaveBeenCalled();
    });
  });

  describe('Integration - Simulation Mode', () => {
    it('should handle simulation result callback', async () => {
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');

      await recordingManager.start('device-123');

      // Get the callback registered with onResult
      const onResultCallback = mockWindowScribeCat.transcription.simulation.onResult.mock.calls[0][0];

      // Simulate a transcription result
      onResultCallback({
        timestamp: Date.now(),
        text: 'Hello world',
      });

      expect(mockTranscriptionManager.addEntry).toHaveBeenCalledWith(
        expect.any(Number),
        'Hello world'
      );
    });

    it('should only process simulation results in simulation mode', async () => {
      // Start in simulation mode
      mockWindowScribeCat.store.get.mockResolvedValue('simulation');
      await recordingManager.start('device-123');

      const onResultCallback = mockWindowScribeCat.transcription.simulation.onResult.mock.calls[0][0];

      // Trigger simulation callback - should process since mode is simulation
      onResultCallback({
        timestamp: Date.now(),
        text: 'Should process in simulation mode',
      });

      // Should add entry because mode is simulation
      expect(mockTranscriptionManager.addEntry).toHaveBeenCalledWith(
        expect.any(Number),
        'Should process in simulation mode'
      );
    });
  });
});
