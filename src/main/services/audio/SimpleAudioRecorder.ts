/**
 * SimpleAudioRecorder
 * 
 * A simplified, robust audio recorder built from scratch using Web Audio API.
 * Captures raw PCM audio data directly without MediaRecorder complexity.
 * 
 * Key Design Decisions:
 * - Uses Web Audio API exclusively (no MediaRecorder)
 * - Single AudioContext for both recording and analysis
 * - Direct Float32Array capture for maximum compatibility
 * - Minimal dependencies and complexity
 * - Built-in VU meter support
 */

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: string;
}

export interface RecordingConfig {
  deviceId?: string;
  sampleRate?: number; // Default: 48000
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface RecordingResult {
  audioData: Float32Array; // Raw PCM audio
  sampleRate: number;
  duration: number; // seconds
  channels: number;
}

export class SimpleAudioRecorder {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  
  private audioBuffer: Float32Array[] = [];
  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private startTime: number = 0;
  private pausedDuration: number = 0;
  private pauseStartTime: number = 0;
  
  private config: RecordingConfig = {};

  /**
   * Get list of available audio input devices
   */
  async getAudioDevices(): Promise<AudioDevice[]> {
    try {
      // Request permission first
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach(track => track.stop());

      // Enumerate devices
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

    this.config = config;

    try {
      console.log('🎙️ Starting SimpleAudioRecorder...');
      
      // Configure audio constraints
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: config.deviceId ? { exact: config.deviceId } : undefined,
          sampleRate: config.sampleRate || 48000,
          echoCancellation: config.echoCancellation ?? false,
          noiseSuppression: config.noiseSuppression ?? false,
          autoGainControl: config.autoGainControl ?? false,
          channelCount: 1 // Mono for simplicity
        }
      };

      // Get audio stream
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Log stream info
      const audioTrack = this.stream.getAudioTracks()[0];
      const settings = audioTrack.getSettings();
      console.log('📊 Stream Settings:', settings);
      console.log('  Sample Rate:', settings.sampleRate, 'Hz');
      console.log('  Channel Count:', settings.channelCount);
      console.log('  Echo Cancellation:', settings.echoCancellation);
      console.log('  Noise Suppression:', settings.noiseSuppression);
      console.log('  Auto Gain Control:', settings.autoGainControl);

      // Create AudioContext
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: config.sampleRate || 48000
      });

      // Resume if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      console.log('🔊 AudioContext created:', this.audioContext.sampleRate, 'Hz');

      // Create source node
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

