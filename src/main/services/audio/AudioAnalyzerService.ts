/**
 * AudioAnalyzerService
 * 
 * Handles real-time audio analysis for VU meter visualization.
 * Uses Web Audio API to analyze audio levels from a MediaStream.
 * 
 * Features:
 * - Real-time audio level calculation
 * - RMS (Root Mean Square) for accurate levels
 * - Normalized output (0-1 range)
 * - Configurable FFT size and smoothing
 */

export interface AudioLevelData {
  level: number; // 0-1 range
  timestamp: number;
}

export interface AnalyzerConfig {
  fftSize?: number; // Must be power of 2 (default: 256)
  smoothingTimeConstant?: number; // 0-1 (default: 0.8)
  updateInterval?: number; // milliseconds (default: 100)
}

export class AudioAnalyzerService {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private updateIntervalId: number | null = null;
  private isAnalyzing: boolean = false;
  private currentLevel: number = 0;
  private audioDataCallback: ((data: Float32Array) => void) | null = null;

  /**
   * Initialize analyzer with audio stream
   */
  async initialize(stream: MediaStream, config: AnalyzerConfig = {}): Promise<void> {
    if (this.isAnalyzing) {
      throw new Error('Analyzer already initialized');
    }

    try {
      // Create AudioContext
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Resume AudioContext if suspended (required by modern browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create analyzer node
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = config.fftSize ?? 256;
      this.analyserNode.smoothingTimeConstant = config.smoothingTimeConstant ?? 0.8;

      // Create source from stream
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);

      // Connect nodes
      this.sourceNode.connect(this.analyserNode);

      this.isAnalyzing = true;
      console.log('Audio analyzer initialized');
    } catch (error) {
      this.cleanup();
      console.error('Error initializing audio analyzer:', error);
      throw new Error(`Failed to initialize audio analyzer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current audio level (0-1 range)
   */
  getLevel(): number {
    if (!this.isAnalyzing || !this.analyserNode) {
      return 0;
    }

    try {
      const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.analyserNode.getByteFrequencyData(dataArray);

      // Calculate RMS (Root Mean Square) for accurate audio level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      
      // Normalize to 0-1 range
      this.currentLevel = rms / 255;
      return this.currentLevel;
    } catch (error) {
      console.error('Error getting audio level:', error);
      return 0;
    }
  }

  /**
   * Get audio level data with timestamp
   */
  getLevelData(): AudioLevelData {
    return {
      level: this.getLevel(),
      timestamp: Date.now()
    };
  }

  /**
   * Start continuous level monitoring with callback
   */
  startMonitoring(callback: (data: AudioLevelData) => void, interval: number = 100): void {
    if (!this.isAnalyzing) {
      throw new Error('Analyzer not initialized');
    }

    if (this.updateIntervalId !== null) {
      this.stopMonitoring();
    }

    this.updateIntervalId = window.setInterval(() => {
      const data = this.getLevelData();
      callback(data);
    }, interval);

    console.log(`Audio level monitoring started (interval: ${interval}ms)`);
  }

  /**
   * Stop continuous level monitoring
   */
  stopMonitoring(): void {
    if (this.updateIntervalId !== null) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
      console.log('Audio level monitoring stopped');
    }
  }

  /**
   * Get frequency data (for more advanced visualizations)
   */
  getFrequencyData(): Uint8Array {
    if (!this.isAnalyzing || !this.analyserNode) {
      return new Uint8Array(0);
    }

    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * Get time domain data (waveform)
   */
  getTimeDomainData(): Uint8Array {
    if (!this.isAnalyzing || !this.analyserNode) {
      return new Uint8Array(0);
    }

    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  /**
   * Set callback for raw audio data streaming
   * Used for sending audio to transcription services
   */
  onAudioData(callback: (data: Float32Array) => void): void {
    if (!this.isAnalyzing || !this.audioContext || !this.sourceNode) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    this.audioDataCallback = callback;

    // Create script processor if not already created
    if (!this.scriptProcessor) {
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.scriptProcessor.onaudioprocess = (event) => {
        if (this.audioDataCallback) {
          const audioData = event.inputBuffer.getChannelData(0);
          this.audioDataCallback(new Float32Array(audioData));
        }
      };

      // Connect: source -> analyzer -> scriptProcessor -> destination
      if (this.analyserNode) {
        this.analyserNode.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioContext.destination);
      }
    }

    console.log('Audio data streaming enabled');
  }

  /**
   * Remove audio data callback
   */
  removeAudioDataCallback(): void {
    this.audioDataCallback = null;
    
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
      console.log('Audio data streaming disabled');
    }
  }

  /**
   * Check if analyzer is active
   */
  isActive(): boolean {
    return this.isAnalyzing;
  }

  /**
   * Get AudioContext state
   */
  getContextState(): AudioContextState | null {
    return this.audioContext?.state ?? null;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopMonitoring();
    this.removeAudioDataCallback();

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(err => {
        console.error('Error closing AudioContext:', err);
      });
      this.audioContext = null;
    }

    this.isAnalyzing = false;
    this.currentLevel = 0;
    console.log('Audio analyzer cleaned up');
  }
}
