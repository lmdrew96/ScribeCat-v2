// src/renderer/recording-service.ts

/**
 * Audio recording configuration constants
 */
const RECORDING_CHUNK_INTERVAL_MS = 100; // Capture audio data every 100ms

/**
 * RecordingService
 * 
 * Handles audio recording in the renderer process where navigator.mediaDevices is available.
 * This service manages the MediaRecorder, audio stream, and VU meter calculations.
 * 
 * @example
 * ```typescript
 * const service = new RecordingService();
 * 
 * // Set up audio level monitoring
 * service.onAudioLevel((level) => {
 *   console.log(`Audio level: ${level}%`);
 * });
 * 
 * // Start recording
 * await service.start();
 * 
 * // Stop and get audio blob
 * const audioBlob = await service.stop();
 * ```
 */

/**
 * Status information for an active recording
 */
export interface RecordingStatus {
  /** Whether recording is currently active */
  isRecording: boolean;
  /** Whether recording is paused */
  isPaused: boolean;
  /** Duration of recording in milliseconds (excluding paused time) */
  duration: number;
  /** Timestamp when recording started */
  startTime?: Date;
}

export class RecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number | null = null;
  private pausedTime: number = 0;
  private lastPauseStart: number | null = null;
  private animationFrameId: number | null = null;
  private onAudioLevelCallback: ((level: number) => void) | null = null;

  /**
   * Start recording from the user's microphone
   * 
   * Requests microphone access, sets up audio analysis for VU meter,
   * and begins capturing audio data.
   * 
   * @throws {Error} If microphone access is denied or recording fails to start
   * 
   * @example
   * ```typescript
   * try {
   *   await recordingService.start();
   *   console.log('Recording started');
   * } catch (error) {
   *   console.error('Failed to start recording:', error);
   * }
   * ```
   */
  async start(): Promise<void> {
    try {
      console.log('Requesting microphone access...');
      
      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, // Mono
          sampleRate: 44100,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('Microphone access granted. Stream tracks:', this.audioStream.getTracks().length);
      
      const audioTrack = this.audioStream.getAudioTracks()[0];
      if (audioTrack) {
        console.log('Audio track settings:', audioTrack.getSettings());
        console.log('Audio track state (before unmute):', {
          enabled: audioTrack.enabled,
          muted: audioTrack.muted,
          readyState: audioTrack.readyState,
          label: audioTrack.label
        });
        
        // Ensure track is enabled and not muted
        audioTrack.enabled = true;
        
        console.log('Audio track state (after enabling):', {
          enabled: audioTrack.enabled,
          muted: audioTrack.muted,
          readyState: audioTrack.readyState
        });
      }
      
      // List all available audio input devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        console.log('Available audio input devices:', audioInputs.map(d => ({
          deviceId: d.deviceId,
          label: d.label,
          groupId: d.groupId
        })));
      } catch (err) {
        console.error('Failed to enumerate devices:', err);
      }

      // Set up audio analysis for VU meter
      this.setupAudioAnalysis();

      // Create MediaRecorder
      const options = { mimeType: 'audio/webm;codecs=opus' };
      this.mediaRecorder = new MediaRecorder(this.audioStream, options);
      
      console.log('MediaRecorder created. State:', this.mediaRecorder.state);

      // Clear previous audio chunks
      this.audioChunks = [];

      // Handle data availability
      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        console.log('Data available. Size:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      // Add error handler
      this.mediaRecorder.onerror = (event: Event) => {
        console.error('MediaRecorder error:', event);
      };

      // Start recording
      this.mediaRecorder.start(RECORDING_CHUNK_INTERVAL_MS);
      console.log('MediaRecorder started. State:', this.mediaRecorder.state);
      
      this.startTime = Date.now();
      this.pausedTime = 0;
      this.lastPauseStart = null;

      // Start audio level monitoring
      this.startAudioLevelMonitoring();

    } catch (error) {
      console.error('Failed to start recording:', error);
      this.cleanup();
      throw new Error(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop recording and return the recorded audio blob
   * 
   * Stops the MediaRecorder, cleans up resources, and returns
   * the complete audio recording as a WebM blob.
   * 
   * @returns Promise that resolves to the recorded audio as a Blob
   * @throws {Error} If no active recording exists
   * 
   * @example
   * ```typescript
   * const audioBlob = await recordingService.stop();
   * const arrayBuffer = await audioBlob.arrayBuffer();
   * // Send to main process for saving
   * ```
   */
  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.cleanup();
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Pause the current recording
   * 
   * Pauses audio capture while maintaining the recording session.
   * Duration tracking excludes paused time.
   */
  pause(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.lastPauseStart = Date.now();
      this.stopAudioLevelMonitoring();
    }
  }

  /**
   * Resume a paused recording
   * 
   * Resumes audio capture after a pause. Duration tracking
   * continues from where it left off.
   */
  resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      if (this.lastPauseStart) {
        this.pausedTime += Date.now() - this.lastPauseStart;
        this.lastPauseStart = null;
      }
      this.mediaRecorder.resume();
      this.startAudioLevelMonitoring();
    }
  }

  /**
   * Get current recording status
   * 
   * @returns Current state of the recording including duration and pause status
   */
  getStatus(): RecordingStatus {
    const isRecording = this.mediaRecorder !== null && this.mediaRecorder.state !== 'inactive';
    const isPaused = this.mediaRecorder?.state === 'paused';
    
    let duration = 0;
    if (this.startTime) {
      if (isPaused && this.lastPauseStart) {
        duration = this.lastPauseStart - this.startTime - this.pausedTime;
      } else {
        duration = Date.now() - this.startTime - this.pausedTime;
      }
    }

    return {
      isRecording,
      isPaused,
      duration,
      startTime: this.startTime ? new Date(this.startTime) : undefined
    };
  }

  /**
   * Set callback for audio level updates
   * 
   * Registers a callback to receive real-time audio level updates
   * for VU meter visualization. Levels are provided as percentages (0-100).
   * 
   * @param callback Function to call with audio level updates
   * 
   * @example
   * ```typescript
   * recordingService.onAudioLevel((level) => {
   *   updateVUMeter(level); // Update UI
   * });
   * ```
   */
  onAudioLevel(callback: (level: number) => void): void {
    this.onAudioLevelCallback = callback;
  }

  /**
   * Set up audio analysis for VU meter
   */
  private setupAudioAnalysis(): void {
    if (!this.audioStream) return;

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    
    const source = this.audioContext.createMediaStreamSource(this.audioStream);
    source.connect(this.analyser);
  }

  /**
   * Start monitoring audio levels for VU meter
   */
  private startAudioLevelMonitoring(): void {
    if (!this.analyser) {
      console.warn('No analyser available for audio level monitoring');
      return;
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    console.log('Starting audio level monitoring. Buffer size:', dataArray.length);
    
    const updateLevel = () => {
      if (!this.analyser || !this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate average level
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const level = (average / 255) * 100; // Convert to percentage
      
      // Log occasionally to debug
      if (Math.random() < 0.01) { // Log ~1% of the time
        console.log('Audio level:', level.toFixed(2), '% | Raw average:', average.toFixed(2));
      }
      
      // Send level to callback
      if (this.onAudioLevelCallback) {
        this.onAudioLevelCallback(level);
      }

      this.animationFrameId = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }

  /**
   * Stop monitoring audio levels
   */
  private stopAudioLevelMonitoring(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.stopAudioLevelMonitoring();

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.startTime = null;
    this.pausedTime = 0;
    this.lastPauseStart = null;
  }
}