      // Create analyser for VU meter
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // Create script processor for audio capture
      // Buffer size: 4096 samples (good balance between latency and efficiency)
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processorNode.onaudioprocess = (event) => {
        if (!this.isRecording || this.isPaused) {
          return;
        }

        // Get audio data
        const inputData = event.inputBuffer.getChannelData(0);
        
        // Store a copy (important: create new array)
        this.audioBuffer.push(new Float32Array(inputData));
        
        // Debug: Log first chunk
        if (this.audioBuffer.length === 1) {
          console.log('📥 First audio chunk captured:');
          console.log('  Length:', inputData.length, 'samples');
          console.log('  First 10 values:', Array.from(inputData.slice(0, 10)).map(v => v.toFixed(4)));
          
          // Check audio levels
          let max = 0;
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            const abs = Math.abs(inputData[i]);
            if (abs > max) max = abs;
            sum += abs;
          }
          console.log('  Max level:', max.toFixed(4));
          console.log('  Avg level:', (sum / inputData.length).toFixed(4));
        }
      };

      // Connect nodes: source -> analyser -> processor
      // Note: We don't connect to destination to avoid feedback
      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.processorNode);
      
      // IMPORTANT: ScriptProcessor needs to be connected to destination to work
      // But we'll use a muted gain node to prevent feedback
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0; // Mute
      this.processorNode.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Reset state
      this.audioBuffer = [];
      this.startTime = Date.now();
      this.pausedDuration = 0;
      this.isRecording = true;
      this.isPaused = false;

      console.log('✅ Recording started successfully');
    } catch (error) {
      this.cleanup();
      console.error('❌ Error starting recording:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Microphone permission denied');
        } else if (error.name === 'NotFoundError') {
          throw new Error('No microphone found');
        } else if (error.name === 'NotReadableError') {
          throw new Error('Microphone is being used by another application');
        }
      }
      
      throw new Error(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop recording and return audio data
   */
  async stopRecording(): Promise<RecordingResult> {
    if (!this.isRecording) {
      throw new Error('No recording in progress');
    }

    console.log('🛑 Stopping recording...');

    // Calculate duration
    const endTime = Date.now();
    const totalDuration = (endTime - this.startTime - this.pausedDuration) / 1000; // seconds

    // Combine all audio chunks
    const totalSamples = this.audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedAudio = new Float32Array(totalSamples);
    
    let offset = 0;
    for (const chunk of this.audioBuffer) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }

    console.log('📊 Recording Stats:');
    console.log('  Total chunks:', this.audioBuffer.length);
    console.log('  Total samples:', totalSamples);
    console.log('  Duration:', totalDuration.toFixed(2), 'seconds');
    console.log('  Sample rate:', this.audioContext?.sampleRate, 'Hz');

    // Check audio levels in final recording
    let max = 0;
    let sum = 0;
    for (let i = 0; i < combinedAudio.length; i++) {
      const abs = Math.abs(combinedAudio[i]);
      if (abs > max) max = abs;
      sum += abs;
    }
    console.log('  Max level:', max.toFixed(4));
    console.log('  Avg level:', (sum / combinedAudio.length).toFixed(4));

    const result: RecordingResult = {
      audioData: combinedAudio,
      sampleRate: this.audioContext?.sampleRate || 48000,
      duration: totalDuration,
      channels: 1
    };

    this.cleanup();
    console.log('✅ Recording stopped successfully');

    return result;
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (!this.isRecording || this.isPaused) {
      throw new Error('Cannot pause: not recording or already paused');
    }

    this.isPaused = true;
    this.pauseStartTime = Date.now();
    console.log('⏸️ Recording paused');
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (!this.isRecording || !this.isPaused) {
      throw new Error('Cannot resume: not recording or not paused');
    }

    this.pausedDuration += Date.now() - this.pauseStartTime;
    this.isPaused = false;
    console.log('▶️ Recording resumed');
  }

  /**
   * Get current recording state
   */
  getState(): 'inactive' | 'recording' | 'paused' {
    if (!this.isRecording) return 'inactive';
    if (this.isPaused) return 'paused';
    return 'recording';
  }

  /**
   * Get current audio level for VU meter (0-1 range)
   */
  getAudioLevel(): number {
    if (!this.analyserNode) {
      return 0;
    }

    try {
      const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.analyserNode.getByteFrequencyData(dataArray);

      // Calculate RMS
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      
      // Normalize to 0-1
      return rms / 255;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get audio stream for external use (e.g., Vosk transcription)
   */
  getAudioStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Get raw audio data callback for streaming (e.g., Whisper transcription)
   */
  onAudioData(callback: (data: Float32Array) => void): void {
    if (!this.processorNode) {
      throw new Error('Recording not started');
    }

    // Wrap the existing onaudioprocess to also call the callback
    const originalHandler = this.processorNode.onaudioprocess;
    const processorNode = this.processorNode; // Store reference for closure
    
    this.processorNode.onaudioprocess = (event) => {
      // Call original handler (stores data)
      if (originalHandler) {
        originalHandler.call(processorNode, event);
      }

      // Call external callback
      if (!this.isPaused) {
        const inputData = event.inputBuffer.getChannelData(0);
        callback(new Float32Array(inputData));
      }
    };

    console.log('🔄 Audio data streaming enabled');
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording && !this.isPaused;
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(err => {
        console.error('Error closing AudioContext:', err);
      });
      this.audioContext = null;
    }

    this.audioBuffer = [];
    this.isRecording = false;
    this.isPaused = false;
  }
}
