/**
 * Recording & Audio IPC Bridges
 *
 * IPC bindings for recording, audio file operations, and transcription
 */

const { ipcRenderer } = require('electron');

export const recordingBridge = {
  start: () => ipcRenderer.invoke('recording:start'),
  stop: (
    audioData: ArrayBuffer,
    duration: number,
    courseData?: { courseId?: string; courseTitle?: string; courseNumber?: string },
    userId?: string | null,
    transcription?: string,
    title?: string,
    bookmarks?: Array<{ timestamp: number; label?: string; createdAt: Date }>
  ) => ipcRenderer.invoke('recording:stop', audioData, duration, courseData, userId, transcription, title, bookmarks),
  pause: () => ipcRenderer.invoke('recording:pause'),
  resume: () => ipcRenderer.invoke('recording:resume'),
  getStatus: () => ipcRenderer.invoke('recording:getStatus'),
};

export const audioBridge = {
  saveFile: (audioData: number[], fileName: string, folderPath: string) =>
    ipcRenderer.invoke('audio:save-file', audioData, fileName, folderPath),
  getMetadata: (filePath: string) =>
    ipcRenderer.invoke('audio:get-metadata', filePath),
};

export const transcriptionBridge = {
  assemblyai: {
    getToken: (apiKey: string) => ipcRenderer.invoke('transcription:assemblyai:getToken', apiKey),
    batchTranscribe: (apiKey: string, audioFilePath: string) =>
      ipcRenderer.invoke('transcription:assemblyai:batch', apiKey, audioFilePath),
  },
};
