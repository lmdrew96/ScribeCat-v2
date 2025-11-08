/**
 * Test fixtures for audio data
 */

/**
 * Create sample audio data (ArrayBuffer) for testing
 */
export const createSampleAudioData = (sizeInBytes: number = 1024): ArrayBuffer => {
  const buffer = new ArrayBuffer(sizeInBytes);
  const view = new Uint8Array(buffer);

  // Fill with sample data (simple sine wave pattern)
  for (let i = 0; i < sizeInBytes; i++) {
    view[i] = Math.floor(128 + 127 * Math.sin(i / 10));
  }

  return buffer;
};

/**
 * Create sample Float32Array audio data
 */
export const createSampleFloat32AudioData = (length: number = 1024): Float32Array => {
  const data = new Float32Array(length);

  // Fill with sample data (simple sine wave)
  for (let i = 0; i < length; i++) {
    data[i] = Math.sin(i / 10);
  }

  return data;
};

/**
 * Create silent audio data
 */
export const createSilentAudioData = (length: number = 1024): Float32Array => {
  return new Float32Array(length); // All zeros
};

/**
 * Create audio data with specific pattern
 */
export const createPatternAudioData = (pattern: number[], repeatCount: number = 100): Float32Array => {
  const data = new Float32Array(pattern.length * repeatCount);

  for (let i = 0; i < repeatCount; i++) {
    for (let j = 0; j < pattern.length; j++) {
      data[i * pattern.length + j] = pattern[j];
    }
  }

  return data;
};

/**
 * Sample audio metadata
 */
export interface AudioMetadata {
  duration: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  format: string;
}

/**
 * Create sample audio metadata
 */
export const createSampleAudioMetadata = (overrides: Partial<AudioMetadata> = {}): AudioMetadata => ({
  duration: 300, // 5 minutes in seconds
  sampleRate: 48000,
  channels: 1, // Mono
  bitDepth: 16,
  format: 'webm',
  ...overrides,
});

/**
 * Create a mock MediaStream for audio testing
 */
export const createMockMediaStream = () => {
  const mockTrack = {
    id: 'audio-track-123',
    kind: 'audio' as const,
    label: 'Test Microphone',
    enabled: true,
    muted: false,
    readyState: 'live' as const,
    stop: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    getCapabilities: () => ({}),
    getConstraints: () => ({}),
    getSettings: () => ({
      sampleRate: 48000,
      channelCount: 1,
    }),
  };

  const stream = {
    id: 'test-stream-123',
    active: true,
    getTracks: () => [mockTrack],
    getAudioTracks: () => [mockTrack],
    getVideoTracks: () => [],
    getTrackById: () => mockTrack,
    addTrack: () => {},
    removeTrack: () => {},
    clone: () => stream,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };

  return stream as unknown as MediaStream;
};

/**
 * Create a mock AudioContext
 */
export const createMockAudioContext = () => ({
  state: 'running' as AudioContextState,
  sampleRate: 48000,
  currentTime: 0,
  destination: {} as AudioDestinationNode,
  listener: {} as AudioListener,
  resume: async () => {},
  suspend: async () => {},
  close: async () => {},
  createAnalyser: () => ({
    fftSize: 2048,
    frequencyBinCount: 1024,
    smoothingTimeConstant: 0.8,
    connect: () => {},
    disconnect: () => {},
  }),
  createGain: () => ({
    gain: { value: 1 },
    connect: () => {},
    disconnect: () => {},
  }),
  createMediaStreamSource: () => ({
    mediaStream: createMockMediaStream(),
    connect: () => {},
    disconnect: () => {},
  }),
  createScriptProcessor: () => ({
    bufferSize: 4096,
    connect: () => {},
    disconnect: () => {},
    onaudioprocess: null,
  }),
});
