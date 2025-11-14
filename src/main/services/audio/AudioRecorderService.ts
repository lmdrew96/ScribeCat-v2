/**
 * AudioRecorderService
 * 
 * Handles audio recording using the Web Audio API and MediaRecorder.
 * This service runs in the renderer process but is managed by the main process via IPC.
 * 
 * Features:
 * - Microphone device selection
 * - Audio enhancements (echo cancellation, noise suppression, auto gain)
 * - Chunk-based recording
 * - WebM audio format output
 */

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: string;
}

export interface RecordingConfig {
  deviceId?: string;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface RecordingResult {
  audioData: Uint8Array;
  duration: number;
  mimeType: string;
}

export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private isRecording: boolean = false;
  private totalPausedTime: number = 0;
  private pauseStartTime: number = 0;

  /**
   * Get list of available audio input devices
   */
  async getAudioDevices(): Promise<AudioDevice[]> {
    try {
      // Request permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());

      // Now enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');

      return audioInputs.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
        kind: device.kind
      }));
    } catch (error) {
      console.error('Error getting audio devices:', error);
      throw new Error(`Failed to get audio devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(config: RecordingConfig = {}): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    try {
      // Configure audio constraints
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: config.deviceId ? { exact: config.deviceId } : undefined,
          echoCancellation: config.echoCancellation ?? true,
          noiseSuppression: config.noiseSuppression ?? true,
          autoGainControl: config.autoGainControl ?? true
        }
      };

      // Get audio stream
      this.audioStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Monitor MediaStream tracks to detect if microphone becomes inactive
      const audioTracks = this.audioStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const track = audioTracks[0];

        console.log(`Audio track initialized: ${track.label} (state: ${track.readyState})`);

        track.onended = () => {
          console.error('❌ Audio track ended unexpectedly - microphone may have been disconnected or blocked');
        };

        track.onmute = () => {
          console.warn('⚠️ Audio track muted - microphone input is muted');
        };

        track.onunmute = () => {
          console.log('✅ Audio track unmuted');
        };
      }

      // Create MediaRecorder with optimized bitrate for speech
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType,
        audioBitsPerSecond: 64000 // 64 kbps - excellent quality for speech, ~30MB per hour
      });

      // Reset chunks
      this.audioChunks = [];

      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Monitor MediaRecorder state changes to detect unexpected pauses/errors
      this.mediaRecorder.onpause = () => {
        // Only warn if this wasn't a user-initiated pause
        if (this.pauseStartTime === 0) {
          console.warn('⚠️ MediaRecorder paused unexpectedly - may be caused by window losing focus');
        }
      };

      this.mediaRecorder.onresume = () => {
        console.log('✅ MediaRecorder resumed');
      };

      this.mediaRecorder.onerror = (event: Event) => {
        console.error('❌ MediaRecorder error:', event);
        // Cast to MediaRecorderErrorEvent to access error property
        const errorEvent = event as any;
        if (errorEvent.error) {
          console.error('Error details:', errorEvent.error);
        }
      };

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.startTime = Date.now();
      this.isRecording = true;
      this.totalPausedTime = 0;
      this.pauseStartTime = 0;

      console.log('Audio recording started');
    } catch (error) {
      this.cleanup();
      console.error('Error starting recording:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Microphone permission denied. Please allow microphone access and try again.');
        } else if (error.name === 'NotFoundError') {
          throw new Error('No microphone found. Please connect a microphone and try again.');
        } else if (error.name === 'NotReadableError') {
          throw new Error('Microphone is being used by another application. Please close other apps and try again.');
        }
      }
      
      throw new Error(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop recording and return audio data
   */
  async stopRecording(): Promise<RecordingResult> {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('No recording in progress');
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not initialized'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          // Calculate duration excluding paused time
          const wallClockTime = Date.now() - this.startTime;
          const duration = wallClockTime - this.totalPausedTime;

          const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder!.mimeType });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioData = new Uint8Array(arrayBuffer);

          const result: RecordingResult = {
            audioData,
            duration,
            mimeType: this.mediaRecorder!.mimeType
          };

          this.cleanup();
          resolve(result);
        } catch (error) {
          this.cleanup();
          reject(error);
        }
      };

      this.mediaRecorder.stop();
      this.isRecording = false;
    });
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('No recording in progress');
    }

    if (this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.pauseStartTime = Date.now();
      console.log('Recording paused');
    }
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('No recording in progress');
    }

    if (this.mediaRecorder.state === 'paused') {
      this.totalPausedTime += Date.now() - this.pauseStartTime;
      this.mediaRecorder.resume();
      console.log('Recording resumed');
    }
  }

  /**
   * Get current recording state
   */
  getState(): string {
    if (!this.mediaRecorder) {
      return 'inactive';
    }
    return this.mediaRecorder.state;
  }

  /**
   * Get audio stream for analysis (VU meter)
   */
  getAudioStream(): MediaStream | null {
    return this.audioStream;
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get supported MIME type for recording
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return ''; // Browser will use default
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.totalPausedTime = 0;
    this.pauseStartTime = 0;
  }
}
