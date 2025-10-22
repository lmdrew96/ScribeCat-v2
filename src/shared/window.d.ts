// Global type declarations for window.scribeCat API
// This file is referenced by both preload and renderer

declare global {
  interface Window {
    scribeCat: {
      recording: {
        start: () => Promise<{ success: boolean; error?: string }>;
        stop: (audioData: ArrayBuffer, duration: number) => Promise<{ success: boolean; sessionId?: string; filePath?: string; error?: string }>;
        pause: () => Promise<{ success: boolean; error?: string }>;
        resume: () => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{ isRecording: boolean; isPaused: boolean; duration: number; audioLevel: number; startTime?: Date; error?: string }>;
      };
      audio: {
        saveFile: (audioData: number[], fileName: string, folderPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      };
      transcription: {
        simulation: {
          start: () => Promise<{ success: boolean; sessionId?: string; error?: string }>;
          stop: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
          onResult: (callback: (result: TranscriptionResult) => void) => void;
          removeResultListener: () => void;
        };
        vosk: {
          startServer: (modelPath: string, port?: number) => Promise<{ success: boolean; serverUrl?: string; error?: string }>;
          stopServer: () => Promise<{ success: boolean; error?: string }>;
          isServerRunning: () => Promise<{ success: boolean; isRunning: boolean; serverUrl?: string; error?: string }>;
          model: {
            isInstalled: () => Promise<{ isInstalled: boolean; path?: string }>;
            getPath: () => Promise<{ success: boolean; modelPath: string; modelsDir: string; error?: string }>;
            download: () => Promise<{ success: boolean; error?: string }>;
            delete: () => Promise<{ success: boolean; error?: string }>;
            onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void;
            removeDownloadProgressListener: (callback: (progress: DownloadProgress) => void) => void;
          };
        };
        whisper: {
          start: (modelPath: string) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
          stop: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
          processAudio: (sessionId: string, audioData: number[]) => Promise<{ success: boolean; error?: string }>;
          model: {
            isInstalled: (modelName?: string) => Promise<{ success: boolean; isInstalled: boolean; error?: string }>;
            getPath: (modelName?: string) => Promise<{ success: boolean; modelPath: string; modelsDir: string; error?: string }>;
            download: (modelName?: string) => Promise<{ success: boolean; error?: string }>;
            delete: (modelName?: string) => Promise<{ success: boolean; error?: string }>;
            getAvailable: () => Promise<{ success: boolean; models: Array<{ name: string; size: string; description: string }>; error?: string }>;
            onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void;
            removeDownloadProgressListener: () => void;
          };
        };
      };
      settings: {
        getSimulationMode: () => Promise<{ success: boolean; simulationMode?: boolean; error?: string }>;
        setSimulationMode: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
      };
      store: {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<void>;
      };
      // TODO: Add type declarations when features are implemented
      // files?: { ... };
      // themes?: { ... };
      // ai?: { ... };
      // canvas?: { ... };
    };
  }
}

/**
 * Transcription result from simulation or real transcription service
 */
interface TranscriptionResult {
  /** The transcribed text */
  text: string;
  
  /** Timestamp in seconds from start of transcription */
  timestamp: number;
  
  /** Whether this is a final result (true) or partial/interim (false) */
  isFinal: boolean;
}

/**
 * Download progress information for Vosk model download
 */
interface DownloadProgress {
  /** Current stage: 'downloading', 'extracting', or 'validating' */
  stage: 'downloading' | 'extracting' | 'validating';
  
  /** Progress percentage (0-100) */
  percent: number;
  
  /** Bytes downloaded (only for 'downloading' stage) */
  downloaded?: number;
  
  /** Total bytes to download (only for 'downloading' stage) */
  total?: number;
}

export {};
