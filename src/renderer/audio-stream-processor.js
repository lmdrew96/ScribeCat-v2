/**
 * AudioWorklet Processor for streaming audio data
 * Replaces deprecated ScriptProcessorNode
 *
 * This processor runs in the AudioWorklet thread (separate from main thread)
 * and sends audio chunks via MessagePort to the main thread.
 */

class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = 4096; // Match the old ScriptProcessorNode buffer size
    this.buffer = [];
  }

  /**
   * Process audio data
   * Called automatically by Web Audio API for each 128-sample quantum
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0];

    // Handle case where there's no input
    if (!input || !input[0]) {
      return true; // Keep processor alive
    }

    // Get mono channel (channel 0)
    const channelData = input[0];

    // Add samples to buffer
    this.buffer.push(...channelData);

    // When we have enough samples, send them to main thread
    if (this.buffer.length >= this.chunkSize) {
      const chunk = new Float32Array(this.buffer.splice(0, this.chunkSize));

      // Send audio data to main thread via MessagePort
      this.port.postMessage({
        type: 'audiodata',
        data: chunk.buffer // Transfer ArrayBuffer (zero-copy)
      }, [chunk.buffer]); // Transfer ownership for performance
    }

    return true; // Keep processor alive
  }
}

// Register the processor
registerProcessor('audio-stream-processor', AudioStreamProcessor);
