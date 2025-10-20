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
      // TODO: Add type declarations when features are implemented
      // files?: { ... };
      // themes?: { ... };
      // ai?: { ... };
      // canvas?: { ... };
    };
  }
}

export {};
