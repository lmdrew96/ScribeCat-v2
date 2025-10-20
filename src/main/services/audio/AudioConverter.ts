/**
 * AudioConverter
 * 
 * Utility class for converting audio formats for transcription services.
 * Handles conversion between Float32Array (Web Audio API) and Int16Array (Vosk PCM format).
 */

export class AudioConverter {
  /**
   * Convert Float32Array audio data to Int16Array PCM format
   * 
   * Web Audio API provides audio as Float32Array with values from -1.0 to 1.0.
   * Vosk expects Int16Array PCM with values from -32768 to 32767.
   * 
   * @param float32Array Audio data from Web Audio API
   * @returns PCM 16-bit audio data for Vosk
   */
  static float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp values to -1.0 to 1.0 range
      const clamped = Math.max(-1, Math.min(1, float32Array[i]));
      
      // Convert to 16-bit PCM
      // Multiply by 32767 (max positive value for Int16)
      int16Array[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
    }
    
    return int16Array;
  }

  /**
   * Resample audio data from one sample rate to another
   * 
   * Uses linear interpolation for resampling.
   * Vosk requires 16000 Hz sample rate, but Web Audio API often provides 48000 Hz.
   * 
   * @param audioData Input audio data
   * @param fromSampleRate Source sample rate (e.g., 48000)
   * @param toSampleRate Target sample rate (e.g., 16000)
   * @returns Resampled audio data
   */
  static resample(
    audioData: Float32Array,
    fromSampleRate: number,
    toSampleRate: number
  ): Float32Array {
    // If sample rates match, no resampling needed
    if (fromSampleRate === toSampleRate) {
      return audioData;
    }

    const ratio = fromSampleRate / toSampleRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      // Calculate source position
      const srcPos = i * ratio;
      const srcIndex = Math.floor(srcPos);
      const fraction = srcPos - srcIndex;

      // Linear interpolation between two samples
      if (srcIndex + 1 < audioData.length) {
        result[i] = audioData[srcIndex] * (1 - fraction) + 
                    audioData[srcIndex + 1] * fraction;
      } else {
        result[i] = audioData[srcIndex];
      }
    }

    return result;
  }

  /**
   * Convert audio data to the format expected by Vosk
   * 
   * Combines resampling and format conversion in one step.
   * 
   * @param audioData Input audio data (Float32Array)
   * @param sourceSampleRate Source sample rate
   * @param targetSampleRate Target sample rate (default: 16000 for Vosk)
   * @returns PCM 16-bit audio data at target sample rate
   */
  static convertForVosk(
    audioData: Float32Array,
    sourceSampleRate: number,
    targetSampleRate: number = 16000
  ): Int16Array {
    // First resample if needed
    const resampled = this.resample(audioData, sourceSampleRate, targetSampleRate);
    
    // Then convert to Int16
    return this.float32ToInt16(resampled);
  }

  /**
   * Calculate RMS (Root Mean Square) audio level
   * 
   * Useful for audio level monitoring and silence detection.
   * 
   * @param audioData Audio data to analyze
   * @returns RMS level (0.0 to 1.0)
   */
  static calculateRMS(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Detect if audio chunk contains silence
   * 
   * @param audioData Audio data to check
   * @param threshold RMS threshold below which audio is considered silence (default: 0.01)
   * @returns True if audio is silence
   */
  static isSilence(audioData: Float32Array, threshold: number = 0.01): boolean {
    return this.calculateRMS(audioData) < threshold;
  }
}
